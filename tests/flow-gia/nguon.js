'use strict';
// FLOW_TEST_NGUON=tests/flow-gia/nguon.js — thay engine + trình đổi chế độ bằng bản giả.
const fs = require('fs');
const path = require('path');
const doc = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
module.exports = { engine: doc('engine-gia.js'), mode: doc('mode-gia.js') };
