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
    return nutTheoNhan(NHAN.mo, tin)[0] || null;
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

  async function anhSangPng(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return await new Promise((r) => c.toBlob(r, 'image/png'));
  }

  /** Ảnh trong khung chưa nạp (ảnh lười) → mở trình xem của Muse để lấy. */
  async function moTrinhXem(khung) {
    const nut = nutMoAnh(khung) || $('button', khung);
    if (!nut) return { daMo: false, img: null };
    nut.click();
    const img = await cho(() => {
      const d = $$('[role="dialog"]').pop();
      return d ? anhDaNap(d) : null;
    }, 15000);
    return { daMo: true, img };
  }
  function dongTrinhXem() {
    const d = $$('[role="dialog"]').pop();
    const nut = d && nutTheoNhan(NHAN.dong, d)[0];
    if (nut) nut.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  /**
   * Lấy file gốc của mọi ảnh/video Muse trả trong chat này.
   * @param {{png:boolean}} p  png=true: đổi ảnh webp sang png
   */
  async function layFile(p) {
    const ra = [];
    for (const khung of $$('[data-testid="hatch-chat-attachment-presentation-image"]')) {
      let img = anhDaNap(khung);
      let moXem = false;
      try {
        // Đã mở trình xem thì LUÔN đóng lại, kể cả khi không lấy được ảnh —
        // nếu không, mỗi vòng lại mở thêm một trình xem chồng lên.
        if (!img) { const x = await moTrinhXem(khung); moXem = x.daMo; img = x.img; }
        if (!img) continue;
        let b = await (await fetch(img.src)).blob();
        if (p && p.png && b.type !== 'image/png') b = (await anhSangPng(img)) || b;
        ra.push({ loai: 'anh', mime: b.type || 'image/png', w: img.naturalWidth, h: img.naturalHeight, b64: await blobSangB64(b) });
      } finally {
        if (moXem) { dongTrinhXem(); await ngu(400); }
      }
    }
    for (const khung of $$('[data-testid="hatch-chat-attachment-presentation-video"]')) {
      const v = videoCoNguon(khung);
      if (!v) continue;
      const b = await (await fetch(v.currentSrc || v.src)).blob();
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
  let loiCuoi = '', menuLoi = '';

  async function xoaHang(h) {
    const truoc = hangGoc().length, ma = maThread(h);
    let nut = nutChat(h);
    if (!nut) { reChuot(h); nut = await cho(() => nutChat(h), 2000); }
    if (!nut) { loiCuoi = 'khong-thay-nut-3-cham'; return false; }
    // Menu Radix mở bằng pointerdown. KHÔNG bắn click trước: click nổi lên hàng → Muse chuyển sang chat đó.
    nut.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
    let muc = await cho(mucXoa, 1500);
    if (!muc && !menuMo()) { bam(nut); muc = await cho(mucXoa, 3500); }
    if (!muc) {
      loiCuoi = menuMo() ? `menu-khong-co-delete: ${chuCua(menuMo()).replace(/\s+/g, ' | ').slice(0, 120)}` : 'khong-mo-duoc-menu';
      menuLoi = menuMo() ? menuMo().outerHTML.slice(0, 100000) : '';   // giữ HTML menu trước khi đóng — cho tệp chẩn đoán
      dongMenu(); return false;
    }
    bam(muc);
    const ok = await cho(nutXacNhan, 5000);
    if (ok) ok.click();
    else if (!(await cho(() => hangGoc().length < truoc, 1500))) { loiCuoi = 'khong-thay-nut-xac-nhan'; dongMenu(); return false; }
    // Xoá xong = danh sách ngắn đi, hoặc không còn hàng của chat đó (KHÔNG dựa vào hàng rời DOM: Muse vẽ lại
    // danh sách là hàng cũ rời ngay).
    const xong = await cho(() => hangGoc().length < truoc || (ma && !hangGoc().some((x) => maThread(x) === ma)), 15000);
    if (!xong) loiCuoi = 'xoa-xong-nhung-danh-sach-khong-doi';
    return !!xong;
  }

  /** HTML gọn của khung danh sách chat + menu / hộp thoại đang mở — để chẩn đoán khi xoá không được. */
  function chanDoanXoa() {
    const goc = hangGoc()[0];
    let khung = goc;
    for (let i = 0; khung && i < 6 && khung.parentElement && khung.parentElement !== document.body; i++) khung = khung.parentElement;
    const lay = (e) => (e ? e.outerHTML.slice(0, 200000) : '');
    return {
      url: location.href, loi: loiCuoi, soHang: hangGoc().length, soHangCoNut: hangChat().length,
      danhSach: lay(khung || $('[data-testid="hatch-side-chats-panel-content"]') || $('nav') || $('aside')),
      menu: [menuLoi, ...$$('[role="menu"],[role="dialog"],[role="alertdialog"]').map(lay)].filter(Boolean).join('\n')
    };
  }

  /** Xoá chat đang mở (mở /thread/<id> trước). */
  async function xoaChatDangMo() {
    loiCuoi = ''; menuLoi = '';
    const ma = (location.pathname.match(/\/thread\/([^/?#]+)/) || [])[1] || '';
    const tim = () => hangGoc().find((x) => x.getAttribute('aria-current') === 'page' || $('[aria-current="page"]', x) || (ma && maThread(x) === ma));
    const h = await cho(tim, 20000);
    if (!h) return { ok: false, loi: 'khong-thay-chat', chanDoan: chanDoanXoa() };
    return (await xoaHang(h)) ? { ok: true } : { ok: false, loi: loiCuoi || 'xoa-khong-duoc', chanDoan: chanDoanXoa() };
  }

  /** Xoá lần lượt mọi chat phụ trong danh sách, tối đa `toiDa` cái mỗi lần gọi. */
  async function xoaNhieuChat(p) {
    loiCuoi = ''; menuLoi = '';
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

  window.__muse = { phienBan: 1, trangThai, gui, ketQua, layFile, hanMuc, xoaChatDangMo, xoaNhieuChat };
})();
undefined;
