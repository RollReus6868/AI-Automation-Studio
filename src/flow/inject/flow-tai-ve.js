// ============================================================================
//  flow-tai-ve.js — MỤC CHẤT LƯỢNG BỊ KHOÁ TRONG MENU "TẢI XUỐNG" CỦA FLOW (1.2.3)
//  --------------------------------------------------------------------------
//  TRIỆU CHỨNG (nhật ký + ảnh chụp người dùng 16/10/2026): video tạo xong, nhưng
//    "Media 1/1 lỗi: Chờ 120s mà Google chưa xuất file (Du_an_4_347)" ×3 rồi "5 phút chưa tải về được".
//  Menu ⋯ → Tải xuống của Flow mới: 270p (Ảnh GIF động) · 720p (Kích thước gốc) · 1080p và 4K
//  ("Đã tăng độ phân giải", mờ, kèm nút "Nâng cấp") — tài khoản thường KHÔNG được tải 1080p / 4K.
//  Engine (y hệt Flow Automation Studio 2.8.9) chọn mục theo chữ: thấy chữ "1080p" là bấm, không biết
//  mục đó đang khoá → bấm không ra gì, chờ 120 s, thử lại, hết lượt. Bậc dự phòng của engine
//  (1080p → 720p → 270p) chỉ chạy khi KHÔNG thấy mục 1080p.
//
//  Không sửa engine (quy ước dự án). File này chạy trong MAIN WORLD, canh menu tải xuống mỗi khi nó hiện
//  ra và ẨN các mục chất lượng đang khoá (visibility:hidden — engine bỏ qua mục không hiện). Engine không
//  thấy 1080p nữa → tự hạ xuống 720p và ghi "Không có 1080p, dùng "720p" thay thế.". Tài khoản trả phí
//  (1080p mở) thì không ẩn gì, vẫn tải 1080p như cũ.
//
//  1.2.7 (nhật ký 17/10/2026: ẢNH Flow tạo xong nhưng "Không chọn được chất lượng tải xuống" ở mọi lần thử):
//  bản 1.2.3 coi mọi mục MỜ là khoá, ẩn ngay và KHÔNG BAO GIỜ hiện lại. Menu tải mở ra với các mục còn mờ một lúc
//  (Flow đang chuẩn bị file) → 1K / 2K / 4K bị ẩn hết → engine chỉ còn các mục menu thẻ, không mục nào để bấm. Giờ:
//    • khoá = có chữ / nút "Nâng cấp", hoặc mờ trong khi mục khác đã sáng; mờ HẾT = đang chuẩn bị, không ẩn gì;
//    • không bao giờ ẩn mục "Kích thước gốc / Original", không bao giờ ẩn HẾT mục chất lượng của một menu;
//    • mỗi lần menu đổi (kể cả mờ / sáng) xét LẠI từng mục: hết khoá thì hiện lại;
//    • đọc chữ từng mảnh ("1K" + "Kích thước gốc"), không dán liền;
//    • lưới an toàn: engine bấm trúng mục khoá (lúc lấy danh sách chưa biết) → bấm mục mở cao nhất thay;
//    • ghi vào nhật ký mục nào bị bỏ qua / bị thay.

//  1.3.7 (nhật ký + tệp chẩn đoán 18/10/2026 19:16): ảnh Flow tạo xong, "Chờ 120s mà Google chưa xuất file" ×3 rồi
//  "5 phút chưa tải về được". Tệp chẩn đoán: menu ẢNH 1K (Kích thước gốc) · 2K · 4K đều SÁNG (không "Nâng cấp"), và
//  thông báo đỏ <flow-snackbar class="error"> "Không tăng được độ phân giải!". Cài đặt mặc định tải ảnh 2K → engine bấm
//  2K → Flow phải TĂNG độ phân giải (tốn tín dụng AI — tài khoản hết tín dụng / Flow lỗi thì báo như trên) → không có
//  file nào, engine chờ 120 s, thử lại đúng mục đó, hết lượt. Giờ:
//    • thấy thông báo "không tăng được độ phân giải / không đủ tín dụng" trong 90 s sau khi engine bấm một mục ĐÃ TĂNG
//      (2K / 4K / 1080p) → mở lại menu của đúng thẻ đó và bấm "Kích thước gốc" (engine vẫn đang chờ đúng tên file nên
//      file về là khớp tên); ghi nhật ký;
//    • từ đó tới 30 phút, tab này coi các mục ĐÃ TĂNG như mục khoá: engine bấm 2K → bấm "Kích thước gốc" thay ngay.

//  Phơi ra window.__flowTaiVe:
//    anKhoa()   → số mục vừa ẩn (bình thường tự chạy khi trang đổi)
//    menuCuoi   → HTML (đã làm sạch) của menu chất lượng gần nhất — đưa vào tệp chẩn đoán khi tải hỏng.
//    menuMo     → HTML của menu gần nhất KHÔNG có mục chất lượng nào (phòng khi Flow đổi chữ các mục).
// ============================================================================

(function () {
  'use strict';
  if (window.__flowTaiVe) return;

  var MUC = '[role="menuitem"], [role="menuitemradio"], button.mat-mdc-menu-item';
  var CHAT_LUONG = /\b\d{3,4}\s*p\b|\b[124]\s*k\b/i;
  var KHOA_CHU = /nâng cấp|upgrade|nâng hạng|mở khoá|unlock/i;
  var GOC = /kích thước gốc|kich thuoc goc|\bgốc\b|original/i;

  // Mục ghi rõ phải nâng cấp (chữ "Nâng cấp" trong mục, hoặc nút "Nâng cấp" cùng dòng).
  function canNangCap(el) {
    if (KHOA_CHU.test(el.textContent || '')) return true;
    var dong = el.parentElement;
    return !!(dong && !dong.matches('[role="menu"], .mat-mdc-menu-content, .cdk-overlay-pane') &&
      dong.querySelectorAll(MUC).length === 1 && KHOA_CHU.test(dong.textContent || ''));
  }
  function mo(el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')) return false;
    return !/(^|[\s-])disabled\b/i.test(String(el.className || ''));
  }
  // Khoá = cần nâng cấp, hoặc mờ trong khi mục khác cùng menu đã sáng. Mờ HẾT = Flow đang chuẩn bị file, chưa khoá gì.
  // Mục "Kích thước gốc / Original" không bao giờ tính là khoá.
  function biKhoa(el, ds) {
    if (GOC.test(chu(el))) return false;
    if (canNangCap(el)) return true;
    return !mo(el) && (ds || []).some(function (m) { return m !== el && mo(m) && !canNangCap(m); });
  }

  // Chữ của mục, các mảnh cách nhau bằng dấu cách: textContent dán liền "1K" + "Kích thước gốc" thành "1KKích…"
  // và "\b1K\b" không khớp nữa (mục 1K bị bỏ sót).
  function chu(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), ds = [], n;
    while ((n = w.nextNode())) ds.push(n.nodeValue);
    return ds.join(' ').replace(/\s+/g, ' ').trim();
  }
  function laChatLuong(el) { var t = chu(el); return CHAT_LUONG.test(t) || GOC.test(t); }

  function lamSach(el) {
    var c = el.cloneNode(true);
    var tat = c.querySelectorAll('svg, script, style, img');
    for (var i = 0; i < tat.length; i++) tat[i].remove();
    var s = c.outerHTML.replace(/\s(_ngcontent|_nghost)[^=\s>]*(="[^"]*")?/g, '');
    return s.length > 20000 ? s.slice(0, 20000) : s;
  }

  function nhan(el) {
    var t = chu(el);
    var m = t.match(CHAT_LUONG);
    return m ? m[0].replace(/\s+/g, '').toUpperCase() : t.slice(0, 20);
  }

  function bao(chu) {
    try {
      if (window.__flowBridge && window.__flowBridge.send) window.__flowBridge.send({ action: 'LOG', type: 'warning', message: chu });
    } catch (_) {}
  }

  var daBao = '';
  function anKhoa() {
    var dem = 0;
    var menu = document.querySelectorAll('.cdk-overlay-pane, [role="menu"], .mat-mdc-menu-panel, [data-radix-menu-content]');
    for (var i = 0; i < menu.length; i++) {
      var ds = Array.prototype.filter.call(menu[i].querySelectorAll(MUC), laChatLuong);
      if (!ds.length) {
        // Menu không có mục nào trông như chất lượng (Flow đổi chữ?) — vẫn giữ lại cho tệp chẩn đoán.
        if (menu[i].matches('.cdk-overlay-pane') && menu[i].querySelector(MUC)) {
          try { window.__flowTaiVe.menuMo = lamSach(menu[i]); } catch (_) {}
        }
        continue;
      }
      var khoa = ds.map(function (el) { return biKhoa(el, ds); });
      var conMo = khoa.filter(function (k) { return !k; }).length;
      var an = [], con = [];
      for (var j = 0; j < ds.length; j++) {
        var el = ds[j];
        // Không ẩn HẾT: còn ít nhất một mục mở thì mới ẩn các mục khoá (mờ hết = Flow đang nạp, chờ nó sáng).
        var canAn = khoa[j] && conMo > 0;
        if (canAn) {
          an.push(nhan(el));
          if (!el.hasAttribute('data-flow-khoa')) {
            el.setAttribute('data-flow-khoa', '1');
            el.style.setProperty('visibility', 'hidden', 'important');
            dem++;
          }
        } else {
          con.push(nhan(el));
          if (el.hasAttribute('data-flow-khoa')) {   // hết khoá (Flow nạp xong) → hiện lại
            el.removeAttribute('data-flow-khoa');
            el.style.removeProperty('visibility');
          }
        }
      }
      try { window.__flowTaiVe.menuCuoi = lamSach(menu[i]); } catch (_) {}
      var khoaBao = an.join(',') + '|' + con.join(',');
      if (an.length && khoaBao !== daBao) {
        daBao = khoaBao;
        bao('🔒 Menu Tải xuống: bỏ qua mục bị khoá (cần nâng cấp) ' + an.join(', ') + ' — chọn trong: ' + con.join(', '));
      }
    }
    return dem;
  }

  // ── 1.3.7: Flow không tăng được độ phân giải ───────────────────────────────────────────────────────────────
  var BAO_TANG_HONG = /(không|chưa)\s+(thể\s+)?tăng (được )?độ phân giải|không (có )?đủ tín dụng|(couldn.?t|could not|failed to|unable to) upscale|upscal\w* failed|not enough (ai )?credits|insufficient credits/i;
  var TANG_HONG_MS = 30 * 60000;          // tab thôi bấm mục đã tăng trong chừng này
  var theCuoi = null;                     // thẻ engine vừa chuột phải (để mở lại menu của đúng thẻ)
  var bamTang = null;                     // { luc, nhan, xuLy } — lần engine bấm mục ĐÃ TĂNG gần nhất
  var tangHongDen = 0;
  // Mục "đã tăng độ phân giải" (2K / 4K / 1080p): chất lượng nhưng không phải Kích thước gốc / 270p / 720p / 1K.
  function laTang(el) {
    var t = chu(el);
    if (GOC.test(t)) return false;
    return /\b(1080|1440|2160)\s*p\b|\b[24]\s*k\b/i.test(t) || /tăng độ phân giải|upscaled/i.test(t);
  }
  function mucGoc(menu) {
    if (!menu) return null;
    var ds = Array.prototype.filter.call(menu.querySelectorAll(MUC), laChatLuong);
    for (var i = 0; i < ds.length; i++) if (GOC.test(chu(ds[i])) && !ds[i].hasAttribute('data-flow-khoa')) return ds[i];
    return null;
  }
  function hien(el) {
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  }
  var doi = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function dongMenu() {
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true })); } catch (_) {}
  }
  // Thông báo lỗi tăng độ phân giải đang hiện (snackbar của Flow) — trả chữ của nó.
  function thongBaoTangHong() {
    var ds = document.querySelectorAll('flow-snackbar, mat-snack-bar-container, .mat-mdc-snack-bar-container, [role="alert"], [aria-live]');
    for (var i = 0; i < ds.length; i++) {
      var t = (ds[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t && BAO_TANG_HONG.test(t) && hien(ds[i])) return t.replace(/^(error|warning)\s*/i, '').replace(/\s*(Đóng|Close)\s*$/i, '').slice(0, 160);
    }
    return '';
  }
  // Mở lại menu Tải xuống của thẻ engine vừa tải (như engine: rê chuột → chuột phải → mục Tải xuống → phím mũi tên)
  // rồi bấm "Kích thước gốc". Engine vẫn đang chờ file mang đúng tên đã đăng ký nên file về là khớp tên.
  async function taiLaiGoc(lyDo) {
    var the = theCuoi;
    if (!the || !the.isConnected) { bao('⚠ Flow không tăng được độ phân giải (' + lyDo + ') — không tìm lại được thẻ để tải Kích thước gốc; engine sẽ tự thử lại.'); return false; }
    dongMenu();
    await doi(600);
    try { the.scrollIntoView({ block: 'center' }); } catch (_) {}
    await doi(800);
    var r = the.getBoundingClientRect();
    var o = { view: window, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    try { the.dispatchEvent(new PointerEvent('pointerover', Object.assign({ pointerType: 'mouse' }, o))); } catch (_) {}
    the.dispatchEvent(new MouseEvent('mouseover', o));
    the.dispatchEvent(new MouseEvent('mouseenter', o));
    await doi(500);
    the.dispatchEvent(new MouseEvent('contextmenu', Object.assign({ button: 2, buttons: 2 }, o)));
    await doi(1500);
    var tai = null, muc = document.querySelectorAll(MUC);
    for (var i = 0; i < muc.length && !tai; i++) {
      if (!hien(muc[i])) continue;
      var ic = muc[i].querySelector('i.google-symbols, .google-symbols, .material-icons, mat-icon, i');
      var icChu = ic ? ic.textContent.trim().toLowerCase() : '';
      if (icChu === 'download' || icChu === 'file_download' || /tải xuống|download/i.test(muc[i].textContent || '')) tai = muc[i];
    }
    if (!tai) { dongMenu(); bao('⚠ Flow không tăng được độ phân giải — mở lại menu thẻ nhưng không thấy mục Tải xuống; engine sẽ tự thử lại.'); return false; }
    try { tai.focus(); } catch (_) {}
    var kb = { view: window, bubbles: true, cancelable: true };
    tai.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, kb)));
    tai.dispatchEvent(new KeyboardEvent('keyup', Object.assign({ key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, kb)));
    tai.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13 }, kb)));
    tai.dispatchEvent(new KeyboardEvent('keyup', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13 }, kb)));
    // Mục còn mờ một lúc (Flow chuẩn bị file) — chờ "Kích thước gốc" sáng, tối đa 15 s.
    for (var k = 0; k < 30; k++) {
      await doi(500);
      var ds = document.querySelectorAll(MUC), goc = null;
      for (var j = 0; j < ds.length; j++) if (hien(ds[j]) && GOC.test(chu(ds[j])) && laChatLuong(ds[j])) { goc = ds[j]; break; }
      if (goc && mo(goc)) {
        bao('🔁 Flow không tăng được độ phân giải ("' + lyDo + '" — thường do hết tín dụng AI) — tải ' + nhan(goc) + ' (Kích thước gốc) thay. Tab này tải Kích thước gốc trong 30 phút tới.');
        goc.click();
        return true;
      }
    }
    dongMenu();
    bao('⚠ Flow không tăng được độ phân giải — không bấm được mục Kích thước gốc; engine sẽ tự thử lại.');
    return false;
  }
  function xetTangHong() {
    if (!bamTang || bamTang.xuLy || Date.now() - bamTang.luc > 90000) return;
    var t = thongBaoTangHong();
    if (!t) return;
    bamTang.xuLy = true;
    tangHongDen = Date.now() + TANG_HONG_MS;
    taiLaiGoc(t).catch(function () {});
  }

  window.__flowTaiVe = { anKhoa: anKhoa, menuCuoi: '', menuMo: '',
    tangHong: function () { return tangHongDen > Date.now(); }, thongBaoTangHong: thongBaoTangHong };
  // Thẻ engine vừa chuột phải (engine bắn sự kiện giả, không phải người dùng).
  try {
    window.addEventListener('contextmenu', function (e) {
      if (e.isTrusted || !e.target || !e.target.closest) return;
      if (e.target.closest('.cdk-overlay-container, [role="menu"]')) return;
      theCuoi = e.target;
    }, true);
  } catch (_) {}

  // LƯỚI AN TOÀN (1.2.7): engine lấy danh sách mục chất lượng ~2 s sau khi mở menu, rồi NGHỈ vài giây
  // ("Nghỉ … trước khi chọn chất lượng tải về") mới bấm. Mục còn mờ lúc engine lấy danh sách thì chưa bị ẩn,
  // tới lúc bấm mới biết là mục khoá → bấm không ra gì. Nên: engine (click giả, không phải người dùng) bấm
  // vào mục đang khoá thì chặn lại và bấm mục MỞ có độ phân giải cao nhất trong cùng menu (720p, ảnh: 1K).
  function doPhanGiai(el) {
    var m = chu(el).match(/\b(\d{3,4})\s*p\b|\b([124])\s*k\b/i);
    if (!m) return GOC.test(chu(el)) ? 1 : 0;
    return m[1] ? +m[1] : +m[2] * 1000;
  }
  function mucThay(el) {
    var menu = el.closest('[role="menu"], .mat-mdc-menu-panel, [data-radix-menu-content], .cdk-overlay-pane');
    if (!menu) return null;
    var tot = null, ds = Array.prototype.filter.call(menu.querySelectorAll(MUC), laChatLuong);
    ds.forEach(function (m) {
      if (m === el || m.hasAttribute('data-flow-khoa') || biKhoa(m, ds)) return;
      if (!tot || doPhanGiai(m) > doPhanGiai(tot)) tot = m;
    });
    return tot;
  }
  try {
    window.addEventListener('click', function (e) {
      if (e.isTrusted) return;                                   // người dùng tự bấm: để yên
      var el = e.target && e.target.closest && e.target.closest(MUC);
      if (!el || !laChatLuong(el)) return;
      try { anKhoa(); } catch (_) {}
      if (!el.hasAttribute('data-flow-khoa')) {
        if (!laTang(el)) return;
        // 1.3.7: vừa bị Flow báo không tăng được độ phân giải → bấm Kích thước gốc thay luôn.
        var goc = tangHongDen > Date.now() ? mucGoc(el.closest('[role="menu"], .mat-mdc-menu-panel, [data-radix-menu-content], .cdk-overlay-pane')) : null;
        if (goc && goc !== el) {
          e.preventDefault(); e.stopImmediatePropagation();
          bao('🔁 Flow vừa báo không tăng được độ phân giải ở tab này — tải ' + nhan(goc) + ' (Kích thước gốc) thay ' + nhan(el) + '.');
          goc.click();
          return;
        }
        bamTang = { luc: Date.now(), nhan: nhan(el), xuLy: false };
        [3000, 8000, 20000].forEach(function (ms) { setTimeout(function () { try { xetTangHong(); } catch (_) {} }, ms); });
        return;
      }
      var thay = mucThay(el);
      if (!thay) return;
      e.preventDefault(); e.stopImmediatePropagation();
      bao('🔒 Mục ' + nhan(el) + ' bị khoá (cần nâng cấp) — tải ' + nhan(thay) + ' thay.');
      thay.click();
    }, true);
  } catch (_) {}

  // Chạy NGAY khi menu đổi (không trễ): engine đọc menu chất lượng ~2 giây sau khi mở, mục phải ẩn trước đó.
  // Gom mọi thay đổi trong cùng một nhịp thành một lần quét (vi tác vụ — tab chạy ngầm không bị hãm như setTimeout).
  var cho = false;
  try {
    new MutationObserver(function () {
      if (cho) return;
      cho = true;
      Promise.resolve().then(function () { cho = false; try { anKhoa(); } catch (_) {} try { xetTangHong(); } catch (_) {} });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['aria-disabled', 'disabled', 'class'] });
  } catch (_) {}
  try { anKhoa(); } catch (_) {}
})();
