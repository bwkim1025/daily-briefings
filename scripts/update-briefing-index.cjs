#!/usr/bin/env node
'use strict';
// Rebuilds assets/briefing-index.json (the calendar/latest-date hint list) from the briefing files on disk.
// Also writes assets/latest.txt: the latest issue's Markdown for each category, in reading order,
// so the text can be reviewed without JavaScript.
// Run after adding briefing files:  node scripts/update-briefing-index.cjs
const fs = require('node:fs'), path = require('node:path'), { execSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
// Index key order stays as published. latest.txt follows the home reading order (medical included).
const indexCats = ['financial', 'international', 'medical', 'health', 'sports', 'tech', 'weather', 'realestate', 'parenting'];
const latestOrder = ['financial', 'tech', 'health', 'realestate', 'weather', 'international', 'sports', 'parenting', 'medical'];

function collect(cats = indexCats) {
  const categories = {};
  for (const cat of cats) {
    const dir = path.join(root, cat, 'briefings');
    const dates = new Set((fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(n => (n.match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z]+)?\.md$/) || [])[1]).filter(Boolean));
    categories[cat] = [...dates].sort().reverse();
  }
  return categories;
}

function issueFiles(cat, date) {
  const dir = path.join(root, cat, 'briefings');
  if (!date || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => new RegExp('^' + date + '(?:-[a-z]+)?\\.md$').test(name))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function buildLatestText(categories = collect()) {
  const parts = [];
  for (const cat of latestOrder) {
    const date = (categories[cat] || [])[0] || '';
    const files = issueFiles(cat, date);
    if (!files.length) {
      parts.push('======== ' + cat + ' (없음) ========\n');
      continue;
    }
    for (const name of files) {
      const body = fs.readFileSync(path.join(root, cat, 'briefings', name), 'utf8');
      parts.push('======== ' + cat + ' ' + date + ' ' + name + ' ========\n' + (body.endsWith('\n') ? body : body + '\n'));
    }
  }
  return parts.join('\n');
}

function main() {
  const categories = collect();
  let sha = ''; try { sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch {}
  const updated = indexCats.map(c => categories[c][0] || '').sort().reverse()[0] || '';
  fs.writeFileSync(path.join(root, 'assets', 'briefing-index.json'), JSON.stringify({ generatedFrom: sha, updated, categories }, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'assets', 'latest.txt'), buildLatestText(categories));
  console.log('briefing-index.json updated:', updated, indexCats.map(c => c + '=' + categories[c].length).join(' '));
  console.log('latest.txt updated:', latestOrder.map(c => c + '=' + ((categories[c] || [])[0] || '-')).join(' '));
}

if (require.main === module) main();
module.exports = { indexCats, latestOrder, collect, buildLatestText };
