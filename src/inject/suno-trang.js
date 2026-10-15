// ============================================================================
//  suno-trang.js — trình trợ giúp tiêm vào trang suno.com/create (window.__suno).
//  MỌI chỗ dò giao diện Suno nằm ở file này. Đo từ trang Create thật người dùng
//  lưu ngày 15/10/2026 (bố cục Advanced, tài khoản free):
//   - tab "Songs" / "Speech" trong tablist[aria-label="What to create"],
//     "Simple" / "Advanced" trong tablist[aria-label="Create form mode"];
//   - ô Styles: [data-testid="create-form-styles-wrapper"] textarea;
//   - ô Lời: [aria-label="Lyrics editor"] (Lexical, để trống = nhạc không lời);
//   - nút xoá form: button[aria-label="Clear all form inputs"];
//   - nút tạo: button[aria-label="Create song"] (data-disabled khi chưa điền);
//   - danh sách bài: [data-testid="clip-row"] (data-clip-status="complete"…), mỗi hàng có
//     a[href="/song/<id>"], thời lượng "3:18", nút button[aria-label="More options"];
//   - thông báo: #suno-toast-viewport-top / -bottom / -bottomEdge.
//  Tải về (ảnh người dùng gửi 15/10/2026): ⋯ → menu Remix / Edit / Publish / Share / Download / Manage…
//  → "Download" mở hộp "Download '<tên bài>'" chọn M4A / MP3 (✓ sẵn) / WAV / MP4 video asset / Stems & MIDI
//  → nút "Download". Không thấy thì trả danh sách mục menu để nhật ký ghi lại.
// ============================================================================
(function () {
  if (window.__suno && window.__suno.phienBan === 1) return;

  const $$ = (s, g) => Array.from((g || document).querySelectorAll(s));
  const nhinThay = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
  const chu = (e) => String((e && (e.innerText || e.textContent)) || '').replace(/\s+/g, ' ').trim();
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Chữ theo từng dòng hiển thị (để tách câu báo lỗi khỏi tên bài, nút…). */
  const dongChu = (e) => String((e && (e.innerText || e.textContent)) || '').split(/\n+/).map((d) => d.replace(/\s+/g, ' ').trim()).filter(Boolean);

  /** Bấm như chuột thật: một chuỗi sự kiện, MỘT click (base-ui nghe pointerdown hoặc click). */
  function bam(e) {
    const r = e.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    }
    e.dispatchEvent(new PointerEvent('pointerdown', { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    e.dispatchEvent(new MouseEvent('mousedown', o));
    e.dispatchEvent(new PointerEvent('pointerup', { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    e.dispatchEvent(new MouseEvent('mouseup', o));
    e.dispatchEvent(new MouseEvent('click', o));
  }
  /** Rê chuột vào (mở menu con kiểu hover). */
  function re(e) {
    const r = e.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    }
  }
  /** Gán giá trị cho ô nhập React (setter gốc + sự kiện input). */
  function dien(el, giaTri) {
    const goc = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value');
    el.focus();
    goc.set.call(el, giaTri);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const NHAN = {
    tao: /^(create|tạo)( song| bài hát)?$/i,
    dangNhap: /^(sign in|log in|sign up|đăng nhập|đăng ký)$/i,
    songs: /^(songs?|bài hát)$/i,
    advanced: /^(advanced|custom|nâng cao|tuỳ chỉnh|tùy chỉnh)$/i,
    taiVe: /^(download|tải xuống|tải về)\b/i,
    mp3: /\bmp3\b/i,
    nutTai: /^(download|tải xuống|tải về)$/i,
    // Suno báo hết lượt tạo / tải: hết credit, chạm giới hạn, mời nâng cấp gói…
    hetLuot: /credit|limit|quota|upgrade|subscribe|subscription|out of|not enough|insufficient|reached|pro plan|premier|hết lượt|hết credit|giới hạn|nâng cấp/i,
    xacNhanXoa: /^(clear|clear all|confirm|yes|ok|xoá|xóa|đồng ý)$/i
  };

  const nutTao = () => $$('button[aria-label="Create song"]').find(nhinThay) ||
    $$('button').find((b) => nhinThay(b) && NHAN.tao.test(chu(b)) && !b.closest('[data-testid="clip-row"]'));
  const oStyles = () => $$('[data-testid="create-form-styles-wrapper"] textarea').find(nhinThay) ||
    $$('textarea').find((t) => nhinThay(t) && /bpm|style|phong cách/i.test(t.placeholder || '') && !t.closest('[data-cowrite-shell]'));
  const oLoi = () => $$('[aria-label="Lyrics editor"]').find(nhinThay);
  const tatCa = (b) => b.getAttribute('aria-disabled') === 'true' || b.hasAttribute('data-disabled') || b.disabled;

  function daDangNhap() {
    // Nút menu hồ sơ ở thanh bên / liên kết "Profile" ở thanh dưới (bố cục hẹp) — chỉ có khi đã đăng nhập.
    return !!document.querySelector('[data-testid="profile-menu-button"], a[aria-label="Profile"][href*="/@"]');
  }

  function captcha() {
    return $$('iframe').some((f) => nhinThay(f) && /hcaptcha|recaptcha|turnstile|challenges\.cloudflare|arkoselabs|funcaptcha/i.test((f.src || '') + ' ' + (f.title || '')));
  }

  /** Chữ Suno đang báo (toast, hộp thoại, alert) — dùng để đọc lý do khi bấm mà không có gì xảy ra. */
  function thongBao() {
    const ds = $$('#suno-toast-viewport-top, #suno-toast-viewport-bottom, #suno-toast-viewport-bottomEdge, [role="alertdialog"], [role="dialog"], [role="alert"]:not(#__next-route-announcer__), [role="status"]')
      .filter((e) => nhinThay(e) && !e.closest('[data-testid="clip-row"]'))   // "Upgrade for full song" của bản nghe thử không phải thông báo
      // Giữ từng dòng (nối bằng ' · ') để tách được câu báo hết lượt khỏi tên bài / nút trong hộp.
      .flatMap(dongChu).filter((t) => t.length > 3);
    return [...new Set(ds)].join(' · ').slice(0, 400);
  }

  function trangThai() {
    const co = !!nutTao();
    const dn = daDangNhap();
    const coNutDangNhap = $$('a, button').some((e) => nhinThay(e) && NHAN.dangNhap.test(chu(e)));
    // Có nút Create là có form (ô Styles chỉ hiện ở Advanced — chuanBi() tự chuyển sang Advanced).
    return { coForm: co, coStyles: !!oStyles(), daDangNhap: dn, canDangNhap: !dn && coNutDangNhap, captcha: captcha(), url: location.href };
  }

  function thoiLuong(hang) {
    // "3:18" — thời lượng nằm trên ảnh bìa; tìm phần tử lá có đúng dạng m:ss.
    for (const e of $$('*', hang)) {
      if (e.children.length) continue;
      const m = chu(e).match(/^(\d{1,2}):(\d{2})$/);
      if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }
    const m = chu(hang).match(/\b(\d{1,2}):(\d{2})\b/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  }

  /** Các bài đang hiện, theo thứ tự trên trang (mới nhất ở trên). */
  function dsClip() {
    return $$('[data-testid="clip-row"]').map((h) => {
      const a = h.querySelector('a[href*="/song/"]');
      const id = a ? ((a.getAttribute('href') || '').match(/\/song\/([^/?#]+)/) || [])[1] || '' : '';
      return { id, trangThai: h.getAttribute('data-clip-status') || '', giay: thoiLuong(h), ten: h.getAttribute('aria-label') || (a ? chu(a) : '') };
    }).filter((c) => c.id);
  }

  async function chonTab(dsTablist, mau) {
    const tab = $$(dsTablist).flatMap((tl) => $$('[role="tab"]', tl)).find((t) => mau.test(chu(t)));
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') !== 'true') { bam(tab); await ngu(500); }
    return tab.getAttribute('aria-selected') === 'true';
  }

  /**
   * Chuẩn bị form: tab Songs + Advanced, xoá form cũ (lời bài cũ còn sót là thành bài có lời),
   * điền prompt vào ô Styles. Trả {ok} hoặc {ok:false, loi}.
   */
  async function chuanBi({ styles }) {
    await chonTab('[role="tablist"][aria-label="What to create"]', NHAN.songs);
    const adv = await chonTab('[role="tablist"][aria-label="Create form mode"]', NHAN.advanced);
    const xoa = $$('button[aria-label="Clear all form inputs"]').find(nhinThay);
    if (xoa && !tatCa(xoa)) {
      bam(xoa);
      await ngu(400);
      const hop = $$('[role="alertdialog"], [role="dialog"]').filter(nhinThay).pop();
      const dongY = hop && $$('button', hop).find((b) => NHAN.xacNhanXoa.test(chu(b)));
      if (dongY) { bam(dongY); await ngu(400); }
    }
    if (!adv) await chonTab('[role="tablist"][aria-label="Create form mode"]', NHAN.advanced);
    const o = oStyles();
    if (!o) return { ok: false, loi: 'khong-thay-o-styles' };
    dien(o, styles);
    await ngu(300);
    if (o.value !== styles) return { ok: false, loi: 'khong-dien-duoc-styles', chu: o.value.slice(0, 80) };
    const l = oLoi();
    if (l && chu(l) && !/start writing lyrics/i.test(chu(l))) {
      // Lời bài cũ không xoá được bằng nút xoá form → chọn hết rồi xoá trong ô Lexical.
      l.focus();
      document.execCommand('selectAll');
      document.execCommand('delete');
      await ngu(200);
    }
    return { ok: true, coLoi: !!(l && chu(l) && !/start writing lyrics/i.test(chu(l))) };
  }

  /** Bấm Create (chờ nút bật tối đa 10 giây). */
  async function bamTao() {
    for (let i = 0; i < 40; i++) {
      const b = nutTao();
      if (b && !tatCa(b)) { bam(b); return { ok: true }; }
      await ngu(250);
    }
    return { ok: false, loi: 'nut-create-bi-tat', chu: thongBao() };
  }

  const mucMenu = () => $$('[role="menuitem"], [role="menuitemradio"], [role="menu"] button, [role="menu"] a').filter(nhinThay);

  /** Nút / ô có chữ đúng bằng mẫu (bỏ dấu ✓ và khoảng trắng). */
  const dungChu = (e, mau) => mau.test(chu(e).replace(/[✓✔]/g, '').trim());
  /**
   * Hộp "Download '<tên bài>'" (đo 15/10/2026): các ô M4A / MP3 / WAV / MP4 video asset / Stems & MIDI,
   * rồi nút "Download" to ở dưới. Tìm theo role=dialog; không có role thì đi ngược từ ô "MP3" lên tới
   * khối chứa cả nút "Download".
   */
  function hopTai() {
    const laHop = (h) => $$('button, [role="button"], [role="radio"], [role="option"], label, div', h).some((e) => nhinThay(e) && dungChu(e, /^mp3$/i));
    const hop = $$('[role="dialog"], [role="alertdialog"]').filter((h) => nhinThay(h) && laHop(h)).pop();
    if (hop) return hop;
    const oMp3 = $$('button, [role="button"], [role="radio"], [role="option"], label').find((e) => nhinThay(e) && dungChu(e, /^mp3$/i) && !e.closest('[role="menu"]'));
    for (let e = oMp3 && oMp3.parentElement, n = 0; e && n < 8; e = e.parentElement, n++) {
      if ($$('button', e).some((b) => nhinThay(b) && dungChu(b, NHAN.nutTai))) return e;
    }
    return null;
  }

  /**
   * Tải MP3 của một bài bằng nút của chính Suno: ⋯ (More options) → Download → hộp chọn định dạng →
   * ô MP3 → nút Download. Tiến trình chính đã chờ sẵn sự kiện tải về của cửa sổ này.
   * Bản Suno cũ / khác có menu con "MP3 Audio" thay cho hộp — vẫn hiểu.
   */
  async function taiMp3(id) {
    const a = $$('[data-testid="clip-row"] a[href*="/song/"]').find((x) => (x.getAttribute('href') || '').includes(`/song/${id}`));
    const hang = a && a.closest('[data-testid="clip-row"]');
    if (!hang) return { ok: false, loi: 'khong-thay-bai', buoc: 'hang' };
    hang.scrollIntoView({ block: 'center' });
    re(hang);
    await ngu(300);
    const nut = $$('button[aria-label="More options"]', hang).find(nhinThay) || $$('button[aria-label="More options"]', hang)[0];
    if (!nut) return { ok: false, loi: 'khong-thay-nut-more-options', buoc: 'menu' };
    bam(nut);
    let tai = null;
    for (let i = 0; i < 20 && !tai; i++) { await ngu(150); tai = mucMenu().find((m) => NHAN.taiVe.test(chu(m).replace(/^[^\p{L}]+/u, ''))); }   // bỏ biểu tượng 🔒 đứng trước
    if (!tai) return { ok: false, loi: 'menu-khong-co-download', buoc: 'menu', menu: mucMenu().map(chu).slice(0, 15), chu: thongBao() };
    // "Download" mở hộp chọn định dạng (Suno 10/2026); bản khác có thể mở menu con khi rê chuột.
    const truoc = new Set(mucMenu());
    re(tai);
    await ngu(300);
    const con = mucMenu().find((m) => !truoc.has(m) && NHAN.mp3.test(chu(m)));
    if (con) { bam(con); await ngu(600); return { ok: true, cach: 'menu-con', chu: thongBao() }; }
    bam(tai);
    let hop = null;
    for (let i = 0; i < 25 && !hop; i++) { await ngu(200); hop = hopTai(); }
    if (!hop) {
      const mc = mucMenu().find((m) => m !== tai && NHAN.mp3.test(chu(m)));
      if (mc) { bam(mc); await ngu(600); return { ok: true, cach: 'menu-con', chu: thongBao() }; }
      return { ok: false, loi: 'khong-mo-duoc-hop-download', buoc: 'hop', chu: thongBao() };
    }
    const chuHop = dongChu(hop).join(' · ').slice(0, 400);
    const oMp3 = $$('button, [role="button"], [role="radio"], [role="option"], label', hop).find((e) => nhinThay(e) && dungChu(e, /^mp3$/i));
    if (oMp3 && oMp3.getAttribute('aria-checked') !== 'true' && oMp3.getAttribute('aria-selected') !== 'true') { bam(oMp3); await ngu(300); }
    const nutTai = $$('button', hop).filter((b) => nhinThay(b) && dungChu(b, NHAN.nutTai)).pop();
    if (!nutTai) return { ok: false, loi: 'hop-khong-co-nut-download', buoc: 'hop', chu: chuHop };
    if (tatCa(nutTai)) return { ok: false, loi: 'nut-download-bi-tat', buoc: 'hop', chu: chuHop };
    bam(nutTai);
    await ngu(800);
    return { ok: true, cach: 'hop', chu: chuHop };
  }

  /** Đóng hộp Download nếu còn mở (nút ✕ / Escape) — tránh che trang ở việc sau. */
  async function dongHop() {
    const hop = hopTai();
    if (!hop) return false;
    const x = $$('button', hop).find((b) => nhinThay(b) && (/close|đóng/i.test(b.getAttribute('aria-label') || '') || /^[×✕x]$/i.test(chu(b))));
    if (x) bam(x); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await ngu(300);
    return true;
  }

  window.__suno = { phienBan: 1, trangThai, dsClip, chuanBi, bamTao, taiMp3, dongHop, thongBao, captcha,
    laHetLuot: (t) => NHAN.hetLuot.test(String(t || '')),
    // Chỉ câu nói về hết lượt (hộp Download có cả tên bài, các định dạng… — không đưa hết vào nhật ký).
    cauHetLuot: (t) => String(t || '').split(/ · |(?<=[.!?])\s+/).filter((c) => NHAN.hetLuot.test(c)).join(' ').slice(0, 200) };
})();
;undefined;
