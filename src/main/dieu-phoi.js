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
//  1.3.0 — MỖI DỰ ÁN CHẠY RIÊNG: dự án có nút Chạy / Dừng riêng (duAnChay), cài đặt
//  riêng (d.caiDat), luồng riêng (luồng Muse / tab Flow gắn với một dự án — dự án sau
//  không phải xếp sau cả hàng việc của dự án trước), dự án Flow riêng trên mỗi tài khoản
//  (d.flowUrl[tk]). Từng việc cũng dừng / chạy riêng được (trạng thái 'dung', chayRieng).
//  Luồng Suno vẫn một luồng mỗi tài khoản, dùng chung cho mọi dự án (chia lượt đều).
//
//  1.3.6 — HẸN GIỜ CHẠY riêng cho từng chức năng (ảnh / video / nhạc, src/main/hen-gio.js): đến giờ thì
//  chạy mọi việc đang chờ của loại đó (loaiChay), có giờ dừng thì tới giờ dừng — độc lập với nút Chạy dự án.
//
//  Không require('electron') — main.js đưa vào các hàm cần (tạo luồng, đọc/ghi
//  file) nên tests/e2e-main.js dựng được với trang Muse giả.
// ============================================================================

const path = require('path');
const hd = require('./hang-doi');
const { chuanHoaFlow, khoaMe } = require('../flow/cai-dat-flow');
const { laUrlDuAnFlow } = require('../flow/tab-flow');
const HG = require('./hen-gio');

const NGHI_MS = 15 * 60 * 1000;   // tài khoản lỗi liên tiếp / mất kết nối → tạm nghỉ chừng này
const LOI_LIEN_TIEP_NGHI = 2;
const CHAN_VIDEO_MS = 24 * 60 * 60 * 1000;  // 1.2.9: Muse chặn video theo khu vực → tài khoản thôi nhận video 24 giờ (nhớ qua lần chạy / mở app)
const NGHI_CHAN_LOAI_MS = 60 * 60 * 1000;  // Muse chặn tài khoản tạo loại việc khác video → thôi giao loại đó cho nó chừng này
const TEN_NEN = { muse: 'Muse', flow: 'Flow', suno: 'Suno' };
// Suno báo hết lượt (tạo / tải về) → tài khoản nghỉ lâu, việc tạo lại ở tài khoản dự phòng.
const NGHI_HET_LUOT_MS = 6 * 60 * 60 * 1000;
const chuanNen = (n) => (n === 'flow' || n === 'suno' ? n : 'muse');
const TEN_LOAI = { anh: 'ảnh', video: 'video', nhac: 'nhạc' };
const KHOA_THU_MUC = { anh: 'thuMucAnh', video: 'thuMucVideo', nhac: 'thuMucNhac' };
/** 1.3.8: lỗi của tài khoản để ghi lên thẻ / nhật ký — giữ nguyên chữ trang báo (một dòng, tối đa 200 ký tự). */
const rutLoi = (s) => { const t = String(s || 'lỗi không rõ').replace(/\s+/g, ' ').trim(); return t.length > 200 ? `${t.slice(0, 199)}…` : t; };
const SONG_TOI_DA = 50;
/** {muse, flow, suno}: số tài khoản chạy cùng lúc mỗi nền tảng, 1–50 (1.3.0: chọn đích danh từng tài khoản "Chạy"). */
/** 1.3.7: tài khoản dự án KHÔNG dùng cho từng loại việc: {anh: [id…], video: [id…]} (thiếu = dùng cho mọi loại). */
const chuanBoLoai = (b) => Object.fromEntries(['anh', 'video'].map((l) => [l, [...new Set(((b && b[l]) || []).map(String).filter(Boolean))]]));
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
  // 1.4.6: hai số trên là của Muse; Flow và Suno có bộ riêng (Muse và Flow chạy khác nhau). Bản cũ chưa có thì chép
  // từ số của Muse (tachTheoNen) để người đã chỉnh không bị đổi.
  tuThuLaiFlow: 2,
  tuChayLaiLoiFlow: 2,
  tuThuLaiSuno: 2,
  tuChayLaiLoiSuno: 2,
  nghiSuno: 3,            // 1.4.6: giây nghỉ giữa 2 lần gửi Suno (nghiGiuaLanGui giờ chỉ của Muse)
  tatMayKhiXong: false,   // chạy hết hàng chờ thì tắt máy (Windows, macOS) — như Flow Automation Studio
  png: true,              // đổi ảnh webp của Muse sang png
  // 1.2.1: bên này (Muse / Flow) hỏng thì việc tự chuyển sang bên kia: hết tài khoản dùng được, hỏng ở mọi
  // tài khoản, hay Muse từ chối tạo video từ một ảnh. Mỗi việc chỉ đổi bên một lần (không đá qua đá lại).
  doiNenKhiLoi: true,
  tachPrompt: 'dong',     // 'dong' | 'doan'
  // 1.4.0: ảnh / video xong → đưa lên Google Drive (<Drive>/<Tên dự án>/images | Videos), hai cách:
  //   'may' = chép vào thư mục Google Drive trên máy (Drive cho máy tính tự tải lên) — thuMucDrive;
  //   'web' = tải thẳng lên drive.google.com bằng trình duyệt trong app, tài khoản Drive driveTk.
  boQuaDaCo: false,       // 1.4.2: thêm prompt → bỏ qua số đã có file trong thư mục lưu (quét thư mục)
  driveBat: false,
  driveCach: 'may',
  thuMucDrive: '',
  driveTk: '',
  // 1.4.0: máy mượt — hạ ưu tiên CPU của các trang Muse / Flow / Suno chạy ngầm (chung cả app, main.js áp).
  nheMay: true,
  mau: { ...hd.MAU_MAC_DINH },
  flow: chuanHoaFlow({})  // cài đặt Google Flow (src/flow/cai-dat-flow.js)
};
// 1.3.0: cài đặt của CẢ APP (không theo dự án) — còn lại mỗi dự án một bộ riêng (d.caiDat).
const KHOA_CHUNG = ['tatMayKhiXong', 'moc', 'nheMay'];
// 1.4.5: khoá luôn riêng từng dự án — "Lưu làm cài đặt mặc định" không chép sang dự án khác.
const KHOA_RIENG_DU_AN = ['thuMucAnh', 'thuMucVideo', 'thuMucNhac', 'thuMucVideoAnh', 'tenAnh', 'tenVideo', 'tenNhac', 'boQuaDaCo'];
const TRANG_XONG = new Set(['xong', 'loi', 'dung']);
const LOAI = ['anh', 'video', 'nhac'];

// 1.4.6: khoá cài đặt chạy tách theo nơi chạy: [khoá Muse, khoá Flow, khoá Suno] (null = nơi đó không dùng).
const KHOA_THEO_NEN = [['tuThuLai', 'tuThuLaiFlow', 'tuThuLaiSuno'], ['tuChayLaiLoi', 'tuChayLaiLoiFlow', 'tuChayLaiLoiSuno'], ['nghiGiuaLanGui', null, 'nghiSuno']];
/** Giá trị cài đặt `k` (tên khoá của Muse) cho việc chạy ở `nen`. */
function theoNen(c, nen, k) {
  const h = KHOA_THEO_NEN.find((x) => x[0] === k);
  const khoa = h && (nen === 'flow' ? h[1] : nen === 'suno' ? h[2] : h[0]);
  return c[khoa || k];
}
/** 1.4.6: cài đặt lưu từ bản cũ chưa có khoá riêng của Flow / Suno → chép từ khoá Muse (đọc trên bản GỐC đã lưu,
 *  trước khi trộn mặc định). */
function tachTheoNen(goc, dich) {
  if (!goc || typeof goc !== 'object') return;
  for (const [k, ...moi] of KHOA_THEO_NEN) for (const m of moi) if (m && goc[m] === undefined && goc[k] !== undefined) dich[m] = goc[k];
}

/** Kẹp mọi giá trị cài đặt về khoảng an toàn (dùng chung cho cài đặt chung và cài đặt riêng của dự án). */
function chuanCaiDat(c, flowGoc, flowMoi) {
  const so = (v, min, max, md) => Math.max(min, Math.min(max, parseInt(v, 10) || md));
  const m = { ...CAI_DAT_MAC_DINH, ...c };
  m.luongMoiTK = so(m.luongMoiTK, 1, 20, 3);
  m.tenAnh = String(m.tenAnh || '').trim() || hd.MAU_TEN_ANH_MAC_DINH;
  m.tenVideo = String(m.tenVideo || '').trim() || hd.MAU_TEN_MAC_DINH;
  m.taiAnh = m.taiAnh !== false; m.taiVideo = m.taiVideo !== false; m.tatMayKhiXong = !!m.tatMayKhiXong;
  m.doiNenKhiLoi = m.doiNenKhiLoi !== false;
  m.videoCanhAnh = m.videoCanhAnh !== false; m.xoaChatKhiXong = !!m.xoaChatKhiXong; m.xoaDuAnFlowKhiXong = !!m.xoaDuAnFlowKhiXong;
  m.thuMucAnh = String(m.thuMucAnh || '').trim();
  m.thuMucVideo = String(m.thuMucVideo || '').trim();
  m.thuMucVideoAnh = String(m.thuMucVideoAnh || '').trim();
  m.thuMucNhac = String(m.thuMucNhac || '').trim();
  m.boQuaDaCo = !!m.boQuaDaCo;
  m.driveBat = !!m.driveBat; m.thuMucDrive = String(m.thuMucDrive || '').trim();
  m.driveCach = m.driveCach === 'web' ? 'web' : 'may'; m.driveTk = String(m.driveTk || ''); m.nheMay = m.nheMay !== false;
  m.tenNhac = String(m.tenNhac || '').trim() || hd.MAU_TEN_ANH_MAC_DINH;
  m.choNhacGiay = so(m.choNhacGiay, 120, 3600, 600);
  m.nghiGiuaLanGui = so(m.nghiGiuaLanGui, 0, 120, 3);
  m.choAnhGiay = so(m.choAnhGiay, 60, 1800, 180);
  m.choVideoGiay = so(m.choVideoGiay, 120, 3600, 300);
  m.choChuGiay = so(m.choChuGiay, 15, 600, 60);
  m.tuThuLai = Math.max(0, Math.min(10, parseInt(m.tuThuLai, 10) || 0));
  m.tuChayLaiLoi = Math.max(0, Math.min(10, parseInt(m.tuChayLaiLoi, 10) || 0));
  for (const k of ['tuThuLaiFlow', 'tuThuLaiSuno', 'tuChayLaiLoiFlow', 'tuChayLaiLoiSuno']) m[k] = Math.max(0, Math.min(10, parseInt(m[k], 10) || 0));
  m.nghiSuno = so(m.nghiSuno, 0, 120, 3);
  m.mau = { ...hd.MAU_MAC_DINH, ...(m.mau || {}) };
  for (const k of ['anh', 'video']) if (!String(m.mau[k] || '').includes('{prompt}')) m.mau[k] = hd.MAU_MAC_DINH[k];
  m.flow = chuanHoaFlow({ ...(flowGoc || {}), ...(flowMoi || {}) });
  return m;
}
/** Bản cài đặt riêng của dự án: bỏ các khoá chung của app. */
function rieng(c) { const m = { ...c }; for (const k of KHOA_CHUNG) delete m[k]; return m; }

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
    const s = o.store.get(['duAn', 'viec', 'nhanVat', 'caiDat', 'mauPrompt', 'henGio']);
    this.duAn = Array.isArray(s.duAn) && s.duAn.length ? s.duAn
      : [{ id: 'mac-dinh', ten: 'Mặc định', so: 0, taoLuc: Date.now() }];
    this.viec = Array.isArray(s.viec) ? s.viec : [];
    this.nhanVat = Array.isArray(s.nhanVat) ? s.nhanVat : [];
    this.mauPrompt = Array.isArray(s.mauPrompt) ? s.mauPrompt : [];
    this.caiDat = { ...CAI_DAT_MAC_DINH, ...(s.caiDat || {}) };
    tachTheoNen(s.caiDat, this.caiDat);
    this.henGio = HG.chuanBoHen(s.henGio);   // 1.3.6: hẹn giờ chạy của từng chức năng (chung cả app)
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
    // 1.3.7: ảnh Flow tải mặc định "1K · Kích thước gốc" thay cho 2K. 2K là Flow TĂNG độ phân giải (tốn tín dụng AI —
    // tín dụng mà video cần); hết tín dụng thì Flow báo "Không tăng được độ phân giải!" và không ra file (nhật ký 19/10/2026).
    const moc5 = this.caiDat.moc < 5;
    if (moc5) {
      if (this.caiDat.flow.chatLuongAnh === 'img_2k') this.caiDat.flow.chatLuongAnh = 'img_1k';
      this.caiDat.moc = 5;
    }
    // 1.4.5: "Thư mục lưu video tạo từ ảnh" ở Cài đặt (caiDat.thuMucVideoAnh) trùng với "Lưu video của dự án này vào" ở
    // trang Tạo ảnh (d.thuMucVideoAnh) → chỉ còn ô ở trang Tạo ảnh: chuyển thư mục đã chọn sang dự án (chỉ khi đang tắt
    // "lưu cạnh ảnh", lúc đó thư mục này mới có tác dụng), rồi bỏ ở cài đặt.
    const moc6 = this.caiDat.moc < 6;
    if (moc6) this.caiDat.moc = 6;
    // Việc đang chạy lúc app tắt → về hàng chờ, GIỮ thread để lấy lại kết quả.
    for (const j of this.viec) {
      if (j.trangThai === 'chay') { j.trangThai = 'cho'; j.buoc = ''; }
      delete j.chayRieng; delete j.dungTay;
    }
    for (const d of this.duAn) {
      // 1.3.0: số thứ tự RIÊNG cho ảnh / video / nhạc (trước dùng chung một bộ đếm d.so) — bắt đầu từ số lớn
      // nhất đang có của từng loại để không trùng số việc cũ.
      if (!d.soLoai) {
        d.soLoai = {};
        for (const l of LOAI) d.soLoai[l] = this.viec.filter((j) => j.duAn === d.id && j.loai === l).reduce((m, j) => Math.max(m, j.so || 0), 0);
      }
      if (d.caiDat && moc5 && d.caiDat.flow && d.caiDat.flow.chatLuongAnh === 'img_2k') d.caiDat.flow.chatLuongAnh = 'img_1k';
      tachTheoNen(d.caiDat, d.caiDat);
      if (d.caiDat) d.caiDat = rieng(chuanCaiDat({ ...this.caiDat, ...d.caiDat }, this.caiDat.flow, d.caiDat.flow));
      if (moc6) {
        const c = this.cd(d.id);
        if (!d.thuMucVideoAnh && c.thuMucVideoAnh && c.videoCanhAnh === false) d.thuMucVideoAnh = c.thuMucVideoAnh;
        if (d.caiDat) d.caiDat.thuMucVideoAnh = '';
      }
      if (!d.flowUrl || typeof d.flowUrl !== 'object') d.flowUrl = {};
      if (d.dongHo) d.dongHo.dangChay = false;   // 1.4.0: đồng hồ dự án — app vừa mở thì chưa dự án nào chạy
    }
    if (moc6) this.caiDat.thuMucVideoAnh = '';
    this.luong = [];          // [{luong, taiKhoanId, duAn}] — duAn = null: luồng dùng chung mọi dự án (Suno)
    this.duAnChay = new Set();   // 1.3.0: dự án đang bấm Chạy (mỗi dự án chạy / dừng riêng)
    // 1.3.6: chức năng đang chạy theo hẹn giờ: loai → { duAn ('' = mọi dự án), den (giờ dừng, 0 = tới hết),
    // bo (dự án bị bấm Dừng trong lượt này), batDauLuc }
    this.loaiChay = new Map();
    this._donCho = Promise.resolve();
    this._baoHet = true;          // đã báo "chạy hết hàng chờ" cho lượt hiện tại (lượt mới bắt đầu thì đặt lại)
    this.lanGui = {};         // taiKhoanId → thời điểm gửi gần nhất
    this.nghiDen = {};        // taiKhoanId → tạm nghỉ tới lúc (lỗi liên tiếp / mất kết nối)
    this.lyDoNghi = {};       // taiKhoanId → lý do tạm nghỉ
    this.loiLienTiep = {};    // taiKhoanId → số việc lỗi liên tiếp
    this.ketQuaTk = {};       // 1.3.7: taiKhoanId → { ok, luc, loi } của việc gần nhất (màu đỏ / xanh ở mục Tài khoản)
    this.nghiLoai = {};       // 'taiKhoanId:loai' → tài khoản bị chặn tạo loại này (vd Muse chặn video khu vực) tới lúc
    this.tkFlowDaChay = new Map();   // dự án → Set(tài khoản Flow đã chạy trong lượt này) — để tự xoá dự án Flow khi xong
    this.duAnTamDung = new Set();    // 1.4.0: dự án app tự TẠM DỪNG vì không còn tài khoản chạy được (bấm "Chạy lại" tài khoản → chạy tiếp)
    this._driveCho = Promise.resolve();   // 1.4.0: chép lên Google Drive lần lượt, không chặn điều phối
    this._driveLoiCuoi = { chu: '', luc: 0 };
    this.idMoi = this.viec.reduce((m, j) => Math.max(m, j.id || 0), 0) + 1;
    this.luu();
    this.hen = setInterval(() => this._vong(), 1000);
  }

  log(m, c) { this.o.log(m, c); }
  bayGio() { return this.o.bayGio ? this.o.bayGio() : Date.now(); }
  /** Đang chạy: có dự án đang bấm Chạy, chức năng đang chạy theo hẹn giờ, hoặc việc được bấm Chạy riêng còn dở. */
  get dangChay() {
    return this.duAnChay.size > 0 || this.loaiChay.size > 0 || this.viec.some((j) => j.chayRieng && (j.trangThai === 'cho' || j.trangThai === 'chay'));
  }
  /** Cài đặt áp cho dự án (dự án chưa có bộ riêng → cài đặt chung). */
  cd(duAnId) {
    const d = duAnId && this.duAn.find((x) => x.id === duAnId);
    return d && d.caiDat ? d.caiDat : this.caiDat;
  }
  thuMucRa(loai, duAnId) {
    const c = this.cd(duAnId);
    return ({ video: c.thuMucVideo, nhac: c.thuMucNhac }[loai] ?? c.thuMucAnh) || this.o.thuMucRaMacDinh;
  }
  /** 1.4.1: chỗ giữ file khi tắt "tải về" — thư mục con RIÊNG từng dự án (trước dùng chung → 001.jpg của dự án này
   *  thành "001 (2).jpg" vì dự án khác đã có 001.jpg, và tên sai đó đi lên Drive). */
  thuMucTamDuAn(duAnId) {
    return path.join(this.o.thuMucTam, String(duAnId || 'chung').replace(/[^\w-]/g, '_'));
  }
  _duocChay(j) { return this.duAnChay.has(j.duAn) || !!j.chayRieng || !!this._theoHen(j); }
  /** 1.3.6: việc này đang được chạy theo hẹn giờ của chức năng nào ('' = không). Video nối từ ảnh theo hẹn của ảnh. */
  _theoHen(j) {
    for (const l of [j.loai, j.henLoai]) {
      const x = l && this.loaiChay.get(l);
      if (x && (!x.duAn || x.duAn === j.duAn) && !x.bo.has(j.duAn)) return l;
    }
    return '';
  }
  /** Dự án có việc đang chạy / sẽ chạy (bấm Chạy dự án, hẹn giờ, chạy riêng). */
  duAnDangChay(id) {
    return this.duAnChay.has(id) || this.viec.some((j) => j.duAn === id && (j.trangThai === 'cho' || j.trangThai === 'chay') && this._duocChay(j));
  }
  _tenDuAn(id) { const d = this.duAn.find((x) => x.id === id); return d ? d.ten : id; }

  // ── Dự án Flow riêng của từng dự án (1.3.0): mỗi dự án của app chạy trên dự án Flow MỚI của tài khoản ──
  flowUrlCua(duAnId, tkId) {
    const d = this.duAn.find((x) => x.id === duAnId);
    return (d && d.flowUrl && d.flowUrl[tkId]) || '';
  }
  datFlowUrl(duAnId, tkId, url) {
    const d = this.duAn.find((x) => x.id === duAnId);
    const u = String(url || '').trim();
    if (!d || (u && !laUrlDuAnFlow(u) && !/^file:/.test(u))) return false;
    d.flowUrl = d.flowUrl || {};
    if (u) d.flowUrl[tkId] = u; else delete d.flowUrl[tkId];
    this.luu();
    return true;
  }

  luu() {
    this.o.store.set({ duAn: this.duAn, viec: this.viec, nhanVat: this.nhanVat,
      caiDat: this.caiDat, mauPrompt: this.mauPrompt, henGio: this.henGio });
    this.o.bao();
  }

  /**
   * 1.4.5: bớt CPU — luồng báo bước ("Đang tạo 37%") rất dày; chỉ đổi chữ bước thì báo giao diện, KHÔNG ghi lại cả
   * du-lieu.json (vài MB mỗi lần). Chữ bước vốn bị xoá khi mở lại app; thay đổi khác (thread, batDauLuc…) vẫn lưu.
   */
  _luuBuoc(thay) {
    if (thay && Object.keys(thay).every((k) => k === 'buoc')) this.o.bao();
    else this.luu();
  }

  trangThai() {
    const thuMuc = (id) => ({ anh: this.thuMucRa('anh', id), video: this.thuMucRa('video', id), nhac: this.thuMucRa('nhac', id) });
    return {
      duAn: this.duAn, viec: this.viec, nhanVat: this.nhanVat, caiDat: this.caiDat,
      mauPrompt: this.mauPrompt, dangChay: this.dangChay, duAnChay: [...this.duAnChay],
      thuMuc: thuMuc(null),
      // 1.3.0: cài đặt + thư mục áp cho TỪNG dự án (giao diện hiện đúng bộ của dự án đang mở).
      caiDatDuAn: Object.fromEntries(this.duAn.map((d) => [d.id, this.cd(d.id)])),
      thuMucDuAn: Object.fromEntries(this.duAn.map((d) => [d.id, thuMuc(d.id)])),
      luong: this.luong.map((x) => ({ id: x.luong.id, taiKhoanId: x.taiKhoanId, nen: x.luong.nen || 'muse', duAn: x.duAn,
        viecId: x.luong.viec ? x.luong.viec.id : null })),
      // 1.3.6: hẹn giờ từng chức năng + lần chạy tới + chức năng đang chạy theo hẹn (dừng lúc nào).
      henGio: Object.fromEntries(HG.LOAI_HEN.map((l) => [l, { ...this.henGio[l], lanToi: HG.lanChayToi(this.henGio[l], this.bayGio()) }])),
      henChay: Object.fromEntries([...this.loaiChay].map(([l, x]) => [l, { duAn: x.duAn, den: x.den }])),
      sucKhoe: this.sucKhoeTk(),
      // 1.4.0: đồng hồ từng dự án (đã chạy lượt này / tổng) + dự đoán còn bao lâu; luc = mốc đo (giao diện tự đếm tiếp).
      dongHo: this.dongHo(), luc: this.bayGio(),
      duKien: { anh: hd.thoiGianDuKien(this.viec, 'anh'), video: hd.thoiGianDuKien(this.viec, 'video'), nhac: hd.thoiGianDuKien(this.viec, 'nhac') }
    };
  }

  // ── Dự án ────────────────────────────────────────────────────────────────
  /**
   * @param tuDuAn  1.3.0: dự án đang mở — dự án mới chép cài đặt của nó (cài đặt riêng từ đầu), riêng thư mục
   *                kết quả là thư mục con mang tên dự án mới (file hai dự án chạy song song không đè / lẫn nhau).
   */
  taoDuAn(ten, taiKhoan, chaySong, tuDuAn, boLoai) {
    const t = String(ten || '').trim() || `Dự án ${this.duAn.length + 1}`;
    let id = hd.slugTen(t).toLowerCase(), n = 2;
    while (this.duAn.some((d) => d.id === id)) id = `${hd.slugTen(t).toLowerCase()}-${n++}`;
    const d = { id, ten: t, so: 0, soLoai: { anh: 0, video: 0, nhac: 0 }, flowUrl: {}, taoLuc: Date.now() };
    if (tuDuAn !== undefined && tuDuAn !== null) {
      const goc = rieng(this.cd(tuDuAn));
      const nguon = this.duAn.find((x) => x.id === tuDuAn);
      const slugNguon = nguon ? hd.slugTen(nguon.ten) : '';
      // Thư mục kết quả: thư mục con mang tên dự án mới, đặt trong thư mục của dự án nguồn (hoặc thư mục mặc định).
      // Dự án nguồn đã nằm trong thư mục con tên của nó → dự án mới là thư mục ANH EM, không lồng sâu dần.
      // Mẫu tên có sẵn {duAn} thì file đã tách theo dự án → giữ thư mục như dự án nguồn.
      const thuMucCon = (thuMuc, mau) => {
        if (/\{duAn\}/i.test(mau || '')) return thuMuc;
        const goc0 = thuMuc || this.o.thuMucRaMacDinh || '';
        const cha = slugNguon && path.basename(goc0) === slugNguon ? path.dirname(goc0) : goc0;
        return path.join(cha, hd.slugTen(t));
      };
      d.caiDat = { ...goc, thuMucAnh: thuMucCon(goc.thuMucAnh, goc.tenAnh), thuMucVideo: thuMucCon(goc.thuMucVideo, goc.tenVideo),
        thuMucNhac: thuMucCon(goc.thuMucNhac, goc.tenNhac), thuMucVideoAnh: '' };
    }
    if (Array.isArray(taiKhoan)) d.taiKhoan = [...new Set(taiKhoan.filter((x) => this.o.taiKhoan.tim(x)))];
    if (chaySong) d.chaySong = chuanSong(chaySong);
    if (boLoai) d.boLoai = chuanBoLoai(boLoai);
    this.duAn.push(d);
    this.luu();
    return d;
  }
  /** Tài khoản chạy dự án, theo thứ tự ưu tiên: [chính, dự phòng…]; chaySong = {muse, flow, suno}: mấy tài khoản chạy cùng lúc. */
  datTaiKhoanDuAn(id, ds, chaySong, boLoai) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return false;
    d.taiKhoan = [...new Set((ds || []).filter((t) => this.o.taiKhoan.tim(t)))];
    if (chaySong) d.chaySong = chuanSong(chaySong);
    if (boLoai) d.boLoai = chuanBoLoai(boLoai);
    this.luu();
    return true;
  }
  /** Dự án chạy mấy tài khoản của nền tảng này CÙNG LÚC (1 = chỉ tài khoản chính, các tài khoản khác là dự phòng). */
  _soSong(duAnId, nen, goc = false, loai) {
    const d = this.duAn.find((x) => x.id === duAnId);
    let n = (d && d.chaySong && d.chaySong[nen]) || 1;
    // 1.3.7: loại việc này bỏ bớt tài khoản "Chạy" (vd ảnh chỉ dùng Flow 1) → chỉ đếm tài khoản Chạy còn dùng cho loại đó;
    // không còn tài khoản Chạy nào thì dự phòng đầu tiên của loại đó chạy.
    const bo = this._boLoai(duAnId, loai);
    if (bo.size) n = Math.max(1, this._dsTkGoc(duAnId, nen).slice(0, n).filter((id) => !bo.has(id)).length);
    // Bên kia thiếu tài khoản → bên này chạy thêm chừng ấy tài khoản cho việc mượn sang (_canBang).
    return goc ? n : n + ((this._muonTk && this._muonTk.get(`${duAnId}|${nen}`)) || 0);
  }
  /** 1.3.7: tài khoản dự án không dùng cho loại việc này (Set). */
  _boLoai(duAnId, loai) {
    if (!loai) return new Set();
    const d = this.duAn.find((x) => x.id === duAnId);
    return new Set((d && d.boLoai && d.boLoai[loai]) || []);
  }
  /** Tài khoản việc này được chạy ngay bây giờ (nhóm chạy cùng lúc của dự án, trừ tài khoản đã lỗi việc này). */
  _tkCho(j) {
    return hd.taiKhoanChoViecDs(j, this._dsTk(j.duAn, j.nen, j.loai), (id) => this._nghi(id) || this._nghiLoai(id, j.loai), this._soSong(j.duAn, j.nen, false, j.loai));
  }
  _nghiLoai(id, loai) {
    if ((this.nghiLoai[`${id}:${loai}`] || 0) > Date.now()) return true;
    // Muse chặn video theo khu vực: mốc lưu trên tài khoản, KHÔNG xoá khi bấm Chạy (chặn không tự hết sau vài phút).
    if (loai !== 'video') return false;
    const a = this.o.taiKhoan.tim(id);
    return !!(a && (a.chanVideoDen || 0) > Date.now());
  }
  /**
   * Tài khoản của dự án trên một nền tảng, theo thứ tự ưu tiên [chính, dự phòng…].
   * Dự án chưa chọn tài khoản nào của nền tảng đó = mọi tài khoản của nền tảng đó.
   * loai (1.3.7): bỏ tài khoản dự án chọn "không dùng cho loại này" (vd Flow 1 chỉ tạo ảnh, không tạo video).
   */
  _dsTkGoc(duAnId, nen = 'muse', loai) {
    const d = this.duAn.find((x) => x.id === duAnId);
    const cuaNen = (id) => { const a = this.o.taiKhoan.tim(id); return a && (a.nen || 'muse') === nen; };
    const chon = d && d.taiKhoan ? d.taiKhoan.filter(cuaNen) : [];
    const ds = chon.length ? chon : this.o.taiKhoan.ds.filter((a) => (a.nen || 'muse') === nen).map((a) => a.id);
    const bo = this._boLoai(duAnId, loai);
    return bo.size ? ds.filter((id) => !bo.has(id)) : ds;
  }
  /** Như trên, bỏ tài khoản đã xoá / chưa đăng nhập. */
  _dsTk(duAnId, nen = 'muse', loai) {
    return this._dsTkGoc(duAnId, nen, loai).filter((id) => { const a = this.o.taiKhoan.tim(id); return a && a.trangThai !== 'can-dang-nhap'; });
  }
  _nghi(id) {
    if ((this.nghiDen[id] || 0) > Date.now()) return true;
    // Hết lượt Suno: nhớ trên tài khoản (qua cả lần tắt app, bấm Chạy lại cũng không xoá — tạo lại ở
    // tài khoản hết lượt tải chỉ phí credit). "Kiểm tra" tài khoản đó thì xoá.
    const a = this.o.taiKhoan.tim(id);
    return !!(a && (a.hetLuotDen || 0) > Date.now());
  }
  _tenTk(id) { const a = this.o.taiKhoan.tim(id); return a ? a.ten : id; }

  /**
   * 1.3.7 — tình trạng từng tài khoản cho giao diện: muc 'loi' (đỏ: chưa đăng nhập / đang nghỉ / hết lượt / bị chặn /
   * việc gần nhất lỗi), 'tot' (xanh: việc gần nhất xong, đang chạy, hoặc đã đăng nhập mà chưa lỗi), 'cho' (xám: chưa kiểm).
   * den = mốc hết nghỉ (giao diện tự ghi giờ); dang = số việc tài khoản này đang chạy.
   */
  sucKhoeTk() {
    const bay = Date.now(), ra = {};
    const nghiFlow = this.o.nghiFlow || (() => null);
    const demChay = {};   // 1.4.0: đếm một lượt cho mọi tài khoản (trước: lọc cả hàng đợi cho từng tài khoản, mỗi lần báo giao diện)
    for (const j of this.viec) if (j.trangThai === 'chay' && j.taiKhoan) demChay[j.taiKhoan] = (demChay[j.taiKhoan] || 0) + 1;
    for (const a of this.o.taiKhoan.ds || []) {
      const id = a.id, kq = this.ketQuaTk[id];
      const dang = demChay[id] || 0;
      const f = nghiFlow(id);
      const chanLoai = Object.keys(this.nghiLoai).filter((k) => k.startsWith(`${id}:`) && this.nghiLoai[k] > bay);
      let x;
      if (a.trangThai === 'can-dang-nhap') x = { muc: 'loi', chu: 'Chưa đăng nhập — bấm Đăng nhập' };
      else if ((a.hetLuotDen || 0) > bay) x = { muc: 'loi', chu: `Hết lượt${a.lyDoHetLuot ? ` (${a.lyDoHetLuot})` : ''}`, den: a.hetLuotDen };
      else if ((this.nghiDen[id] || 0) > bay) x = { muc: 'loi', chu: `Đang nghỉ: ${this.lyDoNghi[id] || 'lỗi'}`, den: this.nghiDen[id] };
      else if (f && f.den > bay) x = { muc: 'loi', chu: `Đang nghỉ: ${f.lyDo || 'Flow báo lỗi'}`, den: f.den };
      else if ((a.chanVideoDen || 0) > bay) x = { muc: 'loi', chu: 'Muse chặn tạo video — tài khoản chỉ tạo ảnh', den: a.chanVideoDen };
      else if (chanLoai.length) {
        const den = Math.max(...chanLoai.map((k) => this.nghiLoai[k]));
        x = { muc: 'loi', chu: `Bị chặn tạo ${chanLoai.map((k) => TEN_LOAI[k.split(':')[1]] || k.split(':')[1]).join(', ')}${this.lyDoNghi[id] ? `: ${this.lyDoNghi[id]}` : ''}`, den };
      } else if (kq && !kq.ok && (this.loiLienTiep[id] || 0) > 0) x = { muc: 'loi', chu: `Việc gần nhất lỗi (${this.loiLienTiep[id]} lần liền): ${kq.loi || 'lỗi'}`, luc: kq.luc };
      else if (kq && kq.ok) x = { muc: 'tot', chu: 'Chạy được — việc gần nhất xong', luc: kq.luc };
      else if (dang) x = { muc: 'tot', chu: 'Đang chạy' };
      else if (a.trangThai === 'da-dang-nhap') x = { muc: 'tot', chu: 'Đã đăng nhập — chưa chạy việc nào' };
      else x = { muc: 'cho', chu: 'Chưa kiểm — bấm Kiểm tra' };
      ra[id] = { ...x, dang };
    }
    return ra;
  }

  /** 1.2.9: thư mục lưu video nối từ ảnh RIÊNG của dự án ('' = bỏ, dùng cài đặt chung). */
  datThuMucVideoDuAn(id, thuMuc) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return { ok: false, loi: 'Không tìm thấy dự án' };
    d.thuMucVideoAnh = String(thuMuc || '').trim();
    if (!d.thuMucVideoAnh) delete d.thuMucVideoAnh;
    this.luu();
    this.o.bao();
    return { ok: true };
  }

  doiTenDuAn(id, ten) {
    const d = this.duAn.find((x) => x.id === id);
    if (d && String(ten || '').trim()) { d.ten = String(ten).trim(); this.luu(); }
  }
  xoaDuAn(id) {
    if (this.duAn.length <= 1) return { ok: false, loi: 'Phải giữ lại ít nhất một dự án' };
    if (this.viec.some((j) => j.duAn === id && j.trangThai === 'chay')) return { ok: false, loi: 'Dự án đang có việc chạy' };
    this.duAn = this.duAn.filter((d) => d.id !== id);
    this.duAnTamDung.delete(id);
    this.viec = this.viec.filter((j) => j.duAn !== id);
    // 1.3.6: hẹn giờ chỉ cho dự án này → tắt hẹn (không tự chuyển sang chạy mọi dự án).
    for (const l of HG.LOAI_HEN) {
      if (this.henGio[l].duAn !== id) continue;
      Object.assign(this.henGio[l], { bat: false, duAn: '' });
      this.log('warning', `⏰ Đã tắt hẹn giờ ${HG.TEN_CHUC_NANG[l]} vì dự án của hẹn vừa bị xoá.`);
    }
    for (const [l, x] of this.loaiChay) if (x.duAn === id) this.loaiChay.delete(l);
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
  /** Đọc phần chung của lệnh thêm việc: dự án, prompt được chọn, loại, nơi chạy, chuỗi ảnh → video. */
  _docThem(p) {
    const d = this.duAn.find((x) => x.id === p.duAn) || this.duAn[0];
    const tatCa = (p.prompts || []).map((x) => String(x).trim()).filter(Boolean);
    if (!tatCa.length) return { loi: 'Chưa có prompt nào' };
    // 1.3.0: ô "Chạy prompt số" (vd "98, 303, 305-350"); bài kiểm / bản cũ vẫn gửi tuSo / denSo.
    const coSo = String(p.chonSo || '').trim();
    const chon = coSo ? hd.chonTheoSo(tatCa, coSo) : hd.chonKhoang(tatCa, p.tuSo, p.denSo);
    if (!chon.length) return { loi: `Số prompt không hợp lệ (chỉ có ${tatCa.length} prompt)` };
    // Suno chỉ tạo nhạc, và nhạc chỉ tạo ở Suno.
    const nen = p.loai === 'nhac' ? 'suno' : chuanNen(p.nen) === 'flow' ? 'flow' : 'muse';
    const loai = nen === 'suno' ? 'nhac' : p.loai === 'video' ? 'video' : 'anh';
    // Ảnh xong → tự tạo video, chạy ở Muse hoặc Flow tuỳ người dùng chọn (mặc định cùng nền tảng với ảnh).
    // 1.4.6: chuoiVideo.prompts = prompt video RIÊNG từng ảnh (file .txt): ảnh của prompt số N lấy dòng N; ảnh không
    // có dòng riêng thì dùng prompt dùng chung (trống nữa thì prompt video mặc định).
    const pc = p.chuoiVideo, ds = pc && Array.isArray(pc.prompts) ? pc.prompts.map((x) => String(x || '').trim()) : [];
    const cv = pc && loai === 'anh' && (String(pc.prompt || '').trim() || ds.some(Boolean))
      ? { prompt: String(pc.prompt || '').trim(), prompts: ds.some(Boolean) ? ds : null, tyLe: hd.TY_LE.includes(pc.tyLe) ? pc.tyLe : '',
        nen: pc.nen === 'flow' || pc.nen === 'muse' ? pc.nen : nen } : null;
    return { d, tatCa, chon, nen, loai, cv };
  }

  /** 1.4.6: chuỗi ảnh → video của ảnh mang số `stt`: prompt video riêng (dòng `stt` của file .txt) hoặc dùng chung.
   *  Mỗi việc ảnh chỉ giữ prompt của chính nó (không chép cả danh sách vào mọi việc). */
  _chuoiCho(cv, stt) {
    if (!cv) return null;
    const rieng = (cv.prompts && cv.prompts[stt - 1]) || '';
    return { prompt: rieng || cv.prompt || hd.PROMPT_VIDEO_MAC_DINH, tyLe: cv.tyLe, nen: cv.nen, ...(rieng ? { rieng: true } : {}) };
  }

  /**
   * 1.4.2 — Quét thư mục: prompt nào ĐÃ CÓ kết quả thì khỏi làm lại (lần chạy trước bị dừng / mất lịch sử, thư mục còn
   * 001…261 nhưng thiếu 253, 254…). 1.4.3: thư mục quét là thư mục người dùng CHỌN khi bấm "Quét thư mục"
   * (d.thuMucQuet[loai]); chưa chọn thì là thư mục lưu của dự án. Một số được coi là đã có khi thư mục đó có file khớp
   * mẫu tên của số đó, hoặc file cùng loại mang số đó ("253.jpg", "0253.png", "anh_253.jpg", "253 (2).jpg"…); hoặc dự án
   * có việc cùng loại, cùng số đang chờ / đang chạy, hay đã xong mà file còn nằm trong thư mục đó. Trang Tạo ảnh có
   * "Ảnh xong → tự tạo video": ảnh đã có mà video chưa có → chỉ tạo video từ ảnh có sẵn.
   * Không có prompt → chỉ tóm tắt thư mục (số đã có, số bị sót).
   * → {ok, thuMuc, chon, tai, coSan, dangCho, thieu, chiVideo:[{stt, anh}], soCo:[số có file], lo:[số bị sót], viDu}
   */
  quetDaCo(p) {
    let r;
    if ((p.prompts || []).some((x) => String(x).trim())) {
      r = this._docThem(p);
      if (r.loi) return { ok: false, loi: r.loi };
    } else {
      const d = this.duAn.find((x) => x.id === p.duAn) || this.duAn[0];
      r = { d, chon: [], loai: p.loai === 'nhac' ? 'nhac' : p.loai === 'video' ? 'video' : 'anh', cv: null };
    }
    const { d, chon, loai, cv } = r;
    const c = this.cd(d.id);
    // Danh sách file mỗi thư mục (đọc một lần) + chỉ mục theo tên bỏ đuôi / " (2)" / "_2" và theo số trong tên, để thư
    // mục hàng chục nghìn file vẫn quét nhanh (không thử biểu thức với từng file cho từng prompt).
    const ds = new Map();
    const dsFile = (thuMuc) => {
      if (!ds.has(thuMuc)) {
        const tep = (this.o.dsFile && this.o.dsFile(thuMuc)) || [];
        const chiMuc = new Map(), theoSoFile = {};
        for (const f of tep) {
          const b = f.replace(/\.[^./]+$/, '').toLowerCase(), b1 = b.replace(/_\d+$/, '');
          for (const k of new Set([b, b1, b.replace(/ \(\d+\)$/, ''), b1.replace(/ \(\d+\)$/, '')])) {
            if (!chiMuc.has(k)) chiMuc.set(k, []);
            chiMuc.get(k).push(f);
          }
          // Số trong tên: chỉ file nằm ngay trong thư mục (không xét thư mục con), đúng đuôi của loại.
          if (f.includes('/')) continue;
          const duoi = (/\.([^.]+)$/.exec(f) || [])[1];
          const l = duoi && Object.keys(hd.DUOI_LOAI).find((x) => hd.DUOI_LOAI[x].includes(duoi.toLowerCase()));
          const so = l && hd.soTuTen(f.replace(/\.[^.]+$/, ''));
          if (!so) continue;
          const m = theoSoFile[l] || (theoSoFile[l] = new Map());
          if (!m.has(so)) m.set(so, []);
          m.get(so).push(f);
        }
        ds.set(thuMuc, { tep, chiMuc, theoSoFile });
      }
      return ds.get(thuMuc);
    };
    const tai = (l) => l === 'nhac' || (l === 'video' ? c.taiVideo : c.taiAnh);
    const noiLuu = (l) => (tai(l) ? this.thuMucRa(l, d.id) : this.thuMucTamDuAn(d.id));
    const mauCua = (l) => (l === 'nhac' ? c.tenNhac : l === 'video' ? c.tenVideo : c.tenAnh);
    const daChon = d.thuMucQuet && d.thuMucQuet[loai];
    const goc = daChon || noiLuu(loai);
    const trong = (f, thuMuc) => {
      const rel = path.relative(thuMuc, f);
      return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    };
    /** File đã có của (loại, số) trong thư mục `thuMuc` theo `mau`, hoặc theo số trong tên ('' = chưa có). */
    const timFile = (l, viec, thuMuc, mau) => {
      const job = { loai: l, so: viec.stt, ...viec };
      const re = hd.mauKhopFile(d, job, l, mau);
      const { tep, chiMuc, theoSoFile } = dsFile(thuMuc);
      // Mẫu có {ngay} → không biết trước tên, thử từng file; còn lại tra chỉ mục theo đúng tên mong đợi.
      const ung = /\{ngay\}/.test(String(mau || '')) ? tep
        : chiMuc.get(hd.tenFile(d, job, 'image/png', 0, mau).replace(/\.[^./]+$/, '').toLowerCase()) || [];
      const f = ung.find((x) => re.test(x)) || ((theoSoFile[l] && theoSoFile[l].get(viec.stt)) || [])[0];
      return f ? path.join(thuMuc, ...f.split('/')) : '';
    };
    /** Việc cùng loại, cùng số trong dự án: 'cho' (đang chờ / chạy / dừng), file còn (trong `thuMuc`) của việc đã xong. */
    const theoSo = new Map();
    for (const j of this.viec) {
      if (j.duAn !== d.id) continue;
      const k = `${j.loai}#${j.stt}`;
      if (!theoSo.has(k)) theoSo.set(k, []);
      theoSo.get(k).push(j);
    }
    const viecCo = (l, stt, thuMuc) => {
      let f = '';
      for (const j of theoSo.get(`${l}#${stt}`) || []) {
        if (j.trangThai === 'cho' || j.trangThai === 'chay' || j.trangThai === 'dung') return { cho: true };
        const x = j.trangThai === 'xong' && j.files && j.files[0];
        if (x && trong(x, thuMuc) && this.o.tonTai(x)) f = f || x;
      }
      return { file: f };
    };
    /** Video nối từ ảnh `anh` được lưu ở đâu / tên gì — như _ketThucViec. */
    const noiVideoTuAnh = (anh) => {
      if (!tai('video')) return { goc: this.thuMucTamDuAn(d.id), mau: c.tenVideo };
      if (d.thuMucVideoAnh) return { goc: d.thuMucVideoAnh, mau: '{tenAnh}' };
      if (c.videoCanhAnh) return { goc: path.dirname(anh), mau: '{tenAnh}' };
      if (c.thuMucVideoAnh) return { goc: c.thuMucVideoAnh, mau: '{tenAnh}' };
      return { goc: this.thuMucRa('video', d.id), mau: c.tenVideo };
    };
    const soCo = [...((dsFile(goc).theoSoFile[loai] || new Map()).keys())].sort((x, y) => x - y);
    const coSet = new Set(soCo), lo = [];
    for (let n = 1; n < (soCo[soCo.length - 1] || 0) && lo.length < 5000; n++) if (!coSet.has(n)) lo.push(n);
    const sau = (soCo[soCo.length - 1] || 0) + 1;
    const kq = { ok: true, thuMuc: goc, chon: !!daChon, tai: tai(loai), coSan: [], dangCho: [], thieu: [], chiVideo: [], soCo, lo,
      viDu: path.join(noiLuu(loai), ...hd.tenFile(d, { loai, so: sau, stt: sau }, { video: 'video/mp4', nhac: 'audio/mpeg' }[loai] || 'image/png', 0, mauCua(loai)).split('/')) };
    for (const { prompt, stt } of chon) {
      const tham = [...(p.thamChieu || []), ...((p.thamChieuTheoDong && p.thamChieuTheoDong[stt - 1]) || [])];
      const v = viecCo(loai, stt, goc);
      if (v.cho) { kq.dangCho.push(stt); continue; }
      const f = v.file || timFile(loai, { stt, prompt, thamChieu: tham }, goc, mauCua(loai));
      if (!f) { kq.thieu.push(stt); continue; }
      if (cv) {
        const nv = noiVideoTuAnh(f);
        const vv = viecCo('video', stt, nv.goc);
        if (vv.cho) { kq.dangCho.push(stt); continue; }
        if (!vv.file && !timFile('video', { stt, prompt: this._chuoiCho(cv, stt).prompt, thamChieu: [f] }, nv.goc, nv.mau)) {
          kq.chiVideo.push({ stt, anh: f });
          continue;
        }
      }
      kq.coSan.push(stt);
    }
    return kq;
  }

  /** 1.4.3: thư mục người dùng chọn để quét (nút "Quét thư mục") cho một loại của dự án — file mới cũng lưu vào đó và
   *  công tắc "Bỏ qua số đã có file" tự bật. thuMuc rỗng = bỏ chọn, quét lại thư mục lưu. */
  datThuMucQuet(id, loai, thuMuc) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return { ok: false, loi: 'Không tìm thấy dự án' };
    const l = loai === 'video' || loai === 'nhac' ? loai : 'anh';
    const t = String(thuMuc || '').trim();
    d.thuMucQuet = { ...(d.thuMucQuet || {}) };
    if (t) d.thuMucQuet[l] = t;
    else delete d.thuMucQuet[l];
    if (!Object.keys(d.thuMucQuet).length) delete d.thuMucQuet;
    let doiMau = '';
    if (t) {
      const doi = { [KHOA_THU_MUC[l]]: t, boQuaDaCo: true };
      // File có sẵn đặt tên chỉ bằng số ("253.jpg") mà mẫu tên đang tạo thư mục con / tên khác ("{duAn}/{duAn}_{so}")
      // → đổi mẫu thành {stt} để file mới nằm cùng chỗ, cùng kiểu tên với file làm dở.
      const KHOA_MAU = { anh: 'tenAnh', video: 'tenVideo', nhac: 'tenNhac' };
      const so = ((this.o.dsFile && this.o.dsFile(t)) || []).filter((f) => !f.includes('/') && hd.DUOI_LOAI[l].includes((/\.([^.]+)$/.exec(f) || [])[1]?.toLowerCase()));
      const chiSo = so.filter((f) => /^\d+( \(\d+\))?(_\d+)?\.[^.]+$/.test(f)).length;
      const mau = this.cd(d.id)[KHOA_MAU[l]];
      if (chiSo && chiSo * 2 >= so.length && !/^\d+$/.test(hd.tenFile(d, { loai: l, so: 7, stt: 7 }, 'image/png', 0, mau).replace(/\.[^.]+$/, ''))) {
        doi[KHOA_MAU[l]] = '{stt}';
        doiMau = ` Mẫu tên ${TEN_LOAI[l]} đổi từ "${mau}" thành "{stt}" cho giống file có sẵn (vd 254.${(/\.([^.]+)$/.exec(so[0]) || [])[1] || 'png'}).`;
      }
      this.datCaiDat(doi, d.id);
    }
    this.log('info', t ? `🔎 "${d.ten}": quét ${TEN_LOAI[l]} ở thư mục "${t}" — file ${TEN_LOAI[l]} mới cũng lưu vào đây.${doiMau}` : `🔎 "${d.ten}": bỏ thư mục quét ${TEN_LOAI[l]}, quét lại thư mục lưu.`);
    this.luu();
    this.o.bao();
    return { ok: true, thuMuc: t, doiMau: doiMau.trim() };
  }

  them(p) {
    const r = this._docThem(p);
    if (r.loi) return { ok: false, loi: r.loi };
    const { d, tatCa, nen, loai, cv } = r;
    let { chon } = r;
    const soBan = Math.max(1, Math.min(10, parseInt(p.soBan, 10) || 1));
    // 1.4.2: "Bỏ qua số đã có file trong thư mục" (gửi kèm, hoặc theo cài đặt dự án).
    const boQua = p.boQuaDaCo !== undefined ? !!p.boQuaDaCo : !!this.cd(d.id).boQuaDaCo;
    let q = null;
    if (boQua) {
      q = this.quetDaCo(p);
      const thieu = new Set(q.thieu);
      chon = chon.filter((x) => thieu.has(x.stt));
      if (!chon.length && !q.chiVideo.length) {
        const loi = `Mọi prompt được chọn đã có ${TEN_LOAI[loai]} trong thư mục${q.dangCho.length ? ' hoặc đang chờ trong hàng đợi' : ''} — không còn số nào cần làm`;
        this.log('info', `🔎 "${d.ten}": ${loi} (đã có ${q.coSan.length}, đang chờ ${q.dangCho.length}).`);
        return { ok: false, loi, boQua: q.coSan.length + q.dangCho.length };
      }
    }
    const moi = [];
    for (const { stt, anh } of (q ? q.chiVideo : [])) {
      // Ảnh đã có trong thư mục, video của nó chưa có → chỉ tạo video từ ảnh đó (lưu như video nối từ ảnh).
      const v = this._viecMoi(d, { nen: cv.nen, loai: 'video', prompt: this._chuoiCho(cv, stt).prompt, stt, so: stt, tyLe: cv.tyLe || p.tyLe, thamChieu: [anh] });
      v.anhCoSan = true;
      v.henLoai = 'anh';
      moi.push(v);
    }
    for (const { prompt: pr, stt } of chon) {
      const text = p.hauTo ? `${pr} ${String(p.hauTo).trim()}` : pr;
      let nv = (p.nhanVatIds || []).filter((id) => this.nhanVat.some((n) => n.id === id));
      if (!nv.length && p.tuNhanVat) nv = hd.timNhanVat(pr, this.nhanVat).map((n) => n.id);
      const thamChieu = [...(p.thamChieu || []), ...((p.thamChieuTheoDong && p.thamChieuTheoDong[stt - 1]) || [])];
      for (let b = 0; b < soBan; b++) {
        moi.push(this._viecMoi(d, { nen, loai, prompt: text, stt, tyLe: p.tyLe, thamChieu, nhanVat: nv, chuoi: this._chuoiCho(cv, stt) }));
      }
    }
    this.viec.push(...moi);
    this.luu();
    if (q) {
      // Số bị bỏ sót (nhỏ hơn số lớn nhất đã có) làm trước, rồi làm tiếp các prompt chưa làm — hàng đợi theo thứ tự số.
      const cao = Math.max(0, ...q.coSan, ...q.chiVideo.map((x) => x.stt));
      const lo = chon.filter((x) => x.stt < cao).map((x) => x.stt), sau = chon.filter((x) => x.stt > cao).map((x) => x.stt);
      this.log('info', `🔎 Quét thư mục "${q.thuMuc}": đã có ${q.coSan.length}${q.dangCho.length ? `, đang chờ ${q.dangCho.length}` : ''} → bỏ qua` +
        `${q.coSan.length + q.dangCho.length ? ` (số ${hd.gonSo([...q.coSan, ...q.dangCho].sort((a, b) => a - b))})` : ''}; làm ${chon.length} số còn thiếu` +
        `${lo.length ? ` — bị sót ${lo.length} (số ${hd.gonSo(lo)})` : ''}${sau.length ? `${lo.length ? ', rồi' : ' —'} làm tiếp ${sau.length} prompt chưa làm (số ${hd.gonSo(sau)})` : ''}` +
        `${q.chiVideo.length ? ` + ${q.chiVideo.length} video từ ảnh có sẵn (số ${hd.gonSo(q.chiVideo.map((x) => x.stt))})` : ''}.`);
    }
    const nAnh = moi.length - (q ? q.chiVideo.length : 0);
    const khoang = chon.length < tatCa.length ? ` (prompt ${chon.length ? hd.gonSo(chon.map((x) => x.stt)) : '—'})` : '';
    if (nAnh) {
      this.log('info', `➕ Thêm ${nAnh} việc ${TEN_LOAI[loai]} ${TEN_NEN[nen]}${khoang} vào "${d.ten}"` +
        (cv ? ` — ảnh xong sẽ tự tạo video ở ${TEN_NEN[cv.nen]}${cv.prompts ? ` (prompt video riêng từng ảnh: ${chon.filter((x) => cv.prompts[x.stt - 1]).length}/${chon.length} ảnh có dòng riêng)` : ''}` : ''));
    }
    if (q && q.chiVideo.length) this.log('info', `➕ Thêm ${q.chiVideo.length} việc video ${TEN_NEN[cv.nen]} từ ảnh đã có vào "${d.ten}"`);
    if (p.chay) this.chayDuAn(d.id);
    return { ok: true, so: moi.length, boQua: q ? q.coSan.length + q.dangCho.length : 0 };
  }

  /** Số thứ tự RIÊNG theo loại (1.3.0): 350 ảnh là #1–#350, video cũng đếm từ #1. `so` cho trước (video
   *  nối từ ảnh mang đúng số của ảnh) thì dùng số đó nếu dự án chưa có việc cùng loại mang số này. */
  _soMoi(d, loai, muon) {
    d.soLoai = d.soLoai || {};
    const k = LOAI.includes(loai) ? loai : 'anh';
    if (muon > 0 && !this.viec.some((j) => j.duAn === d.id && j.loai === k && j.so === muon)) {
      d.soLoai[k] = Math.max(d.soLoai[k] || 0, muon);
      return muon;
    }
    d.soLoai[k] = (d.soLoai[k] || 0) + 1;
    return d.soLoai[k];
  }

  _viecMoi(d, v) {
    const so = this._soMoi(d, v.loai, v.so);
    return {
      id: this.idMoi++, nen: chuanNen(v.nen), duAn: d.id, so, stt: v.stt || so, loai: v.loai,
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
    const v = this._viecMoi(d, { nen, loai: 'video', prompt: j.chuoi.prompt, stt: j.stt, so: j.so, tyLe: j.chuoi.tyLe || j.tyLe,
      thamChieu: [j.files[0]], tuAnh: j.id });
    // Ảnh do Flow tạo, video cũng chạy Flow cùng tài khoản → dùng luôn ảnh trong kho Flow (khỏi tải lên lại).
    if (j.flowTen) v.flowAnh = { ...j.flowTen, file: j.files[0] };
    if (j.chayRieng) v.chayRieng = true;   // ảnh được bấm Chạy riêng → video của nó cũng chạy luôn
    v.henLoai = 'anh';   // 1.3.6: ảnh chạy theo hẹn giờ Tạo ảnh → video nối từ nó chạy tiếp trong cùng lượt hẹn
    this.viec.push(v);
    this.log('info', `🎬 Ảnh #${j.so} (${TEN_NEN[j.nen || 'muse']}) xong → thêm video #${v.so} chạy ở ${TEN_NEN[nen]} từ ảnh đó`);
  }

  /** Việc cần dọn khi DỰ ÁN chạy hết hàng chờ (theo tuỳ chọn của dự án): chat Muse của việc đã xong, dự án Flow đã dùng. */
  _canDonDep(duAnId) {
    const muse = new Map(), c = this.cd(duAnId);
    if (c.xoaChatKhiXong) {
      for (const j of this.viec) {
        if (j.duAn !== duAnId || (j.nen || 'muse') !== 'muse' || j.trangThai !== 'xong' || !j.thread || !j.taiKhoan) continue;
        if (!muse.has(j.taiKhoan)) muse.set(j.taiKhoan, []);
        muse.get(j.taiKhoan).push({ id: j.id, thread: j.thread });
      }
    }
    const flow = c.xoaDuAnFlowKhiXong ? [...(this.tkFlowDaChay.get(duAnId) || [])] : [];
    this.tkFlowDaChay.delete(duAnId);
    return muse.size || flow.length ? { muse, flow, duAn: duAnId } : null;
  }

  /** Dự án Flow (của dự án `duAnId` trên tài khoản) đã bị xoá → ảnh trên Flow không còn để video Flow dùng lại. */
  boFlowTen(tkId, duAnId) {
    for (const j of this.viec) {
      if (duAnId && j.duAn !== duAnId) continue;
      if (j.flowTen && j.flowTen.tk === tkId) j.flowTen = null;
      if (j.flowAnh && j.flowAnh.tk === tkId) delete j.flowAnh;
    }
    if (duAnId) this.datFlowUrl(duAnId, tkId, '');
    this.luu();
  }

  /** Bỏ đường dẫn chat Muse của các việc (chat đã bị xoá trên Muse). */
  boThread(ids) {
    for (const j of this.viec) if (ids.includes(j.id) && j.trangThai !== 'chay') j.thread = '';
    this.luu();
  }

  /**
   * Tạo lại: về hàng chờ, xoá chat cũ (gửi lại prompt mới tinh).
   * @param chay  1.3.0: chạy luôn các việc này (dự án đang nghỉ thì chỉ chạy riêng các việc này).
   */
  taoLai(ids, chay) {
    let n = 0;
    const lai = [];
    for (const j of this.viec) {
      if (!ids.includes(j.id) || j.trangThai === 'chay') continue;
      // Suno: bỏ luôn bài đã tạo (sunoBai) — Tạo lại là tạo bài mới.
      Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', sunoBai: null, taiKhoan: '', loi: '', thu: 0, tkLoi: [], vongTk: 0, batDauLuc: 0, xongLuc: 0, vongLai: 0 });
      lai.push(j);
      n++;
    }
    if (chay && lai.length) this._chayRieng(lai);
    this.luu();
    return n;
  }

  /**
   * 1.3.0 — DỪNG RIÊNG từng việc (vd dừng ảnh số 3, 9 ảnh còn lại chạy tiếp): việc đang chờ / đang chạy →
   * "Đã dừng", không chạy nữa cho tới khi bấm Chạy ở việc đó. Việc Muse / Suno đang chạy: dừng đúng luồng
   * của nó, giữ chat để lúc chạy lại lấy tiếp kết quả. Việc Flow đang chạy trong một mẻ: bỏ kết quả của
   * riêng việc đó (Flow vẫn tạo nốt trên trang Flow), cả mẻ đều dừng thì dừng hẳn tab Flow đó.
   */
  dungViec(ids) {
    let n = 0;
    for (const j of this.viec) {
      if (!ids.includes(j.id)) continue;
      if (j.trangThai === 'cho') {
        Object.assign(j, { trangThai: 'dung', buoc: '', uuTienLuc: 0 });
        delete j.chayRieng;
        n++;
      } else if (j.trangThai === 'chay') {
        const x = this.luong.find((y) => y.luong.nen === 'flow' ? (y.luong.dsViec || []).includes(j) : y.luong.viec === j);
        delete j.chayRieng;
        if (x && x.luong.nen === 'flow') {
          Object.assign(j, { trangThai: 'dung', buoc: '', uuTienLuc: 0 });
          if ((x.luong.dsViec || []).every((v) => v.trangThai !== 'chay')) x.luong.dung();
        } else if (x) {
          j.dungTay = true;      // _ketThuc nhận {dung} từ luồng → 'dung' thay vì về hàng chờ
          x.luong.dung();
        } else Object.assign(j, { trangThai: 'dung', buoc: '' });
        n++;
      }
    }
    if (n) this.log('warning', `⏹ Đã dừng ${n} việc — bấm Chạy ở việc đó để chạy tiếp.`);
    this.luu();
    return n;
  }

  /**
   * 1.3.0 — CHẠY RIÊNG từng việc: việc đã dừng / đang chờ lên đầu hàng chờ và chạy ngay, kể cả khi dự án
   * đang nghỉ (khi đó chỉ chạy đúng các việc này). Việc lỗi = Tạo lại rồi chạy. Việc đã dừng giữa chừng ở
   * Muse còn chat cũ thì lấy tiếp kết quả, không gửi lại prompt.
   */
  chayViec(ids) {
    const ds = this.viec.filter((j) => ids.includes(j.id) && ['cho', 'dung', 'loi'].includes(j.trangThai));
    if (!ds.length) return 0;
    if (!this.o.taiKhoan.ds.length) {
      this.log('error', '⛔ Chưa có tài khoản nào — vào mục Tài khoản thêm và đăng nhập.');
      return 0;
    }
    for (const j of ds) {
      if (j.trangThai === 'loi') Object.assign(j, { thread: '', sunoBai: null, taiKhoan: '', loi: '', thu: 0, tkLoi: [], vongTk: 0, vongLai: 0, batDauLuc: 0, xongLuc: 0 });
      Object.assign(j, { trangThai: 'cho', buoc: '' });
    }
    this._chayRieng(ds);
    this.log('success', `▶ Chạy ${ds.length > 1 ? `${ds.length} việc` : `việc #${ds[0].so}`} ngay${ds.length > 1 ? '' : ` (${TEN_LOAI[ds[0].loai] || ''} "${this._tenDuAn(ds[0].duAn)}")`}`);
    this.luu();
    this._vong();
    return ds.length;
  }

  _chayRieng(ds) {
    if (!this.dangChay) this._choCoHoiMoi();
    const t = Date.now();
    ds.forEach((j, i) => {
      j.uuTienLuc = t + i;
      if (!this.duAnChay.has(j.duAn)) j.chayRieng = true;
    });
    this.o.bao();
  }

  /** Bấm chạy khi đang nghỉ = cho mọi tài khoản cơ hội mới (người dùng đã kiểm Muse / Flow). */
  _choCoHoiMoi() {
    this.nghiDen = {}; this.lyDoNghi = {}; this.loiLienTiep = {}; this.nghiLoai = {};
    this._baoHet = false; this._coTamDung = false;
  }

  xoaViec(ids) {
    for (const x of this.luong) {
      if (x.luong.nen === 'flow') {
        // Xoá mọi việc của một mẻ Flow đang chạy → dừng hẳn tab đó.
        const me = x.luong.dsViec || [];
        if (me.length && me.every((v) => ids.includes(v.id) || v.trangThai !== 'chay')) x.luong.dung();
      } else if (x.luong.viec && ids.includes(x.luong.viec.id)) x.luong.dung();
    }
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

  // ── 1.4.0: đổi prompt hàng loạt, đổi nơi chạy bằng tay, Google Drive ─────────
  /**
   * Đổi prompt của nhiều việc một lần (chọn hết → Đổi prompt).
   * @param p.cach  'thay' = thay cả prompt bằng p.moi · 'tim' = thay chữ p.tim bằng p.thay
   * @param p.dich  'viec' = prompt của việc · 'chuoi' = prompt video sẽ tự tạo từ ảnh (ảnh chưa nối video)
   * @param p.taoLai  việc đã xong / lỗi / đã dừng: đưa về hàng chờ và chạy ngay với prompt mới
   */
  doiPrompt(ids, p = {}) {
    const cach = p.cach === 'tim' ? 'tim' : 'thay', dich = p.dich === 'chuoi' ? 'chuoi' : 'viec';
    const moi = String(p.moi || '').trim(), tim = String(p.tim || ''), thay = String(p.thay || '');
    if (cach === 'thay' && !moi) return { ok: false, loi: 'Chưa nhập prompt mới' };
    if (cach === 'tim' && !tim) return { ok: false, loi: 'Chưa nhập chữ cần tìm' };
    let doi = 0, dangChay = 0, khongDoi = 0;
    const lai = [];
    for (const j of this.viec) {
      if (!ids.includes(j.id)) continue;
      if (dich === 'chuoi' ? j.loai !== 'anh' || !j.chuoi || j.daNoiVideo : false) { khongDoi++; continue; }
      if (dich === 'viec' && j.trangThai === 'chay') { dangChay++; continue; }
      const cu = dich === 'chuoi' ? j.chuoi.prompt : j.prompt;
      const sau = (cach === 'thay' ? moi : String(cu).split(tim).join(thay)).trim();
      if (!sau || sau === cu) { khongDoi++; continue; }
      // Mọi ảnh thêm cùng lượt dùng CHUNG một đối tượng chuoi trong bộ nhớ → thay bản sao, không sửa tại chỗ.
      if (dich === 'chuoi') j.chuoi = { ...j.chuoi, prompt: sau };
      else j.prompt = sau;
      doi++;
      if (dich === 'viec' && p.taoLai && TRANG_XONG.has(j.trangThai)) lai.push(j.id);
    }
    if (doi) this.log('info', `✏ Đã đổi ${dich === 'chuoi' ? 'prompt video nối từ ảnh của' : 'prompt'} ${doi} việc` +
      `${cach === 'tim' ? ` (thay "${tim}" → "${thay}")` : ''}${dangChay ? ` · bỏ qua ${dangChay} việc đang chạy` : ''}.`);
    const taoLai = lai.length ? this.taoLai(lai, true) : 0;
    this.luu();
    return { ok: true, doi, dangChay, khongDoi, taoLai };
  }

  /**
   * Đổi NGAY nơi chạy của việc sang Muse / Flow (bấm tay ở dòng việc hoặc chọn nhiều), rồi chạy ngay.
   * Việc đang chạy: dừng ở bên cũ trước (Muse: đợi luồng dừng hẳn; Flow: tách khỏi mẻ, kết quả sau của mẻ cũ bị bỏ).
   * Việc đã xong: tạo lại ở bên mới (file mới ghi đè file cũ của chính việc đó). Bên mới phải có tài khoản dự án dùng được.
   * Đổi tay xong thì việc không tự đổi ngược về bên cũ (Muse ⇄ Flow tự động bỏ qua việc này).
   */
  doiNenViec(ids, nen, chay = true) {
    nen = nen === 'flow' ? 'flow' : 'muse';
    let daO = 0, nhac = 0;
    const khongTk = new Set(), lai = [], soDoi = [];
    for (const j of this.viec) {
      if (!ids.includes(j.id)) continue;
      if (j.loai === 'nhac' || j.nen === 'suno') { nhac++; continue; }
      if ((j.nen || 'muse') === nen) { daO++; continue; }
      if (!this._dsTk(j.duAn, nen, j.loai).length) { khongTk.add(this._tenDuAn(j.duAn)); continue; }
      soDoi.push(j.so);
      if (j.trangThai === 'chay') {
        const x = this.luong.find((y) => y.luong.nen === 'flow' ? (y.luong.dsViec || []).includes(j) : y.luong.viec === j);
        if (x && x.luong.nen !== 'flow') {
          // Muse: dừng luồng, _ketThuc nhận kết quả dừng rồi mới chuyển (không để hai bên cùng chạy một việc).
          j.chuyenNen = { nen, chay };
          x.luong.dung();
          continue;
        }
        this._apNen(j, nen);
        if (x && (x.luong.dsViec || []).every((v) => v.trangThai !== 'chay')) x.luong.dung();
      } else this._apNen(j, nen);
      lai.push(j);
    }
    if (soDoi.length) this.log('warning', `🔀 Đổi tay ${soDoi.length} việc sang ${TEN_NEN[nen]}${chay ? ' và chạy ngay' : ''}: #${soDoi.join(', #')}.`);
    if (khongTk.size) this.log('error', `⛔ Không đổi được sang ${TEN_NEN[nen]}: dự án ${[...khongTk].map((t) => `"${t}"`).join(', ')} chưa có tài khoản ${TEN_NEN[nen]} dùng được (bấm nút tài khoản cạnh tên dự án).`);
    if (chay && lai.length) this._chayRieng(lai);
    this.luu();
    if (chay && lai.length) this._vong();
    return { ok: true, doi: soDoi.length, daO, nhac, khongTk: [...khongTk] };
  }

  /** Đặt việc sang nền tảng `nen`, về hàng chờ, gửi mới từ đầu (ảnh nguồn / tham chiếu giữ nguyên). */
  _apNen(j, nen) {
    j.daQuaNen = [...new Set([...(j.daQuaNen || []), j.nen || 'muse', nen])];
    delete j.muon; delete j.flowAnh; delete j.chuyenNen;
    Object.assign(j, { nen, trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', tkLoi: [], vongTk: 0, thu: 0, loi: '',
      batDauLuc: 0, xongLuc: 0, vongLai: 0, sunoBai: null, uuTienLuc: 0 });
    if (nen === 'muse') j.tuFlow = true; else delete j.tuFlow;
  }

  /** Đưa (lại) kết quả của các việc đã xong lên Google Drive — dùng thư mục Drive của dự án, kể cả khi tắt "tự đưa". */
  lenDriveViec(ids) {
    const ds = this.viec.filter((j) => ids.includes(j.id) && j.trangThai === 'xong' && (j.loai === 'anh' || j.loai === 'video') && (j.files || []).length);
    const chep = ds.filter((j) => !this._driveThieu(this.cd(j.duAn)));
    if (ds.length && !chep.length) return { ok: false, loi: `${this._driveThieu(this.cd(ds[0].duAn))} — vào Cài đặt → Google Drive` };
    for (const j of chep) this._lenDrive(j, true);
    return { ok: true, so: chep.length, boQua: ids.length - chep.length };
  }

  /** Chép file của việc vừa xong lên thư mục Drive (lần lượt, chạy nền — lỗi chỉ ghi nhật ký, việc vẫn Xong). */
  _lenDrive(j, tay = false) {
    if (!this.o.lenDrive && !this.o.lenDriveWeb) return;
    const c = this.cd(j.duAn);
    if (!(tay || c.driveBat) || (j.loai !== 'anh' && j.loai !== 'video')) return;
    const thieu = this._driveThieu(c);
    if (thieu) {
      if (!tay) this._baoLoiDrive(j, thieu);
      return;
    }
    const web = c.driveCach === 'web';
    const files = [...(j.files || [])];
    const ten = files.map((f, i) => (j.tenDrive || [])[i] || path.basename(f));
    this._driveCho = this._driveCho.then(async () => {
      const d = this.duAn.find((x) => x.id === j.duAn);
      if (!d || !this.viec.includes(j)) return;
      const r = web
        ? await this.o.lenDriveWeb({ tkId: c.driveTk, tenDuAn: d.ten, loai: j.loai, files, ten, cu: j.drive || [] })
        : await this.o.lenDrive({ goc: c.thuMucDrive, tenDuAn: d.ten, loai: j.loai, files, ten, cu: j.drive || [] });
      if (r.ok) {
        j.drive = r.files; delete j.driveLoi;
        this.log('success', `☁ #${j.so} đã đưa lên Google Drive: ${r.files[0]}${r.files.length > 1 ? ` (+${r.files.length - 1} file)` : ''}`);
      } else this._baoLoiDrive(j, r.loi);
      this.luu();
    }).catch((err) => this.log('warning', `☁ #${j.so} chưa đưa lên Google Drive: ${err.message}`));
  }

  /** Cài đặt Drive còn thiếu gì ('' = đủ). */
  _driveThieu(c) {
    if (c.driveCach === 'web') {
      if (!this.o.lenDriveWeb) return 'Bản này chưa tải thẳng lên Drive được';
      const a = c.driveTk && this.o.taiKhoan.tim(c.driveTk);
      return a && a.nen === 'drive' ? '' : 'Chưa chọn tài khoản Google Drive để tải lên';
    }
    if (!this.o.lenDrive) return 'Bản này chưa chép vào thư mục Drive được';
    return c.thuMucDrive ? '' : 'Chưa chọn thư mục Google Drive trên máy';
  }

  _baoLoiDrive(j, loi) {
    j.driveLoi = loi;
    // Thư mục Drive mất / Drive chưa đăng nhập…: cùng một lỗi mỗi phút báo một lần, khỏi tràn nhật ký.
    const bay = Date.now();
    if (loi !== this._driveLoiCuoi.chu || bay - this._driveLoiCuoi.luc > 60000) {
      this._driveLoiCuoi = { chu: loi, luc: bay };
      this.log('warning', `☁ #${j.so} chưa đưa lên Google Drive: ${loi}. File vẫn ở máy — chọn việc rồi bấm "Lên Drive" để đưa lại.`);
    }
  }

  /**
   * 1.4.0 — "Chạy lại ngay" tài khoản đang nghỉ / đỏ vì lỗi (lỗi đã sửa xong, khỏi chờ hết giờ nghỉ): bỏ mốc nghỉ, chặn loại,
   * chặn video, hết lượt, đếm lỗi; Flow đang tạm dừng thì chạy tiếp; việc đang chờ được giao lại cho tài khoản này. Dự án
   * app đã tự TẠM DỪNG vì hết tài khoản (có dùng tài khoản này) → chạy tiếp luôn.
   */
  chayLaiTaiKhoan(id) {
    const a = this.o.taiKhoan.tim(id);
    if (!a) return { ok: false, loi: 'Không tìm thấy tài khoản' };
    delete this.nghiDen[id]; delete this.lyDoNghi[id]; delete this.ketQuaTk[id];
    this.loiLienTiep[id] = 0;
    for (const k of Object.keys(this.nghiLoai)) if (k.startsWith(`${id}:`)) delete this.nghiLoai[k];
    if ((a.chanVideoDen || 0) || (a.hetLuotDen || 0)) this.o.taiKhoan.sua(id, { chanVideoDen: 0, hetLuotDen: 0 });
    if (this.o.chayLaiFlow) this.o.chayLaiFlow(id);
    for (const j of this.viec) if (j.trangThai === 'cho' && (j.tkLoi || []).includes(id)) j.tkLoi = j.tkLoi.filter((x) => x !== id);
    const tiep = [];
    for (const dId of [...this.duAnTamDung]) {
      if (!this.duAn.some((d) => d.id === dId)) { this.duAnTamDung.delete(dId); continue; }
      if (!this._dsTkGoc(dId, a.nen || 'muse').includes(id) || !this.viec.some((j) => j.duAn === dId && j.trangThai === 'cho')) continue;
      this.duAnTamDung.delete(dId);
      if (!this.duAnChay.has(dId)) { this.chayDuAn(dId, true); tiep.push(this._tenDuAn(dId)); }
    }
    this.log('success', `▶ "${a.ten}": đã bỏ trạng thái nghỉ / lỗi — tài khoản nhận việc lại ngay` +
      `${tiep.length ? `; chạy tiếp dự án ${tiep.map((t) => `"${t}"`).join(', ')}` : ''}.`);
    this.luu();
    this._vong();
    return { ok: true, tiep: tiep.length };
  }

  // ── 1.4.0: đồng hồ dự án ─────────────────────────────────────────────────
  /** Mỗi nhịp: dự án đang chạy (bấm Chạy / hẹn giờ / chạy riêng / còn việc đang chạy) thì cộng giờ. Lượt mới = đếm lại từ 0. */
  _demGio() {
    const bay = this.bayGio();
    const buoc = Math.max(0, Math.min(5000, bay - (this._gioTruoc || bay)));   // máy ngủ / treo lâu: không cộng cả quãng đó
    this._gioTruoc = bay;
    const chay = new Set(this.duAnChay);
    for (const j of this.viec) if (j.trangThai === 'chay' || (j.trangThai === 'cho' && this._duocChay(j))) chay.add(j.duAn);
    for (const d of this.duAn) {
      const g = d.dongHo || (d.dongHo = { luot: 0, tong: 0, batDau: 0, xongLuc: 0, dangChay: false });
      if (chay.has(d.id)) {
        if (!g.dangChay) Object.assign(g, { dangChay: true, luot: 0, batDau: bay, xongLuc: 0 });
        else { g.luot += buoc; g.tong = (g.tong || 0) + buoc; }
      } else if (g.dangChay) Object.assign(g, { dangChay: false, xongLuc: bay });
    }
  }

  /** {id: {dangChay, daChay (lượt này), tong, batDau, xongLuc, conLai (ms, dự đoán), soCon}} cho giao diện. */
  dongHo() {
    const bay = this.bayGio(), theo = new Map(), ra = {};
    for (const j of this.viec) { if (!theo.has(j.duAn)) theo.set(j.duAn, []); theo.get(j.duAn).push(j); }
    for (const d of this.duAn) {
      const g = d.dongHo || {}, cua = theo.get(d.id) || [];
      const conViec = cua.some((j) => j.trangThai === 'cho' || j.trangThai === 'chay');
      let du = { conLai: 0, soCon: 0 };
      if (conViec) {
        // Chưa có việc nào xong trong lượt này: ước số việc chạy cùng lúc = tài khoản Chạy × luồng (Muse) / tab (Flow).
        const c = this.cd(d.id), nen = new Set(cua.filter((j) => j.trangThai === 'cho' || j.trangThai === 'chay').map((j) => j.nen || 'muse'));
        const songSong = [...nen].reduce((s, n) => s + this._soSong(d.id, n, true) * (n === 'muse' ? c.luongMoiTK : n === 'flow' ? c.flow.tabMoiTK : 1), 0);
        du = hd.duDoanConLai(cua, bay, { batDauLuot: g.dangChay ? g.batDau : 0, daChayMs: g.dangChay ? g.luot : 0, songSong });
      }
      ra[d.id] = { dangChay: !!g.dangChay, daChay: g.luot || 0, tong: g.tong || 0, batDau: g.batDau || 0, xongLuc: g.xongLuc || 0, ...du };
    }
    return ra;
  }

  // ── Nhân vật / mẫu prompt / cài đặt ──────────────────────────────────────
  luuNhanVat(nv) {
    const i = this.nhanVat.findIndex((x) => x.id === nv.id);
    if (i >= 0) this.nhanVat[i] = { ...this.nhanVat[i], ...nv }; else this.nhanVat.push(nv);
    this.luu();
  }
  xoaNhanVat(id) { this.nhanVat = this.nhanVat.filter((x) => x.id !== id); this.luu(); }
  luuMauPrompt(ds) { this.mauPrompt = Array.isArray(ds) ? ds : []; this.luu(); }

  /**
   * @param duAnId  1.3.0: lưu vào cài đặt RIÊNG của dự án này (trống = cài đặt chung, như bản cũ). Các khoá
   *                chung của app (tắt máy khi xong) luôn lưu vào cài đặt chung.
   */
  datCaiDat(c, duAnId) {
    c = c || {};
    const d = duAnId && this.duAn.find((x) => x.id === duAnId);
    // 1.4.1: vừa BẬT "tự đưa lên Google Drive" → tự tắt "Tải ảnh về" / "Tải video về" (file giữ ở thư mục tạm riêng
    // của dự án rồi lên Drive, khỏi lưu lẫn vào thư mục máy). Sau đó người dùng bật lại tay thì vẫn được.
    if (c.driveBat === true && !this.cd(d && d.id).driveBat) {
      const cd = this.cd(d && d.id);
      if (cd.taiAnh || cd.taiVideo) {
        c = { ...c, taiAnh: false, taiVideo: false };
        this.log('info', `☁ Bật đưa lên Google Drive${d ? ` (dự án "${d.ten}")` : ''} → đã tự tắt "Tải ảnh về" và "Tải video về": ảnh / video giữ trong app (thư mục tạm riêng của dự án) rồi đưa lên Drive.`);
      }
    }
    // 1.4.3: đổi thư mục lưu ở chỗ khác → thôi quét thư mục đã chọn trước đó (quét lại thư mục lưu mới).
    if (d && d.thuMucQuet) {
      for (const [l, k] of Object.entries(KHOA_THU_MUC)) if (k in c && d.thuMucQuet[l] && c[k] !== d.thuMucQuet[l]) delete d.thuMucQuet[l];
      if (!Object.keys(d.thuMucQuet).length) delete d.thuMucQuet;
    }
    if (!d) {
      this.caiDat = chuanCaiDat({ ...this.caiDat, ...c }, this.caiDat.flow, c.flow);
    } else {
      const chung = {}, cuaDuAn = {};
      for (const [k, v] of Object.entries(c)) (KHOA_CHUNG.includes(k) ? chung : cuaDuAn)[k] = v;
      if (Object.keys(chung).length) this.caiDat = chuanCaiDat({ ...this.caiDat, ...chung }, this.caiDat.flow);
      const goc = this.cd(d.id);
      d.caiDat = rieng(chuanCaiDat({ ...goc, ...cuaDuAn }, goc.flow, cuaDuAn.flow));
    }
    this.luu();
    // 1.4.5: trả bộ cài đặt vừa lưu — giao diện vẽ lại ngay từ đây. Trước đây giao diện vẽ lại từ trạng thái CŨ (bản mới
    // còn trong nhịp báo 250 ms, tới nơi cũng không vẽ lại trang Cài đặt) nên lần bấm Lưu đầu trông như bị đẩy về số cũ.
    return { ok: true, caiDat: this.cd(d && d.id), caiDatChung: this.caiDat };
  }

  /**
   * 1.4.5: "Lưu làm cài đặt mặc định" — lưu c vào dự án đang mở, rồi chép bộ đó thành cài đặt chung (dự án mới tạo
   * dùng nó) và áp cho MỌI dự án đang có. Thư mục lưu, mẫu tên file, thư mục quét giữ riêng từng dự án (KHOA_RIENG_DU_AN).
   */
  datMacDinh(c, duAnId) {
    this.datCaiDat(c, duAnId);
    const moi = { ...this.cd(duAnId) };
    for (const k of [...KHOA_RIENG_DU_AN, ...KHOA_CHUNG]) delete moi[k];
    this.caiDat = chuanCaiDat({ ...this.caiDat, ...moi }, this.caiDat.flow, moi.flow);
    for (const d of this.duAn) if (d.caiDat) d.caiDat = rieng(chuanCaiDat({ ...d.caiDat, ...moi }, d.caiDat.flow, moi.flow));
    const ten = (this.duAn.find((x) => x.id === duAnId) || {}).ten;
    this.log('success', `⚙ Đã lưu cài đặt${ten ? ` của dự án "${ten}"` : ''} làm mặc định — áp cho ${this.duAn.length} dự án và dự án mới (thư mục lưu, mẫu tên file giữ riêng từng dự án).`);
    this.luu();
    return { ok: true, soDuAn: this.duAn.length, caiDat: this.cd(duAnId), caiDatChung: this.caiDat,
      caiDatDuAn: Object.fromEntries(this.duAn.map((d) => [d.id, this.cd(d.id)])) };
  }

  // ── Chạy / dừng ──────────────────────────────────────────────────────────
  /** 1.3.0: chạy hàng chờ của MỘT dự án — các dự án khác đang chạy vẫn chạy song song. */
  chayDuAn(id, imLang) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return false;
    if (!this.o.taiKhoan.ds.length) {
      this.log('error', '⛔ Chưa có tài khoản nào — vào mục Tài khoản thêm và đăng nhập.');
      return false;
    }
    if (!this.viec.some((j) => j.duAn === id && (j.trangThai === 'cho' || j.trangThai === 'chay'))) {
      if (!imLang) this.log('warning', `Dự án "${d.ten}" không còn việc nào đang chờ${this.viec.some((j) => j.duAn === id && j.trangThai === 'dung') ? ' (việc đã dừng: bấm Chạy ở từng việc)' : ''}.`);
      return false;
    }
    this.duAnTamDung.delete(id);
    if (!this.duAnChay.has(id)) {
      if (!this.dangChay) this._choCoHoiMoi();
      this.tkFlowDaChay.set(id, new Set());   // tự xoá dự án Flow chỉ tính tài khoản chạy trong lượt NÀY
      this.duAnChay.add(id);
      for (const j of this.viec) if (j.duAn === id) delete j.chayRieng;
      for (const x of this.loaiChay.values()) x.bo.delete(id);
      this.log('success', `▶ Bắt đầu chạy hàng chờ của dự án "${d.ten}"`);
    }
    this.o.bao();
    this._vong();
    return true;
  }

  /** Chạy mọi dự án còn việc chờ. */
  chayTatCa() {
    if (!this.o.taiKhoan.ds.length) {
      this.log('error', '⛔ Chưa có tài khoản nào — vào mục Tài khoản thêm và đăng nhập.');
      return false;
    }
    const ds = this.duAn.filter((d) => this.viec.some((j) => j.duAn === d.id && j.trangThai === 'cho'));
    if (!ds.length) {
      this.log('warning', 'Không còn việc nào đang chờ.');
      return false;
    }
    for (const d of ds) this.chayDuAn(d.id, true);
    return true;
  }

  /** 1.3.0: dừng MỘT dự án — việc đang chạy của nó về hàng chờ, dự án khác chạy tiếp. */
  dungDuAn(id) {
    const d = this.duAn.find((x) => x.id === id);
    if (!d) return false;
    this.duAnChay.delete(id);
    this.duAnTamDung.delete(id);
    for (const j of this.viec) if (j.duAn === id) delete j.chayRieng;
    for (const x of this.loaiChay.values()) x.bo.add(id);   // 1.3.6: lượt hẹn giờ đang chạy cũng thôi chạy dự án này
    for (const x of this.luong) if (this._luongCuaDuAn(x, id)) x.luong.dung();
    this.log('warning', `⏸ Đã dừng dự án "${d.ten}" — việc đang chạy về hàng chờ, chạy lại thì việc Muse lấy tiếp kết quả từ chat cũ, mẻ Flow giao lại từ đầu.`);
    this.o.bao();
    return true;
  }

  dungTatCa() {
    this.duAnChay.clear();
    this.duAnTamDung.clear();
    this.loaiChay.clear();
    for (const j of this.viec) delete j.chayRieng;
    for (const x of this.luong) x.luong.dung();
    this.log('warning', '⏸ Đã dừng — việc đang chạy về hàng chờ, chạy lại thì việc Muse lấy tiếp kết quả từ chat cũ, mẻ Flow giao lại từ đầu.');
    this.o.bao();
  }

  // ── 1.3.6: Hẹn giờ chạy (riêng từng chức năng) ─────────────────────────
  /** Lưu hẹn giờ của một chức năng (loai = anh | video | nhac). */
  datHenGio(loai, h) {
    if (!HG.LOAI_HEN.includes(loai)) return { ok: false, loi: 'Chức năng không hợp lệ' };
    const cu = this.henGio[loai];
    const m = HG.chuanHen({ ...cu, ...(h || {}) });
    if (m.duAn && !this.duAn.some((d) => d.id === m.duAn)) m.duAn = '';
    if (h && h.batDau && !HG.chuanGio(h.batDau)) return { ok: false, loi: `Giờ bắt đầu "${h.batDau}" không hợp lệ (vd 22:00)` };
    if (h && h.ketThuc && !HG.chuanGio(h.ketThuc)) return { ok: false, loi: `Giờ dừng "${h.ketThuc}" không hợp lệ (vd 06:00, để trống = chạy tới hết)` };
    m.datLuc = this.bayGio();
    // Đổi giờ / bật lại → tính lại từ đầu (lần hẹn mới), giữ "đã chạy" nếu chỉ đổi phần khác.
    if (m.batDau !== cu.batDau || (m.bat && !cu.bat)) m.daChay = '';
    this.henGio[loai] = m;
    const ten = HG.TEN_CHUC_NANG[loai];
    // Đang chạy theo hẹn mà đổi giờ dừng → áp ngay cho lượt đang chạy.
    const dang = this.loaiChay.get(loai);
    if (dang && m.ketThuc !== cu.ketThuc) dang.den = m.ketThuc ? HG.gioToiSau(m.ketThuc, this.bayGio()) : 0;
    if (m.bat) {
      this.log('info', `⏰ Hẹn giờ ${ten}: bắt đầu ${m.batDau}${m.ketThuc ? `, dừng ${m.ketThuc}` : ', chạy tới hết hàng chờ'}, ` +
        `${m.lap === 'mot' ? 'một lần' : 'mỗi ngày'} — ${m.duAn ? `dự án "${this._tenDuAn(m.duAn)}"` : 'mọi dự án'}.`);
    } else if (cu.bat) this.log('info', `⏰ Đã tắt hẹn giờ ${ten}.`);
    this.luu();
    this._xetHen();
    return { ok: true, henGio: m };
  }

  /** Bấm Dừng lượt hẹn giờ đang chạy của một chức năng (hẹn ngày mai vẫn giữ). */
  dungHen(loai) {
    if (!this.loaiChay.has(loai)) return false;
    this._dungHen(loai, `⏸ Đã dừng lượt hẹn giờ ${HG.TEN_CHUC_NANG[loai]}`);
    return true;
  }

  /** Mỗi nhịp điều phối: tới giờ dừng thì dừng, tới giờ bắt đầu thì chạy. */
  _xetHen() {
    const bayGio = this.bayGio();
    for (const [l, x] of [...this.loaiChay]) {
      if (x.den && bayGio >= x.den) this._dungHen(l, `⏰ Hết giờ hẹn ${HG.TEN_CHUC_NANG[l]} (${HG.gioPhut(x.den)})`);
    }
    for (const l of HG.LOAI_HEN) {
      const h = this.henGio[l];
      const r = HG.denGioChay(h, bayGio);
      if (!r) continue;
      h.daChay = r.khoa;
      if (h.lap === 'mot') h.bat = false;
      this._batDauHen(l, h, r);
      this.luu();
    }
  }

  _batDauHen(loai, h, r) {
    const ten = HG.TEN_CHUC_NANG[loai];
    const pham = h.duAn ? `dự án "${this._tenDuAn(h.duAn)}"` : 'mọi dự án';
    if (!this.o.taiKhoan.ds.length) {
      this.log('error', `⏰ Hẹn giờ ${ten} (${h.batDau}): chưa có tài khoản nào — vào mục Tài khoản thêm và đăng nhập.`);
      return false;
    }
    const cho = this.viec.filter((j) => j.loai === loai && j.trangThai === 'cho' && (!h.duAn || j.duAn === h.duAn));
    if (!cho.length) {
      this.log('warning', `⏰ Hẹn giờ ${ten} (${h.batDau}): không có việc ${TEN_LOAI[loai]} nào đang chờ (${pham}) — bỏ qua lần này.`);
      return false;
    }
    if (!this.dangChay) this._choCoHoiMoi();
    for (const id of new Set(cho.map((j) => j.duAn))) if (!this.duAnChay.has(id)) this.tkFlowDaChay.set(id, new Set());
    this.loaiChay.set(loai, { duAn: h.duAn, den: r.den, bo: new Set(), batDauLuc: Date.now() });
    this.log('success', `⏰ Đến giờ hẹn ${h.batDau}: bắt đầu ${ten} — ${cho.length} việc đang chờ, ${pham}` +
      `${r.den ? `, dừng lúc ${HG.gioPhut(r.den)}` : ', chạy tới hết'}.`);
    this.o.bao();
    return true;
  }

  /** Thôi chạy theo hẹn: luồng đang làm việc CHỈ được chạy nhờ hẹn này thì dừng (việc về hàng chờ). */
  _dungHen(loai, chu) {
    const x = this.loaiChay.get(loai);
    if (!x) return;
    const nho = (j) => (j.loai === loai || j.henLoai === loai) && (!x.duAn || j.duAn === x.duAn);
    this.loaiChay.delete(loai);
    let dung = 0;
    for (const y of this.luong) {
      const ds = y.luong.dsViec || (y.luong.viec ? [y.luong.viec] : []);
      if (ds.length && ds.some(nho) && !ds.some((j) => this._duocChay(j))) { y.luong.dung(); dung++; }
    }
    this.log('warning', `${chu} — ${dung ? `${dung} luồng đang chạy dừng lại, việc dở về hàng chờ` : 'không còn việc nào đang chạy'}.`);
    this.o.bao();
  }

  /** Luồng đang chạy việc của dự án này (luồng riêng của dự án, hoặc luồng dùng chung đang cầm việc của nó). */
  _luongCuaDuAn(x, id) {
    if (x.duAn) return x.duAn === id;
    const ds = x.luong.dsViec || (x.luong.viec ? [x.luong.viec] : []);
    return ds.some((j) => j.duAn === id);
  }

  coViecDangChay() { return this.luong.some((x) => !x.luong.ranh); }

  /** Giãn nhịp gửi theo từng tài khoản (đặt chỗ đồng bộ nên không hai luồng cùng lọt). */
  async choGui(tkId, nghiGiay = this.caiDat.nghiGiuaLanGui) {
    for (;;) {
      const con = (this.lanGui[tkId] || 0) + nghiGiay * 1000 - Date.now();
      if (con <= 0) { this.lanGui[tkId] = Date.now(); return; }
      await new Promise((r) => setTimeout(r, Math.min(con, 500)));
    }
  }

  /** Khoá nhóm luồng: luồng Muse / Flow RIÊNG từng dự án (1.3.0); Suno một luồng mỗi tài khoản, dùng chung mọi dự án. */
  _khoa(tkId, duAnId) {
    const a = this.o.taiKhoan.tim(tkId);
    return `${tkId}|${a && a.nen === 'suno' ? '' : duAnId || ''}`;
  }
  _khoaLuong(x) { return `${x.taiKhoanId}|${x.duAn || ''}`; }

  /** Luồng cho đúng các (tài khoản, dự án) đang CẦN (có việc chờ nhắm tới, hoặc đang chạy việc). Tài khoản
   *  dự phòng chưa cần thì không mở luồng — khỏi tốn máy, khỏi đụng token. */
  _canLuong(can) {
    // Muse: N luồng mỗi tài khoản mỗi dự án; Flow: N tab mỗi tài khoản mỗi dự án (mỗi tab chạy một mẻ, trên dự án
    // Flow riêng của dự án đó). N lấy theo cài đặt của dự án.
    // Suno: 1 luồng mỗi tài khoản — các bài mới hiện chung một danh sách, hai luồng cùng tài khoản dễ nhận nhầm bài.
    const muon = (id, duAnId) => {
      const a = this.o.taiKhoan.tim(id);
      if (!a) return 0;
      const c = this.cd(duAnId);
      return a.nen === 'flow' ? c.flow.tabMoiTK : a.nen === 'suno' ? 1 : c.luongMoiTK;
    };
    for (const x of [...this.luong]) {
      const k = this._khoaLuong(x);
      const dem = this.luong.filter((y) => this._khoaLuong(y) === k).indexOf(x);
      if (x.luong.ranh && (!can.has(k) || dem >= muon(x.taiKhoanId, x.duAn))) {
        this.luong.splice(this.luong.indexOf(x), 1);
        this.o.huyLuong(x.luong);
      }
    }
    for (const k of can) {
      const i0 = k.lastIndexOf('|');
      const id = k.slice(0, i0), duAnId = k.slice(i0 + 1) || null;
      const a = this.o.taiKhoan.tim(id);
      if (!a) continue;
      const co = this.luong.filter((x) => this._khoaLuong(x) === k).length;
      for (let i = co; i < muon(id, duAnId); i++) this.luong.push({ taiKhoanId: id, duAn: duAnId, luong: this.o.taoLuong(a, i + 1, duAnId) });
    }
  }

  /** Luồng dùng chung (Suno) chọn việc: chat / bài dở của chính tài khoản trước, rồi việc được bấm Chạy riêng,
   *  rồi CHIA LƯỢT ĐỀU giữa các dự án (dự án đang có ít việc chạy nhất trước) — dự án sau không phải chờ dự án trước. */
  _viecChung(x, boQua) {
    const ung = this.viec.filter((v) => v.trangThai === 'cho' && !boQua(v));
    if (!ung.length) return null;
    const dang = ung.find((v) => v.thread && v.taiKhoan === x.taiKhoanId);
    if (dang) return dang;
    if (ung.some((v) => v.uuTienLuc)) return hd.viecKeTiep(ung);
    const nen = x.luong.nen || 'muse';
    const dem = (id) => this.viec.filter((v) => v.duAn === id && v.trangThai === 'chay' && (v.nen || 'muse') === nen).length;
    // Ít việc đang chạy nhất trước; bằng nhau thì dự án vừa được luồng này phục vụ xếp sau (xoay vòng).
    const cuoi = x.duAnCuoi;
    const duAn = [...new Set(ung.map((v) => v.duAn))].sort((a, b) => dem(a) - dem(b) || (a === cuoi) - (b === cuoi));
    const j = hd.viecKeTiep(ung.filter((v) => v.duAn === duAn[0]));
    if (j) x.duAnCuoi = j.duAn;
    return j;
  }

  _vong() {
    this._demGio();
    this._xetHen();
    if (!this.dangChay) {
      if (this.luong.length && !this.coViecDangChay()) {
        for (const x of this.luong) this.o.huyLuong(x.luong);
        this.luong = [];
        this.o.bao();
      }
      return;
    }
    // Mỗi việc chờ (của dự án đang chạy, hoặc được bấm Chạy riêng) nhắm tới các tài khoản được chạy nó NGAY
    // BÂY GIỜ: nhóm chạy cùng lúc của dự án, tài khoản nào trong nhóm lỗi việc này thì dự phòng kế tiếp.
    // Bên nào thiếu tài khoản chạy được (so với số tài khoản Chạy của dự án) → mượn tài khoản bên kia cho đủ.
    this._canBang();
    const nhamToi = new Map();
    for (const j of this.viec) {
      if (j.trangThai !== 'cho' || !this._duocChay(j)) continue;
      let ds = this._tkCho(j);
      // Các tài khoản việc này chưa thử đều đang nghỉ / chưa đăng nhập → chỉ còn tài khoản đã lỗi:
      // coi như hết vòng, quay lại từ đầu (tài khoản chính). Hết số vòng → Lỗi luôn.
      if (ds.length && ds.every((t) => (j.tkLoi || []).includes(t)) && !(j.thread && j.taiKhoan === ds[0])) {
        const tkCu = j.tkLoi[j.tkLoi.length - 1];
        j.vongTk = (j.vongTk || 0) + 1;
        j.tkLoi = [];
        if (j.vongTk > theoNen(this.cd(j.duAn), j.nen, 'tuThuLai')) {
          // Hỏng ở mọi tài khoản qua đủ vòng → thử bên kia (Muse ⇄ Flow) trước khi đánh Lỗi.
          if (this._coTheDoiNen(j) && this._doiNen([j], `#${j.so} hỏng ở mọi tài khoản ${TEN_NEN[j.nen]}`)) {
            ds = this._tkCho(j);
          } else {
            // Lần chạy dở ở tài khoản dự phòng đã xoá chữ lỗi và đổi tài khoản → trả lại lỗi gốc + tài khoản đã lỗi.
            Object.assign(j, { trangThai: 'loi', buoc: '', xongLuc: Date.now(), loi: j.loi || j.loiTruoc || '', taiKhoan: tkCu });
            delete j.chayRieng;
            this.log('error', `❌ #${j.so} ${j.loi} (không còn tài khoản dự phòng dùng được)`);
            this.luu();
            continue;
          }
        } else ds = this._tkCho(j);
      }
      nhamToi.set(j, ds);
    }
    const can = new Set();
    for (const [j, ds] of nhamToi) for (const t of ds) can.add(this._khoa(t, j.duAn));
    for (const x of this.luong) if (!x.luong.ranh) can.add(this._khoaLuong(x));
    this._canLuong(can);
    const nham = (v, tkId) => (nhamToi.get(v) || []).includes(tkId);
    for (const x of this.luong) {
      if (!x.luong.ranh) continue;
      // Luồng riêng của dự án chỉ nhận việc của dự án đó; luồng dùng chung (Suno) chia lượt đều giữa các dự án.
      const boQua = (v) => !nham(v, x.taiKhoanId) || (!!x.duAn && v.duAn !== x.duAn);
      const j = x.duAn ? hd.viecKeTiep(this.viec, (v) => v.thread && v.taiKhoan === x.taiKhoanId, boQua) : this._viecChung(x, boQua);
      if (!j) continue;
      if (x.luong.nen === 'flow') {
        // Gom thêm việc cùng mẻ: cùng tài khoản nhắm tới, cùng dự án / loại / tỷ lệ / có-không ảnh.
        // Dự án chạy nhiều tài khoản cùng lúc → chia đều: mỗi tài khoản trong nhóm chỉ lấy phần của mình.
        // Việc bấm Chạy riêng đi mẻ riêng (không kéo theo cả hàng chờ của dự án đang nghỉ).
        const k = khoaMe(j);
        const cungMe = this.viec.filter((v) => v !== j && v.trangThai === 'cho' && nham(v, x.taiKhoanId) && khoaMe(v) === k &&
            this._duocChay(v))
          .sort((a, b) => (a.uuTienLuc ? 0 : 1) - (b.uuTienLuc ? 0 : 1) || a.taoLuc - b.taoLuc || a.id - b.id);
        const nhom = nhamToi.get(j) || [];
        const tabRanh = this.luong.filter((y) => y.luong.ranh && y.luong.nen === 'flow' && nhom.includes(y.taiKhoanId) && y.duAn === x.duAn).length;
        const phan = Math.ceil((cungMe.length + 1) / Math.max(1, tabRanh));
        const me = [j, ...cungMe].slice(0, Math.min(this.cd(j.duAn).flow.meToiDa, phan));
        for (const v of me) nhamToi.delete(v);
        if (!this.tkFlowDaChay.has(j.duAn)) this.tkFlowDaChay.set(j.duAn, new Set());
        this.tkFlowDaChay.get(j.duAn).add(x.taiKhoanId);
        this._giaoMe(x, me);
        continue;
      }
      nhamToi.delete(j);
      // Chat dở của tài khoản KHÁC (lỗi / tạm nghỉ / chưa đăng nhập) → gửi lại từ đầu bằng tài khoản này.
      if (j.thread && j.taiKhoan !== x.taiKhoanId) j.thread = '';
      this._giao(x, j);
    }
    this._xetXong(nhamToi);
  }

  /** Dự án nào chạy hết hàng chờ / không còn tài khoản chạy được thì thôi chạy; hết mọi thứ thì báo xong lượt. */
  _xetXong(nhamToi) {
    let tamDung = false;
    for (const id of [...this.duAnChay]) {
      const ten = this._tenDuAn(id);
      const conViec = this.viec.some((j) => j.duAn === id && (j.trangThai === 'cho' || j.trangThai === 'chay'));
      const ban = this.luong.some((x) => !x.luong.ranh && this._luongCuaDuAn(x, id));
      if (!conViec && !ban) {
        // Hết một lượt: việc lỗi còn lượt chạy lại → đưa về hàng chờ (gửi prompt mới) và chạy tiếp.
        const c = this.cd(id);
        const lai = this.viec.filter((j) => j.duAn === id && j.trangThai === 'loi' && (j.vongLai || 0) < theoNen(c, j.nen, 'tuChayLaiLoi'));
        if (lai.length) {
          for (const j of lai) {
            Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', thu: 0, tkLoi: [], vongTk: 0, batDauLuc: 0, xongLuc: 0, vongLai: (j.vongLai || 0) + 1 });
          }
          this.log('warning', `↻ Hết lượt — tự chạy lại ${lai.length} việc lỗi (lượt ${Math.max(...lai.map((j) => j.vongLai))}/${Math.max(...lai.map((j) => theoNen(c, j.nen, 'tuChayLaiLoi')))}) — dự án "${ten}"`);
          this.luu();
          continue;
        }
        this.duAnChay.delete(id);
        this.log('success', `✅ Dự án "${ten}": đã chạy hết hàng chờ.`);
        // Dọn dẹp (xoá chat Muse / dự án Flow) của dự án này — xong rồi mới tới tắt máy, cập nhật token.
        const don = this._canDonDep(id);
        if (don && this.o.donDep) {
          this._donCho = this._donCho.then(() => this.o.donDep(don)).catch((err) => this.log('error', `❌ Dọn dẹp: ${err.message}`));
        }
        this.o.bao();
      } else if (!ban) {
        // Còn việc chờ mà không tài khoản nào của dự án chạy được (chưa đăng nhập / đang tạm nghỉ) → dự án tạm dừng.
        const cho = [...nhamToi].filter(([j]) => j.duAn === id);
        if (cho.length && cho.every(([, ds]) => !ds.length) && !this.viec.some((j) => j.duAn === id && j.trangThai === 'chay')) {
          this.duAnChay.delete(id);
          this.duAnTamDung.add(id);
          this._baoTamDung(cho.map(([j]) => j), `dự án "${ten}"`);
          tamDung = true;
        }
      }
    }
    // 1.3.6: chức năng chạy theo hẹn giờ: hết việc → xong lượt hẹn; còn việc mà không tài khoản nào chạy được → tạm dừng.
    for (const [l, x] of [...this.loaiChay]) {
      const nho = (j) => (j.loai === l || j.henLoai === l) && (!x.duAn || j.duAn === x.duAn) && !x.bo.has(j.duAn);
      const conViec = this.viec.some((j) => nho(j) && (j.trangThai === 'cho' || j.trangThai === 'chay'));
      const ban = this.luong.some((y) => !y.luong.ranh && (y.luong.dsViec || (y.luong.viec ? [y.luong.viec] : [])).some(nho));
      const ten = HG.TEN_CHUC_NANG[l];
      if (!conViec && !ban) {
        const lai = this.viec.filter((j) => nho(j) && j.trangThai === 'loi' && (j.vongLai || 0) < theoNen(this.cd(j.duAn), j.nen, 'tuChayLaiLoi'));
        if (lai.length) {
          for (const j of lai) {
            Object.assign(j, { trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', thu: 0, tkLoi: [], vongTk: 0, batDauLuc: 0, xongLuc: 0, vongLai: (j.vongLai || 0) + 1 });
          }
          this.log('warning', `↻ Hẹn giờ ${ten}: hết lượt — tự chạy lại ${lai.length} việc lỗi (lượt ${Math.max(...lai.map((j) => j.vongLai))})`);
          this.luu();
          continue;
        }
        this.loaiChay.delete(l);
        this.log('success', `✅ Hẹn giờ ${ten}: đã chạy hết việc ${TEN_LOAI[l]} đang chờ.`);
        // Dọn dẹp như khi dự án chạy hết hàng chờ — chỉ dự án vừa có việc chạy trong lượt hẹn này, không còn việc
        // chờ / đang chạy, và không đang được bấm Chạy.
        const daChay = new Set(this.viec.filter((j) => nho(j) && (j.xongLuc || 0) >= x.batDauLuc).map((j) => j.duAn));
        for (const id of daChay) {
          if (this.duAnDangChay(id) || this.viec.some((j) => j.duAn === id && (j.trangThai === 'cho' || j.trangThai === 'chay'))) continue;
          const don = this._canDonDep(id);
          if (don && this.o.donDep) this._donCho = this._donCho.then(() => this.o.donDep(don)).catch((err) => this.log('error', `❌ Dọn dẹp: ${err.message}`));
        }
        this.o.bao();
      } else if (!ban) {
        const cho = [...nhamToi].filter(([j]) => nho(j));
        if (cho.length && cho.every(([, ds]) => !ds.length) && !this.viec.some((j) => nho(j) && j.trangThai === 'chay')) {
          this.loaiChay.delete(l);
          this._baoTamDung(cho.map(([j]) => j), `hẹn giờ ${ten}`);
          tamDung = true;
        }
      }
    }
    // Việc bấm Chạy riêng (dự án đang nghỉ) mà không còn tài khoản nào chạy được → thôi, về Chờ.
    const rieng = [...nhamToi].filter(([j]) => j.chayRieng && !this.duAnChay.has(j.duAn) && !nhamToi.get(j).length);
    if (rieng.length && !this.viec.some((j) => j.chayRieng && j.trangThai === 'chay')) {
      for (const [j] of rieng) delete j.chayRieng;
      this._baoTamDung(rieng.map(([j]) => j), `${rieng.length} việc chạy riêng`);
      tamDung = true;
    }
    if (tamDung) this._coTamDung = true;
    if (!this.dangChay && !this.coViecDangChay() && !this._baoHet) {
      this._baoHet = true;
      if (this._coTamDung) { this._coTamDung = false; return; }
      this.log('success', '✅ [HỆ THỐNG] Đã chạy hết hàng chờ.');
      this.o.bao();
      this._donCho.then(() => { if (!this.dangChay && this.o.hetLuot) this.o.hetLuot(); });
    }
  }

  _baoTamDung(ds, ai) {
    const ly = [...new Set(ds.flatMap((j) => this._dsTkGoc(j.duAn, j.nen, j.loai)))]
      .map((id) => {
        const a = this.o.taiKhoan.tim(id);
        if (!a) return null;
        const hetLuot = (a.hetLuotDen || 0) > Date.now() ? `hết lượt, nghỉ đến ${new Date(a.hetLuotDen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
        const kq = this.ketQuaTk[id];
        return `"${a.ten}": ${hetLuot || this.lyDoNghi[id] || (a.trangThai === 'can-dang-nhap' ? 'chưa đăng nhập' : kq && !kq.ok ? `lỗi: ${kq.loi}` : 'đang lỗi')}`;
      })
      .filter(Boolean);
    const coSuno = ds.some((j) => j.nen === 'suno');
    // 1.3.7: loại việc bị bỏ ở MỌI tài khoản của nền tảng đó (ô Ảnh / Video trong hộp chọn tài khoản).
    const boHet = [...new Set(ds.filter((j) => !this._dsTkGoc(j.duAn, j.nen, j.loai).length && this._dsTkGoc(j.duAn, j.nen).length)
      .map((j) => `${TEN_LOAI[j.loai] || j.loai} ${TEN_NEN[j.nen] || j.nen}`))];
    if (boHet.length) ly.push(`không tài khoản nào được bật ô ${boHet.join(', ')} — bấm nút tài khoản cạnh tên dự án để bật lại`);
    this.log('error', `⏸ Không còn tài khoản nào chạy được việc đang chờ (${ly.join(' · ') || 'chưa có tài khoản'}) — đã TẠM DỪNG ${ai} (không phí lượt). ` +
      'Kiểm tra Muse / Flow, đăng nhập lại rồi bấm Chạy — việc Muse đã gửi sẽ lấy tiếp kết quả từ chat cũ.' +
      (coSuno ? ' Suno hết lượt: thêm tài khoản Suno dự phòng, hoặc bấm Kiểm tra ở tài khoản đã có lượt lại.' : ''));
    this.o.bao();
  }

  async _giao(x, j) {
    const tk = this.o.taiKhoan.tim(x.taiKhoanId);
    const lan = j.lanGiao = (j.lanGiao || 0) + 1;   // 1.4.0: lần giao này — kết quả của lần giao cũ (việc đã đổi bên) bị bỏ
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
    const cd = this.cd(j.duAn);
    const r = await x.luong.chay(j, {
      tinNhan: j.loai === 'nhac' ? j.prompt : hd.taoTinNhan(j, nv, cd.mau),   // Suno: prompt nguyên văn vào ô Styles
      files,
      png: cd.png,
      choToiDaGiay: j.loai === 'nhac' ? cd.choNhacGiay : j.loai === 'video' ? cd.choVideoGiay : cd.choAnhGiay,
      choChuGiay: j.loai === 'video' ? cd.choChuGiay * 2 : cd.choChuGiay,
      choGui: () => this.choGui(x.taiKhoanId, theoNen(cd, j.nen, 'nghiGiuaLanGui')),
      capNhat: (thay) => { if (j.lanGiao === lan) { Object.assign(j, thay); this._luuBuoc(thay); } }
    });
    if (j.lanGiao !== lan) { this.o.bao(); return; }
    this._ketThuc(j, r, tk);
  }

  /** Giao một MẺ việc cho luồng Flow; mỗi việc xong / lỗi là báo về _ketThuc ngay, không đợi cả mẻ. */
  async _giaoMe(x, ds) {
    const tk = this.o.taiKhoan.tim(x.taiKhoanId);
    for (const j of ds) Object.assign(j, { trangThai: 'chay', taiKhoan: x.taiKhoanId, batDauLuc: Date.now(), loi: '', buoc: 'Chờ Flow' });
    // 1.4.0: việc tách khỏi mẻ (đổi sang Muse, dừng rồi chạy lại ở mẻ khác…) → kết quả về sau của mẻ NÀY không ghi vào nó nữa.
    const lan = new Map(ds.map((j) => [j, (j.lanGiao = (j.lanGiao || 0) + 1)]));
    const cuaMe = (j) => lan.get(j) === j.lanGiao;
    this.luu();
    const d = this.duAn.find((v) => v.id === ds[0].duAn) || { ten: 'Du_an' };
    try {
      await x.luong.chayMe(ds, {
        caiDat: this.cd(ds[0].duAn).flow,
        // Tên file / tên trên Flow = mã việc: chỉ [A-Za-z0-9_] để còn dùng làm @tên của Character Sync.
        // 1.3.0: ảnh và video đánh số riêng (đều từ 1) → video thêm "v" để không trùng tên ảnh cùng số trên Flow.
        tenFile: (j) => `${hd.slugTen(d.ten)}_${j.loai === 'video' ? 'v' : ''}${String(j.so).padStart(3, '0')}`,
        anhCua: (j) => [
          ...j.nhanVat.map((id) => this.nhanVat.find((n) => n.id === id)).filter(Boolean).flatMap((n) => n.anh || []),
          ...(j.thamChieu || [])
        ].filter((p) => this.o.tonTai(p)),
        // Kết quả đã có của các việc khác cùng loại — để luồng Flow nhận ra file engine tải nhầm (video cũ cùng prompt).
        fileCu: (j) => this.viec.filter((v) => v !== j && v.loai === j.loai).flatMap((v) => v.files || [])
          .filter((p) => this.o.tonTai(p)),
        capNhat: (j, thay) => { if (cuaMe(j) && this.viec.includes(j) && j.trangThai === 'chay') { Object.assign(j, thay); this._luuBuoc(thay); } },
        xong: (j, r) => { if (cuaMe(j)) this._ketThuc(j, r, tk); else this.o.bao(); }
      });
    } catch (err) {
      this.log('error', `❌ [${x.luong.id}] ${err.message}`);
      for (const j of ds) if (cuaMe(j) && j.trangThai === 'chay' && j.taiKhoan === x.taiKhoanId) this._ketThuc(j, { ok: false, loi: err.message }, tk);
    }
    this.o.bao();
  }

  /** Dự án của việc còn tài khoản KHÁC dùng được trên cùng nền tảng (để chuyển sang dự phòng) — hoặc
   *  việc chuyển được sang bên kia (Muse ⇄ Flow). */
  coDuPhong(tkId) {
    return this.viec.some((j) => j.taiKhoan === tkId && j.trangThai === 'chay' &&
      (this._dsTk(j.duAn, j.nen, j.loai).some((id) => id !== tkId && !this._nghi(id)) || this._coTheDoiNen(j)));
  }

  _nenKhac(nen) { return nen === 'muse' ? 'flow' : nen === 'flow' ? 'muse' : null; }

  /**
   * GIỮ ĐỦ SỐ TÀI KHOẢN CHẠY CÙNG LÚC (nhật ký 18/10/2026 00:42). Dự án chạy 5 tài khoản Flow cùng lúc (+3 dự phòng);
   * 7 tài khoản lần lượt hết credit / bị "hoạt động bất thường", còn đúng 1 tài khoản Flow chạy suốt 7 phút mà Muse
   * ngồi không — bản cũ chỉ chuyển sang Muse khi MỌI tài khoản Flow đều nghỉ, và lúc đó chuyển CẢ hàng chờ (321 video)
   * sang Muse luôn, Flow nghỉ xong cũng không lấy lại được.
   * Giờ mỗi lượt _vong, với mỗi (dự án, bên, loại việc) đang có việc chờ:
   *   cần  = số tài khoản Chạy của bên đó (chaySong, không quá số tài khoản của dự án);
   *   được = số tài khoản bên đó (Chạy + Dự phòng) còn chạy được loại việc này ngay bây giờ;
   *   thiếu = cần − được (dự phòng vào thay trước, hết dự phòng mới thiếu).
   * Thiếu k tài khoản → bên kia chạy thêm k tài khoản (_muonTk → _soSong) và nhận việc vừa đủ cho k tài khoản đó
   * (k × số luồng mỗi tài khoản Muse, hoặc k × số tab × mỗi mẻ của Flow), không hơn. Bên này có lại tài khoản
   * (hết giờ nghỉ) → việc mượn CHƯA chạy quay về. Việc mượn mang `muon = {tu, quaCu}`; hỏng ở mọi tài khoản bên
   * kia thì còn về được bên cũ một lần (_coTheDoiNen), không đẩy qua lại mãi.
   */
  _canBang() {
    this._muonTk = new Map();
    const nhom = new Map();
    for (const j of this.viec) {
      if (j.trangThai !== 'cho' || !this._duocChay(j) || !this._nenKhac(j.nen)) continue;
      const tu = j.muon ? j.muon.tu : j.nen;
      const k = `${j.duAn}|${tu}|${j.loai}`;
      if (!nhom.has(k)) nhom.set(k, { duAn: j.duAn, tu, loai: j.loai });
    }
    for (const { duAn, tu, loai } of nhom.values()) {
      const den = this._nenKhac(tu);
      const c = this.cd(duAn);
      const can = Math.max(1, Math.min(this._soSong(duAn, tu, true, loai), this._dsTkGoc(duAn, tu, loai).length));
      const duoc = this._dsTk(duAn, tu, loai).filter((id) => !this._nghi(id) && !this._nghiLoai(id, loai)).length;
      const thieu = c.doiNenKhiLoi ? Math.max(0, can - duoc) : 0;
      const moiTk = den === 'muse' ? c.luongMoiTK : c.flow.tabMoiTK * c.flow.meToiDa;
      const han = thieu * moiTk;
      const daMuon = this.viec.filter((v) => v.duAn === duAn && v.loai === loai && v.muon && v.muon.tu === tu && v.nen === den &&
        (v.trangThai === 'cho' || v.trangThai === 'chay'));
      if (daMuon.length < han) {
        const ung = this.viec.filter((v) => v.trangThai === 'cho' && this._duocChay(v) && v.duAn === duAn && v.nen === tu && v.loai === loai &&
            !v.muon && !v.thread && this._coTheDoiNen(v))
          .sort((a, b) => (a.uuTienLuc ? 0 : 1) - (b.uuTienLuc ? 0 : 1) || a.taoLuc - b.taoLuc || a.id - b.id)
          .slice(0, han - daMuon.length);
        if (ung.length) {
          for (const v of ung) {
            v.muon = { tu, quaCu: [...(v.daQuaNen || [])] };
            v.daQuaNen = [...new Set([...(v.daQuaNen || []), den])];
            Object.assign(v, { nen: den, buoc: '', taiKhoan: '', tkLoi: [], vongTk: 0, thu: 0 });
            if (den === 'muse') v.tuFlow = true;
          }
          const ten = loai === 'video' ? 'video' : 'ảnh';
          this.log('warning', `🔀 ${TEN_NEN[tu]} → ${TEN_NEN[den]}: dự án "${this._tenDuAn(duAn)}" chạy ${can} tài khoản ${TEN_NEN[tu]} cùng lúc ` +
            `nhưng chỉ còn ${duoc} tài khoản chạy được ${ten} — ${TEN_NEN[den]} chạy thêm ${thieu} tài khoản, nhận ${ung.length} ${ten} ` +
            `#${ung.map((v) => v.so).join(', #')}. ${TEN_NEN[tu]} có lại tài khoản thì ${ten} chưa chạy quay về ${TEN_NEN[tu]}.`);
          this.luu();
        }
      } else if (daMuon.length > han) {
        // Bên cũ có lại tài khoản: trả việc mượn chưa chạy (mới mượn sau trả trước).
        const dangChay = daMuon.filter((v) => v.trangThai === 'chay').length;
        const tra = daMuon.filter((v) => v.trangThai === 'cho' && !v.thread).reverse().slice(0, daMuon.length - Math.max(han, dangChay));
        if (tra.length) {
          for (const v of tra) {
            v.daQuaNen = v.muon.quaCu;
            Object.assign(v, { nen: tu, buoc: '', taiKhoan: '', tkLoi: [], vongTk: 0, thu: 0 });
            delete v.muon;
            if (tu === 'flow') delete v.tuFlow;
          }
          this.log('info', `🔀 ${TEN_NEN[tu]} đã có lại tài khoản chạy được (dự án "${this._tenDuAn(duAn)}") — ` +
            `${tra.length} ${loai === 'video' ? 'video' : 'ảnh'} chưa chạy quay về ${TEN_NEN[tu]}: #${tra.map((v) => v.so).join(', #')}.`);
          this.luu();
        }
      }
      if (thieu) this._muonTk.set(`${duAn}|${den}`, Math.max(this._muonTk.get(`${duAn}|${den}`) || 0, thieu));
    }
  }
  /** Dự án còn tài khoản `nen` nào chạy được loại việc này (đăng nhập rồi, không nghỉ, không bị chặn loại). */
  _conDung(duAnId, nen, loai) {
    return this._dsTk(duAnId, nen, loai).some((id) => !this._nghi(id) && !this._nghiLoai(id, loai));
  }
  /** Việc chuyển được sang bên kia: bật công tắc, chưa từng ở bên đó, bên đó có tài khoản chạy được ngay. */
  _coTheDoiNen(j) {
    const k = this._nenKhac(j.nen);
    return !!(k && this.cd(j.duAn).doiNenKhiLoi && !(j.daQuaNen || []).includes(k) &&
      this._tkDoiNen(j.duAn, k, j.loai).some((id) => !this._nghi(id) && !this._nghiLoai(id, j.loai)));
  }
  /** Tài khoản bên kia nhận được việc chuyển sang: dự án tự chọn, hoặc đã đăng nhập chắc chắn — tài khoản
   *  mặc định chưa ai đăng nhập (vd "Flow 1" của người chỉ dùng Muse) không được tính. */
  _tkDoiNen(duAnId, nen, loai) {
    const d = this.duAn.find((x) => x.id === duAnId);
    const chon = new Set((d && d.taiKhoan) || []);
    return this._dsTk(duAnId, nen, loai).filter((id) => { const a = this.o.taiKhoan.tim(id); return chon.has(id) || (a && a.trangThai === 'da-dang-nhap'); });
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
      delete v.muon;
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
    // 1.3.0: việc đã bị DỪNG RIÊNG (trong mẻ Flow đang chạy) → bỏ kết quả về sau của nó.
    if (j.trangThai === 'dung') { this.o.bao(); return; }
    // 1.4.0: người dùng bấm đổi sang bên kia lúc việc đang chạy ở Muse → luồng Muse đã dừng (hoặc lỗi): chuyển, chạy ngay.
    if (j.chuyenNen && !r.ok) {
      const { nen, chay } = j.chuyenNen;
      this._apNen(j, nen);
      delete j.chayRieng;
      if (chay) this._chayRieng([j]);
      this.log('warning', `🔀 #${j.so} đã dừng ở Muse — chạy lại ở ${TEN_NEN[nen]}.`);
      this.luu();
      return;
    }
    this._ketThucViec(j, r, tk);
    // Việc chạy riêng đã tới trạng thái cuối → thôi cờ chạy riêng.
    if (TRANG_XONG.has(j.trangThai)) { delete j.chayRieng; delete j.uuTienLuc; delete j.chuyenNen; }
    if (j.trangThai !== 'chay') delete j.dungTay;
    this.luu();
  }

  _ketThucViec(j, r, tk) {
    const d = this.duAn.find((x) => x.id === j.duAn) || { ten: 'Du_an' };
    const c = this.cd(j.duAn);
    if (r.ok) {
      try {
        const video = j.loai === 'video', nhac = j.loai === 'nhac';
        const tai = nhac || (video ? c.taiVideo : c.taiAnh);   // nhạc luôn tải về
        let goc = tai ? this.thuMucRa(j.loai, j.duAn) : this.thuMucTamDuAn(j.duAn);
        let mau = nhac ? c.tenNhac : video ? c.tenVideo : c.tenAnh;
        // Video nối từ ảnh (Flow ⇄ Muse): lưu NGAY CẠNH ảnh nguồn, cùng tên — 325.jpg → 325.mp4. Người dùng
        // đặt thư mục ảnh riêng mà video vẫn vào thư mục mặc định thì tưởng video không được tải về
        // (nhật ký 15/10/2026: ảnh "325.jpg", video "Mac_dinh\Mac_dinh_270.mp4" ở chỗ khác).
        // 1.0.4: tắt "cạnh ảnh" mà đã chọn thư mục riêng cho video nối từ ảnh → lưu vào đó, vẫn cùng tên ảnh.
        if (video && (j.tuAnh || j.anhCoSan) && tai) {   // 1.4.2: video từ ảnh đã có trong thư mục lưu như video nối từ ảnh
          const anhNguon = (j.thamChieu || []).slice(-1)[0] || '';
          // 1.2.9: dự án đã chọn thư mục riêng (trang Tạo ảnh → Ảnh xong → tự tạo video) → ưu tiên hơn cài đặt chung.
          if (d.thuMucVideoAnh) {
            goc = d.thuMucVideoAnh;
            mau = '{tenAnh}';
          } else if (c.videoCanhAnh) {
            if (anhNguon && !path.resolve(anhNguon).startsWith(path.resolve(this.o.thuMucTam))) {
              goc = path.dirname(anhNguon);
              mau = '{tenAnh}';
            }
          } else if (c.thuMucVideoAnh) {
            goc = c.thuMucVideoAnh;
            mau = '{tenAnh}';
          }
        }
        const cu = j.files || [];
        // 1.4.1: tên đưa lên Drive = tên ĐÚNG theo mẫu (bỏ " (2)" mà máy phải thêm vì thư mục trên máy đã có file
        // cùng tên của dự án / lần chạy khác). Video đặt tên theo ảnh ({tenAnh}) → theo tên Drive của ảnh nguồn.
        const anhGoc = j.tuAnh && this.viec.find((x) => x.id === j.tuAnh);
        const jTen = anhGoc && (anhGoc.tenDrive || [])[0]
          ? { ...j, thamChieu: [...(j.thamChieu || []).slice(0, -1), anhGoc.tenDrive[0]] } : j;
        const tenDrive = [];
        j.files = r.files.map((f, i) => {
          if (f.duongDan && !f.mime) f.mime = hd.mimeTuDuoi(f.duongDan);
          tenDrive.push(hd.tenFile(d, jTen, f.mime, i, mau).split('/').pop());
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
        Object.assign(j, { trangThai: 'xong', buoc: '', xongLuc: Date.now(), loi: '', tam: !tai, tenDrive });
        if (r.flowTen) j.flowTen = { tk: j.taiKhoan, ten: r.flowTen };
        this.loiLienTiep[j.taiKhoan] = 0;
        if (j.taiKhoan) this.ketQuaTk[j.taiKhoan] = { ok: true, luc: Date.now() };
        this.log('success', `✅ [HỆ THỐNG] Việc #${j.so} xong ${TEN_LOAI[j.loai] || 'ảnh'}${r.ghiChu ? ` (${r.ghiChu})` : ''}: ` +
          (tai ? j.files[0] : `${path.basename(j.files[0])} (không tải về — chỉ giữ trong app)`));
        this._lenDrive(j);   // 1.4.0: bật "tự đưa lên Google Drive" thì chép sang thư mục Drive (chạy nền)
        this._noiVideo(j, d);
      } catch (err) {
        Object.assign(j, { trangThai: 'loi', buoc: '', loi: `Không ghi được file: ${err.message}` });
        this.log('error', `❌ #${j.so} ${j.loi}`);
      }
    } else if (r.dung) {
      // Dừng riêng việc này (nút Dừng ở dòng việc) → "Đã dừng"; dừng cả dự án → về hàng chờ.
      Object.assign(j, { trangThai: j.dungTay ? 'dung' : 'cho', buoc: '' });
      if (j.dungTay) j.uuTienLuc = 0;
      if (!r.giuThread) j.thread = '';
    } else if (r.chanLoai) {
      // Muse báo tài khoản bị chặn tạo loại việc này (403 / chặn khu vực): lỗi của TÀI KHOẢN — không tính lần
      // thử, tài khoản thôi nhận loại việc này một lúc (loại khác vẫn chạy), việc sang tài khoản khác ngay.
      const tkId = j.taiKhoan;
      Object.assign(j, { trangThai: 'cho', buoc: '', loi: r.loi, thread: '' });
      if (!this._nghiLoai(tkId, j.loai)) {
        this.lyDoNghi[tkId] = r.loi;
        if (j.loai === 'video' && this.o.taiKhoan.tim(tkId)) {
          // Chặn khu vực không tự hết sau 1 giờ: nhớ trên tài khoản (24 giờ, qua cả lần mở app sau) để không gửi
          // lại video vào tài khoản này mỗi lần bấm Chạy. Tài khoản vẫn tạo ảnh. Bấm Kiểm tra để thử lại sớm.
          this.o.taiKhoan.sua(tkId, { chanVideoDen: Date.now() + CHAN_VIDEO_MS, lyDoChanVideo: r.loi });
          this.log('warning', `⚠ "${this._tenTk(tkId)}": ${r.loi} — tài khoản này thôi nhận VIDEO 24 giờ (vẫn tạo ảnh); video chuyển sang tài khoản Muse khác, hết tài khoản Muse thì sang Flow. Bấm Kiểm tra ở tài khoản để thử lại sớm.`);
        } else {
          this.nghiLoai[`${tkId}:${j.loai}`] = Date.now() + NGHI_CHAN_LOAI_MS;
          this.log('warning', `⚠ "${this._tenTk(tkId)}": ${r.loi} — tài khoản này thôi nhận việc ${TEN_LOAI[j.loai] || j.loai} ${Math.round(NGHI_CHAN_LOAI_MS / 60000)} phút, việc chuyển sang tài khoản khác.`);
        }
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
      if (tk) this.o.taiKhoan.sua(tkId, { hetLuotDen: Date.now() + (r.nghiMs > 0 ? r.nghiMs : NGHI_HET_LUOT_MS), lyDoHetLuot: r.loi });
      this.lyDoNghi[tkId] = r.loi;
      const sang = hd.taiKhoanChoViec({ tkLoi: [] }, this._dsTk(j.duAn, j.nen, j.loai), (id) => this._nghi(id));
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
      const ds = this._dsTk(j.duAn, j.nen, j.loai);
      j.tkLoi = [...new Set([...(j.tkLoi || []), tkId])];
      j.loiTruoc = r.loi;
      this.loiLienTiep[tkId] = (this.loiLienTiep[tkId] || 0) + 1;
      if (tkId) this.ketQuaTk[tkId] = { ok: false, luc: Date.now(), loi: rutLoi(r.loi) };
      // Tài khoản lỗi liên tiếp → cả dự án sang tài khoản dự phòng một thời gian (chỉ khi có dự phòng).
      // Ảnh Flow chuyển được sang Muse thì Muse cũng tính là dự phòng.
      const coDuPhong = ds.some((id) => id !== tkId) || this._coTheDoiNen(j);
      if (this.loiLienTiep[tkId] >= LOI_LIEN_TIEP_NGHI && coDuPhong) this._choNghi(tkId, `lỗi ${this.loiLienTiep[tkId]} việc liên tiếp, lần gần nhất: ${rutLoi(r.loi)}`);
      j.thu = (j.thu || 0) + 1;
      // Mọi tài khoản của dự án đều đã lỗi việc này → hết một vòng, vòng sau bắt đầu lại từ tài khoản chính.
      if (!ds.some((id) => !j.tkLoi.includes(id))) { j.vongTk = (j.vongTk || 0) + 1; j.tkLoi = []; }
      const vong = j.vongTk || 0, soVong = theoNen(c, j.nen, 'tuThuLai') + 1;
      if (vong < soVong) {
        const sang = hd.taiKhoanChoViecDs({ tkLoi: j.tkLoi }, ds, (id) => this._nghi(id), this._soSong(j.duAn, j.nen, false, j.loai))
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
  }

  /** Tài khoản tạm nghỉ (mặc định NGHI_MS): việc của mọi dự án chuyển sang tài khoản dự phòng. */
  _choNghi(id, lyDo, ms = NGHI_MS) {
    if (!id || this._nghi(id)) return;
    this.nghiDen[id] = Date.now() + ms;
    this.lyDoNghi[id] = lyDo;
    const lau = ms >= 2 * 3600000 ? `${Math.round(ms / 3600000)} giờ` : `${Math.round(ms / 60000)} phút`;
    this.log('warning', `⚠ "${this._tenTk(id)}": ${lyDo} — tạm nghỉ tài khoản này ${lau}, việc chuyển sang tài khoản dự phòng (nếu có).`);
  }

  /**
   * 1.4.5: cả máy nghỉ Flow — mọi tài khoản Flow (trừ `tru`, tài khoản vừa nghỉ riêng) nghỉ ít nhất `ms`, luồng đang
   * chạy dừng, việc về hàng chờ (ảnh sang Muse nếu bật Muse ⇄ Flow). Bấm "Chạy lại ngay" ở tài khoản thì bỏ nghỉ.
   */
  nghiCaFlow(ms, lyDo, tru) {
    const den = Date.now() + ms, ds = [];
    for (const tk of this.o.taiKhoan.ds) {
      if ((tk.nen || 'muse') !== 'flow' || tk.id === tru || (this.nghiDen[tk.id] || 0) >= den) continue;
      this.nghiDen[tk.id] = den;
      this.lyDoNghi[tk.id] = lyDo;
      ds.push(tk.id);
      for (const x of this.luong) if (x.taiKhoanId === tk.id && !x.luong.ranh) x.luong.dung(lyDo);
    }
    this.log('error', `🛑 Cả máy nghỉ Flow ${Math.round(ms / 3600000)} giờ: ${lyDo}. Chạy tiếp chỉ làm các tài khoản còn lại dính theo` +
      `${ds.length ? ` — ${ds.length} tài khoản Flow khác cũng nghỉ` : ''}; ảnh chờ sang Muse nếu dự án bật Muse ⇄ Flow và có tài khoản Muse.`);
    this.o.bao();
    return ds;
  }

  dong() { clearInterval(this.hen); for (const x of this.luong) x.luong.dung(); }
}

module.exports = { DieuPhoi, CAI_DAT_MAC_DINH, NGHI_HET_LUOT_MS };
