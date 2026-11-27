'use strict';
// Đóng gói các mẫu motion graphic (src/motion/src, JSX) thành trang tĩnh src/motion/bundle bằng @remotion/bundler.
// App chỉ cần @remotion/renderer lúc chạy (không cần webpack). Sửa mẫu xong chạy lại:  node tools/dong-goi-motion.js
// Bài kiểm (tests/run.js) so dấu vân của nguồn với src/motion/bundle/nguon.json — quên đóng gói lại là đỏ.
const path = require('path');
const fs = require('fs');
const { dauNguonMotion } = require('../src/main/motion');

(async () => {
  const { bundle } = require('@remotion/bundler');
  const goc = path.join(__dirname, '..', 'src', 'motion');
  const ra = path.join(goc, 'bundle');
  // --neu-cu (CHAY_TU_NGUON.bat): mẫu không đổi từ lần đóng gói trước thì thôi
  if (process.argv.includes('--neu-cu')) {
    try { if (JSON.parse(fs.readFileSync(path.join(ra, 'nguon.json'), 'utf8')).dau === dauNguonMotion(goc)) { console.log('Mẫu motion đã đóng gói, không đổi'); return; } } catch (_) {}
  }
  fs.rmSync(ra, { recursive: true, force: true });
  await bundle({ entryPoint: path.join(goc, 'src', 'index.js'), publicDir: path.join(goc, 'public'), outDir: ra, onProgress: () => {} });
  // giữ bundle.js.map (@remotion/renderer đọc nó để báo lỗi của mẫu đúng dòng); bỏ sourcemap của các mảnh Studio cho nhẹ bộ cài
  for (const f of fs.readdirSync(ra)) if (f.endsWith('.map') && f !== 'bundle.js.map') fs.rmSync(path.join(ra, f));
  fs.writeFileSync(path.join(ra, 'nguon.json'), JSON.stringify({ dau: dauNguonMotion(goc) }, null, 2) + '\n');
  console.log('Đã đóng gói mẫu motion vào', ra);
})().catch((e) => { console.error(e); process.exit(1); });
