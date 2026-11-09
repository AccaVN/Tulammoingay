import {
  available, body, bearer, findUser, createUser, setFails, setPassword, getPassHash,
  hashPassword, checkPassword, createSession, userByToken, deleteSession, deleteAllSessions, LIMITS,
} from "./_store.js";

const USER_RE = /^[a-z0-9._-]{3,30}$/;
const okPass = (p) => typeof p === "string" && p.length >= 6 && p.length <= 100;
const normUser = (u) => String(u || "").trim().toLowerCase();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!available()) return res.status(503).json({ error: "Máy chủ chưa có cơ sở dữ liệu" });
  try {
    if (req.method === "GET") {
      const u = await userByToken(bearer(req));
      return u ? res.status(200).json({ username: u.username }) : res.status(401).json({ error: "Chưa đăng nhập" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Chỉ hỗ trợ GET, POST" });
    const b = body(req) || {};
    const action = b.action;

    if (action === "register") {
      if (process.env.ALLOW_SIGNUP === "false") return res.status(403).json({ error: "Hiện chưa mở đăng ký tài khoản mới" });
      const username = normUser(b.username);
      if (!USER_RE.test(username)) return res.status(400).json({ error: "Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số và . _ -" });
      if (!okPass(b.password)) return res.status(400).json({ error: "Mật khẩu cần ít nhất 6 ký tự" });
      const id = await createUser(username, await hashPassword(b.password));
      if (!id) return res.status(409).json({ error: "Tên đăng nhập này đã có người dùng" });
      return res.status(200).json({ token: await createSession(id), username });
    }

    if (action === "login") {
      const username = normUser(b.username);
      const u = await findUser(username);
      if (u && u.locked_until && new Date(u.locked_until) > new Date()) {
        const m = Math.ceil((new Date(u.locked_until) - new Date()) / 60000);
        return res.status(429).json({ error: `Sai mật khẩu nhiều lần. Thử lại sau ${m} phút` });
      }
      const ok = await checkPassword(String(b.password || ""), u ? u.pass : null);
      if (!u || !ok) {
        if (u) {
          const f = (u.fails || 0) + 1;
          if (f >= LIMITS.MAX_FAILS) await setFails(u.id, 0, new Date(Date.now() + LIMITS.LOCK_MIN * 60000).toISOString());
          else await setFails(u.id, f, null);
        }
        return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu" });
      }
      if (u.fails || u.locked_until) await setFails(u.id, 0, null);
      return res.status(200).json({ token: await createSession(u.id), username: u.username });
    }

    if (action === "logout") {
      const t = bearer(req);
      if (t) await deleteSession(t);
      return res.status(200).json({ ok: true });
    }

    if (action === "password") {
      const u = await userByToken(bearer(req));
      if (!u) return res.status(401).json({ error: "Phiên đăng nhập đã hết, hãy đăng nhập lại" });
      if (!(await checkPassword(String(b.password || ""), await getPassHash(u.id))))
        return res.status(400).json({ error: "Mật khẩu hiện tại chưa đúng" });
      if (!okPass(b.newPassword)) return res.status(400).json({ error: "Mật khẩu mới cần ít nhất 6 ký tự" });
      await setPassword(u.id, await hashPassword(b.newPassword));
      await deleteAllSessions(u.id);
      return res.status(200).json({ token: await createSession(u.id), username: u.username });
    }

    return res.status(400).json({ error: "Thao tác không hợp lệ" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Máy chủ đang lỗi, thử lại sau" });
  }
}
