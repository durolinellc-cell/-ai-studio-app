# AI SaaS Web — Khung dự án khởi điểm

Website nhận prompt từ user → sinh văn bản (Claude) → sinh ảnh (Gemini "Nano Banana") →
(bước 3 "Speed.2" — cắm API sau khi xác định rõ dịch vụ).

## 1. Cấu trúc thư mục

```
ai-saas-app/
├── backend/
│   ├── server.js          # Điểm khởi động Express
│   ├── routes/
│   │   ├── text.js        # POST /api/text/generate   -> gọi Claude API
│   │   ├── image.js       # POST /api/image/generate  -> gọi Gemini (Nano Banana)
│   │   └── speed2.js       # POST /api/speed2/process  -> placeholder, chờ API cụ thể
│   ├── package.json
│   └── .env.example       # copy thành .env rồi điền API key thật
└── frontend/
    └── index.html         # giao diện demo test 2 bước: text -> ảnh
```

## 2. Chạy thử ở máy local

```bash
cd backend
npm install
cp .env.example .env
# Mở .env, điền ANTHROPIC_API_KEY và GOOGLE_API_KEY của bạn
npm start
```

Sau đó mở trình duyệt: `http://localhost:3000`

Lấy API key:
- Claude: https://console.anthropic.com/settings/keys
- Gemini/Nano Banana: https://aistudio.google.com/apikey

## 3. Những phần CẦN LÀM THÊM trước khi bán cho user thật

Đây là phần quan trọng nhất — bộ khung trên chỉ là "lõi kỹ thuật", còn để thành một
sản phẩm bán được, bạn cần thêm các mảnh sau:

### a) Xác thực người dùng (đăng ký / đăng nhập)
- Dễ nhất: dùng dịch vụ có sẵn như **Clerk**, **Auth0**, hoặc **Supabase Auth**
  (đỡ phải tự code bảo mật mật khẩu, quên mật khẩu, OAuth Google...).
- Tự code: dùng `bcrypt` để hash mật khẩu + `jsonwebtoken` để cấp JWT.

### b) Thanh toán & giới hạn sử dụng (credit / subscription)
- **Stripe** là lựa chọn phổ biến nhất (hỗ trợ subscription, one-time payment, invoice).
  Ở Việt Nam nếu cần nhận VND trực tiếp có thể xem thêm VNPay, Momo, PayOS.
- Logic cần có: mỗi user có số "credit" hoặc "lượt dùng/tháng" → trừ credit mỗi lần
  gọi `/api/text/generate` hoặc `/api/image/generate` → chặn nếu hết credit.
- Đây là phần bắt buộc để tránh user gọi API AI vô hạn làm bạn lỗ (vì bạn trả tiền
  cho Anthropic/Google theo lượng token/ảnh sinh ra).

### c) Cơ sở dữ liệu
- Lưu: tài khoản user, lịch sử tạo nội dung, số credit còn lại, giao dịch thanh toán.
- Gợi ý: **PostgreSQL** (qua Supabase/Neon/Railway) hoặc **MongoDB Atlas** — cả hai
  đều có gói miễn phí để bắt đầu.

### d) Deploy (đưa web lên internet thật)
- Backend: Railway, Render, Fly.io, hoặc VPS riêng (DigitalOcean).
- Frontend: có thể gộp chung với backend (như file hiện tại) hoặc tách ra deploy
  trên Vercel/Netlify nếu sau này làm frontend phức tạp hơn (React/Next.js).
- **Không bao giờ để lộ API key ở phía frontend** — mọi lệnh gọi Claude/Gemini phải
  đi qua backend của bạn (đúng như cấu trúc hiện tại), để user không lấy trộm được key.

### e) Bước "Speed.2"
File `backend/routes/speed2.js` hiện là placeholder. Khi bạn cho mình biết chính xác
đây là dịch vụ/API nào (link tài liệu API của họ), mình sẽ viết code tích hợp thật.

## 4. Ước tính chi phí vận hành cần lưu ý
- Chi phí API Claude: tính theo token input/output.
- Chi phí API Gemini image: tính theo mỗi ảnh sinh ra.
- Bạn nên đặt giá bán cho user (gói credit/tháng) cao hơn chi phí API để có lời,
  và có rate-limit (đã có sẵn trong `server.js`) để tránh bị lạm dụng gây lỗ.
