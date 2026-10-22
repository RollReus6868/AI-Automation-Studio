'use strict';
// ============================================================================
//  drive.js — 1.4.0: ĐƯA ẢNH / VIDEO LÊN GOOGLE DRIVE
//
//  Cách làm: chép file vào THƯ MỤC Google Drive trên máy (ứng dụng "Google Drive cho máy tính" — Drive for
//  desktop — người dùng tự cài và đăng nhập sẵn, thường là ổ G:\My Drive hoặc G:\Drive của tôi). Drive tự tải
//  lên, tự tải lại khi rớt mạng; app không đăng nhập Google, không giữ mật khẩu / token nào.
//
//  Cấu trúc: <thư mục Drive>/<Tên dự án>/images/<tên file>   (ảnh)
//            <thư mục Drive>/<Tên dự án>/Videos/<tên file>   (video)
//  Không ghi đè file khác cùng tên (thêm " (2)"); file Drive cũ của CHÍNH việc đó (Tạo lại) thì ghi đè.
//  1.4.1: tên trên Drive theo mẫu tên của việc (o.ten), không theo tên file trên máy (có thể đã thành "001 (2).jpg").
// ============================================================================

const fs = require('fs');
const path = require('path');

const THU_MUC_LOAI = { anh: 'images', video: 'Videos' };

/** Tên thư mục dự án trên Drive: giữ nguyên tên (cả tiếng Việt), chỉ bỏ ký tự Windows / macOS cấm. */
function tenThuMucDuAn(ten) {
  let t = String(ten || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(t)) t += '_';
  return (t || 'Du_an').slice(0, 100).trim();
}

/** Thư mục đích của một loại việc trong dự án ('' nếu loại đó không đưa lên Drive, vd nhạc). */
function thuMucDich(goc, tenDuAn, loai) {
  return THU_MUC_LOAI[loai] ? path.join(goc, tenThuMucDuAn(tenDuAn), THU_MUC_LOAI[loai]) : '';
}

async function tonTai(p, fsp) {
  try { await fsp.access(p); return true; } catch (_) { return false; }
}

/**
 * Chép file kết quả của một việc vào thư mục Drive.
 * @param o.goc      thư mục Google Drive trên máy (vd G:\My Drive)
 * @param o.ten      1.4.1: tên trên Drive của từng file (theo mẫu tên, không mang " (2)" của thư mục trên máy) — thiếu thì tên file
 * @param o.cu       đường dẫn trên Drive của lần đưa trước (việc Tạo lại) — được ghi đè
 * @returns {ok, files, thuMuc} hoặc {ok:false, loi}
 */
async function chepLenDrive({ goc, tenDuAn, loai, files, ten: tenDs = [], cu = [], fsp = fs.promises }) {
  const thuMuc = thuMucDich(goc || '', tenDuAn, loai);
  if (!thuMuc) return { ok: false, loi: 'Chỉ ảnh và video được đưa lên Drive' };
  if (!goc) return { ok: false, loi: 'Chưa chọn thư mục Google Drive (Cài đặt → Google Drive)' };
  if (!(await tonTai(goc, fsp))) {
    return { ok: false, loi: `Không thấy thư mục Google Drive "${goc}" — mở Google Drive cho máy tính và đăng nhập, hoặc chọn lại thư mục ở Cài đặt → Google Drive` };
  }
  const ds = (files || []).map((f, i) => ({ f, ten: tenDs[i] || (f && path.basename(f)) })).filter((x) => x.f);
  if (!ds.length) return { ok: false, loi: 'Việc chưa có file' };
  await fsp.mkdir(thuMuc, { recursive: true });
  const ra = [];
  for (const { f, ten } of ds) {
    let dich = path.join(thuMuc, ten);
    // Trùng tên file của việc khác (hoặc file khác của chính lần chép này) → thêm (2), (3)…
    const vuong = async (p) => ra.includes(p) || ((await tonTai(p, fsp)) && !cu.includes(p));
    for (let n = 2; await vuong(dich); n++) {
      dich = path.join(thuMuc, ten.replace(/(\.[^.]+)?$/, (d) => ` (${n})${d}`));
    }
    // Lần đưa trước của chính việc này, cùng kích thước → khỏi chép lại (bấm "Lên Drive" lần nữa).
    const giong = cu.includes(dich) && await Promise.all([fsp.stat(f), fsp.stat(dich)]).then(([a, b]) => a.size === b.size).catch(() => false);
    if (!giong) await fsp.copyFile(f, dich);
    ra.push(dich);
  }
  return { ok: true, files: ra, thuMuc };
}

/**
 * Tìm thư mục Google Drive trên máy (Google Drive cho máy tính): Windows — ổ ảo D:…Z: có "My Drive" /
 * "Drive của tôi" (hoặc chế độ phản chiếu trong thư mục người dùng); macOS — ~/Library/CloudStorage/GoogleDrive-*.
 */
function timThuMucDrive({ platform = process.platform, home = require('os').homedir(), fsx = fs } = {}) {
  const TEN = ['My Drive', 'Drive của tôi', 'Mi unidad', 'Mon Drive', 'Meine Ablage'];
  const co = (p) => { try { return fsx.statSync(p).isDirectory(); } catch (_) { return false; } };
  const ds = [];
  if (platform === 'win32') {
    for (const o of 'DEFGHIJKLMNOPQRSTUVWXYZ') for (const t of TEN) ds.push(`${o}:\\${t}`);
    for (const t of [...TEN, 'Google Drive']) ds.push(path.join(home, t));
  } else {
    const cs = path.join(home, 'Library', 'CloudStorage');
    let con = [];
    try { con = fsx.readdirSync(cs).filter((x) => /^GoogleDrive/i.test(x)); } catch (_) {}
    for (const c of con) for (const t of TEN) ds.push(path.join(cs, c, t));
    ds.push(path.join(home, 'Google Drive', 'My Drive'), path.join(home, 'Google Drive'));
  }
  return [...new Set(ds)].filter(co);
}

module.exports = { THU_MUC_LOAI, tenThuMucDuAn, thuMucDich, chepLenDrive, timThuMucDrive };
