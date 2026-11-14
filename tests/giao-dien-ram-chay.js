'use strict';
// Kịch bản chạy BÊN TRONG app (MUSE_TEST) cho tests/giao-dien-ram.js — xem giải thích ở file đó.
module.exports = async ({ win, app, dieuPhoi, docRam, baoRam, nhatKy, taiKhoan }) => {
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
    if (process.env.GD_RONG) win.setSize(Number(process.env.GD_RONG), 680);   // 1.4.14: giả khung hẹp như máy CI Windows (1100 px)
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

    // 1.4.11: lọc theo TÀI KHOẢN đã tạo ("tìm các video được tạo từ tài khoản Muse 3").
    const tk3 = taiKhoan.them('Muse 3', 'muse');
    for (const x of dieuPhoi.viec) { if (x.trangThai === 'xong' && x.id % 4 === 0) x.taiKhoan = tk3.id; else if (x.trangThai === 'cho') x.taiKhoan = ''; }
    const soTk = (id) => dieuPhoi.viec.filter((x) => x.taiKhoan === id).length;
    dieuPhoi.luu();
    const nhanTk = `Muse 3 · ${soTk(tk3.id)}`;
    const coTk = await choDen(() => js(`[...document.querySelectorAll('#locTk option')].some((o) => o.textContent === ${JSON.stringify(nhanTk)})`), 10000);
    const opt = JSON.parse(await js(`JSON.stringify([...document.querySelectorAll('#locTk option')].map((o) => o.textContent))`));
    ok('hộp lọc tài khoản liệt kê tài khoản có việc + số việc (Muse 1, Muse 3, Chưa chạy)', coTk &&
      opt.join('|') === `Mọi tài khoản · 300|Muse 1 · ${soTk('tk-1')}|${nhanTk}|Chưa chạy · ${soTk('')}`, opt.join(' | '));
    const chonTk = (v) => js(`(() => { const s = document.querySelector('#locTk'); s.value = ${JSON.stringify(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
    const dsDong = () => js(`JSON.stringify([...document.querySelectorAll('#dsHang .dong-viec')].map((d) => +d.dataset.id))`).then(JSON.parse);
    await chonTk(tk3.id);
    await choDen(async () => (await dsDong()).length === soTk(tk3.id), 5000);
    const loc3 = await dsDong();
    const tab3 = await js(`[...document.querySelectorAll('#tabsLoc button')].map((b) => b.textContent.trim()).join('|')`);
    ok('chọn Muse 3 → chỉ hiện video Muse 3 tạo, tab trạng thái đếm theo tài khoản', loc3.length === 50 &&
      loc3.every((id) => dieuPhoi.viec.find((x) => x.id === id).taiKhoan === tk3.id) && tab3 === 'Tất cả 50|Hoàn tất 50' &&
      await js(`document.querySelector('#locTk').classList.contains('dang-loc')`), `${loc3.length} dòng · ${tab3}`);
    await js(`document.querySelector('#chonHet').click(); 1`);
    const chon = await js(`document.querySelector('#soChon').textContent`);
    ok('"Chọn hết" khi đang lọc → chọn đúng các việc của tài khoản đó', chon === '50 đã chọn', chon);
    await js(`document.querySelector('#chonHet').click(); 1`);
    await chonTk('_');
    await choDen(async () => (await dsDong()).length === soTk(''), 5000);
    const chua = await dsDong();
    ok('chọn "Chưa chạy" → chỉ việc chưa chạy ở tài khoản nào', chua.length === 99 && chua.every((id) => dieuPhoi.viec.find((x) => x.id === id).trangThai === 'cho'), `${chua.length} dòng`);
    await chonTk('');
    await choDen(async () => (await dsDong()).length === 300, 5000);
    ok('chọn "Mọi tài khoản" → hiện lại đủ 300 dòng', (await dsDong()).length === 300 && !(await js(`document.querySelector('#locTk').classList.contains('dang-loc')`)));

    // 1.4.14: chọn theo số ("1, 3, 10-12") → đúng các việc mang số đó; số không có trong danh sách được báo.
    const caoTruoc = Number(await js(`Math.round(document.querySelector('#dsHang .dong-viec').getBoundingClientRect().height)`));
    await js(`document.querySelector('#nutChonSo').click(); 1`);
    await choDen(() => js(`!document.querySelector('#phu').hidden && !!document.querySelector('#hopNoiDung input[name="so"]')`), 5000);
    await js(`document.querySelector('#hopNoiDung input[name="so"]').value = '1, 3, 10-12, 999'; document.querySelector('#hopOk').click(); 1`);
    await choDen(() => js(`!document.querySelector('#thanhChon').hidden`), 5000);
    const cs = JSON.parse(await js(`JSON.stringify({ chu: document.querySelector('#soChon').textContent,
      so: [...document.querySelectorAll('#dsHang .dong-viec')].filter((d) => d.querySelector('[data-chon]').checked).map((d) => +d.dataset.id).sort((a, b) => a - b),
      toast: (document.querySelector('.toast') || {}).textContent || '', cao: Math.round(document.querySelector('#dsHang .dong-viec').getBoundingClientRect().height),
      nut: (() => { const a = document.querySelector('#nutChonSo').getBoundingClientRect(), b = document.querySelector('#oTim').getBoundingClientRect(); return Math.abs((a.top + a.bottom) - (b.top + b.bottom)) < 16; })() })`));
    ok('"Chọn số" 1, 3, 10-12 → chọn đúng 5 việc, báo số 999 không có', cs.chu === '5 đã chọn' && cs.so.join(',') === '1,3,10,11,12' && /999/.test(cs.toast), JSON.stringify(cs));
    ok('nút "Chọn số" nằm cạnh ô tìm (không thêm hàng), dòng việc không cao thêm (≤ 78 px)', cs.nut && cs.cao === caoTruoc && cs.cao <= 78, JSON.stringify({ nut: cs.nut, cao: cs.cao, caoTruoc }));
    if (process.env.GD_ANH2) { await wait(300); require('fs').writeFileSync(process.env.GD_ANH2, (await win.webContents.capturePage()).toPNG()); }
    await js(`document.querySelector('#chonBo').click(); 1`);

    // 1.4.14: hẹn giờ — nhiều hẹn mỗi chức năng, mỗi hẹn tick nhiều dự án.
    win.webContents.on('console-message', (_e, _l, m) => { if (process.env.GD_LOG) console.log('  [ui]', m); });
    const dB = dieuPhoi.taoDuAn('Dự án B'), dC = dieuPhoi.taoDuAn('Dự án C');
    await wait(1500);   // giao diện nhận 2 dự án mới (trạng thái gom ≥ 250 ms)
    await js(`window.__diToi('hengio'); undefined`);
    await choDen(() => js(`!!document.querySelector('#trang-hengio .the-hen[data-loai="anh"] [data-hen="them"]')`), 5000);
    const theAnh = `#trang-hengio .the-hen[data-loai="anh"]`;
    const datHen = (gio, ds) => js(`(() => { const el = [...document.querySelectorAll('${theAnh} .hen')].pop();
      el.querySelector('[data-hen="batDau"]').value = '${gio}';
      for (const id of ${JSON.stringify(ds)}) { const x = el.querySelector('[data-da="' + id + '"]'); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); }
      el.querySelector('[data-hen="luu"]').click(); return 1; })()`);
    await js(`document.querySelector('${theAnh} [data-hen="them"]').click(); 1`);
    await datHen('23:00', [dB.id, dC.id]);
    await choDen(async () => dieuPhoi.henGio.some((h) => h.loai === 'anh' && h.batDau === '23:00'), 5000);
    await js(`document.querySelector('${theAnh} [data-hen="them"]').click(); 1`);
    await datHen('02:00', ['da-ram']);
    await choDen(async () => dieuPhoi.henGio.filter((h) => h.loai === 'anh').length === 2, 5000);
    const hAnh = dieuPhoi.henGio.filter((h) => h.loai === 'anh').map((h) => `${h.batDau}:${h.bat ? 'bật' : 'tắt'}:${h.duAnDs.join('+')}`);
    ok('thêm 2 hẹn Tạo ảnh: 23:00 cho dự án B + C, 02:00 cho dự án RAM — lưu đúng', hAnh.join(' | ') === `23:00:bật:${dB.id}+${dC.id} | 02:00:bật:da-ram`, hAnh.join(' | '));
    await choDen(() => js(`/2 hẹn · 2 đang bật/.test(document.querySelector('${theAnh} [data-hen="tong"]').textContent)`), 5000);
    await choDen(() => js(`!document.querySelector('#chipHen').hidden`), 4000);
    const ui = JSON.parse(await js(`JSON.stringify({ n: document.querySelectorAll('${theAnh} .hen').length, tong: document.querySelector('${theAnh} [data-hen="tong"]').textContent,
      tick: [...document.querySelectorAll('${theAnh} .hen')].map((el) => [...el.querySelectorAll('[data-da]')].filter((x) => x.checked).map((x) => x.dataset.da).join('+')),
      ghi: document.querySelector('${theAnh} .hen [data-hen="ghi"]').textContent, chip: document.querySelector('#chipHen').hidden ? '' : document.querySelector('#chipHen').textContent })`));
    ok('trang Hẹn giờ hiện 2 hẹn, đúng dự án đã tick, chip hẹn giờ trên thanh trên', ui.n === 2 && ui.tick.join('|') === `${dB.id}+${dC.id}|da-ram` && /2 dự án đã chọn/.test(ui.ghi) && /Ảnh/i.test(ui.chip), JSON.stringify(ui));
    if (process.env.GD_ANH) { await wait(400); require('fs').writeFileSync(process.env.GD_ANH, (await win.webContents.capturePage()).toPNG()); }
    // Xoá hẹn 02:00 (hộp xác nhận → Xoá).
    await js(`[...document.querySelectorAll('${theAnh} .hen')].pop().querySelector('[data-hen="xoa"]').click(); 1`);
    await choDen(() => js(`!document.querySelector('#phu').hidden`), 5000);
    await js(`document.querySelector('#hopOk').click(); 1`);
    await choDen(async () => dieuPhoi.henGio.filter((h) => h.loai === 'anh').length === 1, 5000);
    await choDen(() => js(`document.querySelectorAll('${theAnh} .hen').length === 1`), 5000);
    ok('xoá một hẹn → còn đúng hẹn 23:00', dieuPhoi.henGio.filter((h) => h.loai === 'anh').map((h) => h.batDau).join() === '23:00' &&
      Number(await js(`document.querySelectorAll('${theAnh} .hen').length`)) === 1);
    // Xoá dự án C → hẹn 23:00 chỉ còn dự án B, vẫn bật.
    dieuPhoi.xoaDuAn(dC.id);
    const h23 = dieuPhoi.henGio.find((h) => h.batDau === '23:00');
    ok('xoá dự án C → hẹn 23:00 còn dự án B, vẫn bật', h23.bat && h23.duAnDs.join() === dB.id, JSON.stringify(h23.duAnDs));
    // 1.4.14: xoá dự án qua menu → hộp xác nhận báo dung lượng sẽ dọn → xoá xong thì dữ liệu tạm của dự án đi theo.
    const fs = require('fs'), path = require('path'), ud = app.getPath('userData');
    const dX = dieuPhoi.taoDuAn('Dự án X');
    const ghiTam = (rel) => { const f = path.join(ud, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.alloc(300000)); return f; };
    const kqX = ghiTam(path.join('ket-qua-tam', dX.id, '001.png')), flowX = path.join(ud, 'flow-tai-tam', `tk-1-${dX.id}-1`);
    ghiTam(path.join('flow-tai-tam', `tk-1-${dX.id}-1`, 'a.mp4'));
    const conLai = ghiTam(path.join('ket-qua-tam', 'da-ram', 'giu.png'));
    await wait(1500);
    await choDen(() => js(`(() => { const m = document.querySelector('#menuDuAn'); if (m.hidden) document.querySelector('#nutDuAn').click();
      const b = m.querySelector('[data-du-an="${dX.id}"]'); if (b) { b.click(); return true; } document.querySelector('#nutDuAn').click(); return false; })()`), 8000);
    await choDen(() => js(`/Dự án X/.test(document.querySelector('#tenDuAn').textContent)`), 5000);
    await js(`document.querySelector('#nutMenuDuAn').click(); document.querySelector('#menuDuAnThem [data-lenh="xoaDuAn"]').click(); 1`);
    await choDen(() => js(`!document.querySelector('#phu').hidden && /dữ liệu tạm/.test(document.querySelector('#hopNoiDung').textContent)`), 5000);
    const hoiXoa = await js(`document.querySelector('#hopNoiDung').textContent`);
    ok('hộp xoá dự án báo dung lượng tạm sẽ dọn + 1 file kết quả chỉ nằm trong bộ nhớ tạm', /585,9 KB|586 KB|0,6 MB/.test(hoiXoa) && /1 file kết quả/.test(hoiXoa), hoiXoa.replace(/\s+/g, ' ').slice(0, 220));
    await js(`document.querySelector('#hopOk').click(); 1`);
    await choDen(async () => !dieuPhoi.duAn.some((d) => d.id === dX.id) && !fs.existsSync(kqX), 8000);
    ok('xoá dự án → dọn ket-qua-tam + thư mục Flow tải dở của dự án, dự án khác giữ nguyên', !fs.existsSync(kqX) && !fs.existsSync(flowX) && fs.existsSync(conLai),
      JSON.stringify({ kq: fs.existsSync(kqX), flow: fs.existsSync(flowX), giu: fs.existsSync(conLai) }));
    ok('nhật ký: "🗑 Đã xoá dự án … dọn … dữ liệu tạm"', nhatKy.some((d) => /🗑 Đã xoá dự án "Dự án X" — dọn .* dữ liệu tạm của dự án/.test(d.chu)));
    await js(`window.__diToi('video'); undefined`);

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
