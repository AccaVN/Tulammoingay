// Lưu trữ cho app Tự Làm Mỗi Ngày.
// - Có DATABASE_URL (Neon Postgres): lưu vào 2 bảng tlmn_config, tlmn_days.
// - Không có DATABASE_URL khi chạy local: lưu tạm trong bộ nhớ (để thử).
// - Không có DATABASE_URL trên Vercel: trả 503, app tự lưu trên máy.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const sql = url ? neon(url) : null;
let ready = null;

function ensure() {
  if (!sql) return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS tlmn_config (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS tlmn_days (day TEXT PRIMARY KEY, done JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const mem = { config: null, days: {} };

export function available() {
  return !!sql || !process.env.VERCEL;
}

export async function getState() {
  if (!sql) return { config: mem.config, days: { ...mem.days } };
  await ensure();
  const c = await sql`SELECT data FROM tlmn_config WHERE id = 1`;
  const d = await sql`SELECT day, done FROM tlmn_days`;
  const days = {};
  for (const r of d) days[r.day] = r.done;
  return { config: c.length ? c[0].data : null, days };
}

export async function putConfig(cfg) {
  if (!sql) { mem.config = cfg; return; }
  await ensure();
  const j = JSON.stringify(cfg);
  await sql`INSERT INTO tlmn_config (id, data, updated_at) VALUES (1, ${j}::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}

export async function putDay(day, done) {
  if (!sql) { mem.days[day] = done; return; }
  await ensure();
  const j = JSON.stringify(done);
  await sql`INSERT INTO tlmn_days (day, done, updated_at) VALUES (${day}, ${j}::jsonb, now())
            ON CONFLICT (day) DO UPDATE SET done = EXCLUDED.done, updated_at = now()`;
}

// Kiểm tra mã gia đình (APP_KEY). Không đặt APP_KEY thì ai có link cũng dùng được.
export function guard(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.APP_KEY;
  if (key && req.headers["x-app-key"] !== key) {
    res.status(401).json({ error: "Sai hoặc thiếu mã gia đình" });
    return false;
  }
  if (!available()) {
    res.status(503).json({ error: "Chưa cấu hình DATABASE_URL" });
    return false;
  }
  return true;
}

export function body(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === "object" ? b : null;
}
