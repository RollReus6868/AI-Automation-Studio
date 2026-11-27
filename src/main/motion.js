'use strict';
// ============================================================================
//  motion.js — 1.7.0: tạo video MOTION GRAPHIC cho các cảnh của kịch bản bằng Remotion.
//
//  Đầu vào: file <tên>_motion.xlsx do skill chia cảnh xuất (sheet MOTION; cột scene, mau, nhan, tieu_de,
//  noi_dung, phu, goc, giay, ghi_chu). Mỗi dòng = một cảnh dựng bằng một mẫu: bản đồ hành trình, dòng thời gian,
//  câu Kinh Thánh toàn màn hình, cây phả hệ, so sánh. Nền là ảnh AI của chính cảnh (images/<số>.png), độ dài theo
//  giọng đọc của cảnh (Audio/<số>.mp3) + một đoạn đệm, ra <thư mục Videos>/<số cảnh>.mp4 (H.264, không trong suốt —
//  CapCut Draft Studio đọc Videos/<số>.mp4 thay cho ảnh của cảnh đó, CapCut chạy nhẹ).
//
//  Phần ở đây thuần (không Electron) để kiểm bằng node: đọc file, ghép ảnh / âm thanh, dựng việc, theo dõi tiến độ.
//  Vẽ khung hình chạy ở tiến trình con motion-tien-trinh.js (@remotion/renderer + Chrome / Edge).
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fork } = require('child_process');
const { docXlsx, docCsv } = require('./doc-xlsx');
const { docDiaDanh } = require('./motion-dia-danh');

const MAU = {
  BAN_DO: { comp: 'BanDo', ten: 'Bản đồ hành trình', giay: 12, bd: ['ban_do', 'bando', 'ban do', 'bản đồ', 'map', 'mapa', 'journey', 'hanh_trinh', 'hành trình'] },
  DONG_THOI_GIAN: { comp: 'DongThoiGian', ten: 'Dòng thời gian', giay: 12, bd: ['dong_thoi_gian', 'dòng thời gian', 'timeline', 'linea_tiempo', 'línea de tiempo', 'linea de tiempo'] },
  CAU_KINH: { comp: 'CauKinh', ten: 'Câu Kinh Thánh', giay: 10, bd: ['cau_kinh', 'cau_kinh_thanh', 'câu kinh thánh', 'câu kinh', 'verse', 'versiculo', 'versículo', 'scripture'] },
  PHA_HE: { comp: 'PhaHe', ten: 'Cây phả hệ', giay: 12, bd: ['pha_he', 'phả hệ', 'cây phả hệ', 'tree', 'family_tree', 'family tree', 'genealogia', 'genealogía', 'arbol'] },
  SO_SANH: { comp: 'SoSanh', ten: 'So sánh', giay: 12, bd: ['so_sanh', 'so sánh', 'compare', 'comparison', 'vs', 'comparacion', 'comparación'] }
};
const MOTION_MAC_DINH = { fps: 30, rong: 1920, mau: '#C9A45C', duoi: 1.0, thayVideoCu: true, trinhDuyet: '' };
const DUOI_ANH = /\.(png|jpe?g|webp)$/i;
const DUOI_AM = /\.(mp3|wav|m4a|aac)$/i;
const DUOI_VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const THU_MUC = { anh: ['images', 'image', 'imgs', 'anh', 'ảnh', 'hinh', 'pictures'], am: ['audio', 'audios', 'am-thanh', 'voice', 'giong-doc', 'tts'], video: ['videos', 'video'] };
const GIAY_MIN = 3, GIAY_MAX = 180;

// ── Đọc file ───────────────────────────────────────────────────────────────
const BI_DANH = {
  canh: ['scene', 'canh', 'cảnh', 'so', 'số'],
  mau: ['mau', 'mẫu', 'template', 'loai', 'loại', 'type'],
  nhan: ['nhan', 'nhãn', 'label'],
  tieuDe: ['tieu_de', 'tiêu đề', 'tieu de', 'title'],
  noiDung: ['noi_dung', 'nội dung', 'noi dung', 'data', 'content', 'text'],
  phu: ['phu', 'phụ', 'sub', 'tham_chieu', 'tham chiếu', 'reference', 'ref'],
  goc: ['goc', 'gốc', 'nguyen_ngu', 'nguyên ngữ', 'original', 'orig'],
  giay: ['giay', 'giây', 'seconds', 'sec', 'duration', 'dur'],
  ghiChu: ['ghi_chu', 'ghi chú', 'note', 'notes']
};
const chuanTen = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tachMuc = (s) => String(s || '').split(/[;\n\r]+/).map((x) => x.trim()).filter(Boolean);
const boSao = (s) => String(s || '').replace(/\*/g, '').trim();

function chuanMau(s) {
  const k = chuanTen(s).replace(/-/g, '_');
  for (const [ma, m] of Object.entries(MAU)) if (k === ma.toLowerCase() || m.bd.includes(k) || m.bd.includes(k.replace(/_/g, ' '))) return ma;
  return null;
}

/** Nội dung của một dòng → props của mẫu, hoặc { loi }. */
function propsMau(ma, o) {
  const nd = o.noiDung;
  if (ma === 'BAN_DO') {
    const tuyen = /[>→]/.test(nd);
    const muc = nd.split(/\s*(?:>|→|;|\n|\r)+\s*/).map((x) => x.trim()).filter(Boolean);
    if (!muc.length) return { loi: 'chưa có địa danh (vd "Ur > Harán > Canaán")' };
    const diem = [];
    for (const m of muc) {
      const d = docDiaDanh(m);
      if (d.loi) return { loi: d.loi };
      diem.push(d);
    }
    return { props: { diem, tuyen: tuyen && diem.length > 1, nhan: o.nhan, tieuDe: o.tieuDe, chuThich: o.phu } };
  }
  if (ma === 'DONG_THOI_GIAN') {
    const suKien = tachMuc(nd).map((m) => {
      const hienTai = /^\*|\*$/.test(m.trim());
      const s = boSao(m);
      const t = /^(.*?)\s*(?:\||—|–|:\s)\s*(.+)$/.exec(s);
      return t ? { nam: t[1].trim(), ten: t[2].trim(), hienTai } : { nam: '', ten: s, hienTai };
    }).filter((x) => x.nam || x.ten);
    if (suKien.length < 2) return { loi: 'dòng thời gian cần ít nhất 2 mốc "năm | sự kiện", cách nhau bằng ;' };
    if (suKien.length > 12) return { loi: `dòng thời gian ${suKien.length} mốc — tối đa 12` };
    return { props: { suKien, nhan: o.nhan, tieuDe: o.tieuDe, chuThich: o.phu } };
  }
  if (ma === 'CAU_KINH') {
    const cau = nd.replace(/^["“”«»]+|["“”«»]+$/g, '').trim();
    if (!cau) return { loi: 'chưa có câu Kinh Thánh' };
    if (cau.length > 420) return { loi: `câu dài ${cau.length} ký tự — tối đa 420 (cắt bớt hoặc tách 2 cảnh)` };
    return { props: { cau, tham: o.phu, goc: o.goc, nhan: o.nhan } };
  }
  if (ma === 'PHA_HE') {
    const nut = [];
    const theoTen = new Map();
    const lay = (chu) => {
      const ten = boSao(chu);
      if (!ten) return null;
      const k = ten.toLowerCase();
      if (!theoTen.has(k)) { const x = { id: 'n' + nut.length, ten, cha: null, nhan: false }; nut.push(x); theoTen.set(k, x); }
      const x = theoTen.get(k);
      if (/\*/.test(chu)) x.nhan = true;
      return x;
    };
    let coNhanh = false;
    for (const m of tachMuc(nd)) {
      const p = m.split(/\s*(?:>|→)\s*/);
      if (p.length < 2) { lay(p[0]); continue; }
      for (let i = 0; i + 1 < p.length; i++) {
        const cha = lay(p[i].split(',').pop());
        for (const c of p[i + 1].split(',')) {
          const x = lay(c);
          if (x && cha && x !== cha && x.cha == null) { x.cha = cha.id; coNhanh = true; }
        }
      }
    }
    if (!coNhanh) return { loi: 'phả hệ cần dạng "Cha > Con1, Con2; Con1 > Cháu"' };
    if (nut.length > 24) return { loi: `phả hệ ${nut.length} tên — tối đa 24` };
    return { props: { nut, nhan: o.nhan, tieuDe: o.tieuDe } };
  }
  if (ma === 'SO_SANH') {
    const dong = tachMuc(nd).map((m) => m.split('|').map((x) => x.trim()));
    if (dong.length < 2 || dong.some((d) => d.length !== 2)) return { loi: 'so sánh cần dòng đầu "Tiêu đề trái | Tiêu đề phải" rồi các dòng "trái | phải", cách nhau bằng ;' };
    if (dong.length > 7) return { loi: `so sánh ${dong.length - 1} dòng — tối đa 6` };
    const [dau, ...con] = dong;
    return { props: { trai: { tieuDe: dau[0], dong: con.map((d) => d[0]) }, phai: { tieuDe: dau[1], dong: con.map((d) => d[1]) }, ketLuan: o.phu, nhan: o.nhan, tieuDe: o.tieuDe } };
  }
  return { loi: 'mẫu lạ' };
}

/** Hàng (dòng đầu là tiêu đề) → { ds, loi }. */
function docHangMotion(hang) {
  const loi = [];
  const dauIdx = hang.findIndex((h) => h && h.some((o) => String(o || '').trim()));
  if (dauIdx < 0) return { ds: [], loi: ['File trống'] };
  const dau = hang[dauIdx].map(chuanTen);
  const cot = {};
  for (const [k, ten] of Object.entries(BI_DANH)) cot[k] = dau.findIndex((d) => ten.includes(d));
  if (cot.canh < 0) return { ds: [], loi: ['Thiếu cột "scene" (số cảnh) ở dòng tiêu đề'] };
  if (cot.mau < 0) return { ds: [], loi: ['Thiếu cột "mau" (mẫu: BAN_DO, DONG_THOI_GIAN, CAU_KINH, PHA_HE, SO_SANH) ở dòng tiêu đề'] };
  if (cot.noiDung < 0) return { ds: [], loi: ['Thiếu cột "noi_dung" ở dòng tiêu đề'] };
  const ds = [];
  const daCo = new Set();
  for (let i = dauIdx + 1; i < hang.length; i++) {
    const h = hang[i] || [];
    if (!h.some((x) => String(x || '').trim())) continue;
    const o = {};
    for (const k of Object.keys(BI_DANH)) o[k] = cot[k] >= 0 ? String(h[cot[k]] == null ? '' : h[cot[k]]).trim() : '';
    const goc = o.canh.replace(/\.0+$/, '');
    if (!/^\d+$/.test(goc)) { loi.push(`Dòng ${i + 1}: số cảnh "${goc}" không phải số`); continue; }
    const so = parseInt(goc, 10);
    if (daCo.has(so)) { loi.push(`Dòng ${i + 1}: cảnh ${so} lặp lại — bỏ dòng này`); continue; }
    const ma = chuanMau(o.mau);
    if (!ma) { loi.push(`Dòng ${i + 1}: cảnh ${so} mẫu "${o.mau}" không có (BAN_DO, DONG_THOI_GIAN, CAU_KINH, PHA_HE, SO_SANH)`); continue; }
    const r = propsMau(ma, o);
    if (r.loi) { loi.push(`Dòng ${i + 1}: cảnh ${so} (${MAU[ma].ten}): ${r.loi}`); continue; }
    daCo.add(so);
    const giay = Math.max(0, Math.min(GIAY_MAX, parseFloat(o.giay.replace(',', '.')) || 0));
    ds.push({ so, canh: String(so).padStart(4, '0'), mau: ma, props: r.props, giay, ghiChu: o.ghiChu });
  }
  ds.sort((a, b) => a.so - b.so);
  return { ds, loi };
}

function docFileMotion(tep) {
  const buf = fs.readFileSync(tep);
  const hang = /\.csv$/i.test(tep) ? docCsv(buf.toString('utf8')) : docXlsx(buf, { sheet: 'MOTION' }).hang;
  return docHangMotion(hang);
}
const tenDanhSach = (tep) => path.basename(String(tep || ''), path.extname(String(tep || ''))).replace(/[ _-]*motion$/i, '') || 'Motion';

// ── Độ dài âm thanh (không cần ffmpeg) ──────────────────────────────────────
const BR = {
  '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
};
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function dauKhung(buf, i) {
  if (i + 4 > buf.length || buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (buf[i + 1] >> 3) & 3, lop = (buf[i + 1] >> 1) & 3;
  const bri = buf[i + 2] >> 4, sri = (buf[i + 2] >> 2) & 3, pad = (buf[i + 2] >> 1) & 1, mono = (buf[i + 3] >> 6) === 3;
  if (ver === 1 || lop === 0 || bri === 0 || bri === 15 || sri === 3) return null;
  const layer = 4 - lop;
  const v1 = ver === 3;
  const br = BR[v1 ? `1-${layer}` : layer === 1 ? '2-1' : '2-2'][bri] * 1000;
  const sr = SR[ver][sri];
  const mau = layer === 1 ? 384 : layer === 3 && !v1 ? 576 : 1152;
  const dai = layer === 1 ? Math.floor((12 * br) / sr + pad) * 4 : Math.floor(((layer === 3 && !v1 ? 72 : 144) * br) / sr) + pad;
  return { v1, layer, sr, mau, dai, mono };
}
/** Số giây của MP3 (đọc Xing / Info / VBRI, không có thì đếm từng khung) hoặc WAV; không đọc được → 0. */
function thoiLuongAmThanh(buf) {
  if (!buf || buf.length < 64) return 0;
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    let p = 12, byteRate = 0;
    while (p + 8 <= buf.length) {
      const id = buf.toString('ascii', p, p + 4), sz = buf.readUInt32LE(p + 4);
      if (id === 'fmt ') byteRate = buf.readUInt32LE(p + 16);
      if (id === 'data') return byteRate ? Math.min(sz, buf.length - p - 8) / byteRate : 0;
      p += 8 + sz + (sz & 1);
    }
    return 0;
  }
  let i = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3') i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f)) + (buf[5] & 0x10 ? 10 : 0);
  // tìm khung đầu: phải có khung kế tiếp hợp lệ ngay sau (tránh khớp nhầm byte rác)
  let k = null;
  for (; i < Math.min(buf.length - 4, i + 200000); i++) {
    const h = dauKhung(buf, i);
    if (h && h.dai > 0 && (i + h.dai >= buf.length - 4 || dauKhung(buf, i + h.dai))) { k = h; break; }
  }
  if (!k) return 0;
  const lech = i + 4 + (k.v1 ? (k.mono ? 17 : 32) : (k.mono ? 9 : 17));
  const tag = buf.toString('ascii', lech, lech + 4);
  if ((tag === 'Xing' || tag === 'Info') && buf.readUInt32BE(lech + 4) & 1) {
    const soKhung = buf.readUInt32BE(lech + 8);
    if (soKhung > 0) return (soKhung * k.mau) / k.sr;
  }
  if (buf.toString('ascii', i + 36, i + 40) === 'VBRI') {
    const soKhung = buf.readUInt32BE(i + 36 + 14);
    if (soKhung > 0) return (soKhung * k.mau) / k.sr;
  }
  let mau = 0, sr = k.sr;
  while (i < buf.length - 4) {
    const h = dauKhung(buf, i);
    if (!h || h.dai <= 0) { i++; continue; }
    mau += h.mau; sr = h.sr; i += h.dai;
  }
  return mau / sr;
}

// ── Tìm file theo số cảnh ───────────────────────────────────────────────────
const soTuTen = (ten) => { const m = /^0*(\d+)$/.exec(path.basename(ten, path.extname(ten))); return m ? parseInt(m[1], 10) : null; };
function timThuMucCon(goc, ten) {
  try {
    const ds = fs.readdirSync(goc, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const t of ten) { const d = ds.find((x) => x.name.toLowerCase() === t); if (d) return path.join(goc, d.name); }
  } catch (_) {}
  return '';
}
/** Mọi file trong thư mục (không đệ quy) có tên = số cảnh, theo đuôi. */
function fileTheoSo(thuMuc, duoi) {
  const m = new Map();
  if (!thuMuc) return m;
  let ds = [];
  try { ds = fs.readdirSync(thuMuc, { withFileTypes: true }); } catch (_) { return m; }
  for (const d of ds) {
    if (!d.isFile() || !duoi.test(d.name)) continue;
    const so = soTuTen(d.name);
    if (so == null) continue;
    if (!m.has(so)) m.set(so, []);
    m.get(so).push(path.join(thuMuc, d.name));
  }
  for (const v of m.values()) v.sort();
  return m;
}
/** Thư mục gốc có Audio / images / Videos ngay bên trong? */
const laGocDuAn = (d) => !!(timThuMucCon(d, THU_MUC.anh) || timThuMucCon(d, THU_MUC.am) || timThuMucCon(d, THU_MUC.video));

/** Dấu vân của mẫu (src + public, bỏ \r) — so với bundle/nguon.json để biết đã đóng gói lại chưa. */
function dauNguonMotion(goc) {
  const h = crypto.createHash('sha1');
  const di = (d, tuongDoi) => {
    for (const ten of fs.readdirSync(d).sort()) {
      const p = path.join(d, ten), r = tuongDoi ? `${tuongDoi}/${ten}` : ten;
      if (fs.statSync(p).isDirectory()) { di(p, r); continue; }
      let b = fs.readFileSync(p);
      if (/\.(jsx?|json|txt|css)$/i.test(ten)) b = Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'));
      h.update(r + '\0').update(b).update('\0');
    }
  };
  for (const s of ['src', 'public']) di(path.join(goc, s), s);
  return h.digest('hex');
}

/**
 * Tiến trình con vẽ khung hình. opt: { tep (motion-tien-trinh.js), execPath, cwd, env, binariesDirectory, bundle }.
 * Trả { chay(spec, onSuKien) → Promise, dung() }.
 */
function taoTienTrinhCon(opt) {
  let con = null, xong = null;
  return {
    chay(spec, onSuKien) {
      return new Promise((resolve) => {
        try { fs.mkdirSync(opt.cwd, { recursive: true }); } catch (_) {}
        // package.json ở thư mục làm việc: Remotion tải Chrome Headless Shell vào <cwd>/node_modules/.remotion
        try { if (!fs.existsSync(path.join(opt.cwd, 'package.json'))) fs.writeFileSync(path.join(opt.cwd, 'package.json'), '{"name":"motion-engine","private":true}\n'); } catch (_) {}
        con = fork(opt.tep, [], { cwd: opt.cwd, execPath: opt.execPath || process.execPath, env: { ...process.env, ...(opt.env || {}) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        let ketThuc = false;
        const het = (ly) => { if (ketThuc) return; ketThuc = true; con = null; resolve(ly); };
        let loiCuoi = '';
        con.stderr.on('data', (d) => { loiCuoi = (loiCuoi + d.toString()).slice(-2000); });
        con.stdout.on('data', () => {});
        con.on('message', (e) => { try { onSuKien(e); } catch (_) {} if (e && e.event === 'finished') het('finished'); });
        con.on('exit', (code) => {
          if (!ketThuc) { try { onSuKien({ event: 'error', text: `Tiến trình vẽ dừng (mã ${code})${loiCuoi ? ': ' + loiCuoi.trim().split('\n').slice(-3).join(' | ') : ''}` }); } catch (_) {} }
          if (xong) xong();
          het('exit');
        });
        con.send({ lenh: 'chay', spec: { ...spec, bundle: opt.bundle, binariesDirectory: opt.binariesDirectory || null } });
      });
    },
    dung() {
      if (!con) return Promise.resolve();
      const c = con;
      return new Promise((r) => {
        xong = r;
        try { c.send({ lenh: 'dung' }); } catch (_) {}
        setTimeout(() => { try { c.kill(); } catch (_) {} }, 6000);
      });
    }
  };
}

class QuanLyMotion {
  /**
   * o: { store, log(muc, chu), bao(), thuMucDuAn(duAnId) → { thuMuc (Videos), ten }, taoTienTrinh() → { chay, dung } }
   */
  constructor(o) {
    this.o = o;
    this.store = o.store;
    this.log = o.log || (() => {});
    this.bao = o.bao || (() => {});
    this.dangChay = false;
    this.dung = false;
    this.luotXong = 0;
    this.tt = null;
    this.trinhDuyet = '';
    this.taiTrinhDuyet = null;
    this.nhoAm = new Map();   // đường dẫn|mtime|size → giây
    this.lanBao = 0;
    // mở lại app giữa lúc vẽ → cảnh đang vẽ quay về Chờ
    const d = this.ds;
    if (d && d.canh.some((x) => x.trangThai === 'dang')) { for (const x of d.canh) if (x.trangThai === 'dang') { x.trangThai = 'cho'; x.tienDo = 0; } this.store.set({ motionDs: d }); }
  }

  get caiDat() { return Object.assign({}, MOTION_MAC_DINH, this.store.data.motion || {}); }
  datCaiDat(m) {
    const c = this.caiDat;
    for (const k of Object.keys(MOTION_MAC_DINH)) if (k in (m || {})) c[k] = m[k];
    c.fps = [24, 25, 30, 50, 60].includes(+c.fps) ? +c.fps : 30;
    c.rong = [1280, 1920, 3840].includes(+c.rong) ? +c.rong : 1920;
    c.mau = /^#?[0-9a-f]{6}$/i.test(String(c.mau || '').trim()) ? '#' + String(c.mau).trim().replace(/^#/, '').toUpperCase() : MOTION_MAC_DINH.mau;
    c.duoi = Math.max(0, Math.min(5, parseFloat(c.duoi) || 0));
    c.thayVideoCu = c.thayVideoCu !== false;
    c.trinhDuyet = String(c.trinhDuyet || '').trim();
    this.store.set({ motion: c });
    this.bao();
    return { ok: true, caiDat: this.caiDat };
  }
  get ds() { return this.store.data.motionDs || null; }
  luu(ds) { this.store.set({ motionDs: ds || this.ds }); this.bao(); }

  trangThai() {
    const d = this.ds;
    return { caiDat: this.caiDat, dangChay: this.dangChay, trinhDuyet: this.trinhDuyet, taiTrinhDuyet: this.taiTrinhDuyet,
      mau: Object.fromEntries(Object.entries(MAU).map(([k, v]) => [k, v.ten])), ds: d };
  }

  /** Mở file: thư mục gốc = thư mục chứa file nếu trong đó có Audio / images / Videos, không thì thư mục của dự án. */
  napTep(tep, duAnId) {
    if (this.dangChay) return { ok: false, loi: 'Đang tạo video — bấm Dừng trước khi mở file khác' };
    const { ds, loi } = docFileMotion(tep);
    if (!ds.length) return { ok: false, loi: loi.join(' · ') || 'Không có dòng cảnh nào' };
    const ten = tenDanhSach(tep);
    const luu = { ...(this.store.data.motionLuu || {}) };
    if (this.ds && this.ds.tep) luu[this.ds.tep] = { ...this.ds, luuLuc: Date.now() };
    const cu = luu[tep] || null;
    delete luu[tep];
    this.store.set({ motionLuu: Object.fromEntries(Object.entries(luu).sort((a, b) => (b[1].luuLuc || 0) - (a[1].luuLuc || 0)).slice(0, 20)) });
    let goc = cu && cu.goc;
    if (!goc) {
      const canh = path.dirname(tep);
      if (laGocDuAn(canh)) goc = canh;
      else {
        let da = null;
        try { da = this.o.thuMucDuAn && this.o.thuMucDuAn(duAnId); } catch (_) {}
        goc = da && da.thuMuc ? path.dirname(da.thuMuc) : canh;
      }
    }
    const moi = { tep, ten, goc, thuMucVideo: (cu && cu.thuMucVideo) || '', napLuc: Date.now(), loiDoc: loi, duAn: duAnId || '',
      canh: ds.map((x) => ({ ...x, trangThai: 'cho', loi: '', tepRa: '', tienDo: 0, anh: '', amThanh: '', thoiLuong: 0 })) };
    if (cu) {
      for (const x of moi.canh) {
        const y = cu.canh.find((z) => z.so === x.so);
        if (y && y.tepRa && (y.trangThai === 'xong' || y.trangThai === 'bo') && JSON.stringify(y.props) === JSON.stringify(x.props) && y.mau === x.mau) {
          Object.assign(x, { trangThai: y.trangThai, tepRa: y.tepRa, xongLuc: y.xongLuc, dauRa: y.dauRa });
        }
      }
    }
    this.luu(moi);
    this.quet();
    this.log('info', `🎬 Mở danh sách motion "${ten}": ${moi.canh.length} cảnh${loi.length ? ` · ${loi.length} dòng bỏ qua (${loi.slice(0, 3).join(' · ')}${loi.length > 3 ? '…' : ''})` : ''}`);
    return { ok: true, so: moi.canh.length, loi };
  }

  datGoc(goc) {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách motion' };
    if (this.dangChay) return { ok: false, loi: 'Đang tạo video — bấm Dừng trước' };
    d.goc = String(goc || ''); d.thuMucVideo = '';
    this.luu(d);
    this.quet();
    return { ok: true };
  }
  datThuMucVideo(thuMuc) {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách motion' };
    d.thuMucVideo = String(thuMuc || '');
    this.luu(d);
    this.quet();
    return { ok: true };
  }
  /** Thư mục lưu video: chọn riêng, hoặc <gốc>/Videos (có sẵn thì giữ đúng chữ hoa / thường). */
  thuMucRa(d = this.ds) {
    if (!d) return '';
    return d.thuMucVideo || timThuMucCon(d.goc, THU_MUC.video) || path.join(d.goc, 'Videos');
  }

  xoaDs() {
    if (this.dangChay) return { ok: false, loi: 'Đang tạo video — bấm Dừng trước' };
    const d = this.ds;
    if (d && d.tep) this.store.set({ motionLuu: { ...(this.store.data.motionLuu || {}), [d.tep]: { ...d, luuLuc: Date.now() } } });
    this.store.set({ motionDs: null });
    this.bao();
    return { ok: true };
  }

  thoiLuong(tep) {
    try {
      const st = fs.statSync(tep);
      const k = `${tep}|${st.mtimeMs}|${st.size}`;
      if (!this.nhoAm.has(k)) this.nhoAm.set(k, thoiLuongAmThanh(fs.readFileSync(tep)));
      return this.nhoAm.get(k);
    } catch (_) { return 0; }
  }

  /** Ghép ảnh + giọng đọc theo số cảnh; video đã tạo mà mất file → Chờ. */
  quet() {
    const d = this.ds;
    if (!d) return { ok: false };
    const anh = fileTheoSo(timThuMucCon(d.goc, THU_MUC.anh), DUOI_ANH);
    const am = fileTheoSo(timThuMucCon(d.goc, THU_MUC.am), DUOI_AM);
    for (const x of d.canh) {
      x.anh = (anh.get(x.so) || [])[0] || '';
      x.amThanh = (am.get(x.so) || [])[0] || '';
      x.thoiLuong = x.amThanh ? Math.round(this.thoiLuong(x.amThanh) * 100) / 100 : 0;
      if (x.trangThai === 'xong' && (!x.tepRa || !fs.existsSync(x.tepRa))) { x.trangThai = 'cho'; x.tepRa = ''; }
    }
    this.luu(d);
    return { ok: true };
  }

  /** Độ dài clip (giây): giọng đọc + đệm; không có giọng đọc → cột giay → mặc định của mẫu. */
  giayCho(x, c = this.caiDat) {
    const g = x.thoiLuong > 0 ? x.thoiLuong + c.duoi : x.giay > 0 ? x.giay : MAU[x.mau].giay;
    return Math.max(GIAY_MIN, Math.min(GIAY_MAX, g));
  }

  /** Việc gửi tiến trình vẽ. anhUrl do tiến trình con thay bằng địa chỉ http nội bộ. */
  viecCho(x, c = this.caiDat) {
    const h = Math.round((c.rong * 9) / 16 / 2) * 2;
    const frames = Math.ceil(this.giayCho(x, c) * c.fps);
    return { so: x.so, comp: MAU[x.mau].comp, anh: x.anh || '', out: path.join(this.thuMucRa(), `${x.canh}.motion-tam.mp4`),
      props: { ...x.props, width: c.rong, height: h, fps: c.fps, frames, mau: c.mau } };
  }

  chuyenBo(tep) {
    try {
      if (!tep || !fs.existsSync(tep)) return false;
      const bo = path.join(path.dirname(tep), '_bo');
      fs.mkdirSync(bo, { recursive: true });
      const ext = path.extname(tep), goc = path.basename(tep, ext);
      let dich = path.join(bo, path.basename(tep));
      for (let n = 2; fs.existsSync(dich); n++) dich = path.join(bo, `${goc} (${n})${ext}`);
      fs.renameSync(tep, dich);
      return true;
    } catch (e) { this.log('warning', `🎬 Không chuyển được ${path.basename(tep)} vào _bo: ${e.message}`); return false; }
  }

  /** File video khác (không phải bản motion của cảnh) đang chiếm số cảnh trong thư mục lưu. */
  videoKhac(x) {
    return (fileTheoSo(this.thuMucRa(), DUOI_VIDEO).get(x.so) || []).filter((f) => f !== x.tepRa && !/\.motion-tam\.mp4$/i.test(f));
  }

  hoanTat(x, tam) {
    const dich = path.join(this.thuMucRa(), `${x.canh}.mp4`);
    const khac = this.videoKhac(x);
    let bo = 0;
    for (const f of khac) if (this.chuyenBo(f)) bo++;
    if (x.tepRa && x.tepRa !== dich) this.chuyenBo(x.tepRa);
    try { fs.rmSync(dich, { force: true }); } catch (_) {}
    fs.renameSync(tam, dich);
    Object.assign(x, { trangThai: 'xong', tepRa: dich, tienDo: 1, loi: '', xongLuc: Date.now(), dauRa: JSON.stringify({ p: x.props, c: this.caiDat }) });
    return bo;
  }

  /** Chạy các cảnh Chờ / Lỗi (hoặc đúng các số trong `chon`). */
  async chay(chon) {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách motion' };
    if (this.dangChay) return { ok: false, loi: 'Đang tạo video' };
    this.quet();
    const c = this.caiDat;
    const can = d.canh.filter((x) => (chon ? chon.includes(x.so) : x.trangThai === 'cho' || x.trangThai === 'loi'));
    const viec = [];
    for (const x of can) {
      if (!c.thayVideoCu && this.videoKhac(x).length) {
        x.trangThai = 'loi'; x.loi = `Đã có ${path.basename(this.videoKhac(x)[0])} — bật "Thay video đã có" để dùng motion`;
        continue;
      }
      x.trangThai = 'cho'; x.loi = ''; x.tienDo = 0;
      viec.push(x);
    }
    if (!viec.length) { this.luu(d); return { ok: true, so: 0 }; }
    try { fs.mkdirSync(this.thuMucRa(), { recursive: true }); } catch (e) { return { ok: false, loi: `Không tạo được thư mục lưu: ${e.message}` }; }
    this.dangChay = true;
    this.dung = false;
    this.luu(d);
    const jobs = viec.map((x) => this.viecCho(x, c));
    const thieuAnh = viec.filter((x) => !x.anh).map((x) => x.so);
    this.log('info', `🎬 Tạo ${viec.length} video motion → ${this.thuMucRa()}${thieuAnh.length ? ` · ${thieuAnh.length} cảnh chưa có ảnh (nền tối): ${thieuAnh.slice(0, 8).join(', ')}` : ''}`);
    const t0 = Date.now();
    let xong = 0, loi = 0;
    this.tt = this.o.taoTienTrinh();
    try {
      await this.tt.chay({ jobs, browser: c.trinhDuyet || null, crf: 18 }, (e) => {
        const x = e && e.i != null ? viec[e.i] : null;
        if (e.event === 'browser') { this.trinhDuyet = e.kind === 'headless-shell' ? 'Chrome Headless Shell (Remotion)' : e.path; this.taiTrinhDuyet = null; this.log('info', `🎬 Trình vẽ: ${this.trinhDuyet}`); this.bao(); }
        else if (e.event === 'download') { this.taiTrinhDuyet = Math.round((e.p || 0) * 100); this.baoNhe(); }
        else if (e.event === 'warn') this.log('warning', `🎬 ${e.text}`);
        else if (e.event === 'start' && x) { x.trangThai = 'dang'; x.tienDo = 0; this.luu(d); }
        else if (e.event === 'progress' && x) { x.tienDo = e.p || 0; this.baoNhe(); }
        else if (e.event === 'done' && x) {
          try {
            const bo = this.hoanTat(x, e.out);
            xong++;
            this.log('success', `🎬 ✓ Cảnh ${x.so} (${MAU[x.mau].ten}) → ${path.basename(x.tepRa)} · ${Math.round(e.sec || 0)} s vẽ${bo ? ` · video cũ chuyển vào _bo` : ''}`);
          } catch (er) { x.trangThai = 'loi'; x.loi = er.message; loi++; }
          this.luu(d);
        } else if (e.event === 'fail' && x) {
          x.trangThai = 'loi'; x.loi = String(e.error || '').slice(0, 300); loi++;
          this.log('error', `🎬 ✗ Cảnh ${x.so}: ${x.loi}`);
          this.luu(d);
        } else if (e.event === 'error') {
          for (const y of viec) if (y.trangThai === 'cho' || y.trangThai === 'dang') { y.loi = this.dung ? '' : String(e.text || '').slice(0, 300); if (!this.dung) { y.trangThai = 'loi'; y.tienDo = 0; } }
          if (!this.dung) this.log('error', `🎬 ${e.text}`);
          this.luu(d);
        }
      });
    } finally {
      for (const y of viec) {
        // chưa xong (dừng tay / tiến trình vẽ chết): cảnh đã có video từ lần trước vẫn giữ video đó
        if (y.trangThai === 'dang' || y.trangThai === 'cho') {
          const coCu = y.tepRa && fs.existsSync(y.tepRa);
          if (this.dung || coCu) { y.trangThai = coCu ? 'xong' : 'cho'; y.loi = ''; } else { y.trangThai = 'loi'; y.loi = y.loi || 'Tiến trình vẽ dừng giữa chừng'; }
          y.tienDo = coCu ? 1 : 0;
        }
        try { fs.rmSync(path.join(this.thuMucRa(), `${y.canh}.motion-tam.mp4`), { force: true }); } catch (_) {}
      }
      this.tt = null;
      this.dangChay = false;
      this.luotXong++;
      this.luu(d);
    }
    this.log(loi ? 'warning' : 'success', `🎬 Motion: ${xong}/${viec.length} video xong${loi ? `, ${loi} lỗi` : ''}${this.dung ? ' (đã dừng)' : ''} · ${Math.round((Date.now() - t0) / 1000)} s`);
    return { ok: true, so: viec.length, xong, loi };
  }

  baoNhe() { const n = Date.now(); if (n - this.lanBao > 400) { this.lanBao = n; this.bao(); } }

  async dungLai() {
    if (!this.dangChay || !this.tt) return { ok: false, loi: 'Không có gì đang chạy' };
    this.dung = true;
    this.log('info', '🎬 Dừng tạo video motion…');
    await this.tt.dung();
    return { ok: true };
  }

  /** Bỏ motion của cảnh: video đã tạo chuyển vào _bo (cảnh dùng lại ảnh / video AI). */
  bo(so) {
    const d = this.ds; const x = d && d.canh.find((y) => y.so === so);
    if (!x) return { ok: false, loi: 'Không có cảnh này' };
    if (this.dangChay) return { ok: false, loi: 'Đang tạo video — bấm Dừng trước' };
    if (x.tepRa) this.chuyenBo(x.tepRa);
    x.trangThai = 'bo'; x.tepRa = ''; x.tienDo = 0;
    this.luu(d);
    return { ok: true };
  }
  layLai(so) {
    const d = this.ds; const x = d && d.canh.find((y) => y.so === so);
    if (!x) return { ok: false, loi: 'Không có cảnh này' };
    if (x.trangThai === 'bo') { x.trangThai = 'cho'; this.luu(d); }
    return { ok: true };
  }
}

module.exports = { QuanLyMotion, MAU, MOTION_MAC_DINH, docHangMotion, docFileMotion, propsMau, chuanMau, thoiLuongAmThanh, fileTheoSo,
  timThuMucCon, soTuTen, laGocDuAn, dauNguonMotion, taoTienTrinhCon, tenDanhSach };
