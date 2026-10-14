import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'lab-reports';

export const minioClient = new Minio.Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function ensureBucketExists() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`MinIO bucket "${BUCKET_NAME}" ready.`);
    } else {
      console.log(`MinIO bucket "${BUCKET_NAME}" connected.`);
    }
  } catch (err) {
    console.warn(`⚠️ MinIO warning: Could not connect to MinIO on ${endPoint}:${port} (${err.message}). Using local disk fallback storage inside ./uploads.`);
  }
}
