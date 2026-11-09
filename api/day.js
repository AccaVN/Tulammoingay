import { requireUser, body, putDay } from "./_store.js";

export default async function handler(req, res) {
  try {
    const u = await requireUser(req, res);
    if (!u) return;
    if (req.method !== "PUT") return res.status(405).json({ error: "Chỉ hỗ trợ PUT" });
    const b = body(req);
    const ok = b && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && Array.isArray(b.done) && b.done.length <= 500 &&
      b.done.every((x) => typeof x === "string" && x.length <= 40);
    if (!ok) return res.status(400).json({ error: "Dữ liệu ngày không hợp lệ" });
    await putDay(u.id, b.date, [...new Set(b.done)]);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lưu được ngày" });
  }
}
