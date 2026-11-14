'use strict';
// Kịch bản chạy BÊN TRONG app (MUSE_TEST) cho tests/hieu-nang.js.
module.exports = async ({ win, app, dieuPhoi, store }) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (c) => win.webContents.executeJavaScript(c, true);
  const choDen = async (dk, ms) => { for (const het = Date.now() + ms; Date.now() < het; await wait(250)) if (await dk()) return true; return false; };
  const loi = [];
  const ok = (ten, dk, ct = '') => { console.log(`  ${dk ? '✔' : '✘'} ${ten}${ct ? ` — ${ct}` : ''}`); if (!dk) loi.push(ten); };
  try {
    await choDen(() => js('!!window.__diToi'), 30000);
    await js(`window.__diToi('anh'); undefined`);
    await choDen(() => js(`document.querySelectorAll('#dsHang .dong-viec').length > 100`), 30000);
    win.focus();
    if (process.env.HN_CSS) await win.webContents.insertCSS(process.env.HN_CSS);
    // Đếm số lần ghi du-lieu.json.
    let soGhi = 0;
    const ghiCu = store._ghi ? store._ghi.bind(store) : null;
    const fs = require('fs'), wf = fs.writeFile, wfs = fs.writeFileSync, rn = fs.promises.writeFile;
    const dem = (p) => { if (/du-lieu\.json/.test(String(p))) soGhi++; };
    fs.writeFile = function (p, ...a) { dem(p); return wf.call(this, p, ...a); };
    fs.writeFileSync = function (p, ...a) { dem(p); return wfs.call(this, p, ...a); };
    fs.promises.writeFile = function (p, ...a) { dem(p); return rn.call(this, p, ...a); };
    const pidUi = win.webContents.getOSProcessId();
    const cpu = () => { const m = app.getAppMetrics(); const g = (f) => m.filter(f).reduce((t, x) => t + x.cpu.percentCPUUsage, 0); return { main: g((x) => x.type === 'Browser'), ui: g((x) => x.pid === pidUi) }; };
    let soBao = 0, byteBao = 0;
    const guiCu = win.webContents.send.bind(win.webContents);
    win.webContents.send = (kenh, ...a) => { if (kenh === 'state') { soBao++; } return guiCu(kenh, ...a); };
    await wait(3000);
    soBao = 0;
    cpu();   // mốc: lần đọc kế tiếp tính từ đây
    const j = dieuPhoi.viec.filter((x) => x.duAn === 'da-0' && x.trangThai === 'cho' && x.loai === 'anh').sort((a, b) => b.so - a.so)[0];   // số lớn nhất: dòng ở đầu danh sách (mới nhất trước)
    j.trangThai = 'chay'; j.taiKhoan = 'tk-1'; j.batDauLuc = Date.now();
    const GIAY = 20;
    let dbg = null;
    if (process.env.HN_PROFILE) { dbg = win.webContents.debugger; dbg.attach('1.3'); await dbg.sendCommand('Profiler.enable'); await dbg.sendCommand('Profiler.start'); }
    for (let t = 0; t < GIAY * 4; t++) {
      dieuPhoi._luuBuoc ? (j.buoc = `Đang tạo ${t}%`, dieuPhoi._luuBuoc({ buoc: j.buoc })) : null;
      if (t % 8 === 0) { j.thu = t; dieuPhoi.luu(); }   // 2 giây một lần đổi thứ khác ngoài bước (như ghi thread / xong việc)
      await wait(250);
    }
    const c = cpu();
    if (dbg) {
      const { profile } = await dbg.sendCommand('Profiler.stop');
      const tu = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const dt = profile.timeDeltas; const tong = new Map();
      profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; tong.set(k, (tong.get(k) || 0) + (dt[i] || 0)); });
      const dong = new Map();
      for (const n of profile.nodes) if (n.callFrame.functionName === 'veHang' && n.positionTicks) for (const t of n.positionTicks) dong.set(t.line, (dong.get(t.line) || 0) + t.ticks);
      console.log('   veHang theo dòng:', [...dong].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, t]) => `${l}:${t}`).join(' '));
      console.log([...tong].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `   ${(v / 1000).toFixed(0)} ms  ${k}`).join('\n'));
    }
    console.log(`[ĐO] ${GIAY} s "đang chạy", ${dieuPhoi.viec.length} việc: CPU lõi app ${c.main.toFixed(1)}% · giao diện ${c.ui.toFixed(1)}% (100% = 1 nhân) · ghi du-lieu.json ${soGhi} lần · gửi trạng thái ${soBao} lần (tiêu điểm: ${win.isFocused()})`);
    const nguong = Number(process.env.HIEU_NANG_NGUONG) || 0;
    if (nguong) ok(`CPU lõi app + giao diện dưới ${nguong}%`, c.main + c.ui < nguong, `${(c.main + c.ui).toFixed(1)}%`);
    const dong = Number(await js(`document.querySelectorAll('#dsHang .dong-viec').length`));
    ok('danh sách vẫn vẽ đúng', dong > 100, String(dong));
    const duAnMo = await js(`(document.querySelector('#tenDuAn') || {}).textContent`);
    console.log('  dự án đang mở:', duAnMo, '· việc', j.id, j.trangThai);
    const pill = await js(`(document.querySelector('#dsHang .dong-viec[data-id="${j.id}"] .pill') || {}).textContent || ''`);
    ok('dòng việc đang chạy cập nhật', /Đang chạy/.test(pill), pill);
  } catch (err) { console.log('LỖI', err.stack); loi.push(err.message); }
  console.log(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: OK');
  app.exit(loi.length ? 1 : 0);
};
