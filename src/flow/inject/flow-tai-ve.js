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
//  Phơi ra window.__flowTaiVe:
//    anKhoa()   → số mục vừa ẩn (bình thường tự chạy khi trang đổi)
//    menuCuoi   → HTML (đã làm sạch) của menu chất lượng gần nhất — đưa vào tệp chẩn đoán khi tải hỏng.
// ============================================================================

(function () {
  'use strict';
  if (window.__flowTaiVe) return;

  var MUC = '[role="menuitem"], [role="menuitemradio"], button.mat-mdc-menu-item';
  var CHAT_LUONG = /\b\d{3,4}\s*p\b|\b[124]\s*k\b/i;
  var KHOA_CHU = /nâng cấp|upgrade|nâng hạng|mở khoá|unlock/i;

  function biKhoa(el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')) return true;
    if (/(^|[\s-])disabled\b/i.test(String(el.className || ''))) return true;
    if (KHOA_CHU.test(el.textContent || '')) return true;
    // Nút "Nâng cấp" có thể nằm cạnh mục (cùng một dòng bọc) chứ không ở trong mục.
    var dong = el.parentElement;
    if (dong && !dong.matches('[role="menu"], .mat-mdc-menu-content, .cdk-overlay-pane') &&
        dong.querySelectorAll(MUC).length === 1 && KHOA_CHU.test(dong.textContent || '')) return true;
    return false;
  }

  function lamSach(el) {
    var c = el.cloneNode(true);
    var tat = c.querySelectorAll('svg, script, style, img');
    for (var i = 0; i < tat.length; i++) tat[i].remove();
    var s = c.outerHTML.replace(/\s(_ngcontent|_nghost)[^=\s>]*(="[^"]*")?/g, '');
    return s.length > 20000 ? s.slice(0, 20000) : s;
  }

  function anKhoa() {
    var dem = 0;
    var menu = document.querySelectorAll('.cdk-overlay-pane, [role="menu"], .mat-mdc-menu-panel, [data-radix-menu-content]');
    for (var i = 0; i < menu.length; i++) {
      var ds = menu[i].querySelectorAll(MUC), coChatLuong = false;
      for (var j = 0; j < ds.length; j++) {
        var el = ds[j];
        if (!CHAT_LUONG.test(el.textContent || '')) continue;
        coChatLuong = true;
        if (el.hasAttribute('data-flow-khoa') || !biKhoa(el)) continue;
        el.setAttribute('data-flow-khoa', '1');
        el.style.setProperty('visibility', 'hidden', 'important');
        dem++;
      }
      if (coChatLuong) {
        try { window.__flowTaiVe.menuCuoi = lamSach(menu[i]); } catch (_) {}
      }
    }
    return dem;
  }

  window.__flowTaiVe = { anKhoa: anKhoa, menuCuoi: '' };

  // Chạy NGAY khi menu đổi (không trễ): engine đọc menu chất lượng ~2 giây sau khi mở, mục phải ẩn trước đó.
  // Gom mọi thay đổi trong cùng một nhịp thành một lần quét (vi tác vụ — tab chạy ngầm không bị hãm như setTimeout).
  var cho = false;
  try {
    new MutationObserver(function () {
      if (cho) return;
      cho = true;
      Promise.resolve().then(function () { cho = false; try { anKhoa(); } catch (_) {} });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  try { anKhoa(); } catch (_) {}
})();
