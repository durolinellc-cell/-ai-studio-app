import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'characters.json');

// LUU Y VE PERSISTENCE: file nay nam tren dia cua container. Tren Railway (va nhieu
// dich vu hosting tuong tu), dia mac dinh la "ephemeral" - moi lan deploy lai (push code
// moi) container se bi tao lai tu dau va file nay se MAT, tro ve rong. De du lieu that su
// ben vung qua nhieu lan deploy, can gan mot "Volume" (Railway: Settings -> Volumes ->
// Mount path "/app/data") hoac chuyen sang dung database that (Postgres/MongoDB...).

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

async function readCharacters() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeCharacters(list) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

/**
 * GET /api/characters
 * Tra ve: mang tat ca nhan vat da luu
 */
router.get('/', async (req, res) => {
  try {
    const characters = await readCharacters();
    res.json({ characters });
  } catch (err) {
    console.error('Loi doc danh sach nhan vat:', err);
    res.status(500).json({ error: 'Khong the doc danh sach nhan vat.' });
  }
});

/**
 * POST /api/characters
 * Body: { name, lock, expressions, refImage }
 * Tao nhan vat moi, tra ve nhan vat vua tao
 */
router.post('/', async (req, res) => {
  try {
    const { name, lock, expressions, refImage } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Thieu ten nhan vat.' });
    }

    const characters = await readCharacters();
    const newChar = {
      id: 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      lock: lock || '',
      expressions: expressions || '',
      refImage: refImage || '',
      createdAt: Date.now(),
    };
    characters.unshift(newChar);
    await writeCharacters(characters);

    res.json({ character: newChar });
  } catch (err) {
    console.error('Loi tao nhan vat:', err);
    res.status(500).json({ error: 'Khong the tao nhan vat.' });
  }
});

/**
 * PUT /api/characters/:id
 * Body: { name?, lock?, expressions?, refImage? }
 * Cap nhat nhan vat da co, tra ve nhan vat sau khi sua
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lock, expressions, refImage } = req.body;

    const characters = await readCharacters();
    const character = characters.find((c) => c.id === id);
    if (!character) return res.status(404).json({ error: 'Khong tim thay nhan vat.' });

    if (name !== undefined) character.name = name.trim();
    if (lock !== undefined) character.lock = lock;
    if (expressions !== undefined) character.expressions = expressions;
    if (refImage) character.refImage = refImage;

    await writeCharacters(characters);
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
  try {
    const { id } = req.params;
    const characters = await readCharacters();
    const filtered = characters.filter((c) => c.id !== id);

    if (filtered.length === characters.length) {
      return res.status(404).json({ error: 'Khong tim thay nhan vat.' });
    }

    await writeCharacters(filtered);
    res.json({ success: true });
  } catch (err) {
    console.error('Loi xoa nhan vat:', err);
    res.status(500).json({ error: 'Khong the xoa nhan vat.' });
  }
});

export default router;
