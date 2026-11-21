'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const home = 'https://news.example/daily-briefings/';

test('old archive bookmarks retain dates and undated bookmarks open the calendar', () => {
  const html = fs.readFileSync(path.join(root, 'archive.html'), 'utf8');
  const [, script] = html.match(/<script>([\s\S]*?)<\/script>/);
  for (const [suffix, expected] of [
    ['', '#archive'],
    ['#2020-06-08', '?date=2020-06-08'],
    ['?date=2020-06-07', '?date=2020-06-07'],
    ['#unknown', '#archive'],
  ]) {
    const url = new URL('archive.html' + suffix, home);
    let destination;
    const location = { href: url.href, hash: url.hash, replace(value) { destination = value; } };
    vm.runInNewContext(script, { URL, location });
    assert.equal(destination, home + expected);
  }
});

test('the audio panel follows the issue shown on the home page and survives a malformed fragment', () => {
  // v3(골라 듣기) 재생 칸: 주소에 ?date=가 없어도 화면에 보이는 호(#main의 날짜)를 쓴다.
  const source = fs.readFileSync(path.join(root, 'assets/podcast-listen.js'), 'utf8');
  const reader = source.slice(source.indexOf('function dateFromPage()'), source.indexOf('function label('));
  const read = (shown, search = '') => vm.runInNewContext(reader + '; dateFromPage()', {
    URLSearchParams, location: { search },
    document: { title: '땡이네 뉴스', querySelector: () => ({ dataset: { briefingDate: shown } }), getElementById: () => null },
  });
  assert.equal(read('2020-06-08'), '2020-06-08');
  assert.equal(read('', '?date=2020-06-07'), '2020-06-07');
  assert.equal(read(''), null);
  assert.match(source, /document\.addEventListener\('briefing-date-change', run\)/);
  const helper = source.slice(source.indexOf('const hashId ='), source.indexOf('const esc ='));
  assert.equal(vm.runInNewContext(helper + '; hashId()', { location: { hash: '#%' } }), '');
  assert.equal((source.match(/decodeURIComponent\(/g) || []).length, 1);
  const app = fs.readFileSync(path.join(root, 'assets/briefings.js'), 'utf8');
  assert.match(app, /main\.dataset\.briefingDate=date\|\|''/);
});
