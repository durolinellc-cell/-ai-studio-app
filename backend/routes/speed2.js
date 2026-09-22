import express from 'express';

const router = express.Router();

/**
 * PLACEHOLDER - can thay the bang API that cua "Speed.2" khi ban xac dinh ro
 * day la dich vu gi (vd: tao video, upscale anh, tang toc xu ly...).
 *
 * Cau truc goi API thuong gap se giong the nay:
 *
 * const response = await fetch(`${process.env.SPEED2_BASE_URL}/v1/generate`, {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${process.env.SPEED2_API_KEY}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({ input: someInputTuTextHoacAnh }),
 * });
 * const data = await response.json();
 */
router.post('/process', async (req, res) => {
  res.status(501).json({
    error: 'Buoc "Speed.2" chua duoc cau hinh. Hay cho biet ro dich vu/API nay de tich hop.',
  });
});

export default router;
