'use strict';

// ============================================================================
//  an-toan.js — hạ nhịp và tự nghỉ khi Flow bắt đầu coi mình là máy
//  --------------------------------------------------------------------------
//
//  VẤN ĐỀ THẬT
//  Chạy nhiều tab, chạy liên tục, thì tới một lúc Flow trả về thẻ đỏ:
//
//      "Không thành công — Chúng tôi nhận thấy có hoạt động bất thường nào đó."
//
//  Và từ đó trở đi MỌI prompt đều hỏng. Tệ hơn nữa: engine thấy lỗi thì thử
//  lại, mỗi prompt tới maxRetries lần. Nên đúng lúc Google đang khó chịu nhất
//  thì tool lại gõ cửa dồn dập nhất, và cả mẻ 30 prompt cháy sạch trong vài
//  phút — đúng cảnh "0/30 xong · 30 lỗi".
//
//  CHỖ NÀY LÀM ĐƯỢC GÌ, VÀ KHÔNG LÀM GÌ
//  Không có cách nào "qua mặt" bộ dò của Google, và file này không thử làm
//  thế: không giả vân tay trình duyệt, không đổi IP, không đụng tới CAPTCHA.
//  Việc nó làm là thứ tử tế hơn và thật ra hiệu quả hơn: gõ cửa thưa hơn, và
//  khi đã bị nhắc thì IM LẶNG NGHỈ một lúc thay vì cố đấm thêm.
//
//    • Nhận ra sớm — 2-3 lỗi liên tiếp là đủ để nghi, không đợi cháy cả mẻ.
//    • Dừng ngay cả tài khoản (mọi tab), vì Google chặn theo TÀI KHOẢN chứ
//      không theo tab.
//    • Nghỉ tăng dần: lần đầu 10 phút, bị lại thì 20, rồi 40 — vì bị chặn hai
//      lần liền nghĩa là 10 phút chưa đủ.
//    • Tự chạy tiếp sau khi nghỉ, không bắt người dùng ngồi canh.
//
//  Cả file là hàm thuần (trừ chỗ nói rõ), để tests/run.js gọi thẳng được.
// ============================================================================

// ── Những câu Flow/Google hiện ra khi đã coi mình là bất thường ────────────
//
//  Viết sẵn dạng KHÔNG DẤU, chữ thường. Trang Flow có lúc tiếng Việt có lúc
//  tiếng Anh tuỳ ngôn ngữ tài khoản, nên phải có cả hai.
const CUM_TU_CHAN = [
  'hoat dong bat thuong',      // "Chúng tôi nhận thấy có hoạt động bất thường"
  'luu luong bat thuong',
  'unusual activity',
  'unusual traffic',
  'suspicious activity',
  'qua nhieu yeu cau',
  'too many requests',
  'rate limit',
  'quota exceeded',
  'vuot qua han muc',
  'tam thoi bi chan',
  'temporarily blocked',
  'try again later',
  'thu lai sau'
];

// Tài khoản hết lượt / hết tín dụng — chỉ so với chữ TRÊN THẺ LỖI và chữ lỗi của engine, không quét cả
// trang (trang Flow lúc nào cũng có chữ "credits" ở chỗ chọn model).
const CUM_TU_HET_LUOT = [
  'not enough credits',
  'out of credits',
  'insufficient credits',
  'no credits left',
  'khong du tin dung',
  'het tin dung',
  'daily limit',
  'gioi han hang ngay'
];

/** Câu trên thẻ lỗi nói tài khoản hết lượt / hết tín dụng. */
function laHetLuot(text) {
  const t = boDau(text);
  return !!t && CUM_TU_HET_LUOT.some((c) => t.includes(c));
}

// Câu báo lỗi chung chung của engine — KHÔNG đủ để kết luận bị chặn, nhưng
// nhiều cái liên tiếp thì đáng nghi.
const LOI_CHUNG = 'khong thanh cong';

/** Bỏ dấu tiếng Việt + hạ chữ thường, để so chuỗi không lệch vì dấu. */
function boDau(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Câu này có phải lời Google nói mình đang bất thường không?
 * Dùng cho cả chữ đọc từ DOM lẫn chữ trong trường `error` của engine.
 */
function laCanhBaoChan(text) {
  const t = boDau(text);
  if (!t) return false;
  return CUM_TU_CHAN.some((c) => t.includes(c));
}

/** Lỗi chung chung ("Không thành công") — đáng nghi nhưng chưa chắc chắn. */
function laLoiChungChung(text) {
  return boDau(text).includes(LOI_CHUNG);
}

// ── Cài đặt ────────────────────────────────────────────────────────────────
//
//  1.2.0 — "NHẬN DIỆN TÀI KHOẢN LỖI" thay cho chế độ an toàn. Mỗi dự án giờ có
//  tài khoản dự phòng (và chạy được nhiều tài khoản cùng lúc), nên khi một tài
//  khoản hỏng việc đúng nhất là ĐỔI NGAY sang tài khoản khác, không ngồi đếm
//  lỗi trong cửa sổ 5 phút hay nghỉ giải lao. Luôn bật; còn hai con số:
//    • nguong   — bao nhiêu prompt KHÁC NHAU hỏng liền nhau (không có prompt
//                 nào xong xen giữa) thì coi là tài khoản hỏng. Đếm prompt khác
//                 nhau chứ không đếm lần thử: một prompt vi phạm chính sách bị
//                 thử lại mấy lần cũng chỉ là MỘT prompt, không làm oan tài khoản.
//    • nghiPhut — tài khoản hỏng nghỉ bao lâu (bị lại thì tự nghỉ gấp đôi, tối
//                 đa 4 lần con số này).
//  Đọc được câu "hoạt động bất thường" / "quá nhiều yêu cầu"… thì đổi ngay từ
//  lỗi ĐẦU TIÊN.

const MAC_DINH = {
  nguong: 2,            // 2 prompt khác nhau hỏng liền nhau → tài khoản hỏng
  nghiPhut: 15          // tài khoản hỏng nghỉ bấy nhiêu phút
};
const HE_SO_NGHI_TOI_DA = 4;

/**
 * Nhặt cài đặt từ giao diện về dạng số sạch sẽ (giao diện gửi lên toàn chuỗi).
 * Khoá của bản cũ (bat, cuaSoPhut, nhanDoi, nghiToiDaPhut, cuMoi, giaiLaoPhut) bỏ qua.
 */
function chuanHoaCaiDat(raw) {
  const r = raw || {};
  const so = (v, md, min, max) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return md;
    return Math.min(max, Math.max(min, n));
  };
  return {
    nguong:   so(r.nguong,   MAC_DINH.nguong,   1, 10),
    nghiPhut: so(r.nghiPhut, MAC_DINH.nghiPhut, 1, 240)
  };
}

// ── Theo dõi lỗi ───────────────────────────────────────────────────────────

/** Sổ theo dõi rỗng cho MỘT tài khoản. */
function soMoi() {
  return {
    promptLoi: new Set(), // prompt (khoá theo mẻ) đã hỏng từ lần XONG gần nhất của tài khoản
    coCauChan: false,     // đã đọc được đúng câu "hoạt động bất thường" chưa
    soLanBiChan: 0,       // đã phải nghỉ mấy lần trong phiên này
    dangNghi: false,
    nghiDen: 0
  };
}

/** Xoá dấu vết lỗi (sau khi đã đổi / nghỉ tài khoản, hoặc có prompt xong). */
function xoaDauLoi(so) {
  so.promptLoi.clear();
  so.coCauChan = false;
}

/**
 * Tìm những prompt VỪA chuyển sang lỗi, chưa được đếm lần nào.
 *
 * Phải lọc trùng: engine gửi lại NGUYÊN bảng mỗi vài giây, nên một prompt lỗi
 * sẽ xuất hiện trong hàng chục lượt gửi liên tiếp.
 *
 * @param {Array}  rows    mảng hàng engine gửi lên
 * @param {Set}    daDem   khoá các lần lỗi đã đếm rồi (bị sửa tại chỗ)
 * @returns {{chiSo:number, loi:string, chacChan:boolean}[]}
 */
function loiMoi(rows, daDem) {
  const ds = Array.isArray(rows) ? rows : [];
  const ra = [];
  for (const r of ds) {
    if (!r || r.status !== 'ERROR') continue;
    // Khoá theo cả số lần thử: engine thử lại thì retries tăng — lần hỏng thứ hai của cùng prompt
    // cũng được báo (để đọc câu lỗi mới), còn đếm "prompt khác nhau" là việc của canNghi.
    const khoa = `${r.index}#${r.retries || 0}`;
    if (daDem.has(khoa)) continue;
    daDem.add(khoa);
    ra.push({
      chiSo: r.index,
      loi: r.error || '',
      chacChan: laCanhBaoChan(r.error) || laHetLuot(r.error)
    });
  }
  return ra;
}

/** Những prompt VỪA xong (COMPLETED), chưa đếm lần nào. */
function xongMoi(rows, daDem) {
  const ra = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || r.status !== 'COMPLETED' || daDem.has(r.index)) continue;
    daDem.add(r.index);
    ra.push(r.index);
  }
  return ra;
}

/**
 * Tài khoản này đã hỏng chưa (đổi sang tài khoản khác / cho nghỉ)?
 *   • Đọc được câu "hoạt động bất thường" → chắc chắn, ngay từ lỗi đầu tiên.
 *   • `nguong` prompt khác nhau hỏng liền nhau → hỏng.
 */
function canNghi(so, bayGio, caiDat) {
  if (so.dangNghi) return { nghi: false };
  const soLoi = so.promptLoi.size;
  if (so.coCauChan && soLoi >= 1) {
    return { nghi: true, chacChan: true, soLoi, lyDo: 'Trang Flow đang hiện thông báo hoạt động bất thường / hết lượt' };
  }
  if (soLoi >= caiDat.nguong) {
    return { nghi: true, chacChan: false, soLoi, lyDo: `${soLoi} prompt khác nhau hỏng liền nhau` };
  }
  return { nghi: false, soLoi };
}

/**
 * Nghỉ bao lâu (mili-giây): nghiPhut, bị lại thì gấp đôi, tối đa 4 lần nghiPhut.
 * @param {number} soLanBiChan số lần ĐÃ nghỉ trước đó (0 = lần đầu)
 */
function thoiGianNghi(soLanBiChan, caiDat) {
  const c = caiDat || MAC_DINH;
  const lan = Math.max(0, Number(soLanBiChan) || 0);
  const phut = Math.min(c.nghiPhut * HE_SO_NGHI_TOI_DA, c.nghiPhut * Math.pow(2, Math.min(lan, 10)));
  return Math.round(phut * 60000);
}

// ── Bộ nhịp gợi ý ──────────────────────────────────────────────────────────

/**
 * Nhịp chạy "hiền" gợi ý, theo số tab định chạy cùng lúc.
 *
 * Con số không phải bí kíp gì — nguyên tắc chỉ là: càng nhiều tab cùng một
 * tài khoản thì mỗi tab phải càng thưa, vì Google đếm theo tài khoản chứ
 * không đếm theo tab. Ba tab gõ cửa 20 giây một lần thì với Google nó là gõ
 * cửa 7 giây một lần.
 *
 * maxRetries hạ xuống 3 là phần quan trọng nhất mà ít ai để ý: lúc bị chặn,
 * mỗi lần thử lại là một lần gõ cửa nữa. Để 5 thì một mẻ 30 prompt thành 150
 * lần gõ cửa vào đúng lúc không nên gõ.
 */
function nhipAnToan(soTab) {
  const n = Math.max(1, Math.min(10, Number(soTab) || 1));
  const min = 20 + (n - 1) * 15;          // 1 tab: 20s · 2 tab: 35s · 3 tab: 50s
  const max = Math.round(min * 2.2);
  return {
    randomDelay: true,
    delayMin: min,
    delayMax: max,
    multiTabStagger: n > 1 ? 15 * n : 0,  // giãn lần bấm "Tạo" giữa các tab
    randomScroll: true,                   // có cuộn trang, giống người xem kết quả
    maxRetries: 3,
    networkGuard: 'auto'
  };
}

/** Đổi mili-giây thành "5 phút 30 giây" để ghi nhật ký cho người đọc. */
function doDai(ms) {
  const giay = Math.max(0, Math.round(ms / 1000));
  const p = Math.floor(giay / 60);
  const g = giay % 60;
  if (!p) return `${g} giây`;
  if (!g && p >= 120 && p % 60 === 0) return `${p / 60} giờ`;
  if (!g) return `${p} phút`;
  return `${p} phút ${g} giây`;
}

module.exports = {
  CUM_TU_CHAN,
  MAC_DINH,
  boDau,
  laCanhBaoChan,
  CUM_TU_HET_LUOT,
  laHetLuot,
  laLoiChungChung,
  chuanHoaCaiDat,
  soMoi,
  xoaDauLoi,
  loiMoi,
  xongMoi,
  canNghi,
  thoiGianNghi,
  nhipAnToan,
  doDai
};
