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
//  1.2.7: menu ẢNH 1K / 2K / 4K, mục mờ lúc mở (?tre), engine nghỉ giữa lúc lấy danh sách và lúc bấm (cho),
//  chữ "Nâng cấp" hiện muộn (?muon). Phá thử: chép flow-tai-ve.js của 1.2.6 vào → các bài ảnh đỏ "clicked:false".
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

async function chay(wc, khoa, coAn, them = {}) {
  const js = (c) => wc.executeJavaScript(c, true);
  await wc.loadFile(path.join(__dirname, '..', 'fixture-flow-moi.html'), { query: { khoa, ...(them.anh ? { anh: '1' } : {}), ...(them.tre ? { tre: String(them.tre) } : {}), ...(them.cach ? { cach: '1' } : {}), ...(them.muon ? { muon: '1' } : {}), ...(them.tangHong ? { tangHong: '1' } : {}) } });
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
    window.__tState.settings.runMode = ${them.anh ? "'image'" : "'video'"};
    window.__tState.settings.downloadQuality = ${them.anh ? "'img_2k'" : "'1080p'"};
    const tile = document.getElementById('oTai'), r = tile.getBoundingClientRect();
    tile.dispatchEvent(new MouseEvent('contextmenu', { view: window, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2, buttons: 2 }));
    await w(1500);
    const dl = window.__tMenu().find((el) => (el.querySelector('mat-icon') || {}).textContent === 'download');
    if (!dl) return { loi: 'không thấy mục Tải xuống' };
    window.__tMoCon(dl);
    await w(2000);
    const sub = window.__tMenu().filter((el) => el !== dl && !el.contains(dl));
    await w(${them.cho || 0});   // engine nghỉ "trước khi chọn chất lượng tải về" giữa lúc lấy danh sách và lúc bấm
    const clicked = await window.__tChon(sub, 1);
    await w(200);
    // 1.3.7: engine đứng chờ file 120 s — trong lúc đó trình tiêm có thể tự mở lại menu và tải Kích thước gốc.
    for (let k = 0; k < ${them.choFile || 0} && !window.__taiVe.length; k += 250) await w(250);
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

    // 1.2.7 — nhật ký 17/10/2026: ẢNH tạo xong, "Không chọn được chất lượng tải xuống" mọi lần thử. Menu mở ra với
    // mọi mục còn MỜ ~1 s (Flow chuẩn bị file); 1.2.3 ẩn luôn cả 1K → engine không còn mục nào.
    for (const khoa of ['nut', 'aria']) {
      const a = await chay(wc, khoa, !KHONG_AN, { anh: true, tre: 1000 });
      ok(`[ảnh, mục mờ 1 s lúc mở, khoá "${khoa}"] engine hạ 2K → 1K và tải được`, a.clicked && JSON.stringify(a.taiVe) === '["1K"]', JSON.stringify({ clicked: a.clicked, thay: a.thay, taiVe: a.taiVe }));
      ok(`[ảnh, khoá "${khoa}"] ...nhật ký nói mục nào bị bỏ qua`, a.nk.some((x) => /Menu Tải xuống: bỏ qua mục bị khoá \(cần nâng cấp\) 2K, 4K — chọn trong: 1K/.test(x)), a.nk.slice(-4).join(' | '));
    }
    // Chữ mục có dấu cách ("1K Kích thước gốc"): 1.2.3 nhận ra cả 1K là mục chất lượng, ẩn HẾT → y lỗi 17/10.
    for (const khoa of ['nut', 'aria']) {
      const c = await chay(wc, khoa, !KHONG_AN, { anh: true, tre: 1000, cach: true });
      ok(`[ảnh, chữ có dấu cách, mục mờ 1 s, khoá "${khoa}"] tải 1K`, c.clicked && JSON.stringify(c.taiVe) === '["1K"]', JSON.stringify({ clicked: c.clicked, thay: c.thay, taiVe: c.taiVe }));
    }
    // Mục còn mờ LÚC ENGINE LẤY DANH SÁCH (3 s > 2 s), sáng trong lúc engine nghỉ 2,5 s rồi mới bấm.
    const n3 = await chay(wc, 'nut', !KHONG_AN, { anh: true, tre: 3000, cho: 2500, cach: true });
    ok('[ảnh, mờ quá lúc lấy danh sách, khoá "nut"] tải 1K', JSON.stringify(n3.taiVe) === '["1K"]', JSON.stringify({ clicked: n3.clicked, thay: n3.thay, taiVe: n3.taiVe }));
    // Chữ "Nâng cấp" chỉ hiện SAU khi menu sáng: lúc engine lấy danh sách chưa biết mục nào khoá, tới lúc bấm 2K / 1080p
    // (đã khoá) thì lưới an toàn chặn cú bấm và bấm 1K / 720p thay.
    for (const anh of [true, false]) {
      const b = await chay(wc, 'aria', !KHONG_AN, { anh, tre: 3000, cho: 2500, cach: true, muon: true });
      const [k, t] = anh ? ['2K', '1K'] : ['1080P', '720P'];
      ok(`[${anh ? 'ảnh' : 'video'}, "Nâng cấp" hiện muộn] bấm ${k} khoá → tải ${t} thay`, JSON.stringify(b.taiVe) === JSON.stringify([anh ? '1K' : '720p']), JSON.stringify({ clicked: b.clicked, thay: b.thay, taiVe: b.taiVe }));
      ok(`[${anh ? 'ảnh' : 'video'}] ...nhật ký ghi "Mục ${k} bị khoá … tải ${t} thay"`, b.nk.some((x) => x.includes(`Mục ${k} bị khoá (cần nâng cấp) — tải ${t} thay`)), b.nk.slice(-3).join(' | '));
    }
    const a4 = await chay(wc, 'khong', !KHONG_AN, { anh: true, tre: 3000, cho: 2500, cach: true });
    ok('[ảnh, tài khoản không khoá, mờ quá lúc lấy danh sách] vẫn tải 2K', JSON.stringify(a4.taiVe) === '["2K"]', JSON.stringify({ thay: a4.thay, taiVe: a4.taiVe }));
    const a2 = await chay(wc, 'nut', !KHONG_AN, { anh: true });
    ok('[ảnh, menu sáng ngay] tải 1K', a2.clicked && JSON.stringify(a2.taiVe) === '["1K"]', JSON.stringify({ thay: a2.thay, taiVe: a2.taiVe }));
    const a3 = await chay(wc, 'khong', !KHONG_AN, { anh: true, tre: 1000 });
    ok('[ảnh, tài khoản không khoá, mục mờ 1 s] vẫn tải 2K', a3.clicked && JSON.stringify(a3.taiVe) === '["2K"]', JSON.stringify({ thay: a3.thay, taiVe: a3.taiVe }));

    // 1.3.7 — tệp chẩn đoán 18/10/2026 19:16: menu ảnh 1K · 2K · 4K đều sáng, engine bấm 2K (cài đặt mặc định),
    // Flow báo "Không tăng được độ phân giải!" và không ra file → engine chờ 120 s ×3, 5 phút, việc hỏng.
    for (const anh of [true, false]) {
      const t = await chay(wc, 'khong', !KHONG_AN, { anh, tangHong: true, choFile: 15000 });
      const goc = anh ? '1K' : '720p';
      ok(`[${anh ? 'ảnh' : 'video'}, Flow không tăng được độ phân giải] tự mở lại menu và tải ${goc} (Kích thước gốc)`,
        JSON.stringify(t.taiVe) === JSON.stringify([goc]), JSON.stringify({ clicked: t.clicked, taiVe: t.taiVe, nk: t.nk.slice(-3) }));
      ok(`[${anh ? 'ảnh' : 'video'}] ...nhật ký nói rõ lý do`, t.nk.some((x) => x.includes('Không tăng được độ phân giải!') && x.includes('Kích thước gốc')), t.nk.slice(-3).join(' | '));
      // Cùng trang (không nạp lại): lần tải sau engine lại bấm mục đã tăng → bấm Kích thước gốc thay NGAY, không chờ thông báo.
      const lan2 = await wc.executeJavaScript(`(async () => {
        const w = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__taiVe = []; const bam0 = window.__bamTang;
        const tile = document.getElementById('oTai'), r = tile.getBoundingClientRect();
        tile.dispatchEvent(new MouseEvent('contextmenu', { view: window, bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2, buttons: 2 }));
        await w(1500);
        const dl = window.__tMenu().find((el) => (el.querySelector('mat-icon') || {}).textContent === 'download');
        window.__tMoCon(dl); await w(2000);
        const sub = window.__tMenu().filter((el) => el !== dl && !el.contains(dl));
        const clicked = await window.__tChon(sub, 1);
        await w(400);
        return { clicked, taiVe: window.__taiVe, bamTang: window.__bamTang - bam0, nk: (window.__nk || []).slice(-2) };
      })()`, true);
      ok(`[${anh ? 'ảnh' : 'video'}] ...lần tải sau trên tab đó: tải ${goc} ngay, không bấm mục đã tăng nữa`,
        JSON.stringify(lan2.taiVe) === JSON.stringify([goc]) && lan2.bamTang === 0, JSON.stringify(lan2));
    }
    // Tài khoản tăng được độ phân giải (không có thông báo lỗi) → vẫn tải 2K như cũ (không đụng tới).
    const t2 = await chay(wc, 'khong', !KHONG_AN, { anh: true, choFile: 3000 });
    ok('[ảnh, Flow tăng được] vẫn tải 2K', JSON.stringify(t2.taiVe) === '["2K"]', JSON.stringify(t2.taiVe));

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
