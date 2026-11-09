# Tự Làm Mỗi Ngày

Bảng việc tự lập hằng ngày cho bé (mặc định 28 việc lớp 2), có mốc phần thưởng và Góc phụ huynh (PIN) để sửa việc, quà, mục tiêu tháng, lịch sử. Chạy trên web, dùng tốt trên điện thoại, cài được ra màn hình chính.

## Cấu trúc

```
public/            giao diện tĩnh (index.html, icon, manifest, sw.js)
api/state.js       GET  /api/state   → { config, days }
api/config.js      PUT  /api/config  → lưu danh sách việc, phần thưởng, thông tin, PIN
api/day.js         PUT  /api/day     → lưu các việc đã làm của 1 ngày { date, done }
api/_store.js      kết nối Neon Postgres, tự tạo bảng tlmn_config, tlmn_days
dev-server.mjs     chạy thử trên máy
```

## Deploy lên Vercel

1. Đẩy thư mục này lên GitHub (vd `AccaVN/Tulammoingay`):
   ```bash
   git remote add origin https://github.com/AccaVN/Tulammoingay.git
   git push -u origin main
   ```
2. Vercel → **Add New → Project** → chọn repo → Framework Preset: **Other** → để trống Build Command → **Deploy**.
3. Gắn cơ sở dữ liệu: trong project → **Storage → Create Database → Neon** → Connect vào project (Vercel tự thêm `DATABASE_URL`).
   Hoặc dùng Neon có sẵn: **Settings → Environment Variables** → thêm `DATABASE_URL` = chuỗi kết nối Neon. Bảng tự tạo ở lần gọi đầu tiên.
4. (Nên làm) Thêm biến `APP_KEY` = mã gia đình, ví dụ `nhaminh2026`. Mỗi máy nhập mã này 1 lần để đồng bộ. Không đặt thì ai có link cũng sửa được dữ liệu.
5. **Deployments → Redeploy** để nhận biến môi trường.

Dùng CLI thay cho bước 2: `npx vercel --prod` trong thư mục này.

## Dùng trên điện thoại

- Mở link `https://<tên-project>.vercel.app`, nhập mã gia đình nếu được hỏi.
- iPhone: Safari → Chia sẻ → **Thêm vào MH chính**. Android: Chrome → ⋮ → **Thêm vào màn hình chính**.
- Góc phụ huynh: nút 🔒 Bố mẹ, PIN mặc định **1234** (đổi trong tab Thông tin & mục tiêu).

## Hoạt động khi mất mạng

App lưu mọi thao tác trên máy trước, rồi gửi lên máy chủ khi có mạng (tự đồng bộ mỗi 20 giây và khi mở lại app). Nếu chưa gắn `DATABASE_URL`, app vẫn chạy nhưng chỉ lưu trên từng máy.

## Chạy thử trên máy

```bash
npm install
npm run dev          # http://localhost:3000, dữ liệu lưu tạm trong bộ nhớ
DATABASE_URL=... APP_KEY=abc npm run dev   # dùng Neon thật
```
