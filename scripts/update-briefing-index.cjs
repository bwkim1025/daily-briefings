#!/usr/bin/env node
'use strict';
// Rebuilds assets/briefing-index.json (the calendar/latest-date hint list) from the briefing files on disk.
// Run after adding briefing files:  node scripts/update-briefing-index.cjs
const fs = require('node:fs'), path = require('node:path'), { execSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), cats = ['financial', 'international', 'medical', 'health'];
const categories = {};
for (const cat of cats) {
  const dir = path.join(root, cat, 'briefings');
  const dates = new Set((fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(n => (n.match(/^(\d{4}-\d{2}-\d{2})(?:-[a-z]+)?\.md$/) || [])[1]).filter(Boolean));
  categories[cat] = [...dates].sort().reverse();
}
let sha = ''; try { sha = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch {}
const updated = cats.map(c => categories[c][0] || '').sort().reverse()[0] || '';
fs.writeFileSync(path.join(root, 'assets', 'briefing-index.json'), JSON.stringify({ generatedFrom: sha, updated, categories }, null, 2) + '\n');
console.log('briefing-index.json updated:', updated, cats.map(c => c + '=' + categories[c].length).join(' '));
