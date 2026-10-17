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

  window.__flowTaiVe = { anKhoa: anKhoa, menuCuoi: '', menuMo: '' };

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
      if (!el.hasAttribute('data-flow-khoa')) return;
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
      Promise.resolve().then(function () { cho = false; try { anKhoa(); } catch (_) {} });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['aria-disabled', 'disabled', 'class'] });
  } catch (_) {}
  try { anKhoa(); } catch (_) {}
})();
