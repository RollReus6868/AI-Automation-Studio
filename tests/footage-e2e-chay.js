'use strict';
// 1.6.0 — Kịch bản đầu-cuối FOOTAGE (node tests/e2e.js footage), chạy BÊN TRONG app thật, bấm qua giao diện:
// nhập khoá API → mở <tên>_footage.xlsx → Tải footage (API Pexels / Pixabay giả) → file 0003.mp4… đúng clip,
// Đổi clip, Bỏ / Lấy lại, Pexels hết lượt → Pixabay, tải clip hỏng → Lỗi có lý do, mở lại app giữ danh sách.
// FT_ANH=<thư mục> → chụp trang Footage (1440 và 1100 px) để xem bằng mắt.
const fs = require('fs');
const path = require('path');
const { net } = require('electron');

module.exports = function e2eFootage({ win, app, footage, LENH, dieuPhoi }) {
  const tam = process.env.MUSE_E2E_TAM;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (await dk()) return true; await ngu(200); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const js = (ma) => win.webContents.executeJavaScript(ma);
  const bam = (sel) => js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  const go = (sel, v) => js(`(() => { const o = document.querySelector(${JSON.stringify(sel)}); o.value = ${JSON.stringify(v)}; o.dispatchEvent(new Event('input')); return true; })()`);
  const ghiApi = async () => (await net.fetch(`${process.env.MUSE_URL}/__ft/ghi`)).json();
  const cauHinh = (o) => net.fetch(`${process.env.MUSE_URL}/__ft/cau-hinh`, { method: 'POST', body: JSON.stringify(o) });
  const canh = (so) => footage.ds.canh.find((x) => x.so === so);
  const chup = async (ten) => {
    if (!process.env.FT_ANH) return;
    await ngu(400);
    fs.mkdirSync(process.env.FT_ANH, { recursive: true });
    fs.writeFileSync(path.join(process.env.FT_ANH, ten), (await win.webContents.capturePage()).toPNG());
  };
  /** Bấm "Tải footage" khi giao diện đã thấy lượt trước xong (nút không còn là "Dừng"), chờ lượt này xong. */
  const taiVaCho = async (ten) => {
    await cho(() => js("!document.querySelector('#ftChay').disabled && /Tải footage/.test(document.querySelector('#ftChay').textContent)"), 10000, `${ten}: nút Tải footage sẵn sàng`);
    const truoc = footage.luotXong;
    kiem(await bam('#ftChay'), `${ten}: bấm Tải footage`);
    await cho(() => footage.luotXong > truoc, 60000, `${ten}: tải xong`);
  };
  const videoMau = fs.statSync(path.join(__dirname, 'fixture-video.mp4')).size;

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Footage (API Pexels / Pixabay giả) ==');
      await cho(() => js('!!window.__diToi'), 15000, 'giao diện sẵn sàng');
      await ngu(800);

      ghi('-- 1. Nhập khoá API qua giao diện');
      await js("window.__diToi('footage')");
      kiem(await js("!document.querySelector('#trang-footage').hidden && document.querySelector('#nav [data-trang=footage]').classList.contains('on')"), 'trang Footage hiện, nút thanh trái sáng');
      kiem(await js("document.querySelector('#ftChay').disabled && /Chưa mở danh sách/.test(document.querySelector('#ftBang').textContent)"), 'chưa mở danh sách: nút Tải footage tắt, có hướng dẫn');
      await go('#ftPexels', 'KHOA-PEXELS-E2E');
      await go('#ftPixabay', 'KHOA-PIXABAY-E2E');
      await bam('#ftLuuKhoa');
      await cho(() => footage.caiDat.pexelsKey === 'KHOA-PEXELS-E2E' && footage.caiDat.pixabayKey === 'KHOA-PIXABAY-E2E', 5000, 'lưu khoá');
      kiem(footage.caiDat.pexelsKey === 'KHOA-PEXELS-E2E' && footage.caiDat.pixabayKey === 'KHOA-PIXABAY-E2E', 'khoá lưu vào app');
      await cho(() => js("/…-E2E/.test(document.querySelector('#ftPexels').placeholder) && document.querySelector('#ftPexels').value === ''"), 5000, 'ô khoá xoá trắng, chỉ ghi đuôi khoá');
      kiem(await js("document.querySelector('#ftHienDai').checked") && footage.caiDat.boHienDai === true, '1.6.2: "Bỏ clip có đồ vật hiện đại" mặc định bật');
      kiem(await js("/Đã lưu khoá/.test(document.querySelector('#ftPexelsGhi').textContent) && !document.body.innerHTML.includes('KHOA-PEXELS-E2E')"), 'giao diện không chứa nguyên khoá');

      ghi('-- 2. Mở file footage, chọn thư mục lưu, Tải footage');
      const tep = path.join(tam, 'Thien_su_footage.xlsx');
      fs.copyFileSync(path.join(__dirname, 'fixture-footage.xlsx'), tep);
      const r = footage.napTep(tep);   // (nút "Mở file footage…" mở hộp chọn file của hệ điều hành — gọi thẳng phần sau hộp chọn)
      kiem(r.ok && r.so === 4 && r.loi.length === 2, `mở 4 cảnh, 2 dòng bỏ qua (${JSON.stringify(r)})`);
      const thu = path.join(tam, 'Project', 'Videos');
      footage.datThuMuc(thu);
      await cho(() => js("document.querySelectorAll('#ftBang .ft-dong').length === 4"), 5000, 'vẽ 4 dòng cảnh');
      kiem(await js("document.querySelector('#ftThuMuc').value") === thu, 'ô thư mục lưu hiện đúng');
      kiem(await js("/Thien_su \\(4 cảnh\\)/.test(document.querySelector('#ftTenDs').textContent) && /2 dòng trong file bị bỏ qua/.test(document.querySelector('#ftTomTat').textContent)"), 'tên danh sách + số dòng bỏ qua');
      await taiVaCho('lần 1');
      const ten = fs.existsSync(thu) ? fs.readdirSync(thu).sort() : [];
      ghi(`   thư mục: ${ten.join(', ')}`);
      kiem(ten.join() === '0003.mp4,0005.mp4,0009.mp4,0011.mp4,nguon-footage.txt', 'đủ 4 file đặt tên theo số cảnh + nguon-footage.txt');
      kiem(['0003', '0005', '0009', '0011'].every((c) => fs.existsSync(path.join(thu, `${c}.mp4`)) && fs.statSync(path.join(thu, `${c}.mp4`)).size === videoMau), 'file là clip tải về đủ byte');
      kiem(!ten.some((f) => f.endsWith('.part')), 'không còn file .part');
      const clip = Object.fromEntries(footage.ds.canh.map((x) => [x.canh, x.clip && x.clip.id]));
      kiem(JSON.stringify(clip) === JSON.stringify({ '0003': 'pexels-101', '0005': 'pixabay-201', '0009': 'pexels-301', '0011': 'pexels-401' }), `đúng clip từng cảnh, cảnh 9 không lấy lại clip của cảnh 3 (${JSON.stringify(clip)})`);
      const api1 = await ghiApi();
      kiem(api1.tai.includes('px101-1080') && !api1.tai.some((t) => /720|doc/.test(t)), 'tải bản 1080p ngang (không lấy 720p / dọc)');
      kiem(api1.goi.filter((g) => g.nguon === 'pexels').every((g) => g.auth === 'KHOA-PEXELS-E2E'), 'gọi Pexels với khoá ở Authorization');
      kiem(api1.goi.some((g) => g.nguon === 'pixabay' && /night sky/.test(g.q)), 'cảnh ghi nguon=pixabay tìm Pixabay');
      await cho(() => js("/Đã có 4\\/4/.test(document.querySelector('#ftTomTat').textContent)"), 5000, 'tóm tắt Đã có 4/4');
      kiem(await js("document.querySelector('#ftTomTat code').textContent") === '3, 5, 9, 11', 'dòng "Cảnh dùng footage" để dán vào Chọn số');
      kiem(await js("document.querySelectorAll('#ftBang .ft-dong.tt-xong').length === 4 && document.querySelectorAll('#ftBang .ft-clip img').length === 4"), '4 dòng Đã có, mỗi dòng có ảnh nhỏ của clip');
      kiem(/^0003\tPexels\tPexels 101\thttps:\/\/www\.pexels\.com\/video\/desert-dunes-101\//m.test(fs.readFileSync(path.join(thu, 'nguon-footage.txt'), 'utf8')), 'nguon-footage.txt ghi cảnh, nguồn, tác giả, link');
      await chup('footage-1440.png');

      ghi('-- 3. Đổi clip cảnh 3 (bấm nút trên dòng)');
      await bam('#ftBang [data-ft="doi"][data-so="3"]');
      await cho(() => canh(3).clip && canh(3).clip.id === 'pexels-103', 15000, 'đổi clip cảnh 3');
      kiem(canh(3).clip.id === 'pexels-103', 'cảnh 3 sang clip kế tiếp hợp lệ (bỏ clip có "people")');
      kiem((await ghiApi()).tai.includes('px103-1080') && fs.statSync(path.join(thu, '0003.mp4')).size === videoMau, 'file 0003.mp4 được thay');

      ghi('-- 4. Bỏ cảnh 9, Lấy lại');
      await bam('#ftBang [data-ft="bo"][data-so="9"]');
      await cho(() => canh(9).trangThai === 'bo', 5000, 'bỏ cảnh 9');
      kiem(!fs.existsSync(path.join(thu, '0009.mp4')) && fs.existsSync(path.join(thu, '_bo', '0009.mp4')), '0009.mp4 chuyển vào _bo (CapCut không còn thấy)');
      await cho(() => js("document.querySelector('#ftTomTat code') && document.querySelector('#ftTomTat code').textContent === '3, 5, 11'"), 5000, 'dòng số cảnh bớt cảnh 9');
      kiem(await js("document.querySelector('#ftTomTat code').textContent") === '3, 5, 11', 'Cảnh dùng footage: 3, 5, 11');
      await bam('#ftBang [data-ft="layLai"][data-so="9"]');
      await cho(() => canh(9).trangThai === 'xong', 5000, 'lấy lại cảnh 9');
      kiem(fs.existsSync(path.join(thu, '0009.mp4')), 'lấy lại: 0009.mp4 về chỗ cũ');

      ghi('-- 5. Pexels hết lượt (429) → Pixabay; tải clip hỏng → Lỗi có lý do; Tải lại');
      const tep2 = path.join(tam, 'Ban_2_footage.csv');
      fs.writeFileSync(tep2, 'scene,tu_khoa,giay_can,tranh\n20,sand dunes wind,7,city\n22,olive tree,6,\n');
      await cauHinh({ pexels429: true, hongTai: ['px401-1080'] });
      // 1.6.5: file mới mở trong dự án có Drive (chép vào thư mục Drive trên máy) → <Drive>/<Tên dự án>/Videos, tự tạo.
      const drive = path.join(tam, 'GDrive');
      fs.mkdirSync(drive, { recursive: true });
      const da = dieuPhoi.duAn[0];
      LENH.datCaiDat({ duAn: da.id, driveBat: true, driveCach: 'may', thuMucDrive: drive });
      LENH.footageNapTep({ tep: tep2, duAn: da.id });
      const thu2 = footage.ds.thuMuc;
      kiem(thu2 === require('../src/main/drive').thuMucDich(drive, da.ten, 'video') && /Videos$/.test(thu2), `thư mục mặc định = Videos của dự án trên Drive (${thu2})`);
      kiem(await cho(() => js("document.querySelector('#ftThuMuc').value") .then((v) => v === thu2), 5000, 'ô thư mục hiện Videos của dự án') !== false, 'giao diện hiện thư mục Videos của dự án');
      kiem(await js("/dự án/.test(document.querySelector('#ftTenDs').textContent)"), 'tên dự án hiện cạnh danh sách');
      await taiVaCho('lần 2');
      kiem(canh(20).trangThai === 'xong' && canh(20).clip.id === 'pixabay-501', `cảnh 20 lấy Pixabay khi Pexels hết lượt, bỏ clip có "city" (${canh(20).clip && canh(20).clip.id})`);
      kiem(canh(22).trangThai === 'loi' && /không có clip khớp từ khoá/.test(canh(22).loi), `cảnh 22 lỗi có lý do (${canh(22).loi})`);
      kiem((await ghiApi()).goi.filter((g) => g.nguon === 'pexels' && ['sand dunes wind', 'olive tree'].includes(g.q)).length === 1, 'Pexels hết lượt chỉ bị gọi một lần');
      await cho(() => js("/Lỗi 1/.test(document.querySelector('#ftTomTat').textContent) && document.querySelector('#ftBang .tt-loi small.do')"), 5000, 'giao diện hiện Lỗi');
      kiem(await js("!!document.querySelector('#ftBang .tt-loi small.do')"), 'dòng lỗi hiện lý do');
      // Hết lượt hết hạn (giả: xoá mốc) + Pexels có lại, nhưng clip tải hỏng (404).
      footage.hetLuot = {};
      await cauHinh({ pexels429: false });
      await taiVaCho('lần 3');
      kiem(canh(22).trangThai === 'loi' && /tải clip lỗi 404/.test(canh(22).loi), `tải clip hỏng → Lỗi "tải clip lỗi 404" (${canh(22).loi})`);
      kiem(!fs.existsSync(path.join(thu2, '0022.mp4')) && !fs.existsSync(path.join(thu2, '0022.mp4.part')), 'tải hỏng không để lại file dở');
      await cauHinh({ hongTai: [] });
      await taiVaCho('lần 4');
      kiem(canh(22).trangThai === 'xong' && fs.existsSync(path.join(thu2, '0022.mp4')), 'Tải footage lần nữa: cảnh lỗi tải lại được');
      kiem(fs.existsSync(path.join(drive, require('../src/main/drive').tenThuMucDuAn(da.ten), 'Videos', '0022.mp4')), '1.6.5: clip nằm trong <Drive>/<Tên dự án>/Videos (thư mục tự tạo)');
      footage.datThuMuc(path.join(tam, 'khac'));
      await bam('#ftThuMucDuAn');
      await cho(() => footage.ds.thuMuc === thu2, 5000, 'nút Videos của dự án');
      kiem(footage.ds.thuMuc === thu2, 'nút "Videos của dự án" đặt lại thư mục lưu');
      LENH.datCaiDat({ duAn: da.id, driveBat: false });

      ghi('-- 5b. 1.6.2 Tìm lại tất cả (nút trên giao diện): clip cũ sang _bo, tải lại theo chấm khớp mới');
      const truocTL = footage.luotXong;
      await bam('#ftTimLai');
      await cho(() => js("!document.querySelector('#phu').hidden && /Tìm lại footage/.test(document.querySelector('#hopTieuDe').textContent)"), 5000, 'hộp xác nhận Tìm lại');
      kiem(await bam('#hopOk'), 'xác nhận Tìm lại');
      await cho(() => footage.luotXong > truocTL, 60000, 'tìm lại xong');
      kiem(fs.existsSync(path.join(thu2, '_bo', '0020.mp4')) && fs.existsSync(path.join(thu2, '0020.mp4')) && canh(20).clip && /^(pexels-103|pixabay-501)$/.test(canh(20).clip.id), `Tìm lại: clip cũ vào _bo, cảnh 20 tải lại clip khớp (${canh(20).clip && canh(20).clip.id})`);
      ghi('-- 6. Danh sách lưu trong dữ liệu app (mở lại app còn)');
      kiem(footage.store.data.footageDs && footage.store.data.footageDs.tep === tep2 && footage.store.data.footage.pexelsKey === 'KHOA-PEXELS-E2E', 'danh sách + khoá nằm trong du-lieu.json');
      footage.napTep(tep);
      kiem(canh(3).clip && canh(3).clip.id === 'pexels-103' && footage.ds.thuMuc === thu, 'mở lại file cũ: giữ clip đã chọn + thư mục lưu');
      if (process.env.FT_ANH) {
        win.setSize(1100, 700);
        await chup('footage-1100.png');
        await js("document.querySelector('#ftTomTat').scrollIntoView()");
        await chup('footage-1100-ds.png');
      }
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
