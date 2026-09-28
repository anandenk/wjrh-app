// Archive media storage behind an S3-compatible interface.
// Production: Cloudflare R2 (S3 API). Local: MinIO or moto. Any other
// S3-compatible host (AWS S3, Backblaze B2) works by changing env vars only.
// The Worker never proxies audio: listeners fetch MEDIA_BASE_URL/<key> directly,
// which must support HTTP Range requests for seeking.

import { AwsClient } from 'aws4fetch';
import type { Env } from './env';
import { ApiError } from './http';

export interface ArchiveStore {
  presignPut(key: string, contentType: string, expiresSeconds: number): Promise<string>;
  head(key: string): Promise<{ bytes: number; contentType: string } | null>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export function archiveStore(env: Env): ArchiveStore {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new ApiError(503, 'storage_unconfigured', 'Archive storage is not configured.');
  }
  const client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: 's3',
    region: env.S3_REGION || 'auto',
  });
  const objectUrl = (key: string) =>
    `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async presignPut(key, contentType, expiresSeconds) {
      const url = new URL(objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
      const signed = await client.sign(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        aws: { signQuery: true },
      });
      return signed.url;
    },
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new ApiError(502, 'storage_error', `Storage HEAD failed (${res.status}).`);
      return {
        bytes: Number(res.headers.get('content-length') ?? 0),
        contentType: res.headers.get('content-type') ?? '',
      };
    },
    async remove(key) {
      const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new ApiError(502, 'storage_error', `Storage DELETE failed (${res.status}).`);
    },
    publicUrl(key) {
      return `${env.MEDIA_BASE_URL.replace(/\/$/, '')}/${key}`;
    },
  };
}
