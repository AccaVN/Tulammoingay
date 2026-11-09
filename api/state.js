import { requireUser, getState } from "./_store.js";

export default async function handler(req, res) {
  try {
    const u = await requireUser(req, res);
    if (!u) return;
    if (req.method !== "GET") return res.status(405).json({ error: "Chỉ hỗ trợ GET" });
    res.status(200).json({ username: u.username, ...(await getState(u.id)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không đọc được dữ liệu" });
  }
}
