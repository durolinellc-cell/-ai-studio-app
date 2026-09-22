import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/text/generate
 * Body: { prompt: string, maxTokens?: number }
 * Tra ve: { text: string }
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, maxTokens } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Thieu truong "prompt" hop le.' });
    }
    if (prompt.length > 8000) {
      return res.status(400).json({ error: 'Prompt qua dai (toi da 8000 ky tu).' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: Math.min(Number(maxTokens) || 1000, 4000),
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ text });
  } catch (err) {
    console.error('Loi khi goi Claude API:', err);
    res.status(500).json({ error: 'Khong the sinh van ban. Vui long thu lai.' });
  }
});

/**
 * POST /api/text/describe-image
 * Body: { imageBase64: string, mimeType: string }
 * Tra ve: { text: string }
 * Dung Claude (co kha nang nhin anh) de tu dong doc anh va viet ra mo ta ngoai hinh chi tiet,
 * dung lam "Appearance Lock" cho nhan vat - giup giu nhat quan khi tao anh/video sau nay.
 */
router.post('/describe-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Thieu "imageBase64" hoac "mimeType"' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            {
              type: 'text',
              text: 'Look at this reference image and write a detailed physical appearance description suitable for a "character appearance lock" - a fixed description used to keep this character consistent across many AI-generated images/videos. Cover: approximate age, gender presentation, hair (color/style/length), eye color, skin tone, build, facial features, clothing/outfit details, and any distinctive marks or accessories. Write it as a single dense paragraph in plain descriptive English, no headers, no bullet points, ready to paste directly into an image-generation prompt.',
            },
          ],
        },
      ],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    res.json({ text });
  } catch (err) {
    console.error('Loi khi doc anh bang Claude:', err);
    res.status(500).json({ error: 'Khong the doc anh. Vui long thu lai.' });
  }
});

export default router;
