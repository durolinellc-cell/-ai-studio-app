import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ============================================================
// KLING AI - API CHINH CHU (khong qua trung gian)
// Dang ky tai: https://app.klingai.com/global/dev -> muc "API Keys"
// Tai lieu: https://kling.ai/document-api
// ============================================================
const KLING_BASE_URL = 'https://api.klingai.com';
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;

// Kling dung JWT (HS256) thay vi API key tinh: ky moi token cho tung request,
// het han sau 30 phut. iss = Access Key, ky bang Secret Key.
function generateKlingToken() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: KLING_ACCESS_KEY, exp: now + 1800, nbf: now - 5 },
    KLING_SECRET_KEY,
    { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } }
  );
}

// Anh xa model UI -> model_name that cua Kling (theo enum chinh thuc).
// Kiem tra danh sach cap nhat tai: https://kling.ai/document-api/apiReference/model/textToVideo
const KLING_MODEL_MAP = {
  'v1': 'kling-v1',
  'v1.6': 'kling-v1-6',
  'v2-master': 'kling-v2-master',
  'v2.1-master': 'kling-v2-1-master',
  'v2.5-turbo': 'kling-v2-5-turbo',
  'v2.6': 'kling-v2-6',
  'v3': 'kling-v3',
};

function resolveKlingModel(model) {
  return KLING_MODEL_MAP[model] || 'kling-v2-master';
}

// Kling la API bat dong bo: submit task -> nhan task_id -> poll GET cho toi khi xong.
// Production nen dung "callback_url" (webhook) thay vi poll, de khong giu ket noi lau.
async function pollKlingTask(path, taskId, { intervalMs = 4000, maxWaitMs = 300000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const token = generateKlingToken(); // token co the het han giua chung neu cho lau, nen tao lai moi lan poll
    const res = await fetch(`${KLING_BASE_URL}${path}/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const status = data?.data?.task_status;

    if (status === 'succeed') {
      return data.data.task_result?.videos?.[0]?.url;
    }
    if (status === 'failed') {
      throw new Error(data?.data?.task_status_msg || 'Kling bao loi khi xu ly task');
    }
    // "submitted" hoac "processing" -> cho roi thu lai
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Qua thoi gian cho ket qua tu Kling (timeout).');
}

/**
 * POST /api/video/text-to-video
 * Body: { prompt, duration?, aspectRatio?, resolution?, quality?("std"|"pro"), negativePrompt?, model? }
 *
 * LUU Y QUAN TRONG: theo tai lieu Kling hien tai, tham so "aspect_ratio" chinh thuc chi
 * ho tro 3 gia tri: "16:9", "9:16", "1:1". Cac ti le khac (4:3, 3:4, 3:2, 2:3) va tham so
 * "resolution" (1080p/2K/4K) o day duoc GUI THU len API - Kling co the bo qua hoac
 * tra loi loi 400 neu khong ho tro. Can kiem tra thuc te / doc tai lieu moi nhat
 * tai https://kling.ai/document-api truoc khi dung that, va co the can dung dich vu
 * upscale rieng (vd Topaz) neu Kling khong xuat duoc 4K truc tiep.
 */
router.post('/text-to-video', async (req, res) => {
  try {
    if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
      return res.status(501).json({ error: 'Chua cau hinh KLING_ACCESS_KEY / KLING_SECRET_KEY trong .env' });
    }

    const { prompt, duration, aspectRatio, resolution, quality, negativePrompt, model } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Thieu "prompt"' });

    const token = generateKlingToken();

    const submitRes = await fetch(`${KLING_BASE_URL}/v1/videos/text2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: resolveKlingModel(model),
        prompt,
        negative_prompt: negativePrompt || undefined,
        mode: quality === 'pro' ? 'pro' : 'std',
        aspect_ratio: (aspectRatio && aspectRatio !== 'auto') ? aspectRatio : undefined,
        resolution: resolution || undefined, // gui thu - xem ghi chu o tren
        duration: duration || '5',
      }),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok || !submitData?.data?.task_id) {
      console.error('Loi submit Kling text2video:', submitData);
      return res.status(502).json({ error: submitData?.message || 'Loi khi goi Kling API' });
    }

    const videoUrl = await pollKlingTask('/v1/videos/text2video', submitData.data.task_id);
    res.json({ videoUrl });
  } catch (err) {
    console.error('Loi text-to-video (Kling):', err);
    res.status(500).json({ error: err.message || 'Khong the sinh video. Vui long thu lai.' });
  }
});

/**
 * POST /api/video/image-to-video
 * Body: {
 *   mode: "standard"|"frames"|"loop"|"extend"|"talking"|"brush",
 *   prompt, model?, aspectRatio?, duration?,
 *   imageUrl, endImageUrl? (cho mode "frames")
 * }
 */
router.post('/image-to-video', async (req, res) => {
  try {
    if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
      return res.status(501).json({ error: 'Chua cau hinh KLING_ACCESS_KEY / KLING_SECRET_KEY trong .env' });
    }

    const { mode = 'standard', prompt, model, aspectRatio, resolution, duration, imageUrl, endImageUrl } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Thieu "prompt"' });

    if (mode === 'talking') {
      return res.status(501).json({
        error: 'Kling khong ho tro "Anh noi chuyen" (lip-sync) - can dich vu rieng nhu HeyGen/Hedra/D-ID.',
      });
    }
    if (mode === 'brush') {
      return res.status(501).json({
        error: 'Kling khong ho tro Motion Brush qua API - tinh nang nay chi co o Runway.',
      });
    }
    if (mode === 'extend') {
      return res.status(501).json({
        error: 'Kling chua co endpoint "mo rong video" cong khai on dinh trong tai lieu API hien tai.',
      });
    }
    if (!imageUrl) return res.status(400).json({ error: 'Thieu "imageUrl"' });

    const body = {
      model_name: resolveKlingModel(model),
      prompt,
      image: imageUrl, // Kling nhan URL hoac base64 cho truong "image"
      aspect_ratio: (aspectRatio && aspectRatio !== 'auto') ? aspectRatio : undefined, // xem ghi chu gioi han o route text-to-video ben tren
      resolution: resolution || undefined,
      duration: duration || '5',
    };
    if (mode === 'frames') {
      if (!endImageUrl) return res.status(400).json({ error: 'Thieu "endImageUrl" cho che do khung dau-cuoi' });
      body.image_tail = endImageUrl;
    }

    const token = generateKlingToken();
    const submitRes = await fetch(`${KLING_BASE_URL}/v1/videos/image2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const submitData = await submitRes.json();
    if (!submitRes.ok || !submitData?.data?.task_id) {
      console.error('Loi submit Kling image2video:', submitData);
      return res.status(502).json({ error: submitData?.message || 'Loi khi goi Kling API' });
    }

    const videoUrl = await pollKlingTask('/v1/videos/image2video', submitData.data.task_id);
    res.json({ videoUrl });
  } catch (err) {
    console.error('Loi image-to-video (Kling):', err);
    res.status(500).json({ error: err.message || 'Khong the sinh video. Vui long thu lai.' });
  }
});

export default router;
