'use strict';
// ============================================================================
//  drive-web.js — 1.4.0: TẢI THẲNG ẢNH / VIDEO LÊN drive.google.com (trình duyệt trong app)
//
//  Cách thứ hai bên cạnh drive.js (chép vào thư mục Drive trên máy). Tài khoản Drive là một tài khoản
//  nền 'drive' ở mục Tài khoản: người dùng tự đăng nhập Google trong app một lần (app không giữ mật khẩu),
//  app mở trang Drive trong cửa sổ ẩn của phiên đó và làm như người: mở thư mục, Mới → Thư mục mới,
//  Mới → Tải tệp lên (app chặn hộp chọn file của Chromium và đặt file thật vào — như tải ảnh lên Flow),
//  trùng tên thì chọn "Thay thế" (file Drive cũ của chính việc đó) hoặc "Giữ cả hai", rồi chờ khung tiến độ
//  báo tải xong. Không gọi API ẩn của Google, không giả trình duyệt.
//
//  Cấu trúc: Drive của tôi/<Tên dự án>/images (ảnh) · /Videos (video). Mã thư mục nhớ trong store
//  (driveWeb) để lần sau mở thẳng; thư mục bị xoá thì tìm / tạo lại.
//  Selector ở src/inject/drive-trang.js — CHƯA đo trên Drive thật; hỏng thì lưu HTML trang để sửa.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { tenThuMucDuAn, THU_MUC_LOAI } = require('./drive');

const NGUON = fs.readFileSync(path.join(__dirname, '..', 'inject', 'drive-trang.js'), 'utf8');
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const KHOA = 'driveWeb';

class DriveWeb {
  /**
   * @param o.goc         'https://drive.google.com' (bài kiểm: trang giả)
   * @param o.timTk(id)   tài khoản
   * @param o.taoCuaSo(tk) cửa sổ ẩn của phiên tài khoản · o.dongCuaSo(w)
   * @param o.store       {get, set} — nhớ mã thư mục
   * @param o.luuChanDoan(ten, html) → đường dẫn file đã lưu (hoặc '')
   * @param o.ganDebugger(wc) → bool
   */
  constructor(o) {
    this.o = { choMs: 45000, ranhMs: 90000, ...o };
    this.goc = String(o.goc || 'https://drive.google.com').replace(/\/$/, '');
    this.cs = null;          // { tkId, w, hen }
    this.hang = Promise.resolve();
  }

  /** Đưa các file của MỘT việc lên Drive (xếp hàng, mỗi lần một việc). → {ok, files:[nhãn], thuMuc} | {ok:false, loi, canDangNhap?} */
  len(x) {
    const p = this.hang.then(() => this._len(x));
    this.hang = p.catch(() => {});
    return p;
  }

  dong() {
    if (this.cs) { clearTimeout(this.cs.hen); this.o.dongCuaSo(this.cs.w); this.cs = null; }
  }

  async _len({ tkId, tenDuAn, loai, files, cu = [] }) {
    const tk = this.o.timTk(tkId);
    if (!tk) return { ok: false, loi: 'Chưa chọn tài khoản Google Drive (Cài đặt → Google Drive)' };
    const sub = THU_MUC_LOAI[loai];
    if (!sub) return { ok: false, loi: 'Chỉ ảnh và video được đưa lên Drive' };
    const ds = (files || []).filter((f) => f && fs.existsSync(f));
    if (!ds.length) return { ok: false, loi: 'File kết quả không còn trên máy' };
    const tenDa = tenThuMucDuAn(tenDuAn);
    const wc = this._cuaSo(tk).webContents;
    let buoc = 'mở Google Drive';
    try {
      const st = await this._mo(wc, `${this.goc}/drive/my-drive`);
      if (st.canDangNhap) {
        return { ok: false, canDangNhap: true, loi: `Tài khoản Drive "${tk.ten}" chưa đăng nhập Google — vào Tài khoản → Drive → Đăng nhập` };
      }
      if (!st.sanSang) throw new Error('trang Google Drive không mở ra danh sách tệp');
      buoc = `tìm / tạo thư mục "${tenDa}"`;
      const idDa = await this._thuMuc(wc, tk.id, 'root', tenDa, true);
      buoc = `tìm / tạo thư mục "${tenDa}/${sub}"`;
      const idSub = await this._thuMuc(wc, tk.id, idDa, sub);
      const ra = [];
      for (const f of ds) {
        const nhanF = `Drive: ${tenDa}/${sub}/${path.basename(f)}`;
        buoc = `tải "${path.basename(f)}" lên`;
        await this._taiLen(wc, idSub, f, cu.includes(nhanF));
        ra.push(nhanF);
      }
      return { ok: true, files: ra, thuMuc: `Drive: ${tenDa}/${sub}` };
    } catch (err) {
      const cd = await this._js(wc, 'window.__drive.chanDoan()').catch(() => null);
      const html = await wc.executeJavaScript('document.documentElement.outerHTML', true).catch(() => '');
      const file = html ? this.o.luuChanDoan(`drive-${buoc.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}`, html) : '';
      return { ok: false, loi: `Google Drive: ${buoc} hỏng — ${err.message}` + (cd ? ` (trang: ${cd.vungChinh ? 'có' : 'KHÔNG có'} danh sách, nút: ${(cd.nut || []).slice(0, 8).join(' · ') || '—'})` : '') +
        (file ? ` · đã lưu trang vào ${file}` : '') };
    } finally {
      this._henDong();
    }
  }

  _cuaSo(tk) {
    if (this.cs && (this.cs.tkId !== tk.id || this.cs.w.isDestroyed())) this.dong();
    if (!this.cs) this.cs = { tkId: tk.id, w: this.o.taoCuaSo(tk), hen: null };
    clearTimeout(this.cs.hen);
    return this.cs.w;
  }
  /** Rảnh một lúc thì đóng cửa sổ Drive (trang Drive tốn ~0,5 GB RAM). */
  _henDong() {
    if (!this.cs) return;
    clearTimeout(this.cs.hen);
    this.cs.hen = setTimeout(() => this.dong(), this.o.ranhMs);
  }

  async _js(wc, bieuThuc) {
    await wc.executeJavaScript(NGUON, true);
    return wc.executeJavaScript(bieuThuc, true);
  }

  /** Mở địa chỉ rồi chờ trang Drive hiện danh sách (hoặc hỏi đăng nhập / báo không thấy). */
  async _mo(wc, url) {
    wc.loadURL(url).catch(() => {});
    await ngu(300);
    let st = {};
    for (const het = Date.now() + this.o.choMs; Date.now() < het;) {
      st = await this._js(wc, 'window.__drive.trangThai()').catch(() => ({}));
      if (st.sanSang || st.canDangNhap || st.khongThay) return st;
      await ngu(400);
    }
    return st;
  }

  _nho(khoa, id) {
    const m = { ...(this.o.store.get(KHOA)[KHOA] || {}) };
    if (id) m[khoa] = id; else delete m[khoa];
    this.o.store.set({ [KHOA]: m });
  }

  /**
   * Mã thư mục `ten` trong thư mục cha `cha` ('root' = Drive của tôi). Đã nhớ → mở thử; mất → tìm trong cha → không có thì tạo.
   * Trang đang đứng ở thư mục cha khi gọi (dangOCha) hoặc sẽ được mở.
   */
  async _thuMuc(wc, tkId, cha, ten, dangOCha = false) {
    const khoa = `${tkId}|${cha}|${ten}`;
    const daNho = (this.o.store.get(KHOA)[KHOA] || {})[khoa];
    if (daNho) {
      const st = await this._mo(wc, `${this.goc}/drive/folders/${daNho}`);
      if (st.sanSang && String(st.url).includes(daNho)) return daNho;
      this._nho(khoa, '');
      dangOCha = false;
    }
    if (!dangOCha) {
      const st = await this._mo(wc, cha === 'root' ? `${this.goc}/drive/my-drive` : `${this.goc}/drive/folders/${cha}`);
      if (!st.sanSang) throw new Error(st.canDangNhap ? 'Drive đòi đăng nhập lại' : 'không mở được thư mục cha');
    }
    const timThay = async (ms) => {
      for (const het = Date.now() + ms; ;) {
        const ds = await this._js(wc, `window.__drive.timMuc(${JSON.stringify(ten)})`).catch(() => []);
        const tm = ds.find((x) => x.laThuMuc) || ds[0];
        if (tm || Date.now() > het) return tm ? tm.id : '';
        await ngu(500);
      }
    };
    let id = await timThay(2500);
    if (!id) {
      const m = await this._js(wc, "window.__drive.moMenu('thuMucMoi')");
      if (!m.ok) throw new Error(m.buoc);
      let h = {};
      for (let i = 0; i < 25 && !(h.co && h.coInput); i++) { await ngu(200); h = await this._js(wc, 'window.__drive.hop()'); }
      if (!h.coInput) throw new Error('không thấy hộp đặt tên thư mục mới');
      const t = await this._js(wc, `window.__drive.datTen(${JSON.stringify(ten)})`);
      if (!t.ok) throw new Error('không gõ được tên thư mục');
      await ngu(200);
      const b = await this._js(wc, "window.__drive.bamNutHop('tao')");
      if (!b.ok) throw new Error(`không bấm được nút Tạo (hộp: ${(h.nut || []).join(' · ')})`);
      id = await timThay(20000);
      if (!id) throw new Error(`đã bấm Tạo mà không thấy thư mục "${ten}"`);
    }
    this._nho(khoa, id);
    return id;
  }

  /** Tải một file vào thư mục `idThuMuc`; thayThe = file cùng tên trên Drive là bản cũ của chính việc này. */
  async _taiLen(wc, idThuMuc, file, thayThe) {
    const st = await this._mo(wc, `${this.goc}/drive/folders/${idThuMuc}`);
    if (!st.sanSang) throw new Error(st.canDangNhap ? 'Drive đòi đăng nhập lại' : 'không mở được thư mục');
    const ten = path.basename(file);
    const truoc = (await this._js(wc, `window.__drive.timMuc(${JSON.stringify(ten)})`).catch(() => [])).length;
    const cach = await this._dua(wc, file);
    if (!cach) throw new Error('không đưa được file vào trang (không mở được hộp chọn file, kéo-thả không ăn)');
    // Trùng tên: Drive hỏi "Tùy chọn tải lên" (Thay thế tệp hiện có / Giữ cả hai tệp).
    const kb = Math.max(1, fs.statSync(file).size / 1024);
    const han = Date.now() + 60000 + Math.min(30 * 60000, kb * 10);    // ~100 KB/s tối thiểu, tối đa 30 phút thêm
    let daChon = false, tien = {};
    while (Date.now() < han) {
      await ngu(700);
      if (!daChon) {
        const h = await this._js(wc, 'window.__drive.hop()').catch(() => ({}));
        if (h.co && h.tuyChon) {
          await this._js(wc, `window.__drive.chonTuyChon(${!!thayThe})`);
          await ngu(250);
          await this._js(wc, "window.__drive.bamNutHop('taiLen')");
          daChon = true;
          continue;
        }
      }
      tien = await this._js(wc, 'window.__drive.tienDo()').catch(() => ({}));
      if (tien.loi) throw new Error(`Drive báo "${tien.loi}"`);
      if (tien.xong && !tien.dang) return cach;
      const sau = (await this._js(wc, `window.__drive.timMuc(${JSON.stringify(ten)})`).catch(() => [])).length;
      if (sau > truoc && !tien.dang) return cach;
    }
    throw new Error(`quá giờ chờ Drive tải xong${tien.chu ? ` (khung tiến độ: "${tien.chu.slice(0, 120)}")` : ''}`);
  }

  /** Đưa file vào trang: Mới → Tải tệp lên (chặn hộp chọn file) → hỏng thì kéo-thả vào danh sách. → tên cách | '' */
  async _dua(wc, file) {
    if (!this.o.ganDebugger(wc)) return '';
    const dbg = wc.debugger;
    const goi = (lenh, ts) => dbg.sendCommand(lenh, ts || {});
    let hop = null;
    const nghe = (_e, method, params) => { if (method === 'Page.fileChooserOpened') hop = params; };
    dbg.on('message', nghe);
    try {
      await goi('Page.enable');
      await goi('Page.setInterceptFileChooserDialog', { enabled: true });
      const m = await this._js(wc, "window.__drive.moMenu('taiTep')").catch((e) => ({ ok: false, buoc: e.message }));
      if (m.ok) {
        for (let i = 0; i < 40 && !hop; i++) await ngu(100);
        if (hop) {
          await goi('DOM.setFileInputFiles', { files: [file], backendNodeId: hop.backendNodeId });
          return 'hop-chon-file';
        }
      }
      await this._js(wc, 'window.__drive.dongMenu()').catch(() => {});
      await ngu(300);
      const v = await this._js(wc, 'window.__drive.viTriTha()').catch(() => ({}));
      if (!v.ok) return '';
      const data = { items: [], files: [file], dragOperationsMask: 1 };
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await goi('Input.dispatchDragEvent', { type, x: v.x, y: v.y, data });
        await ngu(type === 'drop' ? 400 : 80);
      }
      return 'keo-tha';
    } finally {
      dbg.removeListener('message', nghe);
      await goi('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {});
    }
  }
}

module.exports = { DriveWeb };
