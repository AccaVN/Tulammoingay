// Lưu trữ + tài khoản cho app Tự Làm Mỗi Ngày.
// - Có DATABASE_URL (Neon Postgres): lưu vào các bảng tlmn_users, tlmn_sessions, tlmn_user_config, tlmn_user_days.
// - Không có DATABASE_URL khi chạy local: lưu tạm trong bộ nhớ (để thử).
// - Không có DATABASE_URL trên Vercel: trả 503, app tự lưu trên máy.
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const sql = url ? neon(url) : null;
const SESSION_DAYS = 180;
const MAX_FAILS = 5;
const LOCK_MIN = 10;

let ready = null;
function ensure() {
  if (!sql) return Promise.resolve();
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS tlmn_users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, fails INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS tlmn_sessions (token TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES tlmn_users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS tlmn_user_config (user_id INT PRIMARY KEY REFERENCES tlmn_users(id) ON DELETE CASCADE, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
      await sql`CREATE TABLE IF NOT EXISTS tlmn_user_days (user_id INT NOT NULL REFERENCES tlmn_users(id) ON DELETE CASCADE, day TEXT NOT NULL, done JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, day))`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// ---------- bộ nhớ tạm khi chạy thử không có cơ sở dữ liệu ----------
const mem = { users: [], sessions: new Map(), config: new Map(), days: new Map() };

export function available() {
  return !!sql || !process.env.VERCEL;
}

// ---------- mật khẩu & phiên đăng nhập ----------
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = await scrypt(pw, salt, 64);
  return `scrypt$${salt}$${h.toString("hex")}`;
}
export async function checkPassword(pw, stored) {
  const [, salt, hex] = String(stored || "scrypt$00$00").split("$");
  const h = await scrypt(pw, salt || "00", 64);
  const want = Buffer.from(hex || "", "hex");
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

export async function findUser(username) {
  if (!sql) return mem.users.find((u) => u.username === username) || null;
  await ensure();
  const r = await sql`SELECT id, username, pass, fails, locked_until FROM tlmn_users WHERE username = ${username}`;
  return r[0] || null;
}
export async function createUser(username, pass) {
  if (!sql) {
    if (mem.users.some((u) => u.username === username)) return null;
    const u = { id: mem.users.length + 1, username, pass, fails: 0, locked_until: null };
    mem.users.push(u); return u.id;
  }
  await ensure();
  const r = await sql`INSERT INTO tlmn_users (username, pass) VALUES (${username}, ${pass}) ON CONFLICT (username) DO NOTHING RETURNING id`;
  return r[0] ? r[0].id : null;
}
export async function setFails(id, fails, lockedUntil) {
  if (!sql) { const u = mem.users.find((x) => x.id === id); if (u) { u.fails = fails; u.locked_until = lockedUntil; } return; }
  await sql`UPDATE tlmn_users SET fails = ${fails}, locked_until = ${lockedUntil} WHERE id = ${id}`;
}
export async function setPassword(id, pass) {
  if (!sql) { const u = mem.users.find((x) => x.id === id); if (u) u.pass = pass; return; }
  await sql`UPDATE tlmn_users SET pass = ${pass} WHERE id = ${id}`;
}
export async function getPassHash(id) {
  if (!sql) { const u = mem.users.find((x) => x.id === id); return u ? u.pass : null; }
  const r = await sql`SELECT pass FROM tlmn_users WHERE id = ${id}`;
  return r[0] ? r[0].pass : null;
}
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  if (!sql) { mem.sessions.set(sha(token), { userId, at: Date.now() }); return token; }
  await ensure();
  await sql`INSERT INTO tlmn_sessions (token, user_id) VALUES (${sha(token)}, ${userId})`;
  return token;
}
export async function userByToken(token) {
  if (!token) return null;
  if (!sql) {
    const s = mem.sessions.get(sha(token));
    if (!s || Date.now() - s.at > SESSION_DAYS * 864e5) return null;
    const u = mem.users.find((x) => x.id === s.userId);
    return u ? { id: u.id, username: u.username } : null;
  }
  await ensure();
  const r = await sql`SELECT u.id, u.username FROM tlmn_sessions s JOIN tlmn_users u ON u.id = s.user_id
                      WHERE s.token = ${sha(token)} AND s.created_at > now() - make_interval(days => ${SESSION_DAYS})`;
  return r[0] || null;
}
export async function deleteSession(token) {
  if (!sql) { mem.sessions.delete(sha(token)); return; }
  await sql`DELETE FROM tlmn_sessions WHERE token = ${sha(token)}`;
}
export async function deleteAllSessions(userId) {
  if (!sql) { for (const [k, s] of mem.sessions) if (s.userId === userId) mem.sessions.delete(k); return; }
  await sql`DELETE FROM tlmn_sessions WHERE user_id = ${userId}`;
}
export const LIMITS = { MAX_FAILS, LOCK_MIN };

// ---------- dữ liệu của bé ----------
export async function getState(userId) {
  if (!sql) return { config: mem.config.get(userId) || null, days: { ...(mem.days.get(userId) || {}) } };
  await ensure();
  const c = await sql`SELECT data FROM tlmn_user_config WHERE user_id = ${userId}`;
  const d = await sql`SELECT day, done FROM tlmn_user_days WHERE user_id = ${userId}`;
  const days = {};
  for (const r of d) days[r.day] = r.done;
  return { config: c.length ? c[0].data : null, days };
}
export async function putConfig(userId, cfg) {
  if (!sql) { mem.config.set(userId, cfg); return; }
  await ensure();
  const j = JSON.stringify(cfg);
  await sql`INSERT INTO tlmn_user_config (user_id, data, updated_at) VALUES (${userId}, ${j}::jsonb, now())
            ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
}
export async function putDay(userId, day, done) {
  if (!sql) { const m = mem.days.get(userId) || {}; m[day] = done; mem.days.set(userId, m); return; }
  await ensure();
  const j = JSON.stringify(done);
  await sql`INSERT INTO tlmn_user_days (user_id, day, done, updated_at) VALUES (${userId}, ${day}, ${j}::jsonb, now())
            ON CONFLICT (user_id, day) DO UPDATE SET done = EXCLUDED.done, updated_at = now()`;
}

// ---------- tiện ích cho các API ----------
export function bearer(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
// Trả về user nếu hợp lệ; nếu không thì đã gửi lỗi và trả null.
export async function requireUser(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!available()) { res.status(503).json({ error: "Chưa cấu hình DATABASE_URL" }); return null; }
  const u = await userByToken(bearer(req));
  if (!u) { res.status(401).json({ error: "Phiên đăng nhập đã hết, hãy đăng nhập lại" }); return null; }
  return u;
}
export function body(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === "object" ? b : null;
}
