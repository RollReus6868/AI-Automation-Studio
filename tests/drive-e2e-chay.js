'use strict';
// Kịch bản đầu-cuối GOOGLE DRIVE (1.4.0, cách "tải thẳng lên drive.google.com"), chạy BÊN TRONG app thật (MUSE_TEST).
// Chạy bằng: node tests/e2e.js drive. Trang Drive là bản GIẢ (tests/fixture-drive.html): bài này kiểm phần của APP
// (mở Drive bằng phiên tài khoản Drive, tìm / tạo thư mục <Tên dự án>/images | Videos, Mới → Tải tệp lên qua hộp chọn
// file bị chặn, Thay thế khi Tạo lại, Giữ cả hai khi trùng tên file của việc khác, nhớ mã thư mục, thư mục bị xoá thì
// tạo lại, Drive đòi đăng nhập → báo rõ), KHÔNG kiểm được giao diện drive.google.com thật.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eDrive({ win, app, LENH, dieuPhoi, taiKhoan }) {
  const tam = process.env.MUSE_E2E_TAM;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (dk()) return true; await ngu(250); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const U = process.env.MUSE_URL;
  const ttDrive = async () => (await net.fetch(`${U}/__drive-trang-thai`)).json();
  const cauHinh = (o) => net.fetch(`${U}/__drive-cau-hinh`, { method: 'POST', body: JSON.stringify(o) });
  const dongNhatKy = (tu) => { for (const d of LENH.trangThai().nhatKy.slice(tu)) ghi(`   | ${d.chu}`); };
  const thuMuc = (tt, ten, cha) => Object.entries(tt.thuMuc).filter(([, f]) => f.ten === ten && f.cha === cha).map(([id]) => id);
  const tepTrong = (tt, cha) => tt.tep.filter((t) => t.cha === cha);

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Google Drive (tải thẳng lên, trang Drive giả) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: U, name: 'muse_login', value: '1' });
      const tkDrive = await LENH.themTaiKhoan({ ten: 'Drive chính', nen: 'drive' });
      kiem(tkDrive.nen === 'drive' && tkDrive.partition === `persist:drive-${tkDrive.id}`, 'thêm tài khoản Drive (phiên riêng persist:drive-…)');
      const kq = await LENH.kiemTaiKhoan({ id: tkDrive.id });
      kiem(kq === 'da-dang-nhap', 'Kiểm tra tài khoản Drive → đã đăng nhập');
      const ra = path.join(tam, 'ra');
      const d = LENH.taoDuAn({ ten: 'Tập 1: Biển', taiKhoan: ['tk-1'] });
      const c = { luongMoiTK: 2, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0, tuThuLaiSuno: 0, tuChayLaiLoiSuno: 0, nghiSuno: 0, thuMucAnh: ra, thuMucVideo: ra,
        driveBat: true, driveCach: 'web', driveTk: tkDrive.id };
      LENH.datCaiDat({ duAn: d.id, ...c });
      kiem(dieuPhoi.cd(d.id).driveCach === 'web' && dieuPhoi.cd(d.id).driveTk === tkDrive.id, 'cài đặt dự án: cách "tải thẳng lên", tài khoản Drive');
      kiem(dieuPhoi.cd(d.id).taiAnh === false && dieuPhoi.cd(d.id).taiVideo === false, '1.4.1: bật Drive → tự tắt "Tải ảnh về" / "Tải video về"');

      ghi('-- 1. Ảnh xong → tự tải lên Drive/<Tên dự án>/images');
      let tu = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: d.id, loai: 'anh', tyLe: '1:1', prompts: ['mèo cam số 1', 'mèo cam số 2'], chay: false });
      const anh = dieuPhoi.viec.filter((j) => j.duAn === d.id && j.loai === 'anh');
      LENH.chay({ duAn: d.id });
      await cho(() => anh.every((j) => j.trangThai === 'xong'), 90000, '2 ảnh xong');
      await cho(() => anh.every((j) => (j.drive || []).length || j.driveLoi), 90000, '2 ảnh lên Drive');
      const tt = await ttDrive();
      const [idDa] = thuMuc(tt, 'Tập 1 Biển', 'root');
      const [idAnh] = idDa ? thuMuc(tt, 'images', idDa) : [];
      kiem(!!idDa && !!idAnh, `Drive có "Tập 1 Biển/images" (tên dự án bỏ ký tự cấm) — ${JSON.stringify(tt.thuMuc)}`);
      const tepAnh = idAnh ? tepTrong(tt, idAnh) : [];
      kiem(tepAnh.map((t) => t.ten).sort().join(',') === '001.png,002.png', `images có 001.png, 002.png — ${tepAnh.map((t) => t.ten)}`);
      kiem(tepAnh.length === 2 && tepAnh.every((t) => {
        const j = anh.find((x) => path.basename(x.files[0]) === t.ten);
        return j && fs.readFileSync(j.files[0]).toString('base64') === t.b64;
      }), 'nội dung file trên Drive đúng file ảnh trên máy');
      kiem(anh.every((j) => j.drive && j.drive[0] === `Drive: Tập 1 Biển/images/${path.basename(j.files[0])}`), `việc nhớ chỗ trên Drive — ${anh.map((j) => j.drive || j.driveLoi)}`);
      kiem(anh.every((j) => path.dirname(j.files[0]) === path.join(app.getPath('userData'), 'ket-qua-tam', d.id)), `file giữ ở thư mục tạm RIÊNG của dự án — ${anh.map((j) => j.files[0])}`);
      kiem(tt.tai.every((x) => !x.cach), 'không hỏi trùng tên ở lần đầu');
      kiem(tt.tai.every((x) => x.qua === 'hop'), `file vào trang qua Mới → Tải tệp lên (hộp chọn file bị app chặn) — ${tt.tai.map((x) => x.qua)}`);
      dongNhatKy(tu);

      ghi('-- 2. Tạo lại ảnh #1 → THAY THẾ file Drive cũ của chính nó (không thêm bản thứ hai)');
      tu = LENH.trangThai().nhatKy.length;
      const j1 = anh.find((j) => j.stt === 1) || anh[0];
      LENH.taoLai({ ids: [j1.id], chay: true });
      await cho(() => j1.trangThai === 'xong', 60000, 'ảnh #1 tạo lại xong');
      let t2 = await ttDrive();
      for (let i = 0; i < 120 && t2.tai.length < 3; i++) { await ngu(500); t2 = await ttDrive(); }
      kiem(t2.tai.length === 3 && t2.tai[2].cach === 'thay', `lần tải thứ 3 chọn "Thay thế tệp hiện có" — ${JSON.stringify(t2.tai.slice(2))}`);
      kiem(tepTrong(t2, idAnh).length === 2, 'images vẫn 2 file');
      dongNhatKy(tu);

      ghi('-- 3. Video xong → Videos (dùng lại thư mục dự án đã nhớ, không tạo trùng)');
      tu = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: d.id, loai: 'video', tyLe: '9:16', prompts: ['chó corgi chạy trên bãi biển'], chay: true });
      const v = dieuPhoi.viec.find((j) => j.duAn === d.id && j.loai === 'video');
      await cho(() => v.trangThai === 'xong' || v.trangThai === 'loi', 90000, 'video xong');
      await cho(() => (v.drive || []).length || v.driveLoi, 90000, 'video lên Drive');
      let t3 = await ttDrive();
      const [idVid] = thuMuc(t3, 'Videos', idDa);
      kiem(!!idVid && tepTrong(t3, idVid).length === 1 && /\.mp4$/.test(tepTrong(t3, idVid)[0].ten), `Drive có "Tập 1 Biển/Videos/<video>.mp4" — ${v.drive || v.driveLoi}`);
      kiem(thuMuc(t3, 'Tập 1 Biển', 'root').length === 1, 'thư mục dự án không bị tạo hai lần');
      dongNhatKy(tu);

      ghi('-- 4. Việc khác trùng tên file → GIỮ CẢ HAI; thư mục images bị xoá trên Drive → tự tạo lại');
      tu = LENH.trangThai().nhatKy.length;
      const j2 = anh.find((j) => j !== j1);
      j2.drive = [];                      // như một việc khác có cùng tên file
      const r4 = LENH.lenDriveViec({ ids: [j2.id] });
      kiem(r4.ok && r4.so === 1, 'nút "Lên Drive" nhận việc đã xong');
      let t4 = await ttDrive();
      for (let i = 0; i < 120 && t4.tai.length < 5; i++) { await ngu(500); t4 = await ttDrive(); }
      kiem(t4.tai[4] && t4.tai[4].cach === 'giu' && tepTrong(t4, idAnh).length === 3, `trùng tên của việc khác → "Giữ cả hai tệp" — ${JSON.stringify(t4.tai.slice(4))}`);
      await cauHinh({ xoaThuMuc: idAnh });
      LENH.lenDriveViec({ ids: [j2.id] });
      let t5 = await ttDrive();
      for (let i = 0; i < 120 && t5.tai.length < 6; i++) { await ngu(500); t5 = await ttDrive(); }
      const idAnhMoi = thuMuc(t5, 'images', idDa)[0];
      kiem(idAnhMoi && idAnhMoi !== idAnh && tepTrong(t5, idAnhMoi).length === 1, 'mã thư mục đã nhớ không còn → tạo lại images, tải lên đó');
      dongNhatKy(tu);

      ghi('-- 5. Drive đòi đăng nhập → báo rõ, tài khoản Drive thành "chưa đăng nhập", việc vẫn Xong');
      tu = LENH.trangThai().nhatKy.length;
      await cauHinh({ canDangNhap: true });
      j1.driveLoi = '';
      LENH.lenDriveViec({ ids: [j1.id] });
      await cho(() => /chưa đăng nhập/.test(j1.driveLoi || ''), 60000, 'báo chưa đăng nhập');
      kiem(/Tài khoản Drive "Drive chính" chưa đăng nhập/.test(j1.driveLoi || ''), `lỗi ghi rõ — ${j1.driveLoi}`);
      kiem(taiKhoan.tim(tkDrive.id).trangThai === 'can-dang-nhap' && j1.trangThai === 'xong', 'tài khoản Drive đánh dấu chưa đăng nhập; việc vẫn Xong');
      kiem(LENH.trangThai().nhatKy.slice(tu).some((x) => /☁ #\d+ chưa đưa lên Google Drive: Tài khoản Drive/.test(x.chu)), 'nhật ký báo chưa đưa lên Drive');
      await cauHinh({ canDangNhap: false });
      dongNhatKy(tu);

      ghi('-- 6. Tài khoản Drive không nhận việc tạo ảnh / video, không hiện ở hộp tài khoản dự án');
      kiem(!dieuPhoi.viec.some((j) => j.taiKhoan === tkDrive.id), 'không việc nào chạy ở tài khoản Drive');
      kiem(!dieuPhoi._dsTkGoc(d.id, 'muse').includes(tkDrive.id) && !dieuPhoi._dsTkGoc(d.id, 'flow').includes(tkDrive.id), 'tài khoản Drive không thuộc danh sách Muse / Flow');

      ghi('-- 7. 1.4.1: dự án thứ hai, thư mục máy đã có 001.png → máy "001 (2).png" nhưng Drive vẫn "001.png"');
      tu = LENH.trangThai().nhatKy.length;
      const raChung = path.join(tam, 'ra-chung');
      fs.mkdirSync(raChung, { recursive: true });
      fs.writeFileSync(path.join(raChung, '001.png'), 'cua du an khac');
      const d2 = LENH.taoDuAn({ ten: 'Tập 2', taiKhoan: ['tk-1'] });
      LENH.datCaiDat({ duAn: d2.id, ...c, thuMucAnh: raChung, thuMucVideo: raChung });
      LENH.datCaiDat({ duAn: d2.id, taiAnh: true });   // người dùng bật lại tải về tay
      LENH.them({ duAn: d2.id, loai: 'anh', tyLe: '1:1', prompts: ['mèo xám'], chay: true });
      const a7 = dieuPhoi.viec.find((j) => j.duAn === d2.id);
      await cho(() => a7.trangThai === 'xong', 60000, 'ảnh dự án 2 xong');
      await cho(() => (a7.drive || []).length || a7.driveLoi, 90000, 'ảnh dự án 2 lên Drive');
      const t7 = await ttDrive();
      const [idDa2] = thuMuc(t7, 'Tập 2', 'root');
      const [idAnh2] = idDa2 ? thuMuc(t7, 'images', idDa2) : [];
      kiem(a7.files[0] === path.join(raChung, '001 (2).png'), `máy: không ghi đè file sẵn có (${a7.files[0]})`);
      kiem(idAnh2 && tepTrong(t7, idAnh2).map((t) => t.ten).join() === '001.png', `Drive "Tập 2/images" có đúng 001.png — ${idAnh2 && tepTrong(t7, idAnh2).map((t) => t.ten)}`);
      kiem(a7.drive && a7.drive[0] === 'Drive: Tập 2/images/001.png', `việc nhớ tên Drive đúng — ${a7.drive || a7.driveLoi}`);
      const tep7 = idAnh2 && tepTrong(t7, idAnh2)[0];
      kiem(tep7 && tep7.b64 === fs.readFileSync(a7.files[0]).toString('base64'), 'nội dung trên Drive là ảnh của dự án 2');
      const dem = path.join(app.getPath('userData'), 'drive-tam');
      kiem(!fs.existsSync(dem) || fs.readdirSync(dem).length === 0, 'bản chép tạm để đổi tên đã được xoá');
      dongNhatKy(tu);
    } catch (err) {
      ghi(`LỖI: ${err.stack}`);
      loi.push(err.message);
    }
    ghi(loi.length ? `KẾT QUẢ: HỎNG ${loi.length} — ${loi.join(' | ')}` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
