// ============================================================================
//  gan-anh-video-main.js — VIDEO TỪ ẢNH TRÊN FLOW: gắn ảnh @tên → dán prompt → bấm Tạo (1.3.2)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/gan-anh-video-main.js
//
//  Nhật ký người dùng 17/10/2026 21:48: "🧑 Đã đính kèm ảnh: 004_112652" rồi KHÔNG dán prompt (không có dòng
//  "Nghỉ … trước khi nhập prompt" / "Đã bơm đủ") → "Đã thử cả bốn kiểu bấm … mà Flow không nhận". Lần thử lại
//  thì lớp nền tối của bảng kho che nút Tạo. Bài này đi ĐÚNG đường app đi:
//    trang tests/fixture-flow-moi.html với ?khoaNhap=2500 (ảnh đầu tiên gắn vào → ô nhập tạm khoá) và
//    ?giuNen=1 (bảng kho đóng, lớp nền tối ở lại), ?dongY=1 (hộp "Quyền sử dụng hình ảnh này"); ENGINE THẬT flow-engine.js nói chuyện với MÁY FLOW THẬT
//    (src/flow/may-flow.js) qua preload-flow.js + ipcMain như main.js; dán bằng CDP, bấm Tạo bằng chuột thật.
//  Rồi kiểm tiếp: ảnh vừa tải hiện trong lưới dự án (trongLuoi), hộp thoại Flow mở sau khi nhận file (sauTai).
// ============================================================================
const { app, BaseWindow, WebContentsView, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { taoMayFlow } = require('../../src/flow/may-flow');
const { taiAnhLen, moTaSauTai } = require('../../src/flow/main/tai-anh-len');

const GOC = path.join(__dirname, '..', '..');
const INJ = path.join(GOC, 'src', 'flow', 'inject');
const doc = (f) => fs.readFileSync(path.join(INJ, f), 'utf8');
const loi = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

const nhatKy = [];
let tab = null;
const may = taoMayFlow({
  tabs: { get tabs() { return tab ? [tab] : []; }, findByWcId: (id) => (tab && tab.view.webContents && tab.view.webContents.id === id ? tab : null), dispatch: async () => ({ ok: true }) },
  taiVe: {},
  log: (muc, chu) => nhatKy.push(`${muc} ${chu}`),
  layCaiDat: () => ({})
});
ipcMain.handle('flow:message', (e, m) => may.handleEngineMessage(m, e.sender));
ipcMain.handle('flow:storage', () => ({}));

async function moTrang(w, query) {
  const v = new WebContentsView({ webPreferences: { preload: path.join(GOC, 'src', 'flow', 'main', 'preload-flow.js'), backgroundThrottling: false } });
  w.contentView.addChildView(v);
  v.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  v.setVisible(false);                     // tab Flow chạy ngầm, như trong app
  const wc = v.webContents;
  await wc.loadFile(path.join(GOC, 'tests', 'fixture-flow-moi.html'), { query });
  const js = (c) => wc.executeJavaScript(c, true);
  const boc = (src) => `(function(){\n${src}\n})();`;
  for (const [ten, src] of [
    ['đánh dấu tab', 'window.__FLOW_TAB_ID = "t1"; undefined;'],
    ['shim', doc('chrome-shim.js')], ['hàm phụ', boc(doc('main-world-helpers.js'))],
    ['engine', boc(doc('flow-engine.js') + '\nwindow.__tPaste = pastePrompt; window.__tState = state;' +
      '\ntry { window.__flowTimNutCaiDat = findSettingsDropdownButtonNative; } catch (e) {}')],
    ['chế độ', doc('flow-mode.js')], ['bấm Tạo', doc('flow-bam-tao.js')], ['tham chiếu', doc('flow-anh-tham-chieu.js')],
    ['kho ảnh', doc('flow-kho-anh.js')]
  ]) {
    try { await js(src + '\n;undefined;'); } catch (err) { throw new Error(`tiêm "${ten}" hỏng: ${err.message}`); }
  }
  await wait(400);
  return { v, wc, js };
}

/** Một prompt video gắn ảnh @tên, đi trọn pastePrompt() của engine. */
async function chayMotPrompt(js, prompts, settings) {
  await js(`Object.assign(window.__tState.settings, ${JSON.stringify(settings)}); window.__tState.prompts = ${JSON.stringify(prompts)};
    window.__v = { promptIndex: 1, promptText: ${JSON.stringify(prompts[0])} }; undefined;`);
  return js(`Promise.race([window.__tPaste(window.__v).then((x) => 'trả ' + x, (e) => 'lỗi ' + e.message),
    new Promise((r) => setTimeout(() => r('quá giờ'), 45000))])`);
}

app.whenReady().then(async () => {
  const w = new BaseWindow({ width: 1300, height: 900, show: true });
  await wait(500);
  console.log('\n══════════ VIDEO TỪ ẢNH TRÊN FLOW (gắn ảnh → dán → bấm Tạo) ══════════\n');
  try {
    // ── 1. Ảnh đầu tiên gắn vào → ô nhập tạm khoá; bảng kho để lại lớp nền tối ──
    const SETTINGS = { runMode: 'video', charSync: true, charSyncStripTag: true, keyframeSync: false, addIndex: true,
      renameMode: 'default', renameStartIndex: 1, voiceSync: false };
    const PROMPTS = ['Gia-cốp ôm Giô-sép, ánh hoàng hôn vàng rực sau lưng, máy quay lùi chậm, gió thổi áo choàng @001_4909b1'];
    let t = await moTrang(w, { kho: '001_4909b1.png,cu_khac.png', cheDo: 'video', khoaNhap: '2500', giuNen: '1' });
    tab = { id: 't1', view: t.v, ready: true, accountId: 'flow-1', promptsMe: PROMPTS, caiDatEngine: SETTINGS };
    const kq = await chayMotPrompt(t.js, PROMPTS, SETTINGS);
    const tao = await t.js('window.__tao');
    const nk = nhatKy.join('\n');
    if (tao.length !== 1) console.log('     engine:', kq, '\n     ' + nhatKy.slice(-15).join('\n     '));
    ok('ô nhập tạm khoá sau khi gắn ảnh (như trang thật)', (await t.js('window.__khoaNhap || 0')) === 1);
    ok('engine bỏ qua bước dán (không gửi INJECT_PASTE) — app nhận ra và dán bù', /🩹 \[t1\] Engine bỏ qua bước dán prompt \[1\]/.test(nk), nhatKy.filter((l) => /🩹|bơm/.test(l)).join(' | '));
    const v = await t.js('({ dan: window.__v.pastedPromptText })');
    ok('Flow nhận ĐÚNG MỘT lần bấm Tạo', tao.length === 1, JSON.stringify(tao));
    ok('...với đúng chữ engine định dán ("1. " + prompt đã bỏ thẻ @)', tao[0] && tao[0].chu === v.dan && v.dan === '1. ' + PROMPTS[0].replace(' @001_4909b1', ''),
      JSON.stringify({ tao: tao[0] && tao[0].chu, engine: v.dan }));
    ok('...và ảnh 001_4909b1 vẫn gắn trong ô nhập', tao[0] && tao[0].anh.join() === '001_4909b1.png', JSON.stringify(tao[0] && tao[0].anh));
    ok('lớp nền tối của bảng kho được đóng trước khi bấm', /đã đóng/.test(nk) && !(await t.js('!!document.querySelector(".cdk-overlay-backdrop")')),
      nhatKy.filter((l) => /🧹/.test(l)).join(' | '));
    ok('không còn dòng "Flow không nhận"', !/không nhận/.test(nk));
    w.contentView.removeChildView(t.v); t.wc.close();

    // ── 2. Đường bình thường (ô nhập không dựng lại) vẫn như cũ: engine tự dán, app không dán bù ──
    nhatKy.length = 0;
    t = await moTrang(w, { kho: '002_10995d.png', cheDo: 'video' });
    const P2 = ['Cảnh đồng cỏ xanh, đàn cừu chạy về phía chân trời, bầu trời nhiều mây trắng @002_10995d'];
    tab = { id: 't1', view: t.v, ready: true, accountId: 'flow-1', promptsMe: P2, caiDatEngine: SETTINGS };
    await chayMotPrompt(t.js, P2, SETTINGS);
    const tao2 = await t.js('window.__tao');
    ok('ô nhập không dựng lại: engine tự dán, Flow nhận đúng chữ', tao2.length === 1 && tao2[0].chu === '1. ' + P2[0].replace(' @002_10995d', ''), JSON.stringify(tao2));
    ok('...app không dán bù', !/🩹/.test(nhatKy.join('\n')));
    w.contentView.removeChildView(t.v); t.wc.close();

    // ── 3. Tải ảnh lên ở tài khoản chưa từng đồng ý: hộp "Quyền sử dụng hình ảnh này" (4 tệp chẩn đoán 17/10/2026) ──
    const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'gan-anh-'));
    const anh = (ten) => { const f = path.join(tam, ten); fs.writeFileSync(f, PNG); return f; };
    const guiEngine = (js, m) => js(`window.__flowShimDispatch(${JSON.stringify(m)})`).then((x) => (x && x.result) || x);
    const moTab = async (q) => { const x = await moTrang(w, q); tab = { id: 't1', view: x.v, ready: true, accountId: 'flow-1' }; return x; };
    const dongTab = (x) => { w.contentView.removeChildView(x.v); x.wc.close(); };

    t = await moTab({ kho: 'cu_khac.png', luoi: '1', dongY: '1' });
    let r = await taiAnhLen(t.wc, [anh('001_4909b1.png')], { choMs: 1000 });
    if (process.env.DBG) console.log('     DBG', JSON.stringify(await t.js(`({ n: window.__nhan, hop: document.querySelectorAll('flow-upload-consent-dialog').length,
      td: window.__flowTaiAnh && window.__flowTaiAnh.hopDongY() })`)));
    ok('chưa cho phép: app nhận ra hộp "Quyền sử dụng hình ảnh này", báo ngay (không chờ kho 60 giây)',
      !r.ok && r.canDongY && /Quyền sử dụng hình ảnh này/.test(r.loi), JSON.stringify({ ok: r.ok, loi: r.loi }));
    ok('...KHÔNG bấm "Tôi đồng ý" thay người dùng', (await t.js('window.__dongY')) === 0);
    ok('...và đóng hộp lại (không để lớp nền tối che trang)', !(await t.js('!!document.querySelector("flow-upload-consent-dialog")')));
    dongTab(t);

    t = await moTab({ kho: 'cu_khac.png', luoi: '1', dongY: '1' });
    r = await taiAnhLen(t.wc, [anh('002_10995d.png')], { choMs: 1000, dongY: true });
    ok('được phép: app bấm "Tôi đồng ý", ảnh vào kho', r.ok && r.dongY && r.dongY.daDongY && (await t.js('window.__dongY')) === 1, JSON.stringify({ ok: r.ok, dongY: r.dongY, loi: r.loi }));
    let k = await guiEngine(t.js, { action: 'CHECK_ASSET_NAMES', data: { names: ['002_10995d'] } });
    ok('...engine dò kho thấy ảnh', k && k.ok && k.found.join() === '002_10995d', JSON.stringify(k));
    dongTab(t);

    // ── 4. Hộp thoại lạ sau khi nhận file: ghi chữ + nút vào nhật ký, không bấm gì ──
    t = await moTab({ kho: 'cu_khac.png', hopTai: '1' });
    r = await taiAnhLen(t.wc, [anh('003_219f0f.png')], { choMs: 1000, dongY: true });
    const sau = moTaSauTai(r.sauTai);
    ok('ghi lại hộp thoại Flow mở ngay sau khi nhận file (chữ + nút)', r.ok && /Không xử lý được tệp/.test(sau) && /Đóng/.test(sau), sau);
    dongTab(t);

    // ── 5. Bảng [+] chậm: kho báo thiếu nhưng ảnh đã hiện trong lưới dự án ──
    t = await moTab({ kho: 'cu_khac.png', luoi: '1', khoCham: '20000' });
    r = await taiAnhLen(t.wc, [anh('005_0b773c.png')], { choMs: 1000 });
    ok('tải lên bằng nút của Flow', r.ok && r.cach === 'hop-chon-file', JSON.stringify(r.buoc));
    k = await guiEngine(t.js, { action: 'CHECK_ASSET_NAMES', data: { names: ['005_0b773c'] } });
    ok('bảng [+] chưa có ảnh → engine dò kho báo thiếu', k && k.ok && k.missing.join() === '005_0b773c', JSON.stringify(k));
    const luoi = await t.js('window.__flowKhoAnh.trongLuoi(["005_0b773c", "khong_co"])');
    ok('...nhưng ảnh đã hiện trong lưới dự án → app biết Flow đã có ảnh', luoi.join() === '005_0b773c', JSON.stringify(luoi));
    await t.js('document.getElementById("nutThem").click()'); await wait(400);
    const luoi2 = await t.js('window.__flowKhoAnh.trongLuoi(["cu_khac"])');
    ok('...tên chỉ nằm trong bảng kho [+] (lớp nổi) thì KHÔNG tính là có trong lưới', luoi2.length === 0, JSON.stringify(luoi2));
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
