import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import textRouter from './routes/text.js';
import imageRouter from './routes/image.js';
import videoRouter from './routes/video.js';
import speed2Router from './routes/speed2.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Gioi han request de tranh bi lam dung / ton chi phi API AI qua muc
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 gio
  max: Number(process.env.RATE_LIMIT_MAX || 30),
  message: { error: 'Ban da vuot gioi han so luong yeu cau. Thu lai sau.' },
});
app.use('/api/', limiter);

// Phuc vu frontend tinh (thu muc frontend/)
app.use(express.static('../frontend'));

// Cac nhom API
app.use('/api/text', textRouter);   // Sinh van ban qua Claude
app.use('/api/image', imageRouter); // Sinh anh + chinh sua anh qua Gemini / Nano Banana
app.use('/api/video', videoRouter); // Sinh video (text-to-video, image-to-video) qua Kling API
app.use('/api/speed2', speed2Router); // Buoc thu 3 - can cau hinh khi ro dich vu

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
