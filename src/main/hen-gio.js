'use strict';
// ============================================================================
//  hen-gio.js — 1.3.6 HẸN GIỜ CHẠY, RIÊNG cho từng chức năng (Tạo ảnh / Tạo video / Tạo nhạc).
//
//  Mỗi chức năng một hẹn: { bat, batDau 'HH:MM', ketThuc 'HH:MM' | '' , lap 'ngay' | 'mot', duAn '' | id,
//  datLuc, daChay }. Đến giờ bắt đầu → điều phối chạy MỌI việc đang chờ của loại đó (của mọi dự án, hoặc một
//  dự án); có giờ dừng → tới giờ đó thì dừng (việc đang chạy về hàng chờ); không có giờ dừng → chạy tới hết.
//  Logic thuần (giờ máy), không đụng Electron — tests/run.js kiểm với đồng hồ giả.
// ============================================================================

const LOAI_HEN = ['anh', 'video', 'nhac'];
const TEN_CHUC_NANG = { anh: 'Tạo ảnh', video: 'Tạo video', nhac: 'Tạo nhạc' };
const NGAY_MS = 24 * 60 * 60 * 1000;
// Không đặt giờ dừng: chỉ bắt đầu nếu app đang mở trong chừng này sau giờ hẹn (máy vừa thức / app vừa mở lại
// thì vẫn chạy), quá thì để hôm sau — tránh mở app buổi trưa mà hàng chờ tự chạy vì hẹn lúc 2 giờ sáng.
const TRE_TOI_DA_MS = 10 * 60 * 1000;

const HEN_MAC_DINH = { bat: false, batDau: '22:00', ketThuc: '', lap: 'ngay', duAn: '', datLuc: 0, daChay: '' };

/** 'H:MM' / 'HH:MM' hợp lệ → 'HH:MM', không thì ''. */
function chuanGio(s) {
  const m = /^\s*(\d{1,2})\s*[:hH.]\s*(\d{2})\s*$/.exec(String(s || ''));
  if (!m) return '';
  const h = +m[1], p = +m[2];
  return h < 24 && p < 60 ? `${String(h).padStart(2, '0')}:${String(p).padStart(2, '0')}` : '';
}

function chuanHen(h) {
  const m = { ...HEN_MAC_DINH, ...(h || {}) };
  m.bat = !!m.bat;
  m.batDau = chuanGio(m.batDau) || HEN_MAC_DINH.batDau;
  m.ketThuc = chuanGio(m.ketThuc);
  if (m.ketThuc === m.batDau) m.ketThuc = '';
  m.lap = m.lap === 'mot' ? 'mot' : 'ngay';
  m.duAn = String(m.duAn || '');
  m.datLuc = Number(m.datLuc) || 0;
  m.daChay = String(m.daChay || '');
  return m;
}

/** { anh, video, nhac } đã chuẩn hoá. */
function chuanBoHen(b) {
  return Object.fromEntries(LOAI_HEN.map((l) => [l, chuanHen(b && b[l])]));
}

/** Mốc giờ 'HH:MM' của NGÀY chứa `luc` (giờ máy). */
function mocTrongNgay(luc, gio) {
  const [h, p] = gio.split(':').map(Number);
  const d = new Date(luc);
  d.setHours(h, p, 0, 0);
  return d.getTime();
}

/** Cùng giờ 'HH:MM' nhưng lệch `n` ngày (lấy qua trưa của ngày — không lệch ngày khi đổi giờ mùa hè). */
const mocNgayKhac = (luc, gio, n) => mocTrongNgay(mocTrongNgay(luc, '12:00') + n * NGAY_MS, gio);

const khoaNgay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Lần hẹn gần nhất đã tới (bắt đầu ≤ bayGio): { bd, den, khoa }.
 * den = giờ dừng sau bd (qua nửa đêm thì sang hôm sau) — không có giờ dừng thì 0.
 */
function lanGanNhat(h, bayGio) {
  let bd = mocTrongNgay(bayGio, h.batDau);
  if (bd > bayGio) bd = mocNgayKhac(bayGio, h.batDau, -1);   // giờ hẹn hôm nay chưa tới → lần gần nhất là hôm qua
  let den = 0;
  if (h.ketThuc) {
    den = mocTrongNgay(bd, h.ketThuc);
    if (den <= bd) den = mocNgayKhac(bd, h.ketThuc, 1);   // 22:00 → 06:00: dừng sáng hôm sau
  }
  return { bd, den, khoa: `${khoaNgay(bd)} ${h.batDau}` };
}

/**
 * Đến giờ chạy chưa? → { khoa, den } (den = giờ dừng, 0 = chạy tới hết) hoặc null.
 * Mỗi lần hẹn (mỗi ngày) chỉ chạy một lần (h.daChay = khoa của lần đã chạy). Hẹn "một lần" chỉ tính các mốc
 * SAU lúc người dùng đặt hẹn.
 */
function denGioChay(h, bayGio) {
  if (!h || !h.bat) return null;
  const x = lanGanNhat(h, bayGio);
  if (h.daChay === x.khoa) return null;
  if (h.lap === 'mot' && x.bd < (h.datLuc || 0) - 60000) return null;
  const het = x.den || x.bd + TRE_TOI_DA_MS;
  if (bayGio < x.bd || bayGio >= het) return null;
  return { khoa: x.khoa, den: x.den, bd: x.bd };
}

/** Lần chạy tới (để hiện trên giao diện) — 0 nếu hẹn đang tắt. */
function lanChayToi(h, bayGio) {
  if (!h || !h.bat) return 0;
  const x = lanGanNhat(h, bayGio);
  const conDuoc = h.daChay !== x.khoa && !(h.lap === 'mot' && x.bd < (h.datLuc || 0) - 60000) &&
    bayGio < (x.den || x.bd + TRE_TOI_DA_MS);
  return conDuoc ? x.bd : mocNgayKhac(x.bd, h.batDau, 1);
}

/** Mốc 'HH:MM' gần nhất SAU `luc` (hôm nay nếu chưa qua, không thì ngày mai). */
const gioToiSau = (gio, luc) => { const t = mocTrongNgay(luc, gio); return t > luc ? t : mocNgayKhac(luc, gio, 1); };

const gioPhut = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

module.exports = { LOAI_HEN, TEN_CHUC_NANG, HEN_MAC_DINH, TRE_TOI_DA_MS, chuanGio, chuanHen, chuanBoHen, lanGanNhat, denGioChay, lanChayToi, gioToiSau, gioPhut };
