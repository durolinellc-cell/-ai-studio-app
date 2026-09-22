import express from 'express';
import { r2Configured, r2PutObject, r2GetObject, r2GetJson, r2PutJson, r2DeleteObject } from '../lib/r2.js';

const router = express.Router();

// Tat ca du lieu (file anh/video LAN metadata JSON) deu luu tren Cloudflare R2 -
// khong con phu thuoc vao o dia cua container nua, nen KHONG bi mat khi deploy lai.
const META_KEY = 'library-metadata.json';

function extFromMime(mime) {
  if (!mime) return 'bin';
  const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'bin';
}

function requireR2(res) {
  if (!r2Configured()) {
    res.status(501).json({ error: 'Chua cau hinh R2 (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) trong .env' });
    return false;
  }
  return true;
}

/**
 * GET /api/library
 */
router.get('/', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const items = await r2GetJson(META_KEY, []);
    res.json({ items });
  } catch (err) {
    console.error('Loi doc thu vien tu R2:', err);
    res.status(500).json({ error: 'Khong the doc thu vien.' });
  }
});

/**
 * POST /api/library
 * Anh: { type: 'image', imageBase64, mimeType, tool?, provider?, model? }
 * Video: { type: 'video', remoteUrl, tool?, provider?, model? }
 */
router.post('/', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { type, imageBase64, mimeType, remoteUrl, tool, provider, model } = req.body;
    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'Thieu hoac sai "type" (image|video).' });
    }

    const id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const entry = {
      id, type, tool: tool || '', provider: provider || '', model: model || '',
      label: '', favorite: false, folder: '__unsorted__', createdAt: Date.now(),
    };

    if (type === 'image') {
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: 'Thieu "imageBase64" hoac "mimeType" cho anh.' });
      }
      const ext = extFromMime(mimeType);
      const r2Key = `library-files/${id}.${ext}`;
      await r2PutObject(r2Key, Buffer.from(imageBase64, 'base64'), mimeType);
      entry.r2Key = r2Key;
      entry.mimeType = mimeType;
      entry.fileUrl = `/api/library/file/${id}`;
    } else {
      if (!remoteUrl) return res.status(400).json({ error: 'Thieu "remoteUrl" cho video.' });
      entry.remoteUrl = remoteUrl;
      entry.fileUrl = remoteUrl; // video Kling da tu host san, dung thang link do, khong can luu ban sao
    }

    const items = await r2GetJson(META_KEY, []);
    items.unshift(entry);
    await r2PutJson(META_KEY, items);

    res.json({ item: entry });
  } catch (err) {
    console.error('Loi luu vao thu vien:', err);
    res.status(500).json({ error: 'Khong the luu vao thu vien.' });
  }
});

/**
 * GET /api/library/file/:id - proxy file that tu R2 ve cho trinh duyet
 * (bucket R2 khong can bat public, chi backend co key moi doc duoc)
 */
router.get('/file/:id', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const items = await r2GetJson(META_KEY, []);
    const item = items.find((i) => i.id === req.params.id);
    if (!item || !item.r2Key) return res.status(404).send('Not found');

    const { buffer, contentType } = await r2GetObject(item.r2Key);
    res.setHeader('Content-Type', contentType || item.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (err) {
    console.error('Loi doc file tu R2:', err);
    res.status(404).send('Not found');
  }
});

/**
 * PUT /api/library/:id - Body: { label?, favorite?, folder? }
 */
router.put('/:id', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { id } = req.params;
    const { label, favorite, folder } = req.body;

    const items = await r2GetJson(META_KEY, []);
    const item = items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'Khong tim thay muc nay.' });

    if (label !== undefined) item.label = label;
    if (favorite !== undefined) item.favorite = favorite;
    if (folder !== undefined) item.folder = folder;

    await r2PutJson(META_KEY, items);
    res.json({ item });
  } catch (err) {
    console.error('Loi cap nhat thu vien:', err);
    res.status(500).json({ error: 'Khong the cap nhat.' });
  }
});

/**
 * DELETE /api/library/:id
 */
router.delete('/:id', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { id } = req.params;
    const items = await r2GetJson(META_KEY, []);
    const item = items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'Khong tim thay muc nay.' });

    if (item.r2Key) await r2DeleteObject(item.r2Key).catch(() => {});

    await r2PutJson(META_KEY, items.filter((i) => i.id !== id));
    res.json({ success: true });
  } catch (err) {
    console.error('Loi xoa muc thu vien:', err);
    res.status(500).json({ error: 'Khong the xoa.' });
  }
});

export default router;
