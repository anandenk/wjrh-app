// Mixcloud as an archive provider (decision 002, option 1).
//
// The recorder uploads each show to the station's Mixcloud account itself (it holds
// the OAuth token), then registers the cloudcast key here. Listeners play it through
// Mixcloud's widget, so Mixcloud's licences, player and listening limits apply and no
// audio touches our storage. Reading a cloudcast is a public, unauthenticated call.

import type { Env } from './env';
import { ApiError } from './http';

const KEY = /^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/$/;

export function isMixcloudKey(key: string): boolean {
  return KEY.test(key);
}

export interface Cloudcast {
  key: string;
  url: string;
  name: string;
  audioLength: number | null;
}

/** Confirm the cloudcast exists (and read its length) before staff can review it. */
export async function lookupCloudcast(env: Env, key: string): Promise<Cloudcast> {
  if (!isMixcloudKey(key)) throw new ApiError(400, 'invalid_request', 'mixcloudKey must look like "/account/show-name/".');
  let res: Response;
  try {
    res = await fetch(`${apiBase(env)}${key}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError(502, 'mixcloud_unreachable', 'Mixcloud could not be reached.');
  }
  if (res.status === 404) throw new ApiError(422, 'mixcloud_not_found', `No Mixcloud upload at ${key}.`);
  if (!res.ok) throw new ApiError(502, 'mixcloud_error', `Mixcloud lookup failed (${res.status}).`);
  const body = await res.json<{ key?: string; url?: string; name?: string; audio_length?: number }>();
  return {
    key: body.key ?? key,
    url: body.url ?? `https://www.mixcloud.com${key}`,
    name: body.name ?? '',
    audioLength: Number.isInteger(body.audio_length) && body.audio_length! > 0 ? body.audio_length! : null,
  };
}

export function mixcloudLinks(env: Env, key: string) {
  const widget = new URL(env.MIXCLOUD_WIDGET_URL || 'https://player-widget.mixcloud.com/widget/iframe/');
  widget.searchParams.set('feed', key);
  widget.searchParams.set('hide_cover', '1');
  widget.searchParams.set('light', '1');
  return {
    key,
    url: `https://www.mixcloud.com${key}`,
    widgetUrl: widget.toString(),
  };
}

function apiBase(env: Env) {
  return (env.MIXCLOUD_API_BASE || 'https://api.mixcloud.com').replace(/\/$/, '');
}
