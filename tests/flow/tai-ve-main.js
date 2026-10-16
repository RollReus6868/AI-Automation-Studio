// ============================================================================
//  tai-ve-main.js — MENU TẢI XUỐNG CỦA FLOW MỚI: 1080p / 4K BỊ KHOÁ → TỰ HẠ 720p (1.2.3)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/tai-ve-main.js
//
//  Nhật ký người dùng 16/10/2026: video tạo xong nhưng "Chờ 120s mà Google chưa xuất file" ×3. Ảnh chụp menu
//  ⋯ → Tải xuống: 270p · 720p (Kích thước gốc) · 1080p / 4K mờ kèm nút "Nâng cấp". Engine thấy chữ "1080p"
//  là bấm — mục khoá, bấm không ra gì.
//
//  Bài mở menu thẻ trên tests/fixture-flow-moi.html y như engine (chuột phải → mục Tải xuống → phím mũi tên),
//  lấy mục bằng getOpenMenuItems() THẬT của engine và chạy NGUYÊN ĐOẠN "PHASE 4: CHỌN CHẤT LƯỢNG" cắt từ
//  flow-engine.js, với hai kiểu khoá (nút "Nâng cấp" cạnh mục / aria-disabled) và tài khoản không khoá.
//  Thêm: tệp chẩn đoán chụp được trên trang bật Trusted Types (nhật ký: "Script failed to execute").
// ============================================================================
const { app, BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');

const INJ = path.join(__dirname, '..', '..', 'src', 'flow', 'inject');
const doc = (f) => fs.readFileSync(path.join(INJ, f), 'utf8');
const loi = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const KHONG_AN = process.argv.includes('--khong-an');   // phá thử: không tiêm flow-tai-ve.js

const CAU_NOI = `window.__flowBridge = {
  send: async (m) => {
    if (m.action === 'LOG') (window.__nk = window.__nk || []).push((m.type || '') + ' ' + (m.message || ''));
    return { ok: true, success: true };
  },
  storage: async () => ({}),
  onDispatch: () => {}
}; undefined;`;

// Đoạn chọn chất lượng NGUYÊN VĂN của engine (không chép tay — engine đổi thì bài đổi theo).
const ENGINE = doc('flow-engine.js');
const dau = ENGINE.indexOf('// --- PHASE 4: CHỌN CHẤT LƯỢNG ---');
const cuoi = ENGINE.lastIndexOf('if (!clicked) {', ENGINE.indexOf('// Rút tên ra khỏi hàng đợi để không làm lệch tên', dau));
if (dau < 0 || cuoi < 0) throw new Error('Không cắt được đoạn PHASE 4 của engine — engine đã đổi?');
const PHASE4 = ENGINE.slice(dau, cuoi);

async function chay(wc, khoa, coAn) {
  const js = (c) => wc.executeJavaScript(c, true);
  await wc.loadFile(path.join(__dirname, '..', 'fixture-flow-moi.html'), { query: { khoa } });
  const boc = (src) => `(function(){\n${src}\n})();`;
  for (const [ten, src] of [
    ['cầu nối', CAU_NOI], ['đánh dấu tab', 'window.__FLOW_TAB_ID = "t1"; undefined;'],
    ['shim', doc('chrome-shim.js')], ['hàm phụ', boc(doc('main-world-helpers.js'))],
    ['engine', boc(ENGINE + '\nwindow.__tState = state; window.__tMenu = getOpenMenuItems; window.__tMoCon = radixKeyboardExpandSubmenu;' +
      `\nwindow.__tChon = async function (qualityItems, promptIndex) {\n${PHASE4}\nreturn clicked;\n};`)],
    ...(coAn ? [['tải về', doc('flow-tai-ve.js')]] : []), ['kho ảnh', doc('flow-kho-anh.js')]
  ]) {
    try { await js(src + '\n;undefined;'); } catch (err) { throw new Error(`tiêm "${ten}" hỏng: ${err.message}`); }
  }
  await wait(300);
  // Như engine: chuột phải vào thẻ → tìm mục Tải xuống → mở menu con bằng phím → chờ 2 s → lấy mục chất lượng.
  return js(`(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__tState.settings.runMode = 'video';
    window.__tState.settings.downloadQuality = '1080p';
    const tile = document.getElementById('oTai'), r = tile.getBoundingClientRect();
    tile.dispatchEvent(new MouseEvent('contextmenu', { view: window, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2, buttons: 2 }));
    await w(1500);
    const dl = window.__tMenu().find((el) => (el.querySelector('mat-icon') || {}).textContent === 'download');
    if (!dl) return { loi: 'không thấy mục Tải xuống' };
    window.__tMoCon(dl);
    await w(2000);
    const sub = window.__tMenu().filter((el) => el !== dl && !el.contains(dl));
    const clicked = await window.__tChon(sub, 1);
    await w(200);
    return { clicked, thay: sub.map((e) => e.dataset.q || e.textContent.trim()), taiVe: window.__taiVe, nk: window.__nk || [],
      menuCuoi: (window.__flowTaiVe && window.__flowTaiVe.menuCuoi) || '' };
  })()`);
}

app.whenReady().then(async () => {
  const w = new BaseWindow({ width: 1300, height: 900, show: true });
  await wait(500);
  const v = new WebContentsView({ webPreferences: { backgroundThrottling: false } });
  w.contentView.addChildView(v);
  v.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  v.setVisible(false);
  const wc = v.webContents;
  console.log(`\n══════════ TẢI VỀ: CHẤT LƯỢNG BỊ KHOÁ${KHONG_AN ? ' (PHÁ THỬ: không tiêm flow-tai-ve.js)' : ''} ══════════\n`);
  try {
    for (const khoa of ['nut', 'aria']) {
      const r = await chay(wc, khoa, !KHONG_AN);
      ok(`[khoá kiểu "${khoa}"] engine hạ xuống 720p, trang nhận lệnh tải 720p`, r.clicked && JSON.stringify(r.taiVe) === '["720p"]', JSON.stringify({ clicked: r.clicked, thay: r.thay, taiVe: r.taiVe }));
      ok(`[khoá kiểu "${khoa}"] ...nhật ký engine ghi "Không có 1080p, dùng "720p" thay thế."`, r.nk.some((x) => x.includes('Không có 1080p, dùng "720p" thay thế.')), r.nk.slice(-3).join(' | '));
      ok(`[khoá kiểu "${khoa}"] ...menu chất lượng được giữ lại cho tệp chẩn đoán`, /1080p/.test(r.menuCuoi) && /Nâng cấp/.test(r.menuCuoi), `${r.menuCuoi.length} ký tự`);
    }
    const r = await chay(wc, 'khong', !KHONG_AN);
    ok('[tài khoản không khoá] vẫn tải 1080p như cũ', r.clicked && JSON.stringify(r.taiVe) === '["1080p"]', JSON.stringify({ thay: r.thay, taiVe: r.taiVe }));

    // Tệp chẩn đoán trên trang bật Trusted Types (Google bật; gán innerHTML là ném lỗi).
    const tt = path.join(require('os').tmpdir(), `tt-${process.pid}.html`);
    fs.writeFileSync(tt, `<!doctype html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="require-trusted-types-for 'script'"></head><body>
      <flow-prompt-box><div role="textbox" contenteditable="true" class="ProseMirror"><p>x</p></div></flow-prompt-box>
      <div class="cdk-overlay-container"><div class="cdk-overlay-pane"><input placeholder="Tìm kiếm thành phần">
      <div><img src="a.png"><div>371_68b883.png</div><svg><path d="M0 0"/></svg></div></div></div></body></html>`);
    await wc.loadFile(tt);
    const thuTT = await wc.executeJavaScript('(() => { try { document.body.innerHTML = ""; return "không chặn"; } catch (e) { return "chặn"; } })()', true);
    await wc.executeJavaScript(doc('flow-kho-anh.js') + '\n;undefined;', true);
    let cd = null, loiCd = '';
    try { cd = await wc.executeJavaScript('window.__flowKhoAnh.chup()', true); } catch (e) { loiCd = e.message; }
    ok('trang có Trusted Types (Google bật): gán innerHTML bị chặn', thuTT === 'chặn', thuTT);
    ok('...vẫn chụp được tệp chẩn đoán (không còn "Script failed to execute")', cd && /371_68b883\.png/.test(cd.html) && !/M0 0/.test(cd.html), loiCd || (cd && cd.html.slice(0, 120)));
    fs.rmSync(tt, { force: true });
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
