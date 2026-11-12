'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  1.4.12 — DỌN DỮ LIỆU THỪA (Cài đặt → Dung lượng & dọn dẹp)
//
//  Người dùng 11/2026: "tool đang lưu ở ổ C nặng quá, nhất là ở phần roaming" — đo trên máy họ
//  (%APPDATA%\AIAutomationStudio): phần lớn là CACHE TRÌNH DUYỆT của từng phiên tài khoản
//  (Partitions/<nen>-<id>/Cache ≥77 MB mỗi phiên Muse, ≥310 MB mỗi phiên Flow, 19 phiên), rồi phiên của
//  tài khoản đã xoá, bộ cài cập nhật đã tải (82 MB), thư mục tạm của mẻ Flow, kết quả tạm, nhật ký cũ;
//  cạnh đó còn thư mục dữ liệu của các tool cũ đã gộp vào app.
//
//  Nguyên tắc: KHÔNG đụng đăng nhập (Network/ = cookie, Local Storage, IndexedDB, WebStorage, Session
//  Storage, Preferences), du-lieu.json, flow-engine.json, nhat-ky.txt, thư mục kết quả của người dùng.
//  Logic + đo ở đây chỉ dùng fs (bài kiểm chạy không cần Electron); phần dọn phiên đang mở (session API)
//  do main.js truyền vào qua o.donPhien.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

/** Thư mục CACHE trong một phiên trình duyệt (Partitions/<x>/ hoặc gốc userData) — xoá được, trang tự tạo lại. */
const THU_MUC_CACHE = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache',
  'ShaderCache', path.join('Shared Dictionary', 'cache'), path.join('Service Worker', 'CacheStorage'),
  path.join('Service Worker', 'ScriptCache')];
/** Không bao giờ xoá trong một phiên còn tài khoản (đăng nhập, dữ liệu trang). Chỉ để kiểm / ghi nhớ. */
const KHONG_DUNG = ['Network', 'Cookies', 'Local Storage', 'IndexedDB', 'WebStorage', 'Session Storage', 'Preferences'];
/** Thư mục dữ liệu của các tool cũ đã gộp vào AI Automation Studio (anh em trong %APPDATA%). */
const TOOL_CU = ['MuseAutomationStudio', 'Flow Automation Studio', 'Tool-flow-veo3', 'veo3-ai-studio'];
const CHAN_DOAN = ['chan-doan-flow', 'chan-doan-muse', 'chan-doan-drive'];
const CHAN_DOAN_GIU_MS = 7 * 24 * 3600 * 1000;

async function lstat(p) { try { return await fs.promises.lstat(p); } catch (_) { return null; } }
async function docThuMuc(p) { try { return await fs.promises.readdir(p, { withFileTypes: true }); } catch (_) { return []; } }

/** Dung lượng (byte) của file / thư mục, đệ quy; bỏ qua lối tắt và chỗ không đọc được (file khoá, thiếu quyền). */
async function dungLuong(p) {
  const st = await lstat(p);
  if (!st || st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  let tong = 0;
  for (const e of await docThuMuc(p)) tong += await dungLuong(path.join(p, e.name));
  return tong;
}

/** Xoá file / thư mục; xoá được tới đâu hay tới đó (file đang khoá trên Windows thì bỏ qua). → byte đã giải phóng. */
async function xoa(p, loi) {
  const truoc = await dungLuong(p);
  if (!truoc && !(await lstat(p))) return 0;
  try { await fs.promises.rm(p, { recursive: true, force: true, maxRetries: 2 }); } catch (err) {
    // Thư mục có file bị khoá: xoá từng phần còn xoá được.
    const st = await lstat(p);
    if (st && st.isDirectory()) for (const e of await docThuMuc(p)) await xoa(path.join(p, e.name), loi);
    if (loi) loi.push(`${path.basename(p)}: ${err.code || err.message}`);
  }
  return Math.max(0, truoc - await dungLuong(p));
}

/** Nội dung (con) của một thư mục, trừ tên trong `tru`. */
async function con(p, tru = []) {
  return (await docThuMuc(p)).filter((e) => !tru.includes(e.name)).map((e) => path.join(p, e.name));
}

/** Mọi file (đệ quy) trong thư mục. */
async function moiFile(p) {
  const ra = [];
  for (const e of await docThuMuc(p)) {
    const q = path.join(p, e.name);
    if (e.isDirectory()) ra.push(...await moiFile(q)); else if (e.isFile()) ra.push(q);
  }
  return ra;
}

const chuan = (p) => path.resolve(p).toLowerCase();

/**
 * Lập kế hoạch dọn: mỗi nhóm có danh sách mục. Mục `{ xoa: đường dẫn }` xoá bằng fs; mục `{ phien, thuMuc }` là
 * phiên ĐANG MỞ trong app (không xoá file của nó khi trình duyệt đang giữ — main.js dọn bằng session API).
 * @param o.userData, o.appData, o.thuMucChanDoan:[thư mục chẩn đoán], o.partitionCon:[partition của tài khoản còn
 *   trong app, vd 'persist:muse-tk-1'], o.phienMo(partition) → bool (phiên đã mở trong lần chạy này),
 *   o.giuCapNhat → null | 'het' (đang tải bản mới: không đụng cap-nhat) | đường dẫn file cài đang chờ cài,
 *   o.thamChieu:[đường dẫn các việc còn dùng], o.bayGio()
 */
async function keHoach(o) {
  const ud = o.userData;
  const bay = (o.bayGio || Date.now)();
  const phienCon = new Set((o.partitionCon || []).map((p) => String(p).replace(/^persist:/, '').toLowerCase()));
  const moPhien = o.phienMo || (() => false);
  const nhom = {
    cache: { khoa: 'cache', ten: 'Cache trình duyệt của các tài khoản và của app', macDinh: true, muc: [],
      moTa: 'Ảnh, video, mã trang Muse / Flow / Suno trình duyệt lưu sẵn để mở nhanh hơn. Xoá thì trang tự tải lại khi cần. Đăng nhập các tài khoản vẫn giữ nguyên.' },
    phienXoa: { khoa: 'phienXoa', ten: 'Phiên của tài khoản đã xoá', macDinh: true, muc: [], chiTiet: [],
      moTa: 'Dữ liệu trình duyệt (cả đăng nhập) của các tài khoản không còn trong app.' },
    tam: { khoa: 'tam', ten: 'File tạm', macDinh: true, muc: [], chiTiet: [],
      moTa: 'Bộ cài bản cập nhật đã tải, thư mục tải tạm của Flow / Suno, nhật ký cũ (nhat-ky-cu.txt), báo cáo lỗi của trình duyệt.' },
    ketQuaTam: { khoa: 'ketQuaTam', ten: 'Kết quả tạm không còn việc nào dùng', macDinh: true, muc: [],
      moTa: 'Ảnh / video lưu tạm khi tắt "Tải về máy" mà việc của nó đã bị xoá khỏi app. Kết quả của các việc còn trong danh sách được giữ.' },
    chanDoan: { khoa: 'chanDoan', ten: 'File chẩn đoán cũ hơn 7 ngày', macDinh: true, muc: [],
      moTa: 'Trang HTML app lưu lúc gặp lỗi (Tài liệu/AI Automation Studio/chan-doan-…) để gửi kèm khi báo lỗi.' },
    toolCu: { khoa: 'toolCu', ten: 'Dữ liệu tool cũ', macDinh: false, muc: [], chiTiet: [],
      moTa: 'Thư mục dữ liệu của Muse Automation Studio, Flow Automation Studio… (tool cũ đã gộp vào app này), gồm cả đăng nhập trong tool cũ. Chỉ chọn khi không dùng các tool đó nữa.' }
  };

  // a + b. Phiên trình duyệt: gốc userData (phiên mặc định — luôn đang mở) và từng Partitions/<x>.
  nhom.cache.muc.push({ phien: '', thuMuc: ud });
  const goc = path.join(ud, 'Partitions');
  for (const e of await docThuMuc(goc)) {
    if (!e.isDirectory()) continue;
    const thuMuc = path.join(goc, e.name), partition = `persist:${e.name}`;
    if (!phienCon.has(e.name.toLowerCase())) {
      nhom.phienXoa.muc.push({ xoa: thuMuc, phien: partition });
      nhom.phienXoa.chiTiet.push(e.name);
    } else if (moPhien(partition)) nhom.cache.muc.push({ phien: partition, thuMuc });
    else for (const c of THU_MUC_CACHE) nhom.cache.muc.push({ xoa: path.join(thuMuc, c) });
  }

  // c. File tạm.
  if (o.giuCapNhat !== 'het') {
    const giu = o.giuCapNhat ? path.basename(o.giuCapNhat) : null;
    for (const p of await con(path.join(ud, 'cap-nhat'), giu ? [giu] : [])) nhom.tam.muc.push({ xoa: p });
  }
  // flow-tai-tam/<tab>/… : xoá phần bên trong, giữ thư mục của tab (tab còn mở ghi tải về vào đó).
  for (const tab of await con(path.join(ud, 'flow-tai-tam'))) {
    const st = await lstat(tab);
    if (st && st.isDirectory()) for (const p of await con(tab)) nhom.tam.muc.push({ xoa: p });
    else nhom.tam.muc.push({ xoa: tab });
  }
  for (const p of await con(path.join(ud, 'suno-tai-tam'))) nhom.tam.muc.push({ xoa: p });
  nhom.tam.muc.push({ xoa: path.join(ud, 'nhat-ky-cu.txt') });
  for (const c of ['reports', 'completed', 'pending']) for (const p of await con(path.join(ud, 'Crashpad', c))) nhom.tam.muc.push({ xoa: p });

  // d. Kết quả tạm: chỉ file KHÔNG việc nào còn trỏ tới (j.files / thamChieu) — file của việc còn trong app là bản
  // duy nhất (tắt "Tải về máy"), Thư viện / nối video / Tải về hàng loạt còn dùng.
  const dung = new Set((o.thamChieu || []).filter(Boolean).map(chuan));
  for (const f of await moiFile(path.join(ud, 'ket-qua-tam'))) if (!dung.has(chuan(f))) nhom.ketQuaTam.muc.push({ xoa: f });

  // f. Chẩn đoán cũ hơn 7 ngày.
  for (const d of o.thuMucChanDoan || []) {
    for (const f of await moiFile(d)) {
      const st = await lstat(f);
      if (st && bay - st.mtimeMs > CHAN_DOAN_GIU_MS) nhom.chanDoan.muc.push({ xoa: f });
    }
  }

  // e. Tool cũ (thư mục anh em trong %APPDATA%), chỉ cái đang có.
  if (o.appData) {
    for (const ten of TOOL_CU) {
      const p = path.join(o.appData, ten);
      if (chuan(p) === chuan(ud)) continue;
      const st = await lstat(p);
      if (st && st.isDirectory()) { nhom.toolCu.muc.push({ xoa: p }); nhom.toolCu.chiTiet.push(ten); }
    }
  }
  return Object.values(nhom);
}

/** Byte của một mục (phiên đang mở: chỉ tính các thư mục cache của nó). */
async function doMuc(m) {
  if (m.xoa) return dungLuong(m.xoa);
  let t = 0;
  for (const c of THU_MUC_CACHE) t += await dungLuong(path.join(m.thuMuc, c));
  return t;
}

/** Đo: { nhom:[{khoa, ten, moTa, bytes, macDinh, chiTiet?}], tong (cả thư mục dữ liệu), thuMuc } */
async function docDungLuong(o) {
  const ds = await keHoach(o);
  const nhom = [];
  for (const n of ds) {
    let bytes = 0;
    for (const m of n.muc) bytes += await doMuc(m);
    nhom.push({ khoa: n.khoa, ten: n.ten, moTa: n.moTa, bytes, macDinh: n.macDinh, ...(n.chiTiet ? { chiTiet: n.chiTiet } : {}) });
  }
  return { nhom, tong: await dungLuong(o.userData), thuMuc: o.userData };
}

/**
 * Dọn các nhóm đã chọn. o.donPhien(partition) dọn cache của phiên đang mở bằng session API ('' = phiên mặc định).
 * @returns { ok, daDon, tungNhom:{khoa: byte}, loi:[…] }
 */
async function donDuLieu(o, khoaChon) {
  const chon = new Set(khoaChon || []);
  const ds = await keHoach(o);
  const tungNhom = {}, loi = [];
  let daDon = 0;
  for (const n of ds) {
    if (!chon.has(n.khoa)) continue;
    let b = 0;
    for (const m of n.muc) {
      if (m.xoa) { b += await xoa(m.xoa, loi); continue; }
      const truoc = await doMuc(m);
      try { if (o.donPhien) await o.donPhien(m.phien); } catch (err) { loi.push(`${m.phien || 'app'}: ${err.message}`); }
      b += Math.max(0, truoc - await doMuc(m));
    }
    // Kết quả tạm: bỏ thư mục con đã trống.
    if (n.khoa === 'ketQuaTam') await xoaThuMucTrong(path.join(o.userData, 'ket-qua-tam'), false);
    tungNhom[n.khoa] = b;
    daDon += b;
  }
  return { ok: true, daDon, tungNhom, loi };
}

async function xoaThuMucTrong(p, xoaChinhNo) {
  for (const e of await docThuMuc(p)) if (e.isDirectory()) await xoaThuMucTrong(path.join(p, e.name), true);
  if (xoaChinhNo && !(await docThuMuc(p)).length) { try { await fs.promises.rmdir(p); } catch (_) {} }
}

/** "1,2 GB" / "350 MB" / "12 KB" kiểu Việt. */
function chuDungLuong(b) {
  const f = (x, n) => x.toFixed(n).replace('.', ',');
  if (b >= 1e9) return `${f(b / 1e9, 1)} GB`;
  if (b >= 1e6) return `${f(b / 1e6, b >= 1e8 ? 0 : 1)} MB`;
  if (b >= 1e3) return `${Math.round(b / 1e3)} KB`;
  return `${b} B`;
}

module.exports = { docDungLuong, donDuLieu, keHoach, dungLuong, chuDungLuong, THU_MUC_CACHE, KHONG_DUNG, TOOL_CU, CHAN_DOAN };
