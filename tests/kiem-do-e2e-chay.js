'use strict';
// 1.4.12 — Kịch bản đầu-cuối KIỂM VIỆC DỞ (node tests/e2e.js kiemdo), chạy BÊN TRONG app thật trên trang Muse giả.
// Như lúc app bị tắt giữa chừng: 3 việc video Muse đã gửi prompt (có chat) ở Muse 1 mà chưa lấy kết quả —
//   A: chat cũ đã có video   B: Muse vẫn đang tạo   C: Muse báo "hết lượt tạo video trong 24 giờ qua".
// Bấm "Kiểm tra việc dở" (dải báo trên danh sách) → A tải về, không gửi lại; B giữ chat, hẹn kiểm lại; C → Muse 1 thôi nhận
// video 24 giờ. Chạy dự án → C gửi ở Muse 2 (một lần gửi), B không bị gửi lại.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eKiemDo({ win, LENH, dieuPhoi, taiKhoan }) {
  const tam = process.env.MUSE_E2E_TAM;
  const URL_ = process.env.MUSE_URL;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (await dk()) return true; await ngu(250); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const js = (c) => win.webContents.executeJavaScript(c, true);
  const daGui = async () => (await net.fetch(`${URL_}/__da-gui`)).json();
  const guiGia = (o) => net.fetch(`${URL_}/__gui`, { method: 'POST', body: JSON.stringify(o) });

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Kiểm việc dở (trang Muse giả) ==');
      const tk2 = taiKhoan.them('Muse 2', 'muse');
      for (const id of ['tk-1', tk2.id]) await session.fromPartition(`persist:muse-${id}`).cookies.set({ url: URL_, name: 'muse_login', value: '1' });
      taiKhoan.sua('tk-1', { trangThai: 'da-dang-nhap' });
      taiKhoan.sua(tk2.id, { trangThai: 'da-dang-nhap' });
      LENH.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0, anhTruocVideo: false, doiNenKhiLoi: false });
      const d = LENH.taoDuAn({ ten: 'Kiem do', taiKhoan: ['tk-1', tk2.id] });
      const thuMuc = path.join(tam, 'ra');
      fs.mkdirSync(thuMuc, { recursive: true });
      LENH.datCaiDat({ duAn: d.id, thuMucVideo: thuMuc, tenVideo: '{stt}', taiVideo: true });
      LENH.them({ duAn: d.id, loai: 'video', tyLe: '9:16', prompts: ['mèo chạy kiểm xong', 'chó nhảy kiểm đang', 'chim bay kiểm hết lượt'] });
      const [a, b, c] = dieuPhoi.viec.filter((j) => j.duAn === d.id).sort((x, y) => x.so - y.so);
      // Chat cũ trên Muse giả (như đã gửi trước khi app tắt): A xong từ 1 phút trước, B còn đang tạo, C hết lượt.
      const tin = (j) => `Tạo 1 video ${j.prompt}`;
      await guiGia({ prompt: tin(a), soFile: 0, thread: 'kiem-xong', t0: Date.now() - 60000 });
      await guiGia({ prompt: tin(b), soFile: 0, thread: 'kiem-dang', t0: Date.now() + 3600e3 });
      // Từ khoá HET_LUOT chỉ ở chat cũ trên Muse 1 (gửi lại ở Muse 2 là prompt thường → tạo được).
      await guiGia({ prompt: `${tin(c)} HET_LUOT`, soFile: 0, thread: 'kiem-het', t0: Date.now() - 60000 });
      Object.assign(a, { trangThai: 'cho', taiKhoan: 'tk-1', thread: `${URL_}/thread/kiem-xong` });
      Object.assign(b, { trangThai: 'loi', taiKhoan: 'tk-1', thread: `${URL_}/thread/kiem-dang`, loi: 'app tắt giữa chừng' });
      Object.assign(c, { trangThai: 'cho', taiKhoan: 'tk-1', thread: `${URL_}/thread/kiem-het` });
      dieuPhoi.luu();
      const gui0 = (await daGui()).length;

      ghi('-- 1. Dải báo + nút "Kiểm tra việc dở"');
      await js(`window.__diToi('video'); undefined`);
      // Mở dự án "Kiem do" qua menu dự án như người dùng bấm.
      // Giao diện nhận dự án mới qua bản trạng thái (gom 250 ms) → chờ nút dự án có trong menu rồi mới bấm.
      const moDuAn = await cho(() => js(`(() => { document.querySelector('#nutDuAn').click(); const b = document.querySelector('#menuDuAn [data-du-an="${d.id}"]');
        if (!b) { document.querySelector('#nutDuAn').click(); return false; } b.click(); return true; })()`), 10000, 'mở dự án Kiem do');
      kiem(moDuAn, 'mở dự án "Kiem do" từ menu dự án');
      await ngu(1500);
      ghi(`   dải: ${await js(`JSON.stringify({ an: document.querySelector('#daiViecDo').hidden, chu: document.querySelector('#daiViecDoChu').innerHTML, duAn: document.querySelector('#tenDuAn')?.textContent || '' })`)}`);
      const coDai = await cho(async () => /3<\/b> việc Muse đã gửi prompt/.test(await js(`document.querySelector('#daiViecDo:not([hidden]) #daiViecDoChu')?.innerHTML || ''`)), 10000, 'dải báo 3 việc dở');
      kiem(coDai, 'dải báo "3 việc Muse đã gửi prompt nhưng chưa lấy kết quả" hiện trên danh sách');
      await js(`document.querySelector('#nutKiemViecDo').click(); 1`);
      await cho(() => a.trangThai === 'xong' && !c.thread && !(b.dangKiem || c.dangKiem), 120000, 'kiểm xong 3 việc');
      ghi(`   A ${a.trangThai} ${a.files[0] || ''} · B ${b.trangThai} kiemLai=${!!b.kiemLai} · C ${c.trangThai} thread=${c.thread || '-'} · Muse 1 chặn video tới ${new Date(taiKhoan.tim('tk-1').chanVideoDen || 0).toLocaleTimeString()}`);
      kiem(a.trangThai === 'xong' && a.taiKhoan === 'tk-1' && fs.existsSync(path.join(thuMuc, '001.mp4')), 'A: chat cũ đã có video → tải về 001.mp4, việc Xong');
      kiem(b.trangThai === 'loi' && b.thread.endsWith('/thread/kiem-dang') && b.kiemLai > Date.now(), 'B: Muse vẫn đang tạo → giữ chat, hẹn kiểm lại (không tạo lại)');
      kiem(c.trangThai === 'cho' && !c.thread && (taiKhoan.tim('tk-1').chanVideoDen || 0) > Date.now() + 23 * 3600e3, 'C: hết lượt video 24 giờ → Muse 1 thôi nhận video 24 giờ, việc chờ tài khoản khác');
      kiem((await daGui()).length === gui0, 'kiểm việc dở không gửi prompt nào');

      ghi('-- 2. Chạy dự án: C gửi ngay ở Muse 2, B không bị gửi lại');
      LENH.chay({ duAn: d.id });
      await cho(() => c.trangThai === 'xong', 120000, 'C xong ở Muse 2');
      const moi = (await daGui()).slice(gui0);
      ghi(`   gửi mới: ${moi.map((g) => g.prompt).join(' | ')}`);
      kiem(c.trangThai === 'xong' && c.taiKhoan === tk2.id, `C xong ở Muse 2 (${c.taiKhoan})`);
      kiem(moi.length === 1 && /chim bay kiểm hết lượt/.test(moi[0].prompt), 'chỉ đúng 1 lần gửi mới (C ở Muse 2), B không bị gửi lại');
      kiem(b.thread.endsWith('/thread/kiem-dang'), 'B vẫn giữ chat cũ');
      LENH.dung({ duAn: d.id });

      // 1.5.2: cột chi tiết — "Tab của việc này": mở chat cũ xem, tải video từ chat cũ (không gửi lại).
      ghi('-- 3. Chat cũ của B: Mở tab + Tải về (1.5.2)');
      await guiGia({ prompt: tin(b), soFile: 0, thread: 'kiem-cu-xong', t0: Date.now() - 60000 });
      b.chatCu = [{ tk: 'tk-1', thread: `${URL_}/thread/kiem-cu-xong`, luc: Date.now() - 600000 }];
      dieuPhoi.luu();
      await js(`window.__diToi('video'); undefined`);
      await cho(() => js(`!!document.querySelector('#dsHang .dong-viec[data-id="${b.id}"]')`), 10000, 'dòng B hiện');
      await js(`document.querySelector('#dsHang .dong-viec[data-id="${b.id}"] .dong-prompt, #dsHang .dong-viec[data-id="${b.id}"]').click(); 1`);
      const coMuc = await cho(async () => Number(await js(`document.querySelectorAll('#chiTiet .ct-chat').length`)) === 2, 10000, 'mục Tab của việc này có 2 chat');
      kiem(coMuc, 'cột chi tiết có mục "Tab của việc này" với 2 chat (chat hiện tại + chat cũ)');
      const truocCuaSo = require('electron').BrowserWindow.getAllWindows().length;
      await js(`document.querySelector('#chiTiet [data-chat="mo"][data-thread$="/thread/kiem-cu-xong"]').click(); 1`);
      const coCuaSo = await cho(() => require('electron').BrowserWindow.getAllWindows().some((w) => w.isVisible() && /\/thread\/kiem-cu-xong/.test(w.webContents.getURL())), 10000, 'cửa sổ chat cũ');
      kiem(coCuaSo && require('electron').BrowserWindow.getAllWindows().length === truocCuaSo + 1, '"Mở tab" mở cửa sổ xem đúng chat cũ (phiên của Muse 1)');
      const gui3 = (await daGui()).length;
      await js(`document.querySelector('#chiTiet [data-chat="tai"][data-thread$="/thread/kiem-dang"]').click(); 1`);
      await ngu(1500);
      await cho(() => !(dieuPhoi._taiChat && dieuPhoi._taiChat.size), 90000, 'tải từ chat đang tạo xong lượt');
      kiem(b.trangThai === 'loi' && LENH.trangThai().nhatKy.some((x) => /📥 #2: chưa tải được từ chat ở "Muse 1" — Muse vẫn đang tạo/.test(x.chu)),
        '"Tải về" ở chat Muse còn đang tạo → báo "Muse vẫn đang tạo", việc giữ nguyên');
      await js(`document.querySelector('#chiTiet [data-chat="tai"][data-thread$="/thread/kiem-cu-xong"]').click(); 1`);
      await cho(() => b.trangThai === 'xong', 90000, 'B xong từ chat cũ');
      ghi(`   B ${b.trangThai} ${b.files[0] || ''} tk=${b.taiKhoan}`);
      kiem(b.trangThai === 'xong' && b.taiKhoan === 'tk-1' && fs.existsSync(path.join(thuMuc, '002.mp4')), '"Tải về" ở chat cũ đã có video → tải về 002.mp4, việc Xong');
      kiem((await daGui()).length === gui3, 'tải từ chat cũ không gửi prompt nào');
      kiem(LENH.trangThai().nhatKy.some((x) => /📥 #2: đã tải từ chat ở "Muse 1" — không tạo lại/.test(x.chu)), 'nhật ký ghi tải từ chat');
      for (const w of require('electron').BrowserWindow.getAllWindows()) if (/\/thread\/kiem-cu-xong/.test(w.webContents.getURL())) w.close();

      // "Hiện tab đang chạy": việc E đang chờ Muse trong chat (tạo lâu) → hiện đúng cửa sổ luồng đang chạy nó.
      ghi('-- 4. Hiện tab đang chạy (1.5.2)');
      LENH.them({ duAn: d.id, loai: 'video', tyLe: '9:16', prompts: ['rùa bò hiện tab'] });
      const e = dieuPhoi.viec.filter((j) => j.duAn === d.id).sort((x, y) => y.so - x.so)[0];
      await guiGia({ prompt: tin(e), soFile: 0, thread: 'kiem-lau', t0: Date.now() + 3600e3 });
      // Muse 1 đã thôi nhận video (mục C) → chat của E ở Muse 2.
      Object.assign(e, { trangThai: 'cho', taiKhoan: tk2.id, thread: `${URL_}/thread/kiem-lau`, kiemSo: 6 });
      LENH.chay({ duAn: d.id });
      await cho(() => e.trangThai === 'chay' && dieuPhoi._luongCuaViec(e), 30000, 'E đang chạy ở luồng');
      await js(`document.querySelector('#dsHang .dong-viec[data-id="${e.id}"]').click(); 1`);
      await cho(() => js(`!!document.querySelector('#chiTiet [data-ct="xemTab"]')`), 10000, 'nút Hiện tab đang chạy');
      await js(`document.querySelector('#chiTiet [data-ct="xemTab"]').click(); 1`);
      const hien = await cho(() => require('electron').BrowserWindow.getAllWindows().some((w) => w.isVisible() && /\/thread\/kiem-lau/.test(w.webContents.getURL())), 10000, 'cửa sổ luồng hiện');
      ghi(`   E ${e.trangThai} buoc=${e.buoc} thread=${e.thread} · cửa sổ: ${require('electron').BrowserWindow.getAllWindows().map((w) => `${w.isVisible() ? 'hiện' : 'ẩn'}:${w.getTitle()}:${w.webContents.getURL()}`).join(' | ')}`);
      kiem(hien, '"Hiện tab đang chạy" hiện đúng cửa sổ luồng đang chờ chat của việc');
      const wl = require('electron').BrowserWindow.getAllWindows().find((w) => /\/thread\/kiem-lau/.test(w.webContents.getURL()));
      if (wl) wl.close();
      await ngu(800);
      kiem(wl && !wl.isDestroyed() && !wl.isVisible() && e.trangThai === 'chay', 'bấm X trên cửa sổ luồng chỉ ẩn đi, việc vẫn chạy');
      LENH.dung({ duAn: d.id });
    } catch (err) {
      ghi(`  ✘ lỗi kịch bản: ${err.stack}`);
      loi.push(err.message);
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    setTimeout(() => process.exit(loi.length ? 1 : 0), 300);
  });
};
