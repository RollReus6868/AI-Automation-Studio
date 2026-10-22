'use strict';
// 1.4.2 — Kịch bản đầu-cuối QUÉT THƯ MỤC (node tests/e2e.js quet), chạy BÊN TRONG app thật trên trang Muse giả:
// lần chạy trước dừng giữa chừng / mất lịch sử, thư mục lưu còn một phần file → bật "Bỏ qua số đã có file trong thư mục"
// thì chỉ gửi Muse số còn thiếu (và chỉ video cho ảnh đã có), không tạo lại file đã có.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eQuet({ win, app, LENH, dieuPhoi }) {
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
  const viec = () => dieuPhoi.viec;
  const daGui = async () => (await net.fetch(`${process.env.MUSE_URL}/__da-gui`)).json();
  const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Quét thư mục (trang Muse giả) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1' });
      LENH.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0 });

      // 18) 1.4.2: lần chạy trước dừng giữa chừng / mất lịch sử, thư mục đã có 001, 002, 004 (+ 002.mp4) → bật "Bỏ qua số
      //     đã có file" thì chỉ gửi Muse số còn thiếu: ảnh 003, 005 (kèm video), và CHỈ video 001, 004 từ ảnh có sẵn.
      ghi('-- 18. Quét thư mục: chỉ làm số còn thiếu');
      const thuMuc18 = path.join(tam, 'anh-18');
      fs.mkdirSync(thuMuc18, { recursive: true });
      for (const f of ['001.png', '002.png', '004 (2).png']) fs.writeFileSync(path.join(thuMuc18, f), PNG1);
      fs.writeFileSync(path.join(thuMuc18, '002.mp4'), 'video cu');
      const d18 = LENH.taoDuAn({ ten: 'Quet thieu', taiKhoan: ['tk-1'] });
      LENH.datCaiDat({ duAn: d18.id, thuMucAnh: thuMuc18, tenAnh: '{stt}', videoCanhAnh: true, taiAnh: true, taiVideo: true });
      const p18 = { duAn: d18.id, loai: 'anh', tyLe: '1:1', prompts: ['quét 1', 'quét 2', 'quét 3', 'quét 4', 'quét 5'], chuoiVideo: { prompt: 'quét động', nen: 'muse' } };
      const q18 = LENH.quetDaCo(p18);
      ghi(`   ${JSON.stringify({ coSan: q18.coSan, thieu: q18.thieu, chiVideo: q18.chiVideo.map((x) => x.stt) })}`);
      kiem(q18.ok && q18.coSan.join() === '2' && q18.thieu.join() === '3,5' && q18.chiVideo.map((x) => x.stt).join() === '1,4',
        'quét: đã có #2 (ảnh + video), thiếu #3 #5, chỉ thiếu video #1 #4');
      LENH.datCaiDat({ duAn: d18.id, boQuaDaCo: true });
      const gui18 = (await daGui()).length;
      const r18 = LENH.them({ ...p18, chay: true });
      kiem(r18.ok && r18.so === 4 && r18.boQua === 1, `thêm 4 việc, bỏ qua 1 số đã đủ (${JSON.stringify(r18)})`);
      const v18 = () => viec().filter((j) => j.duAn === d18.id);
      await cho(() => v18().length >= 6 && viec().filter((j) => j.duAn === d18.id).every((j) => j.trangThai === 'xong' || j.trangThai === 'loi'), 240000, 'quét: chạy xong');
      const xong18 = viec().filter((j) => j.duAn === d18.id);
      for (const j of xong18) ghi(`   #${j.so} ${j.loai} ${j.trangThai} ${j.files[0] || ''}`);
      const ten18 = fs.readdirSync(thuMuc18).sort();
      ghi(`   thư mục: ${ten18.join(', ')}`);
      kiem(['001.mp4', '003.mp4', '004 (2).mp4', '005.mp4'].every((f) => ten18.includes(f)) && ten18.some((f) => /^003\.(png|webp)$/.test(f)) && ten18.some((f) => /^005\.(png|webp)$/.test(f)),
        'thư mục đủ: ảnh 003, 005 mới; video 001, 003, 004, 005 cạnh ảnh cùng tên');
      kiem(!ten18.some((f) => /^00[12] \(2\)|^004 \(3\)/.test(f)), 'không tạo lại ảnh đã có');
      const gui18Moi = (await daGui()).slice(gui18).map((g) => g.prompt || '');
      kiem(gui18Moi.filter((x) => /quét [1-5]/.test(x)).length === 2 && !gui18Moi.some((x) => /quét [124]\b/.test(x)), `Muse chỉ nhận prompt ảnh 3, 5 (${gui18Moi.length} lần gửi)`);
      kiem(LENH.trangThai().nhatKy.some((d) => /🔎 Quét thư mục .*đã có 1 → bỏ qua/.test(d.chu)), 'nhật ký ghi kết quả quét');

      // 19) 1.4.3: bấm "Quét thư mục…" chọn thư mục làm dở (tên chỉ có số, khác mẫu tên của dự án) → quét đúng thư mục
      //     đó theo số trong tên, mẫu tên tự đổi thành {stt}, file mới nằm cùng thư mục; Muse chỉ nhận số còn thiếu.
      ghi('-- 19. Chọn thư mục làm dở để quét');
      const thuMuc19 = path.join(tam, 'lam-do-19');
      fs.mkdirSync(thuMuc19, { recursive: true });
      for (const f of ['001.png', '002.png', '0004.png']) fs.writeFileSync(path.join(thuMuc19, f), PNG1);
      const d19 = LENH.taoDuAn({ ten: 'Lam do', taiKhoan: ['tk-1'] });
      LENH.datCaiDat({ duAn: d19.id, thuMucAnh: path.join(tam, 'khac-19'), tenAnh: '{duAn}/anh_{stt}', taiAnh: true, boQuaDaCo: false });
      const ch19 = dieuPhoi.datThuMucQuet(d19.id, 'anh', thuMuc19);
      const cd19 = LENH.trangThai().duAn.find((d) => d.id === d19.id);
      kiem(ch19.ok && cd19.thuMucQuet && cd19.thuMucQuet.anh === thuMuc19, 'dự án nhớ thư mục đã chọn để quét');
      const c19 = dieuPhoi.cd(d19.id);
      kiem(c19.thuMucAnh === thuMuc19 && c19.boQuaDaCo === true && c19.tenAnh === '{stt}', `file mới lưu vào thư mục đó, bật bỏ qua, mẫu tên {stt} (${JSON.stringify([c19.thuMucAnh, c19.boQuaDaCo, c19.tenAnh])})`);
      const q19 = LENH.quetDaCo({ duAn: d19.id, loai: 'anh', prompts: [] });
      kiem(q19.ok && q19.soCo.join() === '1,2,4' && q19.lo.join() === '3', `tóm tắt thư mục: có 1, 2, 4; sót 3 (${JSON.stringify([q19.soCo, q19.lo])})`);
      const gui19 = (await daGui()).length;
      const r19 = LENH.them({ duAn: d19.id, loai: 'anh', tyLe: '1:1', prompts: ['lam 1', 'lam 2', 'lam 3', 'lam 4', 'lam 5'], chay: true });
      kiem(r19.ok && r19.so === 2 && r19.boQua === 3, `thêm 2 việc (3, 5), bỏ qua 3 (${JSON.stringify(r19)})`);
      await cho(() => viec().filter((j) => j.duAn === d19.id).every((j) => j.trangThai === 'xong' || j.trangThai === 'loi'), 120000, 'chọn thư mục: chạy xong');
      const ten19 = fs.readdirSync(thuMuc19).sort();
      ghi(`   thư mục: ${ten19.join(', ')}`);
      kiem(ten19.some((f) => /^003\.(png|webp)$/.test(f)) && ten19.some((f) => /^005\.(png|webp)$/.test(f)) && ten19.length === 5, 'ảnh 003, 005 mới nằm cùng thư mục, không tạo lại 1, 2, 4');
      const gui19Moi = (await daGui()).slice(gui19).map((g) => g.prompt || '');
      kiem(gui19Moi.length === 2 && gui19Moi.every((x) => /lam [35]/.test(x)), `Muse chỉ nhận prompt 3, 5 (${gui19Moi.length} lần gửi)`);
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
