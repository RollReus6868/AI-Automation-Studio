'use strict';
// node tests/e2e.js        — dựng máy chủ Muse giả rồi chạy APP THẬT (electron .) trên nó.
//                             Kịch bản: tests/e2e-chay.js (chạy bên trong app qua MUSE_TEST).
// node tests/e2e.js flow   — cùng máy chủ đó, thêm trang Google Flow giả (/fx/…) và engine Flow giả
//                             (tests/flow-gia/); kịch bản: tests/flow-e2e-chay.js (Flow + nối Flow ⇄ Muse).
// node tests/e2e.js nhac   — 1.5.0: thêm trang Google Flow Music giả (/fmusic/, tests/fixture-flowmusic.html);
//                             kịch bản: tests/nhac-e2e-chay.js (tạo nhạc, bài dài hơn, hết credit → tài khoản phụ).
// node tests/e2e.js drive  — 1.4.0: thêm trang Google Drive giả (/drive/…, tests/fixture-drive.html); kịch bản:
//                             tests/drive-e2e-chay.js (ảnh / video xong → tải thẳng lên Drive: thư mục dự án, images, Videos).
// node tests/e2e.js quet   — 1.4.2: trang Muse giả; kịch bản tests/quet-e2e-chay.js (quét thư mục, chỉ làm số còn thiếu).
// node tests/e2e.js theodoi — 1.4.9: trang Muse giả; kịch bản tests/theo-doi-e2e-chay.js (theo dõi thư mục ảnh → video mới).
// node tests/e2e.js kiemdo  — 1.4.12: trang Muse giả; kịch bản tests/kiem-do-e2e-chay.js (việc Muse dở: kiểm chat cũ, hết lượt video).
// node tests/e2e.js dondep — 1.4.12: trang Muse giả; kịch bản tests/don-dep-e2e-chay.js (dọn dữ liệu thừa, giữ đăng nhập).
// node tests/e2e.js footage — 1.6.0: API Pexels / Pixabay giả (/pexels/…, /pixabay/…); kịch bản tests/footage-e2e-chay.js
//                             (mở _footage.xlsx, tải footage qua giao diện, Đổi clip, Bỏ, hết lượt Pexels → Pixabay).
// node tests/e2e.js motion  — 1.7.0: video motion graphic theo cảnh, Remotion THẬT ở tiến trình con; kịch bản tests/motion-e2e-chay.js
//                             (cài đặt, mở _motion.xlsx, Tạo video, video AI cũ vào _bo, Bỏ / Lấy lại / Tạo lại, Dừng giữa chừng).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const FLOW = process.argv[2] === 'flow';
const NHAC = process.argv[2] === 'nhac';
const DRIVE = process.argv[2] === 'drive';
const QUET = process.argv[2] === 'quet';
const THEODOI = process.argv[2] === 'theodoi';
const KIEMDO = process.argv[2] === 'kiemdo';   // 1.4.12
const DONDEP = process.argv[2] === 'dondep';
const FOOTAGE = process.argv[2] === 'footage';   // 1.6.0
const MOTION = process.argv[2] === 'motion';     // 1.7.0
const fixture = fs.readFileSync(path.join(__dirname, 'fixture-muse.html'));
const trangFlow = fs.readFileSync(path.join(__dirname, 'flow-gia', 'trang-flow.html'));
const trangNhac = fs.readFileSync(path.join(__dirname, 'fixture-flowmusic.html'));
const trangDrive = fs.readFileSync(path.join(__dirname, 'fixture-drive.html'));
// Drive giả: thư mục + tệp (theo mã thư mục cha, 'root' = Drive của tôi).
const drive = { thuMuc: {}, tep: [], n: 0, canDangNhap: false, taoThuMuc: [], tai: [] };
function driveApi(req, res) {
  const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  const body = (fn) => { let b = ''; req.setEncoding('utf8'); req.on('data', (d) => { b += d; }); req.on('end', () => { let o = {}; try { o = JSON.parse(b); } catch (_) {} fn(o); }); };
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__drive-ds') {
    const cha = u.searchParams.get('cha');
    return json({ ten: cha === 'root' ? 'Drive của tôi' : (drive.thuMuc[cha] || {}).ten,
      muc: [...Object.entries(drive.thuMuc).filter(([, f]) => f.cha === cha).map(([id, f]) => ({ id, ten: f.ten, laThuMuc: true })),
        ...drive.tep.filter((t) => t.cha === cha).map((t) => ({ id: t.id, ten: t.ten, laThuMuc: false }))] });
  }
  if (u.pathname === '/__drive-thu-muc') return body((o) => { const id = `f${++drive.n}`; drive.thuMuc[id] = { ten: o.ten, cha: o.cha }; drive.taoThuMuc.push(o); json({ ok: true, id }); });
  if (u.pathname === '/__drive-tai') {
    return body((o) => {
      drive.tai.push({ cha: o.cha, ten: o.ten, cach: o.cach, qua: o.qua });
      const cu = drive.tep.find((t) => t.cha === o.cha && t.ten === o.ten);
      if (o.cach === 'thay' && cu) cu.b64 = o.b64;
      else drive.tep.push({ id: `t${++drive.n}`, cha: o.cha, ten: o.ten, b64: o.b64 });
      json({ ok: true });
    });
  }
  if (u.pathname === '/__drive-trang-thai') return json(drive);
  if (u.pathname === '/__drive-cau-hinh') {
    return body((o) => {
      if ('canDangNhap' in o) drive.canDangNhap = !!o.canDangNhap;
      if (o.xoaThuMuc) { delete drive.thuMuc[o.xoaThuMuc]; drive.tep = drive.tep.filter((t) => t.cha !== o.xoaThuMuc); }
      json({ ok: true });
    });
  }
  json({ loi: 'khong-co' });
}
const daGui = [];
const flowGhi = [];   // mọi thứ engine Flow giả nhận được (mẻ, kho ảnh, chế độ…)
let duAnFlow = ['gia-khac'];
// 1.5.0 — Flow Music giả: mỗi lần gửi ra 2 bài sau taoMs; hết credit / chỉ trả lời chữ / thiếu MP3 theo cấu hình.
const fm = { phien: {}, n: 0, gui: [], tai: [], hetCredit: [], chiChu: 0, hongTai: 0, taoMs: 2500, hoiWav: 0 };
const GIAY_FM = [[149, 178], [200, 161]];   // bài dài hơn: lần lẻ là bài thứ 2, lần chẵn là bài thứ 1
function wavGia(giay) {
  const hz = 8000, n = Math.round(giay * hz), b = Buffer.alloc(44 + n, 128);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(hz, 24); b.writeUInt32LE(hz, 28); b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  return b;
}
const timClip = (id) => Object.values(fm.phien).flatMap((p) => p.tin.flatMap((t) => t.clips || [])).find((c) => c.id === id);
function fmApi(req, res) {
  const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  const body = (fn) => { let b = ''; req.setEncoding('utf8'); req.on('data', (d) => { b += d; }); req.on('end', () => { let o = {}; try { o = JSON.parse(b); } catch (_) {} fn(o); }); };
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__fm/gui') {
    return body((o) => {
      let p = o.phien && fm.phien[o.phien];
      if (!p) { p = { id: `ph${++fm.n}`, tk: o.tk, tin: [] }; fm.phien[p.id] = p; }
      const lan = fm.gui.length + 1;
      fm.gui.push({ tk: o.tk, prompt: o.prompt, phien: p.id, moi: !o.phien, luc: Date.now() });
      const t = { chu: o.prompt, luc: Date.now() };
      if (fm.hetCredit.includes(o.tk)) t.loai = 'het';
      else if (fm.chiChu > 0) { fm.chiChu--; t.loai = 'chu'; }
      else {
        t.loai = 'nhac';
        const g = GIAY_FM[(lan + 1) % 2];
        t.clips = ['A', 'B'].map((x, k) => ({ id: `${p.id}-${lan}${x}-${o.tk}`, ten: `Bai ${lan}${x}`, giay: g[k] }));
      }
      p.tin.push(t);
      json({ phien: p.id });
    });
  }
  { const m = u.pathname.match(/^\/__fm\/phien\/([^/]+)$/);
    if (m) {
      const p = fm.phien[m[1]];
      if (!p) return json({ tin: [] });
      return json({ tin: p.tin.map((t) => {
        const dt = Date.now() - t.luc;
        if (dt < 1200) return { chu: t.chu, trang: 'nghi' };
        if (t.loai === 'het') return { chu: t.chu, trang: 'chu', traLoi: "Sorry. You're out of credits for today. Upgrade to keep creating." };
        if (t.loai === 'chu') return { chu: t.chu, trang: 'chu', traLoi: 'Which genre and mood do you want for this song?' };
        if (dt < 1200 + fm.taoMs) return { chu: t.chu, trang: 'tao', clips: t.clips.map((c) => ({ ...c, pt: Math.round((dt - 1200) / fm.taoMs * 100) })) };
        return { chu: t.chu, trang: 'xong', clips: t.clips };
      }) });
    } }
  if (u.pathname === '/__fm/menu') { const hong = fm.hongTai > 0; if (hong) fm.hongTai--; return json({ coMp3: !hong }); }
  { const m = u.pathname.match(/^\/__fm\/download\/audio\/([^/]+)$/);
    if (m) {
      const c = timClip(m[1]);
      fm.tai.push({ id: m[1], dd: u.searchParams.get('format') });
      res.setHeader('content-type', 'audio/mpeg');
      return res.end(`ID3-fm:${m[1]}:${c ? c.giay : 0}`);
    } }
  if (u.pathname === '/__fm/cau-hinh') return body((o) => { for (const k of ['chiChu', 'hongTai', 'taoMs']) if (k in o) fm[k] = +o[k] || 0; if (o.hetCredit) fm.hetCredit = o.hetCredit; json({ ok: true }); });
  if (u.pathname === '/__fm/ghi') return json({ gui: fm.gui, tai: fm.tai, hoiWav: fm.hoiWav });
  json({ loi: 'khong-co' });
}
/** PNG một màu w×h (không cần thư viện ảnh). */
function pngDon(w, h, [r, g, b]) {
  const zlib = require('zlib');
  const crcBang = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcBang[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const khoi = (loai, data) => { const d = Buffer.concat([Buffer.from(loai), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(d)); return Buffer.concat([len, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const dong = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { dong[1 + x * 3] = r; dong[2 + x * 3] = g; dong[3 + x * 3] = b; }
  const tho = Buffer.concat(Array.from({ length: h }, () => dong));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), khoi('IHDR', ihdr), khoi('IDAT', zlib.deflateSync(tho)), khoi('IEND', Buffer.alloc(0))]);
}
// 1.6.0 API Pexels / Pixabay giả: trả clip theo từ khoá (đúng hình dạng JSON thật), clip tải về là tests/fixture-video.mp4.
const ft = { goi: [], tai: [], pexels429: false, hongTai: [] };
const videoMau = fs.readFileSync(path.join(__dirname, 'fixture-video.mp4'));
const ANH_NHO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==';
function footageApi(req, res, goc) {
  const json = (o, st = 200, hdr = {}) => { res.writeHead(st, { 'content-type': 'application/json', ...hdr }); res.end(JSON.stringify(o)); };
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__ft/ghi') return json(ft);
  // 1.6.6 trang stock giả cho Tải tay: chỉ có link Download — người dùng (bài kiểm giả lập) tự bấm.
  if (u.pathname === '/__stock/tim') {
    const q = u.searchParams.get('q') || '', slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    ft.stock = (ft.stock || []).concat([{ q, trang: u.searchParams.get('trang') }]);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Stock giả</title><h1 id="q">${q.replace(/</g, '')}</h1><a id="tai" download="stock-${slug}.mp4" href="/__ft/clip/tay-${slug}.mp4">Download</a> <a id="anh" download="anh.jpg" href="/__ft/anh.jpg">Ảnh</a>`);
    return;
  }
  if (u.pathname === '/__ft/anh.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end(Buffer.alloc(3000, 7)); return; }
  if (u.pathname === '/__ft/cau-hinh') { let b = ''; req.setEncoding('utf8'); req.on('data', (d) => { b += d; }); req.on('end', () => { try { Object.assign(ft, JSON.parse(b)); } catch (_) {} json({ ok: true }); }); return; }
  const clip = u.pathname.match(/^\/__ft\/clip\/([\w-]+)\.mp4$/);
  if (clip) { ft.tai.push(clip[1]); if (ft.hongTai.includes(clip[1])) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': 'video/mp4' }); res.end(videoMau); return; }
  if (u.pathname === '/pexels/v1/videos/search') {
    ft.goi.push({ nguon: 'pexels', q: u.searchParams.get('query'), auth: req.headers.authorization || '' });
    if (req.headers.authorization !== 'KHOA-PEXELS-E2E') return json({ error: 'sai khoa' }, 401);
    if (ft.pexels429) return json({ error: 'het luot' }, 429, { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800) });
    const q = u.searchParams.get('query') || '';
    const vid = (id, giay, slug) => ({ id, width: 1920, height: 1080, duration: giay, url: `https://www.pexels.com/video/${slug}-${id}/`, image: ANH_NHO,
      user: { name: `Pexels ${id}`, url: `https://www.pexels.com/@p${id}` },
      video_files: [{ file_type: 'video/mp4', width: 1280, height: 720, link: `${goc}/__ft/clip/px${id}-720.mp4` },
        { file_type: 'video/mp4', width: 1920, height: 1080, link: `${goc}/__ft/clip/px${id}-1080.mp4` },
        { file_type: 'video/mp4', width: 1080, height: 1920, link: `${goc}/__ft/clip/px${id}-doc.mp4` }] });
    const ds = /desert|sand/.test(q) ? [vid(101, 9, 'desert-dunes'), vid(102, 8, 'people-crowd-desert'), vid(103, 11, 'sand-dunes-sunrise')]
      : /cave/.test(q) ? [vid(101, 9, 'desert-dunes'), vid(301, 10, 'cave-entrance')]
        : /olive/.test(q) ? [vid(401, 7, 'olive-tree')] : [];
    return json({ page: 1, per_page: 40, total_results: ds.length, videos: ds }, 200, { 'x-ratelimit-remaining': '199' });
  }
  if (u.pathname === '/pixabay/api/videos/') {
    ft.goi.push({ nguon: 'pixabay', q: u.searchParams.get('q'), key: u.searchParams.get('key') });
    if (u.searchParams.get('key') !== 'KHOA-PIXABAY-E2E') return json({ error: 'sai khoa' }, 400);
    const q = u.searchParams.get('q') || '';
    const hit = (id, giay, tags) => ({ id, pageURL: `https://pixabay.com/videos/${tags.split(',')[0]}-${id}/`, tags, duration: giay, user: `pixa${id}`, user_id: id,
      videos: { large: { url: `${goc}/__ft/clip/pb${id}-l.mp4`, width: 1920, height: 1080, thumbnail: ANH_NHO }, medium: { url: `${goc}/__ft/clip/pb${id}-m.mp4`, width: 1280, height: 720 } } });
    const ds = /night|stars/.test(q) ? [hit(201, 12, 'night, sky, stars')] : /desert|sand/.test(q) ? [hit(501, 10, 'desert, dunes, sand'), hit(502, 9, 'city, desert, dunes, sand'), hit(503, 9, 'meal, pan, close up, sand')] : [];
    return json({ total: ds.length, totalHits: ds.length, hits: ds });
  }
  json({ loi: 'khong-co' }, 404);
}
const sv = http.createServer((req, res) => {
  if (/^\/(pexels|pixabay|__ft|__stock)\//.test(req.url)) { footageApi(req, res, `http://127.0.0.1:${sv.address().port}`); return; }
  if (req.method === 'POST' && req.url === '/__flow-ghi') {
    let b = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { b += d; });
    req.on('end', () => { try { flowGhi.push({ ...JSON.parse(b), luc: Date.now() }); } catch (_) {} res.end('ok'); });
    return;
  }
  if (req.url === '/__flow-ghi') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(flowGhi)); return; }
  // Engine Flow giả với cookie flow_tai_cham (chỉ để tái hiện): đầu trả lời gửi ngay, thân file giữ ?ms= mới xong.
  if (req.url.startsWith('/__flow-tai-cham')) {
    const u = new URL(req.url, 'http://x');
    const video = u.searchParams.get('video') === '1';
    const than = video ? Buffer.from(new Uint8Array(3000).map((_, i) => i % 251))
      : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');
    res.writeHead(200, { 'content-type': video ? 'video/mp4' : 'image/png', 'content-length': than.length,
      'content-disposition': `attachment; filename="flow_goc.${video ? 'mp4' : 'png'}"` });
    res.write(than.subarray(0, 1));
    setTimeout(() => res.end(than.subarray(1)), Math.min(60000, Number(u.searchParams.get('ms')) || 0));
    return;
  }
  // Danh sách dự án Flow giả (trang chủ Flow đọc / thêm / xoá). "gia-khac" là dự án của người dùng — không được bị xoá.
  if (req.url === '/__flow-du-an' || req.url === '/__flow-xoa-du-an') {
    if (req.method !== 'POST') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(duAnFlow)); return; }
    let b = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { b += d; });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(b);
        if (req.url === '/__flow-du-an') { if (!duAnFlow.includes(id)) duAnFlow.unshift(id); }
        else duAnFlow = duAnFlow.filter((x) => x !== id);
      } catch (_) {}
      res.end('ok');
    });
    return;
  }
  if (req.url.startsWith('/__fm/')) { fmApi(req, res); return; }
  if (req.url.startsWith('/__drive-')) { driveApi(req, res); return; }
  if (req.url.startsWith('/drive/')) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const id = (req.url.match(/^\/drive\/folders\/([^/?#]+)/) || [])[1];
    if (drive.canDangNhap) return res.end('<!doctype html><meta charset="utf-8"><title>Google Drive</title><h1>Google Drive</h1><a href="#">Đăng nhập</a>');
    if (id && !drive.thuMuc[id]) return res.end('<!doctype html><meta charset="utf-8"><title>Google Drive</title><p>Rất tiếc, không tìm thấy tệp. Bạn cần có quyền truy cập.</p>');
    return res.end(trangDrive);
  }
  { const m = req.url.match(/^\/fmusic\/clips\/([^/?]+)\.m4a/);
    if (m) { fm.hoiWav++; const c = timClip(decodeURIComponent(m[1])); res.setHeader('content-type', 'audio/wav'); res.end(wavGia(c ? c.giay : 1)); return; } }
  if (req.url.startsWith('/fmusic/')) { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(trangNhac); return; }
  // 1.3.2: dự án Flow đã bị xoá bên Flow → Flow chuyển sang trang 404?reason=project (nhật ký người dùng 18/10/2026).
  if (req.url.startsWith('/fx/') && /\/project\/da-xoa/.test(req.url)) { res.writeHead(302, { location: '/fx/vi/tools/flow/404?reason=project' }); res.end(); return; }
  // Trang 404 thật chỉ có "Skip to main content" và "arrow_back Quay lại dự án" — KHÔNG có nút "+ Dự án mới".
  if (/^\/fx\/[^?]*\/404(\?|$)/.test(req.url)) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><title>Flow</title><a href="#main">Skip to main content</a><main id="main"><h1>404</h1><button type="button">arrow_back Quay lại dự án</button></main>');
    return;
  }
  if (req.url.startsWith('/fx/')) { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(trangFlow); return; }
  if (req.url.startsWith('/signin/')) { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<!doctype html><title>Đăng nhập Google giả</title><input type=email>'); return; }
  // 1.5.4: ảnh gốc của nút tải ↓ trong trình xem ảnh Muse giả (muse_that=1) — PNG w×h thật, tải dạng đính kèm.
  if (req.url.startsWith('/__anh-goc')) {
    const u = new URL(req.url, 'http://x');
    const w = +u.searchParams.get('w') || 64, h = +u.searchParams.get('h') || 64, mau = +u.searchParams.get('k') ? [85, 170, 153] : [204, 136, 170];
    const than = pngDon(w, h, mau);
    res.writeHead(200, { 'content-type': 'image/png', 'content-length': than.length, 'content-disposition': `attachment; filename="muse_goc_${w}x${h}.png"` });
    res.end(than);
    return;
  }
  if (req.method === 'POST' && req.url === '/__gui') {
    let b = '';
    // Giải mã UTF-8 theo luồng: cộng thẳng Buffer làm vỡ ký tự tiếng Việt nằm vắt qua hai gói mạng
    // (macOS chia gói khác Linux → prompt dài bị đổi vài ký tự, chỉ đỏ trên CI Mac).
    req.setEncoding('utf8');
    req.on('data', (d) => { b += d; });
    req.on('end', () => { try { daGui.push({ ...JSON.parse(b), luc: Date.now() }); } catch (_) {} res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/__xoa') {
    let b = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { b += d; });
    req.on('end', () => { try { const t = JSON.parse(b).thread; for (const g of daGui) if (g.thread === t) g.xoa = true; } catch (_) {} res.end('ok'); });
    return;
  }
  const m = req.url.match(/^\/__thread\/([^/?]+)/);
  if (m) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(daGui.find((g) => g.thread === m[1] && !g.xoa) || null)); return; }
  if (req.url === '/__ds-thread') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(daGui.filter((g) => !g.xoa).reverse().map((g) => ({ thread: g.thread, tieuDe: String(g.prompt).slice(0, 30).replace(/[<&"]/g, '') }))));
    return;
  }
  if (req.url === '/__da-gui') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(daGui)); return; }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(fixture);
});

sv.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${sv.address().port}`;
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), FLOW ? 'flow-e2e-' : NHAC ? 'nhac-e2e-' : DRIVE ? 'drive-e2e-' : QUET ? 'quet-e2e-' : THEODOI ? 'theodoi-e2e-' : KIEMDO ? 'kiemdo-e2e-' : DONDEP ? 'dondep-e2e-' : FOOTAGE ? 'footage-e2e-' : MOTION ? 'motion-e2e-' : 'muse-e2e-'));
  const electron = require('electron');
  // 1.7.0: E2E_EXE=<app đã đóng gói> → chạy bản cài (app.asar) thay cho mã nguồn; MUSE_TEST vẫn lấy từ thư mục repo
  const exe = process.env.E2E_EXE ? path.resolve(__dirname, '..', process.env.E2E_EXE) : '';
  const args = exe ? [] : ['.'];
  if (process.platform === 'linux') args.push('--no-sandbox');
  const p = spawn(exe || electron, args, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MUSE_URL: url, MUSE_TEST: FLOW ? 'tests/flow-e2e-chay.js' : NHAC ? 'tests/nhac-e2e-chay.js' : DRIVE ? 'tests/drive-e2e-chay.js' : QUET ? 'tests/quet-e2e-chay.js' : THEODOI ? 'tests/theo-doi-e2e-chay.js' : KIEMDO ? 'tests/kiem-do-e2e-chay.js' : DONDEP ? 'tests/don-dep-e2e-chay.js' : FOOTAGE ? 'tests/footage-e2e-chay.js' : MOTION ? 'tests/motion-e2e-chay.js' : 'tests/e2e-chay.js', DRIVE_URL: url, NHAC_URL: `${url}/fmusic/`, MUSE_DATA_DIR: path.join(tam, 'data'),
      MUSE_E2E_TAM: tam, MUSE_NO_UPDATE_CHECK: '1', MUSE_CHO_KET_NOI_MS: '4000', FOOTAGE_PEXELS_URL: `${url}/pexels`, FOOTAGE_PIXABAY_URL: `${url}/pixabay`,
      FOOTAGE_TAY_URL: `${url}/__stock/tim?q={q}&trang={trang}`,
      ...(FLOW ? { FLOW_TEST_URL: `${url}/fx/vi/tools/flow`, FLOW_TEST_HOST: '^http://127\\.0\\.0\\.1:\\d+/fx/',
        FLOW_TEST_NGUON: 'tests/flow-gia/nguon.js', FLOW_CHO_SAN_SANG_MS: '30000', FLOW_CHO_TAI_MS: '45000' } : {}) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let raChu = '';
  p.stdout.on('data', (d) => { raChu += d; process.stdout.write(d); });
  p.stderr.on('data', (d) => { const s = String(d); if (!/dbus|bus\.cc|viz_main|command_buffer|Fontconfig|gpu/i.test(s)) process.stderr.write(s); });
  // Hạn cứng chống treo (không phải bài đo tốc độ). Mặc định 720 s; CI đặt E2E_HAN_GIAY riêng từng bước — Muse trên
  // Windows CI đã ~500 s (18–22/10/2026), sát 720 s. Hạn của bước (timeout-minutes) phải dài hơn hạn này.
  const hanGiay = Number(process.env.E2E_HAN_GIAY) || 720;
  const batDau = Date.now();
  const hen = setTimeout(() => { console.log(`E2E: QUÁ GIỜ (${hanGiay}s)`); p.kill('SIGKILL'); }, hanGiay * 1000);
  p.on('exit', (code) => {
    clearTimeout(hen);
    sv.close();
    const giay = Math.round((Date.now() - batDau) / 1000);
    console.log(code === 0 ? `E2E: PASS (${giay} s / hạn ${hanGiay} s)` : `E2E: FAIL (mã ${code}, ${giay} s / hạn ${hanGiay} s)`);
    if (code !== 0) {
      // Đỏ → chép nhật ký bài kiểm + nhật ký app vào shots/ (CI tải lên thành artifact anh-chup-*, kể cả khi đỏ) để truy.
      const kieu = FLOW ? 'flow' : NHAC ? 'nhac' : DRIVE ? 'drive' : QUET ? 'quet' : THEODOI ? 'theodoi' : KIEMDO ? 'kiemdo' : DONDEP ? 'dondep' : FOOTAGE ? 'footage' : MOTION ? 'motion' : 'muse';
      const dich = path.join(__dirname, '..', 'shots', `e2e-${kieu}-${process.platform}`);
      try {
        fs.mkdirSync(dich, { recursive: true });
        fs.writeFileSync(path.join(dich, 'stdout.txt'), raChu);
        for (const [tu, ten] of [[path.join(tam, 'e2e-log.txt'), 'e2e-log.txt'], [path.join(tam, 'data', 'nhat-ky.txt'), 'nhat-ky-app.txt'],
          [path.join(tam, 'data', 'nhat-ky-cu.txt'), 'nhat-ky-app-cu.txt']]) {
          if (fs.existsSync(tu)) fs.copyFileSync(tu, path.join(dich, ten));
        }
        console.log(`Nhật ký bài kiểm + app đã chép vào ${dich}`);
      } catch (err) { console.log(`Không chép được nhật ký: ${err.message}`); }
    }
    if (code !== 0 && process.env.GITHUB_ACTIONS) {
      // Log của job không tải được từ phiên Claude → đưa các dòng đáng chú ý lên thành annotation.
      const quanTrong = raChu.split('\n').filter((l) => /✘|⏱|ⓘ|kẹt|LỖI|KẾT QUẢ|^--/.test(l)).join('\n').slice(-5000);
      const esc = (x) => x.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.log(`::error title=E2E ${FLOW ? 'Flow ' : NHAC ? 'Nhac ' : DRIVE ? 'Drive ' : QUET ? 'Quet ' : THEODOI ? 'TheoDoi ' : KIEMDO ? 'KiemDo ' : DONDEP ? 'DonDep ' : FOOTAGE ? 'Footage ' : MOTION ? 'Motion ' : ''}${process.platform}::${esc(quanTrong || raChu.slice(-5000))}`);
    }
    process.exit(code === 0 ? 0 : 1);
  });
});
