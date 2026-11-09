// Chạy thử trên máy: `npm run dev` rồi mở http://localhost:3000
// Không có DATABASE_URL thì dữ liệu lưu tạm trong bộ nhớ (mất khi tắt).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".js": "text/javascript" };
const port = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    let raw = "";
    for await (const c of req) raw += c;
    req.body = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : undefined;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
    try {
      const mod = await import(`./api/${name}.js`);
      return mod.default(req, res);
    } catch {
      res.statusCode = 404; return res.end("not found");
    }
  }
  const file = normalize(join(root, "public", url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(join(root, "public"))) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(file);
    res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch { res.statusCode = 404; res.end("not found"); }
}).listen(port, () => console.log(`http://localhost:${port}`));
