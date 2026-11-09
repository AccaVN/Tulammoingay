import { guard, getState } from "./_store.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Chỉ hỗ trợ GET" });
  try {
    res.status(200).json(await getState());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không đọc được dữ liệu" });
  }
}
