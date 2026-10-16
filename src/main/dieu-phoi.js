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
const LOI_LIEN_TIEP_NGHI = 2;
const NGHI_CHAN_LOAI_MS = 60 * 60 * 1000;  // Muse chặn tài khoản tạo video (403 / khu vực) → thôi giao video cho nó chừng này      // lỗi liên tiếp bao nhiêu việc thì cho tài khoản tạm nghỉ
const TEN_NEN = { muse: 'Muse', flow: 'Flow', suno: 'Suno' };
// Suno báo hết lượt (tạo / tải về) → tài khoản nghỉ lâu, việc tạo lại ở tài khoản dự phòng.
const NGHI_HET_LUOT_MS = 6 * 60 * 60 * 1000;
const chuanNen = (n) => (n === 'flow' || n === 'suno' ? n : 'muse');
const TEN_LOAI = { anh: 'ảnh', video: 'video', nhac: 'nhạc' };
const SONG_TOI_DA = 10;
/** {muse, flow, suno}: số tài khoản chạy cùng lúc mỗi nền tảng, 1–10. */
const chuanSong = (c) => Object.fromEntries(['muse', 'flow', 'suno'].map((n) =>
  [n, Math.max(1, Math.min(SONG_TOI_DA, parseInt(c && c[n], 10) || 1))]));

const CAI_DAT_MAC_DINH = {
  thuMucAnh: '',          // trống = Tài liệu/AI Automation Studio (thư mục chung của Muse và Flow)
  thuMucVideo: '',
  taiAnh: true,           // tắt: file chỉ giữ trong bộ nhớ tạm của app (vẫn xem được, vẫn làm video được)
  taiVideo: true,
  tenAnh: hd.MAU_TEN_ANH_MAC_DINH,
  tenVideo: hd.MAU_TEN_MAC_DINH,
  videoCanhAnh: true,     // video nối từ ảnh: lưu cạnh ảnh nguồn, cùng tên (325.jpg → 325.mp4)
  thuMucVideoAnh: '',     // 1.0.4: tắt "cạnh ảnh" + chọn thư mục này → video nối từ ảnh lưu ở đây, vẫn cùng tên ảnh
  thuMucNhac: '',         // 1.1.0: mục Tạo nhạc (Suno) — trống = Tài liệu/AI Automation Studio
  tenNhac: hd.MAU_TEN_ANH_MAC_DINH,   // {stt}: bài của prompt 12 → 012.mp3
  choNhacGiay: 600,       // chờ tối đa Suno tạo xong một bài (bình thường 1–3 phút)
  xoaChatKhiXong: false,  // chạy hết hàng chờ → xoá chat Muse của các việc đã xong
  xoaDuAnFlowKhiXong: false, // chạy hết hàng chờ → xoá dự án Flow đã dùng (lần sau app tự mở dự án mới)
  luongMoiTK: 3,          // số luồng chạy song song mỗi tài khoản
  nghiGiuaLanGui: 3,      // giây nghỉ giữa 2 lần gửi prompt của CÙNG tài khoản
  // Bình thường ảnh ~35 s, video ~80 s. Quá lâu chừng này coi là lỗi → chuyển sang tài khoản dự phòng.
  choAnhGiay: 180,        // chờ tối đa một ảnh
  choVideoGiay: 300,      // chờ tối đa một video
  choChuGiay: 60,         // Muse trả chữ không kèm ảnh bao lâu thì coi là hỏi lại (video ×2)
  // Lỗi → lần lượt các tài khoản dự phòng → quay về tài khoản chính → … (một vòng = thử qua mọi tài khoản
  // của dự án). Việc lỗi ở MỌI tài khoản thêm chừng này vòng nữa thì mới đánh Lỗi.
  tuThuLai: 2,
  tuChayLaiLoi: 2,        // hết hàng chờ mà còn việc lỗi → tự đưa về chạy lại, tối đa mấy lượt
  tatMayKhiXong: false,   // chạy hết hàng chờ thì tắt máy (Windows, macOS) — như Flow Automation Studio
  png: true,              // đổi ảnh webp của Muse sang png
  // 1.2.1: bên này (Muse / Flow) hỏng thì việc tự chuyển sang bên kia: hết tài khoản dùng được, hỏng ở mọi
  // tài khoản, hay Muse từ chối tạo video từ một ảnh. Mỗi việc chỉ đổi bên một lần (không đá qua đá lại).
  doiNenKhiLoi: true,
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
    const sangMuseCu = (this.caiDat.flow || {}).sangMuseKhiHong;   // 1.2.0 — chuanHoaFlow bỏ khoá này, đọc trước (mốc 4)
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
    // 1.0.2: tên ảnh mặc định {stt}; thử lại thành vòng lặp qua mọi tài khoản (mặc định 2 vòng thêm).
    if (this.caiDat.moc < 2) {
      if (this.caiDat.tenAnh === hd.MAU_TEN_MAC_DINH) this.caiDat.tenAnh = hd.MAU_TEN_ANH_MAC_DINH;
      if (this.caiDat.tuThuLai === 1) this.caiDat.tuThuLai = 2;
      this.caiDat.moc = 2;
    }
    // 1.2.0: Flow thử lại cùng tài khoản mặc định 1 lần (lỗi là sang tài khoản khác ngay).
    if (this.caiDat.moc < 3) {
      if (this.caiDat.flow.maxRetries === 2) this.caiDat.flow.maxRetries = 1;
      this.caiDat.moc = 3;
    }
    // 1.2.1: "Flow hỏng hết thì ảnh sang Muse" (flow.sangMuseKhiHong) thành công tắc chung Muse ⇄ Flow.
    if (this.caiDat.moc < 4) {
      if (sangMuseCu === false) this.caiDat.doiNenKhiLoi = false;
      this.caiDat.moc = 4;
    }
    // Việc đang chạy lúc app tắt → về hàng chờ, GIỮ thread để lấy lại kết quả.
    for (const j of this.viec) if (j.trangThai === 'chay') { j.trangThai = 'cho'; j.buoc = ''; }
    this.luong = [];          // [{luong, taiKhoanId}]
    this.lanGui = {};         // taiKhoanId → thời điểm gửi gần nhất
    this.nghiDen = {};        // taiKhoanId → tạm nghỉ tới lúc (lỗi liên tiếp / mất kết nối)
    this.lyDoNghi = {};       // taiKhoanId → lý do tạm nghỉ
    this.loiLienTiep = {};    // taiKhoanId → số việc lỗi liên tiếp
    this.nghiLoai = {};       // 'taiKhoanId:loai' → tài khoản bị chặn tạo loại này (vd Muse chặn video khu vực) tới lúc
    this.dangChay = false;
    this.tkFlowDaChay = new Set();   // tài khoản Flow đã chạy trong lượt này (để tự xoá dự án khi xong)
    this.idMoi = this.viec.reduce((m, j) => Math.max(m, j.id || 0), 0) + 1;
    this.luu();
    this.hen = setInterval(() => this._vong(), 1000);
  }

  log(m, c) { this.o.log(m, c); }
  thuMucRa(loai) {
    return ({ video: this.caiDat.thuMucVideo, nhac: this.caiDat.thuMucNhac }[loai] ?? this.caiDat.thuMucAnh) || this.o.thuMucRaMacDinh;
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
      thuMuc: { anh: this.thuMucRa('anh'), video: this.thuMucRa('video'), nhac: this.thuMucRa('nhac') },
      luong: this.luong.map((x) => ({ id: x.luong.id, taiKhoanId: x.taiKhoanId, nen: x.luong.nen || 'muse',
        viecId: x.luong.viec ? x.luong.viec.id : null })),
      duKien: { anh: hd.thoiGianDuKien(this.viec, 'anh'), video: hd.thoiGianDuKien(this.viec, 'video'), nhac: hd.thoiGianDuKien(this.viec, 'nhac') }
    };
  }

  // ── Dự án ────────────────────────────────────────────────────────────────
  taoDuAn(ten, taiKhoan, chaySong) {
    const t = String(ten || '').trim() || `Dự án ${this.duAn.length + 1}`;
    let id = hd.slugTen(t).toLowerCase(), n = 2;
    while (this.duAn.some((d) => d.id === id)) id = `${hd.slugTen(t).toLowerCase()}-${n++}`;
    const d = { id, ten: t, so: 0, taoLuc: Date.now() };
    if (Array.isArray(taiKhoan)) d.taiKhoan = [...new Set(taiKhoan.filter((x) => this.o.taiKhoan.tim(x)))];
    if (chaySong) d.chaySong = chuanSong(chaySong);
    this.duAn.push(d);
    this.luu();
    return d;
  }
  /** Tài khoản chạy dự án, theo thứ tự ưu tiên: [chính, dự phòng…]; chaySong = {muse, flow, suno}: mấy tài khoản chạy cùng lúc. */
  datTaiKhoanDuAn(id, ds, chaySong) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return false;
    d.taiKhoan = [...new Set((ds || []).filter((t) => this.o.taiKhoan.tim(t)))];
    if (chaySong) d.chaySong = chuanSong(chaySong);
    this.luu();
    return true;
  }
  /** Dự án chạy mấy tài khoản của nền tảng này CÙNG LÚC (1 = chỉ tài khoản chính, các tài khoản khác là dự phòng). */
  _soSong(duAnId, nen) {
    const d = this.duAn.find((x) => x.id === duAnId);
    return (d && d.chaySong && d.chaySong[nen]) || 1;
  }
  /** Tài khoản việc này được chạy ngay bây giờ (nhóm chạy cùng lúc của dự án, trừ tài khoản đã lỗi việc này). */
  _tkCho(j) {
    return hd.taiKhoanChoViecDs(j, this._dsTk(j.duAn, j.nen), (id) => this._nghi(id) || this._nghiLoai(id, j.loai), this._soSong(j.duAn, j.nen));
  }
  _nghiLoai(id, loai) { return (this.nghiLoai[`${id}:${loai}`] || 0) > Date.now(); }
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
  _nghi(id) {
    if ((this.nghiDen[id] || 0) > Date.now()) return true;
    // Hết lượt Suno: nhớ trên tài khoản (qua cả lần tắt app, bấm Chạy lại cũng không xoá — tạo lại ở
    // tài khoản hết lượt tải chỉ phí credit). "Kiểm tra" tài khoản đó thì xoá.
    const a = this.o.taiKhoan.tim(id);
    return !!(a && (a.hetLuotDen || 0) > Date.now());
  }
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
    // Suno chỉ tạo nhạc, và nhạc chỉ tạo ở Suno.
    const nen = p.loai === 'nhac' ? 'suno' : chuanNen(p.nen) === 'flow' ? 'flow' : 'muse';
    const loai = nen === 'suno' ? 'nhac' : p.loai === 'video' ? 'video' : 'anh';
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
    this.log('info', `➕ Thêm ${moi.length} việc ${TEN_LOAI[loai]} ${TEN_NEN[nen]}${khoang} vào "${d.ten}"` +
      (cv ? ` — ảnh xong sẽ tự tạo video ở ${TEN_NEN[cv.nen]}` : ''));
    if (p.chay) this.chayTatCa();
    return { ok: true, so: moi.length };
  }

  _viecMoi(d, v) {
    d.so += 1;
    return {
      id: this.idMoi++, nen: chuanNen(v.nen), duAn: d.id, so: d.so, stt: v.stt || d.so, loai: v.loai,
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

  /** Việc cần dọn khi chạy hết hàng chờ (theo tuỳ chọn): chat Muse của việc đã xong, dự án Flow đã dùng. */
  _canDonDep() {
    const muse = new Map();
    if (this.caiDat.xoaChatKhiXong) {
      for (const j of this.viec) {
        if ((j.nen || 'muse') !== 'muse' || j.trangThai !== 'xong' || !j.thread || !j.taiKhoan) continue;
        if (!muse.has(j.taiKhoan)) muse.set(j.taiKhoan, []);
        muse.get(j.taiKhoan).push({ id: j.id, thread: j.thread });
      }
    }
    const flow = this.caiDat.xoaDuAnFlowKhiXong ? [...this.tkFlowDaChay] : [];
    this.tkFlowDaChay = new Set();
    return muse.size || flow.length ? { muse, flow } : null;
  }

  /** Dự án Flow của tài khoản đã bị xoá → ảnh trên Flow không còn để video Flow dùng lại. */
  boFlowTen(tkId) {
    for (const j of this.viec) {
      if (j.flowTen && j.flowTen.tk === tkId) j.flowTen = null;
      if (j.flowAnh && j.flowAnh.tk === tkId) delete j.flowAnh;
    }
    this.luu();
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
      Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', loi: '', thu: 0, tkLoi: [], vongTk: 0, batDauLuc: 0, xongLuc: 0, vongLai: 0 });
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
    m.tenAnh = String(m.tenAnh || '').trim() || hd.MAU_TEN_ANH_MAC_DINH;
    m.tenVideo = String(m.tenVideo || '').trim() || hd.MAU_TEN_MAC_DINH;
    m.taiAnh = m.taiAnh !== false; m.taiVideo = m.taiVideo !== false; m.tatMayKhiXong = !!m.tatMayKhiXong;
    m.doiNenKhiLoi = m.doiNenKhiLoi !== false;
    m.videoCanhAnh = m.videoCanhAnh !== false; m.xoaChatKhiXong = !!m.xoaChatKhiXong; m.xoaDuAnFlowKhiXong = !!m.xoaDuAnFlowKhiXong;
    m.thuMucVideoAnh = String(m.thuMucVideoAnh || '').trim();
    m.thuMucNhac = String(m.thuMucNhac || '').trim();
    m.tenNhac = String(m.tenNhac || '').trim() || hd.MAU_TEN_ANH_MAC_DINH;
    m.choNhacGiay = so(m.choNhacGiay, 120, 3600, 600);
    m.nghiGiuaLanGui = so(m.nghiGiuaLanGui, 0, 120, 3);
    m.choAnhGiay = so(m.choAnhGiay, 60, 1800, 180);
    m.choVideoGiay = so(m.choVideoGiay, 120, 3600, 300);
    m.choChuGiay = so(m.choChuGiay, 15, 600, 60);
    m.tuThuLai = Math.max(0, Math.min(10, parseInt(m.tuThuLai, 10) || 0));
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
      this.nghiDen = {}; this.lyDoNghi = {}; this.loiLienTiep = {}; this.nghiLoai = {};
      this.tkFlowDaChay = new Set();   // tự xoá dự án Flow chỉ tính tài khoản chạy trong lượt NÀY
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
    // Suno: 1 luồng mỗi tài khoản — các bài mới hiện chung một danh sách, hai luồng cùng tài khoản dễ nhận nhầm bài.
    const muon = (id) => { const a = this.o.taiKhoan.tim(id); return !a ? 0 : a.nen === 'flow' ? this.caiDat.flow.tabMoiTK : a.nen === 'suno' ? 1 : this.caiDat.luongMoiTK; };
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
    // Mỗi việc chờ nhắm tới các tài khoản được chạy nó NGAY BÂY GIỜ: nhóm chạy cùng lúc của dự án
    // (1 tài khoản = chỉ tài khoản chính), tài khoản nào trong nhóm lỗi việc này thì dự phòng kế tiếp.
    const nhamToi = new Map();
    for (const j of this.viec) {
      if (j.trangThai !== 'cho') continue;
      // Mọi tài khoản Muse / Flow của dự án đều không chạy được việc này (nghỉ / chưa đăng nhập / bị chặn
      // loại việc) → chuyển sang bên kia, khỏi tạm dừng cả hàng chờ.
      if (!this._conDung(j.duAn, j.nen, j.loai) && this._coTheDoiNen(j)) {
        const ds = this.viec.filter((v) => v.trangThai === 'cho' && v.duAn === j.duAn && v.nen === j.nen && v.loai === j.loai && this._coTheDoiNen(v));
        this._doiNen(ds, `mọi tài khoản ${TEN_NEN[j.nen]} của dự án đều đang lỗi / nghỉ`);
      }
      let ds = this._tkCho(j);
      // Các tài khoản việc này chưa thử đều đang nghỉ / chưa đăng nhập → chỉ còn tài khoản đã lỗi:
      // coi như hết vòng, quay lại từ đầu (tài khoản chính). Hết số vòng → Lỗi luôn.
      if (ds.length && ds.every((t) => (j.tkLoi || []).includes(t)) && !(j.thread && j.taiKhoan === ds[0])) {
        const tkCu = j.tkLoi[j.tkLoi.length - 1];
        j.vongTk = (j.vongTk || 0) + 1;
        j.tkLoi = [];
        if (j.vongTk > this.caiDat.tuThuLai) {
          // Hỏng ở mọi tài khoản qua đủ vòng → thử bên kia (Muse ⇄ Flow) trước khi đánh Lỗi.
          if (this._coTheDoiNen(j) && this._doiNen([j], `#${j.so} hỏng ở mọi tài khoản ${TEN_NEN[j.nen]}`)) {
            ds = this._tkCho(j);
          } else {
            // Lần chạy dở ở tài khoản dự phòng đã xoá chữ lỗi và đổi tài khoản → trả lại lỗi gốc + tài khoản đã lỗi.
            Object.assign(j, { trangThai: 'loi', buoc: '', xongLuc: Date.now(), loi: j.loi || j.loiTruoc || '', taiKhoan: tkCu });
            this.log('error', `❌ #${j.so} ${j.loi} (không còn tài khoản dự phòng dùng được)`);
            this.luu();
            continue;
          }
        } else ds = this._tkCho(j);
      }
      nhamToi.set(j, ds);
    }
    const can = new Set([...nhamToi.values()].flat());
    for (const x of this.luong) if (!x.luong.ranh) can.add(x.taiKhoanId);
    this._canLuong(can);
    const nham = (v, tkId) => (nhamToi.get(v) || []).includes(tkId);
    for (const x of this.luong) {
      if (!x.luong.ranh) continue;
      const j = hd.viecKeTiep(this.viec, (v) => v.thread && v.taiKhoan === x.taiKhoanId,
        (v) => !nham(v, x.taiKhoanId));
      if (!j) continue;
      if (x.luong.nen === 'flow') {
        // Gom thêm việc cùng mẻ: cùng tài khoản nhắm tới, cùng dự án / loại / tỷ lệ / có-không ảnh.
        // Dự án chạy nhiều tài khoản cùng lúc → chia đều: mỗi tài khoản trong nhóm chỉ lấy phần của mình.
        const k = khoaMe(j);
        const cungMe = this.viec.filter((v) => v !== j && v.trangThai === 'cho' && nham(v, x.taiKhoanId) && khoaMe(v) === k)
          .sort((a, b) => a.taoLuc - b.taoLuc || a.id - b.id);
        const nhom = nhamToi.get(j) || [];
        const tabRanh = this.luong.filter((y) => y.luong.ranh && y.luong.nen === 'flow' && nhom.includes(y.taiKhoanId)).length;
        const phan = Math.ceil((cungMe.length + 1) / Math.max(1, tabRanh));
        const me = [j, ...cungMe].slice(0, Math.min(this.caiDat.flow.meToiDa, phan));
        for (const v of me) nhamToi.delete(v);
        this.tkFlowDaChay.add(x.taiKhoanId);
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
          Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', thu: 0, tkLoi: [], vongTk: 0, batDauLuc: 0, xongLuc: 0, vongLai: (j.vongLai || 0) + 1 });
        }
        this.log('warning', `↻ Hết lượt — tự chạy lại ${lai.length} việc lỗi (lượt ${Math.max(...lai.map((j) => j.vongLai))}/${this.caiDat.tuChayLaiLoi})`);
        this.luu();
        return;
      }
      this.dangChay = false;
      this.log('success', '✅ [HỆ THỐNG] Đã chạy hết hàng chờ.');
      this.o.bao();
      // Dọn dẹp (xoá chat Muse / dự án Flow) xong rồi mới tới tắt máy, cập nhật token.
      const don = this._canDonDep();
      Promise.resolve(don && this.o.donDep ? this.o.donDep(don) : null).catch((err) => this.log('error', `❌ Dọn dẹp: ${err.message}`))
        .then(() => { if (this.o.hetLuot) this.o.hetLuot(); });
    } else if (!can.size && !this.coViecDangChay()) {
      // Còn việc chờ mà không tài khoản nào của dự án chạy được (chưa đăng nhập / đang tạm nghỉ).
      this.dangChay = false;
      const ly = [...new Set([...nhamToi.keys()].flatMap((j) => this._dsTkGoc(j.duAn, j.nen)))]
        .map((id) => {
          const a = this.o.taiKhoan.tim(id);
          if (!a) return null;
          const hetLuot = (a.hetLuotDen || 0) > Date.now() ? `hết lượt, nghỉ đến ${new Date(a.hetLuotDen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
          return `"${a.ten}": ${hetLuot || this.lyDoNghi[id] || (a.trangThai === 'can-dang-nhap' ? 'chưa đăng nhập' : 'đang lỗi')}`;
        })
        .filter(Boolean);
      const coSuno = [...nhamToi.keys()].some((j) => j.nen === 'suno');
      this.log('error', `⏸ Không còn tài khoản nào chạy được việc đang chờ (${ly.join(' · ') || 'chưa có tài khoản'}) — đã TẠM DỪNG hàng chờ (không phí lượt). ` +
        'Kiểm tra Muse / Flow, đăng nhập lại rồi bấm Chạy tất cả — việc Muse đã gửi sẽ lấy tiếp kết quả từ chat cũ.' +
        (coSuno ? ' Suno hết lượt: thêm tài khoản Suno dự phòng, hoặc bấm Kiểm tra ở tài khoản đã có lượt lại.' : ''));
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
      tinNhan: j.loai === 'nhac' ? j.prompt : hd.taoTinNhan(j, nv, cd.mau),   // Suno: prompt nguyên văn vào ô Styles
      files,
      png: cd.png,
      choToiDaGiay: j.loai === 'nhac' ? cd.choNhacGiay : j.loai === 'video' ? cd.choVideoGiay : cd.choAnhGiay,
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

  /** Dự án của việc còn tài khoản KHÁC dùng được trên cùng nền tảng (để chuyển sang dự phòng) — hoặc
   *  việc chuyển được sang bên kia (Muse ⇄ Flow). */
  coDuPhong(tkId) {
    return this.viec.some((j) => j.taiKhoan === tkId && j.trangThai === 'chay' &&
      (this._dsTk(j.duAn, j.nen).some((id) => id !== tkId && !this._nghi(id)) || this._coTheDoiNen(j)));
  }

  _nenKhac(nen) { return nen === 'muse' ? 'flow' : nen === 'flow' ? 'muse' : null; }
  /** Dự án còn tài khoản `nen` nào chạy được loại việc này (đăng nhập rồi, không nghỉ, không bị chặn loại). */
  _conDung(duAnId, nen, loai) {
    return this._dsTk(duAnId, nen).some((id) => !this._nghi(id) && !this._nghiLoai(id, loai));
  }
  /** Việc chuyển được sang bên kia: bật công tắc, chưa từng ở bên đó, bên đó có tài khoản chạy được ngay. */
  _coTheDoiNen(j) {
    const k = this._nenKhac(j.nen);
    return !!(k && this.caiDat.doiNenKhiLoi && !(j.daQuaNen || []).includes(k) &&
      this._tkDoiNen(j.duAn, k).some((id) => !this._nghi(id) && !this._nghiLoai(id, j.loai)));
  }
  /** Tài khoản bên kia nhận được việc chuyển sang: dự án tự chọn, hoặc đã đăng nhập chắc chắn — tài khoản
   *  mặc định chưa ai đăng nhập (vd "Flow 1" của người chỉ dùng Muse) không được tính. */
  _tkDoiNen(duAnId, nen) {
    const d = this.duAn.find((x) => x.id === duAnId);
    const chon = new Set((d && d.taiKhoan) || []);
    return this._dsTk(duAnId, nen).filter((id) => { const a = this.o.taiKhoan.tim(id); return chon.has(id) || (a && a.trangThai === 'da-dang-nhap'); });
  }

  /**
   * Chuyển việc sang bên kia (Muse ⇄ Flow), gửi mới từ đầu: ảnh nguồn / tham chiếu giữ nguyên, Flow tự tải
   * ảnh lên kho của nó. Mỗi việc chỉ đổi bên một lần (`daQuaNen`).
   * @returns số việc đã chuyển
   */
  _doiNen(ds, lyDo) {
    const chuyen = ds.filter((v) => this._coTheDoiNen(v));
    if (!chuyen.length) return 0;
    const tu = chuyen[0].nen, den = this._nenKhac(tu);
    for (const v of chuyen) {
      v.daQuaNen = [...new Set([...(v.daQuaNen || []), v.nen, den])];
      Object.assign(v, { nen: den, trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', tkLoi: [], vongTk: 0, thu: 0, loi: '' });
      if (den === 'muse') v.tuFlow = true;
      delete v.flowAnh;
    }
    const loai = chuyen[0].loai === 'video' ? 'video' : 'ảnh';
    this.log('warning', `🔀 ${TEN_NEN[tu]} → ${TEN_NEN[den]}: ${lyDo} — chuyển ${chuyen.length > 1 ? `${chuyen.length} ${loai}` : loai} #${chuyen.map((v) => v.so).join(', #')} sang ${TEN_NEN[den]}.`);
    this.luu();
    return chuyen.length;
  }

  _ketThuc(j, r, tk) {
    if (!this.viec.includes(j)) { this.o.bao(); return; }    // đã bị xoá giữa chừng
    const d = this.duAn.find((x) => x.id === j.duAn) || { ten: 'Du_an' };
    if (r.ok) {
      try {
        const video = j.loai === 'video', nhac = j.loai === 'nhac';
        const tai = nhac || (video ? this.caiDat.taiVideo : this.caiDat.taiAnh);   // nhạc luôn tải về
        let goc = tai ? this.thuMucRa(j.loai) : this.o.thuMucTam;
        let mau = nhac ? this.caiDat.tenNhac : video ? this.caiDat.tenVideo : this.caiDat.tenAnh;
        // Video nối từ ảnh (Flow ⇄ Muse): lưu NGAY CẠNH ảnh nguồn, cùng tên — 325.jpg → 325.mp4. Người dùng
        // đặt thư mục ảnh riêng mà video vẫn vào thư mục mặc định thì tưởng video không được tải về
        // (nhật ký 15/10/2026: ảnh "325.jpg", video "Mac_dinh\Mac_dinh_270.mp4" ở chỗ khác).
        // 1.0.4: tắt "cạnh ảnh" mà đã chọn thư mục riêng cho video nối từ ảnh → lưu vào đó, vẫn cùng tên ảnh.
        if (video && j.tuAnh && tai) {
          const anhNguon = (j.thamChieu || []).slice(-1)[0] || '';
          if (this.caiDat.videoCanhAnh) {
            if (anhNguon && !path.resolve(anhNguon).startsWith(path.resolve(this.o.thuMucTam))) {
              goc = path.dirname(anhNguon);
              mau = '{tenAnh}';
            }
          } else if (this.caiDat.thuMucVideoAnh) {
            goc = this.caiDat.thuMucVideoAnh;
            mau = '{tenAnh}';
          }
        }
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
        this.log('success', `✅ [HỆ THỐNG] Việc #${j.so} xong ${TEN_LOAI[j.loai] || 'ảnh'}${r.ghiChu ? ` (${r.ghiChu})` : ''}: ` +
          (tai ? j.files[0] : `${path.basename(j.files[0])} (không tải về — chỉ giữ trong app)`));
        this._noiVideo(j, d);
      } catch (err) {
        Object.assign(j, { trangThai: 'loi', buoc: '', loi: `Không ghi được file: ${err.message}` });
        this.log('error', `❌ #${j.so} ${j.loi}`);
      }
    } else if (r.dung) {
      Object.assign(j, { trangThai: 'cho', buoc: '' });
      if (!r.giuThread) j.thread = '';
    } else if (r.chanLoai) {
      // Muse báo tài khoản bị chặn tạo loại việc này (403 / chặn khu vực): lỗi của TÀI KHOẢN — không tính lần
      // thử, tài khoản thôi nhận loại việc này một lúc (loại khác vẫn chạy), việc sang tài khoản khác ngay.
      const tkId = j.taiKhoan;
      Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi, thread: '' });
      if (!this._nghiLoai(tkId, j.loai)) {
        this.nghiLoai[`${tkId}:${j.loai}`] = Date.now() + NGHI_CHAN_LOAI_MS;
        this.lyDoNghi[tkId] = r.loi;
        this.log('warning', `⚠ "${this._tenTk(tkId)}": ${r.loi} — tài khoản này thôi nhận việc ${TEN_LOAI[j.loai] || j.loai} ${Math.round(NGHI_CHAN_LOAI_MS / 60000)} phút, việc chuyển sang tài khoản khác.`);
      }
    } else if (r.tuChoi && this._coTheDoiNen(j)) {
      // Muse nói không tạo được video / ảnh từ CHÍNH ảnh này (lỗi của ảnh, không phải của tài khoản —
      // tài khoản Muse khác cũng từ chối) → chỉ riêng việc này sang Flow ngay, việc khác vẫn chạy ở Muse.
      j.loiTruoc = r.loi;
      this._doiNen([j], `#${j.so} ${r.loi}`);
    } else if (r.matKetNoi) {
      // Muse của TÀI KHOẢN này hỏng chứ không phải việc hỏng: không tính lần thử, tài khoản tạm nghỉ,
      // việc sang tài khoản dự phòng (không còn tài khoản nào → _vong tạm dừng hàng chờ, khỏi phí lượt).
      Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi });
      if (!r.giuThread) j.thread = '';
      if (!r.daNghi) this._choNghi(j.taiKhoan, r.loi);
    } else if (r.hetLuot) {
      // Suno báo tài khoản hết lượt tạo / tải về: không phải lỗi của việc — tài khoản nghỉ lâu, việc về
      // hàng chờ và TẠO LẠI ở tài khoản dự phòng kế tiếp (không tính lần thử). Không còn tài khoản nào
      // → _vong tạm dừng hàng chờ.
      const tkId = j.taiKhoan;
      Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi, thread: '' });
      if (tk) this.o.taiKhoan.sua(tkId, { hetLuotDen: Date.now() + NGHI_HET_LUOT_MS, lyDoHetLuot: r.loi });
      this.lyDoNghi[tkId] = r.loi;
      const sang = hd.taiKhoanChoViec({ tkLoi: [] }, this._dsTk(j.duAn, j.nen), (id) => this._nghi(id));
      this.log('warning', `↪ #${j.so} ${r.loi} (ở "${this._tenTk(tkId)}")${sang ? ` — tạo lại ở "${this._tenTk(sang)}"` : ' — không còn tài khoản dự phòng nào còn lượt'}`);
    } else if (r.canDangNhap) {
      Object.assign(j, { trangThai: 'cho', buoc: '' });
      if (!r.giuThread) j.thread = '';
      if (tk && tk.trangThai !== 'can-dang-nhap') {
        this.o.taiKhoan.sua(tk.id, { trangThai: 'can-dang-nhap' });
        this.log('error', `🔒 Tài khoản "${tk.ten}" chưa đăng nhập ${TEN_NEN[tk.nen || 'muse']} — tạm bỏ qua. Vào mục Tài khoản để đăng nhập.`);
      }
    } else {
      // Lỗi (kể cả quá lâu) → NGAY LẬP TỨC chuyển việc sang tài khoản kế tiếp: chính → dự phòng 1 →
      // dự phòng 2 → … → quay về chính (vòng mới) → … Việc lỗi ở MỌI tài khoản thêm `tuThuLai` vòng
      // nữa mới đánh Lỗi. Tài khoản lỗi liên tiếp thì tạm nghỉ; mọi tài khoản đều nghỉ → _vong tạm
      // dừng hàng chờ (lỗi liên tục ở tất cả tài khoản thì mới dừng).
      const tkId = j.taiKhoan;
      const ds = this._dsTk(j.duAn, j.nen);
      j.tkLoi = [...new Set([...(j.tkLoi || []), tkId])];
      j.loiTruoc = r.loi;
      this.loiLienTiep[tkId] = (this.loiLienTiep[tkId] || 0) + 1;
      // Tài khoản lỗi liên tiếp → cả dự án sang tài khoản dự phòng một thời gian (chỉ khi có dự phòng).
      // Ảnh Flow chuyển được sang Muse thì Muse cũng tính là dự phòng.
      const coDuPhong = ds.some((id) => id !== tkId) || this._coTheDoiNen(j);
      if (this.loiLienTiep[tkId] >= LOI_LIEN_TIEP_NGHI && coDuPhong) this._choNghi(tkId, `lỗi ${this.loiLienTiep[tkId]} việc liên tiếp`);
      j.thu = (j.thu || 0) + 1;
      // Mọi tài khoản của dự án đều đã lỗi việc này → hết một vòng, vòng sau bắt đầu lại từ tài khoản chính.
      if (!ds.some((id) => !j.tkLoi.includes(id))) { j.vongTk = (j.vongTk || 0) + 1; j.tkLoi = []; }
      const vong = j.vongTk || 0, soVong = this.caiDat.tuThuLai + 1;
      if (vong < soVong) {
        const sang = hd.taiKhoanChoViecDs({ tkLoi: j.tkLoi }, ds, (id) => this._nghi(id), this._soSong(j.duAn, j.nen))
          .find((id) => id !== tkId) || hd.taiKhoanChoViec({ tkLoi: j.tkLoi }, ds, (id) => this._nghi(id));
        const nhan = ds.length > 1 ? `vòng ${vong + 1}/${soVong}` : `${j.thu}/${soVong - 1}`;
        if (sang && sang !== tkId) {
          j.thread = '';
          this.log('warning', `↪ #${j.so} ${r.loi} (ở "${this._tenTk(tkId)}") — chuyển sang "${this._tenTk(sang)}" (${nhan})`);
        } else if (!sang) {
          j.thread = '';
          this.log('warning', `⏸ #${j.so} ${r.loi} — mọi tài khoản của dự án đều đang nghỉ (${nhan})`);
        } else {
          // Chỉ còn đúng tài khoản này: thử lại từ đầu. Lần thử lại đầu: chat còn dùng được (hết giờ
          // chờ…) thì chờ tiếp chat đó; sau đó gửi mới.
          if (!(r.giuThread && j.thu === 1)) j.thread = '';
          this.log('warning', `↻ #${j.so} ${r.loi} — thử lại ở "${this._tenTk(sang)}" (${nhan})`);
        }
        Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi });
      } else if (this._coTheDoiNen(j) && this._doiNen([j], `#${j.so} ${r.loi} ở mọi tài khoản ${TEN_NEN[j.nen]}`)) {
        // Đã chuyển sang bên kia.
      } else {
        Object.assign(j, { trangThai: 'loi', buoc: '', loi: r.loi, xongLuc: Date.now() });
        this.log('error', `❌ #${j.so} ${r.loi}${ds.length > 1 ? ` (đã thử ${soVong} vòng qua ${ds.length} tài khoản)` : ''}`);
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
    const lau = ms >= 2 * 3600000 ? `${Math.round(ms / 3600000)} giờ` : `${Math.round(ms / 60000)} phút`;
    this.log('warning', `⚠ "${this._tenTk(id)}": ${lyDo} — tạm nghỉ tài khoản này ${lau}, việc chuyển sang tài khoản dự phòng (nếu có).`);
  }

  dong() { clearInterval(this.hen); for (const x of this.luong) x.luong.dung(); }
}

module.exports = { DieuPhoi, CAI_DAT_MAC_DINH, NGHI_HET_LUOT_MS };
