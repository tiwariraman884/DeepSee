import { Router } from "express";
import { getDb } from "../db";
import crypto from "crypto";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const router = Router();

// Signing secret — MUST come from the environment in production. The hardcoded
// default exists only so local development keeps working out of the box.
const DEV_FALLBACK_SECRET = "deepsea-guardian-very-secret-key-that-is-32-chars-long";
const SECRET =
  process.env.AUTH_SECRET || process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_SECRET);
if (!SECRET) {
  throw new Error("AUTH_SECRET (or SESSION_SECRET) must be set in production");
}

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

// New registrations use bcrypt (10 rounds)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify against bcrypt hash OR legacy SHA-256 hash
async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // bcrypt hashes always start with $2
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  // Legacy SHA-256 fallback
  const sha = crypto.createHash("sha256").update(plain + SECRET).digest("hex");
  return sha === stored;
}

function issueToken(res: any, user: { id: string; role: string; email?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const full = { id: user.id, email: user.email || "", role: user.role, iat: now, exp: now + 60 * 60 * 24 * 7 };

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(full));
  const unsigned = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", SECRET).update(unsigned).digest("base64url");
  const token = `${unsigned}.${sig}`;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7 * 1000,
  };

  res.cookie("auth-token", token, cookieOptions);
  res.cookie("session_token", token, cookieOptions);
  return token;
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: "Email and password are required." } });
  }

  try {
    const db = getDb();

    // 1. Try the admin shortcut (credentials from env in production; the demo
    //    pair remains available in development only).
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@deepsea.io";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "DeepSea2026!";
    if (email === adminEmail && password === adminPassword) {
      let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      if (!user) {
        const now = new Date().toISOString();
        const id = "usr_admin";
        const ph = await hashPassword(password);
        db.prepare(
          "INSERT OR IGNORE INTO users (id, name, email, password, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)"
        ).run(id, "Admin", email, "", ph, "admin", now);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      }
      issueToken(res, user);
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    // 2. Look up user by email in DB
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) {
      return res.status(401).json({ error: { message: "Invalid email or password." } });
    }

    // 3. Verify password — supports bcrypt (legacy & new) and SHA-256
    const storedHash = user.password_hash ?? user.password ?? "";
    const valid = await verifyPassword(password, storedHash);
    if (!valid) {
      return res.status(401).json({ error: { message: "Invalid email or password." } });
    }

    // 4. Issue session
    issueToken(res, user);
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ── SIGNUP ────────────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: { message: "Name, email and password are required." } });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: { message: "Password must be at least 8 characters." } });
  }

  try {
    const db = getDb();

    // Check if email already taken
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: { message: "An account with this email already exists." } });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const hash = await hashPassword(password);

    db.prepare(
      "INSERT INTO users (id, name, email, password, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)"
    ).run(id, name, email, "", hash, "user", now);

    const user = { id, name, email, role: "user" };
    issueToken(res, user);
    return res.status(201).json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ── LOGOUT ────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("auth-token", { path: "/" });
  res.clearCookie("session_token", { path: "/" });
  return res.json({ success: true });
});

// ── ME ────────────────────────────────────────────────────────────────────
router.get("/me", (req, res) => {
  const token = req.cookies["auth-token"] || req.cookies.session_token;
  if (!token) return res.status(401).json({ error: { message: "Not logged in" } });

  try {
    const parts = token.split(".");
    let userId: string | null = null;

    if (parts.length === 3) {
      const [header, body, sig] = parts;
      const unsigned = `${header}.${body}`;
      const expectedSig = crypto.createHmac("sha256", SECRET).update(unsigned).digest("base64url");
      if (sig !== expectedSig) {
        return res.status(401).json({ error: { message: "Invalid token" } });
      }
      const payload = JSON.parse(fromB64url(body));
      userId = payload.id;
    } else if (parts.length === 2) {
      const [payload, signature] = parts;
      const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
      if (signature !== expectedSig) {
        return res.status(401).json({ error: { message: "Invalid token" } });
      }
      const parsed = JSON.parse(Buffer.from(payload, "base64").toString());
      userId = parsed.userId;
    } else {
      return res.status(401).json({ error: { message: "Invalid token" } });
    }

    if (!userId) return res.status(401).json({ error: { message: "Invalid token" } });

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    // Look up avatar & organization in user_settings
    let avatar = "";
    let organization = "";
    try {
      const sRow = db.prepare("SELECT settings_json FROM user_settings WHERE user_id = ?").get(userId) as any;
      if (sRow && sRow.settings_json) {
        const s = JSON.parse(sRow.settings_json);
        avatar = s.profile?.avatar || "";
        organization = s.profile?.organization || "";
      }
    } catch {}

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar,
        organization,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

// ── UPDATE PROFILE ────────────────────────────────────────────────────────
router.patch("/profile", async (req, res) => {
  const token = req.cookies["auth-token"] || req.cookies.session_token;
  if (!token) return res.status(401).json({ error: { message: "Not logged in" } });

  try {
    const parts = token.split(".");
    let userId: string | null = null;
    if (parts.length === 3) {
      const payload = JSON.parse(fromB64url(parts[1]));
      userId = payload.id;
    } else if (parts.length === 2) {
      const parsed = JSON.parse(Buffer.from(parts[0], "base64").toString());
      userId = parsed.userId;
    }
    if (!userId) return res.status(401).json({ error: { message: "Invalid token" } });

    const { fullName, name, email, organization, avatar } = req.body;
    const newName = fullName || name;

    const db = getDb();
    if (newName) {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, userId);
    }
    if (email) {
      try {
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId);
      } catch {}
    }

    // Update user_settings profile object
    let currentSettings: any = {};
    const sRow = db.prepare("SELECT settings_json FROM user_settings WHERE user_id = ?").get(userId) as any;
    if (sRow && sRow.settings_json) {
      try { currentSettings = JSON.parse(sRow.settings_json); } catch {}
    }
    currentSettings.profile = {
      ...(currentSettings.profile || {}),
      fullName: newName || currentSettings.profile?.fullName || "",
      email: email || currentSettings.profile?.email || "",
      organization: organization !== undefined ? organization : currentSettings.profile?.organization,
      avatar: avatar !== undefined ? avatar : currentSettings.profile?.avatar,
    };
    const jsonStr = JSON.stringify(currentSettings);
    db.prepare("INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at").run(userId, jsonStr);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: currentSettings.profile?.avatar || "",
        organization: currentSettings.profile?.organization || "",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.put("/profile", (req, res) => {
  return router.handle({ ...req, method: "PATCH" } as any, res, () => {});
});

export default router;
