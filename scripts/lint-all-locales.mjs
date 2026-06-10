// Validate ICU messageformat syntax for every locale under _locales/.
// The repo's official linter (build/intl-linter/linter.ts) only checks en.
// After a bulk rebrand we want to confirm we didn't break placeholders or
// rich-text tags in the other 67 locales. This script reuses the same
// `@formatjs/icu-messageformat-parser` parser and just walks every locale.
//
// Usage:
//   node scripts/lint-all-locales.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';
import { parse as parseIcuMessage } from '@formatjs/icu-messageformat-parser';

const LOCALES_DIR = '_locales';

const locales = readdirSync(LOCALES_DIR)
  .filter(name => {
    try {
      return statSync(join(LOCALES_DIR, name)).isDirectory();
    } catch {
      return false;
    }
  })
  .sort();

let totalErrors = 0;
let totalEntries = 0;

for (const locale of locales) {
  const file = join(LOCALES_DIR, locale, 'messages.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf-8');
  } catch {
    console.warn(`[skip] ${locale}: no messages.json`);
    continue;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[FAIL] ${locale}: JSON parse error: ${err.message}`);
    totalErrors += 1;
    continue;
  }

  let entries = 0;
  let errors = 0;

  for (const [key, entry] of Object.entries(data)) {
    if (key === 'smartling') continue;
    if (!entry || typeof entry.messageformat !== 'string') continue;
    entries += 1;
    try {
      parseIcuMessage(entry.messageformat, {
        captureLocation: true,
        shouldParseSkeletons: true,
        requiresOtherClause: true,
      });
    } catch (err) {
      errors += 1;
      console.error(
        `[FAIL] ${locale} :: ${key}\n` +
          `       ${entry.messageformat}\n` +
          `       => ${err.message}`
      );
    }
  }

  totalEntries += entries;
  totalErrors += errors;

  const status = errors === 0 ? 'OK ' : 'ERR';
  console.log(
    `[${status}] ${locale.padEnd(8)}  entries=${String(entries).padStart(4)}  errors=${errors}`
  );
}

console.log('');
console.log(`Locales scanned: ${locales.length}`);
console.log(`Total entries:   ${totalEntries}`);
console.log(`Total errors:    ${totalErrors}`);

exit(totalErrors === 0 ? 0 : 1);
