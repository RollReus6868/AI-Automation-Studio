'use strict';
// 1.8.0 — Kịch bản đầu-cuối DASHBOARD (node tests/e2e.js dashboard), chạy BÊN TRONG app thật, bấm qua giao diện:
// dự án tổng giống TBN_16 (prompt ảnh / animation / thumbnail .txt, _motion.csv, _footage.csv; ảnh 1 có sẵn) →
// Dashboard nhận file, gắn dự án của app cùng tên → tắt mục Nhạc → gạt Chạy tất cả: ảnh thiếu (Muse giả) + video từ ảnh
// (bỏ cảnh motion / footage), thumbnail (dự án phụ), footage (API Pexels giả), motion (Remotion thật, chờ ảnh của cảnh)
// → lượt tự đóng khi mọi mục xong, báo cáo ghi từng mục; hẹn giờ Chạy tất cả thêm / lưu qua giao diện.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eDashboard({ win, app, LENH, dieuPhoi, dashboard, footage, motion }) {
  const tam = process.env.MUSE_E2E_TAM;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (await dk()) return true; await ngu(300); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const js = (ma) => win.webContents.executeJavaScript(ma);
  const daGui = async () => (await net.fetch(`${process.env.MUSE_URL}/__da-gui`)).json();
  const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Dashboard (trang Muse giả, API footage giả, Remotion thật) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1' });
      LENH.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0, tuThuLaiNhac: 0, tuChayLaiLoiNhac: 0, nghiNhac: 0 });
      footage.datCaiDat({ pexelsKey: 'KHOA-PEXELS-E2E', pixabayKey: 'KHOA-PIXABAY-E2E' });
      motion.datCaiDat({ rong: 1280, fps: 24, duoi: 0.5 });

      // Dự án tổng giống thư mục người dùng: cảnh 1 = footage, cảnh 3 = motion, ảnh 1 có sẵn
      const goc = path.join(tam, 'Kenh', 'TBN_E2E');
      for (const d of ['images', 'Videos', 'BGM']) fs.mkdirSync(path.join(goc, d), { recursive: true });
      const n = 'loi-thoai_Prueba';
      fs.writeFileSync(path.join(goc, `${n} - prompt anh.txt`), 'bảng điều khiển ảnh 1\n\nbảng điều khiển ảnh 2\n\nbảng điều khiển ảnh 3\n');
      fs.writeFileSync(path.join(goc, `${n} - prompt animation.txt`), 'chuyển động 1\nchuyển động 2\nchuyển động 3\n');
      fs.writeFileSync(path.join(goc, `${n} - nhac flowmusic.txt`), 'nhạc nền 1\n');
      fs.writeFileSync(path.join(goc, `${n} - thumbnail.txt`), 'ảnh bìa video\n');
      fs.writeFileSync(path.join(goc, `${n}_motion.csv`), 'scene,mau,nhan,tieu_de,noi_dung,phu,goc,giay\n3,CAU_KINH,,,Ve y lávate *siete veces*,2 Reyes 5:10,,3\n');
      fs.writeFileSync(path.join(goc, `${n}_footage.csv`), 'scene,che_do,nguon,tu_khoa,giay_can\n0001,thay,pexels,desert dunes aerial,7\n');
      fs.writeFileSync(path.join(goc, 'images', '001.png'), PNG1);
      fs.mkdirSync(path.join(tam, 'Kenh', 'TBN_E2E_2'));
      fs.writeFileSync(path.join(tam, 'Kenh', 'TBN_E2E_2', 'x - prompt anh.txt'), 'thư mục video thứ hai\n');

      ghi('-- 1. Trang Dashboard, chọn thư mục cha → hai dự án tổng');
      await cho(() => js('!!window.__diToi'), 15000, 'giao diện sẵn sàng');
      await js("window.__diToi('dashboard')");
      kiem(await js("!document.querySelector('#trang-dashboard').hidden && document.querySelector('#nav [data-trang=dashboard]').classList.contains('on') && !document.querySelector('#nav [data-trang=hengio]')"),
        'trang Dashboard hiện, thanh trái không còn mục Hẹn giờ riêng');
      kiem(await js("document.querySelector('#dbChay').disabled && /Chọn thư mục/.test(document.querySelector('#dbMuc').textContent)"), 'chưa chọn: công tắc Chạy tất cả tắt, có hướng dẫn');
      const r = LENH.dashDatGoc({ goc: path.join(tam, 'Kenh') });   // (nút "Chọn thư mục…" mở hộp chọn thư mục của hệ điều hành)
      kiem(r.ok && r.them === 2, `thư mục cha: thêm 2 dự án tổng (${JSON.stringify(r)})`);
      await cho(() => js("document.querySelectorAll('#dbDsGoc option').length === 2"), 5000, 'danh sách dự án tổng');
      kiem(await js(`document.querySelector('#dbDsGoc').value === ${JSON.stringify(goc)}`), 'mở dự án tổng đầu tiên (TBN_E2E)');
      const id = dashboard.trangThai().duAn;
      const da = LENH.trangThai().duAn.find((d) => d.id === id);
      kiem(da && da.ten === 'TBN_E2E' && path.resolve(dieuPhoi.cd(id).thuMucAnh) === path.resolve(goc, 'images'), 'dự án của app "TBN_E2E", ảnh lưu vào images của dự án tổng');
      await cho(() => js("document.querySelectorAll('#dbMuc .db-muc').length === 6"), 5000, '6 thẻ mục');
      const the = await js("[...document.querySelectorAll('#dbMuc .db-muc')].map((x) => x.dataset.k + ':' + x.querySelector('.db-so').textContent.trim()).join(' | ')");
      ghi(`   ${the}`);
      kiem(/anh:1\/3/.test(the) && /video:0\/1/.test(the) && /nhac:0\/1/.test(the) && /motion:0\/1/.test(the) && /footage:0\/1/.test(the) && /thumbnail:0\/1/.test(the),
        'thẻ mục: ảnh 1/3, video 0/1 (bỏ cảnh motion 3 + footage 1), nhạc, motion, footage, thumbnail');

      ghi('-- 2. Tắt mục Nhạc bằng công tắc của thẻ, gạt Chạy tất cả');
      await js("(() => { const c = document.querySelector('#dbMuc [data-db=bat][data-k=nhac]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })()");
      await cho(() => !dashboard.duLieu.muc.nhac.bat, 5000, 'tắt nhạc');
      kiem(!dashboard.duLieu.muc.nhac.bat, 'mục Nhạc tắt (lưu vào app)');
      const gui0 = (await daGui()).length;
      await js("(() => { const c = document.querySelector('#dbChay'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); })()");
      await cho(() => !!dashboard.duLieu.dang, 5000, 'bắt đầu lượt');
      kiem(!!dashboard.duLieu.dang, 'gạt Chạy tất cả → lượt bắt đầu');
      await cho(() => js("/Đang chạy/.test(document.querySelector('#dbTrangThai').textContent)"), 5000, 'giao diện báo đang chạy');
      const xongLuot = await cho(() => !dashboard.duLieu.dang, 480000, 'lượt chạy xong');
      kiem(xongLuot, 'mọi mục xong → lượt tự đóng');

      ghi('-- 3. Kết quả trong thư mục dự án tổng');
      const anh = fs.readdirSync(path.join(goc, 'images')).sort(), vid = fs.readdirSync(path.join(goc, 'Videos')).sort();
      const thumbDir = path.join(goc, 'thumbnail');
      const thumb = fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir) : [];
      ghi(`   images: ${anh.join(', ')} · Videos: ${vid.join(', ')} · thumbnail: ${thumb.join(', ')}`);
      kiem(['001', '002', '003'].every((s) => anh.some((f) => f.startsWith(s + '.'))), 'ảnh 2, 3 mới (ảnh 1 có sẵn không tạo lại)');
      kiem(vid.includes('002.mp4') && !vid.includes('001.mp4') && !vid.includes('003.mp4'), 'video AI chỉ cho cảnh 2 (cảnh 1 footage, cảnh 3 motion)');
      kiem(vid.includes('0001.mp4'), 'footage cảnh 1 → Videos/0001.mp4');
      kiem(vid.includes('0003.mp4'), 'motion cảnh 3 vẽ sau khi ảnh 3 về → Videos/0003.mp4');
      kiem(thumb.length === 1 && /^001\./.test(thumb[0]), 'thumbnail → thumbnail/001.*');
      kiem(!fs.readdirSync(path.join(goc, 'BGM')).length, 'mục Nhạc tắt → không tạo nhạc');
      const gui = (await daGui()).slice(gui0).map((g) => String(g.prompt || ''));
      ghi(`   Muse nhận ${gui.length} lần gửi`);
      kiem(!gui.some((x) => /bảng điều khiển ảnh 1/.test(x)) && gui.filter((x) => /bảng điều khiển ảnh [23]/.test(x)).length === 2, 'Muse chỉ nhận prompt ảnh 2, 3');
      kiem(gui.some((x) => /chuyển động 2/.test(x)) && !gui.some((x) => /chuyển động [13]/.test(x)), 'video dùng đúng dòng 2 của file animation, không gửi dòng 1, 3');
      kiem(gui.some((x) => /ảnh bìa video/.test(x)), 'thumbnail gửi Muse');

      ghi('-- 4. Báo cáo lượt');
      const st = dashboard.trangThai();
      const l = st.luot[0] || {};
      ghi(`   ${JSON.stringify({ ketQua: l.ketQua, giay: l.giay, loi: l.loi, muc: Object.fromEntries(Object.entries(l.muc || {}).map(([k, x]) => [k, `${x.xong}/${x.tong}+${x.xongThem} ${x.loi}l`])) })}`);
      kiem(l.ketQua === 'xong' && l.loi === 0 && l.muc && l.muc.anh.xong === 3 && l.muc.anh.xongThem === 2 && l.muc.video.xong === 1 && l.muc.motion.xong === 1 && l.muc.footage.xong === 1 && l.muc.thumbnail.xong === 1 && !l.muc.nhac,
        'báo cáo: xong, 0 lỗi, ảnh 3/3 (+2), video 1/1, motion 1/1, footage 1/1, thumbnail 1/1, không có mục nhạc');
      await cho(() => js("/Xong/.test(document.querySelector('#dbLuot').textContent) && /Ảnh 3\\/3 \\(\\+2\\)/.test(document.querySelector('#dbLuot').textContent)"), 5000, 'bảng báo cáo');
      kiem(await js("/Xong/.test(document.querySelector('#dbLuot').textContent) && /Ảnh 3\\/3 \\(\\+2\\)/.test(document.querySelector('#dbLuot').textContent)"), 'bảng Báo cáo các lượt chạy hiện lượt vừa xong');
      kiem(await js("!document.querySelector('#dbChay').checked"), 'công tắc Chạy tất cả tự gạt về tắt');

      ghi('-- 5. Hẹn giờ Chạy tất cả qua giao diện');
      await js("document.querySelector('#dbThemHen').click()");
      await js("(() => { const el = document.querySelector('#dbDsHen .hen'); el.querySelector('[data-dh=batDau]').value = '23:15'; el.querySelector('[data-dh=ketThuc]').value = '05:30'; el.querySelector('[data-dh=luu]').click(); })()");
      await cho(() => dashboard.duLieu.hen.length === 1, 5000, 'lưu hẹn');
      const h = dashboard.duLieu.hen[0] || {};
      kiem(h.bat && h.batDau === '23:15' && h.ketThuc === '05:30' && h.goc === goc, `hẹn lưu đúng giờ + dự án tổng (${JSON.stringify(h)})`);
      await cho(() => js("/Lần tới: 23:15/.test(document.querySelector('#dbDsHen').textContent)"), 5000, 'trạng thái hẹn');
      kiem(await js("/Lần tới: 23:15/.test(document.querySelector('#dbDsHen').textContent) && /1 hẹn · 1 đang bật/.test(document.querySelector('#dbHenTong').textContent)"), 'giao diện ghi lần chạy tới');
      kiem(await js("document.querySelectorAll('#khuHenGio .the-hen').length === 3"), 'ba thẻ hẹn giờ từng chức năng nằm trong Dashboard');
      await js("window.__diToi('hengio')");
      kiem(await js("!document.querySelector('#trang-dashboard').hidden"), 'lối cũ tới Hẹn giờ mở Dashboard');
      if (process.env.DB_ANH) {
        fs.mkdirSync(process.env.DB_ANH, { recursive: true });
        await js("document.querySelector('#trang-dashboard .cuon').scrollTop = 0");
        await ngu(500);
        fs.writeFileSync(path.join(process.env.DB_ANH, 'dashboard-xong.png'), (await win.webContents.capturePage()).toPNG());
      }
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
