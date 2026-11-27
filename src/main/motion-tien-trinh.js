'use strict';
// ============================================================================
//  motion-tien-trinh.js — 1.7.0: tiến trình con vẽ video motion bằng @remotion/renderer.
//  App mở bằng child_process.fork (Electron chạy như Node: ELECTRON_RUN_AS_NODE), thư mục làm việc =
//  <dữ liệu app>/motion-engine (Remotion tải Chrome Headless Shell vào đó). Nhận { lenh: 'chay', spec } / { lenh: 'dung' },
//  gửi lại sự kiện: browser, download, warn, start, progress, done, fail, error, finished.
//
//  spec = { bundle (thư mục trang mẫu đã đóng gói), binariesDirectory, browser, crf,
//           jobs: [{ comp, props, anh (đường dẫn ảnh nền | ''), out (.mp4 tạm) }] }
//  Ảnh nền phục vụ qua máy chủ http nội bộ 127.0.0.1 (Chrome không đọc được file:// từ trang mẫu).
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const gui = (e) => { try { process.send(e); } catch (_) {} };
const chuLoi = (e) => String((e && (e.message || e.stack)) || e).split('\n').slice(0, 6).join(' | ');
let huy = null;      // hàm huỷ lượt vẽ đang chạy
let dangDung = false;

function trinhDuyetMay() {
  const ds = [];
  if (process.platform === 'win32') {
    for (const g of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      ds.push(path.join(g, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      ds.push(path.join(g, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    ds.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else ds.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  return ds.filter((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } });
}

/**
 * Tải / tìm Chrome Headless Shell của Remotion trong một tiến trình con RIÊNG: ensureBrowser của Remotion xếp mọi lần gọi
 * vào một chuỗi promise dùng chung, tải hỏng một lần là mọi lần vẽ sau trong cùng tiến trình đều báo lại lỗi tải đó
 * (kể cả khi đã đưa Chrome của máy) — tách ra thì tiến trình vẽ không dính lỗi.
 */
function taiHeadlessShell() {
  return new Promise((resolve) => {
    const { fork } = require('child_process');
    const con = fork(__filename, ['ensure'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let kq = null, loiCuoi = '';
    con.stderr.on('data', (d) => { loiCuoi = (loiCuoi + d).slice(-1000); });
    con.on('message', (e) => { if (e && e.event === 'download') gui(e); else if (e && e.event === 'ensure') kq = e; });
    con.on('exit', () => resolve(kq || { loi: loiCuoi.trim().split('\n').pop() || 'tiến trình tải dừng' }));
  });
}

async function chonTrinhDuyet(rieng) {
  if (rieng && fs.existsSync(rieng)) return { path: rieng, kind: 'chosen' };
  if (process.env.MOTION_KHONG_TAI_CHROME !== '1') {
    const r = await taiHeadlessShell();
    if (r.path) return { path: r.path, kind: 'headless-shell' };
    gui({ event: 'warn', text: `Không tải được Chrome Headless Shell của Remotion (${String(r.loi).replace(/\s*If your network[\s\S]*$/, '').slice(0, 240)}) — dùng Chrome / Edge của máy` });
  }
  const may = trinhDuyetMay();
  if (may.length) return { path: may[0], kind: 'system' };
  throw new Error('Không có trình duyệt để vẽ khung hình: không tải được Chrome Headless Shell và máy không có Chrome / Edge');
}

/** Chế độ "ensure" (tiến trình con của tiến trình vẽ): gọi ensureBrowser, báo tiến độ tải, trả đường dẫn. */
async function cheDoEnsure() {
  const { ensureBrowser } = require('@remotion/renderer');
  // lỗi mạng khi tải có thể nổ ra ngoài promise (luồng tải) → bắt lại, báo lỗi thay vì sập im lặng
  let thoat;
  const loiNgoai = new Promise((_, rej) => { thoat = rej; });
  process.on('uncaughtException', (e) => thoat(e));
  process.on('unhandledRejection', (e) => thoat(e));
  try {
    const st = await Promise.race([loiNgoai, ensureBrowser({
      logLevel: 'error',
      onBrowserDownload: () => {
        gui({ event: 'download', p: 0 });
        return { version: null, onProgress: ({ percent }) => gui({ event: 'download', p: percent }) };
      }
    })]);
    gui({ event: 'ensure', path: (st && st.path) || null, loi: st && st.path ? '' : 'không có đường dẫn' });
  } catch (e) {
    gui({ event: 'ensure', path: null, loi: chuLoi(e) });
  }
  setTimeout(() => process.exit(0), 100);
}

const LOAI = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function mayChuAnh() {
  const ma = crypto.randomBytes(8).toString('hex');
  const tep = new Map();
  const sv = http.createServer((req, res) => {
    const m = new RegExp(`^/${ma}/(\\d+)`).exec(req.url || '');
    const f = m && tep.get(m[1]);
    if (!f) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': LOAI[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=3600' });
    fs.createReadStream(f).on('error', () => res.end()).pipe(res);
  });
  return new Promise((r) => sv.listen(0, '127.0.0.1', () => r({
    them: (i, f) => { tep.set(String(i), f); return `http://127.0.0.1:${sv.address().port}/${ma}/${i}${path.extname(f)}`; },
    dong: () => new Promise((x) => sv.close(() => x()))
  })));
}

async function chay(spec) {
  const R = require('@remotion/renderer');
  const b = await chonTrinhDuyet(spec.browser);
  gui({ event: 'browser', ...b });
  const sv = await mayChuAnh();
  // Chrome / Edge thường của máy (bản ≥ 132) đã bỏ chế độ "--headless=old" mà Remotion dùng cho Headless Shell →
  // báo là chrome-for-testing để Remotion mở bằng "--headless=new".
  const chromeMode = b.kind === 'headless-shell' ? 'headless-shell' : 'chrome-for-testing';
  const browserExecutable = b.kind === 'headless-shell' ? null : b.path;
  const trinh = await R.openBrowser('chrome', { browserExecutable, logLevel: 'error', chromeMode });
  let ok = 0;
  try {
    for (let i = 0; i < spec.jobs.length; i++) {
      if (dangDung) break;
      const job = spec.jobs[i];
      const s = Date.now();
      const props = { ...job.props, anh: job.anh && fs.existsSync(job.anh) ? sv.them(i, job.anh) : null };
      gui({ event: 'start', i, n: spec.jobs.length, comp: job.comp });
      try {
        const composition = await R.selectComposition({ serveUrl: spec.bundle, id: job.comp, inputProps: props, puppeteerInstance: trinh,
          logLevel: 'error', binariesDirectory: spec.binariesDirectory || null, browserExecutable, chromeMode });
        const { cancelSignal, cancel } = R.makeCancelSignal();
        huy = cancel;
        await R.renderMedia({
          composition, serveUrl: spec.bundle, inputProps: props, codec: 'h264', crf: spec.crf || 18, pixelFormat: 'yuv420p',
          imageFormat: 'jpeg', jpegQuality: 92, muted: true, outputLocation: job.out, puppeteerInstance: trinh, overwrite: true,
          logLevel: 'error', cancelSignal, binariesDirectory: spec.binariesDirectory || null, concurrency: spec.concurrency || null, browserExecutable, chromeMode,
          onProgress: ({ progress }) => gui({ event: 'progress', i, p: progress })
        });
        huy = null;
        ok++;
        gui({ event: 'done', i, out: job.out, sec: (Date.now() - s) / 1000, frames: composition.durationInFrames });
      } catch (e) {
        huy = null;
        try { fs.rmSync(job.out, { force: true }); } catch (_) {}
        if (dangDung) break;
        gui({ event: 'fail', i, error: chuLoi(e) });
      }
    }
  } finally {
    await trinh.close({ silent: true }).catch(() => {});
    await sv.dong();
  }
  return ok;
}

if (process.argv[2] === 'ensure') cheDoEnsure();

process.on('message', async (m) => {
  if (!m) return;
  if (m.lenh === 'dung') {
    dangDung = true;
    if (huy) try { huy(); } catch (_) {}
    return;
  }
  if (m.lenh !== 'chay') return;
  try {
    const ok = await chay(m.spec);
    gui({ event: 'finished', ok, dung: dangDung });
  } catch (e) {
    gui({ event: 'error', text: chuLoi(e) });
    gui({ event: 'finished', ok: 0, dung: dangDung });
  }
  setTimeout(() => process.exit(0), 200);
});
