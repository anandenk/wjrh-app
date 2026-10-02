import { useCallback, useEffect, useState } from 'react';

import { getReminderShowIds, setReminder, type ReminderResult } from './notifications';

/** Whether a show has a reminder, and a way to switch it. */
export function useReminder(showId: string) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReminderResult | null>(null);

  useEffect(() => {
    let alive = true;
    getReminderShowIds()
      .then((ids) => alive && setEnabled(ids.has(showId)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [showId]);

  const toggle = useCallback(async () => {
    setBusy(true);
    setResult(null);
    const next = !enabled;
    const r = await setReminder(showId, next);
    if (r === 'ok') setEnabled(next);
    setResult(r);
    setBusy(false);
  }, [enabled, showId]);

  return { enabled, busy, result, toggle };
}
