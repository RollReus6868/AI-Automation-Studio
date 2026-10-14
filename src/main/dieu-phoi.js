'use strict';
// ============================================================================
//  dieu-phoi.js — BỘ ĐIỀU PHỐI: giữ dự án, hàng đợi, nhân vật, cài đặt; chia
//  việc cho các luồng của mọi tài khoản đang bật; lưu file kết quả.
//
//  Hai nền tảng chung MỘT hàng đợi: việc có `nen` = 'muse' | 'flow', tài khoản
//  cũng có `nen`. Luồng Muse nhận từng việc (luong.chay); luồng Flow nhận cả MẺ
//  việc cùng dự án / loại / tỷ lệ (luong.chayMe) vì engine Flow chạy theo mẻ.
//  Cơ chế tài khoản chính → dự phòng, tạm nghỉ, thử lại… dùng chung cho cả hai.
//
//  Không require('electron') — main.js đưa vào các hàm cần (tạo luồng, đọc/ghi
//  file) nên tests/e2e-main.js dựng được với trang Muse giả.
// ============================================================================

const path = require('path');
const hd = require('./hang-doi');
const { chuanHoaFlow, khoaMe } = require('../flow/cai-dat-flow');

const NGHI_MS = 15 * 60 * 1000;   // tài khoản lỗi liên tiếp / mất kết nối → tạm nghỉ chừng này
const LOI_LIEN_TIEP_NGHI = 2;      // lỗi liên tiếp bao nhiêu việc thì cho tài khoản tạm nghỉ
const TEN_NEN = { muse: 'Muse', flow: 'Flow' };

const CAI_DAT_MAC_DINH = {
  thuMucAnh: '',          // trống = Tài liệu/AI Automation Studio (thư mục chung của Muse và Flow)
  thuMucVideo: '',
  taiAnh: true,           // tắt: file chỉ giữ trong bộ nhớ tạm của app (vẫn xem được, vẫn làm video được)
  taiVideo: true,
  tenAnh: hd.MAU_TEN_MAC_DINH,
  tenVideo: hd.MAU_TEN_MAC_DINH,
  luongMoiTK: 3,          // số luồng chạy song song mỗi tài khoản
  nghiGiuaLanGui: 3,      // giây nghỉ giữa 2 lần gửi prompt của CÙNG tài khoản
  // Bình thường ảnh ~35 s, video ~80 s. Quá lâu chừng này coi là lỗi → chuyển sang tài khoản dự phòng.
  choAnhGiay: 180,        // chờ tối đa một ảnh
  choVideoGiay: 300,      // chờ tối đa một video
  choChuGiay: 60,         // Muse trả chữ không kèm ảnh bao lâu thì coi là hỏi lại (video ×2)
  tuThuLai: 1,            // tự thử lại mấy lần khi lỗi (ngay lúc lỗi; có tài khoản dự phòng thì thử thêm ở mỗi tài khoản)
  tuChayLaiLoi: 2,        // hết hàng chờ mà còn việc lỗi → tự đưa về chạy lại, tối đa mấy lượt
  tatMayKhiXong: false,   // chạy hết hàng chờ thì tắt máy (Windows, macOS) — như Flow Automation Studio
  png: true,              // đổi ảnh webp của Muse sang png
  tachPrompt: 'dong',     // 'dong' | 'doan'
  mau: { ...hd.MAU_MAC_DINH },
  flow: chuanHoaFlow({})  // cài đặt Google Flow (src/flow/cai-dat-flow.js)
};

class DieuPhoi {
  /**
   * @param o.store, o.taiKhoan (QuanLyTaiKhoan)
   * @param o.taoLuong(taiKhoan, stt) → Luong      o.huyLuong(luong)
   * @param o.docFile(duongDan) → {ten, mime, b64}
   * @param o.ghiFile(duongDanTuyetDoi, Buffer)
   * @param o.thuMucRaMacDinh   o.thuMucTam (file khi tắt tải về)   o.tonTai(p)
   * @param o.log(muc, chu)   o.bao()  (trạng thái đổi)
   */
  constructor(o) {
    this.o = o;
    const s = o.store.get(['duAn', 'viec', 'nhanVat', 'caiDat', 'mauPrompt']);
    this.duAn = Array.isArray(s.duAn) && s.duAn.length ? s.duAn
      : [{ id: 'mac-dinh', ten: 'Mặc định', so: 0, taoLuc: Date.now() }];
    this.viec = Array.isArray(s.viec) ? s.viec : [];
    this.nhanVat = Array.isArray(s.nhanVat) ? s.nhanVat : [];
    this.mauPrompt = Array.isArray(s.mauPrompt) ? s.mauPrompt : [];
    this.caiDat = { ...CAI_DAT_MAC_DINH, ...(s.caiDat || {}) };
    this.caiDat.mau = { ...hd.MAU_MAC_DINH, ...(this.caiDat.mau || {}) };
    this.caiDat.flow = chuanHoaFlow(this.caiDat.flow);
    // 1.0.0 có một thư mục chung "thuMucRa" → dùng làm thư mục cho cả ảnh lẫn video.
    if (this.caiDat.thuMucRa) {
      this.caiDat.thuMucAnh = this.caiDat.thuMucAnh || this.caiDat.thuMucRa;
      this.caiDat.thuMucVideo = this.caiDat.thuMucVideo || this.caiDat.thuMucRa;
      delete this.caiDat.thuMucRa;
    }
    // 1.6.0: thời gian chờ mặc định ngắn lại (lỗi là chuyển tài khoản) — đổi giá trị mặc định cũ đã lưu.
    if (!this.caiDat.moc) {
      if (this.caiDat.choAnhGiay === 240) this.caiDat.choAnhGiay = 180;
      if (this.caiDat.choVideoGiay === 600) this.caiDat.choVideoGiay = 300;
      this.caiDat.moc = 1;
    }
    // Việc đang chạy lúc app tắt → về hàng chờ, GIỮ thread để lấy lại kết quả.
    for (const j of this.viec) if (j.trangThai === 'chay') { j.trangThai = 'cho'; j.buoc = ''; }
    this.luong = [];          // [{luong, taiKhoanId}]
    this.lanGui = {};         // taiKhoanId → thời điểm gửi gần nhất
    this.nghiDen = {};        // taiKhoanId → tạm nghỉ tới lúc (lỗi liên tiếp / mất kết nối)
    this.lyDoNghi = {};       // taiKhoanId → lý do tạm nghỉ
    this.loiLienTiep = {};    // taiKhoanId → số việc lỗi liên tiếp
    this.dangChay = false;
    this.idMoi = this.viec.reduce((m, j) => Math.max(m, j.id || 0), 0) + 1;
    this.luu();
    this.hen = setInterval(() => this._vong(), 1000);
  }

  log(m, c) { this.o.log(m, c); }
  thuMucRa(loai) {
    return (loai === 'video' ? this.caiDat.thuMucVideo : this.caiDat.thuMucAnh) || this.o.thuMucRaMacDinh;
  }

  luu() {
    this.o.store.set({ duAn: this.duAn, viec: this.viec, nhanVat: this.nhanVat,
      caiDat: this.caiDat, mauPrompt: this.mauPrompt });
    this.o.bao();
  }

  trangThai() {
    return {
      duAn: this.duAn, viec: this.viec, nhanVat: this.nhanVat, caiDat: this.caiDat,
      mauPrompt: this.mauPrompt, dangChay: this.dangChay,
      thuMuc: { anh: this.thuMucRa('anh'), video: this.thuMucRa('video') },
      luong: this.luong.map((x) => ({ id: x.luong.id, taiKhoanId: x.taiKhoanId, nen: x.luong.nen || 'muse',
        viecId: x.luong.viec ? x.luong.viec.id : null })),
      duKien: { anh: hd.thoiGianDuKien(this.viec, 'anh'), video: hd.thoiGianDuKien(this.viec, 'video') }
    };
  }

  // ── Dự án ────────────────────────────────────────────────────────────────
  taoDuAn(ten, taiKhoan) {
    const t = String(ten || '').trim() || `Dự án ${this.duAn.length + 1}`;
    let id = hd.slugTen(t).toLowerCase(), n = 2;
    while (this.duAn.some((d) => d.id === id)) id = `${hd.slugTen(t).toLowerCase()}-${n++}`;
    const d = { id, ten: t, so: 0, taoLuc: Date.now() };
    if (Array.isArray(taiKhoan)) d.taiKhoan = [...new Set(taiKhoan.filter((x) => this.o.taiKhoan.tim(x)))];
    this.duAn.push(d);
    this.luu();
    return d;
  }
  /** Tài khoản chạy dự án, theo thứ tự ưu tiên: [chính, dự phòng…]. */
  datTaiKhoanDuAn(id, ds) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return false;
    d.taiKhoan = [...new Set((ds || []).filter((t) => this.o.taiKhoan.tim(t)))];
    this.luu();
    return true;
  }
  /**
   * Tài khoản của dự án trên một nền tảng, theo thứ tự ưu tiên [chính, dự phòng…].
   * Dự án chưa chọn tài khoản nào của nền tảng đó = mọi tài khoản của nền tảng đó.
   */
  _dsTkGoc(duAnId, nen = 'muse') {
    const d = this.duAn.find((x) => x.id === duAnId);
    const cuaNen = (id) => { const a = this.o.taiKhoan.tim(id); return a && (a.nen || 'muse') === nen; };
    const chon = d && d.taiKhoan ? d.taiKhoan.filter(cuaNen) : [];
    return chon.length ? chon : this.o.taiKhoan.ds.filter((a) => (a.nen || 'muse') === nen).map((a) => a.id);
  }
  /** Như trên, bỏ tài khoản đã xoá / chưa đăng nhập. */
  _dsTk(duAnId, nen = 'muse') {
    return this._dsTkGoc(duAnId, nen).filter((id) => { const a = this.o.taiKhoan.tim(id); return a && a.trangThai !== 'can-dang-nhap'; });
  }
  _nghi(id) { return (this.nghiDen[id] || 0) > Date.now(); }
  _tenTk(id) { const a = this.o.taiKhoan.tim(id); return a ? a.ten : id; }

  doiTenDuAn(id, ten) {
    const d = this.duAn.find((x) => x.id === id);
    if (d && String(ten || '').trim()) { d.ten = String(ten).trim(); this.luu(); }
  }
  xoaDuAn(id) {
    if (this.duAn.length <= 1) return { ok: false, loi: 'Phải giữ lại ít nhất một dự án' };
    if (this.viec.some((j) => j.duAn === id && j.trangThai === 'chay')) return { ok: false, loi: 'Dự án đang có việc chạy' };
    this.duAn = this.duAn.filter((d) => d.id !== id);
    this.viec = this.viec.filter((j) => j.duAn !== id);
    this.luu();
    return { ok: true };
  }

  // ── Thêm việc ────────────────────────────────────────────────────────────
  /**
   * @param p { duAn, loai, prompts:[...], tyLe, thamChieu:[...] (dùng cho mọi prompt),
   *            thamChieuTheoDong:[[...],...] (ảnh thứ i cho prompt thứ i — theo số thứ tự GỐC),
   *            tuSo, denSo (chỉ chạy prompt từ số … đến số …, đếm từ 1),
   *            nhanVatIds:[...] (chế độ Người mẫu), tuNhanVat:bool, soBan, hauTo,
   *            chuoiVideo:{prompt, tyLe} (ảnh xong → tự tạo video từ ảnh đó), chay:bool }
   */
  them(p) {
    const d = this.duAn.find((x) => x.id === p.duAn) || this.duAn[0];
    const tatCa = (p.prompts || []).map((x) => String(x).trim()).filter(Boolean);
    if (!tatCa.length) return { ok: false, loi: 'Chưa có prompt nào' };
    const chon = hd.chonKhoang(tatCa, p.tuSo, p.denSo);
    if (!chon.length) return { ok: false, loi: `Khoảng prompt không hợp lệ (chỉ có ${tatCa.length} prompt)` };
    const soBan = Math.max(1, Math.min(10, parseInt(p.soBan, 10) || 1));
    const loai = p.loai === 'video' ? 'video' : 'anh';
    const nen = p.nen === 'flow' ? 'flow' : 'muse';
    // Ảnh xong → tự tạo video, chạy ở Muse hoặc Flow tuỳ người dùng chọn (mặc định cùng nền tảng với ảnh).
    const cv = p.chuoiVideo && String(p.chuoiVideo.prompt || '').trim() && loai === 'anh'
      ? { prompt: String(p.chuoiVideo.prompt).trim(), tyLe: hd.TY_LE.includes(p.chuoiVideo.tyLe) ? p.chuoiVideo.tyLe : '',
        nen: p.chuoiVideo.nen === 'flow' || p.chuoiVideo.nen === 'muse' ? p.chuoiVideo.nen : nen } : null;
    const moi = [];
    for (const { prompt: pr, stt } of chon) {
      const text = p.hauTo ? `${pr} ${String(p.hauTo).trim()}` : pr;
      let nv = (p.nhanVatIds || []).filter((id) => this.nhanVat.some((n) => n.id === id));
      if (!nv.length && p.tuNhanVat) nv = hd.timNhanVat(pr, this.nhanVat).map((n) => n.id);
      const thamChieu = [...(p.thamChieu || []), ...((p.thamChieuTheoDong && p.thamChieuTheoDong[stt - 1]) || [])];
      for (let b = 0; b < soBan; b++) {
        moi.push(this._viecMoi(d, { nen, loai, prompt: text, stt, tyLe: p.tyLe, thamChieu, nhanVat: nv, chuoi: cv }));
      }
    }
    this.viec.push(...moi);
    this.luu();
    const khoang = chon.length < tatCa.length ? ` (prompt ${chon[0].stt}–${chon[chon.length - 1].stt})` : '';
    this.log('info', `➕ Thêm ${moi.length} việc ${loai === 'video' ? 'video' : 'ảnh'} ${TEN_NEN[nen]}${khoang} vào "${d.ten}"` +
      (cv ? ` — ảnh xong sẽ tự tạo video ở ${TEN_NEN[cv.nen]}` : ''));
    if (p.chay) this.chayTatCa();
    return { ok: true, so: moi.length };
  }

  _viecMoi(d, v) {
    d.so += 1;
    return {
      id: this.idMoi++, nen: v.nen === 'flow' ? 'flow' : 'muse', duAn: d.id, so: d.so, stt: v.stt || d.so, loai: v.loai,
      prompt: v.prompt, tyLe: hd.TY_LE.includes(v.tyLe) ? v.tyLe : '9:16', thamChieu: v.thamChieu || [],
      nhanVat: v.nhanVat || [], chuoi: v.chuoi || null, tuAnh: v.tuAnh || 0,
      trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', files: [], tam: false, loi: '', thu: 0,
      taoLuc: Date.now(), batDauLuc: 0, xongLuc: 0
    };
  }

  /** Ảnh vừa xong có hẹn "tự tạo video" → thêm việc video dùng ảnh đó làm khung đầu (chỉ một lần). */
  _noiVideo(j, d) {
    if (j.loai !== 'anh' || !j.chuoi || j.daNoiVideo || !j.files[0]) return;
    j.daNoiVideo = true;
    const nen = j.chuoi.nen || j.nen || 'muse';
    const v = this._viecMoi(d, { nen, loai: 'video', prompt: j.chuoi.prompt, stt: j.stt, tyLe: j.chuoi.tyLe || j.tyLe,
      thamChieu: [j.files[0]], tuAnh: j.id });
    // Ảnh do Flow tạo, video cũng chạy Flow cùng tài khoản → dùng luôn ảnh trong kho Flow (khỏi tải lên lại).
    if (j.flowTen) v.flowAnh = { ...j.flowTen, file: j.files[0] };
    this.viec.push(v);
    this.log('info', `🎬 Ảnh #${j.so} (${TEN_NEN[j.nen || 'muse']}) xong → thêm video #${v.so} chạy ở ${TEN_NEN[nen]} từ ảnh đó`);
  }

  /** Bỏ đường dẫn chat Muse của các việc (chat đã bị xoá trên Muse). */
  boThread(ids) {
    for (const j of this.viec) if (ids.includes(j.id) && j.trangThai !== 'chay') j.thread = '';
    this.luu();
  }

  /** Tạo lại: về hàng chờ, xoá chat cũ (gửi lại prompt mới tinh). */
  taoLai(ids) {
    let n = 0;
    for (const j of this.viec) {
      if (!ids.includes(j.id) || j.trangThai === 'chay') continue;
      Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', loi: '', thu: 0, tkLoi: [], batDauLuc: 0, xongLuc: 0, vongLai: 0 });
      n++;
    }
    this.luu();
    return n;
  }

  xoaViec(ids) {
    for (const x of this.luong) if (x.luong.nen !== 'flow' && x.luong.viec && ids.includes(x.luong.viec.id)) x.luong.dung();
    this.viec = this.viec.filter((j) => !ids.includes(j.id));
    this.luu();
  }

  suaViec(id, thay) {
    const j = this.viec.find((x) => x.id === id);
    if (!j || j.trangThai === 'chay') return false;
    if (typeof thay.prompt === 'string' && thay.prompt.trim()) j.prompt = thay.prompt.trim();
    if (hd.TY_LE.includes(thay.tyLe)) j.tyLe = thay.tyLe;
    this.luu();
    return true;
  }

  // ── Nhân vật / mẫu prompt / cài đặt ──────────────────────────────────────
  luuNhanVat(nv) {
    const i = this.nhanVat.findIndex((x) => x.id === nv.id);
    if (i >= 0) this.nhanVat[i] = { ...this.nhanVat[i], ...nv }; else this.nhanVat.push(nv);
    this.luu();
  }
  xoaNhanVat(id) { this.nhanVat = this.nhanVat.filter((x) => x.id !== id); this.luu(); }
  luuMauPrompt(ds) { this.mauPrompt = Array.isArray(ds) ? ds : []; this.luu(); }

  datCaiDat(c) {
    const so = (v, min, max, md) => Math.max(min, Math.min(max, parseInt(v, 10) || md));
    const m = { ...this.caiDat, ...c };
    m.luongMoiTK = so(m.luongMoiTK, 1, 20, 3);
    for (const k of ['tenAnh', 'tenVideo']) m[k] = String(m[k] || '').trim() || hd.MAU_TEN_MAC_DINH;
    m.taiAnh = m.taiAnh !== false; m.taiVideo = m.taiVideo !== false; m.tatMayKhiXong = !!m.tatMayKhiXong;
    m.nghiGiuaLanGui = so(m.nghiGiuaLanGui, 0, 120, 3);
    m.choAnhGiay = so(m.choAnhGiay, 60, 1800, 180);
    m.choVideoGiay = so(m.choVideoGiay, 120, 3600, 300);
    m.choChuGiay = so(m.choChuGiay, 15, 600, 60);
    m.tuThuLai = Math.max(0, Math.min(5, parseInt(m.tuThuLai, 10) || 0));
    m.tuChayLaiLoi = Math.max(0, Math.min(10, parseInt(m.tuChayLaiLoi, 10) || 0));
    m.mau = { ...hd.MAU_MAC_DINH, ...(m.mau || {}) };
    for (const k of ['anh', 'video']) if (!String(m.mau[k] || '').includes('{prompt}')) m.mau[k] = hd.MAU_MAC_DINH[k];
    m.flow = chuanHoaFlow({ ...this.caiDat.flow, ...(c.flow || {}) });
    this.caiDat = m;
    this.luu();
  }

  // ── Chạy / dừng ──────────────────────────────────────────────────────────
  chayTatCa() {
    if (!this.o.taiKhoan.ds.length) {
      this.log('error', '⛔ Chưa có tài khoản nào — vào mục Tài khoản thêm và đăng nhập.');
      return false;
    }
    if (!this.viec.some((j) => j.trangThai === 'cho')) {
      this.log('warning', 'Không còn việc nào đang chờ.');
      return false;
    }
    if (!this.dangChay) {
      this.log('success', '▶ Bắt đầu chạy hàng chờ');
      // Bấm chạy lại = cho mọi tài khoản cơ hội mới (người dùng đã kiểm Muse).
      this.nghiDen = {}; this.lyDoNghi = {}; this.loiLienTiep = {};
    }
    this.dangChay = true;
    this.o.bao();
    this._vong();
    return true;
  }

  dungTatCa() {
    this.dangChay = false;
    for (const x of this.luong) x.luong.dung();
    this.log('warning', '⏸ Đã dừng — việc đang chạy về hàng chờ, chạy lại thì việc Muse lấy tiếp kết quả từ chat cũ, mẻ Flow giao lại từ đầu.');
    this.o.bao();
  }

  coViecDangChay() { return this.luong.some((x) => !x.luong.ranh); }

  /** Giãn nhịp gửi theo từng tài khoản (đặt chỗ đồng bộ nên không hai luồng cùng lọt). */
  async choGui(tkId) {
    for (;;) {
      const con = (this.lanGui[tkId] || 0) + this.caiDat.nghiGiuaLanGui * 1000 - Date.now();
      if (con <= 0) { this.lanGui[tkId] = Date.now(); return; }
      await new Promise((r) => setTimeout(r, Math.min(con, 500)));
    }
  }

  /** Luồng cho đúng các tài khoản đang CẦN (có việc chờ nhắm tới, hoặc đang chạy việc). Tài khoản
   *  dự phòng chưa cần thì không mở luồng — khỏi tốn máy, khỏi đụng token. */
  _canLuong(can) {
    // Muse: N luồng mỗi tài khoản; Flow: N tab mỗi tài khoản (mỗi tab chạy một mẻ).
    const muon = (id) => { const a = this.o.taiKhoan.tim(id); return a && a.nen === 'flow' ? this.caiDat.flow.tabMoiTK : this.caiDat.luongMoiTK; };
    for (const x of [...this.luong]) {
      const dem = this.luong.filter((y) => y.taiKhoanId === x.taiKhoanId).indexOf(x);
      if (x.luong.ranh && (!can.has(x.taiKhoanId) || dem >= muon(x.taiKhoanId))) {
        this.luong.splice(this.luong.indexOf(x), 1);
        this.o.huyLuong(x.luong);
      }
    }
    for (const id of can) {
      const a = this.o.taiKhoan.tim(id);
      if (!a) continue;
      const co = this.luong.filter((x) => x.taiKhoanId === id).length;
      for (let i = co; i < muon(id); i++) this.luong.push({ taiKhoanId: id, luong: this.o.taoLuong(a, i + 1) });
    }
  }

  _vong() {
    if (!this.dangChay) {
      if (this.luong.length && !this.coViecDangChay()) {
        for (const x of this.luong) this.o.huyLuong(x.luong);
        this.luong = [];
        this.o.bao();
      }
      return;
    }
    // Mỗi việc chờ nhắm đúng MỘT tài khoản: chính của dự án, lỗi thì dự phòng kế tiếp.
    const nhamToi = new Map();
    for (const j of this.viec) {
      if (j.trangThai !== 'cho') continue;
      const t = hd.taiKhoanChoViec(j, this._dsTk(j.duAn, j.nen), (id) => this._nghi(id));
      // Tài khoản dự phòng định chuyển sang lại không dùng được (chưa đăng nhập…) mà việc đã hết lượt
      // thử ở tài khoản cũ → Lỗi luôn, đừng gửi lại ở tài khoản đã lỗi.
      if (t && (j.tkLoi || []).includes(t) && !(j.thread && j.taiKhoan === t) && (j.thu || 0) > this.caiDat.tuThuLai) {
        // Lần chạy dở ở tài khoản dự phòng đã xoá chữ lỗi và đổi tài khoản → trả lại lỗi gốc.
        Object.assign(j, { trangThai: 'loi', buoc: '', xongLuc: Date.now(), loi: j.loi || j.loiTruoc || '', taiKhoan: j.tkLoi[j.tkLoi.length - 1] });
        this.log('error', `❌ #${j.so} ${j.loi} (không còn tài khoản dự phòng dùng được)`);
        this.luu();
        continue;
      }
      nhamToi.set(j, t);
    }
    const can = new Set([...nhamToi.values()].filter(Boolean));
    for (const x of this.luong) if (!x.luong.ranh) can.add(x.taiKhoanId);
    this._canLuong(can);
    for (const x of this.luong) {
      if (!x.luong.ranh) continue;
      const j = hd.viecKeTiep(this.viec, (v) => v.thread && v.taiKhoan === x.taiKhoanId,
        (v) => nhamToi.get(v) !== x.taiKhoanId);
      if (!j) continue;
      if (x.luong.nen === 'flow') {
        // Gom thêm việc cùng mẻ: cùng tài khoản nhắm tới, cùng dự án / loại / tỷ lệ / có-không ảnh.
        const k = khoaMe(j);
        const me = [j, ...this.viec.filter((v) => v !== j && v.trangThai === 'cho' && nhamToi.get(v) === x.taiKhoanId && khoaMe(v) === k)
          .sort((a, b) => a.taoLuc - b.taoLuc || a.id - b.id)].slice(0, this.caiDat.flow.meToiDa);
        for (const v of me) nhamToi.delete(v);
        this._giaoMe(x, me);
        continue;
      }
      // Chat dở của tài khoản KHÁC (lỗi / tạm nghỉ / chưa đăng nhập) → gửi lại từ đầu bằng tài khoản này.
      if (j.thread && j.taiKhoan !== x.taiKhoanId) j.thread = '';
      this._giao(x, j);
    }
    if (!this.viec.some((j) => j.trangThai === 'cho' || j.trangThai === 'chay') && !this.coViecDangChay()) {
      // Hết một lượt: việc lỗi còn lượt chạy lại → đưa về hàng chờ (gửi prompt mới) và chạy tiếp.
      const lai = this.viec.filter((j) => j.trangThai === 'loi' && (j.vongLai || 0) < this.caiDat.tuChayLaiLoi);
      if (lai.length) {
        for (const j of lai) {
          Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', thu: 0, tkLoi: [], batDauLuc: 0, xongLuc: 0, vongLai: (j.vongLai || 0) + 1 });
        }
        this.log('warning', `↻ Hết lượt — tự chạy lại ${lai.length} việc lỗi (lượt ${Math.max(...lai.map((j) => j.vongLai))}/${this.caiDat.tuChayLaiLoi})`);
        this.luu();
        return;
      }
      this.dangChay = false;
      this.log('success', '✅ [HỆ THỐNG] Đã chạy hết hàng chờ.');
      this.o.bao();
      if (this.o.hetLuot) this.o.hetLuot();
    } else if (!can.size && !this.coViecDangChay()) {
      // Còn việc chờ mà không tài khoản nào của dự án chạy được (chưa đăng nhập / đang tạm nghỉ).
      this.dangChay = false;
      const ly = [...new Set([...nhamToi.keys()].flatMap((j) => this._dsTkGoc(j.duAn, j.nen)))]
        .map((id) => { const a = this.o.taiKhoan.tim(id); return a ? `"${a.ten}": ${this.lyDoNghi[id] || (a.trangThai === 'can-dang-nhap' ? 'chưa đăng nhập' : 'đang lỗi')}` : null; })
        .filter(Boolean);
      this.log('error', `⏸ Không còn tài khoản nào chạy được việc đang chờ (${ly.join(' · ') || 'chưa có tài khoản'}) — đã TẠM DỪNG hàng chờ (không phí lượt). ` +
        'Kiểm tra Muse / Flow, đăng nhập lại rồi bấm Chạy tất cả — việc Muse đã gửi sẽ lấy tiếp kết quả từ chat cũ.');
      this.o.bao();
    }
  }

  async _giao(x, j) {
    const tk = this.o.taiKhoan.tim(x.taiKhoanId);
    Object.assign(j, { trangThai: 'chay', taiKhoan: x.taiKhoanId, batDauLuc: j.thread ? (j.batDauLuc || Date.now()) : Date.now(), loi: '' });
    this.luu();
    const nv = j.nhanVat.map((id) => this.nhanVat.find((n) => n.id === id)).filter(Boolean);
    let files = [];
    try {
      if (!j.thread) {
        for (const n of nv) for (const a of n.anh || []) files.push(this.o.docFile(a));
        for (const a of j.thamChieu || []) files.push(this.o.docFile(a));
      }
    } catch (err) {
      this._ketThuc(j, { ok: false, loi: `Không đọc được ảnh đính kèm: ${err.message}` }, tk);
      return;
    }
    const cd = this.caiDat;
    const r = await x.luong.chay(j, {
      tinNhan: hd.taoTinNhan(j, nv, cd.mau),
      files,
      png: cd.png,
      choToiDaGiay: j.loai === 'video' ? cd.choVideoGiay : cd.choAnhGiay,
      choChuGiay: j.loai === 'video' ? cd.choChuGiay * 2 : cd.choChuGiay,
      choGui: () => this.choGui(x.taiKhoanId),
      capNhat: (thay) => { Object.assign(j, thay); this.luu(); }
    });
    this._ketThuc(j, r, tk);
  }

  /** Giao một MẺ việc cho luồng Flow; mỗi việc xong / lỗi là báo về _ketThuc ngay, không đợi cả mẻ. */
  async _giaoMe(x, ds) {
    const tk = this.o.taiKhoan.tim(x.taiKhoanId);
    for (const j of ds) Object.assign(j, { trangThai: 'chay', taiKhoan: x.taiKhoanId, batDauLuc: Date.now(), loi: '', buoc: 'Chờ Flow' });
    this.luu();
    const d = this.duAn.find((v) => v.id === ds[0].duAn) || { ten: 'Du_an' };
    try {
      await x.luong.chayMe(ds, {
        caiDat: this.caiDat.flow,
        // Tên file / tên trên Flow = mã việc: chỉ [A-Za-z0-9_] để còn dùng làm @tên của Character Sync.
        tenFile: (j) => `${hd.slugTen(d.ten)}_${String(j.so).padStart(3, '0')}`,
        anhCua: (j) => [
          ...j.nhanVat.map((id) => this.nhanVat.find((n) => n.id === id)).filter(Boolean).flatMap((n) => n.anh || []),
          ...(j.thamChieu || [])
        ].filter((p) => this.o.tonTai(p)),
        capNhat: (j, thay) => { if (this.viec.includes(j) && j.trangThai === 'chay') { Object.assign(j, thay); this.luu(); } },
        xong: (j, r) => this._ketThuc(j, r, tk)
      });
    } catch (err) {
      this.log('error', `❌ [${x.luong.id}] ${err.message}`);
      for (const j of ds) if (j.trangThai === 'chay' && j.taiKhoan === x.taiKhoanId) this._ketThuc(j, { ok: false, loi: err.message }, tk);
    }
    this.o.bao();
  }

  /** Dự án của việc còn tài khoản KHÁC dùng được trên cùng nền tảng (để chuyển sang dự phòng). */
  coDuPhong(tkId) {
    return this.viec.some((j) => j.taiKhoan === tkId && j.trangThai === 'chay' &&
      this._dsTk(j.duAn, j.nen).some((id) => id !== tkId && !this._nghi(id)));
  }

  _ketThuc(j, r, tk) {
    if (!this.viec.includes(j)) { this.o.bao(); return; }    // đã bị xoá giữa chừng
    const d = this.duAn.find((x) => x.id === j.duAn) || { ten: 'Du_an' };
    if (r.ok) {
      try {
        const video = j.loai === 'video';
        const tai = video ? this.caiDat.taiVideo : this.caiDat.taiAnh;
        const goc = tai ? this.thuMucRa(j.loai) : this.o.thuMucTam;
        const mau = video ? this.caiDat.tenVideo : this.caiDat.tenAnh;
        const cu = j.files || [];
        j.files = r.files.map((f, i) => {
          if (f.duongDan && !f.mime) f.mime = hd.mimeTuDuoi(f.duongDan);
          let dich = path.join(goc, hd.tenFile(d, j, f.mime, i, mau));
          // Đã có file trùng tên mà KHÔNG phải file cũ của chính việc này (Tạo lại) → thêm (2), (3)…,
          // không bao giờ ghi đè kết quả khác (kể cả của việc đã dọn khỏi danh sách).
          for (let n = 2; this.o.tonTai(dich) && !cu.includes(dich); n++) {
            dich = path.join(goc, hd.tenFile(d, j, f.mime, i, mau)).replace(/(\.[^.\\/]+)$/, ` (${n})$1`);
          }
          if (f.duongDan) this.o.chuyenFile(f.duongDan, dich);       // Flow: file đã tải về thư mục tạm
          else this.o.ghiFile(dich, Buffer.from(f.b64, 'base64'));   // Muse: dữ liệu lấy từ trang
          return dich;
        });
        Object.assign(j, { trangThai: 'xong', buoc: '', xongLuc: Date.now(), loi: '', tam: !tai });
        if (r.flowTen) j.flowTen = { tk: j.taiKhoan, ten: r.flowTen };
        this.loiLienTiep[j.taiKhoan] = 0;
        this.log('success', `✅ [HỆ THỐNG] Việc #${j.so} xong ${video ? 'video' : 'ảnh'}: ` +
          (tai ? path.relative(goc, j.files[0]) : `${path.basename(j.files[0])} (không tải về — chỉ giữ trong app)`));
        this._noiVideo(j, d);
      } catch (err) {
        Object.assign(j, { trangThai: 'loi', buoc: '', loi: `Không ghi được file: ${err.message}` });
        this.log('error', `❌ #${j.so} ${j.loi}`);
      }
    } else if (r.dung) {
      Object.assign(j, { trangThai: 'cho', buoc: '' });
      if (!r.giuThread) j.thread = '';
    } else if (r.matKetNoi) {
      // Muse của TÀI KHOẢN này hỏng chứ không phải việc hỏng: không tính lần thử, tài khoản tạm nghỉ,
      // việc sang tài khoản dự phòng (không còn tài khoản nào → _vong tạm dừng hàng chờ, khỏi phí lượt).
      Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi });
      if (!r.giuThread) j.thread = '';
      if (!r.daNghi) this._choNghi(j.taiKhoan, r.loi);
    } else if (r.canDangNhap) {
      Object.assign(j, { trangThai: 'cho', buoc: '' });
      if (!r.giuThread) j.thread = '';
      if (tk && tk.trangThai !== 'can-dang-nhap') {
        this.o.taiKhoan.sua(tk.id, { trangThai: 'can-dang-nhap' });
        this.log('error', `🔒 Tài khoản "${tk.ten}" chưa đăng nhập ${TEN_NEN[tk.nen || 'muse']} — tạm bỏ qua. Vào mục Tài khoản để đăng nhập.`);
      }
    } else {
      // Lỗi (kể cả quá lâu) → NGAY LẬP TỨC chuyển việc sang tài khoản kế tiếp của dự án.
      const tkId = j.taiKhoan;
      const ds = this._dsTk(j.duAn, j.nen);
      j.tkLoi = [...new Set([...(j.tkLoi || []), tkId])];
      j.loiTruoc = r.loi;
      this.loiLienTiep[tkId] = (this.loiLienTiep[tkId] || 0) + 1;
      // Tài khoản lỗi liên tiếp → cả dự án sang tài khoản dự phòng một thời gian (chỉ khi có dự phòng).
      if (this.loiLienTiep[tkId] >= LOI_LIEN_TIEP_NGHI && ds.some((id) => id !== tkId)) this._choNghi(tkId, `lỗi ${this.loiLienTiep[tkId]} việc liên tiếp`);
      j.thu = (j.thu || 0) + 1;
      const toiDa = Math.max(this.caiDat.tuThuLai, ds.length - 1);
      const sang = hd.taiKhoanChoViec({ tkLoi: j.tkLoi }, ds, (id) => this._nghi(id));
      if (j.thu <= toiDa) {
        if (sang && sang !== tkId) {
          j.thread = '';
          this.log('warning', `↪ #${j.so} ${r.loi} (ở "${this._tenTk(tkId)}") — chuyển sang "${this._tenTk(sang)}" (${j.thu}/${toiDa})`);
        } else {
          // Không còn tài khoản nào khác: thử lại từ đầu. Lần thử lại đầu: chat còn dùng được (hết giờ
          // chờ…) thì chờ tiếp chat đó; sau đó gửi mới.
          j.tkLoi = [];
          if (!(r.giuThread && j.thu === 1)) j.thread = '';
          this.log('warning', `↻ #${j.so} ${r.loi} — thử lại (${j.thu}/${toiDa})`);
        }
        Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi });
      } else {
        Object.assign(j, { trangThai: 'loi', buoc: '', loi: r.loi, xongLuc: Date.now() });
        this.log('error', `❌ #${j.so} ${r.loi}`);
      }
    }
    if (tk && r.ok && tk.trangThai !== 'da-dang-nhap') this.o.taiKhoan.sua(tk.id, { trangThai: 'da-dang-nhap' });
    this.luu();
  }

  /** Tài khoản tạm nghỉ (mặc định NGHI_MS): việc của mọi dự án chuyển sang tài khoản dự phòng. */
  _choNghi(id, lyDo, ms = NGHI_MS) {
    if (!id || this._nghi(id)) return;
    this.nghiDen[id] = Date.now() + ms;
    this.lyDoNghi[id] = lyDo;
    this.log('warning', `⚠ "${this._tenTk(id)}": ${lyDo} — tạm nghỉ tài khoản này ${Math.round(ms / 60000)} phút, việc chuyển sang tài khoản dự phòng (nếu có).`);
  }

  dong() { clearInterval(this.hen); for (const x of this.luong) x.luong.dung(); }
}

module.exports = { DieuPhoi, CAI_DAT_MAC_DINH };
