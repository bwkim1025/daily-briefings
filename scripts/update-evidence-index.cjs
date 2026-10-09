#!/usr/bin/env node
'use strict';

// Manual, local-only metadata index. This index is not evidence for a claim.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LIMITS = Object.freeze({ records: 200, documents: 200, days: 90, inputs: 100, fileBytes: 2 * 1024 * 1024, blockBytes: 12000 });
const TYPES = new Set(['research-design', 'event-bars', 'effect-ci', 'comparison-bars']);
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DAY_MS = 86400000;

function fail(message) { throw new Error(message); }
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function safeTree(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) fail(`Forbidden JSON key: ${key}`);
    safeTree(value[key]);
  }
}
function parseJSON(raw, label) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail(`${label}: invalid JSON`); }
  safeTree(parsed);
  return parsed;
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return NaN;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
}
function validDate(value) { return Number.isFinite(dateValue(value)); }
function textField(value, label, max = 2048) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label}: invalid text`);
  return value;
}
function exactKeys(value, keys, label) {
  if (!plainObject(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail(`${label}: invalid object fields`);
}
function sourceIdentity(rawUrl) {
  textField(rawUrl, 'source.url', 4096);
  if (/[\u0000-\u0020\u007f]/.test(rawUrl)) fail('source.url: whitespace and control characters are forbidden');
  let url;
  try { url = new URL(rawUrl); } catch { fail('source.url: invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('source.url: only credential-free HTTP/HTTPS URLs are allowed');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { fail('source.url: invalid URL encoding'); }
  const doi = pathname.match(/(?:^|\/)(10\.\d{4,9}\/[^\s?#]+)$/i);
  if (doi) return 'doi:' + doi[1].toLowerCase();
  url.hash = '';
  return 'url:' + url.href;
}
function localPath(value, label) {
  textField(value, label, 4096);
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes('\0')) fail(`${label}: a local filesystem path is required`);
  return path.resolve(value);
}
function readBuffer(file, label) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > LIMITS.fileBytes) fail(`${label}: must be a regular file at most ${LIMITS.fileBytes} bytes`);
  const raw = fs.readFileSync(file);
  if (raw.length > LIMITS.fileBytes) fail(`${label}: file is too large`);
  return raw;
}
function readBounded(file, label) { return readBuffer(file, label).toString('utf8'); }
function hashes(raw) {
  return {
    sourceHash: crypto.createHash('sha256').update(raw).digest('hex'),
    gitBlobSha: crypto.createHash('sha1').update(Buffer.from(`blob ${raw.length}\0`)).update(raw).digest('hex')
  };
}
function documentDate(markdown, label) {
  let fence = null;
  let heading;
  for (const line of markdown.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
    if (open) { fence = { char: open[1][0], length: open[1].length }; continue; }
    if (/^#\s+/.test(line)) { heading = line; break; }
  }
  const match = heading && heading.match(/^#\s+(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  if (!match || !validDate(match[1])) fail(`${label}: first level-one heading must begin with a valid YYYY-MM-DD date`);
  return match[1];
}

// Track all code fences so a literal visual example inside another fence is
// not accidentally ingested. No Markdown, HTML, or JSON is executed.
function visualBlocks(markdown, label) {
  const blocks = [];
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        if (fence.visual) blocks.push(fence.lines.join('\n'));
        fence = null;
      } else if (fence.visual) {
        fence.bytes += Buffer.byteLength(line, 'utf8') + (fence.lines.length ? 1 : 0);
        if (fence.bytes > LIMITS.blockBytes) fail(`${label}: visual block exceeds ${LIMITS.blockBytes} bytes`);
        fence.lines.push(line);
      }
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
    if (open) {
      const info = open[2].trim();
      fence = { char: open[1][0], length: open[1].length, visual: info === 'visual', lines: [], bytes: 0 };
    }
  }
  if (fence && fence.visual) fail(`${label}: unclosed visual fence`);
  return blocks;
}
function validateRecord(record, label) {
  exactKeys(record, ['identity', 'topic', 'title', 'asOf', 'source', 'document', 'type', 'kind'], label);
  textField(record.identity, `${label}.identity`, 8192);
  textField(record.topic, `${label}.topic`);
  textField(record.title, `${label}.title`);
  if (!['visual', 'historical'].includes(record.kind)) fail(`${label}.kind: invalid record kind`);
  if (record.kind === 'visual' && (!validDate(record.asOf) || !TYPES.has(record.type))) fail(`${label}: invalid visual date or type`);
  if (record.kind === 'historical' && (record.asOf !== null || record.type !== null)) fail(`${label}: historical pointers cannot assert visual type or evidence date`);
  exactKeys(record.source, ['label', 'url', 'locator'], `${label}.source`);
  textField(record.source.label, `${label}.source.label`);
  textField(record.source.locator, `${label}.source.locator`);
  if (sourceIdentity(record.source.url) !== record.identity) fail(`${label}: identity does not match source URL`);
  exactKeys(record.document, ['path', 'date'], `${label}.document`);
  textField(record.document.path, `${label}.document.path`, 4096);
  if (!validDate(record.document.date)) fail(`${label}.document.date: invalid date`);
  return record;
}
function recordKey(record) {
  return JSON.stringify([record.identity, record.topic.trim().normalize('NFC').toLowerCase()]);
}
function orderRecords(a, b) {
  // No locale or live-clock dependency; repeat runs produce identical bytes.
  const aa = [a.document.date, a.asOf || '', a.document.path, a.type || '', a.title, JSON.stringify(a)];
  const bb = [b.document.date, b.asOf || '', b.document.path, b.type || '', b.title, JSON.stringify(b)];
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return aa[i] < bb[i] ? 1 : -1;
  }
  return 0;
}
function extractRecords(markdown, documentPath, indexPath, validate) {
  const date = documentDate(markdown, documentPath);
  const relativePath = path.relative(path.dirname(indexPath), documentPath).split(path.sep).join('/');
  const records = visualBlocks(markdown, documentPath).map((raw, i) => {
    const label = `${documentPath}: visual ${i + 1}`;
    const visual = parseJSON(raw, label);
    const result = validate(visual);
    if (!result || result.ok !== true) fail(`${label}: schema validation failed${result && Array.isArray(result.errors) ? ': ' + result.errors.join('; ') : ''}`);
    const record = {
      identity: sourceIdentity(visual.source.url), topic: visual.topic, title: visual.title,
      asOf: visual.source.asOf,
      source: { label: visual.source.label, url: visual.source.url, locator: visual.source.locator },
      document: { path: relativePath, date }, type: visual.type, kind: 'visual'
    };
    return validateRecord(record, label);
  });
  const visualIdentities = new Set(records.map(record => record.identity));
  // Legacy pointers are explicitly unverified search hints, never schema-valid
  // figures. Only article headings and links outside fences are inspected.
  let heading = null, fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
    if (open) { fence = { char: open[1][0], length: open[1].length }; continue; }
    if (/^#{1,2}\s+/.test(line)) heading = null;
    const title = line.match(/^###\s+(.+?)\s*#*\s*$/);
    if (title) heading = title[1];
    if (!heading) continue;
    for (let url of line.match(/https?:\/\/[^\s<>"'\]`]+/g) || []) {
      url = url.replace(/[.,;]+$/, '');
      while (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
      const identity = sourceIdentity(url);
      if (visualIdentities.has(identity)) continue;
      records.push(validateRecord({
        identity, topic: heading.slice(0, 100), title: heading.slice(0, 500), asOf: null,
        source: { label: 'Historical article link (unverified pointer)', url, locator: '### ' + heading.slice(0, 1000) },
        document: { path: relativePath, date }, type: null, kind: 'historical'
      }, documentPath + ': historical pointer'));
    }
  }
  const unique = new Map();
  for (const record of records.sort(orderRecords)) if (!unique.has(recordKey(record))) unique.set(recordKey(record), record);
  return { date, records: [...unique.values()] };
}
function readIndex(indexPath) {
  if (!fs.existsSync(indexPath)) {
    // existsSync follows symlinks, including dangling links. lstat does not.
    try { fs.lstatSync(indexPath); fail('Index target must not be a symbolic link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return null;
  }
  if (fs.lstatSync(indexPath).isSymbolicLink()) fail('Index target must not be a symbolic link');
  const index = parseJSON(readBounded(indexPath, 'Existing index'), 'Existing index');
  exactKeys(index, ['version', 'referenceDate', 'coverage', 'documents', 'records'], 'Existing index');
  if (index.version !== 1 || !validDate(index.referenceDate) || !Array.isArray(index.records) || index.records.length > LIMITS.records || !Array.isArray(index.documents) || index.documents.length > LIMITS.documents) fail('Existing index: invalid version, date, or count');
  exactKeys(index.coverage, ['scope', 'archiveComplete', 'omittedRecords', 'omittedDocuments'], 'Existing index coverage');
  if (index.coverage.scope !== 'explicit-inputs-only' || index.coverage.archiveComplete !== false || !Number.isSafeInteger(index.coverage.omittedRecords) || index.coverage.omittedRecords < 0 || !Number.isSafeInteger(index.coverage.omittedDocuments) || index.coverage.omittedDocuments < 0) fail('Existing index: invalid coverage');
  const documents = new Map();
  for (const document of index.documents) {
    exactKeys(document, ['path', 'date', 'sourceHash', 'gitBlobSha', 'recordsComplete'], 'Existing indexed document');
    textField(document.path, 'Existing document.path', 4096);
    const age = dateValue(index.referenceDate) - dateValue(document.date);
    if (!validDate(document.date) || !/^[0-9a-f]{64}$/.test(document.sourceHash) || !/^[0-9a-f]{40}$/.test(document.gitBlobSha) || typeof document.recordsComplete !== 'boolean' || documents.has(document.path) || age < 0 || age >= LIMITS.days * DAY_MS) fail('Existing index: invalid document');
    documents.set(document.path, document);
  }
  const keys = new Set();
  for (const [i, record] of index.records.entries()) {
    validateRecord(record, `Existing index record ${i + 1}`);
    const key = recordKey(record);
    const age = dateValue(index.referenceDate) - dateValue(record.document.date);
    if (age < 0 || age >= LIMITS.days * DAY_MS || keys.has(key)) fail('Existing index: out-of-window or duplicate record');
    if (!documents.has(record.document.path) || documents.get(record.document.path).date !== record.document.date) fail('Existing index: record has no matching document manifest');
    keys.add(key);
  }
  return index;
}
function atomicWrite(indexPath, raw) {
  const directory = path.dirname(indexPath);
  if (!fs.statSync(directory).isDirectory()) fail('Index parent must be an existing directory');
  // A sibling temporary file is the only auxiliary write. No directories,
  // Markdown sources, remote paths, or other repository files are changed.
  const temporary = path.join(directory, '.' + path.basename(indexPath) + '.' + crypto.randomBytes(12).toString('hex') + '.tmp');
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, raw, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // Do not replace an unexpected symlink introduced while reading inputs.
    try { if (fs.lstatSync(indexPath).isSymbolicLink()) fail('Index target must not be a symbolic link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    fs.renameSync(temporary, indexPath);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function inputPaths(indexFile, markdownFiles) {
  if (!Array.isArray(markdownFiles) || markdownFiles.length < 1 || markdownFiles.length > LIMITS.inputs) fail(`Supply 1–${LIMITS.inputs} explicit Markdown files`);
  const indexPath = localPath(indexFile, 'Index path');
  if (path.extname(indexPath).toLowerCase() !== '.json') fail('Index path must end in .json');
  const inputs = [...new Set(markdownFiles.map(file => localPath(file, 'Markdown path')))];
  for (const file of inputs) if (path.extname(file).toLowerCase() !== '.md') fail('Input files must end in .md');
  return { indexPath, inputs };
}
function relativeDocument(indexPath, file) { return path.relative(path.dirname(indexPath), file).split(path.sep).join('/'); }
function checkIndex(indexFile, markdownFiles) {
  const { indexPath, inputs } = inputPaths(indexFile, markdownFiles);
  const existing = readIndex(indexPath);
  const results = inputs.map(file => {
    const relative = relativeDocument(indexPath, file);
    const indexed = existing && existing.documents.find(document => document.path === relative);
    if (!fs.existsSync(file)) return { path: relative, status: 'missing' };
    const digest = hashes(readBuffer(file, file));
    const status = !indexed ? 'unindexed' : indexed.sourceHash !== digest.sourceHash || indexed.gitBlobSha !== digest.gitBlobSha ? 'changed' : indexed.recordsComplete ? 'current' : 'current-partial';
    return { path: relative, status, ...digest };
  });
  return { indexPath, readOnly: true, archiveComplete: false, results };
}
function updateIndex(indexFile, markdownFiles) {
  const { indexPath, inputs } = inputPaths(indexFile, markdownFiles);
  const existing = readIndex(indexPath);
  const { validate } = require('../assets/content-visuals.js');
  if (typeof validate !== 'function') fail('Shared visual validator is unavailable');
  const documents = inputs.map(file => {
    const raw = readBuffer(file, file), digest = hashes(raw), relative = relativeDocument(indexPath, file);
    const previous = existing && existing.documents.find(document => document.path === relative);
    if (previous && previous.recordsComplete && previous.sourceHash === digest.sourceHash && previous.gitBlobSha === digest.gitBlobSha) {
      return { manifest: previous, date: previous.date, records: existing.records.filter(record => record.document.path === relative), reused: true };
    }
    const extracted = extractRecords(raw.toString('utf8'), file, indexPath, validate);
    return { ...extracted, manifest: { path: relative, date: extracted.date, ...digest, recordsComplete: true }, reused: false };
  });
  const dates = documents.map(document => document.date);
  if (existing) dates.push(existing.referenceDate);
  const referenceDate = dates.sort().at(-1);
  const referenceMs = dateValue(referenceDate);
  // Re-supplying a document replaces all of its previous index records, so a
  // removed or corrected figure cannot leave a stale match behind.
  const replacedPaths = new Set(inputs.map(file => relativeDocument(indexPath, file)));
  const inWindow = document => referenceMs - dateValue(document.date) >= 0 && referenceMs - dateValue(document.date) < LIMITS.days * DAY_MS;
  const manifestCandidates = [
    ...(existing ? existing.documents.filter(document => !replacedPaths.has(document.path)) : []),
    ...documents.map(document => document.manifest)
  ].filter(inWindow).sort((a, b) => a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const manifest = manifestCandidates.slice(0, LIMITS.documents).map(document => ({ ...document }));
  const manifestPaths = new Set(manifest.map(document => document.path));
  const candidates = [
    ...(existing ? existing.records.filter(record => !replacedPaths.has(record.document.path)) : []),
    ...documents.flatMap(document => document.records)
  ].filter(record => inWindow(record.document)).sort(orderRecords);
  const seen = new Set();
  const records = candidates.filter(record => {
    const key = recordKey(record);
    if (seen.has(key) || !manifestPaths.has(record.document.path)) return false;
    seen.add(key);
    return true;
  }).slice(0, LIMITS.records);
  const retained = new Set(records.map(record => JSON.stringify([record.document.path, recordKey(record)])));
  for (const document of manifest) {
    if (candidates.some(record => record.document.path === document.path && !retained.has(JSON.stringify([record.document.path, recordKey(record)])))) document.recordsComplete = false;
  }
  const coverage = { scope: 'explicit-inputs-only', archiveComplete: false, omittedRecords: candidates.length - records.length, omittedDocuments: manifestCandidates.length - manifest.length };
  const index = { version: 1, referenceDate, coverage, documents: manifest, records };
  const raw = JSON.stringify(index, null, 2) + '\n';
  if (Buffer.byteLength(raw) > LIMITS.fileBytes) fail('Result exceeds index file size limit');
  const unchanged = fs.existsSync(indexPath) && fs.readFileSync(indexPath, 'utf8') === raw;
  if (!unchanged) atomicWrite(indexPath, raw);
  return { indexPath, records: records.length, referenceDate, changed: !unchanged, reusedDocuments: documents.filter(document => document.reused).length, coverage };
}

module.exports = { LIMITS, validDate, sourceIdentity, visualBlocks, extractRecords, hashes, updateIndex, checkIndex };
if (require.main === module) {
  const args = process.argv.slice(2);
  const check = args[0] === '--check';
  if (check) args.shift();
  if (args.length < 2 || args[0] === '--help') {
    console.error('Usage: node scripts/update-evidence-index.cjs [--check] INDEX.json NEW.md [NEW.md ...]\nManual metadata only; no network or source verification. --check never writes. Dates come from # YYYY-MM-DD headings. Coverage is always partial.');
    process.exitCode = args[0] === '--help' ? 0 : 1;
  } else {
    try {
      const result = check ? checkIndex(args[0], args.slice(1)) : updateIndex(args[0], args.slice(1));
      if (check) {
        console.log(JSON.stringify(result, null, 2));
        if (result.results.some(item => item.status !== 'current')) process.exitCode = 2;
      } else {
        console.log(`${result.changed ? 'Updated' : 'Unchanged'} ${result.indexPath}: ${result.records} records; reference date ${result.referenceDate}; ${result.reusedDocuments} unchanged documents reused. Partial search coverage only.`);
      }
    } catch (error) {
      console.error(`Evidence index not written: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
