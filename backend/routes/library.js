import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES_DIR = path.join(DATA_DIR, 'library-files');
const META_FILE = path.join(DATA_DIR, 'library.json');

// LUU Y VE PERSISTENCE: giong nhu characters.js, thu muc nay nam tren dia "tam thoi"
// cua container. Deploy lai code se lam mat toan bo anh da luu, tru khi gan Railway
// Volume vao duong dan nay (Settings -> Volumes -> mount "/app/data").

async function ensureStorage() {
  await fs.mkdir(FILES_DIR, { recursive: true });
  try {
    await fs.access(META_FILE);
  } catch {
    await fs.writeFile(META_FILE, '[]', 'utf-8');
  }
}

async function readMeta() {
  await ensureStorage();
  try {
    return JSON.parse(await fs.readFile(META_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeMeta(list) {
  await ensureStorage();
  await fs.writeFile(META_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function extFromMime(mime) {
  if (!mime) return 'bin';
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  };
  return map[mime] || 'bin';
}

/**
 * GET /api/library
 * Tra ve: mang metadata cua tat ca item. Anh luu tren server co truong "fileUrl"
 * (duong dan de <img>/<video> tai ve). Video tu Kling giu nguyen remoteUrl goc.
 */
router.get('/', async (req, res) => {
  try {
    const items = await readMeta();
    res.json({ items });
  } catch (err) {
    console.error('Loi doc thu vien:', err);
    res.status(500).json({ error: 'Khong the doc thu vien.' });
  }
});

/**
 * POST /api/library
 * Body cho ANH (luu file that tren server):
 *   { type: 'image', imageBase64, mimeType, tool?, provider?, model? }
 * Body cho VIDEO (Kling da tu host san, chi luu duong link):
 *   { type: 'video', remoteUrl, tool?, provider?, model? }
 */
router.post('/', async (req, res) => {
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
      const filename = `${id}.${ext}`;
      await ensureStorage();
      await fs.writeFile(path.join(FILES_DIR, filename), Buffer.from(imageBase64, 'base64'));
      entry.filename = filename;
      entry.mimeType = mimeType;
      entry.fileUrl = `/api/library/file/${id}`;
    } else {
      if (!remoteUrl) return res.status(400).json({ error: 'Thieu "remoteUrl" cho video.' });
      entry.remoteUrl = remoteUrl;
      entry.fileUrl = remoteUrl; // video da duoc Kling host san, dung thang link do
    }

    const items = await readMeta();
    items.unshift(entry);
    await writeMeta(items);

    res.json({ item: entry });
  } catch (err) {
    console.error('Loi luu vao thu vien:', err);
    res.status(500).json({ error: 'Khong the luu vao thu vien.' });
  }
});

/**
 * GET /api/library/file/:id
 * Tra ve file anh that su (duoc <img src> tren frontend goi truc tiep)
 */
router.get('/file/:id', async (req, res) => {
  try {
    const items = await readMeta();
    const item = items.find((i) => i.id === req.params.id);
    if (!item || !item.filename) return res.status(404).send('Not found');

    const filePath = path.join(FILES_DIR, item.filename);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const buffer = await fs.readFile(filePath);
    res.send(buffer);
  } catch (err) {
    console.error('Loi doc file thu vien:', err);
    res.status(404).send('Not found');
  }
});

/**
 * PUT /api/library/:id
 * Body: { label?, favorite?, folder? }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { label, favorite, folder } = req.body;

    const items = await readMeta();
    const item = items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'Khong tim thay muc nay.' });

    if (label !== undefined) item.label = label;
    if (favorite !== undefined) item.favorite = favorite;
    if (folder !== undefined) item.folder = folder;

    await writeMeta(items);
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
  try {
    const { id } = req.params;
    const items = await readMeta();
    const item = items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: 'Khong tim thay muc nay.' });

    if (item.filename) {
      await fs.unlink(path.join(FILES_DIR, item.filename)).catch(() => {});
    }

    await writeMeta(items.filter((i) => i.id !== id));
    res.json({ success: true });
  } catch (err) {
    console.error('Loi xoa muc thu vien:', err);
    res.status(500).json({ error: 'Khong the xoa.' });
  }
});

export default router;
