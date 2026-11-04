'use strict';
// 1.4.9 — Kịch bản đầu-cuối THEO DÕI THƯ MỤC ẢNH (node tests/e2e.js theodoi), chạy BÊN TRONG app thật trên trang Muse giả.
// Đi đúng đường người dùng bấm trên giao diện: trang Tạo video → Chọn thư mục ảnh (2 ảnh) → bật "Theo dõi thư mục" →
// Tạo & chạy → 2 video xong; chép thêm 2 ảnh vào thư mục (dự án đã chạy hết hàng chờ) → app tự thêm 2 video, tự chạy
// lại dự án, tải về đủ 4 video; ảnh cũ không làm lại; Dừng theo dõi → ảnh thêm sau không thành việc.
// 1.4.10: ảnh đặt tên theo số prompt ảnh và NHẢY SỐ (001, 006, rồi 018, 016 — ảnh tạo không theo thứ tự) → video số 1, 6, 16, 18,
// tên 001/006/016/018.mp4 (bản 1.4.9 đánh theo vị trí: 1, 2, 3, 4 → lệch số và prompt).
const fs = require('fs');
const path = require('path');
const { session, net, dialog } = require('electron');

module.exports = function e2eTheoDoi({ win, app, LENH, dieuPhoi }) {
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
  const daGui = async () => (await net.fetch(`${process.env.MUSE_URL}/__da-gui`)).json();
  const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Theo dõi thư mục ảnh → video (trang Muse giả) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1' });
      LENH.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0,
        tuThuLaiSuno: 0, tuChayLaiLoiSuno: 0, nghiSuno: 0, doiNenKhiLoi: false });
      const thuMuc = path.join(tam, 'anh-theo-doi'), ra = path.join(tam, 'video-theo-doi');
      fs.mkdirSync(thuMuc, { recursive: true });
      for (const f of ['001.png', '006.png']) fs.writeFileSync(path.join(thuMuc, f), PNG1);
      const d = LENH.taoDuAn({ ten: 'Theo doi', taiKhoan: ['tk-1'] });
      LENH.datCaiDat({ duAn: d.id, thuMucVideo: ra, tenVideo: '{stt}', taiVideo: true, boQuaDaCo: false });
      // Hộp chọn thư mục của hệ điều hành → trả thẳng thư mục ảnh.
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [thuMuc] });

      ghi('-- 20. Giao diện: Tạo video từ thư mục ảnh + bật Theo dõi thư mục → Tạo & chạy');
      await js(`(() => { localStorage.clear(); return 1; })()`);
      await cho(async () => (await js(`!!document.querySelector('#nutDuAn')`)), 20000, 'giao diện nạp');
      // Chọn dự án vừa tạo trong menu dự án, sang trang Tạo video.
      await js(`window.__diToi('video'); 1`);
      // Menu dự án vẽ theo trạng thái — đợi tới khi có dự án vừa tạo rồi chọn nó.
      await cho(async () => {
        await js(`(() => { const m = document.querySelector('#menuDuAn'); if (m.hidden) document.querySelector('#nutDuAn').click();
          const b = m.querySelector('[data-du-an="${d.id}"]'); if (b) b.click(); else document.querySelector('#nutDuAn').click(); return 1; })()`);
        await ngu(300);
        return /Theo doi/.test(await js(`document.querySelector('#tenDuAn').textContent`));
      }, 20000, 'chọn dự án "Theo doi" trên giao diện');
      await js(`document.querySelector('#nutVideoThuMuc').click(); 1`);
      await cho(async () => /2 ảnh/.test(await js(`document.querySelector('#ghiVideoThuMuc').textContent`)), 10000, 'chọn thư mục 2 ảnh');
      const ghiTm = await js(`document.querySelector('#ghiVideoThuMuc').textContent`);
      kiem(/theo tên ảnh \(#1, 6\)/.test(ghiTm), `giao diện báo số video theo tên ảnh (${ghiTm})`);
      await js(`(() => { const o = document.querySelector('#promptThuMuc'); o.value = 'theo dõi chuyển động'; o.dispatchEvent(new Event('input')); ` +
        `const c = document.querySelector('#theoDoiThuMuc'); c.checked = true; c.dispatchEvent(new Event('change')); return 1; })()`);
      const gui0 = (await daGui()).length;
      await js(`document.querySelector('#nutTaoChay').click(); 1`);
      const v = () => dieuPhoi.viec.filter((j) => j.duAn === d.id);
      await cho(() => !!dieuPhoi.duAn.find((x) => x.id === d.id).theoDoi, 10000, 'đăng ký theo dõi');
      const td = dieuPhoi.duAn.find((x) => x.id === d.id).theoDoi;
      kiem(td && td.thuMuc === thuMuc && td.tuChay === true && td.daCo.length === 2 && td.prompt === 'theo dõi chuyển động',
        `dự án theo dõi thư mục, tự chạy, 2 ảnh đã có (${JSON.stringify(td && { thuMuc: td.thuMuc, tuChay: td.tuChay, daCo: td.daCo.length, prompt: td.prompt })})`);
      kiem(v().length === 2 && v().every((j) => j.loai === 'video'), `thêm 2 việc video (${v().length})`);
      kiem(v().map((j) => `${j.so}/${j.stt}:${path.basename(j.thamChieu[0])}`).join() === '6/6:006.png,1/1:001.png' ||
        v().map((j) => `${j.so}/${j.stt}:${path.basename(j.thamChieu[0])}`).sort().join() === '1/1:001.png,6/6:006.png',
        `số việc + số prompt theo tên ảnh, không theo vị trí (${v().map((j) => `#${j.so}/${j.stt}:${path.basename(j.thamChieu[0])}`).join(', ')})`);
      await cho(() => v().length === 2 && v().every((j) => j.trangThai === 'xong' || j.trangThai === 'loi'), 240000, '2 video đầu xong');
      kiem(v().every((j) => j.trangThai === 'xong'), `2 video đầu xong (${v().map((j) => j.trangThai).join(',')})`);
      await cho(() => !dieuPhoi.duAnChay.has(d.id), 15000, 'dự án chạy hết hàng chờ');
      kiem(!dieuPhoi.duAnChay.has(d.id), 'dự án đã chạy hết hàng chờ (không còn chạy)');
      const dong = await js(`(() => { const e = document.querySelector('#dongTheoDoi'); return { an: e.hidden, chu: e.textContent }; })()`);
      kiem(!dong.an && /Đang theo dõi "anh-theo-doi"/.test(dong.chu) && /quét lúc \d/.test(dong.chu), `giao diện hiện dòng theo dõi (${dong.chu})`);

      ghi('-- 21. Làm thêm 2 ảnh vào thư mục → app tự thêm 2 video và tự chạy lại dự án');
      for (const f of ['018.png', '016.png']) fs.writeFileSync(path.join(thuMuc, f), PNG1);
      await cho(() => v().length >= 4, 40000, 'ảnh mới thành việc video');
      const moi = v().slice(2);
      kiem(moi.length === 2 && moi.map((j) => `${j.so}/${j.stt}:${path.basename(j.thamChieu[0])}`).sort().join() === '16/16:016.png,18/18:018.png',
        `2 việc video mới mang số của ảnh 016, 018 (${moi.map((j) => `#${j.so}/${j.stt}:${path.basename((j.thamChieu || [])[0] || '')}`).join(', ')})`);
      kiem(dieuPhoi.duAnChay.has(d.id) || moi.some((j) => j.trangThai !== 'cho'), 'dự án tự chạy lại');
      await cho(() => v().length === 4 && v().every((j) => j.trangThai === 'xong' || j.trangThai === 'loi'), 240000, '4 video xong');
      const tep = fs.existsSync(ra) ? fs.readdirSync(ra).filter((f) => /\.mp4$/.test(f)).sort() : [];
      ghi(`   thư mục video: ${tep.join(', ')}`);
      kiem(v().every((j) => j.trangThai === 'xong') && ['001.mp4', '006.mp4', '016.mp4', '018.mp4'].every((f) => tep.includes(f)) && tep.length === 4, 'đủ 4 video tải về, tên theo số ảnh (001, 006, 016, 018)');
      const gui = (await daGui()).slice(gui0).map((g) => g.prompt || '');
      kiem(gui.length === 4 && gui.every((x) => /theo dõi chuyển động/.test(x)), `Muse nhận đúng 4 lần gửi, prompt dùng chung (${gui.length})`);
      const nk = LENH.trangThai().nhatKy;
      kiem(nk.some((x) => /📂 Thư mục "anh-theo-doi": thêm 2 ảnh mới → 2 video/.test(x.chu)), 'nhật ký ghi ảnh mới → video');
      const dong2 = await js(`document.querySelector('#ghiTheoDoi').textContent`);
      kiem(/đã thêm 2 video/.test(dong2), `giao diện đếm 2 video đã thêm (${dong2})`);

      ghi('-- 22. Dừng theo dõi → ảnh thêm sau không thành việc');
      await js(`document.querySelector('#nutBoTheoDoi').click(); 1`);
      await cho(() => !dieuPhoi.duAn.find((x) => x.id === d.id).theoDoi, 10000, 'dừng theo dõi');
      fs.writeFileSync(path.join(thuMuc, '020.png'), PNG1);
      await ngu(14000);
      kiem(v().length === 4, `không thêm việc cho ảnh sau khi dừng theo dõi (${v().length})`);
      kiem(await js(`document.querySelector('#dongTheoDoi').hidden`), 'dòng theo dõi ẩn');
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
