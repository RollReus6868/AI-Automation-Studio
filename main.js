'use strict';
// ============================================================================
//  AI Automation Studio — tiến trình chính (Electron)
//  Gộp Muse Automation Studio + Flow Automation Studio: MỘT hàng đợi chung,
//  hai nền tảng. Cửa sổ giao diện + các luồng chạy ngầm (mỗi luồng một cửa sổ
//  ẩn trong phiên của tài khoản: muse.ai hoặc Google Flow) + đăng nhập + file
//  + cập nhật. Phần "background" của engine Flow nằm ở src/flow/may-flow.js.
// ============================================================================

const { app, BrowserWindow, WebContentsView, ipcMain, session, dialog, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const pkg = require('./package.json');
const { Store } = require('./src/main/store');
const { QuanLyTaiKhoan } = require('./src/main/tai-khoan');
const { DieuPhoi } = require('./src/main/dieu-phoi');
const { Luong } = require('./src/main/luong');
const { BoCapNhat, layRepo } = require('./src/main/cap-nhat');
const hd = require('./src/main/hang-doi');
const { QuanLyTabFlow, FLOW_URL } = require('./src/flow/tab-flow');
const { taoMayFlow } = require('./src/flow/may-flow');
const { LuongFlow } = require('./src/flow/luong-flow');
const { DownloadManager } = require('./src/flow/main/downloads');
const { locVeoSettings } = require('./src/flow/main/kiem-truoc');
const { xoaDuAnFlow } = require('./src/flow/main/xoa-du-an');

// Thư mục dữ liệu riêng (phiên đăng nhập, cài đặt, hàng đợi) — PHẢI trước whenReady.
app.setPath('userData', process.env.MUSE_DATA_DIR ||
  path.join(app.getPath('appData'), 'AIAutomationStudio'));

const GOC_MUSE = (process.env.MUSE_URL || 'https://muse.ai').replace(/\/$/, '');
const NGUON_TRANG = fs.readFileSync(path.join(__dirname, 'src/inject/muse-trang.js'), 'utf8');
const DUOI_ANH = /\.(png|jpe?g|webp|gif|bmp)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };

let win = null;
let store, storeFlow, taiKhoan, dieuPhoi, capNhat, tabsFlow, mayFlow, taiVeFlow;
const nhatKy = [];
let henBao = null;

// ── Nhật ký + đẩy trạng thái cho giao diện ─────────────────────────────────
function log(muc, chu) {
  const dong = { t: Date.now(), muc, chu: String(chu) };
  nhatKy.push(dong);
  if (nhatKy.length > 800) nhatKy.splice(0, nhatKy.length - 800);
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'nhat-ky.txt'),
    `${new Date(dong.t).toISOString()} [${muc}] ${dong.chu}\n`); } catch (_) {}
  if (win && !win.isDestroyed()) win.webContents.send('log', dong);
}

function baoTrangThai() {
  if (henBao) return;
  henBao = setTimeout(() => {
    henBao = null;
    if (!win || win.isDestroyed() || !dieuPhoi) return;
    win.webContents.send('state', trangThai());
  }, 150);
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
    if (tk.nen === 'flow') {
      // Google Flow: giữ nguyên phiên như Flow Automation Studio (đã chạy thật). Tải về theo TỪNG
      // tab: Electron đưa webContents vào will-download nên biết chắc file nào của tab nào.
      taiVeFlow.attach(ses);
    } else {
      // Bỏ chữ "Electron/…" khỏi user agent: nhiều trang chặn đăng nhập trong webview.
      // Xin Muse giao diện tiếng Anh (nhãn đã đo); Muse vẫn hiện tiếng Việt thì muse-trang.js cũng hiểu.
      ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|AIAutomationStudio|ai-automation-studio|MuseAutomationStudio|muse-automation-studio)\/\S+/gi, ''), 'en-US,en');
    }
  }
  return ses;
}

const WEB_PREFS = (tk) => (tk.nen === 'flow'
  // Engine Flow chạy trong main world, nói chuyện với tiến trình chính qua preload-flow.js (contextBridge).
  ? { session: phien(tk), preload: path.join(__dirname, 'src/flow/main/preload-flow.js'), backgroundThrottling: false,
    contextIsolation: true, nodeIntegration: false, sandbox: false }
  : { session: phien(tk), backgroundThrottling: false, contextIsolation: true, sandbox: true });
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

// ── Luồng chạy ngầm ───────────────────────────────────────────────────────
const viewCuaLuong = new Map();
let xemLuong = !!process.env.MUSE_SHOW_LANES;

function taoLuong(tk, stt) {
  const id = `${tk.ten} · L${stt}`;
  if (tk.nen === 'flow') {
    return new LuongFlow({ id, taiKhoan: tk, tabs: tabsFlow, may: mayFlow, log,
      thuMucTam: path.join(app.getPath('userData'), 'flow-tai-tam', slugThuMuc(`${tk.id}-${stt}`)),
      docAnh, luuUrl: (tkId, url) => {
        taiKhoan.sua(tkId, { flowUrl: url });
        if (taiKhoan.tim(tkId).flowUrl === url) log('info', `📁 Nhớ trang dự án Flow của "${tk.ten}": ${url}`);
        baoTrangThai();
      } });
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
  v.webContents.loadURL(tk.nen === 'flow' ? (tk.flowUrl || FLOW_URL) : GOC_MUSE).catch(() => {});
  baoTrangThai();
  return { ok: true };
}

function datKhungDangNhap(k) {
  if (!dangNhap || !k) return;
  dangNhap.view.setBounds({ x: Math.round(k.x), y: Math.round(k.y),
    width: Math.max(200, Math.round(k.width)), height: Math.max(200, Math.round(k.height)) });
}

async function dongDangNhap(kiem = true) {
  if (!dangNhap) return;
  const { id, view } = dangNhap;
  dangNhap = null;
  const tk = taiKhoan.tim(id);
  if (kiem && tk && tk.nen === 'flow') {
    // Người dùng đang mở một dự án Flow lúc bấm Xong → luồng chạy đúng dự án đó.
    const url = view.webContents.getURL();
    if (/\/project\//.test(url) && url !== tk.flowUrl) {
      taiKhoan.sua(id, { flowUrl: url });
      if (taiKhoan.tim(id).flowUrl === url) log('info', `📁 Nhớ trang dự án Flow của "${tk.ten}": ${url}`);
      else log('warning', `⚠ Không nhận được địa chỉ dự án Flow "${url}" — báo cho người phát triển.`);
    }
    await kiemTaiKhoan(id);
  } else if (kiem) {
    const tt = await docTrangThai(view.webContents, 4000);
    if (tt) taiKhoan.sua(id, { trangThai: tt.coONhap ? 'da-dang-nhap' : 'can-dang-nhap' });
  }
  try { win.contentView.removeChildView(view); } catch (_) {}
  try { view.webContents.close(); } catch (_) {}
  baoTrangThai();
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
  try {
    const cookies = await phien(tk).cookies.get({ domain: '.google.com' });
    return cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID');
  } catch (_) { return false; }
}

async function kiemTaiKhoan(id) {
  const tk = taiKhoan.tim(id);
  if (!tk) return null;
  if (tk.nen === 'flow') {
    const co = await daDangNhapFlow(tk);
    taiKhoan.sua(id, { trangThai: co ? 'da-dang-nhap' : 'can-dang-nhap' });
    log(co ? 'success' : 'warning', `👤 "${tk.ten}": ${co ? 'đã đăng nhập Google' : 'CHƯA đăng nhập Google'}` +
      (co ? (tk.flowUrl ? ` · dự án Flow: ${tk.flowUrl}` : ' · chưa chọn dự án Flow (app sẽ tự mở dự án mới)') : ''));
    baoTrangThai();
    return co ? 'da-dang-nhap' : 'can-dang-nhap';
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
    try { for (const a of taiKhoan.list()) if (a.nen !== 'flow') await kiemTaiKhoan(a.id); } finally { dangCapNhatToken = null; }
  })();
  return dangCapNhatToken;
}

/**
 * Xoá đoạn chat trên Muse của một tài khoản (cửa sổ ẩn riêng).
 * @param threads  [url…] chỉ xoá các chat đó; bỏ trống → xoá MỌI chat phụ ("Main chat" Muse không cho xoá).
 */
let dangXoaChat = false;
async function xoaChat(id, threads) {
  const tk = taiKhoan.tim(id);
  if (!tk) return { ok: false, loi: 'Không tìm thấy tài khoản' };
  if (tk.nen === 'flow') return { ok: false, loi: 'Xoá chat chỉ dành cho tài khoản Muse' };
  if (dangXoaChat) return { ok: false, loi: 'Đang xoá chat — đợi xong đã' };
  if (!threads && dieuPhoi.coViecDangChay()) return { ok: false, loi: 'Đang chạy hàng chờ — bấm Dừng trước khi xoá toàn bộ chat' };
  dangXoaChat = true;
  const w = taoCuaSoAn(tk, 'Muse · xoá đoạn chat');
  const wc = w.webContents;
  const mo = async (url) => { wc.loadURL(url).catch(() => {}); const tt = await docTrangThai(wc, 25000); return !!(tt && tt.coONhap); };
  let da = 0, hong = 0;
  try {
    if (threads) {
      for (const url of threads) {
        const r = (await mo(url)) ? await wc.executeJavaScript('window.__muse.xoaChatDangMo()', true).catch(() => null) : null;
        if (r && r.ok) da++; else hong++;
      }
    } else {
      if (!(await mo(GOC_MUSE))) return { ok: false, loi: 'Không mở được Muse (chưa đăng nhập?)' };
      for (;;) {
        const r = await wc.executeJavaScript('window.__muse.xoaNhieuChat({ toiDa: 10 })', true).catch(() => null);
        if (r) da += r.da;
        if (!r || !r.ok) { hong++; break; }
        if (!r.da) break;
        log('info', `🗑 "${tk.ten}": đã xoá ${da} đoạn chat…`);
      }
    }
  } finally {
    dongCuaSoAn(w);
    dangXoaChat = false;
  }
  log(hong ? 'warning' : 'success', `🗑 "${tk.ten}": đã xoá ${da} đoạn chat trên Muse${hong ? ` · ${hong} không xoá được` : ''}`);
  return { ok: true, da, hong };
}

/**
 * Chạy hết hàng chờ → dọn theo tuỳ chọn trong Cài đặt: xoá chat Muse của các việc đã xong, xoá dự án
 * Flow đã dùng (lần chạy sau app tự mở dự án mới). Lỗi chỉ ghi nhật ký, không chặn tắt máy.
 */
async function donDep({ muse, flow }) {
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
    if (!tk || !tk.flowUrl) continue;
    // Đợi luồng Flow của tài khoản đóng tab (điều phối đóng ở nhịp kế tiếp) — tab còn mở trên dự án
    // sẽ nhớ lại đúng địa chỉ dự án vừa xoá.
    for (let i = 0; i < 20 && dieuPhoi.luong.some((x) => x.taiKhoanId === tkId); i++) await new Promise((r) => setTimeout(r, 500));
    if (dieuPhoi.dangChay) { log('warning', `⚠ "${tk.ten}": hàng chờ đang chạy lại — bỏ qua tự xoá dự án Flow.`); continue; }
    log('info', `🗑 "${tk.ten}": tự xoá dự án Flow ${tk.flowUrl}…`);
    const r = await xoaDuAnFlow(tk.flowUrl, {
      taoCuaSo: () => taoCuaSoAn(tk, 'Flow · xoá dự án'), dongCuaSo: dongCuaSoAn, trangChu: FLOW_URL,
      choMs: Number(process.env.FLOW_CHO_SAN_SANG_MS) || 25000
    });
    if (r.ok) {
      taiKhoan.sua(tkId, { flowUrl: '' });
      dieuPhoi.boFlowTen(tkId);
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
  chay: () => dieuPhoi.chayTatCa(),
  dung: () => dieuPhoi.dungTatCa(),
  taoLai: ({ ids }) => dieuPhoi.taoLai(ids),
  xoaViec: ({ ids }) => dieuPhoi.xoaViec(ids),
  suaViec: ({ id, thay }) => dieuPhoi.suaViec(id, thay),
  taoDuAn: ({ ten, taiKhoan: ds }) => dieuPhoi.taoDuAn(ten, ds),
  datTaiKhoanDuAn: ({ id, taiKhoan: ds }) => dieuPhoi.datTaiKhoanDuAn(id, ds),
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
  datCaiDat: (c) => dieuPhoi.datCaiDat(c),

  themTaiKhoan: ({ ten, nen }) => { const a = taiKhoan.them(ten, nen); baoTrangThai(); return a; },
  suaTaiKhoan: ({ id, thay }) => { taiKhoan.sua(id, thay); baoTrangThai(); },
  xoaTaiKhoan: async ({ id }) => {
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
  kiemTaiKhoan: ({ id }) => kiemTaiKhoan(id),
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
  chonThuMucRa: async ({ loai }) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dieuPhoi.datCaiDat({ [loai === 'video' ? 'thuMucVideo' : 'thuMucAnh']: r.filePaths[0] });
    return r.filePaths[0];
  },
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
  /** Tải về hàng loạt: chép file kết quả của các việc đã chọn vào một thư mục người dùng chọn. */
  taiNhieu: async ({ ids }) => {
    const files = dieuPhoi.viec.filter((j) => ids.includes(j.id)).flatMap((j) => j.files || []).filter((f) => fs.existsSync(f));
    if (!files.length) return { ok: false, loi: 'Các việc đã chọn chưa có file kết quả nào' };
    const r = await dialog.showOpenDialog(win, { title: `Chọn thư mục lưu ${files.length} file`, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    let da = 0;
    for (const f of files) {
      let dich = path.join(r.filePaths[0], path.basename(f));
      if (path.resolve(dich) === path.resolve(f)) { da++; continue; }
      for (let n = 2; fs.existsSync(dich); n++) dich = path.join(r.filePaths[0], path.basename(f).replace(/(\.[^.]+)?$/, ` (${n})$1`));
      fs.copyFileSync(f, dich);
      da++;
    }
    log('success', `⬇ Đã tải ${da} file về ${r.filePaths[0]}`);
    return { ok: true, da, thuMuc: r.filePaths[0] };
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
    case 'set': return storeFlow.set(arg) && undefined;
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
  // Đóng cửa sổ chính = thoát app (các cửa sổ luồng ẩn không được giữ app sống).
  win.on('closed', () => { win = null; app.quit(); });
}

app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'du-lieu.json'), (m) => log('warning', m));
  taiKhoan = new QuanLyTaiKhoan(store, log);

  // ── Google Flow: kho của engine (thay chrome.storage.local), tab ngầm, tải về, "background" ──
  storeFlow = new Store(path.join(app.getPath('userData'), 'flow-engine.json'), (m) => log('warning', m));
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
    // Flow nhắc tài khoản này: dự án còn tài khoản dự phòng → cho nghỉ, việc sang dự phòng ngay (như Muse).
    nghiTaiKhoan: (tkId, ms, lyDo) => {
      if (!dieuPhoi.coDuPhong(tkId)) return false;
      dieuPhoi._choNghi(tkId, lyDo, ms);
      for (const x of dieuPhoi.luong) if (x.taiKhoanId === tkId && !x.luong.ranh) x.luong.dung(lyDo);
      return true;
    }
  });

  dieuPhoi = new DieuPhoi({
    store, taiKhoan, taoLuong, huyLuong, docFile, ghiFile, chuyenFile, log, bao: baoTrangThai,
    thuMucRaMacDinh: path.join(app.getPath('documents'), 'AI Automation Studio'),
    thuMucTam: path.join(app.getPath('userData'), 'ket-qua-tam'),
    tonTai: (p) => fs.existsSync(p),
    donDep: (don) => donDep(don),
    hetLuot: () => {
      if (dieuPhoi.caiDat.tatMayKhiXong) mayFlow.handleEngineMessage({ action: 'TRIGGER_SHUTDOWN', delay: 60 }, { id: -1 });
      if (taiKhoan.ds.some((a) => a.nen !== 'flow')) capNhatToken();   // chạy xong hàng chờ → cập nhật mức token Muse
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

  if (!process.env.MUSE_NO_UPDATE_CHECK) {
    setTimeout(() => capNhat.kiemTra({ imLang: true }), 5000);
    setInterval(() => capNhat.kiemTra({ imLang: true }), 4 * 3600 * 1000);
  }
  // Bài kiểm thử: MUSE_TEST=tests/<bài>.js nhận đúng các đối tượng app đang dùng.
  if (process.env.MUSE_TEST) require(path.resolve(process.env.MUSE_TEST))({ win, app, LENH, dieuPhoi, taiKhoan, nhatKy, tabsFlow, mayFlow, storeFlow });
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
});

app.on('window-all-closed', () => app.quit());
