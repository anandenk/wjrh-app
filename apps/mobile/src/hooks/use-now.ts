import { useEffect, useState } from 'react';

import { DEV_NOW } from '@/config';

const clock = () => (DEV_NOW ? new Date(DEV_NOW) : new Date());

/** The current time, refreshed every `intervalMs` (for "on air now" highlighting). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const id = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
