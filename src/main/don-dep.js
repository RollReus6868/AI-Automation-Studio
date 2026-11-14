'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  don-dep.js — 1.4.12: DỌN DỮ LIỆU THỪA của app (người dùng: "tool đang lưu ở ổ C nặng quá, nhất là ở
//  C:\Users\…\AppData\Roaming\AIAutomationStudio").
//
//  Đo thật (Electron 33, app chạy trang giả): thư mục dữ liệu = userData của Electron:
//    Partitions/<nen>-<id>/   một phiên đăng nhập / tài khoản ('persist:<nen>-<id>' → tên thư mục bỏ "persist:")
//      Cache/Cache_Data, Code Cache/{js,wasm}, GPUCache, DawnGraphiteCache, DawnWebGPUCache,
//      Service Worker/CacheStorage                     ← BỘ NHỚ ĐỆM: phình theo số trang đã mở, tự tải lại được
//      Cookies (+ Network/Cookies trên Windows), Local Storage, Session Storage, IndexedDB, WebStorage,
//      Service Worker/{Database,ScriptCache}, Preferences … ← ĐĂNG NHẬP / dữ liệu trang: KHÔNG đụng
//    Cache, Code Cache, GPUCache, Dawn*Cache          bộ nhớ đệm của phiên mặc định (giao diện app)
//    Crashpad/{completed,pending,new}                 báo lỗi (crash) cũ
//    du-lieu.json (+ .hong-<giờ> = bản hỏng app đã thay), flow-engine.json, nhat-ky.txt, nhat-ky-cu.txt
//    suno-tai-tam, flow-tai-tam, drive-tam, ket-qua-tam/<duAn>  file tạm (ket-qua-tam: khi tắt "Tải về" đây là
//                                                     bản DUY NHẤT của kết quả → chỉ xoá file không việc nào trỏ tới)
//    cap-nhat/                                        bộ cài bản mới đã tải
//    nhan-vat/                                        ảnh nhân vật của người dùng — KHÔNG dọn
//  Ngoài userData: Tài liệu/AI Automation Studio/chan-doan-{flow,muse,drive} (HTML trang lúc lỗi).
//
//  Module thuần (đường dẫn truyền vào, không cần Electron): quet() đo từng mục, donDep() xoá trên đĩa. Phiên
//  đang mở (cửa sổ / luồng còn chạy, giao diện app) KHÔNG xoá file trên đĩa — main.js dọn qua API phiên Electron
//  (clearCache, clearCodeCaches, clearStorageData shadercache + cachestorage) — giữ nguyên đăng nhập.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

/** Thư mục bộ nhớ đệm trong một phiên (tương đối). Đăng nhập (Cookies, Local Storage, IndexedDB…) không nằm đây. */
const CACHE_PHIEN = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache',
  'ShaderCache', path.join('Service Worker', 'CacheStorage')];
const TAM = ['suno-tai-tam', 'flow-tai-tam', 'drive-tam'];
const MOI_MS = 30 * 60000;   // file / thư mục tạm mới đổi trong 30 phút: có thể đang dùng (đang tải) → để yên

const chuan = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
const tenPhien = (partition) => String(partition || '').replace(/^persist:/, '');
const slugDuAn = (id) => String(id || 'chung').replace(/[^\w-]/g, '_');

/** Dung lượng (byte) của file / thư mục (đệ quy, không theo liên kết). Lỗi đọc → bỏ qua. */
async function dungLuong(p) {
  let st;
  try { st = await fs.promises.lstat(p); } catch (_) { return 0; }
  if (!st.isDirectory()) return st.size;
  let tong = 0, ds = [];
  try { ds = await fs.promises.readdir(p); } catch (_) { return 0; }
  for (const t of ds) tong += await dungLuong(path.join(p, t));
  return tong;
}

/** Mọi đường dẫn file bên trong (để so với file việc còn trỏ tới). */
async function moiFile(p, ra = []) {
  let st;
  try { st = await fs.promises.lstat(p); } catch (_) { return ra; }
  if (!st.isDirectory()) { ra.push(p); return ra; }
  let ds = [];
  try { ds = await fs.promises.readdir(p); } catch (_) { return ra; }
  for (const t of ds) await moiFile(path.join(p, t), ra);
  return ra;
}

async function lsDs(p) { try { return await fs.promises.readdir(p); } catch (_) { return []; } }
/** Lúc đổi gần nhất: file → mtime; thư mục → file mới nhất bên trong (đang tải là đang ghi file), trống → mtime của nó. */
async function moiDoi(p) {
  let st;
  try { st = await fs.promises.lstat(p); } catch (_) { return 0; }
  if (!st.isDirectory()) return st.mtimeMs;
  const files = await moiFile(p);
  if (!files.length) return st.mtimeMs;
  let m = 0;
  for (const f of files) { try { m = Math.max(m, (await fs.promises.lstat(f)).mtimeMs); } catch (_) {} }
  return m;
}

/** "1.4.11" → [1,4,11]; so sánh phiên bản. */
const soBan = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
function nhoHonHoacBang(a, b) {
  const x = soBan(a), y = soBan(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); }
  return true;
}

/**
 * Đo từng mục có thể dọn.
 * @param o.userData       thư mục dữ liệu của app
 * @param o.partitions     partition của các tài khoản CÒN trong danh sách ('persist:muse-tk-1'…)
 * @param o.dangMo         thư mục phiên đang mở (session.storagePath của cửa sổ / luồng đang chạy + phiên mặc định)
 * @param o.fileViec       file việc còn trỏ tới (j.files, j.thamChieu) — không bao giờ xoá
 * @param o.duAnIds        id dự án còn tồn tại
 * @param o.thuMucChanDoan thư mục file chẩn đoán (chan-doan-flow, -muse, -drive)
 * @param o.phienBan       phiên bản app đang chạy (bộ cài ≤ bản này là thừa)
 * @param o.bayGio, o.moiMs đồng hồ (bài kiểm), ngưỡng "mới đổi"
 * @returns { userData, tong, duLieuJson, nhanVat, muc:[{ma, ten, moTa, byte, soMuc, macDinh, xoa:[đường dẫn], api:[thư mục phiên đang mở]}] }
 */
async function quet(o) {
  const ud = o.userData;
  const bay = o.bayGio || Date.now(), moiMs = o.moiMs == null ? MOI_MS : o.moiMs;
  const giuPhien = new Set((o.partitions || []).map((p) => chuan(path.join(ud, 'Partitions', tenPhien(p)))));
  const dangMo = new Set((o.dangMo || []).filter(Boolean).map(chuan));
  dangMo.add(chuan(ud));   // phiên mặc định (giao diện app) luôn đang mở
  const fileViec = new Set((o.fileViec || []).filter(Boolean).map(chuan));
  const duAn = new Set((o.duAnIds || []).map(slugDuAn));
  const muc = [];
  const them = (m) => { m.byte = m.byte || 0; muc.push(m); return m; };

  // a. Bộ nhớ đệm của các phiên còn dùng (tài khoản còn trong danh sách + phiên mặc định).
  const cache = them({ ma: 'cache', ten: 'Bộ nhớ đệm trang web của các tài khoản',
    moTa: 'Ảnh, script, video các trang Muse / Flow / Suno đã mở được lưu tạm. Không đăng xuất tài khoản — trang tự tải lại khi cần.',
    macDinh: true, xoa: [], api: [], soMuc: 0 });
  const phienDir = path.join(ud, 'Partitions');
  const dsPhien = (await lsDs(phienDir)).map((t) => path.join(phienDir, t));
  for (const goc of [ud, ...dsPhien.filter((p) => giuPhien.has(chuan(p)))]) {
    let co = 0;
    for (const t of CACHE_PHIEN) {
      const p = path.join(goc, t), b = await dungLuong(p);
      if (!b) continue;
      cache.byte += b; co++;
      if (!dangMo.has(chuan(goc))) cache.xoa.push(p);
    }
    if (co && dangMo.has(chuan(goc))) cache.api.push(goc);
    if (co) cache.soMuc++;
  }

  // b. Phiên của tài khoản đã xoá (thư mục Partitions/* không ứng với tài khoản nào).
  const moCoi = them({ ma: 'phien-cu', ten: 'Dữ liệu đăng nhập của tài khoản đã xoá',
    moTa: 'Thư mục phiên của những tài khoản không còn trong mục Tài khoản.', macDinh: true, xoa: [], soMuc: 0 });
  for (const p of dsPhien) {
    if (giuPhien.has(chuan(p))) continue;
    moCoi.byte += await dungLuong(p); moCoi.xoa.push(p); moCoi.soMuc++;
  }

  // c. File tạm — bỏ qua thứ vừa đổi (đang tải) và file việc còn trỏ tới.
  const tam = them({ ma: 'tam', ten: 'File tạm', moTa: 'File tải tạm của Suno / Flow / Drive và kết quả tạm không còn việc nào dùng (giữ nguyên kết quả của các việc trong app).',
    macDinh: true, xoa: [], soMuc: 0 });
  const themTam = async (p) => {
    if (bay - (await moiDoi(p)) < moiMs) return;
    const files = await moiFile(p);
    if (files.some((f) => fileViec.has(chuan(f)))) {
      // Thư mục có file còn dùng → chỉ xét từng mục con.
      const st = await fs.promises.lstat(p).catch(() => null);
      if (st && st.isDirectory()) for (const t of await lsDs(p)) await themTam(path.join(p, t));
      return;
    }
    tam.byte += await dungLuong(p); tam.xoa.push(p); tam.soMuc++;
  };
  for (const ten of TAM) for (const t of await lsDs(path.join(ud, ten))) await themTam(path.join(ud, ten, t));
  const kqTam = path.join(ud, 'ket-qua-tam');
  for (const t of await lsDs(kqTam)) {
    const p = path.join(kqTam, t);
    if (!duAn.has(t)) { await themTam(p); continue; }     // dự án đã xoá: cả thư mục (trừ file còn trỏ tới)
    for (const f of await moiFile(p)) if (!fileViec.has(chuan(f))) await themTam(f);
  }

  // d. Nhật ký cũ (giữ nhat-ky.txt đang ghi).
  const nk = them({ ma: 'nhat-ky-cu', ten: 'Nhật ký cũ', moTa: 'nhat-ky-cu.txt — bản nhật ký trước khi app bắt đầu file mới (giữ nhật ký đang ghi).',
    macDinh: true, xoa: [], soMuc: 0 });
  for (const t of await lsDs(ud)) if (/^nhat-ky-cu.*\.txt$/i.test(t)) { const p = path.join(ud, t); nk.byte += await dungLuong(p); nk.xoa.push(p); nk.soMuc++; }

  // e. File chẩn đoán (HTML trang lúc lỗi).
  const cd = them({ ma: 'chan-doan', ten: 'File chẩn đoán lỗi', moTa: 'Trang Muse / Flow / Drive chụp lại lúc lỗi (thư mục chan-doan-…), chỉ dùng khi gửi báo lỗi.',
    macDinh: true, xoa: [], soMuc: 0 });
  for (const d of o.thuMucChanDoan || []) for (const t of await lsDs(d)) { const p = path.join(d, t); cd.byte += await dungLuong(p); cd.xoa.push(p); cd.soMuc++; }

  // f. Bộ cài bản cập nhật đã cài rồi (phiên bản ≤ bản đang chạy) + file dở cũ.
  const cn = them({ ma: 'cap-nhat', ten: 'Bộ cài bản cập nhật cũ', moTa: 'Bộ cài các bản đã cài xong (giữ bộ cài của bản mới đang chờ cài).',
    macDinh: true, xoa: [], soMuc: 0 });
  const cnDir = path.join(ud, 'cap-nhat');
  for (const t of await lsDs(cnDir)) {
    const p = path.join(cnDir, t), v = (t.match(/(\d+\.\d+\.\d+)/) || [])[1];
    const thua = v ? nhoHonHoacBang(v, o.phienBan) : !/\.(sh|log)$/i.test(t) && bay - (await moiDoi(p)) >= moiMs;
    if (thua) { cn.byte += await dungLuong(p); cn.xoa.push(p); cn.soMuc++; }
  }

  // g. Báo lỗi (crash) cũ + bản dữ liệu hỏng app đã thay bằng bản mới.
  const bl = them({ ma: 'bao-loi', ten: 'Báo lỗi cũ và bản dữ liệu hỏng', moTa: 'Báo lỗi (crash) cũ và bản du-lieu.json hỏng mà app đã thay bằng bản mới lúc mở.',
    macDinh: true, xoa: [], soMuc: 0 });
  for (const t of ['completed', 'pending', 'new']) for (const f of await lsDs(path.join(ud, 'Crashpad', t))) {
    const p = path.join(ud, 'Crashpad', t, f); bl.byte += await dungLuong(p); bl.xoa.push(p); bl.soMuc++;
  }
  for (const t of await lsDs(ud)) if (/\.json\.hong-\d+$/.test(t)) { const p = path.join(ud, t); bl.byte += await dungLuong(p); bl.xoa.push(p); bl.soMuc++; }

  return {
    userData: ud, tong: await dungLuong(ud),
    duLieuJson: await dungLuong(path.join(ud, 'du-lieu.json')) + await dungLuong(path.join(ud, 'flow-engine.json')),
    nhanVat: await dungLuong(path.join(ud, 'nhan-vat')),
    muc
  };
}

/**
 * Xoá trên đĩa các mục đã chọn (chỉ đường dẫn quet() đã liệt kê trong `xoa` — phiên đang mở không có ở đây).
 * File khoá (Windows đang dùng) → bỏ qua, đếm vào `khongXoa`.
 * @returns { daXoa, khongXoa, loi:[] }
 */
async function donDep(kq, maDs) {
  const chon = new Set(maDs || []);
  let daXoa = 0, khongXoa = 0;
  const loi = [];
  for (const m of kq.muc) {
    if (!chon.has(m.ma)) continue;
    for (const p of m.xoa || []) {
      try { await fs.promises.rm(p, { recursive: true, force: true, maxRetries: 2 }); } catch (err) { loi.push(`${path.basename(p)}: ${err.code || err.message}`); }
      if (fs.existsSync(p)) khongXoa++; else daXoa++;
    }
  }
  return { daXoa, khongXoa, loi: loi.slice(0, 20) };
}

/** Như slugThuMuc ở main.js (tên thư mục tải tạm của tab Flow: `${tk.id}-${duAnId}-${stt}`). */
const slugThuMuc = (x) => String(x).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60);
const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 1.4.14 — dữ liệu tạm của MỘT dự án vừa xoá (người dùng: "khi xoá dự án thì tự dọn dữ liệu thừa của dự án đó luôn").
 *   a. ket-qua-tam/<dự án>   kết quả giữ tạm khi tắt "Tải về" (đã lên Drive) — bản duy nhất trên máy → báo số file
 *   b. flow-tai-tam/<tk>-<dự án>-<số tab>   file Flow tải dở của các tab chạy dự án này (khớp đúng mẫu tên, không khớp
 *      nhầm dự án "du-an-1" khi xoá "du-an")
 *   c. file của các việc trong dự án nằm trong thư mục tạm của app (suno-tai-tam, drive-tam…)
 * File mà việc của dự án KHÁC còn trỏ tới (o.fileConDung) không bao giờ xoá. Không đụng thư mục kết quả của người dùng.
 * @param o.userData, o.duAnId, o.tkIds (id mọi tài khoản), o.fileDuAn (j.files + j.thamChieu của việc trong dự án),
 *        o.fileConDung (của việc còn lại)
 * @returns {{xoa:string[], byte:number, soKetQua:number}}
 */
async function thuDuAn(o) {
  const ud = o.userData, giu = new Set((o.fileConDung || []).filter(Boolean).map(chuan));
  const ra = { xoa: [], byte: 0, soKetQua: 0 };
  const daCo = (p) => { const c = chuan(p); return ra.xoa.some((x) => { const g = chuan(x); return c === g || c.startsWith(g + path.sep); }); };
  const them = async (p) => { if (daCo(p)) return; ra.byte += await dungLuong(p); ra.xoa.push(p); };
  /** Thư mục: xoá cả thư mục nếu không chứa file còn dùng, không thì từng file không dùng. Trả số file sẽ xoá. */
  const themThuMuc = async (dir) => {
    const files = await moiFile(dir);
    const bo = files.filter((f) => !giu.has(chuan(f)));
    if (bo.length === files.length) { if (fs.existsSync(dir)) await them(dir); } else for (const f of bo) await them(f);
    return bo.length;
  };
  ra.soKetQua = await themThuMuc(path.join(ud, 'ket-qua-tam', slugDuAn(o.duAnId)));
  const mau = new RegExp(`^(${(o.tkIds || []).map((t) => escRe(slugThuMuc(t))).join('|') || '\\0'})-${escRe(slugThuMuc(o.duAnId))}-\\d+$`);
  for (const t of await lsDs(path.join(ud, 'flow-tai-tam'))) if (mau.test(t)) await themThuMuc(path.join(ud, 'flow-tai-tam', t));
  const goc = [...TAM, 'ket-qua-tam'].map((t) => chuan(path.join(ud, t)) + path.sep);
  for (const f of new Set((o.fileDuAn || []).filter((x) => typeof x === 'string' && x))) {
    const c = chuan(f);
    if (goc.some((g) => c.startsWith(g)) && !giu.has(c) && fs.existsSync(f)) await them(f);
  }
  return ra;
}

/** Xoá danh sách đường dẫn (file khoá → bỏ qua). */
async function xoaDs(ds) {
  let daXoa = 0, khongXoa = 0;
  for (const p of ds || []) {
    try { await fs.promises.rm(p, { recursive: true, force: true, maxRetries: 2 }); } catch (_) {}
    if (fs.existsSync(p)) khongXoa++; else daXoa++;
  }
  return { daXoa, khongXoa };
}

/** Bản gửi giao diện: bỏ danh sách đường dẫn. */
const tomTat = (kq) => ({ userData: kq.userData, tong: kq.tong, duLieuJson: kq.duLieuJson, nhanVat: kq.nhanVat,
  muc: kq.muc.map(({ ma, ten, moTa, byte, soMuc, macDinh }) => ({ ma, ten, moTa, byte, soMuc, macDinh })) });

/** 1536 → "1,5 KB"; GB có một số lẻ. */
function docByte(b) {
  const n = Number(b) || 0;
  const [don, chia] = n >= 1024 ** 3 ? ['GB', 1024 ** 3] : n >= 1024 ** 2 ? ['MB', 1024 ** 2] : n >= 1024 ? ['KB', 1024] : ['byte', 1];
  const x = n / chia;
  return `${chia === 1 ? x : x.toFixed(x >= 100 ? 0 : 1).replace('.', ',')} ${don}`;
}

module.exports = { quet, donDep, tomTat, docByte, dungLuong, CACHE_PHIEN, tenPhien, thuDuAn, xoaDs, slugThuMuc };
