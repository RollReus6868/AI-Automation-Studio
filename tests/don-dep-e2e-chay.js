'use strict';
// 1.4.12 — Kịch bản đầu-cuối DỌN DỮ LIỆU THỪA (node tests/e2e.js dondep), chạy BÊN TRONG app thật trên trang Muse giả.
// Tài khoản Muse 1 đăng nhập (cookie) với trang đang mở (luồng chạy) → dọn qua API phiên; Muse 2 đã mở rồi đóng → xoá
// bộ nhớ đệm trên đĩa; thư mục phiên mồ côi (tài khoản đã xoá) → mất; nhật ký cũ, file chẩn đoán → mất. Sau khi dọn: cookie
// đăng nhập + localStorage vẫn còn, trang vẫn nạp được, nhật ký đang ghi còn. Đi đúng đường người dùng: Cài đặt → Cả app →
// "Dọn dữ liệu thừa…" → hộp thoại → Dọn.
const fs = require('fs');
const path = require('path');
const { session, BrowserWindow } = require('electron');

module.exports = function e2eDonDep({ win, app, LENH }) {
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
  const js = (s) => win.webContents.executeJavaScript(s, true);
  const ud = () => app.getPath('userData');
  const mb = (n) => Buffer.alloc(n * 1024 * 1024, 7);
  const muc = (kq, ma) => (kq.muc || []).find((m) => m.ma === ma) || { byte: 0 };
  const moTrang = async (partition) => {
    const w = new BrowserWindow({ show: false, webPreferences: { partition } });
    await w.loadURL(process.env.MUSE_URL).catch(() => {});
    await ngu(1500);
    return w;
  };

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Dọn dữ liệu thừa (app thật, trang Muse giả) ==');
      const tk2 = LENH.themTaiKhoan({ ten: 'Muse 2', nen: 'muse' });
      const s1 = session.fromPartition('persist:muse-tk-1');
      await s1.cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1', expirationDate: Math.floor(Date.now() / 1000) + 86400 });
      // Muse 1: trang đang mở suốt bài (như luồng đang chạy) + localStorage.
      const w1 = await moTrang('persist:muse-tk-1');
      await w1.webContents.executeJavaScript(`localStorage.setItem('giu', 'con'); 1`);
      // Muse 2: mở rồi đóng → bộ nhớ đệm nằm trên đĩa, không phiên nào đang dùng.
      const w2 = await moTrang(tk2.partition);
      w2.destroy();
      await s1.flushStorageData();
      await session.fromPartition(tk2.partition).flushStorageData();
      // Bộ nhớ đệm "nặng" giả + thư mục phiên của tài khoản đã xoá + nhật ký cũ + chẩn đoán.
      const p2 = path.join(ud(), 'Partitions', tk2.partition.replace(/^persist:/, ''));
      fs.mkdirSync(path.join(p2, 'Cache', 'Cache_Data'), { recursive: true });
      fs.writeFileSync(path.join(p2, 'Cache', 'Cache_Data', 'f_gia'), mb(3));
      const moCoi = path.join(ud(), 'Partitions', 'muse-da-xoa-tu-lau');
      fs.mkdirSync(path.join(moCoi, 'Cache', 'Cache_Data'), { recursive: true });
      fs.writeFileSync(path.join(moCoi, 'Cache', 'Cache_Data', 'x'), mb(2));
      fs.writeFileSync(path.join(moCoi, 'Cookies'), 'cu');
      fs.writeFileSync(path.join(ud(), 'nhat-ky-cu.txt'), mb(1));
      fs.mkdirSync(path.join(ud(), 'chan-doan-muse'), { recursive: true });
      fs.writeFileSync(path.join(ud(), 'chan-doan-muse', 'loi.html'), mb(1));

      ghi('-- 1. Quét');
      const q1 = await LENH.quetDuLieu();
      kiem(q1 && q1.userData === ud() && q1.tong > 7 * 1024 * 1024, `quét: tổng ${q1 && q1.tong} byte ở ${q1 && q1.userData}`);
      kiem(muc(q1, 'cache').byte >= 3 * 1024 * 1024, `bộ nhớ đệm ≥ 3 MB (${muc(q1, 'cache').byte})`);
      kiem(muc(q1, 'phien-cu').byte >= 2 * 1024 * 1024 && muc(q1, 'phien-cu').soMuc === 1, `phiên tài khoản đã xoá: 1 thư mục (${muc(q1, 'phien-cu').byte})`);
      kiem(muc(q1, 'nhat-ky-cu').byte === 1024 * 1024 && muc(q1, 'chan-doan').byte === 1024 * 1024, 'nhật ký cũ + chẩn đoán 1 MB mỗi mục');
      kiem(!JSON.stringify(q1).includes('"xoa"'), 'gửi giao diện bản tóm tắt (không kèm đường dẫn xoá)');

      ghi('-- 2. Cài đặt → Cả app → Dọn dữ liệu thừa… (giao diện)');
      await js(`window.__diToi('caidat'); 1`);
      await cho(async () => /dọn được khoảng/.test(await js(`document.querySelector('#cdDungLuong').textContent`)), 15000, 'dòng dung lượng');
      kiem(/dọn được khoảng/.test(await js(`document.querySelector('#cdDungLuong').textContent`)), 'Cài đặt hiện dung lượng dữ liệu + phần dọn được');
      await js(`document.querySelector('#cdDonDuLieu').click(); 1`);
      await cho(async () => (await js(`document.querySelectorAll('#hopNoiDung .muc-don').length`)) === 7, 15000, 'hộp thoại dọn');
      const hop = JSON.parse(await js(`JSON.stringify({ n: document.querySelectorAll('#hopNoiDung .muc-don').length,
        chon: [...document.querySelectorAll('#hopNoiDung .muc-don input:checked')].map((i) => i.name),
        tieuDe: document.querySelector('#hopTieuDe').textContent, phu: !document.querySelector('#phu').hidden })`));
      kiem(hop.phu && hop.n === 7 && hop.chon.includes('don_cache') && hop.chon.includes('don_phien-cu') && /Dọn dữ liệu thừa — dọn được khoảng/.test(hop.tieuDe), JSON.stringify(hop));
      if (process.env.CHUP_DON) {
        win.setContentSize(1280, 820);
        await ngu(600);
        fs.writeFileSync(process.env.CHUP_DON, (await win.webContents.capturePage()).toPNG());
      }
      await js(`document.querySelector('#hopOk').click(); 1`);
      await cho(async () => /Đã dọn/.test(await js(`document.querySelector('#toast').textContent`)), 30000, 'toast Đã dọn');
      kiem(/Đã dọn \d/.test(await js(`document.querySelector('#toast').textContent`)), `toast: ${await js(`document.querySelector('#toast').textContent`)}`);

      ghi('-- 3. Sau khi dọn');
      kiem(!fs.existsSync(moCoi), 'thư mục phiên của tài khoản đã xoá: mất');
      kiem(!fs.existsSync(path.join(p2, 'Cache', 'Cache_Data', 'f_gia')), 'bộ nhớ đệm Muse 2 (không mở) xoá trên đĩa');
      kiem(!fs.existsSync(path.join(ud(), 'nhat-ky-cu.txt')) && fs.existsSync(path.join(ud(), 'nhat-ky.txt')), 'nhật ký cũ mất, nhật ký đang ghi còn');
      kiem(!fs.existsSync(path.join(ud(), 'chan-doan-muse', 'loi.html')), 'file chẩn đoán mất');
      const ck = await s1.cookies.get({ name: 'muse_login' });
      kiem(ck.length === 1, `Muse 1 vẫn đăng nhập (cookie còn: ${ck.length})`);
      await w1.webContents.reload();
      await ngu(1500);
      kiem(await w1.webContents.executeJavaScript(`localStorage.getItem('giu')`) === 'con', 'localStorage của trang đang mở vẫn còn');
      kiem(await w1.webContents.executeJavaScript(`!!document.body`), 'trang đang mở vẫn nạp lại được');
      kiem(fs.existsSync(path.join(ud(), 'du-lieu.json')), 'dữ liệu dự án còn');
      const q2 = await LENH.quetDuLieu();
      kiem(muc(q2, 'phien-cu').byte === 0 && muc(q2, 'nhat-ky-cu').byte === 0 && q2.tong < q1.tong - 6 * 1024 * 1024, `quét lại: tổng ${q1.tong} → ${q2.tong}`);
      const nk = fs.readFileSync(path.join(ud(), 'nhat-ky.txt'), 'utf8');
      kiem(/🧹 Đã dọn \d/.test(nk), 'nhật ký ghi "🧹 Đã dọn …"');
      w1.destroy();
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
