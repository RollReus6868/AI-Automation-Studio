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
// Cookie flow_tai_cham=<ms> (chỉ để TÁI HIỆN lỗi CI Windows, bài thường không đặt): file tải từ máy chủ test, máy chủ gửi
// đầu trả lời ngay (will-download / DOWNLOAD_STARTED tới liền) nhưng giữ thân file <ms> mới xong — như Windows quét
// virus file vừa tải (sự kiện "done" tới muộn vài giây).
const taiCham = () => Number((document.cookie.match(/(?:^|;\s*)flow_tai_cham=(\d+)/) || [])[1]) || 0;
function taiFile(ten, video) {
  const a = document.createElement('a');
  const cham = taiCham();
  if (cham) {
    a.href = `/__flow-tai-cham?ms=${cham}&video=${video ? 1 : 0}`;
  } else {
    const bytes = video ? new Uint8Array(3000).map((_, i) => i % 251) : Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
    a.href = URL.createObjectURL(new Blob([bytes], { type: video ? 'video/mp4' : 'image/png' }));
  }
  a.download = `flow_goc_${Date.now()}.${video ? 'mp4' : 'png'}`;
  document.body.appendChild(a); a.click(); a.remove();
}
// Như engine thật (flow-engine.js, "ĐỒNG BỘ VỚI CHROME DOWNLOADS"): sau khi bấm tải, CHỜ app báo DOWNLOAD_STARTED đúng
// tên đã đặt rồi mới làm tiếp (engine thật chờ tới 120 s). Bản cũ bấm xong là đi tiếp → máy chậm (CI Windows) engine
// giả báo AUTOMATION_STOPPED trước cả khi file bắt đầu tải — lệch hợp đồng với engine thật.
function choBatDauTai(ten, ms = 120000) {
  return new Promise((giai) => {
    let hen = null;
    const nghe = (msg) => {
      if (!msg || msg.action !== 'DOWNLOAD_STARTED' || msg.filename !== ten) return;
      chrome.runtime.onMessage.removeListener(nghe); clearTimeout(hen); giai(true);
    };
    chrome.runtime.onMessage.addListener(nghe);
    hen = setTimeout(() => { chrome.runtime.onMessage.removeListener(nghe); giai(false); }, ms);
  });
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
      const tenTai = n > 1 ? `${goc}_${k}` : goc;
      await gui({ action: 'SET_NEXT_FILENAME', filename: tenTai });
      const batDau = choBatDauTai(tenTai);
      const bam = Date.now();
      taiFile(goc, s.runMode === 'video');
      const daBatDau = await batDau;
      ghi('tai', { ten: tenTai, batDau: daBatDau, choMs: Date.now() - bam });   // bài kiểm in ra khi mục Flow đỏ ở bước tải
      if (!daBatDau) {
        // Như engine thật: hết giờ chờ thì rút tên khỏi hàng đợi (kẻo file sau ăn nhầm tên) rồi tính là lỗi tải.
        await gui({ action: 'UNSET_NEXT_FILENAME', filename: tenTai });
        ghi('tai-khong-bat-dau', { ten: tenTai });
      }
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
