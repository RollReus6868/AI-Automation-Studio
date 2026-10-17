/**
 * 1.3.2 — Xoá chat Muse bằng CHUỘT THẬT (kênh debugger của Chromium, như Flow dùng để bấm "Tạo").
 *
 * Vì sao (tệp chẩn đoán người dùng 18/10/2026): app bấm bằng JavaScript — mở được menu ⋯, bấm được
 * "Delete" và nút xác nhận — nhưng chat vẫn còn nguyên trong danh sách. Cú bấm do JavaScript tạo ra
 * có isTrusted = false; nhiều thư viện nút bấm bỏ qua kiểu bấm đó. Nút ⋯ thật còn bị ẩn (display:none)
 * tới khi rê chuột vào hàng → phải rê chuột thật vào hàng trước rồi mới thấy nút để bấm.
 *
 * Chỉ dùng khi đường bấm bằng JavaScript đã thử mà không xoá được (main.js → xoaChat).
 * Toạ độ do trang tính (window.__muse.diemXoa trong src/inject/muse-trang.js).
 */
const { ensureDebugger, bamChuotThat, reChuotThat } = require('../flow/main/paste');

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bấm chuột PHẢI thật (mở menu chuột phải của hàng — hàng chat Muse là context-menu-trigger). */
async function bamPhaiThat(wc, x, y) {
  if (!ensureDebugger(wc)) return { ok: false };
  const X = Math.round(x), Y = Math.round(y);
  try {
    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: X, y: Y, button: 'none', buttons: 0 });
    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: X, y: Y, button: 'right', buttons: 2, clickCount: 1 });
    await ngu(60);
    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: X, y: Y, button: 'right', buttons: 0, clickCount: 1 });
    return { ok: true };
  } catch (_) { return { ok: false }; }
}

/**
 * Xoá MỘT chat: chat đang mở (dangMo) hoặc hàng đầu danh sách.
 * → { ok } | { ok:false, het:true } (hết chat để xoá) | { ok:false, loi }
 */
async function xoaChatChuotThat(wc, { dangMo = false, choXoaMs = 15000 } = {}) {
  const hoi = (buoc) => wc.executeJavaScript(`window.__muse.diemXoa(${JSON.stringify({ buoc, dangMo })})`, true).catch(() => null);
  const choDiem = async (buoc, ms) => {
    for (const het = Date.now() + ms; ;) {
      const d = await hoi(buoc);
      if (d && Number.isFinite(d.x)) return d;
      if (Date.now() > het) return null;
      await ngu(250);
    }
  };
  if (!ensureDebugger(wc)) return { ok: false, loi: 'khong-bat-duoc-chuot-that' };
  const hang = await hoi('nut');
  if (hang && hang.het) return { ok: false, het: true };
  if (!hang || !Number.isFinite(hang.x)) return { ok: false, loi: dangMo ? 'khong-thay-chat (chuột thật)' : 'khong-thay-hang (chuột thật)' };
  // Rê chuột thật vào hàng → nút ⋯ hiện ra → bấm. Nút không hiện thì mở menu chuột phải của hàng.
  await reChuotThat(wc, hang.x, hang.y);
  const nut = await choDiem('nutHien', 2000);
  if (nut) await bamChuotThat(wc, nut.x, nut.y);
  let muc = await choDiem('muc', 4000);
  if (!muc) {
    await bamPhaiThat(wc, hang.x, hang.y);
    muc = await choDiem('muc', 3000);
  }
  if (!muc) return { ok: false, loi: nut ? 'khong-mo-duoc-menu (chuột thật)' : 'khong-hien-nut-3-cham (chuột thật)' };
  await bamChuotThat(wc, muc.x, muc.y);
  const xn = await choDiem('xacNhan', 5000);
  if (xn) { await ngu(300); await bamChuotThat(wc, xn.x, xn.y); }
  for (const het = Date.now() + choXoaMs; Date.now() < het; await ngu(300)) {
    if ((await hoi('daXoa')) === true) return { ok: true };
  }
  return { ok: false, loi: `xoa-xong-nhung-danh-sach-khong-doi (chuột thật${xn ? '' : ', không thấy nút xác nhận'})` };
}

/** Lỗi của đường bấm bằng JavaScript mà chuột thật có thể làm được. */
const nenThuChuotThat = (r) => !!(r && !r.ok && /^(xoa-xong-nhung-danh-sach-khong-doi|khong-mo-duoc-menu|khong-thay-nut-xac-nhan|khong-thay-nut-3-cham)/.test(r.loi || ''));

module.exports = { xoaChatChuotThat, nenThuChuotThat };
