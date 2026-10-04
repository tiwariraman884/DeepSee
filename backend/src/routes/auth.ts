import { Router } from "express";
import { getDb } from "../db";
import crypto from "crypto";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { validate } from "../lib/validate";
import { loginSchema, signupSchema } from "../lib/validation";
import { requireAuth } from "../lib/authMiddleware";

const router = Router();

const SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("AUTH_SECRET or SESSION_SECRET must be set");
}

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("$2")) return bcrypt.compare(plain, stored);
  const sha = crypto.createHash("sha256").update(plain + SECRET!).digest("hex");
  return sha === stored;
}

function issueToken(res: any, user: { id: string; role: string; email?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const full = { id: user.id, email: user.email || "", role: user.role, iat: now, exp: now + 60 * 60 * 24 * 7 };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(full));
  const unsigned = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", SECRET!).update(unsigned).digest("base64url");
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

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) return res.status(401).json({ error: { message: "Invalid email or password." } });

    const storedHash = user.password_hash ?? user.password ?? "";
    const valid = await verifyPassword(password, storedHash);
    if (!valid) return res.status(401).json({ error: { message: "Invalid email or password." } });

    issueToken(res, user);
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.post("/signup", validate(signupSchema), async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: { message: "An account with this email already exists." } });

    const id = randomUUID();
    const now = new Date().toISOString();
    const hash = await hashPassword(password);
    db.prepare("INSERT INTO users (id, name, email, password, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)")
      .run(id, name, email, "", hash, "user", now);

    const user = { id, name, email, role: "user" };
    issueToken(res, user);
    return res.status(201).json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("auth-token", { path: "/" });
  res.clearCookie("session_token", { path: "/" });
  return res.json({ success: true });
});

router.get("/me", requireAuth, (req, res) => {
  try {
    const userId = (req as any).user.id;
    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return res.status(404).json({ error: { message: "User not found" } });

    let avatar = "";
    let organization = "";
    try {
      const sRow = db.prepare("SELECT settings_json FROM user_settings WHERE user_id = ?").get(userId) as any;
      if (sRow?.settings_json) {
        const s = JSON.parse(sRow.settings_json);
        avatar = s.profile?.avatar || "";
        organization = s.profile?.organization || "";
      }
    } catch {}

    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar, organization } });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const { fullName, name, email, organization, avatar } = req.body;
    const newName = fullName || name;

    const db = getDb();
    if (newName) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, userId);
    if (email) { try { db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId); } catch {} }

    let currentSettings: any = {};
    const sRow = db.prepare("SELECT settings_json FROM user_settings WHERE user_id = ?").get(userId) as any;
    if (sRow?.settings_json) { try { currentSettings = JSON.parse(sRow.settings_json); } catch {} }
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
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: currentSettings.profile?.avatar || "", organization: currentSettings.profile?.organization || "" } });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message } });
  }
});

router.put("/profile", (req, res, next) => {
  (req as any).method = "PATCH";
  (router as any).handle(req, res, next);
});

export default router;
