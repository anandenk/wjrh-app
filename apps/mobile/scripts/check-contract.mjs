// Checks that the offline fixtures in src/api/fixtures still match backend/schemas.
// Run: npm run check:contract
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(here, '../../../backend/schemas');
const fixtureDir = join(here, '../src/api/fixtures');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const pairs = {
  health: 'health',
  'now-playing': 'now-playing',
  recent: 'recent',
  'schedule-weekly': 'schedule-weekly',
  schedule: 'schedule',
  shows: 'shows',
  archives: 'archives-index',
  'show-archives': 'show-archives',
  station: 'station',
};

const ajv = new Ajv({ strict: false, allErrors: true });
let failed = 0;
for (const [fixture, schema] of Object.entries(pairs)) {
  const validate = ajv.compile(read(join(schemaDir, `${schema}.schema.json`)));
  const ok = validate(read(join(fixtureDir, `${fixture}.json`)));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${fixture}.json vs ${schema}.schema.json`);
  if (!ok) {
    failed++;
    console.log(ajv.errorsText(validate.errors, { separator: '\n  ' }));
  }
}
process.exit(failed ? 1 : 0);
