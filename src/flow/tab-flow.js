// ============================================================================
//  tab-flow.js — CÁC TAB GOOGLE FLOW CHẠY NGẦM (mỗi luồng Flow một tab)
//  --------------------------------------------------------------------------
//  Lấy nguyên logic tiêm của Flow Automation Studio (src/main/tabs.js bản
//  2.8.9): tiêm theo từng chặng có tên, khoá chống tiêm chồng đặt TRƯỚC lời
//  await, bọc engine trong hàm tự gọi, nối ";undefined;", dò lại mỗi 3 giây.
//
//  Khác duy nhất: tab là một CỬA SỔ ẨN (BrowserWindow show:false) chứ không
//  phải WebContentsView nằm trong cửa sổ app. Bài học của Muse (10/10/2026):
//  WebContentsView ẩn có document.visibilityState = 'hidden' và rAF dừng;
//  cửa sổ show:false + backgroundThrottling:false thì trang luôn 'visible',
//  vẫn giữ kích thước thật 1280×800 — lưới cuộn ảo của Flow vẫn vẽ đủ thẻ.
//
//  Cửa sổ do main.js tạo (taoCuaSo) để giữ chung một chỗ các chuyện icon,
//  ẩn/hiện luồng, đóng thật khi thoát app. `tab.view` là BrowserWindow đó —
//  có `.webContents` nên mọi đoạn code cũ viết `tab.view.webContents` vẫn
//  chạy nguyên văn.
// ============================================================================

const path = require('path');
const fs = require('fs');

// FLOW_TEST_URL chỉ dùng cho kiểm thử (trang Flow giả cục bộ).
const FLOW_URL = process.env.FLOW_TEST_URL || 'https://labs.google/fx/vi/tools/flow';

// Chỉ dùng cho kiểm thử: cho phép trỏ vào trang giả lập cục bộ.
const FLOW_HOST_RE = process.env.FLOW_TEST_HOST
  ? new RegExp(process.env.FLOW_TEST_HOST, 'i')
  : /^https?:\/\/(labs\.google|flow\.google\.com)/i;

/** Đọc mã nguồn các file tiêm. `thay` cho bài kiểm thử thay một file (vd engine giả). */
function docNguon(thay = {}) {
  const dir = path.join(__dirname, 'inject');
  const doc = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  return {
    shim: thay.shim || doc('chrome-shim.js'),
    helper: thay.helper || doc('main-world-helpers.js'),
    engine: thay.engine || doc('flow-engine.js'),
    mode: thay.mode || doc('flow-mode.js'),
    canhBao: thay.canhBao || doc('flow-canh-bao.js'),
    model: thay.model || doc('flow-model.js'),
    bamTao: thay.bamTao || doc('flow-bam-tao.js'),
    thamChieu: thay.thamChieu || doc('flow-anh-tham-chieu.js')
  };
}

class QuanLyTabFlow {
  /**
   * @param o.taoCuaSo(acc, tieuDe) → BrowserWindow (show:false, preload-flow, phiên của tài khoản)
   * @param o.dongCuaSo(win)
   * @param o.log(muc, chu)
   * @param o.nguon  (tuỳ chọn) thay mã nguồn tiêm — chỉ dùng cho kiểm thử
   */
  constructor(o) {
    this.taoCuaSo = o.taoCuaSo;
    this.dongCuaSo = o.dongCuaSo || ((w) => { try { w.destroy(); } catch (_) {} });
    this.log = o.log || (() => {});
    this.nguon = docNguon(o.nguon || {});
    /** @type {Array<object>} */
    this.tabs = [];
    this.seq = 0;
  }

  list() {
    return this.tabs.map((t) => ({ id: t.id, url: t.url, ready: t.ready, busy: t.busy,
      accountId: t.accountId, accountName: t.accountName }));
  }
  find(id) { return this.tabs.find((t) => t.id === id) || null; }
  findByWcId(wcId) {
    return this.tabs.find((t) => { try { return t.view.webContents.id === wcId; } catch (_) { return false; } }) || null;
  }
  ofAccount(accountId) { return this.tabs.filter((t) => t.accountId === accountId); }

  /**
   * Mở một tab Flow ẩn cho tài khoản `acc` ({id, ten}).
   * Số `slot` KHÔNG dùng lại: engine ghép nó vào tên dự án (_T1, _T2…) và dùng
   * làm khoá trạng thái chạy — dùng lại là tab mới thừa kế mẻ dở của tab cũ.
   */
  taoTab(acc, url = FLOW_URL, tieuDe = '') {
    const id = `flow${++this.seq}`;
    const view = this.taoCuaSo(acc, tieuDe || `Flow · ${acc.ten} · ${id}`);
    const tab = { id, slot: this.seq, view, url, ready: false, busy: false, title: '',
      accountId: acc.id, accountName: acc.ten };
    this.tabs.push(tab);
    const wc = view.webContents;
    wc.on('page-title-updated', (_e, t) => { tab.title = t; });
    wc.on('did-navigate', (_e, u) => { tab.url = u; tab.ready = false; });
    wc.on('did-finish-load', () => { tab.url = wc.getURL(); this.maybeInject(tab, 'did-finish-load'); });
    // Flow là SPA (Angular): sau đăng nhập / mở dự án nó đổi URL bằng pushState,
    // did-finish-load KHÔNG bắn lại → nghe thêm hai sự kiện này + chốt dò 3 giây.
    wc.on('did-navigate-in-page', (_e, u, chinh) => { if (!chinh) return; tab.url = u; this.maybeInject(tab, 'did-navigate-in-page'); });
    wc.on('dom-ready', () => this.maybeInject(tab, 'dom-ready'));
    wc.on('render-process-gone', (_e, d) => {
      tab.ready = false;
      this.log('error', `❌ [${id}] Tab Flow bị sập (${d.reason}).`);
    });
    tab.watchdog = setInterval(() => {
      if (wc.isDestroyed()) return clearInterval(tab.watchdog);
      if (wc.isLoading()) return;
      this.maybeInject(tab, 'watchdog');
    }, 3000);
    wc.loadURL(url).catch(() => { /* SPA tự chuyển hướng → ERR_ABORTED */ });
    return tab;
  }

  /** Quyết định có cần tiêm không, theo TRẠNG THÁI THẬT trong trang. Khoá đặt TRƯỚC lời await. */
  async maybeInject(tab, why) {
    const wc = tab.view.webContents;
    if (wc.isDestroyed() || tab.injecting) return;
    tab.injecting = true;
    try {
      const url = wc.getURL();
      if (!FLOW_HOST_RE.test(url)) {           // đang ở trang đăng nhập Google chẳng hạn
        tab.ready = false;
        return;
      }
      let alive = false;
      try {
        alive = await wc.executeJavaScript(
          '!!(window.__flowEngineLoaded && window.__flowShimDispatch && window.chrome && window.chrome.storage)', true);
      } catch (_) { alive = false; }
      if (alive) {
        if (!tab.ready) { tab.ready = true; this.log('success', `✅ [${tab.id}] Engine Flow đã sẵn sàng`); }
        return;
      }
      tab.ready = false;
      await this.injectEngine(tab, why);
    } finally {
      tab.injecting = false;
    }
  }

  /** Tiêm shim → hàm phụ → engine → các trình riêng, THEO TỪNG CHẶNG có tên. */
  async injectEngine(tab, why = 'thủ công') {
    const wc = tab.view.webContents;
    const khoaTruocDo = tab.injecting;
    tab.injecting = true;
    // Engine khai báo hàng loạt const cấp cao nhất → bọc trong hàm tự gọi (không arrow, không strict)
    // để tiêm lại vào cùng tài liệu không ném "already been declared".
    const boc = (src) => `(function(){\n${src}\n})();`;
    // Phơi hàm tìm nút cài đặt của engine cho flow-mode.js — dò cùng một kiểu với engine.
    const XUAT_ENGINE = `
try {
  if (typeof findSettingsDropdownButtonNative === 'function')
    window.__flowTimNutCaiDat = findSettingsDropdownButtonNative;
  if (typeof applyFlowSettings === 'function')
    window.__flowApDungCaiDat = applyFlowSettings;
} catch (e) { console.warn('[tiêm] không phơi được hàm engine:', e); }`;
    const n = this.nguon;
    const stages = [
      ['đánh dấu tab', `window.__FLOW_TAB_ID = ${JSON.stringify(tab.id)};`],
      ['lớp giả lập chrome.*', n.shim],
      ['hàm phụ trợ', boc(n.helper)],
      ['dọn người nghe cũ', 'window.__flowShimReset && window.__flowShimReset();'],
      ['engine dò DOM', boc(n.engine + '\n' + XUAT_ENGINE)],
      ['trình đổi chế độ', n.mode],
      // SAU trình đổi chế độ: dùng chung hàm mở bảng và hàm bấm của nó.
      ['trình chọn model', n.model],
      ['trình bấm nút Tạo', n.bamTao],
      ['trình dò cảnh báo', n.canhBao],
      ['trình dò ảnh tham chiếu', n.thamChieu],
      ['chốt hoàn tất', 'window.__flowEngineLoaded = true;']
    ];
    try {
      const coCau = await wc.executeJavaScript('!!window.__flowBridge', true);
      if (!coCau) {
        tab.ready = false;
        this.log('error', `❌ [${tab.id}] Thiếu cầu nối preload (__flowBridge) — tab Flow sẽ được mở lại.`);
        return;
      }
      for (const [ten, src] of stages) {
        // executeJavaScript trả về giá trị biểu thức cuối và structured-clone nó: file kết thúc bằng
        // "window.x = hàm" là "An object could not be cloned" → ép về undefined.
        try { await wc.executeJavaScript(src + '\n;undefined;', true); } catch (err) {
          throw new Error(`hỏng ở chặng "${ten}": ${err.message}`);
        }
      }
      tab.ready = true;
      this.log('success', `✅ [${tab.id}] Engine Flow đã sẵn sàng (${why})`);
    } catch (err) {
      tab.ready = false;
      this.log('error', `❌ [${tab.id}] Không tiêm được engine Flow — ${err.message}`);
    } finally {
      tab.injecting = khoaTruocDo;
    }
  }

  async diagnose(tabId) {
    const tab = this.find(tabId);
    if (!tab) return { ok: false, error: 'Không tìm thấy tab' };
    try {
      const p = await tab.view.webContents.executeJavaScript(`({
        url: location.href,
        coBridge: !!window.__flowBridge,
        coStorage: !!(window.chrome && window.chrome.storage && window.chrome.storage.local),
        coDispatch: typeof window.__flowShimDispatch === 'function',
        coEngine: !!window.__flowEngineLoaded,
        coClickCreate: typeof window.__flowClickCreate === 'function',
        coONhapPrompt: !!document.querySelector('.ProseMirror[contenteditable="true"], div[data-slate-editor="true"][contenteditable="true"]')
      })`, true);
      return { ok: true, tabId, urlKhop: FLOW_HOST_RE.test(p.url), ...p };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  close(tabId) {
    const i = this.tabs.findIndex((t) => t.id === tabId);
    if (i < 0) return false;
    const [tab] = this.tabs.splice(i, 1);
    if (tab.watchdog) clearInterval(tab.watchdog);
    this.dongCuaSo(tab.view);
    return true;
  }
  closeAll() { for (const t of [...this.tabs]) this.close(t.id); }

  /** Gửi một message xuống engine (thay chrome.tabs.sendMessage). Trả {ok, result} của shim. */
  async dispatch(tabId, message) {
    const tab = this.find(tabId);
    if (!tab) return { ok: false, error: 'Không tìm thấy tab' };
    try {
      return await tab.view.webContents.executeJavaScript(
        `window.__flowShimDispatch && window.__flowShimDispatch(${JSON.stringify(message)})`, true);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

/** Mở phong bì của chrome-shim: dispatch() trả {ok, result}; `result` là thứ engine đưa vào sendResponse. */
function moPhongBi(r) {
  if (!r || typeof r !== 'object') return r;
  if (r.result !== undefined && r.result !== null) {
    return r.ok === false && r.error ? { ...r.result, loiVo: r.error } : r.result;
  }
  return r;
}

/**
 * Địa chỉ trang DỰ ÁN Flow (để nhớ cho tài khoản). Google đã dời Flow từ labs.google/fx/…/project/<id>
 * sang flow.google.com/project/<id> (người dùng gặp 15/10/2026) — nhận cả hai, và mọi địa chỉ
 * FLOW_HOST_RE nhận (trang giả của kiểm thử).
 */
function laUrlDuAnFlow(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//.test(s) && FLOW_HOST_RE.test(s) && /\/project\/[^/?#\s]+/.test(s);
}

module.exports = { QuanLyTabFlow, FLOW_URL, FLOW_HOST_RE, moPhongBi, docNguon, laUrlDuAnFlow };
