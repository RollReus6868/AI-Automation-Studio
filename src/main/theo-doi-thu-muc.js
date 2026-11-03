'use strict';
// ============================================================================
//  theo-doi-thu-muc.js — 1.4.9: "Tạo video từ thư mục ảnh" THEO DÕI thư mục.
//  Người dùng làm ảnh dần dần vào một thư mục: app quét lại thư mục mỗi vài giây
//  (fs.watch chỉ để quét sớm hơn), ảnh MỚI nào đã ghi xong thì thêm việc video.
//
//  Logic thuần (không đụng Electron) để bài kiểm chạy thẳng bằng node:
//    • docThuMuc(dir, daCo)   → ảnh chưa nhận trong thư mục + size / mtime (null = thư mục không còn)
//    • chonAnhMoi(...)        → ảnh đã "đứng yên" (ghi xong) để nhận
//    • promptCho(i, ...)      → prompt của ảnh thứ i (xếp theo tên) — dòng riêng → dùng chung → mặc định
// ============================================================================

const fs = require('fs');
const path = require('path');
const hd = require('./hang-doi');

/** Đuôi ảnh nhận (như ô "Chọn thư mục ảnh"). */
const DUOI_ANH = /\.(png|jpe?g|webp)$/i;
/** Ảnh phải cũ hơn chừng này (mtime) và giữ nguyên size + mtime qua 2 lần quét mới nhận — kẻo đọc ảnh đang ghi dở. */
const YEN_MS = 3000;
/** Nhịp quét định kỳ. */
const NHIP_MS = 5000;

/** Mọi ảnh trong thư mục (chỉ tên file ngay trong thư mục), xếp theo tên tự nhiên — đường dẫn đầy đủ. */
function dsAnh(dir, fsx = fs) {
  return fsx.readdirSync(dir).filter((f) => DUOI_ANH.test(f)).sort(hd.soSanhTuNhien).map((f) => path.join(dir, f));
}

/**
 * Đọc thư mục: danh sách mọi ảnh (xếp tên) + thông tin (size, mtime) của ảnh CHƯA nhận — ảnh đã nhận khỏi stat lại
 * (thư mục hàng nghìn ảnh quét mỗi 5 giây vẫn nhẹ).
 * @returns {{ ds: string[], ung: Map<string,{size:number, mtimeMs:number}> } | null}  null = thư mục không còn / không đọc được
 */
function docThuMuc(dir, daCo, fsx = fs) {
  let ds;
  try { ds = dsAnh(dir, fsx); } catch (_) { return null; }
  const ung = new Map();
  for (const p of ds) {
    if (daCo.has(p)) continue;
    try {
      const s = fsx.statSync(p);
      if (s.isFile()) ung.set(p, { size: s.size, mtimeMs: s.mtimeMs });
    } catch (_) { /* vừa bị xoá / đổi tên giữa lúc quét */ }
  }
  return { ds, ung };
}

/**
 * Chọn ảnh mới đã ghi xong: chưa nhận, size > 0, cùng size + mtime với lần quét trước, mtime cũ hơn `yenMs`.
 * @param ung    Map đường dẫn → {size, mtimeMs} của lần quét này (docThuMuc().ung)
 * @param truoc  Map như trên của lần quét trước (hoặc rỗng)
 * @returns {{ moi: string[], truoc: Map }}  moi theo thứ tự của `ung`; truoc = ung (lưu cho lần quét sau)
 */
function chonAnhMoi(ung, truoc, bayGio, yenMs = YEN_MS) {
  const moi = [];
  for (const [p, s] of ung) {
    const t = truoc && truoc.get(p);
    if (!t || !s.size || t.size !== s.size || t.mtimeMs !== s.mtimeMs) continue;
    if (bayGio - s.mtimeMs < yenMs) continue;
    moi.push(p);
  }
  return { moi, truoc: ung };
}

/** Prompt video của ảnh thứ i (0-based, theo danh sách thư mục đã xếp): dòng riêng i → prompt dùng chung → mặc định. */
function promptCho(i, prompt, prompts) {
  const rieng = (Array.isArray(prompts) && String(prompts[i] || '').trim()) || '';
  return rieng || String(prompt || '').trim() || hd.PROMPT_VIDEO_MAC_DINH;
}

/**
 * fs.watch chỉ để quét SỚM (thư mục đổi → gọi `baoDoi` sau ~1,5 s, gom nhiều sự kiện). Ổ mạng / máy không có watch:
 * bỏ qua lặng lẽ — quét định kỳ vẫn chạy. Không giữ tiến trình sống (unref).
 * @returns hàm đóng
 */
function gacThuMuc(dir, baoDoi, choMs = 1500) {
  let w = null, hen = null;
  const dong = () => {
    clearTimeout(hen);
    if (w) { try { w.close(); } catch (_) {} w = null; }
  };
  try {
    w = fs.watch(dir, () => {
      clearTimeout(hen);
      hen = setTimeout(() => { try { baoDoi(); } catch (_) {} }, choMs);
      if (hen.unref) hen.unref();
    });
    w.on('error', dong);
    if (w.unref) w.unref();
  } catch (_) { w = null; }
  return dong;
}

module.exports = { DUOI_ANH, YEN_MS, NHIP_MS, dsAnh, docThuMuc, chonAnhMoi, promptCho, gacThuMuc };
