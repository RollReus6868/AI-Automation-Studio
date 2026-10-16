// ============================================================================
//  flow-tai-anh.js — TÌM ĐƯỜNG TẢI ẢNH LÊN FLOW (1.2.1)
//  --------------------------------------------------------------------------
//  TRIỆU CHỨNG (ảnh nhật ký người dùng 16/10/2026, flow.google.com):
//    "Tải ảnh lên Flow hỏng: Không tìm thấy ô tải ảnh lên của Flow. Hãy mở menu [+] → tab Hình ảnh…"
//  Engine (giống hệt Flow Automation Studio 2.8.9) chỉ biết một cách: bấm [+] rồi chờ một
//  <input type="file"> NẰM SẴN trong trang để nhét file vào. Flow mới không còn ô đó nằm sẵn — kiểu web
//  mới tạo ô chọn file lúc bấm "Tải lên" rồi mở hộp chọn file ngay (ô không gắn vào trang).
//
//  File này chỉ TÌM và BẤM; phần đưa file vào do tiến trình chính làm qua kênh debugger
//  (src/flow/main/tai-anh-len.js): chặn hộp chọn file của trang rồi đặt file thật vào ô vừa mở, hoặc
//  kéo-thả file thật vào ô nhập prompt. Không giả mạo gì: đúng các bước người dùng tự bấm tay.
//
//  Phơi ra window.__flowTaiAnh:
//    timInput()   → <input type=file> nhận ảnh đang có trong trang (kể cả trong shadow DOM) | null
//    bamTaiLen()  → { ok, nut }  bấm mục "Tải lên / Upload" đang hiện (menu [+] đã mở)
//    moTabAnh()   → { ok, nut }  bấm tab "Hình ảnh / Images" trong menu nếu có
//    moMenu()     → { ok, nut }  bấm nút [+] / Thêm cạnh ô nhập prompt (không bấm lại nếu menu đã mở)
//    viTriTha()   → { ok, x, y } giữa ô nhập prompt (toạ độ khung nhìn, cho kéo-thả)
//    dongMenu()   → đóng menu / popover đang mở (Escape)
//    chanDoan()   → mô tả các nút quanh ô nhập — ghi vào nhật ký khi mọi cách đều hỏng
// ============================================================================

(function () {
  'use strict';
  if (window.__flowTaiAnh) return;

  var O_NHAP = '.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], textarea';
  var NUT = 'button, [role="button"], [role="menuitem"], [role="option"], [role="tab"], label, li, a';
  var ICON_THEM = /^(add|add_2|add_circle|add_box|add_photo_alternate|attach_file|attachment|image|photo|add_a_photo)$/;
  var CHU_THEM = /^(add|thêm|attach|đính kèm|upload|tải lên|insert|chèn)\b|add (media|image|photo|ingredient|asset)|thêm (ảnh|hình|nội dung|thành phần)/i;
  var ICON_TAI = /^(upload|file_upload|upload_file|cloud_upload|drive_folder_upload|add_photo_alternate|computer|folder_open)$/;
  // Nút TẢI LÊN là một hành động: nhãn bắt đầu bằng động từ ("Tải nội dung nghe nhìn lên" — Flow 16/10/2026,
  // "Upload image", "Chọn tệp"…). Mục LỌC "Tệp tải lên" / "Uploads" ở cột trái bảng kho chỉ lọc danh sách —
  // bấm nhầm nó thì không hộp chọn file nào mở (lỗi 1.2.1: app bấm nó rồi rơi xuống kéo-thả).
  var CHU_TAI = /^(tải|upload|chọn (tệp|ảnh|file)|choose file|browse|from (your )?(computer|device)|từ máy|từ thiết bị|add (media|image|file)s? from)/i;
  var KHONG_TAI = /^(tệp|file|uploads$|uploaded|đã tải|tải xuống|download)/i;
  var CHU_TAB_ANH = /^(hình ảnh|ảnh|images?|photos?)$/i;

  function hien(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }
  // Duyệt cả shadow DOM (web component của Google).
  function tatCa(sel, goc) {
    var kq = [];
    (function di(n) {
      if (!n) return;
      if (n.querySelectorAll) kq.push.apply(kq, n.querySelectorAll(sel));
      var ds = n.querySelectorAll ? n.querySelectorAll('*') : [];
      for (var i = 0; i < ds.length; i++) if (ds[i].shadowRoot) di(ds[i].shadowRoot);
    })(goc || document);
    return kq;
  }
  function icon(el) {
    var i = el.querySelector && el.querySelector('i.google-symbols, i.material-icons, mat-icon, .material-symbols-outlined, .material-icons, .google-symbols');
    return i ? (i.textContent || '').trim().toLowerCase() : '';
  }
  function nhan(el) {
    var a = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    var c = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    var ic = icon(el);
    if (ic && c.toLowerCase().indexOf(ic) === 0) c = c.slice(ic.length).trim();   // "add_2 Thêm" → "Thêm"
    return { a: a, c: c.slice(0, 60), ic: ic };
  }
  function moTa(el) { var n = nhan(el); return (n.a || n.c || n.ic || el.tagName.toLowerCase()).slice(0, 40); }

  // Bấm như người: pointer + mouse + click (menu kiểu Radix chỉ mở bằng pointerdown).
  function bam(el) {
    var r = el.getBoundingClientRect();
    var o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerType: 'mouse', isPrimary: true }, o))); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mousedown', o));
    try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerType: 'mouse', isPrimary: true }, o))); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.click();
  }

  function oNhap() {
    var ds = tatCa(O_NHAP).filter(hien);
    return ds[ds.length - 1] || null;
  }
  // Khối bao ô nhập (đi lên tối đa 6 tầng tới khi có thêm nút) — nút [+] nằm trong khối này.
  function khoiNhap() {
    var o = oNhap();
    if (!o) return null;
    var k = o;
    for (var i = 0; i < 6 && k.parentElement; i++) {
      k = k.parentElement;
      if (k.querySelectorAll('button, [role="button"]').length >= 2) break;
    }
    return k;
  }

  function timInput() {
    var ds = tatCa('input[type="file"]').filter(function (i) { return !i.disabled && !i.closest('#veo-extra-tools-overlay'); });
    return ds.find(function (i) { return /image|\*/.test(i.getAttribute('accept') || ''); }) ||
      ds.find(function (i) { return !i.getAttribute('accept'); }) || null;
  }

  function timNut(kiem, trongKhoi) {
    var goc = trongKhoi || document;
    var ds = tatCa(NUT, goc).filter(hien);
    for (var i = 0; i < ds.length; i++) if (kiem(ds[i], nhan(ds[i]))) return ds[i];
    return null;
  }
  var laTaiLen = function (el, n) {
    var s = (n.c || n.a || '').toLowerCase();
    if (s) return !KHONG_TAI.test(s) && (CHU_TAI.test(s) || /tải\b.{0,30}\blên/.test(s));
    return ICON_TAI.test(n.ic);          // nút chỉ có biểu tượng
  };
  var laThem = function (el, n) {
    if (el.closest('[role="menu"], [role="listbox"], [role="dialog"]')) return false;
    if (/generat|tạo|send|gửi/i.test(n.a)) return false;
    return el.classList.contains('add-menu-trigger') || ICON_THEM.test(n.ic) || CHU_THEM.test(n.a) || (!n.ic && CHU_THEM.test(n.c) && n.c.length < 30);
  };

  function bamTaiLen() {
    // Mục tải lên của menu đang mở (ưu tiên trong menu / popover), không lấy nút [+] ngoài ô nhập.
    var menu = tatCa('[role="menu"], [role="listbox"], [role="dialog"], .cdk-overlay-pane, .cdk-overlay-container, .add-menu-popover-container, [data-radix-popper-content-wrapper]').filter(hien);
    for (var i = 0; i < menu.length; i++) {
      var n = timNut(laTaiLen, menu[i]);
      if (n) { bam(n); return { ok: true, nut: moTa(n) }; }
    }
    var k = khoiNhap();
    var b = timNut(laTaiLen, k || document);
    if (b) { bam(b); return { ok: true, nut: moTa(b) }; }
    return { ok: false };
  }
  function moTabAnh() {
    var t = timNut(function (el, n) { return CHU_TAB_ANH.test(n.c) || CHU_TAB_ANH.test(n.a); });
    if (!t) return { ok: false };
    bam(t);
    return { ok: true, nut: moTa(t) };
  }
  function moMenu() {
    var k = khoiNhap();
    var b = (k && timNut(laThem, k)) || timNut(laThem);
    if (!b) return { ok: false };
    // Bảng đang mở rồi (engine vừa mở, hoặc lần trước) → bấm nữa là ĐÓNG nó.
    if (b.getAttribute('aria-expanded') === 'true') return { ok: true, nut: moTa(b) + ' (đang mở)' };
    bam(b);
    return { ok: true, nut: moTa(b) };
  }
  function viTriTha() {
    var o = oNhap();
    if (!o) return { ok: false };
    var r = o.getBoundingClientRect();
    return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 30)) };
  }
  function dongMenu() {
    var o = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', o));
    document.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  function chanDoan() {
    var k = khoiNhap();
    var nut = tatCa('button, [role="button"], [role="menuitem"]', k || document).filter(hien).slice(0, 25).map(function (el) {
      var n = nhan(el);
      return [n.ic && ('[' + n.ic + ']'), n.a && ('"' + n.a.slice(0, 30) + '"'), !n.a && n.c && n.c.slice(0, 30)].filter(Boolean).join(' ');
    }).filter(Boolean);
    return { oNhap: !!oNhap(), soInput: tatCa('input[type="file"]').length, nut: nut };
  }

  window.__flowTaiAnh = { timInput: timInput, bamTaiLen: bamTaiLen, moTabAnh: moTabAnh, moMenu: moMenu,
    viTriTha: viTriTha, dongMenu: dongMenu, chanDoan: chanDoan };
})();
