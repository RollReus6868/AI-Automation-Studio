// ============================================================================
//  engine-gia.js — ENGINE FLOW GIẢ cho bài đầu-cuối tests/flow-e2e.js
//  --------------------------------------------------------------------------
//  Thay flow-engine.js (qua FLOW_TEST_NGUON), nói ĐÚNG hợp đồng message của
//  engine thật để kiểm phần của APP: giao mẻ, đọc bảng tiến độ, tên file theo
//  renameCustomList, tải về qua will-download, kho ảnh (@tên), dừng giữa mẻ.
//  Không kiểm được DOM của Google Flow — phần đó thuộc các bài tests/flow/*.
//
//  Quy ước của trang giả:
//    prompt chứa "LOI_FLOW"  → dòng đó ERROR (retries = maxRetries)
//    prompt chứa "CHAM"      → dòng đó tạo chậm (8 giây) — để thử Dừng
//    cookie flow_hong=1      → MỌI dòng ERROR (tài khoản này hỏng → chuyển dự phòng)
//    cookie flow_khong_tai=1 → tạo xong (COMPLETED) nhưng KHÔNG BAO GIỜ tải về (như "Chờ 120s mà Google chưa
//                              xuất file" lặp mãi ở nhật ký 16/10/2026) — đứng đó tới khi bị dừng
//    cookie flow_upload_moi=1 → như Flow mới (nhật ký 16/10/2026): engine KHÔNG tải ảnh lên được ("Không tìm thấy
//                              ô tải ảnh lên…"); trang dự án có nút [+] "Add media" → "Upload image" mở hộp chọn
//                              file (ô chọn file không gắn vào trang) — app phải tự bấm và đưa file vào
//  Kho ảnh Flow của tài khoản = localStorage của trang (mỗi tài khoản một phiên).
// ============================================================================
const gui = (m) => chrome.runtime.sendMessage(m);
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const ghi = (loai, d) => fetch('/__flow-ghi', { method: 'POST', body: JSON.stringify({ loai, d, url: location.href }) }).catch(() => {});
const kho = () => { try { return JSON.parse(localStorage.getItem('khoAnhFlow') || '[]'); } catch (_) { return []; } };
const themKho = (ds) => localStorage.setItem('khoAnhFlow', JSON.stringify([...new Set([...kho(), ...ds])]));
let me = null;

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==';
function taiFile(ten, video) {
  const bytes = video ? new Uint8Array(3000).map((_, i) => i % 251) : Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: video ? 'video/mp4' : 'image/png' }));
  const a = document.createElement('a');
  a.href = url; a.download = `flow_goc_${Date.now()}.${video ? 'mp4' : 'png'}`;
  document.body.appendChild(a); a.click(); a.remove();
}

async function chayMe(d) {
  const s = d.settings || {};
  const ten = String(s.renameCustomList || '').split('\n');
  const hong = /(^|;\s*)flow_hong=1/.test(document.cookie);
  const khongTai = /(^|;\s*)flow_khong_tai=1/.test(document.cookie);
  const rows = (d.videosToCreate || []).map((v) => ({ index: v.index, prompt: v.text, status: 'WAITING', retries: 0,
    progress: 0, downloaded: false, totalVideos: s.outputCount || 1, error: '' }));
  me = { dung: false };
  const bao = (isRunning = true) => gui({ action: 'UPDATE_TABLE_DATA', data: { rows: rows.map((r) => ({ ...r })), isRunning } });
  ghi('start', { prompts: d.prompts, videosToCreate: d.videosToCreate, settings: s });
  bao();
  for (const r of rows) {
    if (me.dung) break;
    r.status = 'PASTING'; bao();
    await gui({ action: 'INJECT_PASTE', data: { text: r.prompt } });
    r.status = 'CREATING'; r.progress = 40; bao();
    const het = Date.now() + (/CHAM/.test(r.prompt) ? 8000 : 500);
    while (Date.now() < het && !me.dung) await ngu(100);
    if (me.dung) break;
    if (hong || /LOI_FLOW/.test(r.prompt)) {
      r.status = 'ERROR'; r.retries = s.maxRetries || 0; r.error = 'Flow giả báo lỗi'; bao();
      continue;
    }
    r.status = 'COMPLETED'; r.progress = 100; bao();
    if (khongTai) { while (!me.dung) { await ngu(500); bao(); } break; }
    const goc = ten[r.index - 1] || `flow_${r.index}`;
    const n = s.outputCount || 1;
    for (let k = 1; k <= n; k++) {
      await gui({ action: 'SET_NEXT_FILENAME', filename: n > 1 ? `${goc}_${k}` : goc });
      taiFile(goc, s.runMode === 'video');
      await ngu(300);
    }
    if (s.autoRename) themKho([goc]);
    r.downloaded = true; bao();
  }
  me = null;
  bao(false);
  gui({ action: 'AUTOMATION_STOPPED' });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const d = msg.data || {};
  switch (msg.action) {
    case 'START_AUTOMATION':
      if (me) { ghi('bo-qua-start', {}); sendResponse({ ok: false, error: 'đang chạy' }); return; }
      chayMe(d);
      sendResponse({ ok: true });
      return;
    case 'STOP_AUTOMATION':
      ghi('stop', {});
      if (me) me.dung = true;
      sendResponse({ ok: true });
      return;
    case 'CHECK_ASSET_NAMES': {
      const co = kho();
      const names = d.names || [];
      ghi('check', { names });
      setTimeout(() => sendResponse({ ok: true, found: names.filter((x) => co.includes(x)), missing: names.filter((x) => !co.includes(x)) }), 200);
      return true;
    }
    case 'UPLOAD_IMAGES_TO_FLOW': {
      const imgs = d.images || [];
      if (/(^|;\s*)flow_upload_moi=1/.test(document.cookie)) {
        ghi('upload-hong', { names: imgs.map((i) => i.name) });
        setTimeout(() => sendResponse({ ok: false, error: 'Không tìm thấy ô tải ảnh lên của Flow. Hãy mở menu [+] → tab Hình ảnh một lần rồi thử lại.' }), 300);
        return true;
      }
      ghi('upload', { names: imgs.map((i) => i.name), dataUrl: imgs.map((i) => String(i.dataUrl || '').slice(0, 22)) });
      themKho(imgs.map((i) => String(i.name).replace(/\.[^.]+$/, '')));
      setTimeout(() => sendResponse({ ok: true, uploaded: imgs.length }), 300);
      return true;
    }
    default:
  }
});
window.__flowEngineGia = true;
