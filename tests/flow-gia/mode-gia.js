// Trình đổi chế độ giả: ghi lại chế độ app yêu cầu (tests/flow-e2e.js kiểm).
window.__flowSetMode = async function (mode) {
  fetch('/__flow-ghi', { method: 'POST', body: JSON.stringify({ loai: 'mode', d: { mode }, url: location.href }) }).catch(() => {});
  return { ok: true, daDoi: window.__cheDoGia !== mode, mode: (window.__cheDoGia = mode) };
};
window.__flowGetMode = async () => ({ ok: true, mode: window.__cheDoGia || 'image' });
undefined;
