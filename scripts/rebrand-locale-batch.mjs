// Batch-run rebrand-locale.mjs over every locale under _locales/, except a
// configurable skip list (e.g. zh-CN). Aggregates per-locale stats into a
// Markdown report at the path given on the CLI.
//
// Usage (PowerShell):
//   node scripts/rebrand-locale-batch.mjs scripts/rebrand-report.md
//   node scripts/rebrand-locale-batch.mjs scripts/rebrand-report.md --dry
//
// The Markdown report includes:
//   - Per-locale: entries scanned, entries changed, hits per rule.
//   - Totals across all processed locales.
//   - A list of skipped locales.
//   - A residual-Signal scan (counts of `Signal`/`signal` left inside any
//     `messageformat` after replacement; should be 0 everywhere).

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const args = argv.slice(2);
const dry = args.includes('--dry');
const reportPath =
  args.find(a => !a.startsWith('--')) ?? 'scripts/rebrand-report.md';

const SKIP = new Set(['zh-CN']);
const LOCALES_DIR = '_locales';

// Same rules as scripts/rebrand-locale.mjs. Kept in sync by hand for now.
const REPLACEMENTS = [
  [/support@signal\.org/g, 'support@baxs.com'],
  [/signal\.org\/download/g, 'ba-chat.com/download'],
  [/Signal Technology Foundation/g, 'B&A Technology Foundation'],
  [/Signal/g, 'B&A'],
  [/signal/g, 'B&A'],
];

function listLocales() {
  return readdirSync(LOCALES_DIR)
    .filter(name => {
      const p = join(LOCALES_DIR, name);
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function rebrand(target) {
  const raw = readFileSync(target, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const data = JSON.parse(raw);

  let entries = 0;
  let touched = 0;
  const perRule = REPLACEMENTS.map(() => 0);

  for (const [, entry] of Object.entries(data)) {
    if (!entry || typeof entry.messageformat !== 'string') continue;
    entries += 1;
    const before = entry.messageformat;
    let after = before;
    REPLACEMENTS.forEach(([re, to], i) => {
      const m = after.match(re);
      if (m) perRule[i] += m.length;
      after = after.replace(re, to);
    });
    if (after !== before) {
      touched += 1;
      entry.messageformat = after;
    }
  }

  // Residual scan: any Signal/signal left in any messageformat?
  let residual = 0;
  for (const [, entry] of Object.entries(data)) {
    if (!entry || typeof entry.messageformat !== 'string') continue;
    const m = entry.messageformat.match(/[Ss]ignal/g);
    if (m) residual += m.length;
  }

  const out = JSON.stringify(data, null, 2).replace(/\n/g, eol) + eol;
  if (!dry) writeFileSync(target, out);

  return { entries, touched, perRule, residual };
}

const all = listLocales();
const processed = [];
const skipped = [];

for (const locale of all) {
  if (SKIP.has(locale)) {
    skipped.push(locale);
    continue;
  }
  const file = join(LOCALES_DIR, locale, 'messages.json');
  try {
    statSync(file);
  } catch {
    skipped.push(`${locale} (no messages.json)`);
    continue;
  }
  const stats = rebrand(file);
  processed.push({ locale, file, ...stats });
  console.log(
    `${locale.padEnd(8)}  entries=${String(stats.entries).padStart(4)}  ` +
      `changed=${String(stats.touched).padStart(4)}  ` +
      `rules=[${stats.perRule.join(',')}]  residual=${stats.residual}`
  );
}

// Build markdown report.
const totals = processed.reduce(
  (acc, p) => {
    acc.entries += p.entries;
    acc.touched += p.touched;
    acc.residual += p.residual;
    p.perRule.forEach((n, i) => {
      acc.perRule[i] += n;
    });
    return acc;
  },
  { entries: 0, touched: 0, residual: 0, perRule: REPLACEMENTS.map(() => 0) }
);

const ruleLabels = REPLACEMENTS.map(([re, to]) => `\`${re.source}\` → \`${to}\``);

const lines = [];
lines.push(`# Rebrand report — Signal → B&A`);
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Mode: ${dry ? '**dry run** (no files written)' : 'applied'}`);
lines.push(`Skipped locales: ${skipped.length ? skipped.join(', ') : '(none)'}`);
lines.push('');
lines.push('## Replacement rules');
lines.push('');
ruleLabels.forEach((l, i) => lines.push(`${i + 1}. ${l}`));
lines.push('');
lines.push('Rules are applied in order, per `messageformat` string. Keys are never modified.');
lines.push('');
lines.push('## Totals');
lines.push('');
lines.push(`- Locales processed: **${processed.length}**`);
lines.push(`- Total entries scanned: **${totals.entries}**`);
lines.push(`- Total entries changed: **${totals.touched}**`);
lines.push(`- Residual \`Signal\`/\`signal\` in any messageformat: **${totals.residual}** (expected 0)`);
lines.push('');
lines.push('| Rule | Hits |');
lines.push('|---|---:|');
ruleLabels.forEach((l, i) => lines.push(`| ${l} | ${totals.perRule[i]} |`));
lines.push('');
lines.push('## Per-locale stats');
lines.push('');
lines.push('| Locale | Entries | Changed | r1 | r2 | r3 | r4 | r5 | Residual |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const p of processed) {
  lines.push(
    `| ${p.locale} | ${p.entries} | ${p.touched} | ` +
      `${p.perRule.join(' | ')} | ${p.residual} |`
  );
}
lines.push('');
lines.push('Rule legend: r1 = `support@signal.org`, r2 = `signal.org/download`, ' +
  'r3 = `Signal Technology Foundation`, r4 = `Signal`, r5 = `signal`.');
lines.push('');

writeFileSync(reportPath, lines.join('\n'));
console.log(`\nReport written to: ${reportPath}`);
console.log(`Processed: ${processed.length}, Skipped: ${skipped.length}`);
console.log(`Total residuals: ${totals.residual}`);

exit(totals.residual === 0 ? 0 : 1);
