import { guard, body, putConfig } from "./_store.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "PUT") return res.status(405).json({ error: "Chỉ hỗ trợ PUT" });
  const c = body(req);
  if (!c || !Array.isArray(c.tasks) || !Array.isArray(c.rewards) || !Array.isArray(c.goals))
    return res.status(400).json({ error: "Dữ liệu cấu hình không hợp lệ" });
  if (JSON.stringify(c).length > 200000) return res.status(413).json({ error: "Dữ liệu quá lớn" });
  try {
    await putConfig(c);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lưu được cấu hình" });
  }
}
