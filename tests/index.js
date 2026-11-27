'use strict';
// `node --test tests/` passes this directory as one entry. Load every test file in it.
const fs = require('node:fs');
const path = require('node:path');
for (const name of fs.readdirSync(__dirname).sort()) {
  if (name.endsWith('.test.cjs')) require(path.join(__dirname, name));
}
