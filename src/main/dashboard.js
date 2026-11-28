'use strict';
// ============================================================================
//  dashboard.js — 1.8.0: BẢNG ĐIỀU KHIỂN chạy cả quy trình của MỘT "dự án tổng" (một thư mục chứa mọi file đầu vào).
//
//  Thư mục dự án tổng (vd G:\My Drive\TBN_16) do skill chia cảnh / TTS Clone Studio tạo:
//    <tên> - prompt anh.txt        prompt ảnh, cách nhau bằng dòng trống   → images/012.png
//    <tên> - prompt animation.txt  prompt video, dòng N ↔ ảnh N           → Videos/012.mp4 (video từ ảnh)
//    <tên> - nhac flowmusic.txt    prompt nhạc, cách nhau bằng dòng trống   → BGM/001.mp3
//    <tên> - thumbnail.txt         prompt thumbnail (dòng trống)            → thumbnail/001.png
//    <tên>_motion.xlsx             video motion graphic                     → Videos/0012.mp4
//    <tên>_footage.xlsx            footage stock (Pexels / Pixabay)         → Videos/0014.mp4
//    <tên>_tts.xlsx, _overlay.xlsx, Audio/   — của TTS Clone Studio / CapCut Draft Studio (chỉ hiện trạng thái)
//
//  Ảnh / video / nhạc / thumbnail chạy qua hàng đợi của app (DieuPhoi) trên một dự án của app gắn với thư mục này
//  (thumbnail một dự án phụ, để số 001… không lẫn với ảnh cảnh); motion, footage qua QuanLyMotion / QuanLyFootage.
//  Mỗi mục có công tắc riêng, một công tắc Chạy tất cả, báo cáo tiến độ / thời gian / lỗi từng mục và từng lượt chạy,
//  hẹn giờ "Chạy tất cả" (giờ bắt đầu / dừng, mỗi ngày hoặc một lần). Nhớ nhiều dự án tổng (chọn thư mục cha chứa nhiều
//  thư mục video → thêm cả). Phần này thuần (không Electron): mọi thứ bên ngoài truyền vào qua `o` để kiểm bằng node.
// ============================================================================

const fs = require('fs');
const path = require('path');
const hd = require('./hang-doi');
const { timThuMucCon, fileTheoSo, docFileMotion } = require('./motion');
const { docFileFootage } = require('./footage');
const HG = require('./hen-gio');

const MUC = {
  anh: { ten: 'Tạo ảnh', loai: 'anh', hang: true, thuMuc: ['images', 'image', 'anh', 'ảnh'], taoThuMuc: 'images' },
  video: { ten: 'Tạo video từ ảnh', loai: 'video', hang: true, thuMuc: ['videos', 'video'], taoThuMuc: 'Videos' },
  nhac: { ten: 'Tạo nhạc nền', loai: 'nhac', hang: true, thuMuc: ['bgm', 'nhac', 'nhạc', 'music'], taoThuMuc: 'BGM' },
  motion: { ten: 'Motion graphic', thuMuc: ['videos', 'video'], taoThuMuc: 'Videos' },
  footage: { ten: 'Footage stock', thuMuc: ['videos', 'video'], taoThuMuc: 'Videos' },
  thumbnail: { ten: 'Thumbnail', loai: 'anh', hang: true, phu: true, thuMuc: ['thumbnail', 'thumbnails'], taoThuMuc: 'thumbnail' }
};
const THU_TU = ['anh', 'video', 'nhac', 'motion', 'footage', 'thumbnail'];
/** Nhận diện file đầu vào theo tên (không phân biệt hoa thường). Thứ tự quan trọng: file đã nhận ở mục trước không xét lại. */
const KHOP = [
  ['video', /prompt[\s_-]*(animation|anim|video)\b.*\.(txt|md)$/i],
  ['anh', /prompt[\s_-]*(anh|ảnh|image|img)\b.*\.(txt|md)$/i],
  ['thumbnail', /thumb(nail)?s?\b.*\.(txt|md)$/i],
  ['nhac', /(nhac|nhạc|music|flowmusic|bgm)\b.*\.(txt|md)$/i],
  ['motion', /[\s_-]motion\.(xlsx|csv)$/i],
  ['footage', /[\s_-]footage\.(xlsx|csv)$/i],
  ['tts', /[\s_-]tts\.(xlsx|csv)$/i],
  ['overlay', /[\s_-]?overlay\.(xlsx|csv|tsv)$/i]
];
const DASH_MAC_DINH = {
  goc: '',
  muc: {
    anh: { bat: true, nen: 'muse', tyLe: '16:9' },
    video: { bat: true, nen: 'muse' },
    nhac: { bat: true },
    motion: { bat: true },
    footage: { bat: true },
    thumbnail: { bat: true, nen: 'muse', tyLe: '16:9' }
  },
  dsGoc: [],     // dự án tổng đã mở [{ goc, luc }] (mới nhất trước)
  hen: [],       // hẹn giờ Chạy tất cả [{ id, bat, batDau, ketThuc, lap, goc, datLuc, daChay }]
  henDang: null, // lượt đang chạy theo hẹn { id, den }
  lienKet: {},   // thư mục → { duAn, duAnThumb }
  chonTep: {},   // thư mục → { muc: đường dẫn } (chọn tay khi có nhiều file cùng loại)
  luot: [],      // lượt chạy đã xong (mới nhất trước)
  dang: null     // lượt đang chạy { batDau, muc: { k: { batDau, ketThuc, coTruoc } } }
};
const LUOT_GIU = 30;
const GOC_GIU = 20;
const TRONG = new Set(['cho', 'chay']);

const docChu = (f) => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');

/** Danh sách file đầu vào trong thư mục: { muc: [{ tep, ten, mtime }] } (mới nhất trước). */
function timTepDauVao(goc) {
  const ra = {};
  let ds = [];
  try { ds = fs.readdirSync(goc, { withFileTypes: true }).filter((d) => d.isFile() && !d.name.startsWith('~$')); } catch (_) { return ra; }
  for (const d of ds) {
    const k = (KHOP.find(([, re]) => re.test(d.name)) || [])[0];
    if (!k) continue;
    const tep = path.join(goc, d.name);
    let mtime = 0;
    try { mtime = fs.statSync(tep).mtimeMs; } catch (_) {}
    (ra[k] = ra[k] || []).push({ tep, ten: d.name, mtime });
  }
  for (const v of Object.values(ra)) v.sort((a, b) => b.mtime - a.mtime || a.ten.localeCompare(b.ten));
  return ra;
}

/** Thư mục có ít nhất một file đầu vào cho các mục chạy (không tính _tts / _overlay). */
const coDauVao = (goc) => Object.keys(timTepDauVao(goc)).some((k) => THU_TU.includes(k));

/** Prompt trong file theo mục: ảnh / nhạc / thumbnail cách nhau bằng dòng trống (một khối không có dòng trống mà nhiều dòng → mỗi dòng một prompt);
 *  video: dòng N ↔ ảnh N (giữ dòng trống để đúng số). */
function docPrompt(muc, tep) {
  const chu = docChu(tep).replace(/\r\n?/g, '\n');
  if (muc === 'video') {
    const dong = chu.split('\n').map((x) => x.trim());
    while (dong.length && !dong[dong.length - 1]) dong.pop();
    return dong;
  }
  const doan = hd.tachPrompt(chu, 'doan');
  return doan.length === 1 && /\n/.test(doan[0]) ? hd.tachPrompt(chu, 'dong') : doan;
}

const gopSo = (ds) => hd.gonSo([...new Set(ds)].sort((a, b) => a - b));

class QuanLyDashboard {
  /**
   * o: { store, dieuPhoi, motion, footage, log(muc, chu), bao(), duAnMacDinh() → id dự án đang mở (chép tài khoản / cài đặt), bayGio() }
   */
  constructor(o) {
    this.o = o;
    this.store = o.store;
    this.log = o.log || (() => {});
    this.bao = o.bao || (() => {});
    this.nho = null;          // { luc, goc, kq } kết quả quét thư mục gần nhất
    this.lanMotion = 0;
    // mở lại app giữa lượt chạy → lượt đó coi như đã dừng (các mục không tự chạy lại khi mở app)
    const d = this.duLieu;
    if (d.dang) { this._ketLuot('dung', true); }
  }

  bayGio() { return this.o.bayGio ? this.o.bayGio() : Date.now(); }
  get duLieu() {
    const d = this.store.data.dashboard || {};
    const muc = {};
    for (const k of THU_TU) muc[k] = { ...DASH_MAC_DINH.muc[k], ...((d.muc || {})[k] || {}) };
    return { ...DASH_MAC_DINH, ...d, muc, lienKet: d.lienKet || {}, chonTep: d.chonTep || {}, luot: d.luot || [], dsGoc: d.dsGoc || [], hen: d.hen || [] };
  }
  luu(thay) { this.store.set({ dashboard: { ...this.duLieu, ...thay } }); this.bao(); }
  get dangChay() { return !!this.duLieu.dang; }
  get dp() { return this.o.dieuPhoi; }

  // ── Thư mục dự án tổng, dự án của app gắn với nó ─────────────────────────
  /**
   * Chọn thư mục dự án tổng. Thư mục có file đầu vào → dùng luôn. Không có mà các thư mục con có (thư mục cha chứa nhiều
   * video, vd "Kênh/TBN_16", "Kênh/TBN_17") → thêm mọi thư mục con đó vào danh sách, mở thư mục con đầu tiên.
   */
  chonGoc(goc, nguon) {
    const g = String(goc || '').trim();
    if (!g || !fs.existsSync(g) || !fs.statSync(g).isDirectory()) return { ok: false, loi: 'Thư mục không tồn tại' };
    if (this.dangChay) return { ok: false, loi: 'Đang chạy — tắt "Chạy tất cả" trước khi đổi dự án tổng' };
    let ds = [g];
    if (!coDauVao(g)) {
      let con = [];
      try { con = fs.readdirSync(g, { withFileTypes: true }).filter((x) => x.isDirectory() && !x.name.startsWith('_') && !x.name.startsWith('.')).map((x) => path.join(g, x.name)); } catch (_) {}
      con = con.filter(coDauVao).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
      if (!con.length) return { ok: false, loi: 'Thư mục này (và các thư mục con) không có file đầu vào nào (" - prompt anh.txt", " - prompt animation.txt", " - nhac flowmusic.txt", "_motion.xlsx", "_footage.xlsx", " - thumbnail.txt")' };
      ds = con;
    }
    const d = this.duLieu;
    const n = this.bayGio();
    const dsGoc = [...ds.map((x, i) => ({ goc: x, luc: n - i })), ...d.dsGoc.filter((x) => !ds.includes(x.goc))].slice(0, GOC_GIU);
    this.luu({ goc: ds[0], dsGoc });
    this.nho = null;
    const lk = this.lienKetDuAn(ds[0], true, nguon);
    this.log('info', `🧭 Dashboard: dự án tổng "${ds[0]}" → dự án "${this._tenDuAn(lk.duAn)}" của app${ds.length > 1 ? ` (thêm ${ds.length} thư mục con vào danh sách)` : ''}`);
    return { ok: true, duAn: lk.duAn, them: ds.length };
  }

  /** Bỏ một dự án tổng khỏi danh sách (không xoá file, không xoá dự án của app). */
  boGoc(goc) {
    const d = this.duLieu;
    if (this.dangChay && goc === d.goc) return { ok: false, loi: 'Đang chạy dự án tổng này — tắt "Chạy tất cả" trước' };
    const dsGoc = d.dsGoc.filter((x) => x.goc !== goc);
    this.luu({ dsGoc, goc: d.goc === goc ? (dsGoc[0] ? dsGoc[0].goc : '') : d.goc });
    this.nho = null;
    return { ok: true };
  }

  _tenDuAn(id) { const d = this.dp.duAn.find((x) => x.id === id); return d ? d.ten : id; }

  /** Dự án của app gắn với thư mục (tạo mới theo tên thư mục nếu chưa có, chép tài khoản / cài đặt từ dự án đang mở). */
  lienKetDuAn(goc, tao, nguon) {
    const d = this.duLieu;
    const lk = { ...(d.lienKet[goc] || {}) };
    const con = (id) => id && this.dp.duAn.some((x) => x.id === id);
    if (!con(lk.duAn) && tao) {
      // đã có dự án của app mang đúng tên thư mục (vd tự tạo trước đây) → dùng luôn, không tạo "TBN_16-2"
      const ten = path.basename(goc) || 'Dự án tổng';
      const daCo = this.dp.duAn.find((x) => String(x.ten).trim().toLowerCase() === ten.toLowerCase() && !Object.values(d.lienKet).some((l) => l.duAn === x.id || l.duAnThumb === x.id));
      lk.duAn = daCo ? daCo.id : this._taoDuAn(ten, nguon).id;
    }
    if (lk.duAnThumb && !con(lk.duAnThumb)) delete lk.duAnThumb;
    if (con(lk.duAn)) { this.luu({ lienKet: { ...d.lienKet, [goc]: lk } }); this.caiDuAn(goc, lk); }
    return lk;
  }

  _taoDuAn(ten, nguonDuAn) {
    const nguonId = nguonDuAn || (this.o.duAnMacDinh && this.o.duAnMacDinh());
    const nguon = this.dp.duAn.find((x) => x.id === nguonId) || this.dp.duAn[0];
    const d = this.dp.taoDuAn(ten, nguon && nguon.taiKhoan, nguon && nguon.chaySong, nguon ? nguon.id : undefined, nguon && nguon.boLoai);
    return d;
  }

  /** Chọn dự án khác của app cho thư mục này. */
  datDuAn(id) {
    const goc = this.duLieu.goc;
    if (!goc) return { ok: false, loi: 'Chưa chọn dự án tổng' };
    if (this.dangChay) return { ok: false, loi: 'Đang chạy — tắt "Chạy tất cả" trước' };
    if (!this.dp.duAn.some((x) => x.id === id)) return { ok: false, loi: 'Không có dự án này' };
    const d = this.duLieu;
    const lk = { ...(d.lienKet[goc] || {}), duAn: id };
    this.luu({ lienKet: { ...d.lienKet, [goc]: lk } });
    this.caiDuAn(goc, lk);
    return { ok: true };
  }

  /**
   * Cài dự án của app cho đúng thư mục dự án tổng: ảnh vào images/{stt}, video từ ảnh vào Videos/ (tên = tên ảnh),
   * nhạc vào BGM/{stt}, tải về máy (thư mục đã nằm trong Google Drive cho máy tính thì Drive tự đồng bộ) → tắt "đưa lên
   * Drive" của RIÊNG dự án này (bật Drive thì app giữ file ở thư mục tạm, không vào thư mục dự án tổng), bỏ qua số đã có.
   */
  caiDuAn(goc, lk) {
    const c = (k) => path.join(goc, timThuMucCon(goc, MUC[k].thuMuc) ? path.basename(timThuMucCon(goc, MUC[k].thuMuc)) : MUC[k].taoThuMuc);
    const cd = this.dp.cd(lk.duAn);
    const muon = { taiAnh: true, taiVideo: true, taiNhac: true, driveBat: false, boQuaDaCo: true, thuMucAnh: c('anh'), tenAnh: '{stt}',
      thuMucVideo: c('video'), tenVideo: '{stt}', thuMucNhac: c('nhac'), tenNhac: '{stt}' };
    const doi = Object.fromEntries(Object.entries(muon).filter(([k, v]) => cd[k] !== v));
    if (Object.keys(doi).length) this.dp.datCaiDat(doi, lk.duAn);
    const da = this.dp.duAn.find((x) => x.id === lk.duAn);
    if (da && da.thuMucVideoAnh !== c('video')) this.dp.datThuMucVideoDuAn(lk.duAn, c('video'));
    if (da && da.thuMucQuet) for (const l of Object.keys(da.thuMucQuet)) this.dp.datThuMucQuet(lk.duAn, l, '');
    if (lk.duAnThumb) {
      const ct = this.dp.cd(lk.duAnThumb);
      const m2 = { taiAnh: true, driveBat: false, boQuaDaCo: true, thuMucAnh: c('thumbnail'), tenAnh: '{stt}' };
      const d2 = Object.fromEntries(Object.entries(m2).filter(([k, v]) => ct[k] !== v));
      if (Object.keys(d2).length) this.dp.datCaiDat(d2, lk.duAnThumb);
    }
  }

  /** Dự án phụ cho thumbnail (tạo khi cần lần đầu). */
  _duAnThumb(goc) {
    const d = this.duLieu;
    const lk = { ...(d.lienKet[goc] || {}) };
    if (!lk.duAnThumb || !this.dp.duAn.some((x) => x.id === lk.duAnThumb)) {
      lk.duAnThumb = this._taoDuAn(`${path.basename(goc)} · thumbnail`, lk.duAn).id;
      this.luu({ lienKet: { ...d.lienKet, [goc]: lk } });
    }
    this.caiDuAn(goc, lk);
    return lk.duAnThumb;
  }

  datMuc(k, thay) {
    if (!MUC[k]) return { ok: false, loi: 'Mục lạ' };
    const d = this.duLieu;
    const cu = d.muc[k];
    const moi = { ...cu };
    if ('bat' in thay) moi.bat = !!thay.bat;
    if ('nen' in thay && (thay.nen === 'muse' || thay.nen === 'flow')) moi.nen = thay.nen;
    if ('tyLe' in thay && hd.TY_LE.includes(thay.tyLe)) moi.tyLe = thay.tyLe;
    this.luu({ muc: { ...d.muc, [k]: moi } });
    if (this.dangChay && 'bat' in thay && moi.bat !== cu.bat) {
      if (moi.bat) this._batDauMuc(k); else this._dungMuc(k, true);
    }
    return { ok: true };
  }

  chonTep(k, tep) {
    const d = this.duLieu;
    if (!d.goc) return { ok: false, loi: 'Chưa chọn dự án tổng' };
    const ct = { ...(d.chonTep[d.goc] || {}) };
    if (tep) ct[k] = tep; else delete ct[k];
    this.luu({ chonTep: { ...d.chonTep, [d.goc]: ct } });
    this.nho = null;
    return { ok: true };
  }

  // ── Quét thư mục: file đầu vào, số đã có ─────────────────────────────────
  thuMuc(k, goc = this.duLieu.goc) {
    const co = timThuMucCon(goc, MUC[k].thuMuc);
    return co || path.join(goc, MUC[k].taoThuMuc);
  }

  /** Đọc thư mục dự án tổng (giữ kết quả `nhoMs` để giao diện hỏi mỗi giây không đọc đĩa mỗi giây). */
  quet(nhoMs = 4000) {
    const d = this.duLieu;
    const goc = d.goc;
    if (!goc) return null;
    const n = this.bayGio();
    if (this.nho && this.nho.goc === goc && n - this.nho.luc < nhoMs) return this.nho.kq;
    const tep = timTepDauVao(goc);
    const chon = d.chonTep[goc] || {};
    const tepCua = (k) => {
      const ds = tep[k] || [];
      return (chon[k] && ds.find((x) => x.tep === chon[k])) || ds[0] || null;
    };
    const kq = { goc, coThuMuc: fs.existsSync(goc), tep: {}, muc: {}, phu: {} };
    for (const k of [...THU_TU, 'tts', 'overlay']) kq.tep[k] = { chon: tepCua(k) && tepCua(k).tep, ds: (tep[k] || []).map((x) => ({ tep: x.tep, ten: x.ten })) };
    const coSo = (dir, re) => fileTheoSo(dir, re);
    const anhCo = coSo(this.thuMuc('anh', goc), /\.(png|jpe?g|webp)$/i);
    const videoCo = coSo(this.thuMuc('video', goc), /\.(mp4|mov|webm|m4v)$/i);
    const nhacCo = coSo(this.thuMuc('nhac', goc), /\.(mp3|wav|m4a)$/i);
    const thumbCo = coSo(this.thuMuc('thumbnail', goc), /\.(png|jpe?g|webp)$/i);
    const amCo = coSo(timThuMucCon(goc, ['audio', 'audios', 'tts']), /\.(mp3|wav|m4a)$/i);
    const loiDoc = (k, e) => { kq.muc[k] = { ...(kq.muc[k] || {}), loiDoc: e.message }; };
    // motion / footage: số cảnh trong file
    let soMotion = [], soFootage = [];
    if (tepCua('motion')) { try { soMotion = docFileMotion(tepCua('motion').tep).ds.map((x) => x.so); } catch (e) { loiDoc('motion', e); } }
    if (tepCua('footage')) { try { soFootage = docFileFootage(tepCua('footage').tep).ds.map((x) => x.so); } catch (e) { loiDoc('footage', e); } }
    const boVideo = new Set([...(d.muc.motion.bat ? soMotion : []), ...(d.muc.footage.bat ? soFootage : [])]);
    const dem = (k, tong, co) => {
      const xong = tong.filter((s) => co.has(s));
      kq.muc[k] = { ...(kq.muc[k] || {}), tong: tong.length, xong: xong.length, thieu: tong.filter((s) => !co.has(s)) };
    };
    let promptAnh = [];
    for (const k of ['anh', 'video', 'nhac', 'thumbnail']) {
      const t = tepCua(k);
      if (!t) { kq.muc[k] = { tong: 0, xong: 0, thieu: [] }; continue; }
      let ds = [];
      try { ds = docPrompt(k, t.tep); } catch (e) { loiDoc(k, e); }
      if (k === 'anh') promptAnh = ds;
      const so = ds.map((x, i) => (x ? i + 1 : 0)).filter(Boolean);
      if (k === 'anh') dem(k, so, anhCo);
      else if (k === 'nhac') dem(k, so, nhacCo);
      else if (k === 'thumbnail') dem(k, so, thumbCo);
      else dem(k, so.filter((s) => !boVideo.has(s)), videoCo);
      kq.muc[k].soPrompt = ds.filter(Boolean).length;
    }
    if (kq.muc.video.tong && promptAnh.length && kq.muc.video.soPrompt !== promptAnh.length) {
      kq.muc.video.canhBao = `File prompt video có ${kq.muc.video.soPrompt} dòng, file prompt ảnh có ${promptAnh.length} prompt — dòng N vẫn ghép với ảnh N`;
    }
    if (kq.muc.video.tong) kq.muc.video.boCanh = [...boVideo].sort((a, b) => a - b);
    const m = this.o.motion, f = this.o.footage;
    const coMotion = tepCua('motion') && m && m.ds && m.ds.tep === tepCua('motion').tep;
    kq.muc.motion = { ...(kq.muc.motion || {}), tong: soMotion.length,
      xong: coMotion ? m.ds.canh.filter((x) => x.trangThai === 'xong').length : soMotion.filter((s) => (videoCo.get(s) || []).some((p) => path.basename(p).startsWith(String(s).padStart(4, '0')))).length,
      loi: coMotion ? m.ds.canh.filter((x) => x.trangThai === 'loi').length : 0,
      choAnh: soMotion.filter((s) => !anhCo.has(s)).length, dangChay: !!(m && m.dangChay) };
    const coFootage = tepCua('footage') && f && f.ds && f.ds.tep === tepCua('footage').tep;
    kq.muc.footage = { ...(kq.muc.footage || {}), tong: soFootage.length,
      xong: coFootage ? f.ds.canh.filter((x) => x.trangThai === 'xong').length : soFootage.filter((s) => videoCo.has(s)).length,
      loi: coFootage ? f.ds.canh.filter((x) => x.trangThai === 'loi').length : 0, dangChay: !!(f && f.dangChay) };
    kq.phu = { amThanh: amCo.size, soMotion, soFootage };
    this.nho = { luc: n, goc, kq };
    return kq;
  }

  // ── Chạy ─────────────────────────────────────────────────────────────────
  /** Việc hàng đợi của mọi mục — MỘT lần duyệt (hàng đợi có thể vài nghìn việc, trạng thái gửi giao diện nhiều lần mỗi giây). */
  _viecMoiMuc() {
    const goc = this.duLieu.goc;
    const lk = this.duLieu.lienKet[goc] || {};
    const ra = {};
    for (const k of THU_TU) if (MUC[k].hang) ra[k] = [];
    if (!lk.duAn && !lk.duAnThumb) return ra;
    for (const j of this.dp.viec) {
      if (j.duAn === lk.duAn) { if (j.loai === 'anh') ra.anh.push(j); else if (j.loai === 'video') ra.video.push(j); else if (j.loai === 'nhac') ra.nhac.push(j); }
      else if (lk.duAnThumb && j.duAn === lk.duAnThumb && j.loai === 'anh') ra.thumbnail.push(j);
    }
    return ra;
  }

  /** Việc trong hàng đợi của một mục (dự án gắn + loại). */
  _viecMuc(k) {
    const goc = this.duLieu.goc;
    const lk = this.duLieu.lienKet[goc] || {};
    const id = MUC[k].phu ? lk.duAnThumb : lk.duAn;
    if (!id) return [];
    return this.dp.viec.filter((j) => j.duAn === id && j.loai === MUC[k].loai);
  }

  chayTatCa(nguon) {
    const d = this.duLieu;
    if (!d.goc) return { ok: false, loi: 'Chưa chọn thư mục dự án tổng' };
    if (!fs.existsSync(d.goc)) return { ok: false, loi: `Không thấy thư mục ${d.goc}` };
    if (this.dangChay) return { ok: true, dangChay: true };
    const bat = THU_TU.filter((k) => d.muc[k].bat);
    if (!bat.length) return { ok: false, loi: 'Chưa bật mục nào' };
    this.lienKetDuAn(d.goc, true);
    this.nho = null;
    const kq = this.quet(0);
    const dang = { batDau: this.bayGio(), nguon: nguon || 'tay', muc: {} };
    for (const k of THU_TU) dang.muc[k] = { batDau: 0, ketThuc: 0, coTruoc: (kq.muc[k] || {}).xong || 0, loi: '' };
    this.luu({ dang });
    this.log('success', `🧭 Dashboard: chạy tất cả "${path.basename(d.goc)}" — ${bat.map((k) => MUC[k].ten).join(', ')}${nguon === 'hen' ? ' (theo hẹn giờ)' : ''}`);
    // mục đang TẮT mà dự án còn việc chờ của loại đó (thêm tay trước đây) → Đã dừng, kẻo chạy theo dự án; bật mục là chạy tiếp
    for (const k of THU_TU) if (MUC[k].hang && !d.muc[k].bat) this._dungMuc(k, false);
    for (const k of bat) this._batDauMuc(k);
    this.tick(true);
    return { ok: true };
  }

  _ghiMuc(k, thay) {
    const d = this.duLieu;
    if (!d.dang) return;
    const dang = { ...d.dang, muc: { ...d.dang.muc, [k]: { ...d.dang.muc[k], ...thay } } };
    this.luu({ dang });
  }

  /** Bắt đầu (hoặc tiếp) một mục trong lượt đang chạy. */
  _batDauMuc(k) {
    const d = this.duLieu;
    const goc = d.goc;
    const kq = this.quet(0);
    const t = kq.tep[k] && kq.tep[k].chon;
    const coi = (loi) => { this._ghiMuc(k, { loi, ketThuc: this.bayGio() }); this.log('warning', `🧭 ${MUC[k].ten}: ${loi}`); };
    this._ghiMuc(k, { batDau: (d.dang && d.dang.muc[k] && d.dang.muc[k].batDau) || this.bayGio(), ketThuc: 0, loi: '' });
    const lk = this.lienKetDuAn(goc, true);
    try {
      if (k === 'anh' || k === 'video') {
        // Ảnh + video đi chung một lần thêm việc: ảnh thiếu → tạo ảnh (rồi video từ ảnh nếu bật); ảnh có mà video thiếu → chỉ video.
        const ma = d.muc.anh, mv = d.muc.video;
        const tAnh = kq.tep.anh.chon, tVid = kq.tep.video.chon;
        if (!tAnh) return coi('không thấy file prompt ảnh (" - prompt anh.txt") — video từ ảnh cũng cần file này để biết số cảnh');
        if (k === 'video' && !tVid) return coi('không thấy file prompt video (" - prompt animation.txt")');
        const lamVideo = mv.bat && !!tVid;
        const cv = lamVideo ? { prompts: docPrompt('video', tVid), nen: mv.nen, tyLe: '', boSo: kq.muc.video.boCanh || [] } : null;
        // ảnh còn trong hàng đợi (thêm lúc mục video đang tắt / bật) nối video theo công tắc hiện tại
        this.dp.ganChuoiVideo(lk.duAn, cv);
        if (!ma.bat && !lamVideo) return;
        const p = { duAn: lk.duAn, loai: 'anh', nen: ma.nen, tyLe: ma.tyLe, prompts: docPrompt('anh', tAnh), boQuaDaCo: true, chiTuAnhCo: !ma.bat };
        if (cv) p.chuoiVideo = cv;
        const r = this.dp.them(p);
        if (!r.ok && !/không còn số nào cần làm|không có ảnh nào/i.test(r.loi || '')) return coi(r.loi);
        this._tiep(k === 'anh' ? ['anh'] : ['video']);
        if (k === 'anh' && lamVideo) this._ghiMuc('video', { batDau: this.duLieu.dang.muc.video.batDau || this.bayGio() });
        this.dp.chayDuAn(lk.duAn, true);
      } else if (k === 'nhac') {
        if (!t) return coi('không thấy file prompt nhạc (" - nhac flowmusic.txt")');
        const r = this.dp.them({ duAn: lk.duAn, loai: 'nhac', prompts: docPrompt('nhac', t), boQuaDaCo: true });
        if (!r.ok && !/không còn số nào cần làm/i.test(r.loi || '')) return coi(r.loi);
        this._tiep(['nhac']);
        this.dp.chayDuAn(lk.duAn, true);
      } else if (k === 'thumbnail') {
        if (!t) return coi('không thấy file thumbnail (" - thumbnail.txt")');
        const id = this._duAnThumb(goc);
        const m = d.muc.thumbnail;
        const r = this.dp.them({ duAn: id, loai: 'anh', nen: m.nen, tyLe: m.tyLe, prompts: docPrompt('thumbnail', t), boQuaDaCo: true });
        if (!r.ok && !/không còn số nào cần làm/i.test(r.loi || '')) return coi(r.loi);
        this._tiep(['thumbnail']);
        this.dp.chayDuAn(id, true);
      } else if (k === 'footage') {
        const f = this.o.footage;
        if (!t) return coi('không thấy file "_footage.xlsx"');
        if (f.tay && f.tay.bat) return coi('đang Tải tay ở trang Footage — đóng Tải tay rồi bật lại mục này');
        if (!f.ds || f.ds.tep !== t) {
          if (f.dangChay) return coi('trang Footage đang tải danh sách khác — bấm Dừng ở đó rồi bật lại');
          const r = f.napTep(t, lk.duAn);
          if (!r.ok) return coi(r.loi);
        }
        if (path.resolve(f.ds.thuMuc || '') !== path.resolve(this.thuMuc('footage', goc))) f.datThuMuc(this.thuMuc('footage', goc));
        const loi = f.loiTruocChay();
        if (loi) return coi(loi);
        if (!f.dangChay) f.chay().catch((e) => this.log('error', `🧭 Footage: ${e.message}`));
      } else if (k === 'motion') {
        const m = this.o.motion;
        if (!t) return coi('không thấy file "_motion.xlsx"');
        if (!m.ds || m.ds.tep !== t) {
          if (m.dangChay) return coi('trang Motion đang vẽ danh sách khác — bấm Dừng ở đó rồi bật lại');
          const r = m.napTep(t, lk.duAn);
          if (!r.ok) return coi(r.loi);
        }
        if (path.resolve(m.ds.goc) !== path.resolve(goc)) m.datGoc(goc);
        if (m.ds.thuMucVideo && path.resolve(m.ds.thuMucVideo) !== path.resolve(this.thuMuc('motion', goc))) m.datThuMucVideo('');
        this.lanMotion = 0;   // tick() vẽ ngay những cảnh đã có ảnh
      }
    } catch (e) {
      coi(e.message);
    }
  }

  /** Việc "Đã dừng" của mục (do tắt công tắc lúc trước) → chạy tiếp. */
  _tiep(ks) {
    const ids = ks.flatMap((k) => this._viecMuc(k).filter((j) => j.trangThai === 'dung').map((j) => j.id));
    if (ids.length) this.dp.tiepViec(ids);
  }


  _dungMuc(k, tay) {
    if (MUC[k].hang) {
      const ids = this._viecMuc(k).filter((j) => TRONG.has(j.trangThai)).map((j) => j.id);
      if (ids.length) this.dp.dungViec(ids);
      // tắt video giữa lượt: ảnh chưa xong thôi tự nối video
      if (k === 'video') { const lk = this.duLieu.lienKet[this.duLieu.goc] || {}; if (lk.duAn) this.dp.ganChuoiVideo(lk.duAn, null); }
    } else if (k === 'motion' && this.o.motion.dangChay) this.o.motion.dungLai();
    else if (k === 'footage' && this.o.footage.dangChay) this.o.footage.dungLai();
    if (tay) { this._ghiMuc(k, { ketThuc: this.bayGio() }); this.log('info', `🧭 Tắt mục ${MUC[k].ten}`); }
  }

  dungTatCa() {
    const d = this.duLieu;
    if (!d.dang) return { ok: false, loi: 'Không có gì đang chạy' };
    const lk = d.lienKet[d.goc] || {};
    for (const id of [lk.duAn, lk.duAnThumb]) if (id && this.dp.duAnChay.has(id)) this.dp.dungDuAn(id);
    if (this.o.motion.dangChay) this.o.motion.dungLai();
    if (this.o.footage.dangChay) this.o.footage.dungLai();
    this._ketLuot('dung');
    return { ok: true };
  }

  // ── Hẹn giờ Chạy tất cả ──────────────────────────────────────────────────
  /** Lưu một hẹn (h.id sửa, không có id = thêm). Hẹn gắn với dự án tổng (h.goc, mặc định dự án tổng đang mở). */
  datHen(h) {
    h = { ...(h || {}) };
    if (h.batDau && !HG.chuanGio(h.batDau)) return { ok: false, loi: `Giờ bắt đầu "${h.batDau}" không hợp lệ (vd 22:00)` };
    if (h.ketThuc && !HG.chuanGio(h.ketThuc)) return { ok: false, loi: `Giờ dừng "${h.ketThuc}" không hợp lệ (vd 06:00, để trống = chạy tới hết)` };
    const d = this.duLieu;
    const cu = h.id ? d.hen.find((x) => x.id === h.id) : null;
    if (h.id && !cu) return { ok: false, loi: 'Không tìm thấy hẹn giờ này (có thể đã bị xoá)' };
    const goc = String(h.goc || (cu && cu.goc) || d.goc || '');
    if (!goc) return { ok: false, loi: 'Chọn dự án tổng trước khi hẹn giờ' };
    let id = cu ? cu.id : '';
    if (!id) { let n = 1; while (d.hen.some((x) => x.id === `dash-${n}`)) n++; id = `dash-${n}`; }
    const c = HG.chuanHen({ ...(cu || {}), ...h, loai: 'anh', id });
    const m = { id, bat: c.bat, batDau: c.batDau, ketThuc: c.ketThuc, lap: c.lap, goc, datLuc: this.bayGio(), daChay: c.daChay };
    if (!cu || m.batDau !== cu.batDau || (m.bat && !cu.bat)) m.daChay = '';
    const hen = cu ? d.hen.map((x) => (x === cu ? m : x)) : [...d.hen, m];
    const thay = { hen };
    if (d.henDang && d.henDang.id === id && cu && m.ketThuc !== cu.ketThuc) thay.henDang = { ...d.henDang, den: m.ketThuc ? HG.gioToiSau(m.ketThuc, this.bayGio()) : 0 };
    this.luu(thay);
    if (m.bat) this.log('info', `⏰ Hẹn giờ Chạy tất cả "${path.basename(goc)}": bắt đầu ${m.batDau}${m.ketThuc ? `, dừng ${m.ketThuc}` : ', chạy tới hết'}, ${m.lap === 'mot' ? 'một lần' : 'mỗi ngày'}.`);
    this.xetHen();
    return { ok: true, hen: m };
  }

  xoaHen(id) {
    const d = this.duLieu;
    if (!d.hen.some((x) => x.id === id)) return { ok: false, loi: 'Không tìm thấy hẹn giờ này' };
    const thay = { hen: d.hen.filter((x) => x.id !== id) };
    if (d.henDang && d.henDang.id === id) thay.henDang = null;   // lượt đang chạy vẫn chạy tiếp tới hết (tắt Chạy tất cả để dừng)
    this.luu(thay);
    return { ok: true };
  }

  /** Mỗi nhịp: tới giờ bắt đầu → Chạy tất cả dự án tổng của hẹn; tới giờ dừng → dừng lượt đó. */
  xetHen() {
    const d = this.duLieu;
    const n = this.bayGio();
    if (d.henDang && d.henDang.den && n >= d.henDang.den) {
      this.luu({ henDang: null });
      if (d.dang && d.dang.nguon === 'hen') {
        this.log('warning', `⏰ Hết giờ hẹn Chạy tất cả (${HG.gioPhut(d.henDang.den)}) — dừng các mục, việc dở về hàng chờ.`);
        this.dungTatCa();
      }
    }
    let doi = false;
    const hen = d.hen.map((h) => {
      const r = HG.denGioChay(h, n);
      if (!r) return h;
      doi = true;
      const m = { ...h, daChay: r.khoa, bat: h.lap === 'mot' ? false : h.bat };
      setImmediate(() => this._batDauHen(m, r));
      return m;
    });
    if (doi) this.luu({ hen });
  }

  _batDauHen(h, r) {
    const ten = path.basename(h.goc);
    if (this.dangChay) {
      if (this.duLieu.goc === h.goc) { this.luu({ henDang: { id: h.id, den: r.den } }); this.log('info', `⏰ Đến giờ hẹn ${h.batDau}: "${ten}" đang chạy sẵn${r.den ? ` — sẽ dừng lúc ${HG.gioPhut(r.den)}` : ''}.`); }
      else this.log('warning', `⏰ Đến giờ hẹn ${h.batDau} của "${ten}" nhưng dự án tổng "${path.basename(this.duLieu.goc)}" đang chạy — bỏ qua lần này.`);
      return;
    }
    if (!fs.existsSync(h.goc)) { this.log('error', `⏰ Hẹn giờ ${h.batDau}: không thấy thư mục "${h.goc}" — bỏ qua.`); return; }
    if (this.duLieu.goc !== h.goc) { const c = this.chonGoc(h.goc); if (!c.ok) { this.log('error', `⏰ Hẹn giờ ${h.batDau}: ${c.loi}`); return; } }
    const kq = this.chayTatCa('hen');
    if (!kq.ok) { this.log('error', `⏰ Hẹn giờ ${h.batDau} "${ten}": ${kq.loi}`); return; }
    this.luu({ henDang: { id: h.id, den: r.den } });
    this.log('success', `⏰ Đến giờ hẹn ${h.batDau}: Chạy tất cả "${ten}"${r.den ? `, dừng lúc ${HG.gioPhut(r.den)}` : ', chạy tới hết'}.`);
  }

  /** Mục còn việc chạy / chờ? */
  _dangChayMuc(k, v) {
    if (MUC[k].hang) return (v || this._viecMuc(k)).some((j) => TRONG.has(j.trangThai));
    if (k === 'motion') return !!this.o.motion.dangChay || this._motionCanVe().length > 0;
    if (k === 'footage') return !!this.o.footage.dangChay;
    return false;
  }

  /** Cảnh motion còn phải vẽ ngay: đã có ảnh; mục Tạo ảnh không còn việc thì vẽ cả cảnh chưa có ảnh (nền tối). */
  _motionCanVe() {
    const m = this.o.motion;
    const t = this.quet() && this.quet().tep.motion.chon;
    if (!m.ds || m.ds.tep !== t) return [];
    const anhDangLam = this.duLieu.muc.anh.bat && this._viecMuc('anh').some((j) => TRONG.has(j.trangThai));
    return m.ds.canh.filter((x) => x.trangThai === 'cho' && (x.anh || !anhDangLam)).map((x) => x.so);
  }

  /** Nhịp điều phối (main gọi mỗi vài giây): vẽ motion khi ảnh về, đóng lượt khi mọi mục xong. */
  tick(ngay) {
    if (!ngay) this.xetHen();
    const d = this.duLieu;
    if (!d.dang) return;
    const n = this.bayGio();
    // motion: quét ảnh mỗi 15 s, vẽ những cảnh đã có ảnh
    if (d.muc.motion.bat && this.o.motion.ds && !this.o.motion.dangChay && (ngay || n - this.lanMotion > 15000)) {
      this.lanMotion = n;
      try { this.o.motion.quet(); } catch (_) {}
      const ve = this._motionCanVe();
      if (ve.length) this.o.motion.chay(ve).catch((e) => this.log('error', `🧭 Motion: ${e.message}`));
    }
    // ghi giờ bắt đầu / kết thúc từng mục
    let conChay = false;
    for (const k of THU_TU) {
      if (!d.muc[k].bat) continue;
      const mm = d.dang.muc[k];
      const dang = this._dangChayMuc(k);
      if (dang) conChay = true;
      if (dang && mm.ketThuc) this._ghiMuc(k, { ketThuc: 0 });
      else if (!dang && mm.batDau && !mm.ketThuc) this._ghiMuc(k, { ketThuc: n });
    }
    if (!conChay && !ngay && n - d.dang.batDau > 3000) this._ketLuot('xong');
  }

  _ketLuot(ketQua, imLang) {
    const d = this.duLieu;
    if (!d.dang) return;
    const n = this.bayGio();
    this.nho = null;
    let kq = null;
    try { kq = d.goc ? this.quet(0) : null; } catch (_) {}
    const muc = {};
    for (const k of THU_TU) {
      const mm = d.dang.muc[k];
      if (!d.muc[k].bat && !mm.batDau) continue;
      const s = (kq && kq.muc[k]) || {};
      const loi = MUC[k].hang ? this._viecMuc(k).filter((j) => j.trangThai === 'loi' && (j.xongLuc || j.batDauLuc || 0) >= d.dang.batDau).length : (s.loi || 0);
      muc[k] = { giay: mm.batDau ? Math.round(((mm.ketThuc || n) - mm.batDau) / 1000) : 0, xongThem: Math.max(0, (s.xong || 0) - (mm.coTruoc || 0)),
        xong: s.xong || 0, tong: s.tong || 0, loi, ghiChu: mm.loi || '' };
    }
    const luot = { batDau: d.dang.batDau, ketThuc: n, giay: Math.round((n - d.dang.batDau) / 1000), ketQua, goc: d.goc, nguon: d.dang.nguon || 'tay', muc,
      loi: Object.values(muc).reduce((s2, x) => s2 + x.loi, 0) };
    this.luu({ dang: null, henDang: null, luot: [luot, ...d.luot].slice(0, LUOT_GIU) });
    if (!imLang) {
      const loi = Object.values(muc).reduce((s, x) => s + x.loi, 0);
      this.log(loi ? 'warning' : 'success', `🧭 Dashboard: ${ketQua === 'xong' ? 'xong lượt' : 'đã dừng'} "${path.basename(d.goc)}" sau ${giayDep(luot.giay)} — ` +
        Object.entries(muc).map(([k, x]) => `${MUC[k].ten} ${x.xong}/${x.tong}${x.loi ? ` (${x.loi} lỗi)` : ''}`).join(' · '));
    }
  }

  /** Thống kê cho giao diện. */
  trangThai() {
    const d = this.duLieu;
    let kq = null;
    try { kq = d.goc ? this.quet() : null; } catch (e) { kq = { loi: e.message }; }
    const lk = (d.goc && d.lienKet[d.goc]) || {};
    const muc = {};
    const n = this.bayGio();
    const vm = this._viecMoiMuc();
    for (const k of THU_TU) {
      const s = (kq && kq.muc && kq.muc[k]) || {};
      const v = MUC[k].hang ? vm[k] : [];
      const dem = (t) => v.filter((j) => j.trangThai === t).length;
      const mm = d.dang && d.dang.muc[k];
      const loiHang = v.filter((j) => j.trangThai === 'loi');
      muc[k] = { ...d.muc[k], ten: MUC[k].ten, tong: s.tong || 0, xong: s.xong || 0, thieu: s.thieu ? gopSo(s.thieu) : '', soThieu: (s.thieu || []).length,
        loiDoc: s.loiDoc || '', canhBao: s.canhBao || '', boCanh: s.boCanh ? gopSo(s.boCanh) : '', soBoCanh: (s.boCanh || []).length, choAnh: s.choAnh || 0,
        cho: MUC[k].hang ? dem('cho') : 0, chay: MUC[k].hang ? dem('chay') : (s.dangChay ? 1 : 0), dung: MUC[k].hang ? dem('dung') : 0,
        loi: MUC[k].hang ? loiHang.length : (s.loi || 0), loiCuoi: MUC[k].hang ? (loiHang.sort((a, b) => (b.xongLuc || 0) - (a.xongLuc || 0))[0] || {}).loi || '' : '',
        dangChay: !!d.dang && this._dangChayMuc(k, MUC[k].hang ? v : null), giay: mm && mm.batDau ? Math.round(((mm.ketThuc || n) - mm.batDau) / 1000) : 0,
        xongMuc: !!(mm && mm.ketThuc && mm.batDau), ghiChu: (mm && mm.loi) || '' };
    }
    const hen = d.hen.map((h) => ({ ...h, ten: path.basename(h.goc), lanToi: HG.lanChayToi(h, n), dang: !!(d.henDang && d.henDang.id === h.id) }));
    return { goc: d.goc, dsGoc: d.dsGoc.map((x) => ({ goc: x.goc, ten: path.basename(x.goc), con: fs.existsSync(x.goc) })), hen, henDang: d.henDang,
      thuMuc: d.goc ? { anh: this.thuMuc('anh'), video: this.thuMuc('video'), nhac: this.thuMuc('nhac'), thumbnail: this.thuMuc('thumbnail') } : null,
      duAn: lk.duAn || '', tenDuAn: lk.duAn ? this._tenDuAn(lk.duAn) : '', duAnThumb: lk.duAnThumb || '',
      tep: kq && kq.tep, phu: kq && kq.phu, muc, dang: d.dang && { batDau: d.dang.batDau, nguon: d.dang.nguon || 'tay', giay: Math.round((n - d.dang.batDau) / 1000) },
      luot: d.luot.slice(0, 10), thuTu: THU_TU, loiQuet: kq && kq.loi };
  }
}

function giayDep(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), g = s % 60;
  return h ? `${h} giờ ${m} phút` : m ? `${m} phút ${g} giây` : `${g} giây`;
}

module.exports = { QuanLyDashboard, MUC, THU_TU, DASH_MAC_DINH, timTepDauVao, docPrompt, giayDep };
