'use strict';
// ============================================================================
//  cai-dat-flow.js — CÀI ĐẶT GOOGLE FLOW (logic thuần, kiểm bằng node)
//  --------------------------------------------------------------------------
//  Giữ đúng tên khoá của Flow Automation Studio 2.8.9 (FIELDS / SWITCHES /
//  bộ tải về) để người dùng quen tay, rồi dựng ra bộ khoá PHẲNG mà
//  flow-engine.js đọc — y như collectSettings() của bản Flow.
//
//  Khác bản Flow: app này là HÀNG ĐỢI, nên phần tải về / đặt tên do app tự
//  ép cho mỗi mẻ (tải ngay từng file, tên = mã việc) để biết chắc file nào là
//  của việc nào. Người dùng đặt tên file bằng mẫu tên chung của app (giống
//  Muse) — app đổi tên khi chuyển file ra thư mục kết quả.
// ============================================================================

/** Mặc định — lấy theo giao diện Flow 2.8.9, trừ chỗ ghi chú. */
const FLOW_MAC_DINH = {
  // Chung
  outputCount: 1,           // Flow để 2; hàng đợi: 1 việc = 1 kết quả (muốn nhiều bản dùng "Số bản mỗi prompt")
  delayMin: 20,
  delayMax: 30,
  randomDelay: true,
  maxRetries: 1,            // Flow để 5; thử lại CÙNG tài khoản chừng này lần rồi việc sang tài khoản khác (1.2.0: 2 → 1)
  networkGuard: 'auto',
  multiTabStagger: 0,
  voiceSelect: '',
  voiceSync: false,
  addIndex: true,
  randomScroll: false,
  goAnhThamChieu: true,
  // Nghỉ giữa thao tác (tiến trình chính đọc)
  nghiThaoTacBat: false,
  nghiThaoTacMin: 1,
  nghiThaoTacMax: 4,
  // Model
  modelAnh: 'Nano Banana 2 Lite',
  chonModel: { chinh: '', phu: '', xenKeMoi: 0, duPhong: '', thuLaiPhut: 30 },
  // Nhận diện tài khoản lỗi (src/flow/main/an-toan.js) — 1.2.0 luôn bật, thay "chế độ an toàn":
  // Flow báo "hoạt động bất thường" / hết lượt → đổi tài khoản ngay; `nguong` prompt KHÁC NHAU hỏng
  // liền nhau (chưa prompt nào xong xen giữa) → đổi tài khoản; tài khoản lỗi nghỉ `nghiPhut` phút.
  anToan: { nguong: 2, nghiPhut: 15 },
  // Tạo ảnh Flow mà mọi tài khoản Flow của dự án đều hỏng → chuyển ảnh còn lại sang Muse.
  sangMuseKhiHong: true,
  // Chất lượng tải về
  chatLuongAnh: 'img_2k',
  chatLuongVideo: '1080p',
  // Đổi tên trên Flow theo mã việc (để chuỗi ảnh → video Flow tìm lại được ảnh bằng @tên)
  doiTenTrenFlow: true,
  // Mỗi tài khoản Flow mấy tab chạy song song, mỗi mẻ tối đa mấy prompt
  tabMoiTK: 1,
  meToiDa: 10,
  // Selector người dùng tự chỉ (Cài đặt → Flow → Chẩn đoán)
  selectors: {}
};

const TY_LE_FLOW = ['16:9', '9:16'];
/** Flow chỉ có 16:9 và 9:16 — tỷ lệ khác đổi về cái gần nhất. */
function tyLeFlow(tyLe) {
  if (TY_LE_FLOW.includes(tyLe)) return tyLe;
  return tyLe === '4:3' ? '16:9' : '9:16';
}

const so = (v, min, max, md) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : md;
};

/** Chuẩn hoá bộ cài đặt Flow người dùng lưu (thiếu khoá thì lấy mặc định). */
function chuanHoaFlow(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const m = { ...FLOW_MAC_DINH, ...r };
  m.chonModel = { ...FLOW_MAC_DINH.chonModel, ...(r.chonModel || {}) };
  // Chỉ giữ khoá còn dùng (bật / cửa sổ phút / nghỉ tối đa / nhân đôi / giải lao của bản cũ bỏ đi).
  // Bộ cũ (có cuaSoPhut) mang nghĩa khác ("3 lỗi trong 5 phút") → lấy mặc định mới.
  const at = r.anToan && !('cuaSoPhut' in r.anToan) ? r.anToan : {};
  m.anToan = { nguong: Math.round(so(at.nguong, 1, 10, FLOW_MAC_DINH.anToan.nguong)),
    nghiPhut: Math.round(so(at.nghiPhut, 1, 240, FLOW_MAC_DINH.anToan.nghiPhut)) };
  m.selectors = r.selectors && typeof r.selectors === 'object' ? { ...r.selectors } : {};
  m.outputCount = Math.round(so(m.outputCount, 1, 4, 1));
  m.delayMin = Math.round(so(m.delayMin, 1, 600, 20));
  m.delayMax = Math.max(m.delayMin, Math.round(so(m.delayMax, 1, 600, 30)));
  m.maxRetries = Math.round(so(m.maxRetries, 0, 10, 2));
  m.multiTabStagger = Math.round(so(m.multiTabStagger, 0, 600, 0));
  m.nghiThaoTacMin = so(m.nghiThaoTacMin, 0, 60, 1);
  m.nghiThaoTacMax = Math.max(m.nghiThaoTacMin, so(m.nghiThaoTacMax, 0, 60, 4));
  m.tabMoiTK = Math.round(so(m.tabMoiTK, 1, 4, 1));
  m.meToiDa = Math.round(so(m.meToiDa, 1, 50, 10));
  m.networkGuard = m.networkGuard === 'off' ? 'off' : 'auto';
  for (const k of ['randomDelay', 'voiceSync', 'addIndex', 'randomScroll', 'goAnhThamChieu', 'nghiThaoTacBat', 'doiTenTrenFlow', 'sangMuseKhiHong']) m[k] = !!m[k];
  if (!['img_4k', 'img_2k', 'img_1k'].includes(m.chatLuongAnh)) m.chatLuongAnh = 'img_2k';
  if (!['4k', '1080p', '720p'].includes(m.chatLuongVideo)) m.chatLuongVideo = '1080p';
  return m;
}

/**
 * Bộ khoá PHẲNG gửi cho engine cho MỘT mẻ.
 * @param f        cài đặt Flow đã chuẩn hoá
 * @param me.loai  'anh' | 'video'
 * @param me.tyLe  tỷ lệ của việc đầu mẻ
 * @param me.coAnh mẻ có gắn ảnh (@tên) — bật Character Sync
 * @param me.ten   [tên file cho từng prompt, đúng thứ tự videosToCreate]
 */
function caiDatEngine(f, me) {
  const c = chuanHoaFlow(f);
  const video = me.loai === 'video';
  const s = {
    runMode: video ? 'video' : 'image',
    aspectRatio: tyLeFlow(me.tyLe),
    outputCount: c.outputCount,
    delayMin: c.delayMin,
    delayMax: c.delayMax,
    randomDelay: c.randomDelay,
    // Engine bốc số trong [pasteDelayMin, pasteDelayMax]; tắt ngẫu nhiên = hai đầu bằng nhau.
    pasteDelayMin: c.delayMin,
    pasteDelayMax: c.randomDelay ? c.delayMax : c.delayMin,
    maxRetries: c.maxRetries,
    networkGuard: c.networkGuard,
    multiTabStagger: c.multiTabStagger,
    voiceSelect: c.voiceSelect,
    // Hai thứ này chỉ có nghĩa ở chế độ video (ở chế độ ảnh engine đi tìm nút giọng nói không tồn tại).
    voiceSync: video && c.voiceSync,
    // Ảnh nguồn gắn bằng @tên (Character Sync). Khung hình đầu/cuối đòi HAI thẻ @ — hàng đợi chỉ
    // có một ảnh mỗi việc, để bật là cả mẻ hỏng ở bước dán (bài học Flow 2.3.x) → luôn tắt.
    keyframeSync: false,
    charSync: !!me.coAnh,
    // Xoá hẳn @tên khỏi câu gửi Flow: tên ảnh chỉ là mã tra kho, lọt vào prompt làm Flow hiểu sai.
    charSyncStripTag: true,
    addIndex: c.addIndex,
    randomScroll: c.randomScroll,
    autoShutdown: false,           // tắt máy do hàng đợi quyết (hết cả hàng chờ), không theo từng mẻ
    zoomLevel: '0.8',
    // LUÔN bật ở bản desktop: tên dự án gắn _T<slot>, các tab không ghi đè dự án của nhau (Flow 2.8.x).
    multiTab: true,
    language: 'vi',
    // ── Tải về: app ép — tải NGAY từng file, đặt tên theo mã việc để biết file nào của việc nào ──
    downloadMode: 'single',
    dlMode: 'single',
    autoDownload: true,
    downloadZip: false,
    downloadImmediately: true,
    downloadSubfolder: '',
    downloadQuality: video ? c.chatLuongVideo : c.chatLuongAnh,
    autoRename: c.doiTenTrenFlow,
    renameMode: 'custom_list',
    renameCustomList: (me.ten || []).join('\n'),
    renameMaxLen: 150,
    renameIndexPad: 3,
    renamePrefix: '',
    renameSuffix: '',
    renameStartIndex: 1,
    asciiMode: 'file',
    // ── Tiến trình chính đọc (engine bỏ qua khoá lạ) ──
    nghiThaoTacBat: c.nghiThaoTacBat,
    nghiThaoTacMin: c.nghiThaoTacMin,
    nghiThaoTacMax: c.nghiThaoTacMax,
    modelAnh: c.modelAnh,
    goAnhThamChieu: c.goAnhThamChieu,
    anToan: { ...c.anToan },
    chonModel: { ...c.chonModel },
    selectors: { ...c.selectors }
  };
  return s;
}

/** Hai việc chạy chung một mẻ được không: cùng dự án, cùng loại, cùng tỷ lệ Flow, cùng có/không ảnh. */
function khoaMe(j) {
  const coAnh = (j.thamChieu || []).length > 0 || (j.nhanVat || []).length > 0;
  return `${j.duAn}|${j.loai}|${tyLeFlow(j.tyLe)}|${coAnh ? 1 : 0}`;
}

module.exports = { FLOW_MAC_DINH, TY_LE_FLOW, tyLeFlow, chuanHoaFlow, caiDatEngine, khoaMe };
