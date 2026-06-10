// Rebrand a single locale's messages.json: Signal -> B&A.
//
// Behavior:
//   - Only mutates the `messageformat` string of each entry.
//   - Keys ("icu:...") are left untouched.
//   - Replacements (order matters):
//       support@signal.org      -> support@baxs.com
//       signal.org/download     -> ba-chat.com/download
//       Signal Technology Foundation -> B&A Technology Foundation
//       Signal                  -> B&A   (case-sensitive)
//       signal                  -> B&A   (lowercase, e.g. "signal.group" host segment)
//   - Preserves ICU placeholders ({var}, {n, plural, ...}, <tag>...</tag>),
//     since we never touch their syntax markers.
//
// Usage (PowerShell):
//   node scripts/rebrand-locale.mjs _locales/af-ZA/messages.json
//   node scripts/rebrand-locale.mjs _locales/af-ZA/messages.json --dry
//
// Defaults to _locales/af-ZA/messages.json when no path is provided.

import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const dry = args.includes('--dry');
const target =
  args.find(a => !a.startsWith('--')) ?? '_locales/af-ZA/messages.json';

// Order matters: most specific patterns first so they aren't shadowed by the
// generic /Signal/ -> /B&A/ rule below.
const REPLACEMENTS = [
  [/support@signal\.org/g, 'support@baxs.com'],
  [/signal\.org\/download/g, 'ba-chat.com/download'],
  [/Signal Technology Foundation/g, 'B&A Technology Foundation'],
  [/Signal/g, 'B&A'],
  [/signal/g, 'B&A'],
];

const raw = readFileSync(target, 'utf8');
// Detect line ending so we can write back in the same style.
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const data = JSON.parse(raw);

let entries = 0;
let touched = 0;
const perRule = new Map(REPLACEMENTS.map(([re]) => [re.source, 0]));

for (const [, entry] of Object.entries(data)) {
  if (!entry || typeof entry.messageformat !== 'string') continue;
  entries += 1;
  const before = entry.messageformat;
  let after = before;
  for (const [re, to] of REPLACEMENTS) {
    const m = after.match(re);
    if (m) perRule.set(re.source, perRule.get(re.source) + m.length);
    after = after.replace(re, to);
  }
  if (after !== before) {
    touched += 1;
    entry.messageformat = after;
  }
}

const out = JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol;

if (!dry) {
  writeFileSync(target, out);
}

console.log(`file:    ${target}`);
console.log(`entries: ${entries}`);
console.log(`changed: ${touched}`);
console.log('replacements applied:');
for (const [src, n] of perRule) {
  console.log(`  /${src}/g -> ${n}`);
}
if (dry) console.log('(dry run; file not written)');

exit(0);
