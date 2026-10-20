// ============================================================================
//  drive-trang.js — 1.4.0: MỌI chỗ đọc / bấm trên trang Google Drive (window.__drive)
//  Tiến trình chính (src/main/drive-web.js) điều khiển: mở thư mục, tìm / tạo thư mục con, bấm Mới →
//  Tải tệp lên (app chặn hộp chọn file của Chromium và đặt file thật vào), chọn "Thay thế / Giữ cả hai"
//  khi trùng tên, đọc khung tiến độ tải lên. Nhãn khớp theo CHỮ cả tiếng Việt lẫn tiếng Anh.
//  Trang Drive bật Trusted Types: KHÔNG gán innerHTML ở file này.
//  CHƯA đo trên drive.google.com thật — hỏng thì app lưu HTML trang vào chan-doan-drive/ để sửa.
// ============================================================================
(() => {
  if (window.__drive) return;
  const RE = {
    moi: /^(mới|new)$/i,
    thuMucMoi: /^(thư mục mới|new folder)/i,
    taiTep: /^(tải tệp lên|file upload|upload files?)/i,
    tao: /^(tạo|create)$/i,
    taiLen: /^(tải lên|upload)$/i,
    huy: /^(huỷ|hủy|cancel)$/i,
    thayThe: /(thay thế|replace)/i,
    giuCa: /(giữ cả hai|keep both)/i,
    tuyChon: /(tùy chọn tải lên|tuỳ chọn tải lên|upload options)/i,
    dangNhap: /^(đăng nhập|sign in|go to drive|chuyển đến drive)$/i,
    khongThay: /(không tìm thấy|couldn['’]t find|could not be found|not found|không có quyền truy cập|you need (access|permission)|bạn cần có quyền)/i,
    xongTai: /(tải lên xong|đã tải lên|đã tải xong|upload(s)? complete|uploaded)/i,
    loiTai: /(tải lên không thành công|không tải lên được|không thể tải lên|upload(s)? failed|couldn['’]t upload|can['’]t upload)/i,
    dangTai: /(đang tải lên|uploading|chuẩn bị tải lên|preparing)/i,
    thuMuc: /(thư mục|folder)/i
  };
  const hien = (e) => {
    if (!e || !e.getBoundingClientRect) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const s = getComputedStyle(e);
    return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0;
  };
  const gon = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const chu = (e) => gon(e && (e.innerText || e.textContent));
  const nhan = (e) => [e.getAttribute('aria-label'), e.getAttribute('data-tooltip'), chu(e)].filter(Boolean).map(gon);
  const bam = (e) => {
    try { e.scrollIntoView({ block: 'center' }); } catch (_) {}
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      e.dispatchEvent(new (t.startsWith('pointer') && window.PointerEvent ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true, view: window }));
    }
    e.click();
    return true;
  };
  const vungChinh = () => [...document.querySelectorAll('[role="main"], main')].find(hien) || null;
  const hopMo = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(hien).pop() || null;
  const nutTrong = (goc) => [...goc.querySelectorAll('button, [role="button"]')].filter(hien);
  const nutMoi = () => nutTrong(document).find((b) => !b.closest('[role="dialog"], [role="alertdialog"], [role="menu"]') && nhan(b).some((n) => RE.moi.test(n))) || null;
  const mucMenu = (re) => [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')].filter(hien).find((m) => nhan(m).some((n) => re.test(n))) || null;

  /** Mục trong danh sách thư mục đang mở có tên ĐÚNG `ten` → [{id, laThuMuc}]. */
  function timMuc(ten) {
    const goc = vungChinh();
    if (!goc) return [];
    const ra = new Map();
    for (const el of goc.querySelectorAll('[data-id]')) {
      if (!hien(el) || el.parentElement.closest('[data-id]')) continue;
      const ds = [...nhan(el)];
      for (const x of el.querySelectorAll('[aria-label], [data-tooltip]')) ds.push(...nhan(x));
      for (const x of el.querySelectorAll('*')) if (!x.children.length) ds.push(chu(x));
      const khop = ds.some((n) => n === ten || (n.startsWith(`${ten} `) && /^(thư mục|folder|tệp|file|google drive|được chia sẻ|shared)/i.test(n.slice(ten.length + 1))));
      if (khop) ra.set(el.getAttribute('data-id'), { id: el.getAttribute('data-id'), laThuMuc: ds.some((n) => RE.thuMuc.test(n)) });
    }
    return [...ra.values()];
  }

  /** Chữ của các khung thông báo / tiến độ (ngoài danh sách tệp). */
  function chuThongBao() {
    const goc = vungChinh();
    const ds = [...document.querySelectorAll('[role="status"], [role="alert"], [aria-live], [role="region"], [role="dialog"], [role="alertdialog"]')]
      .filter((e) => hien(e) && !(goc && goc.contains(e)));
    return ds.map(chu).filter(Boolean).join(' | ').slice(0, 2000);
  }

  window.__drive = {
    trangThai() {
      const goc = vungChinh();
      const thanTrang = gon(document.body ? document.body.innerText : '').slice(0, 3000);
      const coDangNhap = [...document.querySelectorAll('a, button, [role="button"]')].some((e) => hien(e) && nhan(e).some((n) => RE.dangNhap.test(n)));
      return {
        url: location.href,
        sanSang: !!goc && !!nutMoi(),
        canDangNhap: /(^|\.)accounts\.google\.com$/.test(location.hostname) || /\/ServiceLogin|\/signin\//.test(location.pathname) || (!goc && coDangNhap),
        khongThay: !goc && RE.khongThay.test(thanTrang)
      };
    },
    timMuc,
    /** Bấm "Mới" rồi mục menu `muc` ('thuMucMoi' | 'taiTep'). Trả {ok, buoc}. */
    async moMenu(muc) {
      let m = mucMenu(RE[muc]);
      if (!m) {
        const b = nutMoi();
        if (!b) return { ok: false, buoc: 'không thấy nút Mới' };
        bam(b);
        for (let i = 0; i < 30 && !m; i++) { await new Promise((r) => setTimeout(r, 100)); m = mucMenu(RE[muc]); }
      }
      if (!m) return { ok: false, buoc: `bấm Mới rồi mà không thấy mục ${muc === 'taiTep' ? '"Tải tệp lên"' : '"Thư mục mới"'}` };
      bam(m);
      return { ok: true, buoc: chu(m).slice(0, 40) };
    },
    dongMenu() {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      return true;
    },
    /** Hộp thoại đang mở: tiêu đề, có ô nhập không, các nút. */
    hop() {
      const h = hopMo();
      if (!h) return { co: false };
      const o = h.querySelector('input[type="text"], input:not([type])');
      return { co: true, chu: chu(h).slice(0, 200), coInput: !!(o && hien(o)), nut: nutTrong(h).map((b) => nhan(b)[0] || '').filter(Boolean).slice(0, 8),
        tuyChon: RE.tuyChon.test(chu(h)) || [...h.querySelectorAll('[role="radio"], input[type="radio"], label')].some((x) => RE.thayThe.test(chu(x))) };
    },
    /** Gõ tên vào ô nhập của hộp thoại "Thư mục mới". */
    datTen(ten) {
      const h = hopMo();
      const o = h && h.querySelector('input[type="text"], input:not([type])');
      if (!o) return { ok: false };
      o.focus();
      const dat = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      dat.call(o, ten);
      o.dispatchEvent(new Event('input', { bubbles: true }));
      o.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: o.value === ten };
    },
    /** Bấm nút của hộp thoại theo nhãn ('tao' | 'taiLen' | 'huy'). */
    bamNutHop(loai) {
      const h = hopMo();
      const b = h && nutTrong(h).find((x) => nhan(x).some((n) => RE[loai].test(n)));
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return { ok: false };
      bam(b);
      return { ok: true };
    },
    /** Hộp "Tùy chọn tải lên" (trùng tên): thayThe=true → "Thay thế tệp hiện có", false → "Giữ cả hai tệp". */
    chonTuyChon(thayThe) {
      const h = hopMo();
      if (!h) return { ok: false };
      const re = thayThe ? RE.thayThe : RE.giuCa;
      const ung = [...h.querySelectorAll('[role="radio"], input[type="radio"], label')].find((x) => re.test(chu(x)) || re.test(x.getAttribute('aria-label') || '') ||
        (x.id && [...h.querySelectorAll(`label[for="${x.id}"]`)].some((l) => re.test(chu(l)))));
      if (!ung) return { ok: false };
      const r = ung.matches('label') ? (ung.control || ung.querySelector('input, [role="radio"]') || ung) : ung;
      bam(r);
      return { ok: true };
    },
    /** Khung tiến độ tải lên. */
    tienDo() {
      const t = chuThongBao();
      return { xong: RE.xongTai.test(t), dang: RE.dangTai.test(t), loi: (t.match(RE.loiTai) || [''])[0], chu: t.slice(0, 300) };
    },
    /** Chỗ thả file (giữa danh sách tệp). */
    viTriTha() {
      const g = vungChinh();
      if (!g) return { ok: false };
      const r = g.getBoundingClientRect();
      return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 300)) };
    },
    chanDoan() {
      return { url: location.href, vungChinh: !!vungChinh(), nutMoi: !!nutMoi(), soMuc: document.querySelectorAll('[data-id]').length,
        nut: nutTrong(document).map((b) => nhan(b)[0] || '').filter(Boolean).slice(0, 25), thongBao: chuThongBao().slice(0, 300) };
    }
  };
})();
