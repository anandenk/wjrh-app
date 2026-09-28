export interface Env {
  DB: D1Database;

  STREAM_URL: string;
  METADATA_URL: string;
  CALENDAR_URL: string;
  CORS_ORIGINS: string;

  MEDIA_BASE_URL: string;
  S3_ENDPOINT: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;

  ARCHIVES_ENABLED: string;
  MIXCLOUD_API_BASE?: string;
  MIXCLOUD_WIDGET_URL?: string;
  ARCHIVE_RETENTION_DAYS: string;
  RECENT_RETENTION_DAYS: string;
  JOIN_PROVIDER: string;
  JOIN_SALT?: string;
  ADMIN_TOKEN?: string;

  NOW_PLAYING_CACHE_SECONDS: string;
  METADATA_STALE_MINUTES: string;
  SCHEDULE_STALE_MINUTES: string;
}

export function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function flag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}
