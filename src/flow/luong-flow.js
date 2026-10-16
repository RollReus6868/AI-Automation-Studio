'use strict';
// ============================================================================
//  luong-flow.js — MỘT LUỒNG FLOW = một tab Google Flow chạy ngầm của một tài
//  khoản. Khác luồng Muse (mỗi lần một prompt): luồng Flow nhận cả MẺ việc
//  cùng dự án / loại / tỷ lệ, giao một lệnh START_AUTOMATION cho engine Flow
//  (engine tự dán, bấm Tạo, chờ, thử lại, tải về) rồi đọc bảng tiến độ của
//  engine để báo xong / lỗi TỪNG việc về hàng đợi.
//
//  Cách biết file nào của việc nào: app ép renameMode = custom_list với tên
//  = mã việc (vd Du_an_007). DownloadManager lưu file vào thư mục tạm của mẻ,
//  báo DOWNLOAD_DONE kèm đường dẫn → tra tên → việc.
//
//  Engine tự F5 cuối mẻ (đồng bộ tên lên Flow) rồi tự chạy tiếp: tab-flow.js
//  tiêm lại, engine đọc dự án dở trong flow-engine.json, chạy nốt rồi mới báo
//  AUTOMATION_STOPPED. Luồng chỉ cần đợi — không làm gì khi trang tải lại.
//
//  Không require('electron').
// ============================================================================

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const hd = require('../main/hang-doi');
const { FLOW_URL, FLOW_HOST_RE, moPhongBi } = require('./tab-flow');
const { caiDatEngine, chuanHoaFlow } = require('./cai-dat-flow');
const { buildStartMessage } = require('./main/jobs');
const nhipTT = require('./main/nhip-thao-tac');
const taiAnhLenMd = require('./main/tai-anh-len');
const thamChieuMd = require('./main/anh-tham-chieu');

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

const CO_O_NHAP = `!!document.querySelector('.ProseMirror[contenteditable="true"], [data-slate-editor="true"][contenteditable="true"], [role="textbox"][contenteditable="true"]')`;
// Trang chủ Flow (chưa vào dự án): bấm "Dự án mới". Nút của Flow có biểu tượng chữ (vd "add_2") đứng trước
// nhãn → so phần CUỐI chữ của nút. Không tìm thấy thì thôi — người dùng mở dự án khi đăng nhập.
const BAM_DU_AN_MOI = `(() => {
  const re = /(^|\\s)(new project|dự án mới|tạo dự án( mới)?)$/i;
  const chu = (e) => String(e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim();
  const ds = [...document.querySelectorAll('button, a, [role="button"]')].filter((e) => e.offsetParent && chu(e).length <= 40);
  const nut = ds.find((e) => re.test(chu(e)));
  if (!nut) return false;
  const r = nut.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) nut.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
  nut.click();
  return true;
})()`;
// Hết giờ mà chưa vào được dự án: chụp lại thứ đang thấy để lần sau đọc nhật ký là biết vì sao.
const CHAN_DOAN_TRANG = `(() => ({
  url: location.href,
  oNhap: [...document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]')].filter((e) => e.offsetParent)
    .map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(/\\s+/).slice(0, 2).join('.') : '')).slice(0, 5),
  nut: [...document.querySelectorAll('button, a, [role="button"]')].filter((e) => e.offsetParent)
    .map((e) => String(e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 12)
}))()`;

const TRANG_THAI_BUOC = { WAITING: 'Chờ trong mẻ Flow', PASTING: 'Đang dán prompt', CREATING: 'Flow đang tạo', COMPLETED: 'Đang tải về' };

/** Mã ảnh cho Character Sync: chỉ [A-Za-z0-9_] (thẻ @ của engine dừng ở ký tự khác). */
function maAnh(duongDan) {
  const goc = hd.slugTen(path.basename(String(duongDan)).replace(/\.[^.]+$/, '')).slice(0, 30);
  const bam = crypto.createHash('md5').update(String(duongDan)).digest('hex').slice(0, 6);
  return `${goc}_${bam}`;
}

class LuongFlow {
  /**
   * @param o.id, o.taiKhoan  ({id, ten, flowUrl})
   * @param o.tabs   QuanLyTabFlow       o.may  máy Flow (may-flow.js)
   * @param o.thuMucTam   thư mục tải tạm của luồng
   * @param o.docAnh(duongDan) → {dataUrl, name, type}
   * @param o.luuUrl(taiKhoanId, url)   nhớ trang dự án Flow của tài khoản
   * @param o.log(muc, chu)
   * @param o.thuMucChanDoan   nơi lưu tệp chẩn đoán HTML khi tải / dò ảnh trên Flow hỏng (1.2.2)
   */
  constructor(o) {
    Object.assign(this, { id: o.id, taiKhoan: o.taiKhoan, tabs: o.tabs, may: o.may, thuMucTam: o.thuMucTam,
      docAnh: o.docAnh, luuUrl: o.luuUrl || (() => {}), log: o.log || (() => {}), thuMucChanDoan: o.thuMucChanDoan || '' });
    this.taiAnhLen = o.taiAnhLen || taiAnhLenMd.taiAnhLen;   // thay được trong bài kiểm
    this.nen = 'flow';
    this.tab = null;
    this.dsViec = null;
    this.huy = 0;
    this.choSanSangMs = Number(process.env.FLOW_CHO_SAN_SANG_MS) || 120000;
    this.dungYenMs = Number(process.env.FLOW_DUNG_YEN_MS) || 10 * 60000;
    // Flow báo tạo xong mà quá chừng này chưa tải về được → thôi chờ, việc sang tài khoản khác (engine tự
    // "Audit" thử tải lại tới ~16 phút — nhật ký 16/10/2026).
    this.choTaiMs = Number(process.env.FLOW_CHO_TAI_MS) || 5 * 60000;
  }

  get ranh() { return !this.dsViec; }
  /** Việc đầu mẻ — để giao diện / điều phối dùng chung chỗ đọc với luồng Muse. */
  get viec() { return this.dsViec ? this.dsViec[0] : null; }

  dung(lyDo) {
    this.huy++;
    this.lyDoDung = lyDo || '';
    const t = this.tab;
    if (t && this.dsViec) {
      t.nghiAnToan = false;
      nhipTT.huy(t);      // cắt ngang khoảng nghỉ giữa thao tác đang chờ — kẻo dán prompt cũ sau khi đã dừng
      this.tabs.dispatch(t.id, { action: 'STOP_AUTOMATION' }).catch(() => {});
      // Engine không trả lời (trang đang tải lại…) thì 6 giây sau tự kết thúc mẻ.
      setTimeout(() => { if (this._ketMe) this._ketMe('dung'); }, 6000);
    }
  }

  dong() {
    this.dung();
    if (this.tab) { this.tabs.close(this.tab.id); this.tab = null; }
  }

  // ── Mở tab và đợi engine bám được trang DỰ ÁN (có ô nhập prompt) ──────────
  async _damBaoTab(huyLuc) {
    if (!this.tab || !this.tabs.find(this.tab.id)) {
      this.tab = this.tabs.taoTab(this.taiKhoan, this.taiKhoan.flowUrl || FLOW_URL, `Flow · ${this.id}`);
    }
    const t = this.tab;
    const wc = t.view.webContents;
    const het = Date.now() + this.choSanSangMs;
    let lanBam = 0, ngoaiFlow = 0;
    // Tab cũ còn nằm ở trang chủ mà tài khoản đã có dự án (người dùng vừa đăng nhập + bấm Xong) → mở thẳng dự án.
    const urlNay = wc.getURL();
    if (this.taiKhoan.flowUrl && urlNay && !/\/project\//.test(urlNay)) wc.loadURL(this.taiKhoan.flowUrl).catch(() => {});
    while (Date.now() < het) {
      if (this.huy !== huyLuc) return { dung: true };
      if (wc.isDestroyed()) { this.tab = null; return { ok: false, loi: 'Tab Flow đã bị đóng' }; }
      const url = wc.getURL();
      if (url && !wc.isLoading() && !FLOW_HOST_RE.test(url)) {
        // Google đưa sang trang đăng nhập → tài khoản chưa đăng nhập Flow.
        if (++ngoaiFlow >= 8 && /accounts\.google\.com|signin|ServiceLogin/i.test(url)) return { canDangNhap: true };
      } else ngoaiFlow = 0;
      if (t.ready) {
        const coONhap = await wc.executeJavaScript(CO_O_NHAP, true).catch(() => false);
        if (coONhap) {
          if (/\/project\//.test(url) && url !== this.taiKhoan.flowUrl) {
            this.taiKhoan.flowUrl = url;
            this.luuUrl(this.taiKhoan.id, url);
          }
          return { ok: true };
        }
        if (!/\/project\//.test(url) && Date.now() - lanBam > 10000) {
          lanBam = Date.now();
          const bam = await wc.executeJavaScript(BAM_DU_AN_MOI, true).catch(() => false);
          if (bam) this.log('info', `📁 [${this.id}] Mở dự án Flow mới cho tài khoản này.`);
        }
      }
      await cho(1000);
    }
    const cd = await wc.executeJavaScript(CHAN_DOAN_TRANG, true).catch(() => null);
    this.log('warning', `🔎 [${this.id}] Chưa vào được dự án Flow — tab đang ở ${cd ? cd.url : wc.getURL()}` +
      (t.ready ? '' : ' (engine chưa bám được trang)') +
      (cd ? ` · ô nhập thấy: ${cd.oNhap.join(', ') || 'không có'} · nút: ${cd.nut.join(' | ')}` : ''));
    return { ok: false, loi: `Không vào được trang dự án Flow sau ${Math.round(this.choSanSangMs / 1000)} giây` +
      ' (mục Tài khoản → Đăng nhập → mở một dự án Flow rồi bấm Xong)' };
  }

  // ── Ảnh nguồn / ảnh nhân vật: đảm bảo có trong kho Flow, trả mã @ cho từng việc ──
  async _ganAnh(ds, ctx, huyLuc) {
    const t = this.tab;
    const maCua = new Map();     // việc → [mã]
    const canCo = new Map();     // mã → đường dẫn (cần có trong kho Flow)
    for (const j of ds) {
      const anh = ctx.anhCua(j);
      if (!anh.length) continue;
      const ma = anh.map((p) => {
        // Ảnh nguồn do Flow tạo trên CHÍNH tài khoản này → dùng luôn tên trên Flow, khỏi tải lên lại.
        if (j.flowAnh && j.flowAnh.tk === this.taiKhoan.id && j.flowAnh.file === p && j.flowAnh.ten) return j.flowAnh.ten;
        return maAnh(p);
      });
      ma.forEach((m, i) => canCo.set(m, anh[i]));
      maCua.set(j, ma);
    }
    if (!canCo.size) return { maCua, hong: new Map() };
    const kiem = async () => {
      const r = moPhongBi(await this.tabs.dispatch(t.id, { action: 'CHECK_ASSET_NAMES', data: { names: [...canCo.keys()] } }));
      return r && r.ok ? r.missing || [] : null;
    };
    let thieu = await kiem();
    if (thieu === null) thieu = [...canCo.keys()];
    if (thieu.length) {
      const anh = [];
      for (const m of thieu) {
        try { anh.push({ ...this.docAnh(canCo.get(m)), name: `${m}${path.extname(canCo.get(m)).toLowerCase() || '.png'}` }); } catch (err) {
          this.log('error', `❌ [${this.id}] Không đọc được ảnh ${canCo.get(m)}: ${err.message}`);
        }
      }
      let daTai = false, thuMucLen = '';
      if (anh.length) {
        this.log('info', `⬆️ [${this.id}] Tải ${anh.length} ảnh lên kho Flow (gắn vào prompt bằng @tên)…`);
        const r = moPhongBi(await this.tabs.dispatch(t.id, { action: 'UPLOAD_IMAGES_TO_FLOW', data: { images: anh } }));
        daTai = !!(r && r.ok);
        if (!daTai) {
          // 1.2.1: Flow mới không còn ô tải lên nằm sẵn (engine chỉ biết cách đó) → bấm nút Tải lên của Flow
          // như người, đưa file THẬT (tên = mã ảnh) vào hộp chọn file; không được thì kéo-thả vào ô nhập.
          this.log('warning', `⚠ [${this.id}] Engine không tải được ảnh lên (${(r && (r.error || r.loiVo)) || 'không rõ'}) — thử bấm nút Tải lên của Flow…`);
          thuMucLen = path.join(this.thuMucTam, `tai-len-${Date.now().toString(36)}`);
          const dsFile = [];
          try {
            fs.mkdirSync(thuMucLen, { recursive: true });
            for (const m of thieu) {
              const goc = canCo.get(m);
              if (!fs.existsSync(goc)) continue;
              const dich = path.join(thuMucLen, `${m}${path.extname(goc).toLowerCase() || '.png'}`);
              fs.copyFileSync(goc, dich);
              dsFile.push(dich);
            }
          } catch (err) { this.log('error', `❌ [${this.id}] Không chép được ảnh để tải lên: ${err.message}`); }
          const k = dsFile.length && t.view && !t.view.webContents.isDestroyed()
            ? await this.taiAnhLen(t.view.webContents, dsFile) : { ok: false, loi: 'không có ảnh / tab đã đóng' };
          daTai = k.ok;
          const CACH = { 'o-tai-len': 'đặt vào ô tải lên', 'hop-chon-file': `bấm ${k.buoc && k.buoc.length ? k.buoc.map((b) => b.split(': ')[1]).filter(Boolean).join(' → ') : 'Tải lên'}`, 'keo-tha': 'kéo-thả vào ô nhập prompt' };
          if (k.ok) this.log(k.chacChan ? 'success' : 'warning', `⬆️ [${this.id}] Đã đưa ${dsFile.length} ảnh lên Flow (${CACH[k.cach] || k.cach})${k.chacChan ? '' : ' — chưa chắc Flow nhận, kiểm lại kho'}.`);
          else this.log('error', `❌ [${this.id}] Tải ảnh lên Flow hỏng: ${k.loi || 'không rõ'}`);
          if (!k.ok || !k.chacChan) {
            const cd = taiAnhLenMd.moTaChanDoan(k.chanDoan);
            if (cd) this.log('info', `🔎 [${this.id}] Quanh ô nhập Flow: ${cd}`);
          }
          if (!k.ok) await this._chupChanDoan(`tải ảnh lên hỏng: ${k.loi || 'không rõ'}`);
          // Tải lên từ ô nhập prompt thì Flow có thể gắn luôn ảnh vào ô nhập → prompt đầu mẻ mang theo MỌI ảnh
          // vừa tải. Gỡ ra; engine gắn đúng ảnh cho từng prompt bằng @tên.
          if (k.ok && t.view && !t.view.webContents.isDestroyed()) {
            const go = await thamChieuMd.goHet(t.view.webContents).catch(() => null);
            if (go && go.daGo) this.log('info', `🧹 [${this.id}] Gỡ ${go.daGo} ảnh vừa tải lên khỏi ô nhập prompt (mỗi prompt tự gắn ảnh của nó).`);
          }
        }
      }
      // Flow cần một lúc để xử lý ảnh vừa tải lên — kiểm lại vài lần.
      for (let lan = 0; lan < 6 && thieu.length; lan++) {
        if (!(await this._ngu(lan ? 8000 : 4000, huyLuc))) return { dung: true };
        const k = await kiem();
        if (k !== null) thieu = k;
        // Không dò được kho (Flow đổi ô tìm kiếm) mà ảnh đã đưa lên → chạy luôn, engine gắn @tên được thì xong,
        // không được thì việc báo lỗi và sang tài khoản / bên khác như thường.
        else if (daTai && lan >= 1) {
          this.log('warning', `⚠ [${this.id}] Không dò lại được kho ảnh Flow — coi như ảnh đã lên, chạy tiếp.`);
          thieu = [];
        }
      }
      if (thuMucLen) try { fs.rmSync(thuMucLen, { recursive: true, force: true }); } catch (_) {}
      if (thieu.length) await this._chupChanDoan(`kho Flow vẫn thiếu ảnh ${thieu.join(', ')} sau khi tải lên`);
    }
    const hong = new Map();
    for (const [j, ma] of maCua) {
      const mat = ma.filter((m) => thieu.includes(m));
      if (mat.length) hong.set(j, `Không đưa được ảnh lên kho Flow (${mat.join(', ')})`);
    }
    return { maCua, hong };
  }

  /**
   * Lưu HTML bảng kho [+] + ô nhập của trang Flow (đã bỏ ảnh, script, style — không có dữ liệu tài khoản ngoài
   * những gì hiện trong bảng) ra một tệp, để người dùng gửi khi Flow đổi giao diện mà app chưa theo kịp.
   * Mỗi luồng chụp tối đa một lần mỗi 30 phút.
   */
  async _chupChanDoan(lyDo) {
    const t = this.tab;
    if (!this.thuMucChanDoan || !t || !t.view || t.view.webContents.isDestroyed()) return null;
    if (this._lucChup && Date.now() - this._lucChup < 30 * 60000) return null;
    this._lucChup = Date.now();
    try {
      const wc = t.view.webContents;
      // Mở bảng [+] (nếu đang đóng) để chụp được các mục kho, chụp xong đóng lại.
      const daMo = await wc.executeJavaScript(`(function () {
        var b = document.querySelector('button.add-menu-trigger, flow-add-menu button') ||
          Array.prototype.find.call(document.querySelectorAll('button[aria-label]'), function (x) { return /thêm thành phần|add (media|asset|ingredient)/i.test(x.getAttribute('aria-label')); });
        if (!b || b.getAttribute('aria-expanded') === 'true') return false;
        b.click(); return true;
      })()`, true).catch(() => false);
      if (daMo) await cho(1500);
      const r = await wc.executeJavaScript('window.__flowKhoAnh ? window.__flowKhoAnh.chup() : null', true);
      if (daMo) await wc.executeJavaScript('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); undefined;', true).catch(() => {});
      if (!r || !r.html) return null;
      fs.mkdirSync(this.thuMucChanDoan, { recursive: true });
      const tep = path.join(this.thuMucChanDoan, `flow-${new Date().toISOString().replace(/[:.]/g, '-')}.html`);
      fs.writeFileSync(tep, `<!-- AI Automation Studio · chẩn đoán Flow · ${r.luc} · ${r.url}\n     Lý do: ${String(lyDo).replace(/--/g, '—')} -->\n${r.html}\n`);
      this.log('info', `🔎 [${this.id}] Đã lưu HTML bảng ảnh của Flow để sửa tiếp: ${tep} — nếu vẫn lỗi, gửi tệp này kèm nhật ký.`);
      return tep;
    } catch (err) {
      this.log('warning', `⚠ [${this.id}] Không lưu được tệp chẩn đoán Flow: ${err.message}`);
      return null;
    }
  }

  async _ngu(ms, huyLuc) {
    const het = Date.now() + ms;
    while (Date.now() < het) {
      if (this.huy !== huyLuc) return false;
      await cho(Math.min(250, het - Date.now()));
    }
    return this.huy === huyLuc;
  }

  /**
   * Chạy một mẻ việc.
   * @param ds   [việc] cùng dự án, loại, tỷ lệ
   * @param ctx  { caiDat (cài đặt Flow), tenFile(j) → tên không đuôi [A-Za-z0-9_],
   *               anhCua(j) → [đường dẫn ảnh gắn kèm], capNhat(j, thay), xong(j, r) }
   *   r = {ok, files:[{duongDan}], flowTen} | {ok:false, loi, canDangNhap?, dung?, matKetNoi?}
   */
  async chayMe(ds, ctx) {
    this.dsViec = ds;
    const huyLuc = this.huy;
    const conLai = new Set(ds);
    const xong = (j, r) => {
      if (!conLai.has(j)) return;
      conLai.delete(j);
      try { ctx.xong(j, r); } catch (err) { this.log('error', `[${this.id}] ${err.message}`); }
    };
    const xongHet = (r) => { for (const j of [...conLai]) xong(j, typeof r === 'function' ? r(j) : r); };
    try {
      for (const j of ds) ctx.capNhat(j, { buoc: 'Mở Google Flow' });
      const mo = await this._damBaoTab(huyLuc);
      if (!mo.ok) {
        if (mo.dung) return xongHet({ ok: false, dung: true });
        if (mo.canDangNhap) return xongHet({ ok: false, canDangNhap: true, loi: 'Chưa đăng nhập Google Flow' });
        return xongHet({ ok: false, matKetNoi: true, loi: mo.loi });
      }
      const t = this.tab;
      const c = chuanHoaFlow(ctx.caiDat);
      const loai = ds[0].loai;

      // Ảnh gắn kèm (ảnh nguồn của video, ảnh tham chiếu, ảnh nhân vật) → kho Flow → @mã.
      const coAnh = ds.some((j) => ctx.anhCua(j).length);
      let maCua = new Map();
      if (coAnh) {
        for (const j of ds) ctx.capNhat(j, { buoc: 'Đưa ảnh lên Flow' });
        const g = await this._ganAnh(ds, ctx, huyLuc);
        if (g.dung) return xongHet({ ok: false, dung: true });
        for (const [j, loi] of g.hong) xong(j, { ok: false, loi });
        maCua = g.maCua;
      }
      const chay = ds.filter((j) => conLai.has(j));
      if (!chay.length) return;

      // Tên file = mã việc; engine dùng dòng thứ (index − 1). Prompt kèm @mã ảnh ở cuối câu.
      const ten = chay.map((j) => ctx.tenFile(j));
      const prompts = chay.map((j) => {
        const ma = maCua.get(j) || [];
        return [String(j.prompt || '').trim(), ...ma.map((m) => `@${m}`)].filter(Boolean).join(' ');
      });
      const settings = caiDatEngine(c, { loai, tyLe: ds[0].tyLe, coAnh: chay.some((j) => (maCua.get(j) || []).length), ten });

      for (const j of chay) ctx.capNhat(j, { buoc: 'Chuẩn bị Flow (chế độ, model)' });
      const cb = await this.may.chuanBiMe(t, settings, () => this.huy === huyLuc);
      if (this.huy !== huyLuc) return xongHet({ ok: false, dung: true });
      if (!cb.ok) return xongHet({ ok: false, matKetNoi: true, loi: `Flow: ${cb.lyDo}` });

      // ── Hồ sơ mẻ gắn lên tab — máy Flow chuyển bảng tiến độ / tải xong về đây ──
      const theoTen = new Map(chay.map((j, i) => [ten[i], j]));
      const theoSo = new Map(chay.map((j, i) => [i + 1, j]));
      const files = new Map(chay.map((j) => [j, []]));
      const hang = new Map();
      const xongTaoLuc = new Map();    // việc → lúc Flow báo tạo xong (COMPLETED) — để biết tải về bị kẹt
      let taiGanNhat = 0;              // lúc file gần nhất của mẻ về tới — engine tải lần lượt từng file
      const thuMucTai = path.join(this.thuMucTam, `me-${Date.now().toString(36)}`);
      fs.mkdirSync(thuMucTai, { recursive: true });
      let lanCuoi = Date.now();

      const thuXong = (j) => {
        const h = hang.get(j);
        const f = files.get(j);
        if (!h || !conLai.has(j)) return;
        if (h.status === 'COMPLETED' && h.downloaded && f.length >= Math.max(1, Math.min(h.totalVideos || 1, c.outputCount))) {
          xong(j, { ok: true, files: f.map((p) => ({ duongDan: p })), flowTen: c.doiTenTrenFlow ? theoTenNguoc(j) : '' });
        } else if (h.status === 'ERROR' && (h.retries || 0) >= c.maxRetries) {
          xong(j, { ok: false, loi: `Flow: ${h.error || 'tạo hỏng'}` });
        }
      };
      const theoTenNguoc = (j) => { for (const [k, v] of theoTen) if (v === j) return k; return ''; };

      await new Promise((giai) => {
        let daKet = false;
        const ket = (vi) => {
          if (daKet) return;
          daKet = true;
          clearInterval(gac);
          this._ketMe = null;
          t.onBang = t.onDung = t.onTai = null;
          t.busy = false;
          if (vi === 'dung' || this.huy !== huyLuc) {
            const lyDo = this.lyDoDung;
            xongHet((j) => (files.get(j).length
              ? { ok: true, files: files.get(j).map((p) => ({ duongDan: p })), flowTen: '' }
              : lyDo ? { ok: false, matKetNoi: true, daNghi: true, loi: lyDo } : { ok: false, dung: true }));
          } else {
            xongHet((j) => {
              const h = hang.get(j) || {};
              if (files.get(j).length) return { ok: true, files: files.get(j).map((p) => ({ duongDan: p })), flowTen: c.doiTenTrenFlow ? theoTenNguoc(j) : '' };
              if (vi === 'dungYen') return { ok: false, loi: `Flow đứng im quá ${Math.round(this.dungYenMs / 60000)} phút` };
              if (h.status === 'COMPLETED') return { ok: false, loi: 'Flow tạo xong nhưng không tải về được' };
              return { ok: false, loi: `Flow: ${h.error || 'mẻ dừng khi việc này chưa xong'}` };
            });
          }
          giai();
        };
        this._ketMe = ket;
        t.thuMucTai = thuMucTai;
        // Mọi việc đã có kết quả nhưng engine CÒN chạy (đổi tên trên Flow, tự F5 cuối mẻ rồi chạy nốt):
        // đợi engine báo dừng rồi mới nhận mẻ mới — giao START_AUTOMATION lúc engine còn chạy là bị bỏ qua.
        let hetViecLuc = 0;
        const hetViec = () => { if (!conLai.size && !hetViecLuc) hetViecLuc = Date.now(); };
        t.onBang = (rows, d) => {
          lanCuoi = Date.now();
          for (const r of rows) {
            const j = theoSo.get(r.index);
            if (!j) continue;
            const truoc = hang.get(j);
            hang.set(j, r);
            if (r.status === 'COMPLETED' && !xongTaoLuc.has(j)) xongTaoLuc.set(j, Date.now());
            if (conLai.has(j) && (!truoc || truoc.status !== r.status || truoc.progress !== r.progress)) {
              const thay = { buoc: (TRANG_THAI_BUOC[r.status] || r.status) + (r.status === 'CREATING' && r.progress ? ` ${r.progress}%` : '') +
                (r.retries ? ` · thử lại ${r.retries}/${c.maxRetries}` : '') };
              // Mốc bắt đầu thật = lúc engine bắt đầu dán prompt của việc này (để ước tiến độ đúng).
              if (r.status !== 'WAITING' && (!truoc || truoc.status === 'WAITING')) thay.batDauLuc = Date.now();
              ctx.capNhat(j, thay);
            }
            thuXong(j);
          }
          hetViec();
          if (hetViecLuc && d && d.isRunning === false) ket('xong');
        };
        t.onTai = (duongDan) => {
          lanCuoi = Date.now();
          let goc = path.basename(duongDan).replace(/\.[^.]+$/, '').replace(/ \(\d+\)$/, '');
          let j = theoTen.get(goc);
          if (!j) { goc = goc.replace(/_\d+$/, ''); j = theoTen.get(goc); }
          if (!j) { this.log('warning', `⚠ [${this.id}] Tải về file lạ (không thuộc việc nào của mẻ): ${path.basename(duongDan)}`); return; }
          files.get(j).push(duongDan);
          taiGanNhat = Date.now();
          thuXong(j);
          hetViec();
        };
        // AUTOMATION_STOPPED: engine đã kết thúc mẻ (máy Flow gọi trễ 1,5 s cho file cuối kịp về).
        t.onDung = () => setTimeout(() => ket('dung-engine'), 1500);
        const gac = setInterval(() => {
          if (this.huy !== huyLuc) return;
          if (hetViecLuc && Date.now() - hetViecLuc > 180000) {
            nhipTT.huy(t);
            this.tabs.dispatch(t.id, { action: 'STOP_AUTOMATION' }).catch(() => {});
            return ket('xong');
          }
          // Tạo xong mà tải về kẹt quá lâu → việc đó hỏng (sang tài khoản khác), tính là một lỗi của tài khoản.
          // Đếm từ lúc việc tạo xong HOẶC lúc file gần nhất của mẻ về (cái nào muộn hơn): engine tải lần lượt,
          // mỗi file có thể chờ Google xuất tới 120 s — mẻ 10 ảnh tải đều đều thì không phải kẹt.
          const choTai = this.choTaiMs >= 60000 ? `${Math.round(this.choTaiMs / 60000)} phút` : `${Math.round(this.choTaiMs / 1000)} giây`;
          for (const [j, luc] of xongTaoLuc) {
            if (!conLai.has(j) || files.get(j).length || Date.now() - Math.max(luc, taiGanNhat) < this.choTaiMs) continue;
            this.log('error', `❌ [${this.id}] #${j.so}: Flow tạo xong nhưng ${choTai} chưa tải về được — bỏ, chạy lại ở tài khoản khác.`);
            xong(j, { ok: false, loi: `Flow tạo xong nhưng quá ${choTai} chưa tải về được` });
            if (this.may.ghiLoiTai) this.may.ghiLoiTai(t, [...theoSo].find(([, v]) => v === j)[0]).catch(() => {});
            if (!conLai.size) {
              nhipTT.huy(t);
              this.tabs.dispatch(t.id, { action: 'STOP_AUTOMATION' }).catch(() => {});
              return ket('xong');
            }
          }
          if (t.nghiAnToan) { lanCuoi = Date.now(); return; }   // đang nghỉ an toàn — không phải đứng im
          if (Date.now() - lanCuoi > this.dungYenMs) {
            this.log('error', `❌ [${this.id}] Flow không báo gì quá ${Math.round(this.dungYenMs / 60000)} phút — dừng mẻ.`);
            nhipTT.huy(t);
            this.tabs.dispatch(t.id, { action: 'STOP_AUTOMATION' }).catch(() => {});
            ket('dungYen');
          }
        }, 5000);

        t.busy = true;
        t.assigned = chay.length;
        t.caiDatEngine = cb.caiDat;
        this.log('info', `🚀 [${this.id}] Giao mẻ ${chay.length} ${loai === 'video' ? 'video' : 'ảnh'} cho Flow (#${chay.map((j) => j.so).join(', #')})`);
        for (const j of chay) ctx.capNhat(j, { buoc: TRANG_THAI_BUOC.WAITING });
        const msg = buildStartMessage(prompts, prompts.map((text, i) => ({ index: i + 1, text })), cb.caiDat);
        this.tabs.dispatch(t.id, msg).then((r) => {
          if (r && r.ok === false && !r.result) {
            this.log('error', `❌ [${this.id}] Không giao được mẻ cho engine Flow: ${r.error || 'không rõ'}`);
            xongHet({ ok: false, matKetNoi: true, loi: `Không giao được mẻ cho Flow: ${r.error || 'không rõ'}` });
            ket('xong');
          }
        });
      });
    } finally {
      this.dsViec = null;
      this._ketMe = null;
      this.lyDoDung = '';
    }
  }
}

module.exports = { LuongFlow, maAnh, CO_O_NHAP };
