'use strict';
// ============================================================================
//  xoa-du-an.js — XOÁ MỘT DỰ ÁN GOOGLE FLOW (tuỳ chọn "tự xoá dự án Flow khi
//  chạy xong hàng chờ", 1.0.2)
//  --------------------------------------------------------------------------
//  Xoá là việc KHÔNG HOÀN TÁC được, nên chỉ làm khi chắc chắn đúng dự án:
//    1. mở trang chủ Flow, tìm thẻ dự án có liên kết tới ĐÚNG mã dự án
//       (/project/<mã>) — thẻ đó không được chứa liên kết tới dự án nào khác;
//    2. trong thẻ đó tìm nút "⋮ / thêm tuỳ chọn", bấm → menu → mục "Xoá / Delete";
//    3. hộp xác nhận (nếu có) → nút "Xoá / Delete" trong hộp;
//    4. nạp lại trang chủ: liên kết tới mã dự án đó phải biến mất.
//  Thiếu bất kỳ bước nào → DỪNG, ghi nhật ký kèm những gì thấy trên trang,
//  không bấm thử chỗ khác. Chưa từng thấy trang chủ flow.google.com thật — các
//  bước dò theo vai trò (role) và chữ Anh/Việt; nhật ký là chỗ để sửa.
// ============================================================================

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mã dự án trong địa chỉ …/project/<mã>. */
function maDuAn(url) {
  const m = String(url || '').match(/\/project\/([^/?#\s]+)/);
  return m ? m[1] : '';
}

// Chạy trong trang. Dùng chung: bấm đủ chuỗi sự kiện chuột MỘT lần (Radix nghe pointerdown,
// Angular Material nghe click — mỗi thư viện chỉ bật/tắt ở một loại sự kiện).
const CHUNG = `
  const nhinThay = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const chu = (e) => String(e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim();
  const nhan = (e) => [e.getAttribute('aria-label'), e.getAttribute('title'), chu(e)].filter(Boolean).join(' ');
  const bam = (e) => {
    const r = e.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
    e.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerId: 1, isPrimary: true }));
    e.dispatchEvent(new MouseEvent('mousedown', o));
    e.dispatchEvent(new PointerEvent('pointerup', { ...o, pointerId: 1, isPrimary: true }));
    e.dispatchEvent(new MouseEvent('mouseup', o));
    e.dispatchEvent(new MouseEvent('click', o));
  };
  const LA_XOA = /^(delete|delete project|remove|move to trash|xoá|xóa|xoá dự án|xóa dự án|chuyển vào thùng rác)$/i;
  const boBieuTuong = (t) => t.replace(/\\b(delete|delete_forever|more_vert|more_horiz)\\b(?=\\s+\\S)/g, '').trim();
`;

/** Bước 1–2: tìm thẻ dự án đúng mã, mở menu của nó, bấm "Xoá". */
const BUOC_MENU = (ma) => `(async () => {
  ${CHUNG}
  const ma = ${JSON.stringify(ma)};
  const maCua = (a) => { const m = String(a.getAttribute('href') || '').match(/\\/project\\/([^/?#\\s]+)/); return m ? m[1] : ''; };
  const lienKet = [...document.querySelectorAll('a[href*="/project/"]')];
  const dung = lienKet.filter((a) => maCua(a) === ma);
  if (!dung.length) return { ok: false, buoc: 'tim-the', thay: lienKet.map(maCua).slice(0, 10) };
  // Thẻ = tổ tiên gần nhất có nút "tuỳ chọn", mà KHÔNG ôm liên kết tới dự án khác.
  const LA_NUT_MENU = /more_vert|more_horiz|more options|more actions|options|tuỳ chọn|tùy chọn|thêm thao tác|^⋮$|^…$/i;
  let the = null, nut = [];
  for (let e = dung[0]; e && e !== document.body; e = e.parentElement) {
    if (lienKet.some((a) => maCua(a) && maCua(a) !== ma && e.contains(a))) break;
    nut = [...e.querySelectorAll('button, [role="button"]')].filter((b) => LA_NUT_MENU.test(nhan(b)));
    if (nut.length) { the = e; break; }
  }
  if (!the) return { ok: false, buoc: 'nut-menu', lyDo: 'không thấy nút tuỳ chọn trong thẻ dự án',
    theDuAn: chu(dung[0].parentElement || dung[0]).slice(0, 80) };
  if (nut.length !== 1) return { ok: false, buoc: 'nut-menu', lyDo: 'thấy nhiều nút tuỳ chọn', nut: nut.map((b) => nhan(b).slice(0, 40)) };
  // Nút chỉ hiện khi rê chuột vào thẻ.
  the.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  the.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  await new Promise((r) => setTimeout(r, 400));
  bam(nut[0]);
  let muc = null;
  for (let i = 0; i < 15 && !muc; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const ds = [...document.querySelectorAll('[role="menuitem"], [role="option"], [role="menu"] button, .mat-mdc-menu-item')].filter(nhinThay);
    const khop = ds.filter((m) => LA_XOA.test(boBieuTuong(chu(m))) || LA_XOA.test(m.getAttribute('aria-label') || ''));
    if (khop.length === 1) muc = khop[0];
    else if (i === 14) return { ok: false, buoc: 'muc-xoa', lyDo: khop.length ? 'thấy nhiều mục Xoá' : 'menu không có mục Xoá',
      menu: ds.map((m) => chu(m).slice(0, 30)).slice(0, 12) };
  }
  bam(muc);
  return { ok: true };
})()`;

/** Bước 3: hộp xác nhận (nếu Flow hỏi lại). */
const BUOC_XAC_NHAN = `(async () => {
  ${CHUNG}
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const hop = [...document.querySelectorAll('[role="alertdialog"], [role="dialog"], mat-dialog-container, dialog[open]')].filter(nhinThay).pop();
    if (!hop) continue;
    const nut = [...hop.querySelectorAll('button, [role="button"]')].filter((b) => nhinThay(b) && LA_XOA.test(boBieuTuong(chu(b))));
    if (nut.length !== 1) return { ok: false, buoc: 'xac-nhan', lyDo: 'hộp xác nhận không có đúng một nút Xoá',
      nut: [...hop.querySelectorAll('button')].map((b) => chu(b).slice(0, 30)) };
    bam(nut[0]);
    return { ok: true, coHop: true };
  }
  return { ok: true, coHop: false };
})()`;

const CON_KHONG = (ma) => `(() => [...document.querySelectorAll('a[href*="/project/"]')]
  .some((a) => (String(a.getAttribute('href')).match(/\\/project\\/([^/?#\\s]+)/) || [])[1] === ${JSON.stringify(ma)}))()`;
const SO_LIEN_KET = `document.querySelectorAll('a[href*="/project/"]').length`;

/**
 * Xoá dự án Flow có địa chỉ `url` bằng một cửa sổ ẩn của đúng tài khoản.
 * @param o.taoCuaSo() → BrowserWindow ẩn (session của tài khoản)   o.dongCuaSo(w)
 * @param o.trangChu   địa chỉ trang chủ Flow     o.choMs (mặc định 25 s)
 * @returns {Promise<{ok:boolean, lyDo?:string, chiTiet?:object}>}
 */
async function xoaDuAnFlow(url, o) {
  const ma = maDuAn(url);
  if (!ma) return { ok: false, lyDo: 'Tài khoản chưa có dự án Flow nào được nhớ' };
  const w = o.taoCuaSo();
  const wc = w.webContents;
  const js = (code) => wc.executeJavaScript(code, true).catch((e) => ({ ok: false, lyDo: e.message }));
  const choTrangChu = async () => {
    // Trang chủ nạp danh sách dự án dần dần — chờ có liên kết dự án (hoặc hết giờ).
    const het = Date.now() + (o.choMs || 25000);
    while (Date.now() < het) {
      await cho(1000);
      if (!wc.isLoading() && (await js(SO_LIEN_KET)) > 0) { await cho(800); return true; }
    }
    return false;
  };
  try {
    wc.loadURL(o.trangChu).catch(() => {});
    if (!(await choTrangChu())) return { ok: false, lyDo: 'Trang chủ Flow không hiện danh sách dự án (chưa đăng nhập?)' };
    const b1 = await js(BUOC_MENU(ma));
    if (!b1 || !b1.ok) return { ok: false, lyDo: `Không tìm được nút xoá của dự án (bước ${b1 && b1.buoc})`, chiTiet: b1 };
    const b2 = await js(BUOC_XAC_NHAN);
    if (!b2 || !b2.ok) return { ok: false, lyDo: 'Không xác nhận được hộp "Xoá dự án"', chiTiet: b2 };
    // Kiểm lại: nạp lại trang chủ, liên kết tới dự án đó phải biến mất.
    await cho(2000);
    wc.loadURL(o.trangChu).catch(() => {});
    await choTrangChu();
    if (await js(CON_KHONG(ma))) return { ok: false, lyDo: 'Đã bấm Xoá nhưng dự án vẫn còn trên trang chủ Flow' };
    return { ok: true, ma };
  } finally {
    o.dongCuaSo(w);
  }
}

module.exports = { xoaDuAnFlow, maDuAn };
