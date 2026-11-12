'use strict';
// 1.4.12 — Kịch bản đầu-cuối KIỂM TRA VIỆC MUSE ĐANG TẠO DỞ (node tests/e2e.js kiemdo), chạy BÊN TRONG app thật trên trang
// Muse giả: việc đã gửi prompt (còn chat) nhưng app không lấy được kết quả (tắt app giữa chừng / hết giờ chờ → Lỗi). Bấm
// "Kiểm tra & tải về" trên dải báo của danh sách → app mở lại ĐÚNG chat cũ, video đã xong thì tải về, KHÔNG gửi prompt mới;
// chat không có kết quả → việc giữ trạng thái cũ, bỏ chat, không gửi lại.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eKiemDo({ win, app, LENH, dieuPhoi, nhatKy }) {
  const tam = process.env.MUSE_E2E_TAM;
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
  const viec = () => dieuPhoi.viec;
  const daGui = async () => (await net.fetch(`${process.env.MUSE_URL}/__da-gui`)).json();
  const nhatKyApp = () => nhatKy.map((d) => d.chu || '').join('\n');

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Kiểm tra việc Muse đang tạo dở (trang Muse giả) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1' });
      LENH.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, choChuGiay: 15, choAnhGiay: 60, tuThuLai: 0, tuChayLaiLoi: 0, taiAnh: true, taiVideo: true,
        thuMucVideo: path.join(tam, 'video'), thuMucAnh: path.join(tam, 'anh') });
      await cho(() => js('!!window.__diToi'), 20000, 'giao diện sẵn sàng');

      // 1) Tạo một video như thường, đợi xong — có chat + file.
      ghi('-- 1. Tạo video (có chat trên Muse)');
      const r1 = LENH.them({ loai: 'video', tyLe: '9:16', prompts: ['kiểm dở: con mèo chạy'], chay: true });
      kiem(r1.ok && r1.so === 1, 'thêm 1 việc video');
      const j = viec().find((v) => v.prompt.startsWith('kiểm dở'));
      await cho(() => j.trangThai === 'xong' || j.trangThai === 'loi', 180000, 'video xong');
      kiem(j.trangThai === 'xong' && !!j.thread && j.files.length === 1 && fs.existsSync(j.files[0]), `video xong, còn chat (${j.thread})`);
      LENH.dung({});
      await cho(() => !dieuPhoi.dangChay, 20000, 'dừng');

      // 2) Giả lập: app không lấy được kết quả (tắt giữa chừng / hết giờ chờ) → Lỗi, mất file, vẫn còn chat.
      ghi('-- 2. Việc Lỗi "quá giờ" mà chat Muse đã có video → Kiểm tra & tải về');
      const fileCu = j.files[0];
      fs.unlinkSync(fileCu);
      Object.assign(j, { trangThai: 'loi', loi: 'Quá 300 giây chưa thấy kết quả', files: [], xongLuc: Date.now() });
      dieuPhoi.luu();
      await js(`window.__diToi('video'); 1`);
      const coDai = await cho(async () => js(`!document.querySelector('#dongChatDo').hidden && /1 việc Muse còn chat đang tạo dở \\(#1\\)/.test(document.querySelector('#chuChatDo').textContent)`), 10000, 'dải báo chat dở');
      kiem(coDai, 'danh sách hiện dải "1 việc Muse còn chat đang tạo dở (#1)"');
      // Menu ⋯ của dòng có mục kiểm tra.
      await js(`document.querySelector('#dsHang .dong-viec[data-id="${j.id}"] .ba-cham').click(); 1`);
      const coMuc = await js(`[...document.querySelectorAll('.menu-dong button')].some((b) => /Kiểm tra chat Muse cũ/.test(b.textContent))`);
      await js(`document.body.click(); document.querySelectorAll('.menu-dong').forEach((m) => m.remove()); 1`);
      kiem(coMuc, 'menu ⋯ của dòng có "Kiểm tra chat Muse cũ & tải về"');
      const gui2 = (await daGui()).length;
      await js(`document.querySelector('#nutKiemChatDo').click(); 1`);
      await cho(() => j.trangThai === 'xong', 120000, 'kiểm tra xong');
      kiem(j.trangThai === 'xong' && j.files.length === 1 && fs.existsSync(j.files[0]), `chat cũ có video → tải về, việc Hoàn tất (${j.files[0] || '-'})`);
      kiem((await daGui()).length === gui2, 'KHÔNG gửi prompt mới lên Muse');
      kiem(/🔎 #1: chat Muse cũ đã có video — tải về, không tạo lại/.test(nhatKyApp()), 'nhật ký ghi đã tải từ chat cũ');
      kiem(!dieuPhoi.dangChay && !j.chayRieng && !j.chiKiem, 'kiểm xong thì thôi chạy');
      await cho(async () => js(`document.querySelector('#dongChatDo').hidden`), 5000, 'dải báo ẩn');
      kiem(await js(`document.querySelector('#dongChatDo').hidden`), 'hết việc dở → dải báo ẩn');

      // 3) Chat không có kết quả (chat trống) → việc giữ trạng thái cũ (Lỗi), bỏ chat, không gửi lại, không tính lỗi tài khoản.
      ghi('-- 3. Chat cũ không có kết quả → giữ Lỗi, không gửi lại');
      LENH.them({ loai: 'anh', tyLe: '1:1', prompts: ['kiểm dở: chat trống'] });
      const k = viec().find((v) => v.prompt.startsWith('kiểm dở: chat trống'));
      Object.assign(k, { trangThai: 'loi', loi: 'Quá 180 giây chưa thấy kết quả', taiKhoan: 'tk-1', thread: `${process.env.MUSE_URL}/thread/trong${Date.now()}`, xongLuc: Date.now() });
      dieuPhoi.luu();
      const gui3 = (await daGui()).length;
      const r3 = LENH.kiemTraViecDo({ ids: [k.id] });
      kiem(r3.ok && r3.so === 1, 'lệnh kiểm tra nhận 1 việc');
      await cho(() => k.trangThai === 'loi' && !k.chiKiem, 150000, 'kiểm tra chat trống xong');
      kiem(k.trangThai === 'loi' && !k.thread && /Kiểm tra chat Muse cũ: chưa có kết quả/.test(k.loi), `giữ Lỗi, bỏ chat (${k.loi})`);
      kiem((await daGui()).length === gui3, 'không gửi prompt mới');
      kiem(!(dieuPhoi.loiLienTiep['tk-1'] > 0), 'không tính lỗi tài khoản');
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
