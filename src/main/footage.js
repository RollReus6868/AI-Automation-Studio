'use strict';
// ============================================================================
//  footage.js — 1.6.0: tải footage (stock video) cho các cảnh của kịch bản qua API chính thức
//  của Pexels và Pixabay (miễn phí, có khoá API riêng của người dùng).
//
//  Đầu vào: file <tên>_footage.xlsx do skill chia cảnh xuất (sheet FOOTAGE; cột scene, nguon, tu_khoa,
//  giay_can, tranh, ghi_chu). Mỗi cảnh: tìm theo từng cụm từ khoá → lọc clip ngang, đủ dài, không chứa
//  chữ cần tránh, chưa dùng ở cảnh khác → tải bản gần cỡ mong muốn nhất → <thư mục>/<số cảnh>.mp4
//  (CapCut Draft Studio đọc Videos/<số>.mp4 thay cho ảnh của cảnh đó).
//
//  KHÔNG tải Storyblocks hay trang trả phí nào bằng máy: điều khoản của họ cấm script tải hàng loạt.
//  Phần logic chọn clip ở đây thuần (không Electron) để kiểm bằng node; mạng / file truyền vào.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { docXlsx, docCsv } = require('./doc-xlsx');

const NGUON = ['pexels', 'pixabay'];
const TEN_NGUON = { pexels: 'Pexels', pixabay: 'Pixabay' };
const FOOTAGE_MAC_DINH = { pexelsKey: '', pixabayKey: '', rong: 1920, boQuaDaCo: true, mauTen: '{canh}', boHienDai: true };
const CHO_GIUA_LAN_GOI_MS = 1200;      // giãn lượt gọi API (Pexels mặc định 200 lượt/giờ)
const GIU_TIM_MS = 24 * 3600 * 1000;
const GIU_UNG_VIEN = 8;                 // số clip dự phòng giữ cho mỗi cảnh (nút Đổi clip)   // Pixabay yêu cầu giữ kết quả tìm 24 giờ (dùng chung cho cả hai)

// ── Đọc danh sách cảnh ─────────────────────────────────────────────────────
const BI_DANH = {
  canh: ['scene', 'canh', 'cảnh', 'so', 'số'],
  nguon: ['nguon', 'nguồn', 'source'],
  tuKhoa: ['tu_khoa', 'tu khoa', 'từ khoá', 'từ khóa', 'keywords', 'keyword', 'query', 'search'],
  giay: ['giay_can', 'giay', 'giây', 'seconds', 'sec', 'duration', 'dur'],
  tranh: ['tranh', 'tránh', 'avoid', 'exclude'],
  ghiChu: ['ghi_chu', 'ghi chú', 'note', 'notes'],
  cheDo: ['che_do', 'chế độ', 'mode']
};
const chuanTen = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
/** "a; b | c\nd" → ['a','b','c','d'] (dấu phẩy giữ trong cụm). */
const tachCum = (s) => String(s || '').split(/[;|\n\r]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Hàng (dòng đầu là tiêu đề) → { ds, loi }. Mỗi phần tử ds:
 * { canh: '0047', so: 47, nguon: 'auto'|'pexels'|'pixabay', tuKhoa: [..], giay: 7, tranh: [..], ghiChu }
 */
function docHang(hang) {
  const loi = [];
  const dauIdx = hang.findIndex((h) => h && h.some((o) => String(o || '').trim()));
  if (dauIdx < 0) return { ds: [], loi: ['File trống'] };
  const dau = hang[dauIdx].map(chuanTen);
  const cot = {};
  for (const [k, ten] of Object.entries(BI_DANH)) cot[k] = dau.findIndex((d) => ten.includes(d));
  if (cot.canh < 0) return { ds: [], loi: ['Thiếu cột "scene" (số cảnh) ở dòng tiêu đề'] };
  if (cot.tuKhoa < 0) return { ds: [], loi: ['Thiếu cột "tu_khoa" (từ khoá tìm, tiếng Anh) ở dòng tiêu đề'] };
  const ds = [];
  const daCo = new Set();
  for (let i = dauIdx + 1; i < hang.length; i++) {
    const h = hang[i] || [];
    const o = (k) => (cot[k] >= 0 ? String(h[cot[k]] == null ? '' : h[cot[k]]).trim() : '');
    if (!h.some((x) => String(x || '').trim())) continue;
    const goc = o('canh').replace(/\.0+$/, '');
    if (!/^\d+$/.test(goc)) { loi.push(`Dòng ${i + 1}: số cảnh "${goc}" không phải số`); continue; }
    const so = parseInt(goc, 10);
    if (daCo.has(so)) { loi.push(`Dòng ${i + 1}: cảnh ${goc} lặp lại — bỏ dòng này`); continue; }
    const tuKhoa = tachCum(o('tuKhoa'));
    if (!tuKhoa.length) { loi.push(`Dòng ${i + 1}: cảnh ${goc} chưa có từ khoá`); continue; }
    const cheDo = o('cheDo').toLowerCase();
    if (cheDo && cheDo !== 'thay') { loi.push(`Dòng ${i + 1}: cảnh ${goc} chế độ "${cheDo}" — tool chỉ tải footage thay cảnh, bỏ dòng này`); continue; }
    let nguon = o('nguon').toLowerCase();
    if (!NGUON.includes(nguon)) nguon = 'auto';
    const giay = Math.max(0, Math.min(120, parseFloat(o('giay').replace(',', '.')) || 0));
    daCo.add(so);
    ds.push({ canh: goc.length >= 4 ? goc : goc.padStart(4, '0'), so, nguon, tuKhoa, giay,
      tranh: tachCum(o('tranh').replace(/,/g, ';')).map((x) => x.toLowerCase()), ghiChu: o('ghiChu') });
  }
  ds.sort((a, b) => a.so - b.so);
  return { ds, loi };
}

/** Đọc file .xlsx (sheet FOOTAGE, không có thì sheet đầu) hoặc .csv. */
function docFileFootage(tep) {
  const buf = fs.readFileSync(tep);
  const hang = /\.csv$/i.test(tep) ? docCsv(buf.toString('utf8')) : docXlsx(buf, { sheet: 'FOOTAGE' }).hang;
  return docHang(hang);
}

/** "Thien_su_footage.xlsx" → "Thien_su". */
const tenDanhSach = (tep) => path.basename(String(tep || ''), path.extname(String(tep || ''))).replace(/[ _-]*footage$/i, '') || 'Footage';

// ── 1.6.2: độ khớp từ khoá + bỏ đồ vật hiện đại ─────────────────────────────
// Pixabay (và Pexels) trả cả clip chỉ khớp chữ phụ: "candle flame close up" → clip thịt xông khói (thẻ "Close Up"),
// "cinema projector beam" → ghế sofa (thẻ "Old", "Books"). Nay chấm khớp theo thẻ / mô tả của clip: phải khớp danh
// từ chính của cụm từ khoá, không đủ thì cảnh báo Lỗi (dùng ảnh AI) thay vì tải clip lạc đề.
const TU_BO_QUA = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'and', 'or', 'to', 'from', 'by', 'for', 'into', 'over',
  'close', 'up', 'closeup', 'shot', 'view', 'footage', 'video', 'clip', '4k', 'hd', 'slow', 'motion', 'scene', 'broll', 'roll']);
const TU_CHUNG = new Set(['old', 'ancient', 'aged', 'antique', 'vintage', 'historic', 'historical', 'light', 'lights', 'golden', 'gold',
  'dark', 'night', 'day', 'sunset', 'sunrise', 'dawn', 'dusk', 'evening', 'morning', 'aerial', 'beautiful', 'nature', 'landscape',
  'soft', 'warm', 'cold', 'cinematic', 'dramatic', 'glow', 'glowing', 'shadow', 'shadows', 'rays', 'time', 'lapse', 'timelapse', 'top',
  'overhead', 'detail', 'details', 'texture', 'abstract', 'silhouette', 'big', 'small', 'large', 'empty', 'quiet', 'slowly', 'moving',
  'wide', 'low', 'high', 'angle', 'background', 'color', 'colour', 'red', 'blue', 'green', 'white', 'black', 'brown']);
/** Đồ vật / cảnh hiện đại — bỏ khi bật "Bỏ clip có đồ vật hiện đại" (trừ chữ có trong chính từ khoá của cảnh). */
const TU_HIEN_DAI = ['city', 'cityscape', 'skyline', 'skyscraper', 'downtown', 'urban', 'office', 'car', 'traffic', 'highway', 'road',
  'street', 'bus', 'truck', 'train', 'railway', 'airplane', 'aircraft', 'airport', 'cruise', 'yacht', 'ferry', 'computer', 'laptop',
  'keyboard', 'mouse', 'typing', 'phone', 'smartphone', 'mobile', 'technology', 'screen', 'monitor', 'television', 'tv', 'cinema',
  'projector', 'escalator', 'mall', 'shopping', 'supermarket', 'turbine', 'windmill', 'wind energy', 'electricity', 'power line',
  'solar', 'factory', 'industry', 'industrial', 'neon', 'plastic', 'bacon', 'sofa', 'couch', 'furniture', 'chromakey', 'green screen',
  'greenscreen', 'gaming', 'game', 'business', 'modern', 'motorcycle', 'scooter', 'bicycle', 'bike', 'camera', 'photographer', 'selfie',
  'skateboard', 'gym', 'fitness', 'tourist', 'tourism', 'concert', 'party', 'fireworks', 'headphones', 'microphone', 'robot',
  'christmas', 'santa', 'diwali', 'notebook', 'jeans', 'sneakers', 'glasses', 'apartment', 'hotel', 'pool', 'bar', 'coffee',
  // 1.6.3 (clip lạc đề thật 26/11/2026: thư viện trường học, lật hồ sơ, xích đu, nghĩa trang có bia chữ, đèn phố nhoè, băng từ)
  'school', 'classroom', 'student', 'university', 'reading room', 'file', 'folder', 'spreadsheet', 'cabinet', 'swing', 'porch', 'bench',
  'cemetery', 'gravestone', 'headstone', 'bokeh', 'tape', 'cassette', 'vinyl', 'polaroid', 'marina', 'mandala', 'yoga', 'meditation', 'zen',
  // 1.6.4 (lần soát thứ ba: đường nhựa cho "roman road", Bitcoin cho "old coins", hiệu sách cho "old books shelf")
  'asphalt', 'bitcoin', 'crypto', 'cryptocurrency', 'blockchain', 'finance', 'trading', 'stock market', 'bookstore', 'shop', 'store'];
/** 1.6.3: "people / person / man / woman" trong cột tranh → bỏ cả clip có tay, nam, nữ, trẻ em… (thẻ Pixabay hay ghi "Hand", "Male"). */
const TU_NGUOI = ['man', 'men', 'woman', 'women', 'male', 'female', 'girl', 'boy', 'child', 'children', 'kid', 'hand', 'hands', 'finger',
  'face', 'portrait', 'human', 'adult', 'lady', 'guy', 'couple', 'family', 'businessman', 'worker', 'student', 'tourist',
  'musician', 'music', 'guitar', 'cello', 'violin', 'dancer', 'dance', 'singer', 'runner', 'hiker', 'athlete', 'worshipper', 'pilgrim'];

/** Chữ của cụm từ khoá → danh sách từ (thường, bỏ từ vô nghĩa). */
const tachTu = (cum) => String(cum || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !TU_BO_QUA.has(w));
/** Từ có trong mô tả clip (khớp nguyên từ, số nhiều đơn giản). */
function coTu(chu, w) {
  const c = ` ${chu} `;
  if (c.includes(` ${w} `) || c.includes(` ${w}s `) || c.includes(` ${w}es `)) return true;
  if (w.endsWith('ies') && c.includes(` ${w.slice(0, -3)}y `)) return true;
  if (w.endsWith('s') && w.length > 3 && c.includes(` ${w.slice(0, -1)} `)) return true;
  return false;
}
/**
 * Độ khớp clip ↔ một cụm từ khoá: { dat, diem }. Đạt khi khớp HẾT từ chính nếu cụm có ≤ 2 từ chính, còn lại ≥ một
 * nửa (từ chính = không phải từ chung như old / light / sunset / aerial); cụm toàn từ chung thì phải khớp ≥ một nửa số từ.
 */
function doKhop(c, cum) {
  const tu = [...new Set(tachTu(cum))];
  if (!tu.length) return { dat: false, diem: 0 };
  const chinh = tu.filter((w) => !TU_CHUNG.has(w));
  const khop = tu.filter((w) => coTu(c.chu || '', w));
  const khopChinh = khop.filter((w) => !TU_CHUNG.has(w));
  // 1.6.3: cụm ≤ 2 từ chính phải khớp HẾT ("stone steps" mà clip chỉ có thẻ "Stone" → biển lúc hoàng hôn, 26/11/2026);
  // cụm dài hơn khớp ≥ một nửa.
  const canChinh = chinh.length <= 2 ? chinh.length : Math.ceil(chinh.length / 2);
  const dat = chinh.length ? khopChinh.length >= canChinh : khop.length >= 1 && khop.length * 2 >= tu.length;
  return { dat, diem: khopChinh.length * 2 + (khop.length - khopChinh.length) };
}
/** Từ khoá gửi lên API: bỏ "close up", "shot", "4k"… (chữ đó làm Pixabay trả clip lạc đề). */
const cauTim = (cum) => tachTu(cum).join(' ') || String(cum || '').trim();

// ── Chuẩn hoá kết quả API ──────────────────────────────────────────────────
/** Chọn tệp gần cỡ mong muốn: nhỏ nhất mà rộng ≥ rong; không có thì lớn nhất. */
function chonTep(teps, rong) {
  const ok = teps.filter((t) => t && t.url && t.w > 0 && t.h > 0 && t.w >= t.h);
  if (!ok.length) return null;
  const du = ok.filter((t) => t.w >= rong).sort((a, b) => a.w - b.w);
  return du[0] || ok.sort((a, b) => b.w - a.w)[0];
}

function chuanPexels(json, rong) {
  return ((json && json.videos) || []).map((v) => {
    const tep = chonTep((v.video_files || []).filter((f) => !f.file_type || /mp4/i.test(f.file_type))
      .map((f) => ({ url: f.link, w: +f.width || 0, h: +f.height || 0 })), rong);
    return {
      id: `pexels-${v.id}`, nguon: 'pexels', w: +v.width || 0, h: +v.height || 0, giay: +v.duration || 0,
      trang: v.url || '', tacGia: (v.user && v.user.name) || '', tacGiaUrl: (v.user && v.user.url) || '',
      anh: v.image || ((v.video_pictures || [])[0] || {}).picture || '',
      chu: String(v.url || '').toLowerCase().replace(/[^a-z0-9]+/g, ' '), tep
    };
  }).filter((c) => c.tep);
}

function chuanPixabay(json, rong) {
  return ((json && json.hits) || []).map((v) => {
    const vs = v.videos || {};
    const ds = ['large', 'medium', 'small', 'tiny'].map((k) => vs[k]).filter(Boolean)
      .map((f) => ({ url: f.url, w: +f.width || 0, h: +f.height || 0, anh: f.thumbnail }));
    const tep = chonTep(ds, rong);
    const lon = ds[0] || {};
    return {
      id: `pixabay-${v.id}`, nguon: 'pixabay', w: lon.w || 0, h: lon.h || 0, giay: +v.duration || 0,
      trang: v.pageURL || '', tacGia: v.user || '', tacGiaUrl: v.user_id ? `https://pixabay.com/users/${v.user_id}/` : '',
      anh: (ds.find((f) => f.anh) || {}).anh || '',
      chu: `${String(v.tags || '')} ${String(v.pageURL || '')}`.toLowerCase().replace(/[^a-z0-9]+/g, ' '),
      tep: tep && { url: tep.url, w: tep.w, h: tep.h }
    };
  }).filter((c) => c.tep);
}

/** Chữ cần tránh có trong mô tả clip (khớp nguyên từ, số nhiều đơn giản: person ↔ persons). */
function coChuTranh(c, tranh) {
  const chu = ` ${c.chu || ''} `;
  return (tranh || []).some((t) => {
    const w = String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
    if (!w) return false;
    return chu.includes(` ${w} `) || chu.includes(` ${w}s `) || (w.endsWith('s') && chu.includes(` ${w.slice(0, -1)} `));
  });
}

/**
 * Xếp ứng viên cho một cảnh: bỏ clip dọc / vuông, clip đã dùng ở cảnh khác, clip có chữ cần tránh, clip quá ngắn
 * (< 80% số giây cần — CapCut Draft Studio làm chậm tới 0,75× được). Còn lại xếp theo: đủ dài, không dài quá
 * 2,5 lần (dài thì CapCut phải cắt / tua nhanh), đủ cỡ, rồi thứ tự của trang (độ khớp từ khoá).
 */
function xepUngVien(ds, o = {}) {
  const can = +o.giay || 0;
  const rong = +o.rong || 1920;
  const daDung = o.daDung || new Set();
  return ds.map((c, i) => ({ c, i }))
    .filter(({ c }) => c.tep && c.tep.w >= c.tep.h * 1.3 && !daDung.has(c.id) && !coChuTranh(c, o.tranh) &&
      (!can || !c.giay || c.giay >= can * 0.8))
    .map(({ c, i }) => {
      let diem = i;
      if (can && c.giay) {
        if (c.giay < can) diem += 15;
        else if (c.giay > can * 2.5) diem += Math.min(30, (c.giay / can - 2.5) * 6);
      }
      if (c.tep.w < Math.min(rong, 1920)) diem += c.tep.w < 1280 ? 40 : 20;
      return { c, diem };
    })
    .sort((a, b) => a.diem - b.diem)
    .map((x) => x.c);
}

/** Tên file theo mẫu: {canh} = số cảnh như trong file (0047), {so} = số không đệm (47). */
function tenFootage(mau, canh) {
  const so = String(parseInt(canh.canh, 10));
  const ten = String(mau || '{canh}').replace(/\{canh\}/g, canh.canh).replace(/\{so\}/g, so).replace(/[<>:"/\\|?*]+/g, '_').trim() || canh.canh;
  return `${ten}.mp4`;
}

/** Danh sách số cảnh để dán vào ô "Chọn số" của app: [3,5,9,10,11] → "3, 5, 9-11". */
function chuoiSo(ds) {
  const so = [...new Set(ds)].sort((a, b) => a - b);
  const ra = [];
  for (let i = 0; i < so.length; i++) {
    let k = i;
    while (k + 1 < so.length && so[k + 1] === so[k] + 1) k++;
    ra.push(k > i ? `${so[i]}-${so[k]}` : String(so[i]));
    i = k;
  }
  return ra.join(', ');
}

/** Bản gọn của danh sách để nhớ theo file (bỏ ứng viên — Đổi clip sẽ tìm lại). */
const gon = (d) => ({ ...d, luuLuc: Date.now(), canh: d.canh.map(({ ungVien, ...x }) => ({ ...x, viTri: -1 })) });

// ── Bộ tải ─────────────────────────────────────────────────────────────────
/**
 * @param o.store     Store app (khoá 'footage' = cài đặt, 'footageDs' = danh sách đang làm)
 * @param o.fetch     (url, {headers}) → Response (Electron net.fetch)
 * @param o.taiVe     async (url, tepDich) → số byte (tải về file tạm rồi đổi tên)
 * @param o.log       (muc, chu)
 * @param o.bao       () → báo giao diện vẽ lại
 * @param o.thuMucGoc thư mục mặc định (Tài liệu/AI Automation Studio)
 * @param o.goc       { pexels, pixabay } địa chỉ API (bài kiểm thay bằng máy chủ giả)
 * @param o.ngu       ms → Promise (bài kiểm làm nhanh)
 */
class QuanLyFootage {
  constructor(o) {
    this.o = o;
    this.store = o.store;
    this.log = o.log || (() => {});
    this.bao = o.bao || (() => {});
    // 1.6.1: chỉ nhận địa chỉ có giá trị — main truyền { pixabay: undefined } khi không chạy bài kiểm, Object.assign
    // chép cả undefined đè địa chỉ thật → gọi "undefined/api/videos/…" (lỗi "Failed to parse URL" ở 1.6.0).
    this.goc = { pexels: 'https://api.pexels.com', pixabay: 'https://pixabay.com' };
    for (const [k, v] of Object.entries(o.goc || {})) if (typeof v === 'string' && /^https?:\/\//.test(v)) this.goc[k] = v.replace(/\/+$/, '');
    this.ngu = o.ngu || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.dangChay = false;
    this.dung = false;
    this.luotXong = 0;   // số lượt Tải footage đã chạy xong (bài kiểm chờ theo số này)
    this.lanGoiCuoi = 0;
    this.hetLuot = {};   // nguồn → thời điểm được gọi lại (429 / hết lượt)
    this.boNho = new Map();   // khoá tìm → { luc, json }
  }

  get caiDat() { return Object.assign({}, FOOTAGE_MAC_DINH, this.store.data.footage || {}); }
  datCaiDat(m) {
    const c = this.caiDat;
    for (const k of Object.keys(FOOTAGE_MAC_DINH)) if (k in (m || {})) c[k] = m[k];
    c.pexelsKey = String(c.pexelsKey || '').trim();
    c.pixabayKey = String(c.pixabayKey || '').trim();
    c.rong = [1280, 1920, 3840].includes(+c.rong) ? +c.rong : 1920;
    c.boQuaDaCo = !!c.boQuaDaCo;
    c.boHienDai = c.boHienDai !== false;
    c.mauTen = String(c.mauTen || '{canh}').trim() || '{canh}';
    this.store.set({ footage: c });
    this.bao();
    return { ok: true, caiDat: this.trangThai().caiDat };
  }
  get ds() { return this.store.data.footageDs || null; }
  luu(ds) { this.store.set({ footageDs: ds || this.ds }); this.bao(); }

  /** Trạng thái cho giao diện — khoá API chỉ báo có / không, không gửi nguyên khoá. */
  trangThai() {
    const c = this.caiDat;
    return {
      caiDat: { coPexels: !!c.pexelsKey, coPixabay: !!c.pixabayKey, rong: c.rong, boQuaDaCo: c.boQuaDaCo, mauTen: c.mauTen, boHienDai: c.boHienDai,
        pexelsDuoi: c.pexelsKey.slice(-4), pixabayDuoi: c.pixabayKey.slice(-4) },
      dangChay: this.dangChay,
      // Không gửi danh sách ứng viên (có thể vài nghìn mục) — giao diện chỉ cần clip đang dùng.
      ds: this.ds && { ...this.ds, canh: this.ds.canh.map(({ ungVien, ...x }) => ({ ...x, conLuaChon: Math.max(0, (ungVien || []).length - 1 - x.viTri) })) }
    };
  }

  /**
   * 1.6.5: thư mục Videos của dự án (o.thuMucDuAn(duAnId) → { thuMuc, ten, drive }): Drive trên máy bật thì
   * <thư mục Drive>/<Tên dự án>/Videos, không thì <thư mục lưu video>/<Tên dự án>/Videos. Tạo khi tải clip đầu tiên.
   */
  thuMucDuAn(duAnId) {
    try { return (this.o.thuMucDuAn && this.o.thuMucDuAn(duAnId)) || null; } catch (_) { return null; }
  }

  napTep(tep, duAnId) {
    const { ds, loi } = docFileFootage(tep);
    if (!ds.length) return { ok: false, loi: loi.join(' · ') || 'Không có dòng cảnh nào' };
    if (this.dangChay) return { ok: false, loi: 'Đang tải footage — bấm Dừng trước khi mở file khác' };
    const ten = tenDanhSach(tep);
    // Nhớ danh sách đã mở theo đường dẫn file (tối đa 20 file gần nhất): mở lại file cũ thì giữ clip + thư mục lưu.
    const luu = { ...(this.store.data.footageLuu || {}) };
    if (this.ds && this.ds.tep) luu[this.ds.tep] = gon(this.ds);
    const cu = luu[tep] || null;
    delete luu[tep];
    const giu = Object.entries(luu).sort((a, b) => (b[1].luuLuc || 0) - (a[1].luuLuc || 0)).slice(0, 20);
    this.store.set({ footageLuu: Object.fromEntries(giu) });
    // Mở lại file cũ → giữ thư mục đã dùng; file mới → thư mục Videos của dự án đang mở (1.6.5).
    const da = this.thuMucDuAn(duAnId || (cu && cu.duAn));
    const thuMuc = cu && cu.thuMuc ? cu.thuMuc : (da && da.thuMuc) || path.join(this.o.thuMucGoc || '.', 'Footage', ten);
    const moi = { tep, ten, thuMuc, napLuc: Date.now(), loiDoc: loi, duAn: duAnId || (cu && cu.duAn) || '', duAnTen: (da && da.ten) || (cu && cu.duAnTen) || '',
      canh: ds.map((x) => ({ ...x, trangThai: 'cho', clip: null, ungVien: null, viTri: -1, loi: '', tepRa: '' })) };
    // Mở lại đúng file cũ: giữ clip đã tải của cảnh có cùng từ khoá.
    let chuyen = 0;
    if (cu) {
      for (const x of moi.canh) {
        const y = cu.canh.find((z) => z.so === x.so && z.tuKhoa.join('|') === x.tuKhoa.join('|'));
        if (y && (y.trangThai === 'xong' || y.trangThai === 'bo')) Object.assign(x, { trangThai: y.trangThai, clip: y.clip, ungVien: y.ungVien, viTri: y.viTri, tepRa: y.tepRa });
      }
      // 1.6.3: file sửa lại (bỏ cảnh / đổi từ khoá) → clip APP đã tải cho cảnh đó chuyển vào _bo, kẻo CapCut vẫn dùng clip cũ
      // hoặc "Bỏ qua cảnh đã có file" coi nó là file bạn tự đặt. File bạn tự đặt (coSan, không có clip) giữ nguyên.
      for (const y of cu.canh) {
        if (!y.clip || !y.tepRa || y.trangThai === 'bo') continue;
        const x = moi.canh.find((z) => z.so === y.so);
        if (x && x.clip) continue;
        if (this.chuyenBo(y.tepRa)) chuyen++;
      }
    }
    this.luu(moi);
    if (chuyen) this.log('info', `🎞 File footage đã sửa: ${chuyen} clip của cảnh bị bỏ / đổi từ khoá chuyển vào _bo`);
    this.log('info', `🎞 Mở danh sách footage "${ten}": ${moi.canh.length} cảnh${loi.length ? ` · ${loi.length} dòng bỏ qua (${loi.slice(0, 3).join(' · ')}${loi.length > 3 ? '…' : ''})` : ''}`);
    return { ok: true, so: moi.canh.length, loi, chuyen };
  }

  /** 1.6.5: đặt thư mục lưu về thư mục Videos của dự án (nút "Videos của dự án"). */
  veThuMucDuAn(duAnId) {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách footage' };
    const da = this.thuMucDuAn(duAnId || d.duAn);
    if (!da || !da.thuMuc) return { ok: false, loi: 'Không xác định được thư mục của dự án' };
    d.thuMuc = da.thuMuc; d.duAn = duAnId || d.duAn; d.duAnTen = da.ten;
    this.luu(d);
    return { ok: true, thuMuc: da.thuMuc };
  }

  datThuMuc(thuMuc) {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách footage' };
    d.thuMuc = String(thuMuc || '');
    this.luu(d);
    return { ok: true };
  }

  xoaDs() {
    if (this.dangChay) return { ok: false, loi: 'Đang tải — bấm Dừng trước' };
    const d = this.ds;
    if (d && d.tep) this.store.set({ footageLuu: { ...(this.store.data.footageLuu || {}), [d.tep]: gon(d) } });
    this.store.set({ footageDs: null });
    this.bao();
    return { ok: true };
  }

  // ── Gọi API ──
  async goiApi(nguon, tuKhoa, can) {
    const c = this.caiDat;
    const khoa = `${nguon}|${tuKhoa.toLowerCase()}|${c.rong}`;
    const nho = this.boNho.get(khoa);
    if (nho && Date.now() - nho.luc < GIU_TIM_MS) return nho.ds;
    if ((this.hetLuot[nguon] || 0) > Date.now()) throw Object.assign(new Error(`${TEN_NGUON[nguon]} đang hết lượt gọi`), { hetLuot: true });
    const cho = this.lanGoiCuoi + CHO_GIUA_LAN_GOI_MS - Date.now();
    if (cho > 0) await this.ngu(cho);
    this.lanGoiCuoi = Date.now();
    let url, headers = {};
    if (nguon === 'pexels') {
      url = `${this.goc.pexels}/v1/videos/search?query=${encodeURIComponent(cauTim(tuKhoa))}&orientation=landscape&per_page=40`;
      headers = { Authorization: c.pexelsKey };
    } else {
      url = `${this.goc.pixabay}/api/videos/?key=${encodeURIComponent(c.pixabayKey)}&q=${encodeURIComponent(cauTim(tuKhoa).slice(0, 100))}&video_type=film&safesearch=true&per_page=50` +
        (can ? `&min_width=1280` : '');
    }
    let r;
    try { r = await this.o.fetch(url, { headers }); } catch (e) {
      throw new Error(`${TEN_NGUON[nguon]}: không kết nối được (${this.anKhoa(e.message)})`);
    }
    if (r.status === 429) {
      const dat = parseInt(r.headers.get('x-ratelimit-reset'), 10);
      // Pexels: thời điểm (giây UNIX) đổi tháng; Pixabay: số giây còn lại. Không rõ thì nghỉ 10 phút.
      const den = dat > 1e9 ? dat * 1000 : Date.now() + (dat > 0 ? dat * 1000 : 10 * 60 * 1000);
      this.hetLuot[nguon] = Math.min(den, Date.now() + 3600 * 1000);
      throw Object.assign(new Error(`${TEN_NGUON[nguon]} báo hết lượt gọi (429)`), { hetLuot: true });
    }
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`${TEN_NGUON[nguon]} từ chối khoá API (${r.status}) — kiểm tra lại khoá`), { saiKhoa: true });
    if (!r.ok) throw new Error(`${TEN_NGUON[nguon]} lỗi ${r.status}`);
    const json = await r.json();
    const conLai = parseInt(r.headers.get('x-ratelimit-remaining'), 10);
    if (nguon === 'pexels' && conLai === 0) {
      const dat = parseInt(r.headers.get('x-ratelimit-reset'), 10);
      this.hetLuot.pexels = dat > 1e9 ? Math.min(dat * 1000, Date.now() + 3600 * 1000) : Date.now() + 3600 * 1000;
    }
    const ds = nguon === 'pexels' ? chuanPexels(json, c.rong) : chuanPixabay(json, c.rong);
    this.boNho.set(khoa, { luc: Date.now(), ds });
    return ds;
  }

  /** 1.6.1: che khoá API trong chữ lỗi (nhật ký, giao diện, ảnh chụp gửi đi). */
  anKhoa(chu) {
    let s = String(chu || '');
    for (const k of [this.caiDat.pexelsKey, this.caiDat.pixabayKey]) {
      if (k && k.length >= 4) for (const v of new Set([k, encodeURIComponent(k)])) s = s.split(v).join('•••');
    }
    return s;
  }

  /** Nguồn dùng được cho một cảnh, theo thứ tự (auto = Pexels rồi Pixabay); chỉ nguồn đã có khoá. */
  nguonCho(x) {
    const c = this.caiDat;
    const co = { pexels: !!c.pexelsKey, pixabay: !!c.pixabayKey };
    const thuTu = x.nguon === 'pixabay' ? ['pixabay', 'pexels'] : ['pexels', 'pixabay'];
    return thuTu.filter((n) => co[n]);
  }

  /**
   * Tìm ứng viên cho một cảnh (1.6.2): gọi MỌI cụm từ khoá của nguồn đầu, giữ clip KHỚP từ khoá (doKhop), bỏ clip có
   * chữ cần tránh / đồ vật hiện đại, rồi xếp: cụm đứng trước trước, khớp nhiều hơn trước, rồi độ dài / cỡ (xepUngVien).
   * Nguồn đầu không có clip khớp → nguồn kế. Không có clip khớp nào → trả rỗng (cảnh báo Lỗi, dùng ảnh AI).
   */
  async timUngVien(x, daDung) {
    const loi = [];
    const nguon = this.nguonCho(x);
    if (!nguon.length) throw new Error('Chưa có khoá API Pexels hay Pixabay (nhập ở thẻ Khoá API)');
    const tranh = [...(x.tranh || [])];
    if (tranh.some((w) => ['people', 'person', 'man', 'woman', 'human'].includes(w))) tranh.push(...TU_NGUOI.filter((w) => !tranh.includes(w)));
    if (this.caiDat.boHienDai) {
      const cua = ` ${x.tuKhoa.join(' ').toLowerCase()} `;
      for (const w of TU_HIEN_DAI) if (!cua.includes(` ${w} `) && !cua.includes(` ${w}s `)) tranh.push(w);
    }
    let lac = 0;
    for (const n of nguon) {
      const gom = new Map();   // id → { c, diem, cum, thu }
      for (let k = 0; k < x.tuKhoa.length; k++) {
        if (this.dung) return { ds: [], loi };
        let kq;
        try { kq = await this.goiApi(n, x.tuKhoa[k], x.giay); } catch (e) {
          loi.push(this.anKhoa(e.message));
          if (e.hetLuot || e.saiKhoa) break;   // nguồn này hết lượt / sai khoá → sang nguồn kế
          continue;
        }
        const xep = xepUngVien(kq, { giay: x.giay, tranh, rong: this.caiDat.rong, daDung });
        xep.forEach((c, thu) => {
          const kh = doKhop(c, x.tuKhoa[k]);
          if (!kh.dat) { lac++; return; }
          const cu = gom.get(c.id);
          if (!cu) gom.set(c.id, { c, diem: kh.diem, cum: k, thu });   // cụm đầu tiên khớp clip này là cụm tính điểm
        });
      }
      // Cụm đứng trước (cụ thể nhất) trước; cùng cụm thì khớp nhiều từ hơn trước; rồi độ dài / cỡ / thứ tự trang.
      const ds = [...gom.values()].sort((a, b) => a.cum - b.cum || b.diem - a.diem || a.thu - b.thu).map((v) => v.c);
      if (ds.length) return { ds, loi };
    }
    if (lac) loi.push(`${lac} clip tìm được không khớp từ khoá (chỉ trùng chữ phụ) — đã bỏ`);
    return { ds: [], loi };
  }

  daDungTru(d, x) { return new Set(d.canh.filter((y) => y !== x && y.clip && y.trangThai !== 'bo').map((y) => y.clip.id)); }

  /** Tải clip đang chọn (x.ungVien[x.viTri]) về thư mục; file cũ của cảnh bị thay. */
  async taiClip(d, x) {
    const c = x.ungVien[x.viTri];
    fs.mkdirSync(d.thuMuc, { recursive: true });
    const tep = path.join(d.thuMuc, tenFootage(this.caiDat.mauTen, x));
    x.trangThai = 'tai'; this.luu(d);
    const byte = await this.o.taiVe(c.tep.url, tep);
    x.clip = { id: c.id, nguon: c.nguon, trang: c.trang, tacGia: c.tacGia, tacGiaUrl: c.tacGiaUrl, anh: c.anh, giay: c.giay, w: c.tep.w, h: c.tep.h, byte, url: c.tep.url };
    x.tepRa = tep; x.trangThai = 'xong'; x.loi = '';
    this.ghiNguon(d);
    this.luu(d);
    this.log('success', `🎞 Cảnh ${x.canh}: ${TEN_NGUON[c.nguon]} · ${c.tacGia || '?'} · ${c.giay}s · ${c.tep.w}×${c.tep.h} → ${tep}`);
  }

  /** Tệp ghi nguồn (để ghi công trong mô tả video): nguon-footage.txt trong thư mục footage. */
  ghiNguon(d) {
    const dong = d.canh.filter((x) => x.trangThai === 'xong' && x.clip)
      .map((x) => `${x.canh}\t${TEN_NGUON[x.clip.nguon]}\t${x.clip.tacGia}\t${x.clip.trang}`);
    try {
      fs.writeFileSync(path.join(d.thuMuc, 'nguon-footage.txt'),
        `Footage của "${d.ten}" — cảnh, nguồn, tác giả, trang gốc (Pexels / Pixabay không bắt buộc ghi công, nhưng nên ghi trong mô tả video)\n${dong.join('\n')}\n`);
    } catch (_) {}
  }

  /** Lý do chưa chạy được (giao diện báo ngay khi bấm), null = chạy được. */
  loiTruocChay() {
    if (!this.ds) return 'Chưa mở danh sách footage';
    if (!this.nguonCho({ nguon: 'auto' }).length) return 'Chưa có khoá API Pexels hay Pixabay — nhập ở thẻ Khoá API rồi Lưu';
    return null;
  }

  async chay() {
    const d = this.ds;
    const loiTruoc = this.loiTruocChay();
    if (loiTruoc) return { ok: false, loi: loiTruoc };
    if (this.dangChay) return { ok: true, dangChay: true };
    this.dangChay = true; this.dung = false;
    this.bao();
    let xong = 0, hong = 0, boQua = 0, mat = 0, chep = 0;
    // 1.6.4: cảnh "Đã có" mà file không còn trong thư mục lưu (bị xoá ngoài app, hoặc đổi thư mục lưu) → lấy lại:
    // còn file ở chỗ cũ thì chép sang, không thì tải lại đúng clip đó (hoặc tìm lại nếu clip cũ không ghi địa chỉ).
    for (const x of d.canh) {
      if (x.trangThai !== 'xong') continue;
      const dung = path.join(d.thuMuc, tenFootage(this.caiDat.mauTen, x));
      if (fs.existsSync(dung)) { if (x.tepRa !== dung) { x.tepRa = dung; } continue; }
      if (x.tepRa && fs.existsSync(x.tepRa) && x.clip) {
        try { fs.mkdirSync(d.thuMuc, { recursive: true }); fs.copyFileSync(x.tepRa, dung); x.tepRa = dung; chep++; continue; } catch (_) {}
      }
      Object.assign(x, { trangThai: 'cho', coSan: false, matFile: true, loi: '' });
      mat++;
    }
    if (mat || chep) this.log('warning', `🎞 ${mat ? `${mat} cảnh "Đã có" nhưng file không còn trong ${d.thuMuc} → tải lại` : ''}${mat && chep ? ' · ' : ''}${chep ? `${chep} cảnh chép từ thư mục lưu cũ` : ''}`);
    const lam = d.canh.filter((x) => x.trangThai === 'cho' || x.trangThai === 'loi' || x.trangThai === 'tim' || x.trangThai === 'tai');
    this.log('info', `🎞 Bắt đầu tải footage "${d.ten}": ${lam.length} cảnh → ${d.thuMuc}`);
    try {
      for (const x of lam) {
        if (this.dung) break;
        const tep = path.join(d.thuMuc, tenFootage(this.caiDat.mauTen, x));
        if (this.caiDat.boQuaDaCo && fs.existsSync(tep) && !x.clip) {
          x.trangThai = 'xong'; x.tepRa = tep; x.loi = ''; x.coSan = true; boQua++; this.luu(d); continue;
        }
        if (x.matFile && x.clip && x.clip.url) {   // 1.6.4: file mất → tải lại đúng clip đã chọn, không tìm lại
          try {
            x.ungVien = [{ ...x.clip, tep: { url: x.clip.url, w: x.clip.w, h: x.clip.h } }]; x.viTri = 0;
            await this.taiClip(d, x);
            delete x.matFile; xong++;
            continue;
          } catch (_) { /* clip không còn trên trang → tìm lại như thường */ }
        }
        delete x.matFile;
        x.trangThai = 'tim'; x.loi = ''; this.luu(d);
        try {
          const { ds, loi } = await this.timUngVien(x, this.daDungTru(d, x));
          if (this.dung) { x.trangThai = 'cho'; break; }
          if (!ds.length) throw new Error(`không có clip khớp từ khoá (ngang, ≥ ${Math.round(x.giay * 0.8)} giây${x.tranh.length ? `, không có: ${x.tranh.join(', ')}` : ''}${this.caiDat.boHienDai ? ', không đồ vật hiện đại' : ''})${loi.length ? ` — ${loi[loi.length - 1]}` : ''} — sửa từ khoá hoặc để cảnh dùng ảnh AI`);
          x.ungVien = ds.slice(0, GIU_UNG_VIEN); x.viTri = 0;   // giữ ít ứng viên cho du-lieu.json gọn
          await this.taiClip(d, x);
          xong++;
        } catch (e) {
          x.trangThai = 'loi'; x.loi = this.anKhoa(e.message); hong++;
          this.log('warning', `🎞 Cảnh ${x.canh}: ${x.loi}`);
          this.luu(d);
        }
      }
    } finally {
      for (const x of d.canh) if (x.trangThai === 'tim' || x.trangThai === 'tai') x.trangThai = x.clip ? 'xong' : 'cho';
      this.dangChay = false;
      this.luotXong++;
      this.luu(d);
    }
    this.log(hong ? 'warning' : 'success', `🎞 Footage "${d.ten}": tải ${xong} cảnh${boQua ? ` · ${boQua} cảnh đã có file` : ''}${hong ? ` · ${hong} cảnh lỗi` : ''}${this.dung ? ' · đã dừng' : ''}`);
    return { ok: true, xong, hong, boQua };
  }

  dungLai() { this.dung = true; this.bao(); return { ok: true }; }

  /** Đổi sang clip kế tiếp của cảnh (hết ứng viên thì tìm thêm). */
  async doi(so) {
    const d = this.ds;
    const x = d && d.canh.find((y) => y.so === +so);
    if (!x) return { ok: false, loi: 'Không thấy cảnh' };
    if (this.dangChay) return { ok: false, loi: 'Đang tải cả danh sách — chờ xong hoặc bấm Dừng' };
    this.dangChay = true; this.dung = false;
    try {
      const daDung = this.daDungTru(d, x);
      if (x.clip) daDung.add(x.clip.id);
      let ds = (x.ungVien || []).slice(x.viTri + 1).filter((c) => !daDung.has(c.id));
      if (!ds.length) {
        for (const c of x.ungVien || []) daDung.add(c.id);
        ds = (await this.timUngVien(x, daDung)).ds;
        // Tìm lại có thể trả clip đã thấy (bộ nhớ 24 giờ) → lấy thêm trang sau không có; báo hết lựa chọn.
      }
      if (!ds.length) { x.loi = 'Hết clip khác cho từ khoá này — sửa từ khoá trong file rồi mở lại'; this.luu(d); return { ok: false, loi: x.loi }; }
      const truoc = (x.ungVien || []).slice(0, x.viTri + 1);
      x.ungVien = [...truoc, ...ds.slice(0, GIU_UNG_VIEN)];
      x.viTri = truoc.length;
      if (x.trangThai === 'bo') this.traLai(d, x);
      await this.taiClip(d, x);
      return { ok: true, clip: x.clip };
    } catch (e) {
      x.trangThai = x.clip ? 'xong' : 'loi'; x.loi = this.anKhoa(e.message); this.luu(d);
      return { ok: false, loi: x.loi };
    } finally { this.dangChay = false; this.bao(); }
  }

  /**
   * 1.6.2 "Tìm lại tất cả": clip do app tải (không đụng file bạn tự đặt vào thư mục) chuyển vào _bo, cảnh về Chờ,
   * rồi tải lại theo cách chấm khớp mới. Cảnh đã Bỏ giữ nguyên.
   */
  timLai() {
    const d = this.ds;
    if (!d) return { ok: false, loi: 'Chưa mở danh sách footage' };
    if (this.dangChay) return { ok: false, loi: 'Đang tải — bấm Dừng trước' };
    let so = 0;
    for (const x of d.canh) {
      if (x.trangThai === 'bo' || x.coSan) continue;
      if (x.tepRa && x.clip && fs.existsSync(x.tepRa)) {
        const dich = path.join(path.dirname(x.tepRa), '_bo', path.basename(x.tepRa));
        fs.mkdirSync(path.dirname(dich), { recursive: true });
        try { fs.rmSync(dich, { force: true }); } catch (_) {}
        fs.renameSync(x.tepRa, dich);
      }
      Object.assign(x, { trangThai: 'cho', clip: null, ungVien: null, viTri: -1, loi: '', tepRa: '' });
      so++;
    }
    this.ghiNguon(d);
    this.luu(d);
    this.log('info', `🎞 Tìm lại footage "${d.ten}": ${so} cảnh về Chờ (clip cũ chuyển vào _bo)`);
    return { ok: true, so };
  }

  /** Chuyển một file footage vào thư mục con _bo (ghi đè bản cũ trong _bo). true nếu đã chuyển. */
  chuyenBo(tep) {
    if (!tep || !fs.existsSync(tep)) return false;
    const dich = path.join(path.dirname(tep), '_bo', path.basename(tep));
    fs.mkdirSync(path.dirname(dich), { recursive: true });
    try { fs.rmSync(dich, { force: true }); } catch (_) {}
    fs.renameSync(tep, dich);
    return true;
  }

  /** Bỏ footage của cảnh: chuyển file sang thư mục con _bo (CapCut chỉ đọc file nằm ngay trong Videos/). */
  bo(so) {
    const d = this.ds;
    const x = d && d.canh.find((y) => y.so === +so);
    if (!x) return { ok: false, loi: 'Không thấy cảnh' };
    if (x.tepRa && fs.existsSync(x.tepRa)) {
      const dich = path.join(path.dirname(x.tepRa), '_bo', path.basename(x.tepRa));
      fs.mkdirSync(path.dirname(dich), { recursive: true });
      try { fs.rmSync(dich, { force: true }); } catch (_) {}
      fs.renameSync(x.tepRa, dich);
    }
    x.trangThai = 'bo';
    this.ghiNguon(d);
    this.luu(d);
    this.log('info', `🎞 Bỏ footage cảnh ${x.canh} (file chuyển vào _bo) — cảnh này dùng lại ảnh / video AI`);
    return { ok: true };
  }

  /** Lấy lại footage đã bỏ (đưa file từ _bo về). */
  traLai(d, x) {
    const tu = x.tepRa && path.join(path.dirname(x.tepRa), '_bo', path.basename(x.tepRa));
    if (tu && fs.existsSync(tu)) { try { fs.renameSync(tu, x.tepRa); } catch (_) {} }
    x.trangThai = x.clip ? 'xong' : 'cho';
  }
  layLai(so) {
    const d = this.ds;
    const x = d && d.canh.find((y) => y.so === +so);
    if (!x || x.trangThai !== 'bo') return { ok: false, loi: 'Cảnh này không ở trạng thái Bỏ' };
    this.traLai(d, x);
    this.ghiNguon(d);
    this.luu(d);
    return { ok: true };
  }
}

module.exports = { QuanLyFootage, doKhop, tachTu, cauTim, TU_HIEN_DAI, docHang, docFileFootage, chuanPexels, chuanPixabay, xepUngVien, chonTep, coChuTranh, tenFootage, chuoiSo, tenDanhSach, FOOTAGE_MAC_DINH };
