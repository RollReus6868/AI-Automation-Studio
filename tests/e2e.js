'use strict';
// node tests/e2e.js        — dựng máy chủ Muse giả rồi chạy APP THẬT (electron .) trên nó.
//                             Kịch bản: tests/e2e-chay.js (chạy bên trong app qua MUSE_TEST).
// node tests/e2e.js flow   — cùng máy chủ đó, thêm trang Google Flow giả (/fx/…) và engine Flow giả
//                             (tests/flow-gia/); kịch bản: tests/flow-e2e-chay.js (Flow + nối Flow ⇄ Muse).
// node tests/e2e.js suno   — thêm trang Suno Create giả (/suno/create, tests/fixture-suno.html);
//                             kịch bản: tests/suno-e2e-chay.js (tạo nhạc, chọn bài dài hơn, hết lượt → tài khoản phụ).
// node tests/e2e.js drive  — 1.4.0: thêm trang Google Drive giả (/drive/…, tests/fixture-drive.html); kịch bản:
//                             tests/drive-e2e-chay.js (ảnh / video xong → tải thẳng lên Drive: thư mục dự án, images, Videos).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const FLOW = process.argv[2] === 'flow';
const SUNO = process.argv[2] === 'suno';
const DRIVE = process.argv[2] === 'drive';
const fixture = fs.readFileSync(path.join(__dirname, 'fixture-muse.html'));
const trangFlow = fs.readFileSync(path.join(__dirname, 'flow-gia', 'trang-flow.html'));
const trangSuno = fs.readFileSync(path.join(__dirname, 'fixture-suno.html'));
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
// Suno giả: bài lưu theo tài khoản; mỗi lần Create 4 bài (2 đủ dài, 2 bản nghe thử — bài 3 dài 4:00 làm mồi).
const suno = { clips: {}, gui: [], tai: [], dinhDang: [], hetTai: [], hetTao: [], lan: 0, treoKiem: 0, treoDs: 0, hongTai: 0, moKhoa: '', daMo: [], tatMs: 0, chuanBiMs: 0, choTaoLai: [] };
function sunoApi(req, res) {
  const json = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
  const body = (fn) => { let b = ''; req.setEncoding('utf8'); req.on('data', (d) => { b += d; }); req.on('end', () => { let o = {}; try { o = JSON.parse(b); } catch (_) {} fn(o); }); };
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__suno-ds') {
    const tra = () => {
      const now = Date.now();
      json({ hetTai: suno.hetTai, hetTao: suno.hetTao, moKhoa: suno.moKhoa, daMo: suno.daMo, tatMs: suno.tatMs, chuanBiMs: suno.chuanBiMs, choTaoLai: suno.choTaoLai, clips: (suno.clips[u.searchParams.get('tk')] || []).map((c) =>
        ({ ...c, trangThai: now - c.tao > 2500 ? 'complete' : now - c.tao > 800 ? 'streaming' : 'submitted' })) });
    };
    // Lần nạp đầu của trang chậm (treoDs ms): danh sách bài hiện SAU form như Suno thật.
    return u.searchParams.get('dau') && suno.treoDs ? setTimeout(tra, suno.treoDs) : tra();
  }
  if (u.pathname === '/__suno-hong') { const hong = suno.hongTai > 0; if (hong) suno.hongTai--; return json({ hong }); }
  { const mk = u.pathname.match(/^\/__suno-mo-khoa\/([^/]+)$/); if (mk) { suno.daMo.push(mk[1]); return json({ ok: true }); } }
  if (u.pathname === '/__suno-tao') {
    return body((o) => {
      suno.gui.push({ ...o, luc: Date.now() });
      if (!o.tk || suno.hetTao.includes(o.tk)) return json({ loi: 'het-credit' });
      const n = ++suno.lan;
      // Lần lẻ: bài 2 dài hơn; lần chẵn: bài 1 dài hơn.
      const dai = n % 2 ? [125, 161] : [200, 150];
      const moi = [dai[0], dai[1], 240, 60].map((giay, i) => ({ id: `s${n}-${i + 1}-${o.tk}`, ten: `Bai ${n}.${i + 1}`, giay, thu: i >= 2, tao: Date.now() }));
      suno.clips[o.tk] = [...moi, ...(suno.clips[o.tk] || [])];
      json({ ok: true });
    });
  }
  if (u.pathname === '/__suno-cau-hinh') return body((o) => { if (o.hetTai) suno.hetTai = o.hetTai; if (o.hetTao) suno.hetTao = o.hetTao; if ('treoKiem' in o) suno.treoKiem = +o.treoKiem || 0; for (const k of ['treoDs', 'hongTai', 'tatMs', 'chuanBiMs']) if (k in o) suno[k] = +o[k] || 0; if ('moKhoa' in o) suno.moKhoa = o.moKhoa; if (o.choTaoLai) suno.choTaoLai = o.choTaoLai; json({ ok: true }); });
  if (u.pathname === '/__suno-gui') return json({ gui: suno.gui, tai: suno.tai, dinhDang: suno.dinhDang, clips: suno.clips });
  const m = u.pathname.match(/^\/__suno-mp3\/([^/]+)$/);
  if (m) {
    const c = Object.values(suno.clips).flat().find((x) => x.id === m[1]);
    const dd = (u.searchParams.get('dd') || 'MP3').toUpperCase();
    const duoi = { MP3: 'mp3', M4A: 'm4a', WAV: 'wav' }[dd] || 'mp4';
    suno.tai.push(m[1]); suno.dinhDang.push(dd);
    if (!suno.daMo.includes(m[1])) suno.daMo.push(m[1]);   // Unlock & Download = mở khoá luôn
    res.setHeader('content-type', duoi === 'mp3' ? 'audio/mpeg' : 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${(c ? c.ten : 'bai').replace(/\s+/g, '_')}.${duoi}"`);
    return res.end(`ID3-gia:${m[1]}:${c ? c.giay : 0}`);
  }
  json({ loi: 'khong-co' });
}
const sv = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/__flow-ghi') {
    let b = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { b += d; });
    req.on('end', () => { try { flowGhi.push({ ...JSON.parse(b), luc: Date.now() }); } catch (_) {} res.end('ok'); });
    return;
  }
  if (req.url === '/__flow-ghi') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(flowGhi)); return; }
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
  if (req.url.startsWith('/__suno-')) { sunoApi(req, res); return; }
  if (req.url.startsWith('/__drive-')) { driveApi(req, res); return; }
  if (req.url.startsWith('/drive/')) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const id = (req.url.match(/^\/drive\/folders\/([^/?#]+)/) || [])[1];
    if (drive.canDangNhap) return res.end('<!doctype html><meta charset="utf-8"><title>Google Drive</title><h1>Google Drive</h1><a href="#">Đăng nhập</a>');
    if (id && !drive.thuMuc[id]) return res.end('<!doctype html><meta charset="utf-8"><title>Google Drive</title><p>Rất tiếc, không tìm thấy tệp. Bạn cần có quyền truy cập.</p>');
    return res.end(trangDrive);
  }
  if (req.url.startsWith('/suno/')) {
    // treoKiem: trang Suno nạp chậm (bài kiểm khung đăng nhập không được chờ bước kiểm tài khoản).
    setTimeout(() => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(trangSuno); }, suno.treoKiem);
    return;
  }
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
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), FLOW ? 'flow-e2e-' : SUNO ? 'suno-e2e-' : DRIVE ? 'drive-e2e-' : 'muse-e2e-'));
  const electron = require('electron');
  const args = ['.'];
  if (process.platform === 'linux') args.push('--no-sandbox');
  const p = spawn(electron, args, {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MUSE_URL: url, MUSE_TEST: FLOW ? 'tests/flow-e2e-chay.js' : SUNO ? 'tests/suno-e2e-chay.js' : DRIVE ? 'tests/drive-e2e-chay.js' : 'tests/e2e-chay.js', DRIVE_URL: url, SUNO_URL: `${url}/suno/create`, MUSE_DATA_DIR: path.join(tam, 'data'),
      MUSE_E2E_TAM: tam, MUSE_NO_UPDATE_CHECK: '1', MUSE_CHO_KET_NOI_MS: '4000',
      ...(FLOW ? { FLOW_TEST_URL: `${url}/fx/vi/tools/flow`, FLOW_TEST_HOST: '^http://127\\.0\\.0\\.1:\\d+/fx/',
        FLOW_TEST_NGUON: 'tests/flow-gia/nguon.js', FLOW_CHO_SAN_SANG_MS: '30000', FLOW_CHO_TAI_MS: '20000' } : {}) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let raChu = '';
  p.stdout.on('data', (d) => { raChu += d; process.stdout.write(d); });
  p.stderr.on('data', (d) => { const s = String(d); if (!/dbus|bus\.cc|viz_main|command_buffer|Fontconfig|gpu/i.test(s)) process.stderr.write(s); });
  const hen = setTimeout(() => { console.log('E2E: QUÁ GIỜ (720s)'); p.kill('SIGKILL'); }, 720000);
  p.on('exit', (code) => {
    clearTimeout(hen);
    sv.close();
    console.log(code === 0 ? 'E2E: PASS' : `E2E: FAIL (mã ${code})`);
    if (code !== 0 && process.env.GITHUB_ACTIONS) {
      // Log của job không tải được từ phiên Claude → đưa các dòng đáng chú ý lên thành annotation.
      const quanTrong = raChu.split('\n').filter((l) => /✘|⏱|kẹt|LỖI|KẾT QUẢ|^--/.test(l)).join('\n').slice(-5000);
      const esc = (x) => x.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.log(`::error title=E2E ${FLOW ? 'Flow ' : SUNO ? 'Suno ' : DRIVE ? 'Drive ' : ''}${process.platform}::${esc(quanTrong || raChu.slice(-5000))}`);
    }
    process.exit(code === 0 ? 0 : 1);
  });
});
