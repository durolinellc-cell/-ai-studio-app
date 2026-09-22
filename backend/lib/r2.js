import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 tuong thich giao thuc S3, nen dung chung AWS SDK, chi doi endpoint.
// LUU Y QUAN TRONG: cac ban AWS SDK v3 gan day tu dong bat tinh nang "flexible checksums"
// (CRC32...) ma R2 khong ho tro giong het AWS S3 goc, gay loi "AccessDenied" (403) ngay
// ca khi key/secret dung. Phai tat 2 dong duoi day de tuong thich - theo huong dan chinh
// thuc cua Cloudflare: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: (process.env.R2_ENDPOINT || '').trim(), // vd: https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
  },
  forcePathStyle: true, // R2 can duong dan dang <endpoint>/<bucket>/<key>, khong phai <bucket>.<endpoint>
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export const R2_BUCKET = (process.env.R2_BUCKET_NAME || 'ai-studio-storage').trim();

export function r2Configured() {
  return Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

export async function r2PutObject(key, buffer, contentType) {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }));
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function r2GetObject(key) {
  const result = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const buffer = await streamToBuffer(result.Body);
  return { buffer, contentType: result.ContentType };
}

export async function r2GetJson(key, fallback = []) {
  try {
    const { buffer } = await r2GetObject(key);
    return JSON.parse(buffer.toString('utf-8'));
  } catch (err) {
    if (err.name === 'NoSuchKey') return fallback;
    throw err;
  }
}

export async function r2PutJson(key, data) {
  await r2PutObject(key, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'), 'application/json');
}

export async function r2DeleteObject(key) {
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
