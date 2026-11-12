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
      await js(`(() => { document.querySelector('#nutDuAn').click(); const b = document.querySelector('#menuDuAn [data-du-an="${d.id}"]'); b.click(); return 1; })()`);
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
    } catch (err) {
      ghi(`  ✘ lỗi kịch bản: ${err.stack}`);
      loi.push(err.message);
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    setTimeout(() => process.exit(loi.length ? 1 : 0), 300);
  });
};
