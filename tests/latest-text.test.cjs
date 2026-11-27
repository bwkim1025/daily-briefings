'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const { indexCats, latestOrder, collect, buildLatestText } = require('../scripts/update-briefing-index.cjs');
const ORDER = ['financial', 'tech', 'health', 'realestate', 'weather', 'international', 'sports', 'parenting', 'medical'];

test('latest.txt concatenates each category\'s newest issue in reading order', () => {
  assert.deepEqual(latestOrder, ORDER);
  assert.equal(latestOrder[4], 'weather');
  assert.equal(latestOrder.at(-1), 'medical');
  assert.deepEqual(indexCats, ['financial', 'international', 'medical', 'health', 'sports', 'tech', 'weather', 'realestate', 'parenting']);
  const categories = collect();
  const text = fs.readFileSync(path.join(root, 'assets', 'latest.txt'), 'utf8');
  assert.equal(text, buildLatestText(categories));
  let cursor = 0;
  for (const cat of ORDER) {
    const date = categories[cat][0];
    const marker = '======== ' + cat + ' ' + date + ' ' + date + '.md ========';
    const at = text.indexOf(marker, cursor);
    assert.ok(at >= cursor, marker);
    const body = fs.readFileSync(path.join(root, cat, 'briefings', date + '.md'), 'utf8');
    assert.equal(text.slice(at + marker.length + 1, at + marker.length + 1 + body.length), body.endsWith('\n') ? body : body + '\n');
    cursor = at + marker.length;
  }
});

test('noscript guidance links to latest.txt', () => {
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /<noscript>[\s\S]*<a href="assets\/latest\.txt">latest\.txt<\/a>/);
  for (const cat of ORDER) {
    const html = fs.readFileSync(path.join(root, cat, 'index.html'), 'utf8');
    assert.match(html, /<noscript>[\s\S]*<a href="\.\.\/assets\/latest\.txt">latest\.txt<\/a>/);
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/update-briefing-index.yml'), 'utf8');
  assert.match(workflow, /git add assets\/briefing-index\.json assets\/latest\.txt/);
  assert.equal((workflow.match(/git add assets\/briefing-index\.json assets\/latest\.txt/g) || []).length, 2);
});
