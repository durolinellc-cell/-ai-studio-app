import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import textRouter from './routes/text.js';
import imageRouter from './routes/image.js';
import videoRouter from './routes/video.js';
import speed2Router from './routes/speed2.js';
import charactersRouter from './routes/characters.js';
import libraryRouter from './routes/library.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Railway (va hau het cac dich vu hosting) dat server sau 1 reverse proxy, gui kem
// header X-Forwarded-For. Can khai bao "trust proxy" de express-rate-limit nhan dung
// dia chi IP that cua nguoi dung, tranh loi ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Gioi han request de tranh bi lam dung / ton chi phi API AI qua muc.
// CHI ap dung cho cac route thuc su goi API AI tra phi (text/image/video/speed2) -
// KHONG ap dung cho library/characters vi day chi la luu tru don gian, khong ton tien AI.
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 gio
  max: Number(process.env.RATE_LIMIT_MAX || 30),
  message: { error: 'Ban da vuot gioi han so luong yeu cau. Thu lai sau.' },
});

// Phuc vu frontend tinh (thu muc backend/public/)
app.use(express.static('public'));

// Cac nhom API - luu y thu tu: library/characters KHONG di qua "limiter", cac route con lai co
app.use('/api/library', libraryRouter); // Luu/doc/sua/xoa thu vien anh/video (CRUD, luu file that) - KHONG gioi han
app.use('/api/characters', charactersRouter); // Luu/doc/sua/xoa nhan vat (CRUD) - KHONG gioi han

app.use('/api/text', limiter, textRouter);   // Sinh van ban qua Claude - CO gioi han
app.use('/api/image', limiter, imageRouter); // Sinh anh + chinh sua anh qua Gemini / Nano Banana - CO gioi han
app.use('/api/video', limiter, videoRouter); // Sinh video qua Kling API - CO gioi han
app.use('/api/speed2', limiter, speed2Router); // Buoc thu 3 - can cau hinh khi ro dich vu - CO gioi han

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Bat moi request /api/* khong khop route nao -> tra JSON thay vi HTML mac dinh
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Khong tim thay route: ${req.method} ${req.originalUrl}` });
});

// Bat moi loi khong duoc catch trong cac route -> luon tra JSON, khong bao gio la HTML
app.use((err, req, res, next) => {
  console.error('Loi khong bat duoc:', err);
  res.status(500).json({ error: 'Loi server noi bo.' });
});

app.listen(PORT, () => {
  console.log(`Server dang chay tai http://localhost:${PORT}`);
});
