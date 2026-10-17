// ============================================================================
//  flow-moi-main.js — GIAO DIỆN FLOW MỚI (16/10/2026): tải ảnh lên, dò kho, gắn ảnh, đổi chế độ (1.2.2)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/flow-moi-main.js
//
//  Trang tests/fixture-flow-moi.html dựng lại khung ô nhập từ HTML trang dự án thật người dùng gửi,
//  cùng bảng kho [+] và bảng cài đặt theo ảnh chụp. Bài tiêm ĐÚNG các file app tiêm vào tab Flow (lớp
//  giả lập chrome.*, ENGINE THẬT flow-engine.js, trình đổi chế độ, trình nắn kho ảnh…) vào một
//  WebContentsView ĐANG ẨN, rồi đi đúng các bước app đi:
//    1. engine UPLOAD_IMAGES_TO_FLOW hỏng y như nhật ký người dùng ("Không tìm thấy ô tải ảnh lên");
//    2. taiAnhLen() bấm [+] → "Tải nội dung nghe nhìn lên" (KHÔNG nhầm mục lọc "Tệp tải lên"), file thật vào;
//    3. engine CHECK_ASSET_NAMES thấy ảnh vừa tải trong kho;
//    4. đổi chế độ Hình ảnh → Video, chọn "Thành phần";
//    5. engine Character Sync gắn đúng ảnh @tên vào ô nhập rồi dán prompt.
// ============================================================================
const { app, BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { taiAnhLen } = require('../../src/flow/main/tai-anh-len');

const INJ = path.join(__dirname, '..', '..', 'src', 'flow', 'inject');
const doc = (f) => fs.readFileSync(path.join(INJ, f), 'utf8');
const loi = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

// Cầu nối giả thay preload-flow.js: INJECT_PASTE dán chữ vào ô nhập như paste.js của app.
const CAU_NOI = `window.__flowBridge = {
  send: async (m) => {
    (window.__guiLen = window.__guiLen || []).push(m.action);
    if (m.action === 'LOG') (window.__nk = window.__nk || []).push((m.type || '') + ' ' + (m.message || ''));
    if (m.action === 'INJECT_PASTE') {
      const o = document.querySelector('[role=textbox]');
      o.innerHTML = '<p>' + m.data.text + '</p>';
      window.__dan.push(m.data.text);
      return { ok: true, hasZeroWidth: false };
    }
    if (m.action === 'INJECT_CLICK_CREATE') return { ok: true, wasDisabled: false };
    return { ok: true, success: true };
  },
  storage: async () => ({}),
  onDispatch: () => {}
}; undefined;`;

app.whenReady().then(async () => {
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-moi-'));
  const f1 = path.join(tam, '371_68b883.png');
  fs.writeFileSync(f1, PNG);
  const w = new BaseWindow({ width: 1300, height: 900, show: true });
  await wait(500);
  const v = new WebContentsView({ webPreferences: { backgroundThrottling: false } });
  w.contentView.addChildView(v);
  v.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  v.setVisible(false);
  const wc = v.webContents;
  const js = (c) => wc.executeJavaScript(c, true);
  console.log('\n══════════ GIAO DIỆN FLOW MỚI ══════════\n');
  try {
    await wc.loadFile(path.join(__dirname, '..', 'fixture-flow-moi.html'), { query: { kho: 'cu_khac.png' } });
    const boc = (src) => `(function(){\n${src}\n})();`;
    for (const [ten, src] of [
      ['cầu nối', CAU_NOI], ['đánh dấu tab', 'window.__FLOW_TAB_ID = "t1"; undefined;'],
      ['shim', doc('chrome-shim.js')], ['hàm phụ', boc(doc('main-world-helpers.js'))],
      ['engine', boc(doc('flow-engine.js') + '\nwindow.__tPaste = pastePrompt; window.__tState = state;' +
        '\ntry { window.__flowTimNutCaiDat = findSettingsDropdownButtonNative; } catch (e) {}')],
      ['chế độ', doc('flow-mode.js')], ['kho ảnh', doc('flow-kho-anh.js')], ['tham chiếu', doc('flow-anh-tham-chieu.js')]
    ]) {
      try { await js(src + '\n;undefined;'); } catch (err) { throw new Error(`tiêm "${ten}" hỏng: ${err.message}`); }
    }
    await wait(500);
    const guiEngine = (m) => js(`window.__flowShimDispatch(${JSON.stringify(m)})`).then((r) => (r && r.result) || r);

    // 1. Engine tải lên kiểu cũ: hỏng y như nhật ký người dùng.
    const up = await guiEngine({ action: 'UPLOAD_IMAGES_TO_FLOW', data: { images: [{ name: '371_68b883.png', type: 'image/png', dataUrl: 'data:image/png;base64,' + PNG.toString('base64') }] } });
    ok('engine (như tool cũ) không tải được: "Không tìm thấy ô tải ảnh lên của Flow"', up && up.ok === false && /Không tìm thấy ô tải ảnh lên/.test(up.error), JSON.stringify(up));
    await js('document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}))');
    await wait(300);

    // 2. App tải lên bằng nút của Flow.
    const r = await taiAnhLen(wc, [f1], { choMs: 1000 });
    const nhan = await js('window.__nhan');
    ok('app bấm [+] → "Tải nội dung nghe nhìn lên", trang nhận đúng file thật', r.ok && r.cach === 'hop-chon-file' && nhan.join() === '371_68b883.png', JSON.stringify({ r, nhan }));
    ok('...không bấm nhầm mục lọc "Tệp tải lên"', !/Tệp tải lên/.test(r.buoc.join()) && /Tải nội dung nghe nhìn lên/.test(r.buoc.join()), r.buoc.join(' | '));
    ok('...bảng kho đóng lại sau khi tải', !(await js('!!document.querySelector(".cdk-overlay-pane")')));

    // 3. Engine dò kho thấy ảnh vừa tải (và báo thiếu ảnh không có).
    const k = await guiEngine({ action: 'CHECK_ASSET_NAMES', data: { names: ['371_68b883', 'khong_co_anh'] } });
    ok('engine dò kho: thấy ảnh vừa tải, báo đúng ảnh thiếu', k && k.ok && k.found.join() === '371_68b883' && k.missing.join() === 'khong_co_anh', JSON.stringify(k));

    // 4. Đổi chế độ Hình ảnh → Video, rồi "Thành phần".
    let m = await js('window.__flowSetMode("video", { phu: "thanh-phan" })');
    ok('tự đổi sang mục Video', m.ok && (await js('window.__cheDo')) === 'video' && (await js('window.__flowGetMode()')) === 'video', JSON.stringify(m));
    ok('...và chọn "Thành phần" (ảnh gắn @tên là thành phần của video)', (await js('window.__phu')) === 'thanh-phan', JSON.stringify(m));
    ok('...không bấm nhầm mục lọc "Video" ở thanh bên dự án', (await js('window.__locTrang || ""')) === '', await js('window.__locTrang || ""'));
    m = await js('window.__flowSetMode("video", { phu: "thanh-phan" })');
    ok('...gọi lại khi đã đúng: không bấm gì thêm', m.ok && !m.daDoi, JSON.stringify(m));

    // 5. Character Sync của engine gắn ảnh @tên rồi dán prompt.
    await js(`Object.assign(window.__tState.settings, { runMode: 'video', charSync: true, charSyncStripTag: true, keyframeSync: false, addIndex: false });
      window.__tState.prompts = ['sóng vỗ @371_68b883']; undefined;`);
    const kqDan = await js('Promise.race([window.__tPaste({ promptIndex: 1, promptText: "sóng vỗ @371_68b883" }).then((x) => "trả " + x, (e) => "lỗi " + e.message), new Promise((r) => setTimeout(() => r("quá giờ"), 15000))])');
    const gan = await js('window.__gan'), dan = await js('window.__dan');
    if (gan.join() !== '371_68b883.png') console.log('     engine:', kqDan, '\n     ' + (await js('(window.__nk || []).slice(-12).join("\\n     ")')));
    ok('engine gắn đúng ảnh @371_68b883 vào ô nhập (nút "Thêm vào câu lệnh")', gan.join() === '371_68b883.png', JSON.stringify({ gan, dan }));
    ok('...rồi dán prompt đã bỏ thẻ @', dan.length === 1 && dan[0] === 'sóng vỗ', JSON.stringify(dan));

    // 6. Quay về Hình ảnh.
    m = await js('window.__flowSetMode("image")');
    ok('tự đổi về mục Hình ảnh', m.ok && (await js('window.__cheDo')) === 'image' && (await js('window.__flowGetMode()')) === 'image', JSON.stringify(m));
    ok('...không bấm nhầm mục lọc "Hình ảnh" ở thanh bên (nhật ký 17/10 12:03)', (await js('window.__locTrang || ""')) === '', await js('window.__locTrang || ""'));
    // Bảng kho [+] đang mở (cũng có Hình ảnh / Video): không nhận nhầm là bảng chế độ.
    await js('document.getElementById("nutThem").click()'); await wait(300);
    m = await js('window.__flowSetMode("video")');
    ok('bảng kho đang mở: vẫn đổi đúng sang Video (không bấm mục lọc trong kho)', m.ok && (await js('window.__cheDo')) === 'video', JSON.stringify(m));
    m = await js('window.__flowSetMode("image")');
    ok('...và về lại Hình ảnh', m.ok && (await js('window.__cheDo')) === 'image', JSON.stringify(m));
    await js('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); undefined;');

    // 6b. Lưới đang lọc "Hình ảnh" (bản cũ bấm nhầm) → về "Tất cả"; đang ở "Tất cả" thì không bấm gì.
    let bo = await js('window.__flowBoLocLuoi()');
    ok('lưới đang ở "Tất cả": không bấm gì', bo.co && !bo.daBo && (await js('window.__locTrang || ""')) === '', JSON.stringify(bo));
    await js('document.querySelector(\'.nav-loc[data-loc="image"]\').click(); undefined;');
    bo = await js('window.__flowBoLocLuoi()');
    ok('lưới đang lọc "Hình ảnh" → chuyển về "Tất cả nội dung nghe nhìn"', bo.daBo && (await js('window.__locTrang')) === 'tat-ca', JSON.stringify(bo));
    const mf = require('fs').readFileSync(path.join(__dirname, '..', '..', 'src', 'flow', 'may-flow.js'), 'utf8');
    const cb = mf.slice(mf.indexOf('async function chuanBiMe'));
    ok('may-flow: bỏ lọc lưới TRƯỚC khi đổi chế độ mỗi mẻ', cb.indexOf('__flowBoLocLuoi') > 0 && cb.indexOf('__flowBoLocLuoi') < cb.indexOf('datCheDoKienTri('));

    // 7. Chụp chẩn đoán bảng kho để người dùng gửi khi Flow đổi giao diện.
    await js('document.getElementById("nutThem").click()');
    await wait(300);
    await js(`document.body.insertAdjacentHTML('beforeend', '<div role="menu" aria-label="Tài khoản Google: Ten That  (ten.that@gmail.com)">ten.that@gmail.com</div>'); undefined;`);
    const cd = await js('window.__flowKhoAnh.chup()');
    ok('chụp được HTML bảng kho + ô nhập (bỏ ảnh, bỏ script)', /Tìm kiếm thành phần/.test(cd.html) && /Thêm thành phần vào ô nhập câu lệnh/.test(cd.html) && !/base64/.test(cd.html), `${cd.html.length} ký tự`);
    ok('...không lọt email / tên tài khoản Google', !/ten\.that|Ten That/.test(cd.html) && /\[email\]/.test(cd.html), (cd.html.match(/.{0,40}(ten\.that|Ten That).{0,20}/) || [''])[0]);
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
