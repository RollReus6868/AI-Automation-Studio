// ============================================================================
//  flow-kho-anh.js — NẮN BẢNG KHO ẢNH [+] CỦA FLOW MỚI CHO ENGINE (1.2.2)
//  --------------------------------------------------------------------------
//  TRIỆU CHỨNG (nhật ký + ảnh chụp người dùng 16/10/2026, Flow giao diện mới):
//    "⬆️ Đã đưa 1 ảnh lên Flow …" rồi "#347 Không đưa được ảnh lên kho Flow (371_68b883)" ở MỌI tài khoản.
//  Engine (y hệt Flow Automation Studio 2.8.9) tìm ảnh trong kho bằng bảng [+]: gõ tên vào ô tìm kiếm, rồi
//  lấy các mục kho bằng bộ chọn CỨNG 'button.asset-item, div.asset-item-container, div[data-item-index]',
//  bấm mục khớp tên, bấm "Thêm vào câu lệnh". Ô tìm kiếm thì engine thấy (theo placeholder "Tìm kiếm…"),
//  nhưng mục kho của bảng mới không mang lớp / thuộc tính nào trong ba cái đó → engine luôn báo thiếu ảnh,
//  và bước Character Sync (gắn ảnh @tên vào prompt video) cũng hỏng theo.
//
//  Không sửa engine (quy ước dự án). File này chạy trong MAIN WORLD, canh bảng kho mỗi khi nó hiện ra và
//  ĐÁNH DẤU cho engine thấy, bằng đúng các dấu engine đang tìm:
//    • mục kho (dòng có tên tệp, vd "371_68b883.png") → div[data-item-index] (hoặc button.asset-item);
//    • ô tìm kiếm chưa có thuộc tính type → type="text" (engine dò 'input[type="text"]').
//  Chỉ thêm thuộc tính, không đổi chữ, không bấm gì — Flow vẫn chạy y nguyên.
//
//  Phơi ra window.__flowKhoAnh:
//    danhDau()  → { o, muc }  đánh dấu ngay (bình thường tự chạy khi trang đổi)
//    chup()     → { html }    HTML bảng đang mở + khối ô nhập (bỏ ảnh, script, style) — app lưu ra tệp
//                             chẩn đoán khi tải / gắn ảnh hỏng, để sửa tiếp theo giao diện thật.
// ============================================================================

(function () {
  'use strict';
  if (window.__flowKhoAnh) return;

  var TIM = /(tìm kiếm|search|検索|搜索|검색)/i;
  var TEN_TEP = /^[^\n\/\\]{1,160}\.(png|jpe?g|webp|gif|heic|heif|avif|bmp|tiff?|mp4|mov|webm|m4v|mp3|wav|m4a|ogg)$/i;
  var CO_ANH = 'img, video, canvas, picture, [style*="background-image"]';
  var BAM_DUOC = 'button, [role="option"], [role="button"], [role="listitem"], [role="gridcell"], [role="row"], li, a, [tabindex]';

  function chuRieng(el) {
    // Chữ của CHÍNH phần tử (các nút chữ con trực tiếp), không gồm chữ của phần tử con.
    var s = '';
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) s += n.nodeValue;
    return s.replace(/\s+/g, ' ').trim();
  }

  function oTimKiem() {
    return Array.prototype.filter.call(document.querySelectorAll('input:not([type]), input[type="text"], input[type="search"]'), function (i) {
      return TIM.test(i.getAttribute('placeholder') || '') || TIM.test(i.getAttribute('aria-label') || '');
    }).filter(function (i) { return !i.closest('[role="textbox"], .ProseMirror'); });
  }

  /** Khối bảng chứa ô tìm kiếm: lớp phủ của Angular CDK, hoặc leo lên tới khối có cả danh sách. */
  function bangCua(o) {
    return o.closest('.cdk-overlay-pane, [role="dialog"], .add-menu-popover-container') || (function () {
      var el = o;
      for (var i = 0; i < 8 && el.parentElement && el.parentElement !== document.body; i++) el = el.parentElement;
      return el;
    })();
  }

  function danhDauMuc(bang) {
    var dem = 0;
    var tat = bang.querySelectorAll('*');
    for (var i = 0; i < tat.length; i++) {
      var t = tat[i];
      if (!TEN_TEP.test(chuRieng(t))) continue;
      // Dòng mục kho = tổ tiên GẦN NHẤT có ảnh nhỏ hoặc bấm được (tên + ảnh nhỏ nằm cùng một dòng).
      var dong = t.parentElement, chon = null;
      for (var k = 0; k < 6 && dong && dong !== bang; k++, dong = dong.parentElement) {
        if (dong.matches(BAM_DUOC) || dong.querySelector(CO_ANH)) { chon = dong; break; }
      }
      if (!chon) chon = t.parentElement || t;
      if (chon.tagName === 'BUTTON') {
        if (!chon.classList.contains('asset-item')) chon.classList.add('asset-item');
      } else {
        // Engine chỉ nhận <div>: dòng là thẻ riêng của Flow (vd <flow-asset-item>, <li>) → lấy <div> gần nhất
        // bên trong dòng mà vẫn bọc tên tệp.
        var d = chon.tagName === 'DIV' ? chon : null;
        if (!d) {
          for (var p = t; p && p !== chon; p = p.parentElement) if (p.tagName === 'DIV') d = p;
        }
        if (!d) continue;
        if (!d.hasAttribute('data-item-index')) d.setAttribute('data-item-index', 'kho-' + dem);
      }
      dem++;
    }
    return dem;
  }

  function danhDau() {
    var ds = oTimKiem(), o = 0, muc = 0;
    for (var i = 0; i < ds.length; i++) {
      if (!ds[i].hasAttribute('type')) { ds[i].setAttribute('type', 'text'); o++; }
      muc += danhDauMuc(bangCua(ds[i]));
    }
    return { o: o, muc: muc };
  }

  var hen = null;
  function henDanhDau() {
    if (hen) return;
    hen = setTimeout(function () { hen = null; try { danhDau(); } catch (_) {} }, 60);
  }
  try {
    new MutationObserver(henDanhDau).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch (_) {}

  // ── Chụp chẩn đoán ──────────────────────────────────────────────────────
  function lamSach(el) {
    var c = el.cloneNode(true);
    var bo = c.querySelectorAll('script, style, link, noscript, iframe');
    for (var i = 0; i < bo.length; i++) bo[i].remove();
    var svg = c.querySelectorAll('svg');
    // KHÔNG dùng innerHTML: trang Google bật Trusted Types, gán innerHTML là ném lỗi (nhật ký 16/10: "Script failed to execute").
    for (var j = 0; j < svg.length; j++) while (svg[j].firstChild) svg[j].removeChild(svg[j].firstChild);
    var tat = c.querySelectorAll('*');
    for (var k = 0; k < tat.length; k++) {
      var e = tat[k];
      if (e.hasAttribute('src')) e.setAttribute('src', '');
      if (e.hasAttribute('srcset')) e.removeAttribute('srcset');
      if (e.hasAttribute('style')) e.removeAttribute('style');
      if (e.tagName === 'INPUT' && e.value) e.setAttribute('data-gia-tri', String(e.value).slice(0, 80));
    }
    return c.outerHTML;
  }
  function chup() {
    var phan = [];
    var phu = document.querySelectorAll('.cdk-overlay-container, [role="dialog"], [role="menu"], [role="listbox"]');
    for (var i = 0; i < phu.length; i++) if (!phu[i].parentElement || !phu[i].parentElement.closest('.cdk-overlay-container')) phan.push(lamSach(phu[i]));
    var khung = document.querySelector('flow-prompt-box') ||
      (document.querySelector('[role="textbox"][contenteditable="true"], .ProseMirror') || {}).parentElement;
    if (khung) phan.push(lamSach(khung));
    if (window.__flowTaiVe && window.__flowTaiVe.menuCuoi) phan.push('<!-- menu Tải xuống gần nhất -->\n' + window.__flowTaiVe.menuCuoi);
    if (window.__flowTaiVe && window.__flowTaiVe.menuMo) phan.push('<!-- menu gần nhất không có mục chất lượng -->\n' + window.__flowTaiVe.menuMo);
    var html = phan.join('\n\n<!-- ──────────── -->\n\n');
    // Không để lọt địa chỉ email / tên tài khoản Google (nếu menu tài khoản đang mở) vào tệp gửi đi.
    html = html.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
      .replace(/(Tài khoản Google|Google Account)\s*:[^"<]*/gi, '$1: [ẩn]');
    return { html: html.length > 400000 ? html.slice(0, 400000) : html, luc: new Date().toISOString(), url: location.pathname };
  }

  window.__flowKhoAnh = { danhDau: danhDau, chup: chup };
  try { danhDau(); } catch (_) {}
})();
