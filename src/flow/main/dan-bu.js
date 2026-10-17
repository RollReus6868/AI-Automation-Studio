'use strict';

// ============================================================================
//  dan-bu.js — DÁN BÙ PROMPT KHI ENGINE BỎ QUA BƯỚC DÁN (1.3.2)
//  --------------------------------------------------------------------------
//  TRIỆU CHỨNG (nhật ký người dùng 17/10/2026 21:48, video tạo từ ảnh trên Flow):
//    "🧑 Đã đính kèm ảnh: 004_112652" → KHÔNG có "Nghỉ … trước khi nhập prompt", KHÔNG có "Đã bơm đủ … ký tự"
//    → 8 giây sau "Đã thử cả bốn kiểu bấm … mà Flow không nhận". Lần thử lại (ảnh đã nằm sẵn trong ô nhập)
//    thì dán được, bấm Tạo ăn.
//  NGUYÊN NHÂN: engine tìm ô nhập prompt MỘT lần ở đầu (STEP 1), gắn ảnh @tên (STEP 1.5), chờ 0,8 giây rồi gọi
//  setNativeValue(ô nhập). Hàm đó chỉ gửi INJECT_PASTE khi ô `isContentEditable`; không thì rơi xuống nhánh
//  `element.value = …` — KHÔNG dán, không báo lỗi gì. Engine ép bật nút Tạo rồi bấm với ô nhập trống → Flow bỏ qua.
//  Vậy ngay sau khi ảnh đầu tiên gắn vào, ô nhập của Flow tạm không gõ được (suy từ nhật ký: lần thử lại, ảnh đã
//  nằm sẵn trong ô, thì dán bình thường). Đã thử: phần tử bị gỡ khỏi trang vẫn báo isContentEditable=true, nên
//  nhiều khả năng Flow tạm khoá ô (contenteditable=false) trong lúc xử lý ảnh — chưa thấy tận mắt trên Flow thật.
//  Không sửa engine (quy ước dự án): máy Flow theo dõi nhật ký engine ("[n] 🔍 Starting paste…"), thấy tới
//  INJECT_CLICK_CREATE mà chưa có INJECT_PASTE của prompt đó thì tự dán chữ engine ĐÁNG LẼ đã dán, rồi mới bấm.
//
//  chuDanCua() dựng lại đúng chữ đó — chép y logic pastePrompt() của flow-engine.js:
//    gốc = prompts[n − 1]; charSync (không keyframe) → applyCharSyncTags(gốc, charSyncStripTag).text;
//    addIndex → "<getPromptIndexNumber(n)>. " + chữ.
//  Bài kiểm tests/flow/run.js chạy hàm của engine thật và so từng trường hợp với hàm này.
// ============================================================================

function applyCharSyncTags(goc, boThe) {
  const src = String(goc || '');
  return boThe
    ? src.replace(/@([\p{L}\p{N}_]+)/gu, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
    : src.replace(/@([\p{L}\p{N}_]+)/gu, '$1');
}

function soThuTu(n, s) {
  if ((s.renameMode || 'default') === 'custom_list') return n;
  return (parseInt(s.renameStartIndex) || 1) + n - 1;
}

/**
 * @param prompts   danh sách prompt của mẻ (đúng mảng đã giao engine trong START_AUTOMATION)
 * @param n         số thứ tự prompt của engine (bắt đầu từ 1)
 * @param settings  cài đặt mẻ đã giao engine
 * @returns chữ engine dán vào ô nhập, hoặc null nếu không dựng lại được (chế độ khung hình, thiếu prompt)
 */
function chuDanCua(prompts, n, settings) {
  const s = settings || {};
  if (!Array.isArray(prompts) || !(n >= 1) || prompts[n - 1] == null) return null;
  if (s.keyframeSync) return null;    // app không dùng chế độ khung hình; engine cắt chữ kiểu khác — không đoán
  let chu = String(prompts[n - 1]);
  if (s.charSync) chu = applyCharSyncTags(chu, s.charSyncStripTag);
  if (s.addIndex) chu = `${soThuTu(n, s)}. ${chu}`;
  return chu;
}

/** Số thứ tự prompt trong dòng nhật ký engine "[n] 🔍 Starting paste..." (không phải dòng đó → 0). */
function soCuaDongBatDauDan(chu) {
  const m = /^\[(\d+)\]\s*🔍\s*Starting paste/.exec(String(chu || ''));
  return m ? +m[1] : 0;
}

module.exports = { chuDanCua, soCuaDongBatDauDan };
