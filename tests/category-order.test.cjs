'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const ORDER = ['financial', 'tech', 'health', 'realestate', 'weather', 'international', 'sports', 'parenting', 'medical'];
const LISTED_ORDER = ORDER.filter(key => key !== 'medical');
const STORY_ORDER = LISTED_ORDER.filter(key => key !== 'weather');

const VALUES = {
  financial: {name:'파이낸셜 브리핑', short:'파이낸셜', en:'Financial', subtitle:'시장과 숫자, 그 뒤에 있는 맥락.', icon:'chart', art:'fin'},
  tech: {name:'테크·AI 브리핑', short:'테크·AI', en:'Tech · AI', subtitle:'꼭 알아야 할 기술과 AI 소식.', icon:'chart', art:'tech'},
  health: {name:'헬스 브리핑', short:'헬스', en:'Health', subtitle:'일상에 닿는 건강 연구와 생활의 발견.', icon:'heart', art:'health'},
  realestate: {name:'부동산·이사 브리핑', short:'부동산', en:'Real estate', subtitle:'부산·김해·양산 집값과 남천 분양·입주 소식.', icon:'chart', art:'home'},
  weather: {name:'웨더 · 부산', short:'웨더', en:'Weather', subtitle:'부산의 기온·비·바람·미세먼지.', icon:'chart', art:'weather'},
  international: {name:'인터내셔널 브리핑', short:'인터내셔널', en:'International', subtitle:'세계를 읽는 네 개의 시선.', icon:'globe', art:'globe'},
  sports: {name:'스포츠 브리핑', short:'스포츠', en:'Sports', subtitle:'NBA를 중심으로, 꼭 볼 경기와 흐름.', icon:'chart', art:'sport'},
  parenting: {name:'육아·교육 브리핑', short:'육아·교육', en:'Parenting', subtitle:'초등 입학 준비와 영유아·아동 정책.', icon:'chart', art:'family'},
  medical: {name:'메디컬 브리핑', short:'메디컬', en:'Medical', subtitle:'연구의 결과와 한계를 함께 읽습니다.', icon:'cross', art:'', hidden:true},
};

function appSource() {
  return fs.readFileSync(path.join(root, 'assets/briefings.js'), 'utf8');
}

function configFrom(source) {
  const start = source.indexOf('const config={');
  const end = source.indexOf('\n  };', start);
  assert.ok(start >= 0 && end > start, 'config object not found');
  const literal = source.slice(start + 'const config='.length, end + '\n  };'.length - 1);
  return vm.runInNewContext('(' + literal + ')');
}

function between(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return source.slice(start, end);
}

test('config keys follow the reading order and medical stays hidden', () => {
  const config = JSON.parse(JSON.stringify(configFrom(appSource())));
  assert.deepEqual(Object.keys(config), ORDER);
  assert.deepEqual(config, VALUES);
  assert.equal(config.medical.hidden, true);
  for (const key of LISTED_ORDER) assert.equal(Object.hasOwn(config[key], 'hidden'), false);
});

test('home cards follow the listed order, with weather fifth', () => {
  const source = appSource();
  const config = configFrom(source);
  const LISTED = Object.keys(config).filter(key => !config[key].hidden);
  const STORIES = LISTED.filter(key => key !== 'weather');
  const line = source.split('\n').find(item => item.includes('const homeCards='));
  assert.ok(line, 'homeCards not found');
  const cards = vm.runInNewContext(line.trim() + '\nhomeCards()', {LISTED, STORIES});
  assert.deepEqual(cards, LISTED_ORDER);
  assert.equal(cards[4], 'weather');
  assert.deepEqual(STORIES, STORY_ORDER);
  assert.deepEqual(LISTED, LISTED_ORDER);
});

test('rounds follows LISTED and keeps the weather pc-only class', () => {
  const rounds = between(appSource(), 'function rounds()', 'function tabbar()');
  assert.match(rounds, /\+LISTED\.map\(key=>/);
  assert.doesNotMatch(rounds, /STORIES\.concat|LISTED\.includes\('weather'\)/);
  assert.match(rounds, /key==='weather'\?' class="pc-only"'/);
});

test('nav, sheet, flow, and schedule follow config order', () => {
  const source = appSource();
  assert.match(between(source, 'function navigation()', 'function rounds()'), /LISTED\.map\(key=>/);
  assert.match(between(source, 'function sheetLinks()', 'function refreshNav()'), /LISTED\.map\(key=>/);
  assert.match(between(source, 'function flow(', 'function balance('), /STORIES\.map\(cat=>/);
  assert.match(between(source, 'function schedules(', 'function syncHomeDates('), /STORIES\.map\(cat=>/);
  assert.match(source, /let LISTED=Object\.keys\(config\)\.filter\(key=>!config\[key\]\.hidden\), STORIES=LISTED\.filter\(key=>key!=='weather'\);/);
  assert.match(source, /LISTED=Object\.keys\(config\)\.filter\(key=>!config\[key\]\.hidden&&!PENDING\.has\(key\)\);STORIES=LISTED\.filter\(key=>key!=='weather'\);/);
});

test('the home meta description lists categories in the same order', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /content="땡이네 뉴스 — 파이낸셜·테크·AI·헬스·부동산·웨더·인터내셔널·스포츠·육아·교육 브리핑\./);
});

test('briefings.js cache query and the service worker cache version moved forward', () => {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'tests') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|js|cjs|yml|json|md)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const versions = text.match(/briefings\.js\?v=\d+/g);
    if (versions) hits.push(path.relative(root, file) + '\n' + versions.join(','));
    assert.equal(text.includes('briefings.js?v=33'), false, path.relative(root, file));
  }
  assert.ok(hits.length >= 10, 'expected a briefings.js query in the shells and sw.js');
  for (const hit of hits) assert.match(hit, /briefings\.js\?v=34/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE_VERSION = CACHE_PREFIX \+ 'v39';/);
  assert.equal((sw.match(/briefings\.js\?v=34/g) || []).length, 2);
});
