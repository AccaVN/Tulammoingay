# Tự Làm Mỗi Ngày

Bảng việc tự lập hằng ngày cho bé (mặc định 28 việc lớp 2), có mốc phần thưởng và Góc phụ huynh (PIN) để sửa việc, quà, mục tiêu tháng, lịch sử. Người dùng tự tạo tài khoản, **mỗi tài khoản là 1 bé** với dữ liệu riêng. Chạy trên web, dùng tốt trên điện thoại, cài được ra màn hình chính.

## Cấu trúc

```
public/            giao diện tĩnh (index.html, icon, manifest, sw.js)
api/auth.js        POST /api/auth    → register | login | logout | password; GET → tài khoản đang đăng nhập
api/state.js       GET  /api/state   → { config, days } của tài khoản
api/config.js      PUT  /api/config  → lưu danh sách việc, phần thưởng, thông tin, PIN
api/day.js         PUT  /api/day     → lưu các việc đã làm của 1 ngày { date, done }
api/_store.js      kết nối Neon Postgres, tự tạo bảng tlmn_users, tlmn_sessions, tlmn_user_config, tlmn_user_days
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
4. (Tuỳ chọn) Muốn khoá đăng ký tài khoản mới: thêm biến `ALLOW_SIGNUP` = `false`.
5. **Deployments → Redeploy** để nhận biến môi trường.

## Tài khoản

- Đăng ký: tên đăng nhập 3–30 ký tự (chữ không dấu, số, `. _ -`), mật khẩu ít nhất 6 ký tự.
- Bố mẹ và con đăng nhập **cùng 1 tài khoản** trên các máy; phiên đăng nhập giữ 180 ngày.
- Sai mật khẩu 5 lần liên tiếp → khoá đăng nhập 10 phút.
- Đổi mật khẩu trong Góc phụ huynh → các máy khác phải đăng nhập lại.
- Mật khẩu lưu dạng băm scrypt, phiên lưu dạng băm SHA-256.

Dùng CLI thay cho bước 2: `npx vercel --prod` trong thư mục này.

## Dùng trên điện thoại

- Mở link `https://<tên-project>.vercel.app`, tạo tài khoản hoặc đăng nhập.
- iPhone: Safari → Chia sẻ → **Thêm vào MH chính**. Android: Chrome → ⋮ → **Thêm vào màn hình chính**.
- Góc phụ huynh: nút 🔒 Bố mẹ, PIN mặc định **1234** (đổi trong tab Thông tin & mục tiêu).

## Hoạt động khi mất mạng

App lưu mọi thao tác trên máy trước, rồi gửi lên máy chủ khi có mạng (tự đồng bộ mỗi 20 giây và khi mở lại app). Nếu chưa gắn `DATABASE_URL`, app vẫn chạy nhưng chỉ lưu trên từng máy.

## Chạy thử trên máy

```bash
npm install
npm run dev          # http://localhost:3000, dữ liệu lưu tạm trong bộ nhớ
DATABASE_URL=... npm run dev   # dùng Neon thật
```
