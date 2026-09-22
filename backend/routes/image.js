import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// SDK moi cua Google (@google/genai) - tuong thich voi ca key cu (AIzaSy...)
// lan key moi "Auth key" (AQ....) ma Google chuyen sang tu giua 2026.
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FAL_KEY = process.env.FAL_KEY; // dung lam duong di cho Seedream (ByteDance)

// Anh xa model UI -> ten model that cua tung hang.
// LUU Y: day la cac model rat moi (dau 2026), ten/ID co the da doi.
// Kiem tra lai tai lieu chinh thuc truoc khi dung that:
// - Gemini: https://ai.google.dev/gemini-api/docs/models
// - OpenAI: https://platform.openai.com/docs/models
// - Seedream (qua fal.ai): https://fal.ai/models
const GEMINI_MODEL_MAP = {
  'nano-banana': 'gemini-2.5-flash-image',
  'nano-banana-2': 'gemini-3.1-flash-image',
  'nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
  'nano-banana-pro': 'gemini-3-pro-image',
};

const OPENAI_MODEL_MAP = {
  'gpt-image-2': 'gpt-image-2',
  'gpt-image-2.5': 'gpt-image-2.5',
};

const SEEDREAM_MODEL_MAP = {
  'seedream-5-pro': 'fal-ai/bytedance/seedream/v5/pro',
};

async function generateWithGemini({ prompt, model, imageBase64, mimeType, images }) {
  const modelName = GEMINI_MODEL_MAP[model] || GEMINI_MODEL_MAP['nano-banana'];

  let contents = prompt;
  if (images && images.length) {
    // Nhieu anh dau vao (vd Face Swap: anh 1 = mat, anh 2 = anh nen)
    contents = [
      ...images.map((img) => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
      { text: prompt },
    ];
  } else if (imageBase64) {
    contents = [{ inlineData: { data: imageBase64, mimeType } }, { text: prompt }];
  }

  const response = await ai.models.generateContent({ model: modelName, contents });
  const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);

  if (!imagePart) throw new Error('Model khong tra ve anh. Thu prompt khac.');
  return { imageBase64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
}

async function generateWithOpenAI({ prompt, model, resolution }) {
  if (!OPENAI_API_KEY) throw new Error('Chua cau hinh OPENAI_API_KEY trong .env');

  const modelName = OPENAI_MODEL_MAP[model] || OPENAI_MODEL_MAP['gpt-image-2'];
  const sizeMap = { '1K': '1024x1024', '2K': '2048x2048', '4K': '4096x4096' };

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      prompt,
      size: sizeMap[resolution] || '1024x1024',
      n: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Loi khi goi OpenAI Image API');

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI khong tra ve du lieu anh (b64_json).');

  return { imageBase64: b64, mimeType: 'image/png' };
}

async function generateWithSeedream({ prompt, model, resolution }) {
  if (!FAL_KEY) throw new Error('Chua cau hinh FAL_KEY trong .env (can cho Seedream)');

  const modelPath = SEEDREAM_MODEL_MAP[model] || SEEDREAM_MODEL_MAP['seedream-5-pro'];

  const res = await fetch(`https://fal.run/${modelPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, image_size: resolution || '1K' }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'Loi khi goi Seedream API');

  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('Seedream khong tra ve anh.');

  // fal.ai tra ve URL anh (khong phai base64) - tai ve va chuyen sang base64 de dong nhat response
  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  return {
    imageBase64: buffer.toString('base64'),
    mimeType: imgRes.headers.get('content-type') || 'image/png',
  };
}

/**
 * POST /api/image/generate
 * Body: { prompt: string, provider?: "gemini"|"openai"|"bytedance", model?: string, resolution?: "1K"|"2K"|"4K" }
 * Tra ve: { imageBase64: string, mimeType: string }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, provider = 'gemini', model, resolution } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Thieu truong "prompt" hop le.' });
    }

    let result;
    if (provider === 'openai') {
      result = await generateWithOpenAI({ prompt, model, resolution });
    } else if (provider === 'bytedance') {
      result = await generateWithSeedream({ prompt, model, resolution });
    } else {
      result = await generateWithGemini({ prompt, model });
    }

    res.json(result);
  } catch (err) {
    console.error('Loi khi sinh anh:', err);
    res.status(500).json({ error: err.message || 'Khong the sinh anh. Vui long thu lai.' });
  }
});

/**
 * POST /api/image/edit
 * Body: { prompt: string, imageBase64?: string, mimeType?: string, images?: [{base64, mimeType}] }
 * Tra ve: { imageBase64: string, mimeType: string }
 * Dung Gemini (Nano Banana) de chinh sua anh co san. "images" (mang) dung khi can nhieu anh dau vao,
 * vi du Face Swap (anh mat + anh nen). Cac cong cu khac (Bien the, Mo rong khung, Upscale, Doi nen,
 * Nhieu goc nhin, Goc may quay) deu di qua route nay, chi khac nhau o prompt duoc frontend tao san.
 *
 * LUU Y: Gemini/Nano Banana la model chinh sua anh bang ngon ngu tu nhien, KHONG phai cong cu
 * upscale chuyen dung (khong dam bao tang so pixel that su) va khong dam bao outpainting chinh xac
 * tung pixel nhu cac cong cu chuyen biet (Photoshop Generative Fill, Magnific...). Ket qua co the
 * khac ky vong - can thu nghiem thuc te.
 */
router.post('/edit', async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType, images } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Thieu "prompt"' });
    if (!imageBase64 && !(images && images.length)) {
      return res.status(400).json({ error: 'Thieu anh dau vao ("imageBase64" hoac "images")' });
    }

    const result = await generateWithGemini({ prompt, model: 'nano-banana', imageBase64, mimeType, images });
    res.json(result);
  } catch (err) {
    console.error('Loi khi chinh sua anh:', err);
    res.status(500).json({ error: err.message || 'Khong the chinh sua anh. Vui long thu lai.' });
  }
});

export default router;
