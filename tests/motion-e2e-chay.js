'use strict';
// 1.7.0 — Kịch bản đầu-cuối MOTION (node tests/e2e.js motion), chạy BÊN TRONG app thật, bấm qua giao diện:
// cài đặt (720p, 24 fps) → mở <tên>_motion.xlsx → Tạo video (Remotion THẬT ở tiến trình con: Electron chạy như Node,
// Chrome Headless Shell tải được thì dùng, không thì Chrome / Edge của máy) → Videos/0003.mp4… đúng độ dài giọng đọc + đệm,
// video AI cũ của cảnh vào _bo, Bỏ / Lấy lại / Tạo lại một cảnh, Dừng giữa chừng giữ video cũ, mở lại file giữ trạng thái.
// MT_ANH=<thư mục> → chụp trang Motion (1440 và 1100 px) để xem bằng mắt.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** PNG một màu (không cần thư viện). */
function taoPng(w, h, [r, g, b]) {
  const bang = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; bang[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = bang[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const khoi = (loai, data) => {
    const dai = Buffer.alloc(4); dai.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(loai, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([dai, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const hang = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; hang[i] = (r + x) & 255; hang[i + 1] = (g + y) & 255; hang[i + 2] = b; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), khoi('IHDR', ihdr), khoi('IDAT', zlib.deflateSync(hang)), khoi('IEND', Buffer.alloc(0))]);
}
/** Số giây của file mp4 (hộp mvhd). */
function giayMp4(tep) {
  const b = fs.readFileSync(tep);
  const i = b.indexOf('mvhd');
  if (i < 0) return 0;
  return b[i + 4] === 1 ? Number(b.readBigUInt64BE(i + 28)) / b.readUInt32BE(i + 24) : b.readUInt32BE(i + 20) / b.readUInt32BE(i + 16);
}

module.exports = function e2eMotion({ win, app, motion }) {
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
  const js = (ma) => win.webContents.executeJavaScript(ma);
  const bam = (sel) => js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  const dat = (sel, v) => js(`(() => { const o = document.querySelector(${JSON.stringify(sel)}); o.value = ${JSON.stringify(v)}; o.dispatchEvent(new Event('change')); return true; })()`);
  const canh = (so) => motion.ds.canh.find((x) => x.so === so);
  const chup = async (ten, rong) => {
    if (!process.env.MT_ANH) return;
    if (rong) { win.setSize(rong, 900); await ngu(600); }
    await ngu(400);
    fs.mkdirSync(process.env.MT_ANH, { recursive: true });
    fs.writeFileSync(path.join(process.env.MT_ANH, ten), (await win.webContents.capturePage()).toPNG());
  };
  const HAN_VE = 420000;   // vẽ thật bằng Chrome: máy CI chậm, lần đầu còn tải Chrome Headless Shell

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Motion (Remotion thật, tiến trình con) ==');
      await cho(() => js('!!window.__diToi'), 15000, 'giao diện sẵn sàng');
      await ngu(800);

      // Dự án mẫu: images (thiếu ảnh cảnh 5), Audio (giọng 2,06 s; cảnh 5 không có → cột giay = 3), Videos có video AI cũ của cảnh 3
      const goc = path.join(tam, 'Du_an');
      for (const d of ['images', 'Audio', 'Videos']) fs.mkdirSync(path.join(goc, d), { recursive: true });
      const mau = { 3: [180, 120, 60], 9: [40, 90, 140], 11: [120, 40, 60], 12: [60, 120, 60] };
      for (const [so, m] of Object.entries(mau)) fs.writeFileSync(path.join(goc, 'images', `${String(so).padStart(3, '0')}.png`), taoPng(320, 180, m));
      for (const so of [3, 9, 11, 12]) fs.copyFileSync(path.join(__dirname, 'fixture-giong.mp3'), path.join(goc, 'Audio', `${String(so).padStart(4, '0')}.mp3`));
      const videoCu = path.join(goc, 'Videos', '0003.mp4');
      fs.copyFileSync(path.join(__dirname, 'fixture-video.mp4'), videoCu);
      const coVideoCu = fs.statSync(videoCu).size;
      const tep = path.join(goc, 'Naaman_motion.xlsx');
      fs.copyFileSync(path.join(__dirname, 'fixture-motion.xlsx'), tep);

      ghi('-- 1. Trang Motion, cài đặt qua giao diện');
      await js("window.__diToi('motion')");
      kiem(await js("!document.querySelector('#trang-motion').hidden && document.querySelector('#nav [data-trang=motion]').classList.contains('on')"), 'trang Motion hiện, nút thanh trái sáng');
      kiem(await js("document.querySelector('#mtChay').disabled && /Chưa mở danh sách/.test(document.querySelector('#mtBang').textContent)"), 'chưa mở danh sách: nút Tạo video tắt, có hướng dẫn');
      kiem(motion.caiDat.fps === 30 && motion.caiDat.rong === 1920 && motion.caiDat.thayVideoCu === true, 'mặc định 1920×1080, 30 fps, thay video đã có');
      await dat('#mtRong', '1280'); await dat('#mtFps', '24'); await dat('#mtDuoi', '1');
      await bam('#mtLuu');
      await cho(() => motion.caiDat.rong === 1280 && motion.caiDat.fps === 24, 5000, 'lưu cài đặt');
      kiem(motion.caiDat.rong === 1280 && motion.caiDat.fps === 24 && motion.caiDat.duoi === 1, 'cài đặt lưu vào app (1280, 24 fps, đệm 1 s)');

      ghi('-- 2. Mở file motion (thư mục dự án = thư mục chứa file)');
      const r = motion.napTep(tep);   // (nút "Mở file motion…" mở hộp chọn file của hệ điều hành — gọi thẳng phần sau hộp chọn)
      kiem(r.ok && r.so === 5 && r.loi.length === 2, `mở 5 cảnh, 2 dòng lỗi bỏ qua (${JSON.stringify(r)})`);
      kiem(path.resolve(motion.ds.goc) === path.resolve(goc) && path.resolve(motion.thuMucRa()) === path.resolve(goc, 'Videos'), 'thư mục dự án = chỗ file, lưu vào Videos của nó');
      await cho(() => js("document.querySelectorAll('#mtBang .mt-dong').length === 5"), 5000, 'vẽ 5 dòng cảnh');
      kiem(await js("document.querySelectorAll('#mtBang .mt-anh img').length") === 4, '4 cảnh có ảnh nền (cảnh 5 chưa có ảnh)');
      kiem(await js("/2 dòng trong file bị bỏ qua/.test(document.querySelector('#mtTomTat').textContent) && /Atlántida/.test(document.querySelector('#mtTomTat').textContent) && /1 cảnh chưa có ảnh/.test(document.querySelector('#mtTomTat').textContent)"), 'tóm tắt: 2 dòng lỗi (ghi rõ lý do), 1 cảnh chưa có ảnh');
      kiem(Math.abs(canh(3).thoiLuong - 2.06) < 0.02 && canh(5).thoiLuong === 0 && canh(5).giay === 3, `đọc độ dài giọng đọc mp3 (${canh(3).thoiLuong} s), cảnh 5 theo cột giay`);
      kiem(await js("/Damasco → Samaria → Río Jordán/.test(document.querySelector('#mtBang').textContent) && /Bản đồ hành trình/.test(document.querySelector('#mtBang').textContent)"), 'dòng cảnh ghi mẫu + tóm tắt nội dung');
      await chup('motion-1440-mo.png', 1440);

      ghi('-- 3. Tạo video (vẽ thật)');
      let truoc = motion.luotXong;
      kiem(await bam('#mtChay'), 'bấm Tạo video');
      await cho(() => js("/Dừng/.test(document.querySelector('#mtChay').textContent)"), 10000, 'nút đổi thành Dừng');
      await cho(() => motion.luotXong > truoc, HAN_VE, 'vẽ xong 5 cảnh');
      ghi(`   trình vẽ: ${motion.trinhDuyet}`);
      const ten = fs.readdirSync(path.join(goc, 'Videos')).sort();
      ghi(`   Videos: ${ten.join(', ')}`);
      kiem(ten.join() === '0003.mp4,0005.mp4,0009.mp4,0011.mp4,0012.mp4,_bo', 'đủ 5 video đặt tên theo số cảnh, không còn file tạm');
      kiem(motion.ds.canh.every((x) => x.trangThai === 'xong'), `mọi cảnh Đã có (${motion.ds.canh.map((x) => `${x.so}:${x.trangThai}${x.loi ? ' ' + x.loi : ''}`).join(' · ')})`);
      kiem(fs.existsSync(path.join(goc, 'Videos', '_bo', '0003.mp4')) && fs.statSync(path.join(goc, 'Videos', '_bo', '0003.mp4')).size === coVideoCu, 'video AI cũ của cảnh 3 chuyển vào _bo (không xoá)');
      const g3 = giayMp4(path.join(goc, 'Videos', '0003.mp4')), g5 = giayMp4(path.join(goc, 'Videos', '0005.mp4'));
      ghi(`   độ dài: cảnh 3 = ${g3.toFixed(3)} s, cảnh 5 = ${g5.toFixed(3)} s`);
      kiem(Math.abs(g3 - 3.08) < 0.1, 'cảnh 3 dài = giọng đọc 2,06 s + đệm 1 s');
      kiem(Math.abs(g5 - 3) < 0.1, 'cảnh 5 (không giọng đọc) dài = cột giay 3 s');
      kiem(fs.statSync(path.join(goc, 'Videos', '0003.mp4')).size > 20000, 'video có nội dung (không rỗng)');
      await cho(() => js("/Cảnh dùng motion: 3, 5, 9, 11-12/.test(document.querySelector('#mtTomTat').textContent)"), 5000, 'chuỗi số cảnh');
      kiem(await js("/Cảnh dùng motion: 3, 5, 9, 11-12/.test(document.querySelector('#mtTomTat').textContent)"), 'tóm tắt "Cảnh dùng motion: 3, 5, 9, 11-12" để dán vào Chọn số');
      await chup('motion-1440-xong.png');
      await js("document.querySelector('#mtTomTat').scrollIntoView()");
      await chup('motion-1440-ds.png');
      await chup('motion-1100-xong.png', 1100);
      await js("document.querySelector('#mtTomTat').scrollIntoView()");
      await chup('motion-1100-ds.png');
      if (process.env.MT_ANH) { win.setSize(1440, 900); await ngu(400); }

      ghi('-- 4. Bỏ / Lấy lại / Tạo lại một cảnh');
      kiem(await bam('#mtBang [data-mt=bo][data-so="9"]'), 'bấm Bỏ cảnh 9');
      await cho(() => canh(9).trangThai === 'bo', 5000, 'cảnh 9 Đã bỏ');
      kiem(canh(9).trangThai === 'bo' && !fs.existsSync(path.join(goc, 'Videos', '0009.mp4')) && fs.existsSync(path.join(goc, 'Videos', '_bo', '0009.mp4')), 'Bỏ: video cảnh 9 vào _bo');
      await cho(() => js("!!document.querySelector('#mtBang [data-mt=layLai][data-so=\"9\"]')"), 5000, 'nút Lấy lại');
      kiem(await bam('#mtBang [data-mt=layLai][data-so="9"]'), 'bấm Lấy lại');
      await cho(() => canh(9).trangThai === 'cho', 5000, 'cảnh 9 về Chờ');
      await cho(() => js("!!document.querySelector('#mtBang [data-mt=lamLai][data-so=\"9\"]')"), 5000, 'nút Tạo');
      truoc = motion.luotXong;
      kiem(await bam('#mtBang [data-mt=lamLai][data-so="9"]'), 'bấm Tạo ở dòng cảnh 9');
      await cho(() => motion.luotXong > truoc, HAN_VE, 'vẽ lại cảnh 9');
      kiem(canh(9).trangThai === 'xong' && fs.existsSync(path.join(goc, 'Videos', '0009.mp4')), 'cảnh 9 có lại video');

      ghi('-- 5. Dừng giữa chừng: video cũ giữ nguyên');
      const truocDung = fs.statSync(path.join(goc, 'Videos', '0003.mp4')).mtimeMs;
      truoc = motion.luotXong;
      await cho(() => js("!!document.querySelector('#mtBang [data-mt=lamLai][data-so=\"3\"]:not([disabled])')"), 5000, 'nút Tạo lại cảnh 3');
      kiem(await bam('#mtBang [data-mt=lamLai][data-so="3"]'), 'bấm Tạo lại cảnh 3');
      await cho(() => canh(3).trangThai === 'dang' && canh(3).tienDo > 0.05, 120000, 'cảnh 3 đang vẽ');
      kiem(await bam('#mtChay'), 'bấm Dừng');
      await cho(() => motion.luotXong > truoc, 30000, 'dừng xong');
      kiem(!motion.dangChay && canh(3).trangThai === 'xong', `dừng: cảnh 3 vẫn Đã có video cũ (${canh(3).trangThai})`);
      kiem(fs.statSync(path.join(goc, 'Videos', '0003.mp4')).mtimeMs === truocDung, 'file video cũ của cảnh 3 không bị đụng');
      kiem(!fs.readdirSync(path.join(goc, 'Videos')).some((f) => /motion-tam/.test(f)), 'không còn file tạm');

      ghi('-- 6. Mở lại đúng file → giữ trạng thái');
      motion.xoaDs();
      const r2 = motion.napTep(tep);
      kiem(r2.ok && motion.ds.canh.filter((x) => x.trangThai === 'xong').length === 5, 'mở lại file: 5 cảnh vẫn Đã có');

    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
