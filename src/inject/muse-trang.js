// ============================================================================
//  muse-trang.js — trình trợ giúp TIÊM VÀO TRANG muse.ai (main world)
//  --------------------------------------------------------------------------
//  Mọi chỗ dò trang Muse nằm ở ĐÂY, không rải sang file khác. Muse đổi giao
//  diện thì chỉ sửa một file này (và trang giả tests/fixture-muse.html).
//
//  Dò bằng thuộc tính ỔN ĐỊNH Muse tự gắn (đo ngày 10/10/2026):
//    ô nhập          textarea[data-hatch-composer-prehydration-input]  (aria-label "Message")
//    nút gửi         [data-pel-click="chat_send_message"] → nhãn "Send" → nút MỚI hiện ở khung soạn
//    đính kèm        input[type=file]  (multiple)  → nút gỡ [data-pel-click="chat_remove_attachment_click"]
//                    (nhãn "Remove attachment") / ảnh thu nhỏ. Đo 12/10/2026: Muse KHÔNG có <form>;
//                    input file nằm sát ô nhập, ảnh thu nhỏ + nút gỡ ở tổ tiên cấp 2, nút đính kèm
//                    [data-pel-click="chat_tap_attachment"] + Send ở cấp 3.
//    tin của Muse    [data-message-role="assistant"]
//    khung ảnh       [data-testid="hatch-chat-attachment-presentation-image"]
//    khung video     [data-testid="hatch-chat-attachment-presentation-video"]
//    ảnh đang nạp    [data-testid="chat-image-not-found"]  (thoáng qua, KHÔNG phải lỗi)
//    đang gõ         [aria-label="Assistant is typing"]  hoặc aria-busy
//  NHÃN aria-label ĐỔI THEO NGÔN NGỮ (máy tiếng Việt: "Nhắn tin", "Gửi"…) → mọi chỗ dò theo
//  nhãn đều có bản tiếng Việt (NHAN) và một đường dự phòng không cần chữ.
//    trạng thái Muse chữ dưới avatar: span[title] trong [data-pel-impression="status_limit_reached_impression"]
//                    ("Connecting..." = mất kết nối tới máy ảo của tài khoản → chat/ảnh/video không tải được)
//    xoá chat        [data-testid="hatch-thread-row"] → nút ⋯ [data-pel-click="chat_thread_options_open"] →
//                    [data-pel-click="chat_thread_delete_open"] → [data-pel-click="chat_thread_delete_confirm"]
//    mức token       nút dock [data-testid="hatch-dock-more"] → mục cuối menu → [role=dialog] [role=progressbar]
//  Ảnh/video nằm trong blob: cùng nguồn → fetch() lấy được file gốc, khỏi
//  bấm nút Download.
//
//  Mọi hàm trả dữ liệu thuần (structured-clone được). File kết thúc bằng
//  `undefined` để executeJavaScript không phải sao chép một hàm.
// ============================================================================
(function () {
  if (window.__muse && window.__muse.phienBan === 1) return;

  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, goc) => (goc || document).querySelector(s);
  const $$ = (s, goc) => Array.from((goc || document).querySelectorAll(s));

  async function cho(dieuKien, ms, buoc) {
    const het = Date.now() + ms;
    for (;;) {
      let v = null;
      try { v = dieuKien(); } catch (_) {}
      if (v) return v;
      if (Date.now() > het) return null;
      await ngu(buoc || 250);
    }
  }

  // Nhãn Muse theo cả tiếng Anh lẫn tiếng Việt (giao diện Muse theo ngôn ngữ máy/tài khoản).
  const NHAN = {
    gui: /^(send|gửi)( message| tin nhắn)?$/i,
    goDinhKem: /remove|xóa|xoá|gỡ|bỏ/i,
    dangGo: /typing|đang (nhập|gõ|soạn|viết|trả lời)/i,
    mo: /^(open|mở|xem)/i,
    dong: /^(close|đóng)/i
  };
  const nhan = (e) => String((e && e.getAttribute('aria-label')) || '').trim();
  const nutTheoNhan = (re, goc) => $$('button[aria-label]', goc).filter((b) => re.test(nhan(b)));

  // data-pel-click (mã đo lường của Muse) KHÔNG đổi theo ngôn ngữ → dò bằng nó trước, nhãn sau.
  const NUT = {
    gui: '[data-pel-click="chat_send_message"]',
    goDinhKem: '[data-pel-click="chat_remove_attachment_click"]',
    dinhKem: '[data-pel-click="chat_tap_attachment"]'
  };
  const oNhap = () => $('textarea[data-hatch-composer-prehydration-input]') ||
    $('textarea[aria-label="Message"],textarea[aria-label="Nhắn tin"]') || $('textarea');
  /** Khung soạn tin: tổ tiên gần nhất của ô nhập chứa cả input file LẪN nút (nút đính kèm/gửi).
   *  Chỉ "chứa input file" là chưa đủ: trên Muse thật đó là div bọc sát ô nhập, không có nút
   *  gỡ tệp lẫn ảnh thu nhỏ (lỗi 1.3.1–1.4.0: "không đính kèm được ảnh"). */
  function khungSoan(ta) {
    let e = ta;
    for (let i = 0; e && i < 10; i++) {
      e = e.parentElement;
      if (e && (e.tagName === 'FORM' || $(NUT.dinhKem, e) || ($('input[type="file"]', e) && $('button', e)))) return e;
    }
    return (ta && ta.closest('form')) || (ta && ta.parentElement && ta.parentElement.parentElement) || document.body;
  }
  const tinMuse = () => $$('[data-message-role="assistant"]');

  function canDangNhap() {
    if (oNhap()) return false;
    const chu = (document.body && document.body.innerText) || '';
    if (/log in or create an account|đăng nhập hoặc tạo tài khoản/i.test(chu)) return true;
    // Ngôn ngữ khác: không có ô soạn tin mà có ô nhập email / số điện thoại = màn đăng nhập.
    return !!$('input[type="email"],input[type="tel"],input[autocomplete="username"]') ||
      $$('input').some((i) => /mail|phone|mobile|điện thoại/i.test(i.placeholder || ''));
  }

  /** Chữ trạng thái Muse dưới avatar ("Connecting...", "Working"…). Muse mất kết nối tới máy ảo
   *  của tài khoản (đo 12/10/2026: kẹt "Connecting..." hàng chục phút) thì chat/ảnh/video không nạp. */
  function chuTrangThaiMuse() {
    const e = $('[data-pel-impression="status_limit_reached_impression"] [title]');
    return e ? String(e.getAttribute('title') || '').trim() : '';
  }
  // Đã đo: "Connecting..." (mất kết nối), "Connected" (bình thường). Bản tiếng Việt đoán: "Đang kết nối…" —
  // KHÔNG được nhận nhầm "Đã kết nối".
  const MAT_KET_NOI = /^(connecting|reconnecting|disconnected|offline|connection error)|^(đang (kết nối|kết nối lại)|mất kết nối|đã ngắt kết nối|lỗi kết nối|ngoại tuyến)/i;
  const matKetNoi = () => MAT_KET_NOI.test(chuTrangThaiMuse());

  function trangThai() {
    return {
      url: location.href,
      coONhap: !!oNhap(),
      canDangNhap: canDangNhap(),
      soTinMuse: tinMuse().length,
      matKetNoi: matKetNoi(),
      trangThaiMuse: chuTrangThaiMuse()
    };
  }

  function b64SangFile(f) {
    const bin = atob(f.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], f.ten || 'anh.png', { type: f.mime || 'image/png' });
  }

  /** Chữ Muse đang báo lỗi trên trang (toast, alert) — để nhật ký nói được VÌ SAO. */
  function chuLoiTrenTrang() {
    // Muse có cả <svg role="status"> (vòng quay "Loading"): SVG KHÔNG có innerText/offsetParent →
    // phải lọc theo kiểu phần tử, nếu không .trim() trên undefined làm hỏng cả bước gửi/kiểm.
    return $$('[role="alert"],[role="status"],[data-sonner-toast]')
      .filter((e) => e instanceof HTMLElement && e.offsetParent !== null && !e.closest('[role="log"]'))
      .map((e) => String(e.innerText || '').trim()).filter(Boolean).join(' | ').slice(0, 300);
  }

  /**
   * Gửi một prompt (kèm ảnh nếu có) vào chat đang mở.
   * @param {{text:string, files:{ten,mime,b64}[]}} p
   */
  /** Ô soạn tin đã được React "nạp" chưa. Muse hiện sẵn một ô nhập tạm
   *  (data-hatch-composer-prehydration-input) trước khi nạp; điền chữ vào ô tạm thì nút Send
   *  không bao giờ xuất hiện. Trang bị ẩn (visibilityState hidden) thì Muse không nạp. */
  const daNap = (ta) => !!ta && Object.keys(ta).some((k) => k.startsWith('__react'));

  async function gui(p) {
    let ta = await cho(oNhap, 25000);
    if (!ta) return { ok: false, loi: canDangNhap() ? 'can-dang-nhap' : 'khong-thay-o-nhap' };
    ta = await cho(() => { const t = oNhap(); return daNap(t) ? t : null; }, 30000);
    if (!ta) {
      // Trang ẩn thì chắc chắn không nạp → báo ngay. Trang đang hiện mà không thấy dấu nạp
      // (Muse đổi cách làm) → vẫn thử đường cũ: điền rồi chờ nút Gửi.
      if (document.visibilityState === 'hidden') return { ok: false, loi: 'o-soan-tin-chua-nap', chu: 'trang đang bị ẩn' };
      ta = oNhap();
      if (!ta) return { ok: false, loi: 'khong-thay-o-nhap' };
    }

    const k = khungSoan(ta);
    // Nút có sẵn TRƯỚC khi đính kèm/gõ: nút Gửi là nút MỚI hiện ra sau đó (khi không đọc được nhãn).
    // Muse hiện nút Send ngay khi có ảnh đính kèm → phải ghi tập nút trước bước đính kèm.
    const nutCu = new Set($$('button', k));
    const files = (p.files || []);
    if (files.length) {
      const inp = $('input[type="file"]');
      if (!inp) return { ok: false, loi: 'khong-thay-o-dinh-kem' };
      const nutGo = () => Math.max($$(NUT.goDinhKem).length, nutTheoNhan(NHAN.goDinhKem, k).length);
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(b64SangFile(f));
      inp.files = dt.files;
      const soAnhTruoc = $$('img', k).length;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      // Đính kèm xong = có đủ nút gỡ tệp, hoặc (nhãn lạ) khung soạn có thêm đủ ảnh thu nhỏ.
      const du = await cho(() => nutGo() >= files.length ||
        $$('img', k).length >= soAnhTruoc + files.length, 20000);
      if (!du) return { ok: false, loi: 'khong-dinh-kem-duoc', chu: chuLoiTrenTrang() };
      // Ảnh thu nhỏ hiện ra TRƯỚC khi tải lên xong; Muse có lúc trả lời "ảnh chưa tải lên được"
      // (nhật ký 15/10/2026) → chờ thêm cho vòng tải / ảnh thu nhỏ nạp xong.
      await cho(() => !$$('[role="progressbar"], [aria-busy="true"]', k).length &&
        $$('img', k).every((i) => i.complete), 30000);
      await ngu(1500);
    }

    // React giữ giá trị riêng: phải gán qua setter gốc rồi bắn sự kiện input.
    const datGiaTri = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    datGiaTri.call(ta, p.text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await ngu(300);
    if (ta.value !== p.text) {
      ta.focus();
      ta.select();
      document.execCommand('insertText', false, p.text);
      await ngu(300);
    }
    if (ta.value !== p.text) return { ok: false, loi: 'khong-dan-duoc-prompt' };

    // Ảnh đang tải lên thì nút gửi tắt — chờ, đừng bấm vào nút chết.
    const nutGui = () => {
      const theoMa = $(NUT.gui, k) || $(NUT.gui);
      if (theoMa) return theoMa;
      const theoNhan = nutTheoNhan(NHAN.gui, k).concat(nutTheoNhan(NHAN.gui));
      if (theoNhan.length) return theoNhan[0];
      return $$('button', k).filter((b) => !nutCu.has(b) && !NHAN.goDinhKem.test(nhan(b))).pop() || $('button[type="submit"]', k);
    };
    const nut = await cho(() => { const b = nutGui(); return b && !b.disabled ? b : null; }, 60000);
    if (!nut) return { ok: false, loi: 'nut-gui-bi-tat', chu: chuLoiTrenTrang() };

    const truoc = location.pathname;
    const soUserTruoc = $$('[data-message-role="user"]').length;
    nut.click();
    const an = await cho(() =>
      (location.pathname !== truoc && !/\/new$/.test(location.pathname)) ||
      $$('[data-message-role="user"]').length > soUserTruoc, 20000);
    if (!an) return { ok: false, loi: 'gui-khong-an', chu: chuLoiTrenTrang() };
    // Chờ thêm chút để chắc đường dẫn chat mới đã có.
    await cho(() => !/\/new$/.test(location.pathname), 8000);
    // Đường dẫn vẫn /thread/new (Muse mất kết nối…) → KHÔNG giữ: mở lại "/thread/new" là chat trống,
    // lần thử lại sẽ chờ suông 600 giây (lỗi người dùng gặp 12/10/2026).
    return { ok: true, thread: /\/new$/.test(location.pathname) ? '' : location.href };
  }

  function anhDaNap(khung) {
    return $$('img', khung).find((i) => /^blob:|^data:|^https?:/.test(i.src) && i.complete && i.naturalWidth > 16) || null;
  }
  /** Nút mở trình xem ảnh của một khung ảnh ("Open generated image…" / "Mở…"). */
  function nutMoAnh(khung) {
    const tin = khung.closest('[data-message-role="assistant"]') || khung;
    const ds = nutTheoNhan(NHAN.mo, tin);
    if (ds.length < 2) return ds[0] || null;
    // 1.5.3: một tin có nhiều ảnh → nút của ĐÚNG khung này (nút bọc / nằm trong khung, không thì theo thứ tự).
    const sat = ds.find((n) => n.contains(khung) || khung.contains(n));
    if (sat) return sat;
    const khungs = $$('[data-testid="hatch-chat-attachment-presentation-image"]', tin);
    return ds.length === khungs.length ? ds[khungs.indexOf(khung)] : ds[0];
  }
  /** Ảnh coi như sẵn sàng: đã nạp, HOẶC chưa nạp (ảnh lười ở trang chạy ngầm) nhưng
   *  Muse đã gắn nút mở ảnh và không còn ô "đang nạp". */
  function anhSanSang(khung) {
    if (anhDaNap(khung)) return true;
    if ($('[data-testid="chat-image-not-found"]', khung)) return false;
    return !!nutMoAnh(khung);
  }
  function videoCoNguon(khung) {
    return $$('video', khung).find((v) => /^blob:|^https?:/.test(v.currentSrc || v.src)) || null;
  }

  /** Tình hình chat hiện tại: Muse đã trả ảnh/video chưa, hay đang gõ, hay trả chữ. */
  function ketQua() {
    const ms = tinMuse();
    const khungAnh = $$('[data-testid="hatch-chat-attachment-presentation-image"]');
    const khungVideo = $$('[data-testid="hatch-chat-attachment-presentation-video"]');
    return {
      url: location.href,
      thread: /\/thread\/(?!new\b)[^/?#]+/.test(location.pathname) ? location.href : '',   // 1.5.1
      soTinMuse: ms.length,
      soKhungAnh: khungAnh.length,
      soKhungVideo: khungVideo.length,
      soAnh: khungAnh.filter(anhSanSang).length,
      soVideo: khungVideo.filter(videoCoNguon).length,
      dangNap: $$('[data-testid="chat-image-not-found"]').length,
      dangGo: $$('[aria-label]').some((e) => NHAN.dangGo.test(nhan(e))) ||
        ms.some((m) => m.querySelector('[aria-busy="true"]')),
      chu: ms.map((m) => (m.innerText || '').trim()).filter(Boolean).join('\n').slice(0, 600),
      canDangNhap: canDangNhap(),
      matKetNoi: matKetNoi(),
      trangThaiMuse: chuTrangThaiMuse(),
      loiTrang: chuLoiTrenTrang()
    };
  }

  function blobSangB64(b) {
    return new Promise((r, j) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result).split(',')[1] || '');
      fr.onerror = () => j(fr.error);
      fr.readAsDataURL(b);
    });
  }

  async function anhSangPng(img, blob) {
    // 1.5.3: đổi CHÍNH file vừa tải (có thể lớn hơn ảnh đang hiện) — không vẽ lại ảnh xem trước nhỏ.
    let nguon = img, w = img.naturalWidth, h = img.naturalHeight;
    if (blob && typeof createImageBitmap === 'function') {
      try { nguon = await createImageBitmap(blob); w = nguon.width; h = nguon.height; } catch (_) {}
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(nguon, 0, 0);
    return await new Promise((r) => c.toBlob(r, 'image/png'));
  }
  /** Kích thước thật của file ảnh đã tải (không phải cỡ ảnh đang hiện trên trang). */
  async function coAnh(blob, img) {
    if (typeof createImageBitmap === 'function') {
      try { const b = await createImageBitmap(blob); const r = { w: b.width, h: b.height }; if (b.close) b.close(); return r; } catch (_) {}
    }
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  const dienTich = (i) => (i ? (i.naturalWidth || 0) * (i.naturalHeight || 0) : 0);
  const hienTich = (e) => { if (!e) return 0; const r = e.getBoundingClientRect(); return Math.max(0, r.width) * Math.max(0, r.height); };
  const KHUNG_ANH = '[data-testid="hatch-chat-attachment-presentation-image"]';
  const khungAnhDs = () => $$(KHUNG_ANH);
  const anhCoNguon = (i) => /^blob:|^data:|^https?:/.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 16;
  /** Đường dẫn bản LỚN nhất của ảnh: ứng viên srcset có "w"/"x" lớn nhất, không có thì ảnh đang hiện. */
  function urlLonNhat(img) {
    let tot = img.currentSrc || img.src, lon = 0;
    for (const muc of String(img.getAttribute('srcset') || '').split(/,\s+/)) {
      const m = muc.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)([wx])$/);
      if (!m) continue;
      const v = +m[2] * (m[3] === 'x' ? 10000 : 1);
      if (v > lon) { lon = v; tot = new URL(m[1], location.href).href; }
    }
    return tot;
  }

  // ── Trình xem ảnh của Muse (bấm vào ảnh → ảnh cỡ đầy đủ, nút ✕ góc trái, nút tải ↓ góc phải) ──────────────
  // 1.5.4 (nhật ký + ảnh chụp người dùng 19/11/2026, bản 1.5.3 vẫn ra 498×280): trình xem của Muse thật KHÔNG
  // mở bằng cú bấm JavaScript (isTrusted = false, như nút xoá chat 1.3.2) và không chắc có role=dialog. Nên:
  //  • ảnh của trình xem = ảnh MỚI xuất hiện sau cú bấm (không có trong `xemTruoc`), ngoài khung chat, hiện to nhất;
  //  • trang thử bấm bằng JavaScript trước (nhanh); không mở được thì luong.js bấm CHUỘT THẬT vào ảnh
  //    (diemAnh → layAnhXem), vẫn nhỏ thì bấm nút tải ↓ của trình xem (diemNutXem('tai')), rồi đóng (diemNutXem('dong')).
  let xemTruoc = new Set();
  let xemNho = { dienTich: 0, hienTich: 0 };
  function anhTrinhXem() {
    let tot = null, to = 0;
    for (const i of $$('img')) {
      if (xemTruoc.has(i) || i.closest(KHUNG_ANH) || !anhCoNguon(i)) continue;
      const k = hienTich(i);
      if (k > to || (k === to && dienTich(i) > dienTich(tot))) { tot = i; to = k; }
    }
    // Ảnh hiện nhỏ hơn ảnh xem trước trong chat (ảnh đính kèm, ảnh đại diện…) thì không phải trình xem.
    return tot && to >= Math.max(150 * 150, xemNho.hienTich * 1.2) ? tot : null;
  }
  /** Lớp phủ của trình xem: tổ tiên của ảnh trình xem phủ gần kín màn hình (hoặc hộp thoại / aria-modal). */
  function lopTrinhXem(img) {
    const hop = $$('[role="dialog"],[aria-modal="true"]').pop();
    if (!img) return hop || null;
    for (let e = img.parentElement; e && e !== document.body; e = e.parentElement) {
      const r = e.getBoundingClientRect();
      if (e.matches('[role="dialog"],[aria-modal="true"]') || (r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8)) return e;
    }
    return hop || null;
  }
  /** Ghi nhớ ảnh đang có + cỡ ảnh xem trước, trước khi bấm mở trình xem ảnh thứ k. */
  function chuanBiXem(k) {
    const khung = khungAnhDs()[k];
    if (!khung) return null;
    const nho = anhDaNap(khung);
    xemTruoc = new Set($$('img'));
    xemNho = { dienTich: dienTich(nho), hienTich: hienTich(nho) };
    return { khung, nho };
  }
  /** Chờ ảnh của trình xem: LỚN HƠN ảnh xem trước → xong; cùng cỡ mà nạp xong, đứng yên ~1,2 giây → coi như đã đủ cỡ. */
  async function choAnhXem(choMs) {
    let tot = null, onDinh = 0, truoc = '';
    for (const het = Date.now() + choMs; Date.now() < het; await ngu(400)) {
      const i = anhTrinhXem();
      if (!i) { onDinh = 0; continue; }
      if (dienTich(i) > xemNho.dienTich) return i;
      const src = i.currentSrc || i.src;
      onDinh = src === truoc ? onDinh + 1 : 0;
      truoc = src; tot = i;
      if (onDinh >= 3) break;
    }
    return tot;
  }
  const dangXem = () => !!anhTrinhXem() || !!$$('[role="dialog"],[aria-modal="true"]').length;
  /** Nút của trình xem: 'dong' (✕) / 'tai' (↓ tải về). Theo nhãn, không có nhãn thì theo vị trí góc trên. */
  function nutTrinhXem(loai) {
    const lop = lopTrinhXem(anhTrinhXem());
    const ds = $$('button,[role="button"],a[download],a[href]', lop || document).filter((b) => hienTich(b) > 0 && !b.closest('[role="log"]') && !b.closest(KHUNG_ANH));
    const chu = (b) => `${nhan(b)} ${b.getAttribute('title') || ''} ${b.getAttribute('data-testid') || ''} ${b.hasAttribute('download') ? 'download' : ''}`;
    const re = loai === 'tai' ? /download|tải( xuống| về)?|save/i : /^\s*(close|đóng|dismiss)|close/i;
    const theoNhan = ds.find((b) => re.test(chu(b)));
    if (theoNhan || !lop) return theoNhan || null;
    // Không nhãn: ✕ là nút góc trên-TRÁI, tải ↓ là nút góc trên-PHẢI ngoài cùng (ảnh chụp trình xem Muse 19/11/2026).
    const tren = ds.filter((b) => b.getBoundingClientRect().top < innerHeight * 0.2);
    tren.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return (loai === 'tai' ? tren[tren.length - 1] : tren[0]) || null;
  }
  const giua = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  async function dongTrinhXem() {
    const nut = nutTrinhXem('dong');
    if (nut) bamGiua(nut);
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await cho(() => !dangXem(), 1500);
  }
  /** Ảnh blob → file trả về app (đổi PNG nếu cần, cỡ = cỡ file thật). */
  async function thanhFile(b, img, p, them) {
    if (p && p.png && b.type !== 'image/png') b = (await anhSangPng(img, b)) || b;
    const co = await coAnh(b, img);
    return { loai: 'anh', mime: b.type || 'image/png', w: co.w, h: co.h, ...them, b64: await blobSangB64(b) };
  }
  async function blobCuaAnh(img, han) {
    let b = null;
    const lon = urlLonNhat(img);
    if (lon !== (img.currentSrc || img.src)) { try { b = await taiBlob(lon, han); } catch (_) { b = null; } }
    if (!b || !/^image\//.test(b.type || '')) b = await taiBlob(img.currentSrc || img.src, han);
    return b;
  }
  /** Chẩn đoán khi không lấy được ảnh đủ cỡ: khung ảnh, lớp phủ, các ảnh / nút đang hiện (gửi người phát triển). */
  function chanDoanAnh(k) {
    const cat = (s) => String(s || '').replace(/(https?:\/\/[^\s"']{60})[^\s"']+/g, '$1…').replace(/data:[^"']{40}[^"']*/g, 'data:…').slice(0, 60000);
    const anh = $$('img').map((i) => `${i.naturalWidth}x${i.naturalHeight} hiện ${Math.round(i.getBoundingClientRect().width)}x${Math.round(i.getBoundingClientRect().height)} ${i.closest(KHUNG_ANH) ? '[khung]' : ''}${xemTruoc.has(i) ? '' : '[mới]'} ${cat((i.currentSrc || i.src).slice(0, 90))}`);
    const nut = $$('button,[role="button"]').filter((b) => hienTich(b) > 0 && !b.closest('[role="log"]')).slice(0, 40)
      .map((b) => `${b.tagName} "${nhan(b)}" title="${b.getAttribute('title') || ''}" @${Math.round(giua(b).x)},${Math.round(giua(b).y)}`);
    const khung = khungAnhDs()[k];
    const tin = khung && (khung.closest('[data-message-role="assistant"]') || khung);
    return { url: location.href, anh, nut, khung: cat(tin && tin.outerHTML), lop: cat((lopTrinhXem(anhTrinhXem()) || {}).outerHTML) };
  }

  // Các bước cho luong.js khi phải bấm CHUỘT THẬT (Muse bỏ qua cú bấm JavaScript).
  /** Toạ độ giữa ảnh thứ k trong chat (cuộn tới ảnh trước) + ghi nhớ trạng thái trước khi mở trình xem. */
  async function diemAnh(k) {
    if (dangXem()) await dongTrinhXem();
    const x = chuanBiXem(k);
    if (!x) return null;
    const dich = x.nho || x.khung;
    dich.scrollIntoView({ block: 'center' });
    await ngu(300);
    const d = giua(dich);
    return d.x > 0 && d.y > 0 && d.x < innerWidth && d.y < innerHeight ? { x: d.x, y: d.y } : null;
  }
  /** Sau cú bấm chuột thật: chờ ảnh trình xem, tải về. → file | {nho:true} (vẫn chỉ ảnh nhỏ) | null (không mở được). */
  async function layAnhXem(p) {
    const img = await choAnhXem((p && p.choMs) || 8000);
    if (!img) return { moDuoc: false, chanDoan: chanDoanAnh(p.k) };
    if (dienTich(img) <= xemNho.dienTich) return { moDuoc: true, nho: true, chanDoan: chanDoanAnh(p.k) };
    return { moDuoc: true, file: await thanhFile(await blobCuaAnh(img, p.hanMs), img, p, { cachLay: 'trinh-xem' }) };
  }
  /** Toạ độ nút của trình xem đang mở ('tai' / 'dong'), null nếu không thấy. */
  function diemNutXem(loai) {
    if (loai === 'dong' && !dangXem()) return { daDong: true };
    const n = nutTrinhXem(loai);
    return n ? giua(n) : null;
  }
  /** File ảnh app vừa tải qua nút ↓ (bytes base64) → đổi PNG nếu cần, đo cỡ thật. */
  async function docAnhTai(p) {
    const bin = atob(p.b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const b = new Blob([u], { type: p.mime || 'image/png' });
    let img = null;
    if (p.png && b.type !== 'image/png') {
      img = new Image(); img.src = URL.createObjectURL(b);
      try { await img.decode(); } catch (_) { img = null; }
    }
    return await thanhFile(b, img || { naturalWidth: 0, naturalHeight: 0 }, img ? p : { png: false }, { cachLay: 'nut-tai' });
  }

  /**
   * Lấy file gốc của mọi ảnh/video Muse trả trong chat này.
   * @param {{png:boolean}} p  png=true: đổi ảnh webp sang png
   */
  // 1.4.9: tải file gốc có hạn (AbortController) — máy chủ Muse đứng giữa chừng thì fetch() chờ mãi, việc kẹt "99%".
  async function taiBlob(url, hanMs) {
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const h = ac && hanMs > 0 ? setTimeout(() => ac.abort(), hanMs) : 0;
    try { return await (await fetch(url, ac ? { signal: ac.signal } : undefined)).blob(); } finally { clearTimeout(h); }
  }

  async function layFile(p) {
    const ra = [];
    const han = (p && p.hanMs) || 0;
    const ds = khungAnhDs();
    for (let k = 0; k < ds.length; k++) {
      if (dangXem()) await dongTrinhXem();
      const x = chuanBiXem(k);
      const nho = x.nho;   // ảnh trong khung chat = bản xem trước (thường thu nhỏ)
      let img = nho, moXem = false;
      try {
        // Thử mở trình xem bằng JavaScript (nút "Open…" hoặc bấm vào ảnh). Muse thật bỏ qua → 3 giây không thấy thì thôi,
        // luong.js bấm chuột thật (canChuotThat). Đã mở thì LUÔN đóng lại, kẻo trình xem chồng lên nhau.
        // Ảnh nằm trong liên kết (bấm sẽ RỜI trang chat) → không bấm; thử tải thẳng địa chỉ liên kết (thường là ảnh gốc).
        const lk = nho && nho.closest('a[href]');
        if (lk && /^https?:|^blob:/.test(lk.href)) {
          try {
            const b = await taiBlob(lk.href, han);
            if (/^image\//.test(b.type || '')) {
              const co = await coAnh(b, nho);
              if (co.w * co.h > xemNho.dienTich) {
                ra.push(await thanhFile(b, nho, p, { chiSo: k, xemTruoc: `${nho.naturalWidth}x${nho.naturalHeight}`, cachLay: 'lien-ket' }));
                continue;
              }
            }
          } catch (_) { /* không tải được → đi đường thường */ }
        }
        const nut = nutMoAnh(x.khung) || (lk ? null : nho || $('button', x.khung));
        if (nut) {
          bamGiua(nut);
          const v = await choAnhXem(nho ? 3000 : 15000);
          moXem = !!v || dangXem();
          if (v && dienTich(v) >= dienTich(img)) img = v;
        }
        if (!img) continue;
        const duCo = dienTich(img) > xemNho.dienTich || (moXem && img !== nho);
        ra.push(await thanhFile(await blobCuaAnh(img, han), img, p, {
          chiSo: k, xemTruoc: nho ? `${nho.naturalWidth}x${nho.naturalHeight}` : '', cachLay: img === nho ? 'chat' : 'trinh-xem',
          canChuotThat: !duCo && Math.max(img.naturalWidth, img.naturalHeight) < 1000 }));
      } finally {
        if (moXem) await dongTrinhXem();
      }
    }
    for (const khung of $$('[data-testid="hatch-chat-attachment-presentation-video"]')) {
      const v = videoCoNguon(khung);
      if (!v) continue;
      const b = await taiBlob(v.currentSrc || v.src, han);
      ra.push({ loai: 'video', mime: b.type || 'video/mp4', w: v.videoWidth || 0, h: v.videoHeight || 0, b64: await blobSangB64(b) });
    }
    return ra;
  }

  /** Bấm như người: menu Radix mở bằng pointerdown, sheet/nút thường bằng click → bắn cả hai. */
  function bam(e) {
    const o = { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true };
    e.dispatchEvent(new PointerEvent('pointerdown', o)); e.dispatchEvent(new MouseEvent('mousedown', o));
    e.dispatchEvent(new PointerEvent('pointerup', o)); e.dispatchEvent(new MouseEvent('mouseup', o));
    e.click();
  }
  const thanhHanMuc = () => { const t = $$('[role="dialog"] [role="progressbar"]'); return t.length ? t : null; };

  /**
   * Mức dùng token: Cài đặt → Chung → "Usage" (đo 11/10/2026). Mỗi gói một [role=progressbar]
   * (aria-valuenow = % đã dùng); khối cha có 3 dòng: tên gói, ghi chú (ngày đặt lại…), "56% used (3B tokens left)".
   * Mở Cài đặt bằng nút dock [data-testid=hatch-dock-more] → mục CUỐI của menu (không đọc chữ, chạy cả tiếng Việt).
   * Gọi trong cửa sổ riêng (kiểm tài khoản) — không đóng lại, cửa sổ bị huỷ ngay sau đó.
   */
  async function hanMuc() {
    await cho(() => daNap(oNhap()), 20000);
    const nut = await cho(() => $('[data-testid="hatch-dock-more"]') || $('[data-pel-click="settings_menu_open_click"]'), 10000);
    if (!nut) return { ok: false, loi: 'khong-thay-nut-cai-dat' };
    bam(nut);
    const menu = await cho(() => $$('[role="menu"],[role="dialog"]').pop(), 5000);
    if (!menu) return { ok: false, loi: 'khong-mo-duoc-menu' };
    if (!thanhHanMuc()) {
      const muc = $$('[role="menuitem"],button', menu).filter((b) => String(b.innerText || '').trim());
      if (muc.length) bam(muc.pop());
    }
    // Cửa sổ rộng: Cài đặt mở thẳng mục Chung. Cửa sổ hẹp: phải bấm mục đầu (Chung).
    let thanh = await cho(thanhHanMuc, 6000);
    if (!thanh) {
      const o = $$('[role="dialog"]').pop();
      const c = o && $('[data-slot="list-cell"]', o);
      if (c) { bam(c); thanh = await cho(thanhHanMuc, 6000); }
    }
    if (!thanh) return { ok: false, loi: 'khong-thay-han-muc' };
    return {
      ok: true,
      muc: thanh.map((b) => {
        const dong = String(b.parentElement.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
        return { ten: dong[0] || '', ghiChu: dong.length > 2 ? dong[1] : '', chu: dong.length > 1 ? dong[dong.length - 1] : '',
          phanTram: Math.max(0, Math.min(100, Number(b.getAttribute('aria-valuenow')) || 0)) };
      })
    };
  }

  // ── Xoá đoạn chat (đo 12/10/2026 ở 1280×800: danh sách chat phụ ghim bên trái) ───────────
  // Mỗi chat là [data-testid=hatch-thread-row] (chat đang mở có aria-current=page), các hàng là anh
  // em cùng cha; nút ⋯ nằm TRONG hàng. "Main chat" không có nút ⋯ → không xoá được, tự bỏ qua.
  // 1.3.0 (ảnh chụp người dùng 17/10/2026: "Side chats", menu ⋯ = Pin / Rename / Archive / Delete) — xoá chat
  // không còn chạy. Chưa có HTML thật nên dò THÊM đường dự phòng không cần thuộc tính data-*: hàng = liên kết
  // /thread/<id> ngoài khung tin nhắn; nút ⋯ có thể chỉ hiện khi rê chuột (gửi sự kiện rê chuột trước);
  // mục menu / nút xác nhận nhận theo CHỮ "Delete" / "Xoá" (cả hộp role=alertdialog); menu mở bằng
  // pointerdown, không mở thì bấm đủ (click). Hỏng thì trả HTML khung danh sách + menu để chẩn đoán.
  const XOA = /^\s*(delete|xoá|xóa)(\s+(chat|side chat|đoạn chat|cuộc trò chuyện))?\s*$/i;
  const chuCua = (e) => String((e && (e.innerText || e.textContent)) || '').trim();
  const nutTrongVung = (h) => h && ($('button[data-pel-click="chat_thread_options_open"]', h) || $('button[aria-haspopup="menu"]', h) ||
    $$('button,[role="button"]', h).find((b) => b !== h && (/^(more|options|tuỳ chọn|tùy chọn|thêm)/i.test(nhan(b)) || /^(⋯|…|\.\.\.)$/.test(chuCua(b)))));
  /** Hàng + các thẻ bọc nó mà vẫn chỉ chứa ĐÚNG một chat (nút ⋯ có thể nằm cạnh liên kết, trong thẻ bọc hàng). */
  const vungHang = (h) => {
    const ds = [h];
    if (!h || !h.matches('a[href*="/thread/"]')) return ds;
    for (let e = h.parentElement, i = 0; e && e !== document.body && i < 3 && e.querySelectorAll('a[href*="/thread/"]').length === 1; e = e.parentElement, i++) ds.push(e);
    return ds;
  };
  const nutTrongHang = (h) => { for (const v of vungHang(h)) { const b = nutTrongVung(v); if (b) return b; } return null; };
  const laTrongKhungTin = (e) => !!e.closest('[role="log"],[data-message-role]');
  /** Hàng chat phụ: theo thuộc tính đã đo; không có thì theo liên kết /thread/<id> (Muse đổi giao diện). */
  const hangGoc = () => {
    const theoMa = $$('[data-testid="hatch-thread-row"]');
    if (theoMa.length) return theoMa;
    // Hàng = chính liên kết; nút ⋯ tìm trong liên kết và các thẻ bọc chỉ chứa nó (vungHang). Đừng leo lên thẻ
    // bọc làm hàng: còn MỘT chat thì thẻ bọc là cả khung danh sách, rê chuột vào đó không hiện nút ⋯ của hàng.
    return $$('a[href*="/thread/"]').filter((a) => !laTrongKhungTin(a) && !/\/thread\/new\b/.test(a.getAttribute('href') || ''));
  };
  function reChuot(h) {
    const o = { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true };
    for (const e of vungHang(h).reverse()) {
      for (const [ten, Kieu] of [['pointerover', PointerEvent], ['pointerenter', PointerEvent], ['mouseover', MouseEvent], ['mouseenter', MouseEvent], ['pointermove', PointerEvent], ['mousemove', MouseEvent]]) {
        try { e.dispatchEvent(new Kieu(ten, o)); } catch (_) {}
      }
    }
  }
  const nutChat = (h) => nutTrongHang(h);
  const hangChat = () => hangGoc().filter(nutChat);
  const maThread = (h) => {
    const a = h && (h.matches('a[href*="/thread/"]') ? h : $('a[href*="/thread/"]', h));
    return (a && ((a.getAttribute('href') || '').match(/\/thread\/([^/?#]+)/) || [])[1]) || (h && h.getAttribute('data-id')) || '';
  };
  /** Hàng chat phụ (kể cả hàng chỉ hiện nút ⋯ khi rê chuột). */
  async function cacHang() {
    let ds = hangChat();
    if (ds.length) return ds;
    const goc = hangGoc();
    if (!goc.length) return [];
    for (const h of goc) reChuot(h);
    await ngu(300);
    ds = hangChat();
    return ds;
  }
  const dongMenu = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const menuMo = () => $$('[role="menu"]').pop();
  const mucXoa = () => $('[role="menu"] [data-pel-click="chat_thread_delete_open"]') ||
    $$('[role="menu"] [role="menuitem"], [role="menu"] button').find((e) => XOA.test(chuCua(e)));
  const nutXacNhan = () => $('[role="dialog"] [data-pel-click="chat_thread_delete_confirm"], [role="alertdialog"] [data-pel-click="chat_thread_delete_confirm"]') ||
    $$('[role="alertdialog"] button, [role="dialog"] button').filter((b) => XOA.test(chuCua(b)) || XOA.test(nhan(b))).pop();
  let loiCuoi = '', menuLoi = '', hopLoi = '';

  // 1.3.2 (tệp chẩn đoán người dùng 18/10/2026): hàng chat phụ THẬT không có href / data-id; danh sách nạp
  // dần nên xoá một hàng thì hàng kế được nạp bù → đếm số hàng không đổi. Nhận ra hàng bằng id nút ⋯
  // (radix-_r_qi_ — React giữ nguyên id khi vẽ lại danh sách) + tên chat.
  const idNutCua = (h) => { const b = nutChat(h); return (b && b.id) || ''; };
  const tenHang = (h) => chuCua(h && ($('span[title]', h) || h)).split('\n')[0].slice(0, 80);
  /** Hàng vẫn còn trên màn hình? (hàng đang chạy hiệu ứng biến mất: rời bố cục / mờ hẳn = coi như đã xoá) */
  const conHien = (e) => {
    if (!e || !e.isConnected || !e.getClientRects().length) return false;
    for (let x = e, i = 0; x && x !== document.body && i < 4; x = x.parentElement, i++) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || x.getAttribute('aria-hidden') === 'true') return false;
    }
    return e.getBoundingClientRect().height >= 2;
  };
  const hangCuaNut = (b) => b.closest('[data-testid="hatch-thread-row"]') || hangGoc().find((x) => x.contains(b)) || b;
  /** Đã xoá hàng `h` chưa — so với ảnh chụp danh sách trước khi xoá (`chup`). */
  function daXoa(h, chup) {
    if (hangGoc().length < chup.soHang) return true;
    if (chup.ma && !hangGoc().some((x) => maThread(x) === chup.ma)) return true;
    if (chup.idNut) {
      const b = document.getElementById(chup.idNut);
      // Nút ⋯ thật bị ẩn (display:none) tới khi rê chuột → xét HÀNG chứa nút, đừng xét chính nút.
      if (!b || !conHien(hangCuaNut(b))) {
        // Mất id nút: chỉ tin khi phần lớn các hàng khác còn nguyên id (không phải Muse vẽ lại cả danh sách).
        const con = chup.idKhac.filter((id) => document.getElementById(id)).length;
        if (!chup.idKhac.length || con * 2 >= chup.idKhac.length) return true;
      }
      return false;
    }
    return !conHien(h);
  }
  /** Chữ của thông báo nổi (toast) đang hiện — Muse báo lỗi xoá ở đây. */
  const thongBaoMuse = () => $$('[role="status"],[role="alert"],[data-sonner-toast],[data-testid*="toast" i]')
    .map(chuCua).filter(Boolean).join(' | ').replace(/\s+/g, ' ').slice(0, 200);
  /** Bấm có toạ độ giữa phần tử (thư viện "press" bỏ qua pointerup ở toạ độ 0,0 = ngoài nút). */
  function bamGiua(e) {
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const o = { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, view: window };
    e.dispatchEvent(new PointerEvent('pointerdown', o)); e.dispatchEvent(new MouseEvent('mousedown', o));
    e.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 })); e.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
    e.dispatchEvent(new MouseEvent('click', { ...o, buttons: 0, detail: 1 }));
  }
  const hopCua = (b) => b && b.closest('[role="dialog"],[role="alertdialog"]');
  const nutBat = (b) => b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';

  async function xoaHang(h) {
    const chup = { soHang: hangGoc().length, ma: maThread(h), idNut: idNutCua(h), ten: tenHang(h),
      idKhac: hangChat().filter((x) => x !== h).map(idNutCua).filter(Boolean) };
    let nut = nutChat(h);
    if (!nut) { reChuot(h); nut = await cho(() => nutChat(h), 2000); }
    if (!nut) { loiCuoi = 'khong-thay-nut-3-cham'; return false; }
    if (!chup.idNut) chup.idNut = nut.id || '';
    // Menu Radix mở bằng pointerdown. KHÔNG bắn click trước: click nổi lên hàng → Muse chuyển sang chat đó.
    nut.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
    let muc = await cho(mucXoa, 1500);
    if (!muc && !menuMo()) { bam(nut); muc = await cho(mucXoa, 3500); }
    if (!muc) {
      loiCuoi = menuMo() ? `menu-khong-co-delete: ${chuCua(menuMo()).replace(/\s+/g, ' | ').slice(0, 120)}` : 'khong-mo-duoc-menu';
      menuLoi = menuMo() ? menuMo().outerHTML.slice(0, 100000) : '';   // giữ HTML menu trước khi đóng — cho tệp chẩn đoán
      dongMenu(); return false;
    }
    menuLoi = menuMo() ? menuMo().outerHTML.slice(0, 30000) : '';
    bam(muc);
    const ok = await cho(nutXacNhan, 5000);
    if (!ok) {
      if (await cho(() => daXoa(h, chup), 1500)) return true;   // Muse xoá luôn, không hỏi lại
      loiCuoi = 'khong-thay-nut-xac-nhan'; dongMenu(); return false;
    }
    hopLoi = (hopCua(ok) || ok).outerHTML.slice(0, 30000);
    // Hộp vừa mở còn chạy hiệu ứng / nút xác nhận còn khoá → đợi nút bấm được rồi mới bấm.
    await cho(() => nutBat(ok), 3000);
    await ngu(300);
    ok.click();
    // Muse không nhận cú bấm (hộp vẫn mở) → bấm lại kiểu đủ sự kiện chuột, có toạ độ giữa nút.
    if (!(await cho(() => !ok.isConnected || !conHien(ok) || daXoa(h, chup), 2500)) && ok.isConnected) bamGiua(ok);
    const xong = await cho(() => daXoa(h, chup), 15000);
    if (!xong) {
      const tb = thongBaoMuse();
      loiCuoi = 'xoa-xong-nhung-danh-sach-khong-doi' + (tb ? ` · Muse báo: ${tb}` : '') +
        (hopCua(ok) && ok.isConnected ? ' · hộp xác nhận vẫn mở' : '');
      if (ok.isConnected) dongMenu();
    }
    return !!xong;
  }

  /**
   * Toạ độ để tiến trình chính bấm CHUỘT THẬT (debugger) khi cú bấm bằng JavaScript không ăn (isTrusted = false).
   * buoc 'nut': nút ⋯ của hàng cần xoá (chat đang mở nếu dangMo, không thì hàng đầu có nút ⋯), cuộn hàng vào giữa
   * khung; 'muc': mục Delete của menu đang mở; 'xacNhan': nút xác nhận trong hộp. Không thấy → null.
   */
  async function diemXoa(p) {
    const giua = (e) => { const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
    if (p.buoc === 'nut') {
      const ma = (location.pathname.match(/\/thread\/([^/?#]+)/) || [])[1] || '';
      let h = p.dangMo ? hangGoc().find((x) => x.getAttribute('aria-current') === 'page' || $('[aria-current="page"]', x) || (ma && maThread(x) === ma))
        : (await cacHang())[0];
      if (!h && !p.dangMo) {
        // Danh sách nạp dần: kéo tới "nạp thêm"; vẫn không còn hàng nào có nút ⋯ → hết chat để xoá.
        const s = $('[data-testid="active-side-chat-load-more-sentinel"]');
        if (s) s.scrollIntoView();
        h = await cho(() => hangChat()[0], 4000);
        if (!h) return { het: true };
      }
      if (!h) return null;
      h.scrollIntoView({ block: 'center' });
      reChuot(h);
      const b = await cho(() => nutChat(h), 2000);
      if (!b) return null;
      await ngu(200);
      if (!b.id) b.id = 'muse-xoa-' + Date.now();
      chupThat = { soHang: hangGoc().length, ma: maThread(h), idNut: b.id, ten: tenHang(h),
        idKhac: hangChat().filter((x) => x !== h).map(idNutCua).filter(Boolean), hang: h };
      // Toạ độ HÀNG: tiến trình chính rê chuột thật vào hàng trước — nút ⋯ chỉ hiện khi rê chuột (CSS :hover).
      return { ...giua(h), ten: chupThat.ten };
    }
    if (p.buoc === 'nutHien') {
      const b = chupThat && document.getElementById(chupThat.idNut);
      return b && giua(b);
    }
    if (p.buoc === 'muc') { const m = mucXoa(); return m && giua(m); }
    if (p.buoc === 'xacNhan') {
      const b = nutXacNhan();
      if (!b || !nutBat(b)) return null;
      hopLoi = (hopCua(b) || b).outerHTML.slice(0, 30000);
      return giua(b);
    }
    if (p.buoc === 'daXoa') return chupThat ? daXoa(chupThat.hang, chupThat) : false;
    return null;
  }
  let chupThat = null;

  /** HTML gọn của khung danh sách chat + menu / hộp thoại đang mở — để chẩn đoán khi xoá không được. */
  function chanDoanXoa() {
    const goc = hangGoc()[0];
    let khung = goc;
    for (let i = 0; khung && i < 6 && khung.parentElement && khung.parentElement !== document.body; i++) khung = khung.parentElement;
    const lay = (e) => (e ? e.outerHTML.slice(0, 200000) : '');
    return {
      url: location.href, loi: loiCuoi, soHang: hangGoc().length, soHangCoNut: hangChat().length,
      danhSach: lay(khung || $('[data-testid="hatch-side-chats-panel-content"]') || $('nav') || $('aside')),
      menu: [menuLoi, hopLoi && '<!-- hộp xác nhận lúc bấm -->\n' + hopLoi, ...$$('[role="menu"],[role="dialog"],[role="alertdialog"]').map(lay)].filter(Boolean).join('\n'),
      thongBao: thongBaoMuse()
    };
  }

  /** Xoá chat đang mở (mở /thread/<id> trước). */
  async function xoaChatDangMo() {
    loiCuoi = ''; menuLoi = ''; hopLoi = '';
    const ma = (location.pathname.match(/\/thread\/([^/?#]+)/) || [])[1] || '';
    const tim = () => hangGoc().find((x) => x.getAttribute('aria-current') === 'page' || $('[aria-current="page"]', x) || (ma && maThread(x) === ma));
    // Danh sách nạp dần: chat đang mở có thể nằm dưới phần đã nạp → kéo tới "nạp thêm" trong lúc tìm.
    const h = await cho(() => tim() || void ($('[data-testid="active-side-chat-load-more-sentinel"]') || { scrollIntoView() {} }).scrollIntoView(), 20000);
    if (!h) return { ok: false, loi: 'khong-thay-chat', chanDoan: chanDoanXoa() };
    return (await xoaHang(h)) ? { ok: true } : { ok: false, loi: loiCuoi || 'xoa-khong-duoc', chanDoan: chanDoanXoa() };
  }

  /** Xoá lần lượt mọi chat phụ trong danh sách, tối đa `toiDa` cái mỗi lần gọi. */
  async function xoaNhieuChat(p) {
    loiCuoi = ''; menuLoi = ''; hopLoi = '';
    const toiDa = (p && p.toiDa) || 10;
    await cho(() => hangGoc().length || $('[data-testid="hatch-side-chats-panel-content"]'), 20000);
    await ngu(1500);
    let da = 0;
    while (da < toiDa) {
      let h = (await cacHang())[0];
      if (!h) {
        // Danh sách nạp dần: kéo tới "nạp thêm" rồi xem còn không.
        const s = $('[data-testid="active-side-chat-load-more-sentinel"]');
        if (s) s.scrollIntoView();
        h = await cho(() => hangChat()[0], 4000);
        if (!h) { const c = await cacHang(); h = c[0]; }
        if (!h) {
          // Không thấy hàng nào có nút ⋯ mà vẫn có hàng chat → giao diện Muse lạ: báo kèm chẩn đoán.
          // ("Main chat" không có nút ⋯ và không mang mã chat → một hàng như thế không tính.)
          const goc = hangGoc();
          if (!da && (goc.length > 1 || goc.some(maThread))) { loiCuoi = 'khong-thay-nut-3-cham'; return { ok: false, da, loi: loiCuoi, chanDoan: chanDoanXoa() }; }
          break;
        }
      }
      if (!(await xoaHang(h))) return { ok: false, da, loi: loiCuoi || 'xoa-khong-duoc', chanDoan: chanDoanXoa() };
      da++;
      await ngu(400);
    }
    return { ok: true, da, conLai: hangChat().length };
  }

  window.__muse = { phienBan: 1, trangThai, gui, ketQua, layFile, diemAnh, layAnhXem, diemNutXem, docAnhTai, chanDoanAnh, hanMuc, xoaChatDangMo, xoaNhieuChat, diemXoa, chanDoanXoa: () => chanDoanXoa() };
})();
undefined;
