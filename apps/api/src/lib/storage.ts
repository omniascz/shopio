/**
 * Object storage — S3-compatible (MinIO in dev) for product media.
 * Per `06-catalog-pim.md` media + `38-deployment-guide.md` storage layout.
 *
 * MVP: public-read bucket with direct URLs (path-style for MinIO). Signed
 * URLs + CDN come with the production storage wave.
 */

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ShopioConfig } from '../config';

let _client: S3Client | null = null;
let _bucketReady = false;

function getClient(config: ShopioConfig): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: config.SHOPIO_S3_ENDPOINT,
    region: config.SHOPIO_S3_REGION,
    credentials: {
      accessKeyId: config.SHOPIO_S3_ACCESS_KEY,
      secretAccessKey: config.SHOPIO_S3_SECRET_KEY,
    },
    forcePathStyle: true, // MinIO
  });
  return _client;
}

/** Create the media bucket with public-read policy if it doesn't exist yet. */
async function ensureBucket(config: ShopioConfig): Promise<void> {
  if (_bucketReady) return;
  const client = getClient(config);
  const bucket = config.SHOPIO_S3_BUCKET_MEDIA;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
  _bucketReady = true;
}

export interface UploadedObject {
  key: string;
  url: string;
}

/** Public URL for an object key (path-style for MinIO). */
export function publicUrlFor(config: ShopioConfig, key: string): string {
  const base =
    config.SHOPIO_S3_PUBLIC_URL ??
    `${config.SHOPIO_S3_ENDPOINT}/${config.SHOPIO_S3_BUCKET_MEDIA}`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

/** Upload a buffer and return its public URL. */
export async function putObject(
  config: ShopioConfig,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<UploadedObject> {
  await ensureBucket(config);
  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.SHOPIO_S3_BUCKET_MEDIA,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return { key, url: publicUrlFor(config, key) };
}

/** Best-effort delete (media rows are the source of truth). */
export async function deleteObject(config: ShopioConfig, key: string): Promise<void> {
  await ensureBucket(config);
  await getClient(config).send(
    new DeleteObjectCommand({ Bucket: config.SHOPIO_S3_BUCKET_MEDIA, Key: key }),
  );
}
