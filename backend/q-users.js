const D = require("better-sqlite3");
const db = new D("../.data/deepsea.db", { readonly: true });
const u = db.prepare("SELECT email, role, password FROM users").all();
for (const x of u) {
  console.log(x.email, "|", x.role, "| len=" + String(x.password).length, "| cost12=" + String(x.password).startsWith("$2b$12"));
}