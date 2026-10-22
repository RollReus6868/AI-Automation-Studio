'use strict';
// Kịch bản chạy BÊN TRONG app (MUSE_TEST) cho tests/giao-dien-ram.js — xem giải thích ở file đó.
module.exports = async ({ win, app, dieuPhoi, docRam, baoRam, nhatKy }) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (c) => win.webContents.executeJavaScript(c, true);
  const loi = [];
  const ok = (ten, dk, ct = '') => { console.log(`  ${dk ? '✔' : '✘'} ${ten}${ct ? ` — ${ct}` : ''}`); if (!dk) loi.push(ten); };
  const MB = (kb) => Math.round(kb / 1024);
  const uiMb = () => { const pid = win.webContents.getOSProcessId(); const m = app.getAppMetrics().find((x) => x.pid === pid); return m ? MB(m.memory.workingSetSize) : -1; };
  const choDen = async (dk, ms) => { for (const het = Date.now() + ms; Date.now() < het; await wait(250)) if (await dk()) return true; return false; };

  try {
    console.log('\n══════ 1.3.4 GIAO DIỆN VỚI 200 VIDEO ĐÃ XONG ══════');
    await choDen(() => js('!!window.__diToi'), 20000);
    await js(`window.__diToi('video'); undefined`);
    await choDen(() => js(`document.querySelectorAll('#dsHang .dong-viec').length === 300`), 20000);
    const dem = JSON.parse(await js(`JSON.stringify({ video: document.querySelectorAll('#dsHang video').length, anh: document.querySelectorAll('#dsHang img[data-vthumb]').length, dong: document.querySelectorAll('#dsHang .dong-viec').length })`));
    ok('300 dòng, 200 dòng video dùng ảnh nhỏ, KHÔNG có <video> nào trong danh sách', dem.dong === 300 && dem.anh === 200 && dem.video === 0, JSON.stringify(dem));

    // Cuộn tới dòng video đầu tiên → các video đang hiện được chụp ảnh nhỏ (lần lượt), video ngoài màn hình thì chưa.
    await js(`(() => { const h = document.querySelector('#dsHang'); const a = h.querySelector('img[data-vthumb]'); h.scrollTop += a.getBoundingClientRect().top - h.getBoundingClientRect().top; })()`);
    const coAnh = await choDen(() => js(`[...document.querySelectorAll('#dsHang img[data-vthumb]')].filter((i) => /^data:image\\/jpeg/.test(i.getAttribute('src') || '')).length >= 4`), 60000);
    const da = JSON.parse(await js(`JSON.stringify({ chup: window.__anhVideo.soDaChup(), coSrc: [...document.querySelectorAll('#dsHang img[data-vthumb]')].filter((i) => i.getAttribute('src')).length })`));
    ok('video đang hiện có ảnh nhỏ (JPEG chụp từ video)', coAnh, JSON.stringify(da));
    ok('chỉ chụp video đang hiện / gần màn hình, không chụp cả 200', da.chup > 0 && da.chup < 80, JSON.stringify(da));

    // Đánh dấu mọi dòng, rồi đổi bước của MỘT việc như khi đang chạy → chỉ dòng đó được vẽ lại.
    await js(`document.querySelectorAll('#dsHang .dong-viec').forEach((d) => { d.__cu = 1; }); undefined`);
    const j = dieuPhoi.viec.find((x) => x.trangThai === 'cho');
    j.trangThai = 'chay'; j.batDauLuc = Date.now(); j.buoc = 'gui';
    dieuPhoi.luu();
    await choDen(() => js(`!document.querySelector('#dsHang .dong-viec[data-id="${j.id}"]').__cu`), 5000);
    const sau = JSON.parse(await js(`(() => { const ds = [...document.querySelectorAll('#dsHang .dong-viec')];
      return JSON.stringify({ moi: ds.filter((d) => !d.__cu).map((d) => +d.dataset.id), thuTu: ds.map((d) => +d.dataset.id).join(',') === ds.map((d) => +d.dataset.id).sort((a, b) => b - a).join(','),
        pill: (document.querySelector('#dsHang .dong-viec[data-id="${j.id}"] .pill') || {}).textContent }); })()`));
    ok('việc đổi bước → chỉ dòng của việc đó được vẽ lại, 299 dòng khác giữ nguyên', sau.moi.length === 1 && sau.moi[0] === j.id && sau.pill === 'Đang chạy', JSON.stringify(sau.moi) + ' ' + sau.pill);
    ok('thứ tự dòng vẫn đúng (mới nhất trước)', sau.thuTu);

    // Xoá một việc + thêm lại → dòng biến mất / hiện đúng chỗ.
    const k = dieuPhoi.viec.find((x) => x.id === 150);
    dieuPhoi.viec.splice(dieuPhoi.viec.indexOf(k), 1); dieuPhoi.luu();
    await choDen(() => js(`!document.querySelector('#dsHang .dong-viec[data-id="150"]')`), 5000);
    dieuPhoi.viec.push(k); dieuPhoi.luu();
    await choDen(() => js(`!!document.querySelector('#dsHang .dong-viec[data-id="150"]')`), 5000);
    const vt = JSON.parse(await js(`(() => { const ds = [...document.querySelectorAll('#dsHang .dong-viec')].map((d) => +d.dataset.id); return JSON.stringify({ n: ds.length, truoc: ds[ds.indexOf(150) - 1], sau: ds[ds.indexOf(150) + 1] }); })()`));
    ok('xoá rồi thêm lại một việc → dòng về đúng chỗ giữa #151 và #149', vt.n === 300 && vt.truoc === 151 && vt.sau === 149, JSON.stringify(vt));

    // Trạng thái đổi liên tục 15 giây (như khi 3 luồng đang chạy) → RAM giao diện không phình.
    const ram0 = uiMb();
    for (let t = 0; t < 30; t++) { j.buoc = `buoc ${t}`; dieuPhoi.luu(); await wait(500); }
    const ram1 = uiMb();
    const conAnh = Number(await js(`[...document.querySelectorAll('#dsHang img[data-vthumb]')].filter((i) => i.getAttribute('src')).length`));
    console.log(`  [RAM] giao diện: ${ram0} MB trước → ${ram1} MB sau 15 s trạng thái đổi (bản 1.3.3 với 200 video 720×1280 8 s: 1,8 GB → 3,4 GB)`);
    ok('RAM giao diện dưới 1 GB sau 15 s trạng thái đổi liên tục', ram1 > 0 && ram1 < 1024, `${ram1} MB`);
    ok('ảnh nhỏ đã chụp vẫn còn trên dòng (không bị vẽ lại mất)', conAnh >= da.coSrc, `${conAnh} ≥ ${da.coSrc}`);

    // Thư viện: lưới ô vuông, không <video>, hàng không bị co.
    await js(`window.__diToi('thuvien'); undefined`);
    await choDen(() => js(`document.querySelectorAll('#dsThuVien .o-tv').length === 200`), 10000);
    const tv = JSON.parse(await js(`(() => { const o = [...document.querySelectorAll('#dsThuVien .o-tv')]; const r0 = o[0].getBoundingClientRect();
      const r1 = o.find((x) => x.getBoundingClientRect().top > r0.top + 1).getBoundingClientRect();
      return JSON.stringify({ n: o.length, video: document.querySelectorAll('#dsThuVien video').length, cao: Math.round(r0.height), rong: Math.round(r0.width), hang2: Math.round(r1.top - r0.top) }); })()`));
    ok('Thư viện: 200 ô, không <video>, ô vuông, hàng sau nằm dưới hàng trước (không chồng)', tv.n === 200 && tv.video === 0 && Math.abs(tv.cao - tv.rong) <= 2 && tv.hang2 >= tv.cao, JSON.stringify(tv));
    const coAnhTv = await choDen(() => js(`[...document.querySelectorAll('#dsThuVien img[data-vthumb]')].filter((i) => i.getAttribute('src')).length >= 4`), 60000);
    ok('Thư viện: ô video đang hiện có ảnh nhỏ', coAnhTv);

    // RAM từng phần cho nhật ký.
    const r = docRam();
    ok('docRam(): có tổng và phần "giao diện", "lõi app"', r.tong > 0 && r.phan.some(([t]) => t === 'giao diện') && r.phan.some(([t]) => t === 'lõi app'), r.phan.map(([t, kb]) => `${t} ${MB(kb)} MB`).join(' · '));
    baoRam();
    const dong = nhatKy.filter((d) => /🧠/.test(d.chu)).pop();
    ok('nhật ký ghi một dòng "🧠 RAM app: x,x GB — giao diện …"', !!dong && /^🧠 RAM app: \d+,\d GB — .*giao diện \d+,\d/.test(dong.chu), dong && dong.chu);
    // 1.4.4: CPU từng phần, ngay sau dòng RAM.
    const dongCpu = nhatKy.filter((d) => /⚙ CPU app/.test(d.chu)).pop();
    ok('nhật ký ghi một dòng "⚙ CPU app: x% cả máy — …"', !!dongCpu && /^⚙ CPU app: \d+% cả máy — \S/.test(dongCpu.chu) && Number.isFinite(r.cpu), dongCpu && dongCpu.chu);
  } catch (err) {
    loi.push(err.stack || err.message);
    console.log('  ✘ ' + (err.stack || err.message));
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
};
