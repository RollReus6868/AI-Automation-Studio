'use strict';
// ============================================================================
//  preload-muse.js — preload của trang Muse CHẠY NGẦM (luồng), không dùng cho khung đăng nhập.
//  1.4.8: "Máy mượt" bớt CPU ở trang Muse. Trang chạy ngầm ẩn nhưng vẫn vẽ (backgroundThrottling:false) nên mọi
//  hoạt hình chạy bằng requestAnimationFrame cứ vẽ ~60 khung/giây suốt mấy phút chờ Muse tạo ảnh / video, nhân với
//  số luồng. 1.4.4 mới tắt được hoạt hình CSS; ở đây chặn nốt phần JavaScript:
//    • requestAnimationFrame chạy thưa lại còn ~5 khung/giây (chờ 200 ms rồi mới xin khung) — trang vẫn chạy đúng,
//      chỉ hoạt hình chậm / giật (không ai xem trang chạy ngầm);
//    • video / âm thanh vừa phát là dừng ngay (file kết quả vẫn lấy bằng fetch() từ blob như cũ).
//  Cài vào main world TRƯỚC script của trang (webFrame từ preload) để thư viện nào giữ sẵn requestAnimationFrame cũng
//  dùng bản thưa. Bật / tắt theo "Máy mượt": lúc mở trang theo --muse-nhe=1|0, đổi giữa chừng thì main.js đặt
//  window.__museNhe.
// ============================================================================
const { webFrame } = require('electron');

function caiNhe(bat) {
  if (window.__museNhe !== undefined) return;
  window.__museNhe = !!bat;
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  const CHO_MS = 200;
  const ds = new Map();   // mã của mình → { t: setTimeout, r: mã rAF thật }
  let so = 1e9;           // khác dải mã rAF thật (đếm từ 1) để cancel phân biệt được
  window.requestAnimationFrame = function requestAnimationFrame(cb) {
    const k = ++so;
    const e = { t: 0, r: 0 };
    ds.set(k, e);
    const xin = () => { e.t = 0; e.r = raf((ts) => { ds.delete(k); cb(ts); }); };
    if (window.__museNhe) e.t = setTimeout(xin, CHO_MS); else xin();
    return k;
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(k) {
    const e = ds.get(k);
    if (!e) { caf(k); return; }
    ds.delete(k);
    if (e.t) clearTimeout(e.t);
    if (e.r) caf(e.r);
  };
  // Sự kiện play không nổi bọt nhưng vẫn đi qua document ở pha bắt (capture).
  document.addEventListener('play', (ev) => {
    const m = ev.target;
    if (window.__museNhe && m && typeof m.pause === 'function') { try { m.pause(); } catch (_) {} }
  }, true);
}

try {
  webFrame.executeJavaScript(`(${caiNhe.toString()})(${process.argv.includes('--muse-nhe=1')}); undefined`);
} catch (_) {}
