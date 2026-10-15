import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// The demo Archive tab has made-up recordings and borrowed album covers. It is for showing the station board, on a
// build made by hand. It must never ride along in a build that goes to testers or the stores.
test('eas.json: no profile turns on demo mode', () => {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };
  for (const [profile, cfg] of Object.entries(eas.build)) {
    assert.equal(
      Object.keys(cfg.env ?? {}).some((k) => k.includes('DEMO')),
      false,
      `eas.json build profile "${profile}" sets a DEMO variable`,
    );
  }
});
