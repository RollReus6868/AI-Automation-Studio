// ============================================================================
//  flow-loc-the.js — CHỈ TẢI ĐÚNG THẺ VỪA TẠO, KHÔNG TẢI LẠI VIDEO CŨ CÙNG PROMPT (1.3.3)
//  --------------------------------------------------------------------------
//  TRIỆU CHỨNG (nhật ký người dùng 18/10/2026 11:24): mỗi video Flow lâu dần — #355 tải 3 file, #356 tải 4,
//  … #362 trở đi tải 11 file cho MỘT prompt, mỗi việc ~4,5 phút (tạo chỉ ~1 phút, còn lại là tải).
//  Video nối từ ảnh dùng CHUNG một prompt, mỗi mẻ 1 prompt nên luôn mang số "1. " → engine lọc thẻ bằng ô
//  Tìm kiếm của Flow với "1. <80 ký tự đầu prompt>" (buildSearchFilterText) và bốc MỌI thẻ đang hiện
//  (isolateTilesViaSearch) — tức là cả video của các việc trước trong cùng dự án Flow. Engine tải hết từng cái
//  (mỗi cái ~12 s) rồi app mới bỏ file thừa (luong-flow _locFileThua, 1.2.10).
//
//  Không sửa engine (quy ước dự án). File này chạy trong MAIN WORLD:
//    • lúc bình thường (ô Tìm kiếm trống): ghi nhớ "dấu" của các thẻ nằm trong lưới engine vừa đóng dấu
//      data-fe-grid-id="pid_<giờ>_<số prompt>" (lưới của lần tạo này) — mã thẻ, mã media, link /edit/, đường dẫn
//      video / ảnh; dấu của thẻ NGOÀI các lưới đó là dấu cũ, không dùng để nhận;
//    • khi ô Tìm kiếm có chữ (engine đang lọc để tải): thẻ nào có dấu của lần tạo này thì giữ, các thẻ còn lại
//      ẩn đi (display:none — engine chỉ bốc thẻ đang hiện). Chữ tìm "N. …" thì chỉ giữ thẻ của prompt số N.
//    • KHÔNG nhận ra thẻ nào → không ẩn gì (như cũ, app vẫn bỏ file thừa sau khi tải);
//    • ô Tìm kiếm trống lại → hiện lại mọi thẻ đã ẩn.
//  Ghi nhật ký mỗi lần lọc: bốc mấy thẻ, ẩn mấy thẻ cũ.
//
//  Phơi ra window.__flowLocThe: { xet() → { giu, an } | null, dau(prompt số) → số dấu đã nhớ }
// ============================================================================

(function () {
  'use strict';
  if (window.__flowLocThe) return;

  var AN = 'data-ai-loc-an';
  var dauMoi = {};          // số prompt → { dấu: true } của thẻ trong lưới đã đóng dấu
  var dauCu = {};           // dấu của thẻ ngoài các lưới đóng dấu (video cũ, ảnh đại diện…)
  var chuDaBao = '';

  function hien(el) { return !!(el && (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0)); }

  // Thẻ ngoài cùng — giống getOuterTilesNative của engine (để ẩn đúng phần tử engine bốc).
  function theNgoai(goc, chiHien) {
    goc = goc || document;
    var ds = Array.prototype.slice.call(goc.querySelectorAll('flow-tile-container'));
    if (!ds.length) ds = Array.prototype.slice.call(goc.querySelectorAll('flow-image-tile, flow-video-tile'));
    if (!ds.length) {
      ds = Array.prototype.slice.call(goc.querySelectorAll('[data-tile-id]')).filter(function (el) {
        return !(el.parentElement && el.parentElement.closest('[data-tile-id]'));
      });
    }
    return chiHien ? ds.filter(function (el) { return hien(el) || el.hasAttribute(AN); }) : ds;
  }

  // Đường dẫn media bỏ phần chữ ký / hạn dùng (đổi mỗi lần Flow vẽ lại) nhưng giữ tham số mang mã (name=, id=…).
  function duongMedia(s) {
    if (!s || /^(data|blob):/i.test(s)) return '';
    try {
      var u = new URL(s, location.href), giu = [];
      u.searchParams.forEach(function (v, k) {
        if (!/^(x-goog-|signature$|expires$|googleaccessid$|key-pair-id$|policy$|token$|ttl$|sz$|w$|h$)/i.test(k)) giu.push(k + '=' + v);
      });
      return u.origin + u.pathname + (giu.length ? '?' + giu.sort().join('&') : '');
    } catch (e) { return String(s).split('?')[0]; }
  }

  function dauCua(t) {
    var k = [];
    function them(s) { if (s && k.indexOf(s) < 0) k.push(s); }
    [t].concat(Array.prototype.slice.call(t.querySelectorAll('[data-tile-id], [data-media-id]'))).forEach(function (el) {
      var a = el.getAttribute('data-tile-id'), b = el.getAttribute('data-media-id');
      if (a) them('t:' + a);
      if (b) them('t:' + b);
    });
    Array.prototype.slice.call(t.querySelectorAll('a[href]')).concat(t.matches('a[href]') ? [t] : []).forEach(function (a) {
      var m = (a.getAttribute('href') || '').match(/\/edit\/(?:workflow\/)?([a-z0-9\-]{36})/i);
      if (m) them('e:' + m[1].toLowerCase());
    });
    t.querySelectorAll('video, video source, img').forEach(function (el) {
      var d = duongMedia(el.getAttribute('src') || el.currentSrc || '');
      if (d) them('m:' + d);
      var p = duongMedia(el.getAttribute('poster') || '');
      if (p) them('m:' + p);
    });
    return k;
  }

  // Ô Tìm kiếm của Flow (cùng cách nhận với findFlowSearchBoxNative, không dùng đường dự phòng "ô cuối cùng"
  // — trừ khi ô đó đang mang đúng kiểu chữ engine gõ "N. …").
  function oTimKiem() {
    var ds = Array.prototype.slice.call(document.querySelectorAll('input[type="text"], input[type="search"]')).filter(function (i) { return i.offsetParent; });
    for (var i = 0; i < ds.length; i++) {
      var o = ds[i], p = (o.placeholder || '').toLowerCase(), a = (o.getAttribute('aria-label') || '').toLowerCase();
      if (/search|tìm kiếm/.test(p) || /search|tìm kiếm/.test(a)) return o;
      var boc = o.closest('form') || o.parentElement;
      if (boc && Array.prototype.some.call(boc.querySelectorAll('i, .google-symbols'), function (ic) {
        var c = (ic.textContent || '').trim().toLowerCase(); return c === 'search' || c === 'arrow_back';
      })) return o;
    }
    for (var j = ds.length - 1; j >= 0; j--) if (/^\d+\.\s\S/.test(ds[j].value || '')) return ds[j];
    return null;
  }

  // Ghi nhớ dấu thẻ của các lưới engine đã đóng dấu trên trang này.
  function hoc() {
    var luoi = Array.prototype.slice.call(document.querySelectorAll('[data-fe-grid-id]'));
    var trong = new Set();
    luoi.forEach(function (g) {
      var m = /_(\d+)$/.exec(g.getAttribute('data-fe-grid-id') || '');
      var so = m ? m[1] : '?';
      var bo = dauMoi[so] || (dauMoi[so] = {});
      theNgoai(g, false).forEach(function (t) {
        trong.add(t);
        dauCua(t).forEach(function (d) { bo[d] = true; });
      });
    });
    // Dấu của thẻ ngoài lưới = dấu cũ — trừ dấu đã thuộc lần tạo này (Flow vẽ lại lưới thì mất data-fe-grid-id).
    theNgoai(document, false).forEach(function (t) {
      if (trong.has(t) || t.closest('[data-fe-grid-id]')) return;
      dauCua(t).forEach(function (d) { if (!laMoi(d)) dauCu[d] = true; });
    });
  }

  function laMoi(d) {
    return Object.keys(dauMoi).some(function (s) { return dauMoi[s][d]; });
  }

  function hienLai() {
    document.querySelectorAll('[' + AN + ']').forEach(function (el) {
      el.style.removeProperty('display');
      el.removeAttribute(AN);
    });
  }

  function bao(chu) {
    try { if (window.__flowBridge && window.__flowBridge.send) window.__flowBridge.send({ action: 'LOG', type: 'info', message: chu }); } catch (e) {}
  }

  // tuDoi = gọi từ MutationObserver: trang đổi liên tục (thanh %, …) nên lúc ô Tìm kiếm trống chỉ học theo nhịp 700 ms.
  function xet(tuDoi) {
    var o = oTimKiem(), q = o ? String(o.value || '').trim() : '';
    if (!q) {
      if (document.querySelector('[' + AN + ']')) hienLai();
      chuDaBao = '';
      if (tuDoi !== true) hoc();
      return null;
    }
    var m = /^(\d+)\.\s/.exec(q), bo = {};
    if (m && dauMoi[m[1]]) bo = dauMoi[m[1]];
    else if (!m) Object.keys(dauMoi).forEach(function (s) { Object.keys(dauMoi[s]).forEach(function (d) { bo[d] = true; }); });
    var nhan = Object.keys(bo).filter(function (d) { return !dauCu[d]; });
    if (!nhan.length) return null;
    var dat = {};
    nhan.forEach(function (d) { dat[d] = true; });
    var ds = theNgoai(document, true);
    var giu = ds.filter(function (t) { return dauCua(t).some(function (d) { return dat[d]; }); });
    if (!giu.length || giu.length === ds.length) return { giu: giu.length, an: 0 };
    var an = 0;
    ds.forEach(function (t) {
      if (giu.indexOf(t) >= 0) {
        if (t.hasAttribute(AN)) { t.style.removeProperty('display'); t.removeAttribute(AN); }
        return;
      }
      if (!t.hasAttribute(AN)) { t.setAttribute(AN, '1'); t.style.setProperty('display', 'none', 'important'); }
      an++;
    });
    if (chuDaBao !== q + '|' + an) {
      chuDaBao = q + '|' + an;
      bao('🎯 Ô Tìm kiếm của Flow bắt ' + ds.length + ' thẻ cùng prompt — chỉ để lại ' + giu.length +
        ' thẻ của lần tạo này, ẩn ' + an + ' thẻ cũ để không tải lại video / ảnh đã có.');
    }
    return { giu: giu.length, an: an };
  }

  var cho = false;
  function henXet() {
    if (cho) return;
    cho = true;
    Promise.resolve().then(function () { cho = false; try { xet(true); } catch (e) {} });
  }
  try { new MutationObserver(henXet).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  document.addEventListener('input', henXet, true);
  document.addEventListener('keyup', henXet, true);
  setInterval(function () { try { xet(); } catch (e) {} }, 700);

  window.__flowLocThe = {
    xet: function () { return xet(); },
    dau: function (so) { return Object.keys(dauMoi[String(so)] || {}).length; }
  };
})();
