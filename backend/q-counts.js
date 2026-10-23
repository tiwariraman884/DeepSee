const D = require("better-sqlite3");
const db = new D("../.data/deepsea.db", { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for (const t of tables) {
  try {
    const c = db.prepare('SELECT COUNT(*) c FROM "' + t.name + '"').get().c;
    if (c > 0) console.log(t.name.padEnd(26), c);
  } catch (e) {}
}
