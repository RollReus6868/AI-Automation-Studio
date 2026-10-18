// ============================================================================
//  loc-the-main.js — TẢI VIDEO FLOW: CHỈ BỐC THẺ CỦA LẦN TẠO NÀY, KHÔNG BỐC VIDEO CŨ CÙNG PROMPT (1.3.3)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/loc-the-main.js [--khong-loc]
//
//  Nhật ký người dùng 18/10/2026 11:24: video nối từ ảnh dùng chung một prompt → engine lọc bằng ô Tìm kiếm
//  "1. <prompt>" và bốc mọi thẻ cùng prompt: #355 bốc 3 thẻ … #362 bốc 11 thẻ, tải hết từng cái (~2,5 phút).
//  Bài chạy hàm isolateTilesViaSearch THẬT của engine trên tests/fixture-flow-loc.html (9 video cũ cùng prompt +
//  1 lưới vừa tạo, đóng dấu data-fe-grid-id như engine) và đòi engine chỉ bốc đúng thẻ mới — cả khi Flow lọc tại
//  chỗ lẫn khi Flow vẽ lại kết quả thành phần tử mới, kết quả hiện trễ, ảnh thay video, mẻ 2 prompt.
//  --khong-loc (phá thử): không tiêm flow-loc-the.js → engine bốc 10 thẻ, bài đỏ.
// ============================================================================
const { app, BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');

const INJ = path.join(__dirname, '..', '..', 'src', 'flow', 'inject');
const doc = (f) => fs.readFileSync(path.join(INJ, f), 'utf8');
const loi = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const KHONG_LOC = process.argv.includes('--khong-loc');

const CAU_NOI = `window.__flowBridge = {
  send: async (m) => {
    if (m.action === 'LOG') (window.__nk = window.__nk || []).push((m.type || '') + ' ' + (m.message || ''));
    return { ok: true, success: true };
  },
  storage: async () => ({}),
  onDispatch: () => {}
}; undefined;`;
const ENGINE = doc('flow-engine.js');
const PROMPT = 'Animate this image with gentle camera motion, soft light, cinematic depth of field and slow push-in toward the subject';

/**
 * Nạp trang, tiêm như tab Flow, tạo lưới mới (đóng dấu như engine), rồi gọi isolateTilesViaSearch của engine.
 * moi: danh sách số prompt của mẻ (vd [1] hoặc [1, 2]); timSo: prompt engine đang tải.
 */
async function chay(wc, query, { moi = [1], timSo = 1, dongDau = true, coLoc = !KHONG_LOC, soViec = false } = {}) {
  const js = (c) => wc.executeJavaScript(c, true);
  await wc.loadFile(path.join(__dirname, '..', 'fixture-flow-loc.html'), { query });
  const boc = (src) => `(function(){\n${src}\n})();`;
  for (const [ten, src] of [
    ['cầu nối', CAU_NOI], ['đánh dấu tab', 'window.__FLOW_TAB_ID = "t1"; undefined;'],
    ['shim', doc('chrome-shim.js')], ['hàm phụ', boc(doc('main-world-helpers.js'))],
    ['engine', boc(ENGINE + '\nwindow.__tState = state; window.__tLoc = isolateTilesViaSearch;')],
    ['tải về', doc('flow-tai-ve.js')],
    ...(coLoc ? [['lọc thẻ', doc('flow-loc-the.js')]] : [])
  ]) {
    try { await js(src + '\n;undefined;'); } catch (err) { throw new Error(`tiêm "${ten}" hỏng: ${err.message}`); }
  }
  await wait(800);   // trang đã có video cũ từ trước (lúc tab nạp lại đầu mẻ)
  // Bấm Tạo → Flow thêm lưới mới; engine đóng dấu lưới + gắn data-tile-id cho thẻ (monitorCards).
  await js(`(() => {
    const pid = 'pid_${Date.now()}_';
    for (const so of ${JSON.stringify(moi)}) {
      const g = window.__taoMoi(so);
      if (${dongDau}) {
        g.setAttribute('data-fe-grid-id', pid + so);
        g.querySelectorAll('flow-tile-container').forEach((t) => t.setAttribute('data-tile-id', 'fe_id_' + Math.random().toString(36).slice(2)));
      }
    }
  })()`);
  await wait(1600);  // video tạo xong, engine đổi tên… rồi mới vào pha tải
  return js(`(async () => {
    // 1.3.5: soViec = app gắn "#<số việc>. " vào prompt, engine KHÔNG tự đánh số (addIndex false — caiDatEngine).
    window.__tState.settings.addIndex = ${!soViec};
    window.__tState.settings.renameMode = 'custom_list';
    const video = { promptIndex: ${timSo}, promptText: ${soViec ? `'#' + (900 + ${timSo}) + '. ' + ` : ''}${JSON.stringify(PROMPT)}, trackedTileIds: [] };
    const o = await window.__tLoc(video, '');
    const bocMa = (video.cardElements || []).map((t) => t.dataset.ma);
    // Engine tải xong thì xoá chữ trong ô Tìm kiếm (tryDownloadStep → finally).
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSet.call(o, ''); o.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 900));
    const conAn = document.querySelectorAll('[data-ai-loc-an]').length;
    const hienSau = [...document.querySelectorAll('flow-tile-container')].filter((t) => t.offsetParent !== null).length;
    return { tong: video.totalVideos, bocMa, conAn, hienSau, nk: window.__nk || [] };
  })()`);
}

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

app.whenReady().then(async () => {
  const w = new BaseWindow({ width: 1300, height: 900, show: true });
  await wait(500);
  const v = new WebContentsView({ webPreferences: { backgroundThrottling: false } });
  w.contentView.addChildView(v);
  v.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  v.setVisible(false);
  const wc = v.webContents;
  console.log(`\n══════════ TẢI FLOW: CHỈ BỐC THẺ VỪA TẠO${KHONG_LOC ? ' (PHÁ THỬ: không tiêm flow-loc-the.js)' : ''} ══════════\n`);
  try {
    for (const kieu of ['tai-cho', 've-lai']) {
      for (const tre of [0, 1200]) {
        const r = await chay(wc, { kieu, tre: String(tre) });
        const ten = `[Flow lọc ${kieu === 'tai-cho' ? 'tại chỗ' : 'bằng cách vẽ lại'}${tre ? `, kết quả hiện trễ ${tre} ms` : ''}]`;
        ok(`${ten} 9 video cũ cùng prompt + 1 video mới → engine chỉ bốc thẻ mới`, r.tong === 1 && r.bocMa.length === 1 && r.bocMa[0] === uuid(901),
          JSON.stringify({ tong: r.tong, bocMa: r.bocMa.map((m) => m.slice(-3)) }));
        ok(`${ten} ...nhật ký ghi đã ẩn các thẻ cũ`, r.nk.some((x) => /chỉ để lại 1 thẻ của lần tạo này, ẩn (9|10) thẻ cũ/.test(x)), r.nk.filter((x) => /🎯|bốc/.test(x)).join(' | '));
        ok(`${ten} ...xoá chữ tìm kiếm thì mọi thẻ hiện lại`, r.conAn === 0 && r.hienSau === 11, JSON.stringify({ conAn: r.conAn, hienSau: r.hienSau }));
      }
    }
    const a = await chay(wc, { kieu: 've-lai', anh: '1' });
    ok('[ẢNH, Flow vẽ lại kết quả] chỉ bốc ảnh mới', a.tong === 1 && a.bocMa[0] === uuid(901), JSON.stringify({ tong: a.tong, bocMa: a.bocMa.map((m) => m.slice(-3)) }));
    // Mẻ 2 prompt giống nhau ("1. …" và "2. …"): tải prompt 1 thì không bốc thẻ của prompt 2 và ngược lại.
    const m1 = await chay(wc, { kieu: 'tai-cho' }, { moi: [1, 2], timSo: 1 });
    ok('[mẻ 2 prompt, tải prompt 1] chỉ bốc thẻ của prompt 1', m1.tong === 1 && m1.bocMa[0] === uuid(901), JSON.stringify({ tong: m1.tong, bocMa: m1.bocMa.map((m) => m.slice(-3)) }));
    const m2 = await chay(wc, { kieu: 've-lai' }, { moi: [1, 2], timSo: 2 });
    ok('[mẻ 2 prompt, tải prompt 2] chỉ bốc thẻ của prompt 2', m2.tong === 1 && m2.bocMa[0] === uuid(902), JSON.stringify({ tong: m2.tong, bocMa: m2.bocMa.map((m) => m.slice(-3)) }));
    // 1.3.5: prompt mang SỐ VIỆC — ô Tìm kiếm của Flow tự chỉ ra thẻ của việc này, KHÔNG cần trình lọc thẻ cũ,
    // kể cả khi engine chưa đóng dấu lưới (trường hợp nhật ký 18/10 18:09 "bốc 11 thẻ" vẫn xảy ra ở 1.3.4).
    for (const kieu of ['tai-cho', 've-lai']) {
      const r = await chay(wc, { kieu, so: 'viec' }, { soViec: true, coLoc: false, dongDau: false });
      ok(`[SỐ VIỆC "#901.", Flow lọc ${kieu === 'tai-cho' ? 'tại chỗ' : 'bằng cách vẽ lại'}, không trình lọc, không đóng dấu] 9 video cũ cùng prompt → engine chỉ bốc thẻ mới`,
        r.tong === 1 && r.bocMa[0] === uuid(901), JSON.stringify({ tong: r.tong, bocMa: r.bocMa.map((m) => m.slice(-3)) }));
    }
    // Phá thử ngay trong bài: cùng trang đó mà engine tự đánh số theo mẻ ("1. …") như 1.3.4 → bốc cả thẻ cũ.
    {
      const r = await chay(wc, { kieu: 'tai-cho' }, { coLoc: false, dongDau: false });
      ok('[đối chứng: số theo mẻ "1." như 1.3.4, không trình lọc] engine bốc cả 10 thẻ (lỗi cũ)', r.tong === 10, JSON.stringify({ tong: r.tong }));
    }
    // Không nhận ra lưới mới (engine chưa đóng dấu) → không ẩn gì: engine bốc như cũ, app bỏ file thừa sau.
    if (!KHONG_LOC) {
      const k = await chay(wc, { kieu: 'tai-cho' }, { dongDau: false });
      ok('[không có lưới đóng dấu] không ẩn thẻ nào (engine bốc như cũ)', k.tong === 10 && k.conAn === 0, JSON.stringify({ tong: k.tong }));
    }
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
