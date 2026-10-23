'use strict';
// ============================================================================
//  AI Automation Studio — tiến trình chính (Electron)
//  Gộp Muse Automation Studio + Flow Automation Studio: MỘT hàng đợi chung,
//  hai nền tảng. Cửa sổ giao diện + các luồng chạy ngầm (mỗi luồng một cửa sổ
//  ẩn trong phiên của tài khoản: muse.ai hoặc Google Flow) + đăng nhập + file
//  + cập nhật. Phần "background" của engine Flow nằm ở src/flow/may-flow.js.
// ============================================================================

const { app, BrowserWindow, WebContentsView, ipcMain, session, dialog, shell, net, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');

const pkg = require('./package.json');
const { Store } = require('./src/main/store');
const { QuanLyTaiKhoan } = require('./src/main/tai-khoan');
const { DieuPhoi } = require('./src/main/dieu-phoi');
const { Luong } = require('./src/main/luong');
const { LuongSuno } = require('./src/main/luong-suno');
const { BoCapNhat, layRepo } = require('./src/main/cap-nhat');
const hd = require('./src/main/hang-doi');
const { QuanLyTabFlow, FLOW_URL } = require('./src/flow/tab-flow');
const { taoMayFlow } = require('./src/flow/may-flow');
const { LuongFlow } = require('./src/flow/luong-flow');
const { DownloadManager } = require('./src/flow/main/downloads');
const { locVeoSettings } = require('./src/flow/main/kiem-truoc');
const { xoaDuAnFlow } = require('./src/flow/main/xoa-du-an');
const { xoaChatChuotThat, nenThuChuotThat } = require('./src/main/xoa-chat-muse');
const { chepLenDrive, timThuMucDrive } = require('./src/main/drive');
const { DriveWeb } = require('./src/main/drive-web');
const { ensureDebugger } = require('./src/flow/main/paste');

// Thư mục dữ liệu riêng (phiên đăng nhập, cài đặt, hàng đợi) — PHẢI trước whenReady.
app.setPath('userData', process.env.MUSE_DATA_DIR ||
  path.join(app.getPath('appData'), 'AIAutomationStudio'));

const GOC_MUSE = (process.env.MUSE_URL || 'https://muse.ai').replace(/\/$/, '');
const NGUON_TRANG = fs.readFileSync(path.join(__dirname, 'src/inject/muse-trang.js'), 'utf8');
// Suno (mục Tạo nhạc, 1.1.0): luồng mở thẳng trang Create.
const SUNO_URL = process.env.SUNO_URL || 'https://suno.com/create';
// 1.4.0: Google Drive (tài khoản nền 'drive' — chỉ để tải kết quả lên Drive). Bài kiểm: trang Drive giả.
const DRIVE_GOC = (process.env.DRIVE_URL || 'https://drive.google.com').replace(/\/$/, '');
const NGUON_SUNO = fs.readFileSync(path.join(__dirname, 'src/inject/suno-trang.js'), 'utf8');
const DUOI_ANH = /\.(png|jpe?g|webp|gif|bmp)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

let win = null;
let store, storeFlow, taiKhoan, dieuPhoi, capNhat, tabsFlow, mayFlow, taiVeFlow;
const nhatKy = [];
let henBao = null;
let soDongGhi = 0;

// ── Nhật ký + đẩy trạng thái cho giao diện ─────────────────────────────────
// 1.4.0: dòng nhật ký gom lại, ghi file mỗi 0,5 s (bất đồng bộ) — trước đây MỖI dòng là một lần ghi đĩa đồng bộ, chặn
// tiến trình chính (engine Flow ghi hàng chục dòng mỗi phút mỗi tab). Thoát app thì ghi nốt (ghiNhatKyNgay).
let choGhiLog = [];
let henGhiLog = null;
let dangGhiLog = Promise.resolve();
const tepNhatKy = () => path.join(app.getPath('userData'), 'nhat-ky.txt');
function ghiNhatKy() {
  henGhiLog = null;
  if (!choGhiLog.length) return;
  const chu = choGhiLog.join('');
  const soDong = choGhiLog.length;
  choGhiLog = [];
  dangGhiLog = dangGhiLog.then(async () => {
    try {
      const tep = tepNhatKy();
      // 1.3.4: file nhật ký không phình mãi — quá 20 MB thì đổi thành nhat-ky-cu.txt (giữ 1 bản cũ) rồi ghi file mới.
      if (Math.floor((soDongGhi - soDong) / 500) !== Math.floor(soDongGhi / 500) && (await fs.promises.stat(tep).catch(() => ({ size: 0 }))).size > 20 * 1024 * 1024) {
        await fs.promises.rename(tep, path.join(app.getPath('userData'), 'nhat-ky-cu.txt'));
      }
      await fs.promises.appendFile(tep, chu);
    } catch (_) {}
  });
}
function ghiNhatKyNgay() {
  clearTimeout(henGhiLog); henGhiLog = null;
  if (!choGhiLog.length) return;
  try { fs.appendFileSync(tepNhatKy(), choGhiLog.join('')); } catch (_) {}
  choGhiLog = [];
}
function log(muc, chu) {
  const dong = { t: Date.now(), muc, chu: String(chu) };
  nhatKy.push(dong);
  if (nhatKy.length > 800) nhatKy.splice(0, nhatKy.length - 800);
  soDongGhi++;
  choGhiLog.push(`${new Date(dong.t).toISOString()} [${muc}] ${dong.chu}\n`);
  if (!henGhiLog) henGhiLog = setTimeout(ghiNhatKy, 500);
  if (win && !win.isDestroyed()) win.webContents.send('log', dong);
}

/**
 * Báo trạng thái cho giao diện, gom 250 ms. 1.4.0: hàng đợi lớn thì gom thưa hơn (mỗi lần báo là gửi cả hàng đợi và
 * giao diện vẽ lại — 2.000 việc ≈ 0,75 s, tối đa 1 s); cửa sổ đang thu nhỏ thì thôi báo, mở lại thì báo ngay.
 */
let boLoBao = false;
const nhipBao = () => Math.min(1000, 250 + Math.floor(((dieuPhoi && dieuPhoi.viec.length) || 0) / 4));
function baoTrangThai() {
  if (henBao) return;
  henBao = setTimeout(() => {
    henBao = null;
    if (!win || win.isDestroyed() || !dieuPhoi) return;
    if (win.isMinimized()) { boLoBao = true; return; }
    boLoBao = false;
    win.webContents.send('state', trangThai());
  }, win && !win.isDestroyed() && !win.isFocused() ? Math.max(2000, nhipBao()) : nhipBao());
}
/** 1.4.4: cửa sổ app quay lại tiêu điểm → báo ngay (lúc không dùng app thì chỉ báo 2 giây một lần, bớt CPU). */
function baoNgay() {
  if (henBao) { clearTimeout(henBao); henBao = null; }
  if (!win || win.isDestroyed() || !dieuPhoi || win.isMinimized()) return;
  boLoBao = false;
  win.webContents.send('state', trangThai());
}

/**
 * 1.3.4 — Ghi RAM của app vào nhật ký (mỗi 10 phút khi đang chạy) theo TỪNG phần: giao diện, lõi app, GPU, từng
 * luồng Muse / Suno, từng tab Flow. Người dùng gửi nhật ký là biết phần nào ngốn RAM, không phải đoán từ Task Manager.
 */
function docRam() {
  const nhan = new Map();
  const gan = (wc, ten) => { try { if (wc && !wc.isDestroyed()) nhan.set(wc.getOSProcessId(), ten); } catch (_) {} };
  if (win && !win.isDestroyed()) gan(win.webContents, 'giao diện');
  const ngan = (id) => { const p = String(id).split(' · '); return p.length > 2 ? `${p[0]} · ${p[p.length - 1]}` : String(id); };
  for (const [l, w] of viewCuaLuong) if (w && !w.isDestroyed()) gan(w.webContents, ngan(l.id));
  for (const t of (tabsFlow && tabsFlow.tabs) || []) { try { gan(t.view.webContents, `Flow ${t.id}`); } catch (_) {} }
  if (dangNhap) { try { gan(dangNhap.view.webContents, 'khung đăng nhập'); } catch (_) {} }
  const phan = new Map(), cpu = new Map();
  let tong = 0, tongCpu = 0;
  for (const m of app.getAppMetrics()) {
    const kb = (m.memory && m.memory.workingSetSize) || 0;
    tong += kb;
    const ten = nhan.get(m.pid) || (m.type === 'Browser' ? 'lõi app' : m.type === 'GPU' ? 'GPU' : 'khác');
    phan.set(ten, (phan.get(ten) || 0) + kb);
    // 1.4.4: CPU trung bình từ lần đọc trước (100 = một nhân chạy hết sức) → quy ra % cả máy.
    const c = (m.cpu && m.cpu.percentCPUUsage) || 0;
    tongCpu += c;
    cpu.set(ten, (cpu.get(ten) || 0) + c);
  }
  const nhan1 = Math.max(1, os.cpus().length);
  return { tong, phan: [...phan.entries()].sort((a, b) => b[1] - a[1]),
    cpu: tongCpu / nhan1, cpuPhan: [...cpu.entries()].map(([t, c]) => [t, c / nhan1]).sort((a, b) => b[1] - a[1]) };
}
function baoRam() {
  const { tong, phan, cpu, cpuPhan } = docRam();
  const gb = (kb) => (kb / 1048576).toFixed(1).replace('.', ',');
  const soTrang = phan.filter(([t]) => /· L\d+$|^Flow /.test(t)).length;
  log(tong > 6 * 1048576 ? 'warning' : 'info', `🧠 RAM app: ${gb(tong)} GB — ${phan.slice(0, 10).map(([t, kb]) => `${t} ${gb(kb)}`).join(' · ')}` +
    (tong > 6 * 1048576 && soTrang > 2 ? ` — ${soTrang} trang Muse/Flow chạy cùng lúc, mỗi trang thường 1–1,5 GB: máy chậm thì giảm số luồng / tab mỗi tài khoản.` : ''));
  // 1.4.4: CPU từng phần (trung bình từ lần ghi trước) — biết chắc phần nào ngốn CPU.
  const pt = (x) => `${Math.round(x)}%`;
  log(cpu > 70 ? 'warning' : 'info', `⚙ CPU app: ${pt(cpu)} cả máy — ${cpuPhan.filter(([, c]) => c >= 0.5).slice(0, 10).map(([t, c]) => `${t} ${pt(c)}`).join(' · ') || 'gần như không dùng'}` +
    (cpu > 70 && soTrang > 1 ? ` — ${soTrang} trang Muse/Flow chạy cùng lúc: máy nóng / chậm thì giảm "Chạy cùng lúc" hoặc số luồng / tab mỗi tài khoản.` : ''));
}

function trangThai() {
  return {
    ...dieuPhoi.trangThai(),
    taiKhoan: taiKhoan.list(),
    capNhat: capNhat ? capNhat.trangThai() : null,
    phienBan: pkg.version,
    nenTang: process.platform,
    dangNhap: dangNhap ? { id: dangNhap.id, khung: dangNhap.view.getBounds() } : null
  };
}

// ── Phiên theo tài khoản ──────────────────────────────────────────────────
const daCauHinh = new Set();
function phien(tk) {
  const ses = session.fromPartition(tk.partition);
  if (!daCauHinh.has(tk.partition)) {
    daCauHinh.add(tk.partition);
    if (tk.nen === 'drive') {
      // 1.4.0 Google Drive: đăng nhập Google như phiên Flow — giữ nguyên user agent thật của app (bỏ chữ "Electron"
      // thì Google báo "trình duyệt không an toàn", xem Suno 15/10/2026). Không tải gì về qua phiên này.
    } else if (tk.nen === 'flow') {
      // Google Flow: giữ nguyên phiên như Flow Automation Studio (đã chạy thật). Tải về theo TỪNG
      // tab: Electron đưa webContents vào will-download nên biết chắc file nào của tab nào.
      taiVeFlow.attach(ses);
    } else if (tk.nen === 'suno') {
      // Suno đăng nhập bằng Google: giữ user agent THẬT của app như phiên Flow (Google cho đăng nhập ở
      // phiên Flow). Lỗi 15/10/2026: bỏ chữ "Electron/…" (như Muse) → Google báo "Couldn't sign you in —
      // This browser or app may not be secure". Chỉ xin trang tiếng Anh (nhãn suno-trang.js đã đo).
      ganTaiSuno(ses);
      ses.setUserAgent(ses.getUserAgent(), 'en-US,en');
    } else {
      // Muse (đăng nhập Meta): bỏ chữ "Electron/…" khỏi user agent — đã chạy thật từ Muse Automation Studio.
      // Xin Muse giao diện tiếng Anh (nhãn đã đo); Muse vẫn hiện tiếng Việt thì muse-trang.js cũng hiểu.
      ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|AIAutomationStudio|ai-automation-studio|MuseAutomationStudio|muse-automation-studio)\/\S+/gi, ''), 'en-US,en');
    }
  }
  return ses;
}

/**
 * Tải về của luồng Suno: luồng đăng ký chờ trước khi bấm Download (theo webContents của cửa sổ luồng),
 * will-download của phiên đó lưu file vào thư mục tạm rồi báo đường dẫn. Tải không ai chờ (người dùng
 * tự bấm trong khung đăng nhập) thì để Electron làm như thường (hỏi chỗ lưu).
 */
const choTaiSuno = new Map();   // webContents.id → { thuMuc, xong(kq) }
function ganTaiSuno(ses) {
  ses.on('will-download', (_e, item, wc) => {
    const c = wc && choTaiSuno.get(wc.id);
    if (!c) return;
    choTaiSuno.delete(wc.id);
    c.batDau();
    fs.mkdirSync(c.thuMuc, { recursive: true });
    const ten = slugThuMuc(item.getFilename().replace(/\.[^.]+$/, '')) || 'suno';
    const duoi = (item.getFilename().match(/\.[a-z0-9]{2,4}$/i) || ['.mp3'])[0];
    const p = path.join(c.thuMuc, `${Date.now()}-${ten}${duoi}`);
    item.setSavePath(p);
    item.once('done', (_ev, st) => {
      const mime = hd.mimeTuDuoi(p);
      c.xong(st === 'completed' ? { ok: true, duongDan: p, mime: /octet/.test(mime) ? item.getMimeType() || 'audio/mpeg' : mime }
        : { ok: false, loi: `Tải file từ Suno không xong (${st})` });
    });
  });
}
function choTaiVeSuno(wc, ms) {
  let hen = null, daBatDau = false;
  const hua = new Promise((res) => {
    hen = setTimeout(() => { choTaiSuno.delete(wc.id); res({ ok: false, hetGio: true }); }, ms);
    choTaiSuno.set(wc.id, {
      thuMuc: path.join(app.getPath('userData'), 'suno-tai-tam'),
      batDau: () => { daBatDau = true; clearTimeout(hen); },   // đã bắt đầu tải → chờ tới khi xong, không cắt giữa chừng
      xong: res
    });
  });
  return { hua, huy: () => { clearTimeout(hen); choTaiSuno.delete(wc.id); }, daBatDau: () => daBatDau };
}

const WEB_PREFS = (tk) => (tk.nen === 'flow'
  // Engine Flow chạy trong main world, nói chuyện với tiến trình chính qua preload-flow.js (contextBridge).
  ? { session: phien(tk), preload: path.join(__dirname, 'src/flow/main/preload-flow.js'), backgroundThrottling: false,
    contextIsolation: true, nodeIntegration: false, sandbox: false }
  : { session: phien(tk), backgroundThrottling: false, contextIsolation: true, sandbox: true, spellcheck: false });
function ganWc(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) wc.loadURL(url);
    return { action: 'deny' };
  });
  wc.setAudioMuted(true);
}
/** Trình duyệt HIỆN trong khung của trang Tài khoản (đăng nhập). */
function taoView(tk) {
  const v = new WebContentsView({ webPreferences: WEB_PREFS(tk) });
  ganWc(v.webContents);
  return v;
}
/**
 * Trang chạy ngầm = một CỬA SỔ ẨN riêng (show:false), KHÔNG phải WebContentsView ẩn.
 * Đo 10/10/2026: WebContentsView setVisible(false) (hoặc đặt ngoài khung) → document.visibilityState
 * = 'hidden', requestAnimationFrame dừng → Muse KHÔNG nạp ô soạn tin, không bao giờ có nút Send.
 * Cửa sổ show:false + backgroundThrottling:false thì trang luôn 'visible' và chạy bình thường,
 * kể cả sau show()/hide() và khi cửa sổ chính thu nhỏ.
 */
function taoCuaSoAn(tk, tieuDe) {
  const w = new BrowserWindow({
    show: false, width: 1280, height: 800, skipTaskbar: !xemLuong, title: tieuDe,
    icon: path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon256.png'),
    autoHideMenuBar: true, webPreferences: WEB_PREFS(tk)
  });
  ganWc(w.webContents);
  // 1.4.0: trang chạy ngầm nhận ưu tiên CPU thấp hơn (đổi trang có thể sang tiến trình mới → áp lại mỗi lần nạp xong).
  // 1.4.4: trang mới nạp (tài liệu mới) → chèn lại CSS tắt hiệu ứng động.
  w.webContents.on('dom-ready', () => { datUuTien(w.webContents); cssDong.delete(w.webContents); datHieuUng(w.webContents); });
  // Người dùng bấm X khi đang xem luồng → chỉ ẩn, luồng vẫn chạy.
  w.on('close', (e) => { if (!appDangThoat && !w.__huy) { e.preventDefault(); w.hide(); } });
  return w;
}
function dongCuaSoAn(w) {
  if (!w || w.isDestroyed()) return;
  w.__huy = true;
  w.destroy();
}

/**
 * Mỗi lần mở app: bỏ cờ "đang chạy / tự chạy lại sau F5" của engine Flow lần trước. Tab mới đánh số
 * lại từ flow1 — không bỏ thì tab flow1 vừa mở sẽ tự khôi phục mẻ dở của flow1 phiên trước, trong
 * khi hàng đợi đã đưa các việc đó về hàng chờ. Giữ 30 dự án engine gần nhất cho khỏi phình file.
 */
/**
 * 1.4.5: bớt CPU — engine lưu dự án (veoProjects) bằng cách đọc CẢ kho, thêm mục của mình, ghi lại CẢ kho, gần như mỗi
 * lần một prompt đổi trạng thái; mỗi mẻ thêm một mục mới (~15–20 KB) và kho chỉ được cắt lúc mở app (donKhoFlow) → chạy
 * 2.000 việc là 3–4 MB chép qua lại mỗi lần lưu. Cắt ngay lúc ghi: giữ các dự án mới nhất (dự án đang chạy luôn mới nhất
 * vì lưu là đặt lại timestamp) và dự án đang được nhắc tới trong trạng thái chạy của engine.
 */
function catVeoProjects(arg) {
  const vp = arg && arg.veoProjects;
  if (!vp || typeof vp !== 'object') return arg;
  const ten = Object.keys(vp);
  const giuToiDa = Math.max(30, 3 * (((tabsFlow && tabsFlow.tabs) || []).length));
  if (ten.length <= giuToiDa) return arg;
  const moc = (k) => Math.max((vp[k] && vp[k].timestamp) || 0, (vp[k] && vp[k].startTime) || 0);
  const dang = storeFlow.get(['veoRunState', 'autoResumeProject', 'activeRunningProject']);
  const nhac = new Set([dang.autoResumeProject, dang.activeRunningProject, dang.veoRunState && dang.veoRunState.projectName].filter(Boolean));
  const giu = new Set(ten.sort((a, b) => moc(b) - moc(a)).slice(0, giuToiDa));
  for (const k of nhac) if (k in vp) giu.add(k);
  return { ...arg, veoProjects: Object.fromEntries([...giu].map((k) => [k, vp[k]])) };
}

function donKhoFlow() {
  storeFlow.remove(['veoRunState', 'veoState', 'autoResumeProject', 'activeRunningProject']);
  const { veoProjects } = storeFlow.get('veoProjects');
  if (veoProjects && typeof veoProjects === 'object') {
    const ten = Object.keys(veoProjects);
    if (ten.length > 30) {
      const giu = ten.sort((a, b) => ((veoProjects[b] && veoProjects[b].startTime) || 0) - ((veoProjects[a] && veoProjects[a].startTime) || 0)).slice(0, 30);
      storeFlow.set({ veoProjects: Object.fromEntries(giu.map((k) => [k, veoProjects[k]])) });
    }
  }
}

// ── 1.4.0: máy mượt — hạ ưu tiên CPU các trang chạy ngầm ─────────────────────
// Mỗi luồng Muse / Suno / tab Flow là một trang web thật (tiến trình riêng). Chạy nhiều luồng thì các trang này giành
// CPU với giao diện app và các phần mềm khác → máy giật. Hạ chúng xuống "dưới bình thường": máy rảnh thì vẫn chạy đủ
// nhanh, máy bận thì giao diện / phần mềm người dùng đang dùng được ưu tiên trước. Tắt ở Cài đặt → Chạy.
const daHaUuTien = new Set();
function datUuTien(wc) {
  try {
    if (!wc || wc.isDestroyed()) return;
    const pid = wc.getOSProcessId();
    if (!pid) return;
    const nhe = !dieuPhoi || dieuPhoi.caiDat.nheMay !== false;
    if (nhe === daHaUuTien.has(pid)) return;
    os.setPriority(pid, nhe ? os.constants.priority.PRIORITY_BELOW_NORMAL : os.constants.priority.PRIORITY_NORMAL);
    if (nhe) daHaUuTien.add(pid); else daHaUuTien.delete(pid);
  } catch (_) {}
}
function datUuTienMoiLuong() {
  for (const w of viewCuaLuong.values()) if (w && !w.isDestroyed()) { datUuTien(w.webContents); datHieuUng(w.webContents); }
  for (const t of (tabsFlow && tabsFlow.tabs) || []) { try { datUuTien(t.view.webContents); datHieuUng(t.view.webContents); } catch (_) {} }
  if (daHaUuTien.size > 500) daHaUuTien.clear();
}

// 1.4.4: bớt CPU — trang chạy ngầm ẩn nhưng vẫn "visible" (backgroundThrottling:false) nên cứ vẽ ~60 khung/giây mọi
// hiệu ứng CSS lặp mãi (vòng xoay chờ, ánh lấp lánh "đang tạo"…) suốt mấy phút chờ kết quả, nhân với số luồng / tab.
// Khi bật "Máy mượt": chèn CSS (lớp người dùng) cho mọi hiệu ứng CSS chạy xong ngay một lần. Chỉ đụng CSS animation
// (sự kiện animationend vẫn bắn, menu / hộp thoại vẫn đóng mở như cũ); không đụng transition, không đổi cách bấm / đọc trang.
const CSS_TAT_DONG = '*,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important}';
const cssDong = new WeakMap();   // webContents → khoá CSS đã chèn ('dang' khi đang chèn)
async function datHieuUng(wc) {
  try {
    if (!wc || wc.isDestroyed()) return;
    const nhe = !dieuPhoi || dieuPhoi.caiDat.nheMay !== false;
    const k = cssDong.get(wc);
    if (nhe && !k) {
      cssDong.set(wc, 'dang');
      const khoa = await wc.insertCSS(CSS_TAT_DONG, { cssOrigin: 'user' });
      if (cssDong.get(wc) === 'dang') cssDong.set(wc, khoa);
    } else if (!nhe && k) {
      cssDong.delete(wc);
      if (k !== 'dang') await wc.removeInsertedCSS(k);
    }
  } catch (_) {}
}

// ── Luồng chạy ngầm ───────────────────────────────────────────────────────
const viewCuaLuong = new Map();
let xemLuong = !!process.env.MUSE_SHOW_LANES;

/**
 * @param duAnId  1.3.0: luồng Muse / tab Flow RIÊNG của một dự án (null = luồng dùng chung, Suno). Tab Flow chạy
 *                trên dự án Flow riêng của dự án đó (chưa có thì mở dự án Flow MỚI, không dùng dự án Flow cũ).
 */
function taoLuong(tk, stt, duAnId) {
  const tenDa = duAnId ? (dieuPhoi.duAn.find((d) => d.id === duAnId) || { ten: duAnId }).ten : '';
  const id = `${tk.ten}${tenDa ? ` · ${tenDa}` : ''} · L${stt}`;
  if (tk.nen === 'flow') {
    const tkDuAn = duAnId ? { ...tk, flowUrl: dieuPhoi.flowUrlCua(duAnId, tk.id) } : tk;
    return new LuongFlow({ id, taiKhoan: tkDuAn, tabs: tabsFlow, may: mayFlow, log,
      thuMucTam: path.join(app.getPath('userData'), 'flow-tai-tam', slugThuMuc(`${tk.id}-${duAnId ? `${duAnId}-` : ''}${stt}`)),
      // Bài kiểm (MUSE_DATA_DIR) ghi vào thư mục dữ liệu tạm, không rơi vào Tài liệu của máy.
      thuMucChanDoan: process.env.MUSE_DATA_DIR ? path.join(app.getPath('userData'), 'chan-doan-flow')
        : path.join(app.getPath('documents'), 'AI Automation Studio', 'chan-doan-flow'),
      docAnh, luuUrl: (tkId, url) => {
        if (!url) {
          // Dự án Flow đã lưu không còn (Flow báo 404): quên địa chỉ + ảnh đã tải lên dự án đó (phải tải lại).
          if (duAnId) dieuPhoi.boFlowTen(tkId, duAnId); else taiKhoan.sua(tkId, { flowUrl: '' });
          baoTrangThai();
          return;
        }
        if (duAnId) {
          if (dieuPhoi.datFlowUrl(duAnId, tkId, url)) log('info', `📁 Dự án "${tenDa}" chạy trên dự án Flow riêng của "${tk.ten}": ${url}`);
        } else {
          taiKhoan.sua(tkId, { flowUrl: url });
          if (taiKhoan.tim(tkId).flowUrl === url) log('info', `📁 Nhớ trang dự án Flow của "${tk.ten}": ${url}`);
        }
        baoTrangThai();
      } });
  }
  if (tk.nen === 'suno') {
    const w = taoCuaSoAn(tk, `Suno · ${id}`);
    // Suno mở file tải về trong cửa sổ mới → tải file đó (đừng mở trang mp3 thay cho trang Create).
    w.webContents.setWindowOpenHandler(({ url }) => {
      if (/\.(mp3|wav|m4a)(\?|$)/i.test(url) || /cdn\d*\.suno\.ai\//i.test(url)) w.webContents.downloadURL(url);
      return { action: 'deny' };
    });
    if (xemLuong) w.showInactive();
    const l = new LuongSuno({ id, taiKhoan: tk, wc: w.webContents, nguon: NGUON_SUNO, url: SUNO_URL, log,
      choTaiVe: (ms) => choTaiVeSuno(w.webContents, ms), hienCuaSo: () => { if (!w.isDestroyed()) w.show(); } });
    viewCuaLuong.set(l, w);
    return l;
  }
  // Giữ kích thước thật 1280×800 (không thu nhỏ): trang quá nhỏ có thể không vẽ ảnh.
  const w = taoCuaSoAn(tk, `Muse · ${id}`);
  if (xemLuong) w.showInactive();
  const l = new Luong({ id, taiKhoan: tk, wc: w.webContents, nguon: NGUON_TRANG, goc: GOC_MUSE, log });
  viewCuaLuong.set(l, w);
  return l;
}

function huyLuong(l) {
  if (l.nen === 'flow') { l.dong(); return; }
  const w = viewCuaLuong.get(l);
  viewCuaLuong.delete(l);
  dongCuaSoAn(w);
}

// ── Đăng nhập: một trình duyệt hiện trong khung của trang Tài khoản ─────────
let dangNhap = null;   // { id, view }

function moDangNhap(id, khung) {
  dongDangNhap(false);
  const tk = taiKhoan.tim(id);
  if (!tk) return { ok: false, loi: 'Không tìm thấy tài khoản' };
  const v = taoView(tk);
  win.contentView.addChildView(v);
  dangNhap = { id, view: v };
  datKhungDangNhap(khung);
  v.webContents.loadURL(tk.nen === 'flow' ? (tk.flowUrl || FLOW_URL) : tk.nen === 'suno' ? SUNO_URL : tk.nen === 'drive' ? `${DRIVE_GOC}/drive/my-drive` : GOC_MUSE).catch(() => {});
  baoTrangThai();
  return { ok: true };
}

function datKhungDangNhap(k) {
  if (!dangNhap || !k) return;
  dangNhap.view.setBounds({ x: Math.round(k.x), y: Math.round(k.y),
    width: Math.max(200, Math.round(k.width)), height: Math.max(200, Math.round(k.height)) });
}

/**
 * Đóng khung đăng nhập: gỡ khỏi cửa sổ NGAY rồi mới kiểm tài khoản (chạy nền, cửa sổ ẩn riêng).
 * Lỗi 15/10/2026: gỡ khung SAU khi kiểm xong (Suno tới 25 s) → khung đăng nhập là lớp native nằm đè lên
 * mọi mục khác, hộp thoại (vd "Xoá tài khoản?") cũng phải chờ — trông như app treo.
 */
async function dongDangNhap(kiem = true) {
  if (!dangNhap) return;
  const { id, view } = dangNhap;
  dangNhap = null;
  const url = (() => { try { return view.webContents.getURL(); } catch (_) { return ''; } })();
  try { win.contentView.removeChildView(view); } catch (_) {}
  try { view.webContents.close(); } catch (_) {}
  baoTrangThai();
  const tk = taiKhoan.tim(id);
  if (!kiem || !tk) return;
  if (tk.nen === 'flow' && /\/project\//.test(url) && url !== tk.flowUrl) {
    // Người dùng đang mở một dự án Flow lúc bấm Xong → luồng chạy đúng dự án đó.
    taiKhoan.sua(id, { flowUrl: url });
    if (taiKhoan.tim(id).flowUrl === url) log('info', `📁 Nhớ trang dự án Flow của "${tk.ten}": ${url}`);
    else log('warning', `⚠ Không nhận được địa chỉ dự án Flow "${url}" — báo cho người phát triển.`);
  }
  kiemTaiKhoan(id).catch((e) => log('warning', `👤 Không kiểm được "${tk.ten}": ${e.message}`));
}

async function docTrangThai(wc, ms) {
  const het = Date.now() + ms;
  let tt = null;
  while (Date.now() < het) {
    try {
      await wc.executeJavaScript(NGUON_TRANG, true);
      tt = await wc.executeJavaScript('window.__muse.trangThai()', true);
      if (tt.coONhap || tt.canDangNhap) return tt;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return tt;
}

/** Kiểm đăng nhập (và đọc mức dùng token) mà không mở gì lên màn hình. */
/** Google Flow: đăng nhập = phiên có cookie SID / __Secure-1PSID của google.com (cách của Flow Automation Studio). */
async function daDangNhapFlow(tk) {
  if (process.env.DRIVE_URL && tk.nen === 'drive') return true;   // bài kiểm: trang Drive giả tự báo cần đăng nhập
  try {
    const cookies = await phien(tk).cookies.get({ domain: '.google.com' });
    return cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID');
  } catch (_) { return false; }
}

async function kiemTaiKhoan(id, nguoiBam = false) {
  const tk = taiKhoan.tim(id);
  if (!tk) return null;
  // Người dùng tự bấm Kiểm tra = muốn thử lại: bỏ mốc "Muse chặn video" (lần chạy sau thử tạo video lại).
  // Không bỏ ở lần kiểm tự động lúc mở app — không thì mỗi lần mở app lại phí một lượt gửi video bị chặn.
  if (nguoiBam && (tk.chanVideoDen || 0) > Date.now()) {
    taiKhoan.sua(id, { chanVideoDen: 0 });
    log('info', `👤 "${tk.ten}": đã bỏ đánh dấu "Muse chặn video" — lần chạy sau thử tạo video lại ở tài khoản này`);
  }
  // 1.3.7: bấm Kiểm tra = xem lại tài khoản từ đầu — bỏ màu đỏ "việc gần nhất lỗi" (đang nghỉ / hết lượt vẫn đỏ tới giờ).
  if (nguoiBam && dieuPhoi && dieuPhoi.ketQuaTk) delete dieuPhoi.ketQuaTk[id];
  if (tk.nen === 'drive') {
    const co = await daDangNhapFlow(tk);
    taiKhoan.sua(id, { trangThai: co ? 'da-dang-nhap' : 'can-dang-nhap' });
    log(co ? 'success' : 'warning', `👤 "${tk.ten}": ${co ? 'đã đăng nhập Google — dùng để tải ảnh / video lên Google Drive' : 'CHƯA đăng nhập Google'}`);
    baoTrangThai();
    return co ? 'da-dang-nhap' : 'can-dang-nhap';
  }
  if (tk.nen === 'flow') {
    const co = await daDangNhapFlow(tk);
    taiKhoan.sua(id, { trangThai: co ? 'da-dang-nhap' : 'can-dang-nhap' });
    log(co ? 'success' : 'warning', `👤 "${tk.ten}": ${co ? 'đã đăng nhập Google' : 'CHƯA đăng nhập Google'}` +
      (co ? (tk.flowUrl ? ` · dự án Flow: ${tk.flowUrl}` : ' · chưa chọn dự án Flow (app sẽ tự mở dự án mới)') : ''));
    baoTrangThai();
    return co ? 'da-dang-nhap' : 'can-dang-nhap';
  }
  if (tk.nen === 'suno') {
    const w = taoCuaSoAn(tk, 'Suno · kiểm tài khoản');
    w.webContents.loadURL(SUNO_URL).catch(() => {});
    let tt = null;
    for (const het = Date.now() + 25000; Date.now() < het;) {
      try {
        await w.webContents.executeJavaScript(NGUON_SUNO, true);
        tt = await w.webContents.executeJavaScript('window.__suno.trangThai()', true);
        if (tt.daDangNhap || tt.canDangNhap) break;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    dongCuaSoAn(w);
    const kq = tt && tt.daDangNhap ? 'da-dang-nhap' : tt && tt.canDangNhap ? 'can-dang-nhap' : 'chua-kiem';
    // Bấm Kiểm tra = người dùng muốn thử lại tài khoản: bỏ mốc "hết lượt" Suno đã nhớ.
    const coHetLuot = (tk.hetLuotDen || 0) > Date.now();
    taiKhoan.sua(id, { trangThai: kq, hetLuotDen: 0 });
    log(kq === 'da-dang-nhap' ? 'success' : 'warning', `👤 "${tk.ten}": ${kq === 'da-dang-nhap' ? 'đã đăng nhập Suno' : kq === 'can-dang-nhap' ? 'CHƯA đăng nhập Suno' : 'không kiểm được (mạng?)'}` +
      (coHetLuot ? ' · đã bỏ đánh dấu "hết lượt", lần chạy sau dùng lại tài khoản này' : ''));
    baoTrangThai();
    return kq;
  }
  const w = taoCuaSoAn(tk, 'Muse · kiểm tài khoản');
  w.webContents.loadURL(GOC_MUSE).catch(() => {});
  const tt = await docTrangThai(w.webContents, 25000);
  const kq = tt && tt.coONhap ? 'da-dang-nhap' : tt && tt.canDangNhap ? 'can-dang-nhap' : 'chua-kiem';
  const hm = kq === 'da-dang-nhap'
    ? await w.webContents.executeJavaScript('window.__muse.hanMuc()', true).catch(() => null) : null;
  taiKhoan.sua(id, { trangThai: kq, ...(hm && hm.ok ? { hanMuc: { luc: Date.now(), muc: hm.muc } } : {}) });
  dongCuaSoAn(w);
  const token = hm && hm.ok ? ' · ' + hm.muc.map((m) => `${m.ten}: ${m.chu}`).join(' · ')
    : kq === 'da-dang-nhap' ? ' (chưa đọc được mức token)' : '';
  log(kq === 'da-dang-nhap' ? 'success' : 'warning',
    `👤 "${tk.ten}": ${kq === 'da-dang-nhap' ? 'đã đăng nhập Muse' : kq === 'can-dang-nhap' ? 'CHƯA đăng nhập' : 'không kiểm được (mạng?)'}${token}`);
  baoTrangThai();
  return kq;
}
/** Cập nhật mức token của mọi tài khoản (lần lượt; đang cập nhật thì bỏ qua lần gọi mới). */
let dangCapNhatToken = null;
function capNhatToken() {
  dangCapNhatToken = dangCapNhatToken || (async () => {
    try { for (const a of taiKhoan.list()) if (a.nen === 'muse') await kiemTaiKhoan(a.id); } finally { dangCapNhatToken = null; }
  })();
  return dangCapNhatToken;
}

/**
 * Xoá đoạn chat trên Muse của một tài khoản (cửa sổ ẩn riêng).
 * @param threads  [url…] chỉ xoá các chat đó; bỏ trống → xoá MỌI chat phụ ("Main chat" Muse không cho xoá).
 */
let dangXoaChat = false;
// ── 1.4.0: tải thẳng lên drive.google.com bằng phiên tài khoản Drive (src/main/drive-web.js) ──
let driveWeb = null;
function thuMucChanDoan(ten) {
  return process.env.MUSE_DATA_DIR ? path.join(app.getPath('userData'), ten) : path.join(app.getPath('documents'), 'AI Automation Studio', ten);
}
async function lenDriveWeb(x) {
  if (!driveWeb) {
    driveWeb = new DriveWeb({
      goc: DRIVE_GOC, timTk: (id) => taiKhoan.tim(id), store, ganDebugger: ensureDebugger,
      thuMucDem: path.join(app.getPath('userData'), 'drive-tam'),
      taoCuaSo: (tk) => { const w = taoCuaSoAn(tk, `Google Drive · ${tk.ten}`); if (xemLuong) w.showInactive(); return w; },
      dongCuaSo: (w) => dongCuaSoAn(w),
      luuChanDoan: (ten, html) => {
        try {
          const d = thuMucChanDoan('chan-doan-drive');
          fs.mkdirSync(d, { recursive: true });
          const t = new Date(), so = (n) => String(n).padStart(2, '0');
          const p = path.join(d, `${ten}-${t.getFullYear()}${so(t.getMonth() + 1)}${so(t.getDate())}-${so(t.getHours())}${so(t.getMinutes())}${so(t.getSeconds())}.html`);
          fs.writeFileSync(p, html, 'utf8');
          return p;
        } catch (_) { return ''; }
      }
    });
  }
  const r = await driveWeb.len(x);
  if (r.canDangNhap && taiKhoan.tim(x.tkId)) { taiKhoan.sua(x.tkId, { trangThai: 'can-dang-nhap' }); baoTrangThai(); }
  return r;
}

let dangTaiNhieu = false;
/** 1.3.0: xoá chat Muse không được → lưu HTML khung danh sách chat + menu để người dùng gửi lại (Muse đổi giao diện). */
function luuChanDoanMuse(tk, r) {
  try {
    const cd = r && r.chanDoan;
    if (!cd) return '';
    const thuMuc = process.env.MUSE_DATA_DIR ? path.join(app.getPath('userData'), 'chan-doan-muse')
      : path.join(app.getPath('documents'), 'AI Automation Studio', 'chan-doan-muse');
    fs.mkdirSync(thuMuc, { recursive: true });
    const t = new Date(), so = (n) => String(n).padStart(2, '0');
    const p = path.join(thuMuc, `xoa-chat-${t.getFullYear()}${so(t.getMonth() + 1)}${so(t.getDate())}-${so(t.getHours())}${so(t.getMinutes())}${so(t.getSeconds())}.html`);
    const esc = (x) => String(x || '').replace(/</g, '&lt;');
    fs.writeFileSync(p, `<!-- Chẩn đoán xoá chat Muse · ${esc(tk.ten)} · ${t.toISOString()}\n url: ${esc(cd.url)}\n lỗi: ${esc(cd.loi || r.loi)}\n` +
      ` số hàng chat: ${cd.soHang} · có nút ⋯: ${cd.soHangCoNut}${cd.thongBao ? `\n thông báo Muse: ${esc(cd.thongBao)}` : ''} -->\n<h3>Danh sách chat</h3>\n${cd.danhSach || ''}\n<h3>Menu / hộp thoại đang mở</h3>\n${cd.menu || ''}\n`, 'utf8');
    return p;
  } catch (_) { return ''; }
}
async function xoaChat(id, threads) {
  const tk = taiKhoan.tim(id);
  if (!tk) return { ok: false, loi: 'Không tìm thấy tài khoản' };
  if (tk.nen !== 'muse') return { ok: false, loi: 'Xoá chat chỉ dành cho tài khoản Muse' };
  if (dangXoaChat) return { ok: false, loi: 'Đang xoá chat — đợi xong đã' };
  if (!threads && dieuPhoi.coViecDangChay()) return { ok: false, loi: 'Đang chạy hàng chờ — bấm Dừng trước khi xoá toàn bộ chat' };
  dangXoaChat = true;
  const w = taoCuaSoAn(tk, 'Muse · xoá đoạn chat');
  const wc = w.webContents;
  const mo = async (url) => { wc.loadURL(url).catch(() => {}); const tt = await docTrangThai(wc, 25000); return !!(tt && tt.coONhap); };
  let da = 0, hong = 0, chanDoan = '', lyDo = '', chuotThat = false;
  const ghiHong = (r) => {
    if (r && r.loi && !lyDo) lyDo = r.loi;
    if (!chanDoan && r && r.chanDoan) chanDoan = luuChanDoanMuse(tk, r);
  };
  // 1.3.2: bấm bằng JavaScript không xoá được (Muse bỏ qua cú bấm isTrusted = false) → thử lại bằng chuột thật;
  // được thì các chat sau của lượt này đi thẳng đường chuột thật.
  const thuChuotThat = async (r, dangMo) => {
    if (!nenThuChuotThat(r)) return r;
    const t = await xoaChatChuotThat(wc, { dangMo });
    if (t.ok) {
      if (!chuotThat) log('info', `🖱 "${tk.ten}": Muse không nhận cú bấm tự động khi xoá chat (${r.loi}) — chuyển sang bấm chuột thật.`);
      chuotThat = true;
      return t;
    }
    // Chẩn đoán lấy lại SAU lần chuột thật (giữ HTML menu / hộp xác nhận của cả hai lần thử).
    return { ...r, chanDoan: null, loi: `${r.loi} · chuột thật: ${t.loi || 'không xoá được'}` };
  };
  const chanDoanSau = async (r) => {
    const cd = await wc.executeJavaScript('window.__muse.chanDoanXoa()', true).catch(() => null);
    return cd ? { ...r, chanDoan: { ...cd, loi: r.loi } } : r;
  };
  try {
    if (threads) {
      for (const url of threads) {
        if (!(await mo(url))) { hong++; ghiHong(null); continue; }
        let r = chuotThat ? await xoaChatChuotThat(wc, { dangMo: true }) : await wc.executeJavaScript('window.__muse.xoaChatDangMo()', true).catch(() => null);
        if (!chuotThat) r = await thuChuotThat(r, true);
        if (r && r.ok) da++; else { hong++; ghiHong(r && !r.chanDoan ? await chanDoanSau(r) : r); }
      }
    } else {
      if (!(await mo(GOC_MUSE))) return { ok: false, loi: 'Không mở được Muse (chưa đăng nhập?)' };
      for (;;) {
        if (chuotThat) {
          const r = await xoaChatChuotThat(wc, {});
          if (r.het) break;
          if (!r.ok) { hong++; ghiHong(await chanDoanSau(r)); break; }
          if (++da % 10 === 0) log('info', `🗑 "${tk.ten}": đã xoá ${da} đoạn chat…`);
          continue;
        }
        let r = await wc.executeJavaScript('window.__muse.xoaNhieuChat({ toiDa: 10 })', true).catch(() => null);
        if (r) da += r.da;
        if (r && !r.ok) {
          const t = await thuChuotThat(r, false);
          if (t.ok) { da++; continue; }
          r = t;
        }
        if (!r || !r.ok) { hong++; ghiHong(r && r.chanDoan ? r : r && await chanDoanSau(r)); break; }
        if (!r.da) break;
        log('info', `🗑 "${tk.ten}": đã xoá ${da} đoạn chat…`);
      }
    }
  } finally {
    dongCuaSoAn(w);
    dangXoaChat = false;
  }
  log(hong ? 'warning' : 'success', `🗑 "${tk.ten}": đã xoá ${da} đoạn chat trên Muse${hong ? ` · ${hong} không xoá được${lyDo ? ` (${lyDo})` : ''}` : ''}` +
    (chanDoan ? ` — đã lưu tệp chẩn đoán ${chanDoan}, gửi tệp này cho người phát triển để sửa theo giao diện Muse mới.` : ''));
  return { ok: true, da, hong, loi: lyDo, chanDoan };
}

/**
 * Chạy hết hàng chờ → dọn theo tuỳ chọn trong Cài đặt: xoá chat Muse của các việc đã xong, xoá dự án
 * Flow đã dùng (lần chạy sau app tự mở dự án mới). Lỗi chỉ ghi nhật ký, không chặn tắt máy.
 */
async function donDep({ muse, flow, duAn }) {
  for (const [tkId, ds] of muse) {
    const tk = taiKhoan.tim(tkId);
    if (!tk) continue;
    log('info', `🗑 "${tk.ten}": tự xoá ${ds.length} đoạn chat Muse của việc đã xong…`);
    const r = await xoaChat(tkId, ds.map((x) => x.thread));
    if (r.ok) dieuPhoi.boThread(ds.map((x) => x.id));
    else log('warning', `⚠ "${tk.ten}": không tự xoá được chat Muse — ${r.loi}`);
  }
  for (const tkId of flow) {
    const tk = taiKhoan.tim(tkId);
    // 1.3.0: mỗi dự án của app có dự án Flow riêng trên tài khoản → xoá đúng dự án Flow của dự án vừa chạy xong.
    const url = duAn ? dieuPhoi.flowUrlCua(duAn, tkId) : tk && tk.flowUrl;
    if (!tk || !url) continue;
    // Đợi luồng Flow của tài khoản (của dự án này) đóng tab (điều phối đóng ở nhịp kế tiếp) — tab còn mở trên
    // dự án sẽ nhớ lại đúng địa chỉ dự án vừa xoá.
    const cuaDuAn = (x) => x.taiKhoanId === tkId && (!duAn || x.duAn === duAn);
    for (let i = 0; i < 20 && dieuPhoi.luong.some(cuaDuAn); i++) await new Promise((r) => setTimeout(r, 500));
    if (duAn ? dieuPhoi.duAnDangChay(duAn) || dieuPhoi.luong.some(cuaDuAn) : dieuPhoi.dangChay) {
      log('warning', `⚠ "${tk.ten}": dự án đang chạy lại — bỏ qua tự xoá dự án Flow.`);
      continue;
    }
    log('info', `🗑 "${tk.ten}": tự xoá dự án Flow ${url}…`);
    const r = await xoaDuAnFlow(url, {
      taoCuaSo: () => taoCuaSoAn(tk, 'Flow · xoá dự án'), dongCuaSo: dongCuaSoAn, trangChu: FLOW_URL,
      choMs: Number(process.env.FLOW_CHO_SAN_SANG_MS) || 25000
    });
    if (r.ok) {
      if (!duAn || tk.flowUrl === url) taiKhoan.sua(tkId, { flowUrl: '' });
      dieuPhoi.boFlowTen(tkId, duAn);
      log('success', `🗑 "${tk.ten}": đã xoá dự án Flow — lần chạy sau app tự mở dự án mới.`);
    } else {
      log('warning', `⚠ "${tk.ten}": không tự xoá được dự án Flow — ${r.lyDo}. Dự án vẫn giữ nguyên.` +
        (r.chiTiet ? ` Chẩn đoán: ${JSON.stringify(r.chiTiet)}` : ''));
    }
    baoTrangThai();
  }
}

// ── File ──────────────────────────────────────────────────────────────────
function docFile(p) {
  const duoi = path.extname(p).slice(1).toLowerCase();
  return { ten: path.basename(p), mime: MIME[duoi] || 'image/png', b64: fs.readFileSync(p).toString('base64') };
}
function ghiFile(dich, buf) {
  fs.mkdirSync(path.dirname(dich), { recursive: true });
  fs.writeFileSync(dich, buf);
}
/** File Flow đã tải về thư mục tạm → chuyển sang chỗ kết quả (khác ổ đĩa thì chép rồi xoá). */
function chuyenFile(tu, den) {
  fs.mkdirSync(path.dirname(den), { recursive: true });
  try { fs.renameSync(tu, den); } catch (err) {
    if (err.code !== 'EXDEV' && err.code !== 'EPERM') throw err;
    fs.copyFileSync(tu, den);
    try { fs.unlinkSync(tu); } catch (_) {}
  }
}
/** Ảnh gửi lên kho Flow (UPLOAD_IMAGES_TO_FLOW đọc {dataUrl, name, type}). */
function docAnh(p) {
  const f = docFile(p);
  return { dataUrl: `data:${f.mime};base64,${f.b64}`, name: f.ten, type: f.mime };
}
const slugThuMuc = (s) => String(s).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60);
function anhTrongThuMuc(dir) {
  return fs.readdirSync(dir).filter((f) => DUOI_ANH.test(f)).sort(hd.soSanhTuNhien).map((f) => path.join(dir, f));
}
/** Chép ảnh nhân vật vào thư mục dữ liệu, để xoá/di chuyển ảnh gốc không làm hỏng nhân vật. */
function chepAnhNhanVat(nvId, ds) {
  const dir = path.join(app.getPath('userData'), 'nhan-vat', nvId);
  fs.mkdirSync(dir, { recursive: true });
  return ds.map((p) => {
    if (p.startsWith(dir)) return p;
    const dich = path.join(dir, `${Date.now().toString(36)}-${path.basename(p)}`);
    fs.copyFileSync(p, dich);
    return dich;
  });
}

// ── Lệnh từ giao diện ─────────────────────────────────────────────────────
const LENH = {
  trangThai: () => ({ ...trangThai(), nhatKy }),
  them: (p) => dieuPhoi.them(p),
  quetDaCo: (p) => dieuPhoi.quetDaCo(p),   // 1.4.2
  // 1.3.0: Chạy / Dừng theo dự án (có duAn) — không có duAn = mọi dự án như bản cũ.
  chay: ({ duAn } = {}) => (duAn ? dieuPhoi.chayDuAn(duAn) : dieuPhoi.chayTatCa()),
  dung: ({ duAn } = {}) => (duAn ? dieuPhoi.dungDuAn(duAn) : dieuPhoi.dungTatCa()),
  taoLai: ({ ids, chay }) => dieuPhoi.taoLai(ids, chay),
  dungViec: ({ ids }) => dieuPhoi.dungViec(ids),
  chayViec: ({ ids }) => dieuPhoi.chayViec(ids),
  xoaViec: ({ ids }) => dieuPhoi.xoaViec(ids),
  suaViec: ({ id, thay }) => dieuPhoi.suaViec(id, thay),
  // 1.4.0: đổi prompt nhiều việc, đổi ngay sang Muse / Flow, đưa lên Google Drive, chạy lại tài khoản đang nghỉ.
  doiPrompt: ({ ids, ...p }) => dieuPhoi.doiPrompt(ids || [], p),
  doiNenViec: ({ ids, nen, chay = true }) => dieuPhoi.doiNenViec(ids || [], nen, chay),
  lenDriveViec: ({ ids }) => dieuPhoi.lenDriveViec(ids || []),
  chayLaiTaiKhoan: ({ id }) => dieuPhoi.chayLaiTaiKhoan(id),
  chayLaiMoiTaiKhoan: () => {
    const ds = taiKhoan.list().filter((a) => { const sk = dieuPhoi.sucKhoeTk()[a.id]; return sk && sk.muc === 'loi' && a.trangThai !== 'can-dang-nhap'; });
    for (const a of ds) dieuPhoi.chayLaiTaiKhoan(a.id);
    return { ok: true, so: ds.length };
  },
  /** Thư mục Google Drive trên máy (Google Drive cho máy tính) của dự án: hộp chọn thư mục. */
  chonThuMucDrive: async ({ duAn } = {}) => {
    const goiY = timThuMucDrive()[0];
    const r = await dialog.showOpenDialog(win, { title: 'Thư mục Google Drive trên máy (vd G:\\My Drive)', defaultPath: goiY || undefined, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dieuPhoi.datCaiDat({ thuMucDrive: r.filePaths[0] }, duAn);
    return r.filePaths[0];
  },
  timDrive: () => timThuMucDrive(),
  datThuMucDrive: ({ duAn, thuMuc }) => { dieuPhoi.datCaiDat({ thuMucDrive: String(thuMuc || '') }, duAn); return true; },
  taoDuAn: ({ ten, taiKhoan: ds, chaySong, tuDuAn, boLoai }) => dieuPhoi.taoDuAn(ten, ds, chaySong, tuDuAn, boLoai),
  datTaiKhoanDuAn: ({ id, taiKhoan: ds, chaySong, boLoai }) => dieuPhoi.datTaiKhoanDuAn(id, ds, chaySong, boLoai),
  doiTenDuAn: ({ id, ten }) => dieuPhoi.doiTenDuAn(id, ten),
  xoaDuAn: ({ id }) => dieuPhoi.xoaDuAn(id),
  luuNhanVat: (nv) => {
    const id = nv.id || `nv-${Date.now().toString(36)}`;
    dieuPhoi.luuNhanVat({ id, ten: String(nv.ten || '').trim() || 'Nhân vật', moTa: nv.moTa || '',
      anh: chepAnhNhanVat(id, (nv.anh || []).filter((p) => fs.existsSync(p))) });
    return { ok: true, id };
  },
  xoaNhanVat: ({ id }) => {
    dieuPhoi.xoaNhanVat(id);
    try { fs.rmSync(path.join(app.getPath('userData'), 'nhan-vat', id), { recursive: true, force: true }); } catch (_) {}
  },
  luuMauPrompt: ({ ds }) => dieuPhoi.luuMauPrompt(ds),
  // 1.3.0: { duAn, ...cài đặt } → lưu vào cài đặt RIÊNG của dự án đó.
  datHenGio: ({ loai, hen }) => dieuPhoi.datHenGio(loai, hen),
  dungHen: ({ loai }) => dieuPhoi.dungHen(loai),
  datCaiDat: (c) => { const { duAn, ...m } = c || {}; const r = dieuPhoi.datCaiDat(m, duAn); if ('nheMay' in m) datUuTienMoiLuong(); return r; },
  /** 1.4.5: "Lưu làm cài đặt mặc định" — áp cho dự án mới và mọi dự án đang có (giữ thư mục / mẫu tên riêng). */
  datCaiDatMacDinh: (c) => { const { duAn, ...m } = c || {}; const r = dieuPhoi.datMacDinh(m, duAn); if ('nheMay' in m) datUuTienMoiLuong(); return r; },

  themTaiKhoan: ({ ten, nen }) => { const a = taiKhoan.them(ten, nen); baoTrangThai(); return a; },
  suaTaiKhoan: ({ id, thay }) => { taiKhoan.sua(id, thay); baoTrangThai(); },
  xoaTaiKhoan: async ({ id }) => {
    if (dangNhap && dangNhap.id === id) await dongDangNhap(false);
    const r = taiKhoan.xoa(id);
    if (r.ok) { try { await session.fromPartition(r.taiKhoan.partition).clearStorageData(); } catch (_) {} }
    baoTrangThai();
    return r;
  },
  dangXuat: async ({ id }) => {
    const tk = taiKhoan.tim(id);
    if (!tk) return;
    await session.fromPartition(tk.partition).clearStorageData();
    taiKhoan.sua(id, { trangThai: 'can-dang-nhap' });
    log('warning', `🚪 Đã đăng xuất "${tk.ten}"`);
    baoTrangThai();
  },
  kiemTaiKhoan: ({ id }) => kiemTaiKhoan(id, true),
  capNhatToken: () => capNhatToken(),
  xoaChatTaiKhoan: ({ id }) => xoaChat(id),
  /** Xoá chat Muse của các việc đã chọn (việc nào còn đường dẫn chat). */
  xoaChatViec: async ({ ids }) => {
    const ds = dieuPhoi.viec.filter((j) => ids.includes(j.id) && j.thread && j.taiKhoan && j.trangThai !== 'chay');
    let da = 0, hong = 0;
    for (const tkId of new Set(ds.map((j) => j.taiKhoan))) {
      const r = await xoaChat(tkId, ds.filter((j) => j.taiKhoan === tkId).map((j) => j.thread));
      if (!r.ok) return r;
      da += r.da; hong += r.hong;
    }
    dieuPhoi.boThread(ds.map((j) => j.id));
    return { ok: true, da, hong, boQua: ids.length - ds.length };
  },
  moDangNhap: ({ id, khung }) => moDangNhap(id, khung),
  khungDangNhap: ({ khung }) => datKhungDangNhap(khung),
  dongDangNhap: () => dongDangNhap(true),
  xemLuong: ({ bat }) => {
    xemLuong = !!bat;
    for (const w of [...viewCuaLuong.values(), ...tabsFlow.tabs.map((t) => t.view)]) {
      if (w.isDestroyed()) continue;
      w.setSkipTaskbar(!xemLuong);
      if (xemLuong) w.showInactive(); else w.hide();
    }
  },

  chonAnh: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    return r.canceled ? [] : r.filePaths;
  },
  chonThuMucAnh: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return { thuMuc: r.filePaths[0], anh: anhTrongThuMuc(r.filePaths[0]) };
  },
  /** 1.2.9: thư mục lưu video "Ảnh xong → tự tạo video" RIÊNG của một dự án (trang Tạo ảnh). */
  chonThuMucVideoDuAn: async ({ id }) => {
    const r = await dialog.showOpenDialog(win, { title: 'Thư mục lưu video tạo từ ảnh của dự án này', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dieuPhoi.datThuMucVideoDuAn(id, r.filePaths[0]);
    return r.filePaths[0];
  },
  boThuMucVideoDuAn: ({ id }) => dieuPhoi.datThuMucVideoDuAn(id, ''),
  chonThuMucRa: async ({ loai, duAn }) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dieuPhoi.datCaiDat({ [{ video: 'thuMucVideo', nhac: 'thuMucNhac' }[loai] || 'thuMucAnh']: r.filePaths[0] }, duAn);
    return r.filePaths[0];
  },
  // 1.4.3: nút "Quét thư mục…" — chọn thư mục đang có file đánh số làm dở để quét (file mới cũng lưu vào đó).
  chonThuMucQuet: async ({ duAn, loai }) => {
    const d = dieuPhoi.duAn.find((x) => x.id === duAn);
    const truoc = (d && d.thuMucQuet && d.thuMucQuet[loai]) || dieuPhoi.thuMucRa(loai, duAn);
    const ten = { video: 'video', nhac: 'nhạc' }[loai] || 'ảnh';
    const r = await dialog.showOpenDialog(win, { title: `Chọn thư mục đang có ${ten} đánh số làm dở để quét`, defaultPath: truoc || undefined, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    return dieuPhoi.datThuMucQuet(duAn, loai, r.filePaths[0]);
  },
  boThuMucQuet: ({ duAn, loai }) => dieuPhoi.datThuMucQuet(duAn, loai, ''),
  nhapPrompt: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Văn bản', extensions: ['txt', 'csv', 'md'] }] });
    return r.canceled ? null : fs.readFileSync(r.filePaths[0], 'utf8').replace(/^\uFEFF/, '');
  },
  nhapNhieuFile: async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Văn bản', extensions: ['txt', 'csv', 'md'] }] });
    if (r.canceled) return [];
    return r.filePaths.sort(hd.soSanhTuNhien).map((p) => ({
      ten: path.basename(p).replace(/\.[^.]+$/, ''), noiDung: fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
    }));
  },
  luuBanSao: async ({ file }) => {
    if (!file || !fs.existsSync(file)) return { ok: false, loi: 'File không còn' };
    const r = await dialog.showSaveDialog(win, { defaultPath: path.basename(file) });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.copyFileSync(file, r.filePath);
    return { ok: true };
  },
  moFile: ({ file }) => shell.openPath(file),
  hienTrongThuMuc: ({ file }) => { if (file && fs.existsSync(file)) shell.showItemInFolder(file); },
  moThuMuc: ({ dir }) => { fs.mkdirSync(dir, { recursive: true }); return shell.openPath(dir); },
  moThuMucDuLieu: () => shell.openPath(app.getPath('userData')),
  moLink: ({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); },
  tonTai: ({ files }) => (files || []).map((f) => fs.existsSync(f)),
  xoaNhatKy: () => { nhatKy.length = 0; },
  /** Xuất nhật ký đang hiện ra file .txt (người dùng chọn chỗ lưu). */
  xuatNhatKy: async ({ chu }) => {
    const d = new Date(), h = (n) => String(n).padStart(2, '0');
    const ten = `nhat-ky-${d.getFullYear()}${h(d.getMonth() + 1)}${h(d.getDate())}-${h(d.getHours())}${h(d.getMinutes())}.txt`;
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), ten),
      filters: [{ name: 'Văn bản', extensions: ['txt'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const xd = process.platform === 'win32' ? '\r\n' : '\n';
    fs.writeFileSync(r.filePath, '\uFEFF' + String(chu || '').split(/\r?\n/).join(xd) + xd, 'utf8');
    return { ok: true, file: r.filePath };
  },
  /** Hộp chọn thư mục lưu khi tải về hàng loạt (bài kiểm thử thay bằng hàm giả). */
  chonThuMucTai: async ({ soFile }) => {
    const r = await dialog.showOpenDialog(win, { title: `Chọn thư mục lưu ${soFile} file`, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? '' : r.filePaths[0] || '';
  },
  /**
   * Tải về hàng loạt các việc đã chọn vào một thư mục, đặt tên lại theo `mau` (mặc định {stt}).
   * File trên máy còn → chép. Mất (vd việc làm trước 1.0.2, file nằm chỗ khác đã bị xoá) mà việc Muse còn
   * chat → mở lại ĐÚNG chat cũ trong cửa sổ ẩn và lấy file — KHÔNG gửi lại prompt, không tốn lượt.
   */
  taiNhieu: async ({ ids, mau, tuChat = true }) => {
    if (dangTaiNhieu) return { ok: false, loi: 'Đang tải về — đợi lượt trước xong đã' };
    mau = String(mau || '').trim() || hd.MAU_TEN_ANH_MAC_DINH;
    const ke = hd.keHoachTai(dieuPhoi.viec.filter((j) => (ids || []).includes(j.id)), (f) => fs.existsSync(f));
    if (!tuChat) { ke.khongDuoc.push(...ke.tuChat); ke.tuChat = []; }
    const soViec = new Set(ke.coFile.map((x) => x.j)).size + ke.tuChat.length;
    if (!soViec) {
      return { ok: false, loi: ke.chuaXong && !ke.khongDuoc.length ? 'Các việc đã chọn chưa xong' : 'Các việc đã chọn không còn file trên máy, cũng không còn chat Muse để lấy lại' };
    }
    const thuMuc = await LENH.chonThuMucTai({ soFile: soViec });
    if (!thuMuc) return { ok: false };
    dangTaiNhieu = true;
    const daDung = new Set();
    // Không bao giờ ghi đè: trùng tên (file có sẵn, hoặc hai việc cùng số thứ tự) → thêm (2), (3)…
    const dich = (j, mime, i) => {
      const d = dieuPhoi.duAn.find((x) => x.id === j.duAn) || { ten: 'Du_an' };
      const goc = path.join(thuMuc, hd.tenFile(d, j, mime, i, mau));
      let p = goc;
      for (let n = 2; fs.existsSync(p) || daDung.has(p); n++) p = goc.replace(/(\.[^.\\/]+)$/, ` (${n})$1`);
      daDung.add(p);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      return p;
    };
    let da = 0, layLai = 0;
    const hong = [...ke.khongDuoc.map((j) => `#${j.so}: không còn file, cũng không còn chat`)];
    try {
      for (const { j, i, nguon } of ke.coFile) {
        try { fs.copyFileSync(nguon, dich(j, hd.mimeTuDuoi(nguon), i)); da++; } catch (err) { hong.push(`#${j.so}: ${err.message}`); }
      }
      // Lấy lại từ chat: mỗi tài khoản một cửa sổ ẩn, lần lượt từng chat.
      const theoTk = new Map();
      for (const j of ke.tuChat) theoTk.set(j.taiKhoan, [...(theoTk.get(j.taiKhoan) || []), j]);
      for (const [tkId, ds] of theoTk) {
        const tk = taiKhoan.tim(tkId);
        if (!tk) { hong.push(...ds.map((j) => `#${j.so}: tài khoản đã bị xoá khỏi app`)); continue; }
        log('info', `⬇ "${tk.ten}": lấy lại ${ds.length} file từ chat Muse cũ…`);
        const w = taoCuaSoAn(tk, 'Muse · tải lại từ chat');
        const l = new Luong({ id: 'tai-lai', taiKhoan: tk, wc: w.webContents, nguon: NGUON_TRANG, goc: GOC_MUSE, log });
        try {
          for (const j of ds) {
            // Bản sao có thread → luồng chỉ mở chat và chờ lấy kết quả, không bao giờ gửi prompt.
            const r = await l.chay({ ...j, files: [] }, {
              tinNhan: '', files: [], png: dieuPhoi.cd(j.duAn).png, choToiDaGiay: 90, choChuGiay: 30,
              choGui: async () => {}, capNhat: () => {}
            });
            if (!r.ok) { hong.push(`#${j.so}: ${r.loi || 'không lấy được từ chat'}`); continue; }
            const cu = j.files || [];
            const moi = r.files.map((f, i) => { const p = dich(j, f.mime, i); fs.writeFileSync(p, Buffer.from(f.b64, 'base64')); return p; });
            layLai += moi.length;
            da += moi.length;
            // File cũ đã mất → app trỏ sang bản vừa tải để còn xem / nối video.
            j.files = moi.map((p, i) => (cu[i] && fs.existsSync(cu[i]) ? cu[i] : p));
            j.tam = false;
            dieuPhoi.luu();
            log('info', `⬇ #${j.so} lấy lại từ chat → ${moi[0]}`);
          }
        } finally {
          dongCuaSoAn(w);
        }
      }
    } finally {
      dangTaiNhieu = false;
      baoTrangThai();
    }
    for (const h of hong) log('warning', `⬇ ${h}`);
    log(hong.length ? 'warning' : 'success', `⬇ Đã tải ${da} file về ${thuMuc}${layLai ? ` (${layLai} file lấy lại từ chat Muse)` : ''}${hong.length ? ` · ${hong.length} việc không tải được` : ''}`);
    return { ok: true, da, layLai, hong: hong.length, thuMuc };
  },

  kiemCapNhat: () => capNhat && capNhat.kiemTra(),
  caiCapNhat: ({ epBuoc }) => capNhat && capNhat.caiDat({ moLai: true, epBuoc: !!epBuoc })
};

// ── Engine Flow trong các tab Flow (thay chrome.runtime / chrome.storage của tiện ích) ──
ipcMain.handle('flow:message', async (event, message) => {
  try {
    return await mayFlow.handleEngineMessage(message, event.sender);
  } catch (err) {
    log('error', `❌ Lỗi xử lý ${message && message.action}: ${err.message}`);
    return { success: false, ok: false, error: err.message };
  }
});
ipcMain.handle('flow:storage', async (event, { op, arg }) => {
  switch (op) {
    case 'get': {
      // veoSettings là cài đặt của MẺ đang giao cho CHÍNH tab hỏi (mỗi tab một mẻ khác nhau) —
      // engine đọc lại sau mỗi lần tự F5. Lọc selector sai đã bị bỏ trước mẻ (kiem-truoc.js).
      const kq = storeFlow.get(arg);
      const hoi = arg == null || arg === 'veoSettings' || (Array.isArray(arg) && arg.includes('veoSettings')) ||
        (typeof arg === 'object' && !Array.isArray(arg) && 'veoSettings' in arg);
      const tab = tabsFlow.findByWcId(event.sender.id);
      if (hoi && tab && tab.caiDatEngine) kq.veoSettings = tab.caiDatEngine;
      return locVeoSettings(kq);
    }
    case 'set': return storeFlow.set(catVeoProjects(arg)) && undefined;
    case 'remove': return storeFlow.remove(arg) && undefined;
    case 'clear': return undefined;          // không cho engine xoá sạch kho của cả app
    default: return undefined;
  }
});

ipcMain.handle('app', async (_e, lenh, duLieu) => {
  const f = LENH[lenh];
  if (!f) return { ok: false, loi: `Lệnh lạ: ${lenh}` };
  try {
    const r = await f(duLieu || {});
    baoTrangThai();
    return r;
  } catch (err) {
    log('error', `Lỗi lệnh ${lenh}: ${err.message}`);
    return { ok: false, loi: err.message };
  }
});

// ── Cửa sổ ────────────────────────────────────────────────────────────────
function taoCuaSo() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680,
    backgroundColor: '#120f24', title: `AI Automation Studio ${pkg.version}`,
    icon: path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon256.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'src/main/preload-ui.js'), contextIsolation: true, sandbox: false }
  });
  win.loadFile(path.join(__dirname, 'src/ui/index.html'));
  win.webContents.on('did-finish-load', () => baoTrangThai());
  // 1.4.0: thu nhỏ thì thôi báo trạng thái (giao diện không ai xem) — mở lại thì báo ngay.
  win.on('restore', () => { if (boLoBao) baoTrangThai(); });
  // 1.4.4: không dùng app thì giao diện chỉ được báo 2 giây một lần; quay lại app → báo ngay cho khỏi thấy cũ.
  win.on('focus', () => baoNgay());
  // Đóng cửa sổ chính = thoát app (các cửa sổ luồng ẩn không được giữ app sống).
  win.on('closed', () => { win = null; app.quit(); });
}

app.whenReady().then(() => {
  // 1.3.4: du-lieu.json ~2 MB với vài trăm việc, mỗi lần đổi trạng thái là ghi lại cả file (đồng bộ, chặn tiến trình
  // chính) — gom ghi mỗi 1,5 s thay vì 0,25 s. Thoát app vẫn ghi nốt (store.close()).
  store = new Store(path.join(app.getPath('userData'), 'du-lieu.json'), (m) => log('warning', m), { nhipMs: 1500 });
  taiKhoan = new QuanLyTaiKhoan(store, log);

  // ── Google Flow: kho của engine (thay chrome.storage.local), tab ngầm, tải về, "background" ──
  // 1.4.5: kho engine Flow gom ghi 1 giây (engine lưu dự án gần như mỗi lần prompt đổi trạng thái), không thụt lề.
  storeFlow = new Store(path.join(app.getPath('userData'), 'flow-engine.json'), (m) => log('warning', m), { nhipMs: 1000 });
  storeFlow.prettyPrint = false;
  donKhoFlow();
  tabsFlow = new QuanLyTabFlow({
    taoCuaSo: (acc, tieuDe) => { const w = taoCuaSoAn(acc, tieuDe); if (xemLuong) w.showInactive(); return w; },
    dongCuaSo: dongCuaSoAn, log,
    // Chỉ dùng cho kiểm thử: FLOW_TEST_NGUON=<module> thay engine / trình tiêm bằng bản giả.
    nguon: process.env.FLOW_TEST_NGUON ? require(path.resolve(process.env.FLOW_TEST_NGUON)) : undefined
  });
  taiVeFlow = new DownloadManager({
    getSettings: () => ({}),
    findTabByWcId: (id) => tabsFlow.findByWcId(id),
    dirForTab: (tab) => (tab && tab.thuMucTai) || path.join(app.getPath('userData'), 'flow-tai-tam', 'khac'),
    log: (muc, chu) => { if (muc !== 'success') log(muc, chu); },
    notifyTab: (tabId, payload) => {
      const t = tabsFlow.find(tabId);
      if (t && payload && payload.action === 'DOWNLOAD_DONE') {
        if (t.onTai) { try { t.onTai(payload.path); } catch (err) { log('error', err.message); } }
        setTimeout(() => mayFlow.theoDoiAnhThamChieu(t, 'tải về').catch(() => {}), 800);
      }
      return tabsFlow.dispatch(tabId, payload);
    }
  });
  mayFlow = taoMayFlow({
    tabs: tabsFlow, taiVe: taiVeFlow, log,
    layCaiDat: () => dieuPhoi.caiDat.flow,
    conViec: () => dieuPhoi.viec.some((j) => j.trangThai === 'cho' || j.trangThai === 'chay'),
    thongBao: () => {},
    // Tài khoản Flow lỗi: dự án còn tài khoản Flow khác (hoặc ảnh chuyển được sang Muse) → cho nghỉ, dừng tab của nó,
    // việc sang tài khoản khác ngay (như Muse).
    nghiTaiKhoan: (tkId, ms, lyDo) => {
      if (!dieuPhoi.coDuPhong(tkId)) return false;
      dieuPhoi._choNghi(tkId, lyDo, ms);
      for (const x of dieuPhoi.luong) if (x.taiKhoanId === tkId && !x.luong.ranh) x.luong.dung(lyDo);
      return true;
    },
    nghiCaMay: (ms, lyDo, tru) => dieuPhoi.nghiCaFlow(ms, lyDo, tru)
  });

  dieuPhoi = new DieuPhoi({
    store, taiKhoan, taoLuong, huyLuong, docFile, ghiFile, chuyenFile, log, bao: baoTrangThai,
    thuMucRaMacDinh: path.join(app.getPath('documents'), 'AI Automation Studio'),
    thuMucTam: path.join(app.getPath('userData'), 'ket-qua-tam'),
    tonTai: (p) => fs.existsSync(p),
    // 1.4.2: quét thư mục lưu (tìm số đã có file) — đường dẫn tương đối "/", sâu tối đa 3 cấp thư mục con.
    dsFile: (goc) => {
      const ra = [];
      const di = (thuMuc, tien, sau) => {
        let ds = [];
        try { ds = fs.readdirSync(thuMuc, { withFileTypes: true }); } catch (_) { return; }
        for (const e of ds) {
          if (ra.length >= 200000) return;
          if (e.isFile()) ra.push(tien + e.name);
          else if (e.isDirectory() && sau > 0) di(path.join(thuMuc, e.name), `${tien}${e.name}/`, sau - 1);
        }
      };
      if (goc) di(goc, '', 3);
      return ra;
    },
    donDep: (don) => donDep(don),
    lenDrive: (x) => chepLenDrive(x),                                   // 1.4.0
    lenDriveWeb: (x) => lenDriveWeb(x),
    chayLaiFlow: (id) => mayFlow && mayFlow.chayLaiNgay && mayFlow.chayLaiNgay(id),
    // 1.3.7: Flow cho tài khoản nghỉ mà dự án không còn tài khoản Flow nào khác (máy Flow tự tạm dừng tab) → thẻ tài khoản đỏ.
    nghiFlow: (id) => {
      const so = mayFlow && mayFlow.soAnToanCua ? mayFlow.soAnToanCua(id) : null;
      return so && so.dangNghi ? { den: so.nghiDen, lyDo: so.lyDoNghi || 'Flow báo lỗi, tự chạy lại khi hết giờ nghỉ' } : null;
    },
    hetLuot: () => {
      if (dieuPhoi.caiDat.tatMayKhiXong) mayFlow.handleEngineMessage({ action: 'TRIGGER_SHUTDOWN', delay: 60 }, { id: -1 });
      if (taiKhoan.ds.some((a) => a.nen === 'muse')) capNhatToken();   // chạy xong hàng chờ → cập nhật mức token Muse
    }
  });

  capNhat = new BoCapNhat({
    phienBan: pkg.version, repo: layRepo(pkg), platform: process.platform, arch: process.arch,
    execPath: process.execPath, isPackaged: app.isPackaged, env: process.env,
    thuMuc: app.getPath('userData'), apiGoc: process.env.MUSE_UPDATE_API,
    fetch: (u, o) => net.fetch(u, o), spawn,
    execFile: (c, a) => new Promise((r, j) => execFile(c, a, (e, out) => (e ? j(e) : r(out)))),
    thoatApp: () => app.quit(), moFinder: (p) => shell.showItemInFolder(p), moLink: (u) => shell.openExternal(u),
    coTabDangChay: () => dieuPhoi.coViecDangChay(), log, gui: () => baoTrangThai()
  });

  taoCuaSo();
  log('info', `AI Automation Studio ${pkg.version} đã mở. Dữ liệu: ${app.getPath('userData')}`);
  // 1.4.0: rà ưu tiên CPU của các trang chạy ngầm (trang mới / bật tắt "máy mượt").
  setInterval(datUuTienMoiLuong, 15000);
  // 1.3.4: RAM từng phần vào nhật ký mỗi 10 phút khi đang chạy (MUSE_RAM_MS đổi nhịp cho bài kiểm).
  setInterval(() => { try { if (dieuPhoi.dangChay || dieuPhoi.luong.length) baoRam(); } catch (_) {} },
    parseInt(process.env.MUSE_RAM_MS, 10) || 10 * 60 * 1000);

  // 1.3.6: có hẹn giờ đang bật (hoặc đang chạy theo hẹn) → giữ máy không tự ngủ, để tới giờ app còn chạy được.
  // Chỉ chặn máy NGỦ (màn hình vẫn tắt bình thường); tắt hết hẹn thì thôi chặn.
  let chanNgu = -1;
  const xetChanNgu = () => {
    try {
      const can = Object.values(dieuPhoi.henGio).some((h) => h.bat) || dieuPhoi.loaiChay.size > 0;
      if (can && chanNgu < 0) { chanNgu = powerSaveBlocker.start('prevent-app-suspension'); log('info', '⏰ Có hẹn giờ chạy: giữ máy không tự ngủ để tới giờ app chạy được.'); }
      else if (!can && chanNgu >= 0) { powerSaveBlocker.stop(chanNgu); chanNgu = -1; }
    } catch (_) {}
  };
  xetChanNgu();
  setInterval(xetChanNgu, 15000);

  if (!process.env.MUSE_NO_UPDATE_CHECK) {
    setTimeout(() => capNhat.kiemTra({ imLang: true }), 5000);
    setInterval(() => capNhat.kiemTra({ imLang: true }), 4 * 3600 * 1000);
  }
  // Bài kiểm thử: MUSE_TEST=tests/<bài>.js nhận đúng các đối tượng app đang dùng.
  if (process.env.MUSE_TEST) require(path.resolve(process.env.MUSE_TEST))({ win, app, LENH, dieuPhoi, taiKhoan, nhatKy, tabsFlow, mayFlow, storeFlow, docRam, baoRam, store });
});

let dangThoat = false;       // đang cài bản mới lúc thoát
let appDangThoat = false;    // app đang thoát → cửa sổ luồng được đóng thật (không chỉ ẩn)
app.on('before-quit', (e) => {
  appDangThoat = true;
  if (dangThoat) return;
  if (capNhat && capNhat.nenCaiKhiThoat()) {
    e.preventDefault();
    dangThoat = true;
    capNhat.caiDat({ moLai: false, epBuoc: true, thoat: true }).then((r) => { if (!r.ok) app.exit(0); });
    return;
  }
  try { dieuPhoi && dieuPhoi.dong(); } catch (_) {}
  try { tabsFlow && tabsFlow.closeAll(); } catch (_) {}
  try { store && store.close(); } catch (_) {}
  try { storeFlow && storeFlow.close(); } catch (_) {}
  ghiNhatKyNgay();
});

app.on('window-all-closed', () => app.quit());
