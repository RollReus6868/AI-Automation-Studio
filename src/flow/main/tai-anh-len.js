'use strict';

// ============================================================================
//  tai-anh-len.js — đưa ảnh lên kho Flow khi cách của engine không ăn (1.2.1)
//  --------------------------------------------------------------------------
//  Phần trong trang: src/flow/inject/flow-tai-anh.js (đọc đầu file đó để biết triệu chứng).
//  Đi lần lượt, dừng ngay khi một cách ăn:
//    1. ô <input type=file> có sẵn trong trang → đặt file thật vào ô (DOM.setFileInputFiles);
//    2. mở menu [+] / tab Hình ảnh / bấm "Tải lên" — Flow mở hộp chọn file → app chặn hộp đó
//       (Page.setInterceptFileChooserDialog) và đặt file thật vào đúng ô trang vừa mở;
//    3. kéo-thả file thật vào ô nhập prompt (Input.dispatchDragEvent).
//  Bấm qua Runtime.evaluate có userGesture (trang chỉ mở hộp chọn file khi có thao tác người dùng),
//  chạy được cả khi tab đang ẩn. File phải mang đúng tên mã việc (vd 371_68b883.png): Flow đặt tên
//  ảnh trong kho theo tên file, engine gắn ảnh vào prompt bằng @tên đó.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { ensureDebugger } = require('./paste');

const NGUON = fs.readFileSync(path.join(__dirname, '..', 'inject', 'flow-tai-anh.js'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param wc     webContents của tab Flow
 * @param files  [đường dẫn tuyệt đối] — tên file = tên muốn có trong kho Flow
 * @param tuy    { choMs: chờ hộp chọn file sau mỗi cú bấm (mặc định 1500),
 *                 dongY: được bấm "Tôi đồng ý" ở hộp "Quyền sử dụng hình ảnh này" (Cài đặt → Google Flow),
 *                 xemMs: chờ bao lâu để xem Flow có mở hộp thoại sau khi nhận file (mặc định 2500) }
 * @returns {Promise<{ok, cach?, chacChan?, buoc:[], loi?, chanDoan?, canDongY?, dongY?, sauTai?}>}
 *   cach: 'o-tai-len' | 'hop-chon-file' | 'keo-tha'; chacChan=false với kéo-thả (không biết trang có nhận)
 */
async function taiAnhLen(wc, files, tuy = {}) {
  const buoc = [];
  if (!files || !files.length) return { ok: false, buoc, loi: 'không có ảnh' };
  if (!wc || wc.isDestroyed()) return { ok: false, buoc, loi: 'tab Flow đã đóng' };
  if (!ensureDebugger(wc)) return { ok: false, buoc, loi: 'không bật được kênh debugger' };
  const dbg = wc.debugger;
  const goi = (lenh, thamSo) => dbg.sendCommand(lenh, thamSo || {});
  const chay = async (bieuThuc, giuDoiTuong = false) => {
    const r = await goi('Runtime.evaluate', { expression: bieuThuc, userGesture: true, awaitPromise: true, returnByValue: !giuDoiTuong });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result;
  };
  const choMs = tuy.choMs || 1500;

  let hop = null;
  const nghe = (_e, method, params) => { if (method === 'Page.fileChooserOpened') hop = params; };
  dbg.on('message', nghe);
  let batChan = false;
  try {
    await chay(NGUON);
    await goi('Page.enable');
    await goi('Page.setInterceptFileChooserDialog', { enabled: true });
    batChan = true;

    const vaoInput = async () => {
      const r = await chay('window.__flowTaiAnh.timInput()', true);
      if (!r || !r.objectId || r.subtype === 'null') return false;
      await goi('DOM.setFileInputFiles', { files, objectId: r.objectId });
      return true;
    };
    const vaoHop = async (ms) => {
      const het = Date.now() + ms;
      while (!hop && Date.now() < het) await wait(100);
      if (!hop) return false;
      await goi('DOM.setFileInputFiles', { files, backendNodeId: hop.backendNodeId });
      return true;
    };
    // File đã vào: chờ một lúc xem Flow có hiện hộp thoại / thông báo gì không (1.3.2) — ghi vào kết quả cho nhật ký.
    const xemSauTai = async () => {
      const het = Date.now() + (tuy.xemMs == null ? 2500 : tuy.xemMs);
      let tb = [];
      do {
        await wait(500);
        const r = await chay('window.__flowTaiAnh.sauTai()').then((x) => x.value).catch(() => null);
        if (r && r.hop) return { hop: r.hop, thongBao: r.thongBao || [] };
        if (r && r.thongBao && r.thongBao.length) tb = r.thongBao;
      } while (Date.now() < het);
      return tb.length ? { hop: null, thongBao: tb } : null;
    };
    // Hộp "Quyền sử dụng hình ảnh này": ảnh chỉ vào kho khi bấm "Tôi đồng ý". Chỉ bấm khi người dùng cho phép
    // (tuy.dongY — Cài đặt → Google Flow); không thì báo ngay, khỏi chờ kho 60 giây vô ích.
    const xemDongY = async () => {
      const het = Date.now() + (tuy.xemMs == null ? 2500 : tuy.xemMs);
      let h = null;
      do {
        await wait(400);
        h = await chay('window.__flowTaiAnh.hopDongY()').then((x) => x.value).catch(() => null);
      } while (!(h && h.co) && Date.now() < het);
      if (!(h && h.co)) return null;
      if (!tuy.dongY) return { canDongY: true, tieuDe: h.tieuDe };
      const b = await chay('window.__flowTaiAnh.bamDongY()').then((x) => x.value).catch((e) => ({ ok: false, lyDo: e.message }));
      for (let i = 0; i < 12 && b && b.ok; i++) {
        await wait(400);
        const con = await chay('window.__flowTaiAnh.hopDongY()').then((x) => x.value).catch(() => null);
        if (!(con && con.co)) return { daDongY: true, tieuDe: h.tieuDe };
      }
      return { canDongY: true, tieuDe: h.tieuDe, loiBam: (b && b.lyDo) || 'bấm rồi mà hộp vẫn mở' };
    };
    const ketQua = async (cach, chacChan = true) => {
      const dy = await xemDongY();
      if (dy && dy.canDongY) {
        return { ok: false, cach, buoc, canDongY: true, dongY: dy,
          loi: `Flow hỏi "${dy.tieuDe || 'Quyền sử dụng hình ảnh này'}" — ảnh chỉ vào kho khi bấm "Tôi đồng ý"` + (dy.loiBam ? ` (app bấm hỏng: ${dy.loiBam})` : '') };
      }
      return { ok: true, cach, chacChan, buoc, dongY: dy, sauTai: dy ? null : await xemSauTai() };
    };

    if (await vaoInput()) return await ketQua('o-tai-len');
    // Mục "Tải lên" đã hiện (engine vừa mở menu [+]) → bấm luôn; chưa thì mở menu, tab Hình ảnh, rồi bấm.
    for (const b of ['bamTaiLen', 'moMenu', 'bamTaiLen', 'moTabAnh', 'bamTaiLen']) {
      const r = await chay(`window.__flowTaiAnh.${b}()`).then((x) => x.value).catch((e) => ({ ok: false, loi: e.message }));
      if (!r || !r.ok) continue;
      buoc.push(`${b}: ${r.nut || ''}`);
      if (await vaoHop(b === 'bamTaiLen' ? choMs * 2 : choMs)) return await ketQua('hop-chon-file');
      if (await vaoInput()) return await ketQua('o-tai-len');
    }

    // Kéo-thả file thật vào ô nhập prompt.
    await chay('window.__flowTaiAnh.dongMenu()').catch(() => {});
    await wait(300);
    const v = (await chay('window.__flowTaiAnh.viTriTha()')).value;
    if (v && v.ok) {
      const data = { items: [], files, dragOperationsMask: 1 };
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await goi('Input.dispatchDragEvent', { type, x: v.x, y: v.y, data });
        await wait(type === 'drop' ? 400 : 80);
      }
      buoc.push(`kéo-thả vào ô nhập (${v.x}, ${v.y})`);
      const cd = (await chay('window.__flowTaiAnh.chanDoan()').catch(() => null)) || {};
      return { ...(await ketQua('keo-tha', false)), chanDoan: cd.value };
    }
    const cd = (await chay('window.__flowTaiAnh.chanDoan()').catch(() => null)) || {};
    return { ok: false, buoc, loi: 'không thấy ô tải lên, nút Tải lên hay ô nhập prompt', chanDoan: cd.value };
  } catch (err) {
    return { ok: false, buoc, loi: err.message };
  } finally {
    dbg.removeListener('message', nghe);
    if (batChan) await goi('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {});
    if (!wc.isDestroyed()) await wc.executeJavaScript('window.__flowTaiAnh && window.__flowTaiAnh.dongMenu()', true).catch(() => {});
  }
}

/** Một dòng nhật ký cho thứ Flow hiện ngay sau khi nhận file (hộp thoại / thông báo) — rỗng nếu không có gì. */
function moTaSauTai(st) {
  if (!st) return '';
  const p = [];
  if (st.hop) p.push(`hộp thoại "${st.hop.chu}"${st.hop.nut && st.hop.nut.length ? ` (nút: ${st.hop.nut.join(' · ')})` : ''}`);
  if (st.thongBao && st.thongBao.length) p.push(`thông báo "${st.thongBao.join('" · "')}"`);
  return p.join('; ');
}

/** Một dòng nhật ký cho kết quả chẩn đoán (nút quanh ô nhập) — để lần sau biết Flow đổi gì. */
function moTaChanDoan(cd) {
  if (!cd) return '';
  return `ô nhập ${cd.oNhap ? 'có' : 'KHÔNG thấy'}, ${cd.soInput} ô chọn file, nút: ${(cd.nut || []).join(' · ') || '(không có)'}`;
}

module.exports = { taiAnhLen, moTaChanDoan, moTaSauTai };
