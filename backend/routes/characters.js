import express from 'express';
import { r2Configured, r2PutObject, r2GetJson, r2PutJson } from '../lib/r2.js';

const router = express.Router();

// Metadata nhan vat luu tren Cloudflare R2 (giong library.js) - ben vung qua moi lan deploy.
// Anh tham chieu duoc nhung thang vao chuoi base64 trong chinh metadata (nho gon, don gian
// hoa - khac voi library.js phai tach file rieng vi anh/video thu vien co the rat nang).
const META_KEY = 'characters-metadata.json';

function requireR2(res) {
  if (!r2Configured()) {
    res.status(501).json({ error: 'Chua cau hinh R2 (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) trong .env' });
    return false;
  }
  return true;
}

/**
 * GET /api/characters
 */
router.get('/', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const characters = await r2GetJson(META_KEY, []);
    res.json({ characters });
  } catch (err) {
    console.error('Loi doc danh sach nhan vat:', err);
    res.status(500).json({ error: 'Khong the doc danh sach nhan vat.' });
  }
});

/**
 * POST /api/characters
 * Body: { name, lock, expressions, refImage }
 */
router.post('/', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { name, lock, expressions, refImage } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Thieu ten nhan vat.' });
    }

    const characters = await r2GetJson(META_KEY, []);
    const newChar = {
      id: 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      lock: lock || '',
      expressions: expressions || '',
      refImage: refImage || '',
      createdAt: Date.now(),
    };
    characters.unshift(newChar);
    await r2PutJson(META_KEY, characters);

    res.json({ character: newChar });
  } catch (err) {
    console.error('Loi tao nhan vat:', err);
    res.status(500).json({ error: 'Khong the tao nhan vat.' });
  }
});

/**
 * PUT /api/characters/:id
 */
router.put('/:id', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { id } = req.params;
    const { name, lock, expressions, refImage } = req.body;

    const characters = await r2GetJson(META_KEY, []);
    const character = characters.find((c) => c.id === id);
    if (!character) return res.status(404).json({ error: 'Khong tim thay nhan vat.' });

    if (name !== undefined) character.name = name.trim();
    if (lock !== undefined) character.lock = lock;
    if (expressions !== undefined) character.expressions = expressions;
    if (refImage) character.refImage = refImage;

    await r2PutJson(META_KEY, characters);
    res.json({ character });
  } catch (err) {
    console.error('Loi cap nhat nhan vat:', err);
    res.status(500).json({ error: 'Khong the cap nhat nhan vat.' });
  }
});

/**
 * DELETE /api/characters/:id
 */
router.delete('/:id', async (req, res) => {
  if (!requireR2(res)) return;
  try {
    const { id } = req.params;
    const characters = await r2GetJson(META_KEY, []);
    const filtered = characters.filter((c) => c.id !== id);

    if (filtered.length === characters.length) {
      return res.status(404).json({ error: 'Khong tim thay nhan vat.' });
    }

    await r2PutJson(META_KEY, filtered);
    res.json({ success: true });
  } catch (err) {
    console.error('Loi xoa nhan vat:', err);
    res.status(500).json({ error: 'Khong the xoa nhan vat.' });
  }
});

export default router;
