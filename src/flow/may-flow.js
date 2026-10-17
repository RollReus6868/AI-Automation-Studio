// ============================================================================
//  may-flow.js — "BACKGROUND" CỦA ENGINE FLOW: trả lời mọi action engine gửi
//  --------------------------------------------------------------------------
//  Lấy nguyên văn phần lõi tiến trình chính của Flow Automation Studio 2.8.9
//  (main.js): bộ định tuyến handleEngineMessage, chế độ an toàn, kế hoạch
//  model video, model ảnh, đổi chế độ Image/Video, nhịp thao tác, gỡ ảnh tham
//  chiếu dính, bấm nút Tạo bằng chuột thật rồi các kiểu JS, selector người
//  dùng tự chỉ, tắt máy khi xong. Lý do của từng thứ viết ở chỗ của nó và ở
//  src/flow/main/*.js — giữ nguyên để không mất bài học nào.
//
//  Khác bản gốc:
//   • Không có bảng tiến độ theo tab (giao diện là HÀNG ĐỢI kiểu Muse): engine
//     báo UPDATE_TABLE_DATA / AUTOMATION_STOPPED / tải xong thì chuyển cho
//     LUỒNG Flow đang giữ tab (tab.onBang / tab.onDung / tab.onTai).
//   • Chuỗi ảnh→video không còn nằm ở đây: hàng đợi chung lo (ảnh xong là việc
//     video mới vào hàng chờ, chạy ở Flow hoặc Muse tuỳ người dùng chọn).
//   • Chế độ an toàn: tài khoản bị Flow nhắc mà dự án CÒN tài khoản dự phòng
//     → giao cho bộ điều phối cho tài khoản này nghỉ, việc chuyển ngay sang dự
//     phòng (đúng cơ chế Muse). Không còn dự phòng → nghỉ rồi tự chạy lại như
//     Flow cũ.
//
//  Không require('electron') — main.js đưa vào những gì cần.
// ============================================================================

const { exec } = require('child_process');
const anToan = require('./main/an-toan');
const modelKH = require('./main/model');
const nhipTT = require('./main/nhip-thao-tac');
const thamChieu = require('./main/anh-tham-chieu');
const { pastePrompt, bamChuotThat } = require('./main/paste');
const danBu = require('./main/dan-bu');
const { kiemTruocKhiChay } = require('./main/kiem-truoc');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mục con của Video cần chọn trên Flow mới (16/10/2026 có "Khung hình | Thành phần"):
 * ảnh gắn @tên (charSync) là THÀNH PHẦN, ảnh khung đầu/cuối (keyframeSync) là KHUNG HÌNH;
 * video chỉ từ chữ, hay chế độ Hình ảnh → không đụng.
 */
function tuyCheDo(settings) {
  const s = settings || {};
  if (s.runMode !== 'video') return null;
  if (s.charSync) return { phu: 'thanh-phan' };
  if (s.keyframeSync) return { phu: 'khung-hinh' };
  return null;
}

/**
 * @param o.tabs          QuanLyTabFlow
 * @param o.taiVe         DownloadManager (src/flow/main/downloads.js)
 * @param o.log(muc, chu)
 * @param o.layCaiDat()   cài đặt Flow hiện hành (để đọc selector người dùng tự chỉ)
 * @param o.nghiTaiKhoan(accountId, ms, lyDo) → true nếu bộ điều phối đã lo (có dự phòng)
 * @param o.thongBao(tieuDe, chu)
 */
function taoMayFlow(o) {
  const { tabs, taiVe } = o;
  const log = (muc, chu) => o.log(muc, chu);

  // ══════════════════════════════════════════════════════════════════════
  //  CHẾ ĐỘ AN TOÀN — nghỉ theo TÀI KHOẢN (Google đếm theo tài khoản)
  // ══════════════════════════════════════════════════════════════════════
  let caiDatAnToan = anToan.chuanHoaCaiDat({});
  const soAnToan = new Map();
  const henChayLai = new Map();
  const khoa = (id) => id || '(khong-ro)';

  function soAnToanCua(accountId) {
    if (!soAnToan.has(khoa(accountId))) soAnToan.set(khoa(accountId), anToan.soMoi());
    return soAnToan.get(khoa(accountId));
  }
  const tabCungTaiKhoan = (accountId) => tabs.tabs.filter((t) => khoa(t.accountId) === khoa(accountId));

  function datCaiDatAnToan(raw) {
    caiDatAnToan = anToan.chuanHoaCaiDat(raw);
    return caiDatAnToan;
  }

  /** Có prompt vừa hỏng → đọc chữ Flow ghi trên thẻ lỗi (mỗi câu ghi MỘT lần mỗi tab).
   *  @returns true nếu một câu trên thẻ nói tài khoản bị chặn / hết lượt */
  async function ghiLyDoTheLoi(tab, coLoiMoi) {
    if (!tab || !tab.ready || !coLoiMoi) return false;
    if (!tab._lyDoDaGhi) tab._lyDoDaGhi = new Set();
    let r = null;
    try {
      r = await tab.view.webContents.executeJavaScript('window.__flowDocLyDoTheLoi ? window.__flowDocLyDoTheLoi() : null', true);
    } catch (_) { return false; }
    if (!r || !r.ok || !Array.isArray(r.lyDo)) return false;
    let chan = false;
    for (const cau of r.lyDo) {
      if (anToan.laCanhBaoChan(cau) || anToan.laHetLuot(cau)) chan = true;
      if (tab._lyDoDaGhi.has(cau)) continue;
      tab._lyDoDaGhi.add(cau);
      log('error', `🧾 [${tab.id}] Flow ghi trên thẻ lỗi: "${cau}"`);
    }
    return chan;
  }

  /**
   * NHẬN DIỆN TÀI KHOẢN LỖI (1.2.0, luôn bật): prompt nào xong thì xoá dấu lỗi của tài khoản; prompt
   * hỏng thì ghi lại — đủ `nguong` prompt khác nhau hỏng liền nhau, hoặc Flow nói "hoạt động bất
   * thường" / hết lượt, thì đổi tài khoản ngay (dự án còn dự phòng) hoặc cho tài khoản nghỉ.
   */
  async function theoDoiAnToan(tab, rows) {
    if (!tab) return;
    const so = soAnToanCua(tab.accountId);
    if (!tab._daDemLoi) tab._daDemLoi = new Set();
    if (!tab._daDemXong) tab._daDemXong = new Set();
    if (anToan.xongMoi(rows, tab._daDemXong).length) anToan.xoaDauLoi(so);
    const moi = anToan.loiMoi(rows, tab._daDemLoi);
    if (moi.length) {
      for (const m of moi) so.promptLoi.add(`${tab.id}#${tab._meKhoa || 0}#${m.chiSo}`);
      if (moi.some((m) => m.chacChan)) so.coCauChan = true;
      if (await ghiLyDoTheLoi(tab, true)) so.coCauChan = true;
      if (!so.coCauChan) {
        const doc = await doCanhBaoTrenTrang(tab);
        if (doc && doc.co) {
          so.coCauChan = true;
          log('error', `🚫 [${tab.id}] Flow đang báo: "${(doc.viDu || '').slice(0, 120)}"`);
        }
      }
    }
    await xetTaiKhoan(tab);
  }

  /** Prompt tạo xong mà tải về hỏng (luồng Flow bỏ cuộc) — cũng là dấu hiệu tài khoản lỗi (nhật ký 16/10/2026:
   *  "Chờ 120s mà Google chưa xuất file" lặp 16 phút ở cùng một tài khoản). */
  async function ghiLoiTai(tab, chiSo) {
    if (!tab) return;
    soAnToanCua(tab.accountId).promptLoi.add(`${tab.id}#${tab._meKhoa || 0}#tai${chiSo}`);
    await xetTaiKhoan(tab);
  }

  async function xetTaiKhoan(tab) {
    const so = soAnToanCua(tab.accountId);
    if (so.dangXuLy) return;          // bảng đến dồn dập — một lần đổi / nghỉ là đủ
    const qd = anToan.canNghi(so, Date.now(), caiDatAnToan);
    if (!qd.nghi) return;
    so.dangXuLy = true;
    try {
      // Đang chạy Lower Priority và có model dự phòng: đổi model chạy tiếp, không nghỉ.
      if (await thuChuyenDuPhong(tab.accountId, qd)) return;
      await batDauNghi(tab.accountId, anToan.thoiGianNghi(so.soLanBiChan, caiDatAnToan), qd);
    } finally {
      so.dangXuLy = false;
    }
  }

  async function doCanhBaoTrenTrang(tab) {
    if (!tab || !tab.ready || tab.view.webContents.isDestroyed()) return null;
    try { return await tab.view.webContents.executeJavaScript('window.__flowDoCanhBao ? window.__flowDoCanhBao() : null', true); } catch (_) { return null; }
  }

  /** Tạm dừng mọi tab của một tài khoản, rồi hẹn giờ chạy lại. */
  async function batDauNghi(accountId, ms, qd) {
    const so = soAnToanCua(accountId);
    if (so.dangNghi) return;
    const ds = tabCungTaiKhoan(accountId).filter((t) => t.busy);
    // Không còn tab nào đang chạy (các việc đã báo lỗi về điều phối, điều phối tự lo) → bỏ dấu lỗi, kẻo
    // mẻ SAU của tài khoản này bị đổi oan ngay từ bảng đầu tiên (e2e Flow mục 10).
    if (!ds.length) { anToan.xoaDauLoi(so); return; }
    so.soLanBiChan += 1;
    const ten = ds[0].accountName || accountId || 'tài khoản';

    // Dự án còn tài khoản dự phòng (hoặc ảnh chuyển được sang Muse) → bộ điều phối cho tài khoản này
    // nghỉ, dừng các tab của nó, việc sang tài khoản khác NGAY.
    if (o.nghiTaiKhoan && o.nghiTaiKhoan(accountId, ms, `Flow lỗi: ${qd.lyDo}`)) {
      anToan.xoaDauLoi(so);
      log('error', `🛑 [${ten}] Tài khoản lỗi (${qd.lyDo}) — nghỉ ${anToan.doDai(ms)}, việc chuyển ngay sang tài khoản khác.`);
      return;
    }

    so.dangNghi = true;
    so.nghiDen = Date.now() + ms;
    log('error', `🛑 [${ten}] Tài khoản lỗi (${qd.lyDo}) và dự án không còn tài khoản Flow nào khác — TẠM DỪNG tài khoản này, tự chạy lại sau ${anToan.doDai(ms)}.`);
    for (const t of ds) {
      t.nghiAnToan = true;
      nhipTT.huy(t);   // cắt ngang khoảng nghỉ giữa thao tác đang chờ
      try { await tabs.dispatch(t.id, { action: 'PAUSE_AUTOMATION' }); } catch (_) {}
    }
    const cu = henChayLai.get(khoa(accountId));
    if (cu) clearTimeout(cu);
    henChayLai.set(khoa(accountId), setTimeout(() => ketThucNghi(accountId), ms));
  }

  async function ketThucNghi(accountId) {
    const so = soAnToanCua(accountId);
    henChayLai.delete(khoa(accountId));
    if (!so.dangNghi) return;
    so.dangNghi = false; so.nghiDen = 0; anToan.xoaDauLoi(so);
    const ds = tabCungTaiKhoan(accountId).filter((t) => t.nghiAnToan);
    log('success', `▶ [${(ds[0] && ds[0].accountName) || accountId}] Hết giờ nghỉ — chạy tiếp.`);
    for (const t of ds) {
      t.nghiAnToan = false;
      try { await tabs.dispatch(t.id, { action: 'RESUME_AUTOMATION' }); } catch (_) {}
    }
  }

  /** Bỏ mọi lịch nghỉ của một tài khoản (người dùng bấm Dừng). */
  function huyNghi(accountId) {
    const t = henChayLai.get(khoa(accountId));
    if (t) clearTimeout(t);
    henChayLai.delete(khoa(accountId));
    const so = soAnToan.get(khoa(accountId));
    if (so) { so.dangNghi = false; so.nghiDen = 0; }
    for (const tab of tabCungTaiKhoan(accountId)) tab.nghiAnToan = false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  MODEL VIDEO — chọn model, xen kẽ, dự phòng khi Lower Priority bị chặn
  //  Thời điểm đổi an toàn = lúc trả lời ACQUIRE_CREATE_SLOT (engine đứng chờ).
  // ══════════════════════════════════════════════════════════════════════
  const lpChan = new Map();
  const lpDangChan = (accountId) => { const x = lpChan.get(khoa(accountId)); return !!(x && x.den > Date.now()); };
  const nhipTao = new Map();
  const ghiNghiCua = (tab) => (msg) => log('info', String(msg).replace('💤', `💤 [${tab.id}]`));

  // ══════════════════════════════════════════════════════════════════════
  //  DÁN BÙ + CHỜ KHUNG Ô NHẬP SAU KHI GẮN ẢNH (1.3.2) — đọc đầu src/flow/main/dan-bu.js
  // ══════════════════════════════════════════════════════════════════════
  /** Đọc từng dòng nhật ký engine: prompt nào bắt đầu dán, đã gắn ảnh chưa, engine kẹt ở đâu. */
  function theoDoiDan(tab, chu) {
    const n = danBu.soCuaDongBatDauDan(chu);
    if (n) { tab._dan = { n, daDan: false, ganAnh: false }; return; }
    if (tab._dan && /🧑 Đã đính kèm ảnh/.test(chu)) tab._dan.ganAnh = true;
    if (/❌ Create button not found/.test(chu)) kiemHetTinDung(tab).catch(() => {});
    if (tab.onLoiKhungNhap && /❌ (Create button not found|Không tìm thấy ô tìm kiếm \(Search Box\))/.test(chu)) {
      try { tab.onLoiKhungNhap(chu.replace(/^\[\d+\]\s*/, '')); } catch (_) {}
    }
  }

  // Tài khoản không đủ tín dụng: Flow thay nút Tạo bằng nút cảnh báo (flow-bam-tao.js → canhBaoTinDung). Thử lại
  // không bao giờ ăn → nghỉ lâu, việc sang tài khoản khác ngay. Bấm Chạy lại thì mọi tài khoản được thử lại từ đầu.
  const NGHI_HET_TIN_DUNG_MS = 3 * 3600000;
  async function kiemHetTinDung(tab) {
    if (!tab || !tab.ready || !tab.view || tab.view.webContents.isDestroyed()) return null;
    const thamSo = JSON.stringify({ selector: selectorNguoiDung().createBtn || '' });
    const r = await tab.view.webContents.executeJavaScript(
      `window.__flowCanhBaoTinDung ? window.__flowCanhBaoTinDung(${thamSo}) : null`, true).catch(() => null);
    if (r && r.co) await baoHetTinDung(tab, r.chu);
    return r;
  }
  async function baoHetTinDung(tab, chu) {
    const so = soAnToanCua(tab.accountId);
    if (so.dangNghi || so.dangXuLy) return;
    if (tab._hetTinDung === (tab._meKhoa || 0)) return;   // mỗi mẻ báo một lần
    tab._hetTinDung = tab._meKhoa || 0;
    log('error', `💳 [${tab.id}] Flow thay nút Tạo bằng nút "${chu}" — tài khoản "${tab.accountName || tab.accountId}" không đủ credit ` +
      `cho model ${tab.modelHienTai || 'đang chọn'}. Không thử lại nữa.`);
    so.coCauChan = true;
    so.promptLoi.add(`${tab.id}#${tab._meKhoa || 0}#tin-dung`);
    so.dangXuLy = true;
    try {
      await batDauNghi(tab.accountId, NGHI_HET_TIN_DUNG_MS,
        { nghi: true, chacChan: true, soLoi: 1, lyDo: 'Flow báo không đủ tín dụng (hết credit)' });
    } finally {
      so.dangXuLy = false;
    }
  }
  /** Chờ ô nhập gõ được + nút Tạo hiện; bảng / lớp nền còn mở thì đóng. */
  async function choKhungNhap(tab, ms = 15000) {
    const wc = tab.view.webContents;
    const thamSo = JSON.stringify({ selector: selectorNguoiDung().createBtn || '' });
    const batDau = Date.now();
    let k = null, daDong = '';
    while (Date.now() - batDau < ms && !wc.isDestroyed()) {
      k = await wc.executeJavaScript(`window.__flowKhungNhap ? window.__flowKhungNhap(${thamSo}) : null`, true).catch(() => null);
      if (!k) return { ok: true, khongDo: true, daDong };
      if (k.lop && k.lop.length) {
        const r = await wc.executeJavaScript('window.__flowDongLopPhu ? window.__flowDongLopPhu(2) : null', true).catch(() => null);
        if (r && r.daDong && !daDong) daDong = r.daDong;
        if (r && r.conMo && r.conMo.length) await cho(500);
        continue;
      }
      if (k.oNhap && k.nut) return { ok: true, k, daDong, cho: Date.now() - batDau };
      if (k.hetTinDung) { await baoHetTinDung(tab, k.hetTinDung); return { ok: false, k, daDong, hetTinDung: k.hetTinDung, cho: Date.now() - batDau }; }
      await cho(400);
    }
    return { ok: false, k, daDong, cho: Date.now() - batDau };
  }
  function baoKhungNhap(tab, k) {
    if (k.daDong) log('info', `🧹 [${tab.id}] Gắn ảnh xong, Flow còn để lớp ${k.daDong} mở — đã đóng.`);
    if (!k.ok && !k.hetTinDung) log('warning', `⚠️ [${tab.id}] Sau khi gắn ảnh, ô nhập Flow chưa sẵn sàng sau ${Math.round(k.cho / 1000)} giây` +
      (k.k ? ` (ô nhập ${k.k.oNhap ? 'gõ được' : 'CHƯA gõ được'}, nút Tạo ${k.k.nut ? 'có' : 'CHƯA thấy'})` : '') + ' — vẫn làm tiếp.');
  }

  function ganNhipThaoTac(tab, settings) {
    const k = nhipTT.ganChoTab(tab, settings);
    if (k.bat) log('info', `💤 [${tab.id}] Nhịp thao tác: ${nhipTT.moTa(k)}.`);
    return k;
  }

  // ── Ảnh tham chiếu dính trong ô nhập (Flow 2.8.9) ─────────────────────
  async function ganAnhThamChieu(tab, settings) {
    tab.goAnhTC = thamChieu.nenGo(settings);
    tab.dungAnhTC = !!(settings && (settings.charSync || settings.keyframeSync));
    tab.soAnhTC = null;
    const d = await thamChieu.dem(tab.view.webContents);
    if (!d.ok) return;
    tab.soAnhTC = d.so;
    if (d.so) {
      log('warning', `🧷 [${tab.id}] Ô nhập đang có sẵn ${d.so} ảnh tham chiếu trước khi chạy` +
        (tab.goAnhTC ? ' — sẽ gỡ trước khi dán prompt đầu.'
          : ' — giữ nguyên (mẻ này dùng Character Sync / khung hình, hoặc đã tắt "Gỡ ảnh tham chiếu bị dính").'));
    }
  }
  async function theoDoiAnhThamChieu(tab, sauBuoc) {
    if (!tab || !tab.ready || tab.dungAnhTC) return null;
    const d = await thamChieu.dem(tab.view.webContents);
    if (!d.ok) return d;
    const truoc = tab.soAnhTC == null ? d.so : tab.soAnhTC;
    if (d.so > truoc) {
      log('warning', `🧷 [${tab.id}] Ô nhập vừa có thêm ${d.so - truoc} ảnh tham chiếu (đang có ${d.so}) — xuất hiện sau bước: ${sauBuoc}.` +
        (d.ds[0] ? ` Ảnh: …${d.ds[0].khoa.slice(-40)}` : ''));
    }
    tab.soAnhTC = d.so;
    return d;
  }
  async function donAnhThamChieuTruocKhiDan(tab) {
    const d = await theoDoiAnhThamChieu(tab, 'các bước sau prompt trước (đổi tên / tải về)');
    if (!d || !d.ok || !d.so || !tab.goAnhTC) return;
    const r = await thamChieu.goHet(tab.view.webContents);
    if (r.ok) log('info', `🧹 [${tab.id}] Đã gỡ ${r.daGo} ảnh tham chiếu bị dính trong ô nhập trước khi dán prompt${r.nut ? ` (nút "${r.nut}")` : ''}.`);
    else log('warning', `⚠️ [${tab.id}] Không gỡ được ảnh tham chiếu trong ô nhập (${r.lyDo}) — prompt này sẽ mang theo ${r.conLai} ảnh.`);
    tab.soAnhTC = r.conLai;
  }

  /** Chọn model cho mẻ ảnh. Để trống = giữ nguyên model đang chọn trên Flow. */
  async function datModelAnh(tab, settings) {
    const ten = String((settings && settings.modelAnh) || '').trim();
    if (!ten) { log('info', `🍌 [${tab.id}] Model ảnh: giữ nguyên model đang chọn trên Flow.`); return null; }
    // Đã trượt 2 mẻ liền với đúng model này → thôi thử ở tab này (mỗi lần thử mở/đóng bảng cài đặt
    // tốn vài giây và lặp một dòng cảnh báo cho mọi mẻ — nhật ký 15/10/2026).
    if (tab.boModelAnh === ten) return null;
    const r = await datModel(tab, ten, 'model ảnh', true);
    tab.modelHienTai = null;           // biến đó thuộc kế hoạch model VIDEO
    if (r && r.ok) tab.loiModelAnh = 0;
    else if ((tab.loiModelAnh = (tab.loiModelAnh || 0) + 1) >= 2) {
      tab.boModelAnh = ten;
      log('warning', `⚠️ [${tab.id}] Đổi model ảnh sang "${ten}" trượt 2 mẻ liền — tab này thôi thử, chạy bằng model đang chọn trên Flow. ` +
        'Muốn chắc model: chọn tay trên trang Flow một lần (Flow nhớ cho các lần sau), hoặc để trống ô Model ảnh.');
    }
    return r;
  }

  async function datModel(tab, ten, lyDo, baoKhiGiuNguyen = false) {
    if (!tab || !tab.ready || !ten) return { ok: false, lyDo: 'Tab chưa sẵn sàng' };
    let r;
    try {
      r = await tab.view.webContents.executeJavaScript(`window.__flowSetModel ? window.__flowSetModel(${JSON.stringify(ten)}) : null`, true);
    } catch (err) { r = { ok: false, lyDo: err.message }; }
    if (!r) r = { ok: false, lyDo: 'Trình chọn model chưa được tiêm vào tab' };
    if (r.ok) {
      tab.modelHienTai = r.model || ten;
      if (r.daDoi) {
        log('info', `🎚 [${tab.id}] Model → ${tab.modelHienTai}${r.tinDung != null ? ` (${r.tinDung} credit mỗi lần tạo)` : ''}${lyDo ? ` · ${lyDo}` : ''}`);
      } else if (baoKhiGiuNguyen) {
        log('info', `🎚 [${tab.id}] Model đang là ${tab.modelHienTai} — đúng kế hoạch, không cần đổi${r.tinDung != null ? ` (${r.tinDung} credit mỗi lần tạo)` : ''}.`);
      }
    } else {
      tab.modelHienTai = null;
      log('warning', `⚠️ [${tab.id}] Không đổi được model sang "${ten}": ${r.lyDo}. Tab chạy tiếp bằng model đang chọn trên trang.`);
      if (r.chiTiet) log('info', `   ↳ chẩn đoán: ${JSON.stringify(r.chiTiet)}`);
    }
    return r;
  }

  async function docModel(tab) {
    if (!tab || !tab.ready) return null;
    try { return await tab.view.webContents.executeJavaScript('window.__flowGetModel ? window.__flowGetModel() : null', true); } catch (_) { return null; }
  }

  /** Nhận kế hoạch model cho MỘT tab lúc giao mẻ (có thể ép giãn cách tối thiểu 1 giây). */
  async function chuanBiModel(tab, settings) {
    tab.keHoachModel = null; tab.demPromptMoi = 0; tab.modelHienTai = null; tab.loiModel = 0;
    if (!settings || settings.runMode !== 'video') return settings;
    let k = modelKH.chuanHoaKeHoach(settings.chonModel);
    if (!modelKH.coHieuLuc(k)) return settings;
    try {
      const r = await tab.view.webContents.executeJavaScript('window.__flowListModels ? window.__flowListModels() : null', true);
      if (r && r.ok && Array.isArray(r.ds) && r.ds.length) {
        const { keHoach, daBo } = modelKH.locTheoDanhSach(k, r.ds);
        const TEN_TRUONG = { chinh: 'Model chính', phu: 'Model phụ', duPhong: 'Model dự phòng' };
        for (const x of daBo) {
          log('warning', `⚠️ [${tab.id}] ${TEN_TRUONG[x.truong]} "${x.ten}" — Flow KHÔNG còn model này (đang có: ${r.ds.join(' · ')}). Bỏ qua cho mẻ này; vào Cài đặt → Flow → Model video chọn lại.`);
        }
        k = keHoach;
        if (!modelKH.coHieuLuc(k)) { log('info', `🎚 [${tab.id}] Model: giữ nguyên model đang chọn trên Flow.`); return settings; }
      }
    } catch (_) { /* đọc không được thì không lọc */ }
    if (!k.chinh) {
      const g = await docModel(tab);
      if (g && g.ok && g.model) { k.chinh = g.model; tab.modelHienTai = g.model; }
      else log('warning', `⚠️ [${tab.id}] Không đọc được model đang chọn trên Flow${g && g.lyDo ? ` (${g.lyDo})` : ''} — hãy điền ô "Model chính" cho chắc.`);
    }
    tab.keHoachModel = k;
    log('info', `🎚 [${tab.id}] Model: ${modelKH.moTaKeHoach(k)}`);
    if (lpDangChan(tab.accountId) && k.duPhong) {
      const x = lpChan.get(khoa(tab.accountId));
      log('info', `   ↳ Lower Priority của tài khoản này còn tránh thêm ${anToan.doDai(x.den - Date.now())} — prompt mới chạy bằng ${k.duPhong}.`);
    }
    return { ...settings, multiTabStagger: Math.max(1, Number(settings.multiTabStagger) || 0) };
  }

  /** Lower Priority vừa bị chặn: đổi các tab đang chạy nó sang dự phòng thay vì nghỉ. true = đã xử lý xong. */
  async function thuChuyenDuPhong(accountId, qd) {
    const ds = tabCungTaiKhoan(accountId).filter((t) => t.busy && t.keHoachModel && modelKH.nenChuyenDuPhong(t.keHoachModel, t.modelHienTai));
    if (!ds.length) return false;
    const so = soAnToanCua(accountId);
    if (so.dangChuyenModel) return true;
    so.dangChuyenModel = true;
    try {
      const cu = lpChan.get(khoa(accountId)) || { soLan: 0 };
      const soLan = cu.soLan + 1;
      const ms = modelKH.thoiGianTranhLp(soLan, ds[0].keHoachModel.thuLaiPhut);
      lpChan.set(khoa(accountId), { den: Date.now() + ms, soLan });
      const ten = ds[0].accountName || accountId || 'tài khoản';
      const duPhong = ds[0].keHoachModel.duPhong;
      log('error', `🚫 [${ten}] Lower Priority bị Flow chặn (${qd.lyDo}). Ngừng gửi Lower Priority ${anToan.doDai(ms)}, chuyển sang ${duPhong} (tốn credit) và chạy tiếp.`);
      anToan.xoaDauLoi(so);
      for (const t of ds) { t.nghiAnToan = true; nhipTT.huy(t); try { await tabs.dispatch(t.id, { action: 'PAUSE_AUTOMATION' }); } catch (_) {} }
      await cho(6000);
      const hong = [];
      for (const t of ds) {
        let r = null;
        for (let lan = 1; lan <= 3 && !(r && r.ok); lan++) {
          r = await datModel(t, duPhong, 'Lower Priority bị chặn');
          if (!(r && r.ok)) await cho(4000);
        }
        if (!(r && r.ok)) hong.push(t);
      }
      if (hong.length) {
        log('error', `❌ [${ten}] Không đổi được sang ${duPhong} — cho tài khoản nghỉ như chế độ an toàn.`);
        for (const t of ds) t.nghiAnToan = false;
        return false;
      }
      for (const t of ds) {
        if (!t.nghiAnToan) continue;           // người dùng vừa bấm Dừng → đừng tự bật dậy
        t.nghiAnToan = false;
        try { await tabs.dispatch(t.id, { action: 'RESUME_AUTOMATION' }); } catch (_) {}
      }
      log('success', `▶ [${ten}] Chạy tiếp bằng ${duPhong}.`);
      return true;
    } finally {
      so.dangChuyenModel = false;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CHẾ ĐỘ Image / Video — đổi bằng src/flow/inject/flow-mode.js
  // ══════════════════════════════════════════════════════════════════════
  const TEN_CHE_DO = { image: 'Hình ảnh', video: 'Video' };
  const TEN_PHU = { 'thanh-phan': 'Thành phần', 'khung-hinh': 'Khung hình' };
  async function datCheDo(tab, mode, imLang = false, tuy = null) {
    if (!tab || !tab.ready) return { ok: false, lyDo: 'Tab chưa sẵn sàng' };
    try {
      const thamSo = JSON.stringify(mode) + (tuy ? ', ' + JSON.stringify(tuy) : '');
      const r = await tab.view.webContents.executeJavaScript(`window.__flowSetMode && window.__flowSetMode(${thamSo})`, true);
      if (!r) return { ok: false, lyDo: 'Trình đổi chế độ chưa được tiêm' };
      if (r.ok && r.daDoi) log('success', `🎛 [${tab.id}] Đã tự đổi Flow sang mục ${TEN_CHE_DO[mode] || mode}`);
      // Mục con của Video (1.2.2): ảnh gắn @tên là "Thành phần", ảnh khung đầu/cuối là "Khung hình".
      if (r.ok && r.phu && r.daDoiPhu) log('success', `🎛 [${tab.id}] Đã chọn "${TEN_PHU[r.phu] || r.phu}" trong mục Video`);
      // Bản Flow chưa có cặp nút này thì báo MỘT lần mỗi tab, engine vẫn chạy tiếp như cũ.
      if (r.ok && r.phu && r.lyDoPhu && !(tab._daBaoPhu || (tab._daBaoPhu = new Set())).has(r.phu)) {
        tab._daBaoPhu.add(r.phu);
        log('warning', `⚠️ [${tab.id}] Không chọn được "${TEN_PHU[r.phu] || r.phu}" trong mục Video: ${r.lyDoPhu} — vẫn chạy tiếp.`);
      }
      else if (!r.ok && !imLang) {
        log('warning', `⚠️ [${tab.id}] Không tự đổi được sang chế độ ${mode}: ${r.lyDo}.`);
        if (r.chiTiet) log('info', `   ↳ chẩn đoán: ${JSON.stringify(r.chiTiet)}`);
      }
      return r;
    } catch (err) {
      return { ok: false, lyDo: err.message };
    }
  }
  /** Đổi chế độ, KIÊN TRÌ: Google chậm dựng bảng thì lần sau được. */
  async function datCheDoKienTri(tab, mode, soLan = 4, cachNhau = 8000, conChay = () => true, tuy = null) {
    for (let lan = 1; lan <= soLan; lan++) {
      const r = await datCheDo(tab, mode, lan < soLan, tuy);
      if (r && r.ok) return r;
      if (lan < soLan) {
        log('warning', `⏳ [${tab.id}] Chưa đổi được sang chế độ ${mode} (lần ${lan}/${soLan}) — thử lại sau ${Math.round(cachNhau / 1000)} giây.`);
        await cho(cachNhau);
        if (!tab.ready || !conChay()) return { ok: false, lyDo: 'Tab đã đóng / đã dừng' };
      }
    }
    return { ok: false, lyDo: `Đã thử ${soLan} lần, Flow vẫn không sang chế độ ${mode}` };
  }

  /**
   * Chuẩn bị tab trước khi giao một mẻ (đúng các bước của app:run:start bản Flow):
   * đổi chế độ → model ảnh → kế hoạch model video → kiểm selector người dùng → nhịp → ảnh tham chiếu.
   * @returns bộ cài đặt cuối cùng gửi cho engine
   */
  async function chuanBiMe(tab, settings, conChay) {
    // Số thứ tự prompt bắt đầu lại từ 1 mỗi mẻ → sổ đếm theo mẻ.
    tab._daDemLoi = new Set();
    tab._daDemXong = new Set();
    tab._meKhoa = Date.now();
    datCaiDatAnToan(settings.anToan);
    // Lưới dự án đang lọc theo loại (bản cũ từng bấm nhầm mục lọc ở thanh bên) → về "Tất cả", không thì thẻ mới khác loại không hiện.
    try {
      const loc = await tab.view.webContents.executeJavaScript('window.__flowBoLocLuoi ? window.__flowBoLocLuoi() : null', true);
      if (loc && loc.daBo) { log('info', `🧹 [${tab.id}] Lưới dự án Flow đang lọc "${loc.tu}" — đã chuyển về "Tất cả nội dung nghe nhìn".`); await cho(1500); }
    } catch (_) {}
    const doi = await datCheDoKienTri(tab, settings.runMode, 4, 8000, conChay, tuyCheDo(settings));
    if (!doi.ok) return { ok: false, lyDo: doi.lyDo };
    if (settings.runMode === 'image') await datModelAnh(tab, settings);
    const caiDat = await kiemTruocKhiChay(tab.view.webContents, await chuanBiModel(tab, settings),
      (lvl, msg) => log(lvl, `[${tab.id}] ${msg}`));
    ganNhipThaoTac(tab, settings);
    await ganAnhThamChieu(tab, settings);
    return { ok: true, caiDat };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SELECTOR NGƯỜI DÙNG TỰ CHỈ — trình tiêm chạy ngoài engine phải tự đọc
  // ══════════════════════════════════════════════════════════════════════
  const selectorNguoiDung = () => ((o.layCaiDat && o.layCaiDat()) || {}).selectors || {};

  // ══════════════════════════════════════════════════════════════════════
  //  BỘ ĐỊNH TUYẾN MESSAGE TỪ ENGINE — mọi action engine GỬI phải có case
  // ══════════════════════════════════════════════════════════════════════
  async function handleEngineMessage(message, senderWc) {
    const action = message && message.action;
    const tab = tabs.findByWcId(senderWc.id);
    const tabId = tab ? tab.id : null;

    switch (action) {
      case 'LOG': {
        const chu = String(message.message || '');
        if (tab && tab.ghiNhatKy) tab.ghiNhatKy(message.type || 'info', chu);
        if (tab) theoDoiDan(tab, chu);
        // Engine không chọn được mục chất lượng nào trong menu Tải xuống → luồng lưu tệp chẩn đoán (kèm menu).
        if (tab && tab.onLoiChatLuong && /Không chọn được chất lượng tải xuống/.test(chu)) { try { tab.onLoiChatLuong(chu); } catch (_) {} }
        // Nhật ký engine rất dày: chỉ đẩy lên nhật ký app dòng cảnh báo / lỗi / thành công.
        if (message.type === 'error' || message.type === 'warning' || message.type === 'success') log(message.type, `[${tabId}] ${chu}`);
        return { success: true };
      }

      // Engine gửi { creating, completed, error } — KHÔNG phải { done, failed }.
      case 'UPDATE_STATS': {
        const d = message.data || {};
        if (tab) tab.stats = { running: d.creating || 0, done: d.completed || 0, failed: d.error || 0 };
        return { success: true };
      }

      // Engine gửi data = { rows, isRunning, … } — rows mới là mảng.
      case 'UPDATE_TABLE_DATA': {
        const d = message.data || {};
        const hangs = Array.isArray(d.rows) ? d.rows : [];
        if (tab && typeof d.isRunning === 'boolean') tab.busy = d.isRunning;
        if (tab) theoDoiAnToan(tab, hangs).catch(() => {});
        if (tab && tab.onBang) { try { tab.onBang(hangs, d); } catch (err) { log('error', `[${tabId}] ${err.message}`); } }
        return { success: true };
      }

      case 'UPDATE_PROGRESS':
        return { success: true };

      // ── DÁN PROMPT — đường CDP, không bị cắt ở 1.000 ký tự ──────────────
      case 'INJECT_PASTE': {
        if (!tab) return { ok: false, error: 'Không xác định được tab gửi yêu cầu' };
        const text = (message.data && message.data.text) || '';
        const ghiNghi = ghiNghiCua(tab);
        if (tab._dan) tab._dan.daDan = true;
        // Vừa gắn ảnh @tên: Flow dựng lại khung ô nhập, có khi để sót lớp nền của bảng kho → chờ khung yên rồi mới dán.
        if (tab._dan && tab._dan.ganAnh) baoKhungNhap(tab, await choKhungNhap(tab));
        await donAnhThamChieuTruocKhiDan(tab).catch(() => {});
        await nhipTT.nghi(tab, 'truocNhap', ghiNghi);
        const result = await pastePrompt(tab.view.webContents, text, (lvl, msg) => { if (lvl !== 'info') log(lvl, `[${tabId}] ${msg}`); });
        // Nghỉ SAU khi dán, TRƯỚC khi trả lời: engine chụp lưới rồi bấm Tạo ngay khi nhận trả lời.
        if (result && result.ok) await nhipTT.nghi(tab, 'truocTao', ghiNghi);
        return { ok: result.ok, hasZeroWidth: !result.ok, error: result.error, ...result };
      }

      // ── BẤM NÚT TẠO — chuột thật trước, rồi các kiểu JS (flow-bam-tao.js) ─
      //  CẤM nghỉ/chờ ở đây: lưới đã được chụp, chờ là nhận nhầm thẻ của prompt trước.
      case 'INJECT_CLICK_CREATE': {
        if (!tab) return { ok: false, error: 'Không xác định được tab' };
        setTimeout(() => theoDoiAnhThamChieu(tab, 'bấm Tạo').catch(() => {}), 8000);
        const sel = selectorNguoiDung().createBtn || '';
        const wc = tab.view.webContents;
        // Engine bỏ qua bước dán (không có INJECT_PASTE cho prompt này) → dán bù rồi mới bấm.
        //  KHÔNG nghỉ theo nhịp thao tác ở đây (lưới đã chụp — xem dòng trên): chỉ chờ khung ô nhập yên, dán, 1 giây.
        if (tab._dan && !tab._dan.daDan) {
          const d = tab._dan;
          d.daDan = true;
          const chu = danBu.chuDanCua(tab.promptsMe, d.n, tab.caiDatEngine);
          if (chu == null) {
            log('error', `❌ [${tab.id}] Engine chưa dán prompt [${d.n}] vào ô nhập Flow mà app không dựng lại được chữ — lần bấm Tạo này có thể không ăn.`);
          } else {
            log('warning', `🩹 [${tab.id}] Engine bỏ qua bước dán prompt [${d.n}]${d.ganAnh ? ' (ngay sau khi gắn ảnh, ô nhập Flow chưa gõ được)' : ''} — app tự dán rồi mới bấm Tạo.`);
            baoKhungNhap(tab, await choKhungNhap(tab));
            const kq = await pastePrompt(wc, chu, (lvl, msg) => { if (lvl !== 'info') log(lvl, `[${tab.id}] ${msg}`); });
            if (!kq || !kq.ok) {
              log('error', `❌ [${tab.id}] Dán bù prompt [${d.n}] hỏng: ${(kq && kq.error) || 'không rõ'}`);
              return { ok: false, error: `Không dán được prompt vào ô nhập Flow: ${(kq && kq.error) || 'không rõ'}` };
            }
            await cho(1000);
          }
        }
        try {
          const cb = await wc.executeJavaScript(`window.__flowBamTaoChuanBi ? window.__flowBamTaoChuanBi(${JSON.stringify({ selector: sel })}) : null`, true);
          if (cb && cb.wasDisabled) { log('error', `❌ [${tab.id}] ${cb.error}`); return cb; }
          if (cb && cb.ok) {
            if (cb.daGo && cb.trung) log('info', `🧹 [${tab.id}] Trang Flow còn lớp ${cb.daGo} mở (che nút Tạo) — đã đóng rồi mới bấm.`);
            else if (!cb.trung) log('warning', `⚠️ [${tab.id}] Tâm nút Tạo đang bị lớp khác che${cb.che ? ` (${cb.che})` : ''} — vẫn thử bấm chuột thật.`);
            const b = await bamChuotThat(wc, cb.x, cb.y);
            if (b.ok) {
              let kq = null;
              for (let i = 0; i < 10; i++) {
                await cho(500);
                kq = await wc.executeJavaScript('window.__flowBamTaoKiem()', true).catch(() => null);
                if (kq && kq.an) break;
              }
              if (kq && kq.an) {
                log('info', `🖱 [${tab.id}] Nút Tạo ăn ở kiểu bấm "chuột thật" (tìm nút bằng: ${cb.via})`);
                return { ok: true, wasDisabled: false, kieu: 'chuot-that', via: cb.via, nut: cb.nut, truoc: cb.truoc };
              }
              log('warning', `⚠️ [${tab.id}] Bấm chuột thật chưa thấy Flow nhận sau 5 giây — thử các kiểu bấm cũ.` +
                (kq && kq.loiTrenTrang && kq.loiTrenTrang.length ? ` Flow đang báo: "${kq.loiTrenTrang.join('" · "')}"` : ''));
              // Có thể Flow vừa nhận ngay lúc hết giờ — nhận rồi thì TUYỆT ĐỐI không bấm thêm.
              const kq2 = await wc.executeJavaScript('window.__flowBamTaoKiem()', true).catch(() => null);
              if (kq2 && kq2.an) return { ok: true, wasDisabled: false, kieu: 'chuot-that', via: cb.via, nut: cb.nut };
            } else {
              log('warning', `⚠️ [${tab.id}] Không bấm chuột thật được (${b.error}) — thử các kiểu bấm cũ.`);
            }
          }
        } catch (err) {
          log('warning', `⚠️ [${tab.id}] Bấm chuột thật lỗi: ${err.message} — thử các kiểu bấm cũ.`);
        }
        try {
          const r = await wc.executeJavaScript(`window.__flowBamTao ? window.__flowBamTao(${JSON.stringify({ selector: sel })}) : window.__flowClickCreate()`, true);
          if (r && r.ok && r.kieu) log('info', `🖱 [${tab.id}] Nút Tạo ăn ở kiểu bấm "${r.kieu}" (tìm nút bằng: ${r.via})`);
          else if (r && !r.ok) {
            log('error', `❌ [${tab.id}] ${r.error || 'Không bấm được nút Tạo'} (kể cả bấm chuột thật)`);
            const ds = (r.loiTrenTrang || []).filter(Boolean);
            if (ds.length) log('error', `   ↳ Flow đang báo trên trang: "${ds.join('" · "')}"`);
            if (r.nut) log('info', `   ↳ Nút app đang bấm: <${r.nut.tag}> aria-label="${r.nut.aria}" class="${r.nut.cls}"`);
          }
          return r;
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }

      case 'INJECT_RENAME_INPUT': {
        if (!tab) return { ok: false, error: 'Không xác định được tab' };
        const newName = (message.data && message.data.newName) || '';
        await nhipTT.nghi(tab, 'truocDoiTen', ghiNghiCua(tab));
        try {
          const found = await tab.view.webContents.executeJavaScript(`window.__flowRenameInput(${JSON.stringify(newName)})`, true);
          setTimeout(() => theoDoiAnhThamChieu(tab, `đổi tên "${newName}"`).catch(() => {}), 1500);
          return found;
        } catch (err) {
          return { ok: false, error: err.message };
        }
      }

      // ── Hàng đợi tên file — theo TỪNG TAB ───────────────────────────────
      case 'SET_NEXT_FILENAME': {
        if (!tabId) return { success: false, error: 'Không rõ tab' };
        // Lúc menu tải về đang mở, Flow 10/2026 hiện ảnh của thẻ cạnh ô nhập rồi tự gỡ khi menu đóng
        // (nhật ký 15/10: mẻ sau ô nhập trống) → chỉ báo nếu 5 giây sau ảnh VẪN còn.
        if (tab) setTimeout(() => theoDoiAnhThamChieu(tab, 'mở menu thẻ để tải về (5 giây sau vẫn còn)').catch(() => {}), 5000);
        if (tab) await nhipTT.nghi(tab, 'truocTai', ghiNghiCua(tab));
        return { success: true, queueSize: taiVe.pushName(tabId, message.filename) };
      }
      case 'UNSET_NEXT_FILENAME':
        if (!tabId) return { success: false };
        taiVe.popName(tabId, message.filename);
        return { success: true };
      case 'CLEAR_FILENAME_QUEUE':
        taiVe.clear(message.all ? null : tabId);
        return { success: true };

      // ── Trạng thái chạy ─────────────────────────────────────────────────
      //  AUTOMATION_RESUMED chỉ bắn khi TIẾP TỤC, không bắn khi bắt đầu — tab bận
      //  được đánh dấu lúc giao mẻ và theo isRunning của UPDATE_TABLE_DATA.
      case 'AUTOMATION_RESUMED':
        if (tab) tab.busy = true;
        return { success: true };
      case 'AUTOMATION_STOPPED':
        if (tab) tab.busy = false;
        if (tab && tab.onDung) setTimeout(() => { try { tab.onDung(); } catch (_) {} }, 1500);
        return { success: true };

      // Electron đưa webContents vào will-download nên KHÔNG cần khoá tải: cấp ngay
      // (trả {success:false} là engine chờ đúng 420 giây).
      case 'ACQUIRE_DOWNLOAD_LOCK':
      case 'RENEW_DOWNLOAD_LOCK':
      case 'RELEASE_DOWNLOAD_LOCK':
        return { ok: true };

      // Thiếu case này là ba tab dùng chung khoá 'single' và ghi đè dự án của nhau.
      case 'REGISTER_TAB':
        if (!tab) return { ok: false, error: 'Không nhận ra tab gửi lệnh' };
        return { ok: true, tabId: tab.id, slot: tab.slot || 1 };

      case 'TAB_STATUS':
        return { success: true };

      // Trước mỗi prompt MỚI engine xin lượt và ĐỨNG CHỜ — lúc duy nhất đổi model mà không giẫm chân nó.
      case 'ACQUIRE_CREATE_SLOT': {
        if (tab && tab.keHoachModel) {
          tab.demPromptMoi = (tab.demPromptMoi || 0) + 1;
          const { model, lyDo } = modelKH.modelChoPrompt(tab.keHoachModel, tab.demPromptMoi, lpDangChan(tab.accountId));
          const canDoi = model && (!tab.modelHienTai || !modelKH.cungModel(tab.modelHienTai, model) || tab.demPromptMoi % 10 === 0);
          if (canDoi) {
            await nhipTT.nghi(tab, 'truocModel', ghiNghiCua(tab));
            const r = await datModel(tab, model, lyDo, tab.demPromptMoi === 1);
            tab.loiModel = r && r.ok ? 0 : (tab.loiModel || 0) + 1;
            if (tab.loiModel >= 3) {
              log('error', `❌ [${tab.id}] 3 lần liền không đổi được model — tắt kế hoạch model cho mẻ này, chạy tiếp bằng model đang chọn.`);
              tab.keHoachModel = null;
            }
          }
        }
        const gap = Math.max(0, Number(message.gapMs) || 0);
        if (!gap) return { waitMs: 0 };
        const acc = tab && tab.accountId ? tab.accountId : 'chung';
        const moc = Math.max(Date.now(), (nhipTao.get(acc) || 0) + gap);
        nhipTao.set(acc, moc);
        return { waitMs: Math.max(0, moc - Date.now()) };
      }

      // Tab xong trước KHÔNG được tắt máy khi tab khác còn chạy.
      case 'CAN_SHUTDOWN': {
        const conChay = tabs.tabs.filter((t) => t.busy && t.id !== tabId);
        if (!conChay.length && !(o.conViec && o.conViec())) return { ok: true };
        return { ok: false, waiting: conChay.map((t) => ({ slot: t.slot, tabId: t.id, done: (t.stats && t.stats.done) || 0, total: t.assigned || 0 })) };
      }

      case 'CHECK_TAB_ACTIVE':
        return { active: true, tabId };
      case 'CLOSE_CURRENT_TAB':
        return { success: true };                     // tab do luồng giữ — không cho engine tự đóng
      case 'SET_TAB_ZOOM':
        if (tab) tab.view.webContents.setZoomFactor(parseFloat(message.zoom) || 0.8);
        return { success: true };

      case 'SAVE_PROJECT':
      case 'PROJECT_LOADED':
      case 'PROJECT_DELETED':
        return { success: true };

      // Người dùng vừa chỉ một phần tử trên trang Flow (hoặc bấm Esc).
      case 'PICK_RESULT':
        log('success', `🎯 Đã chỉ lại "${(message.data && message.data.targetType) || '?'}": ${(message.data && message.data.selector) || ''} (khớp ${(message.data && message.data.matches) || 0} phần tử)`);
        if (o.daChonPhanTu) o.daChonPhanTu(message.data || null);
        return { success: true };
      case 'PICK_CANCELLED':
        if (o.daChonPhanTu) o.daChonPhanTu(null);
        return { success: true };

      // Engine vừa kết luận một phần tử giao diện Flow đã vỡ.
      case 'UI_BREAK':
        log('error', `🧩 [${tabId}] Giao diện Flow có phần tử không dò được: ${JSON.stringify(message.data || {}).slice(0, 300)} — Google có thể vừa đổi giao diện Flow; gửi Nhật ký cho người phát triển.`);
        return { success: true };

      case 'TRIGGER_SHUTDOWN': {
        const delay = parseInt(message.delay, 10) || 60;
        if (process.platform === 'win32') {
          log('warning', `⚠️ Sẽ tắt máy sau ${delay} giây. Huỷ bằng lệnh: shutdown /a`);
          exec(`shutdown /s /t ${delay}`, (err) => { if (err) log('error', `❌ Không gọi được lệnh tắt máy: ${err.message}`); });
        } else if (process.platform === 'darwin') {
          log('warning', `⚠️ Sẽ tắt máy sau ${delay} giây. Muốn huỷ: thoát app trước lúc đó.`);
          setTimeout(() => {
            exec(`osascript -e 'tell application "System Events" to shut down'`, (err) => {
              if (err) log('error', `❌ macOS không cho tắt máy: ${err.message}. Vào Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Tự động hoá, bật System Events cho AI Automation Studio.`);
            });
          }, delay * 1000);
        } else {
          log('warning', 'Tắt máy tự động chỉ hỗ trợ Windows và macOS.');
        }
        return { success: true };
      }
      case 'SHUTDOWN_TRIGGERED':
        return { success: true };
      case 'NOTIFY':
        if (o.thongBao) o.thongBao(message.title || 'AI Automation Studio', message.message || '');
        return { success: true };

      default:
        return { success: false, error: `Action chưa hỗ trợ: ${action}` };
    }
  }

  return {
    handleEngineMessage, theoDoiAnToan, ghiLoiTai, datCaiDatAnToan, huyNghi, chuanBiMe, chuanBiModel, datCheDo,
    datModelAnh, docModel, soAnToanCua, lpChan, selectorNguoiDung, tabCungTaiKhoan, theoDoiAnhThamChieu,
    _anToan: () => caiDatAnToan
  };
}

module.exports = { taoMayFlow, tuyCheDo };
