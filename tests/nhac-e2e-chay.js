'use strict';
// Kịch bản đầu-cuối FLOW MUSIC (mục Tạo nhạc, 1.5.0), chạy BÊN TRONG app thật (MUSE_TEST). Chạy bằng: node tests/e2e.js nhac
// Trang Flow Music là bản GIẢ (tests/fixture-flowmusic.html) chép cấu trúc trang thật đo 17/11/2026: bài này kiểm phần
// của APP (tài khoản đi kèm Flow dùng chung phiên, gửi prompt nguyên văn, chờ 2 bài, chọn bài dài hơn, tải MP3 qua menu,
// đặt tên theo số prompt, 2 bài cùng lúc mỗi tài khoản, hết credit → tài khoản phụ, Producer chỉ trả lời chữ, tải hỏng
// → tải lại không gửi lại), KHÔNG kiểm được giao diện Flow Music thật.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eNhac({ win, app, LENH, dieuPhoi, taiKhoan }) {
  const tam = process.env.MUSE_E2E_TAM;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  const datCD = (c) => { LENH.datCaiDat(c); for (const d of dieuPhoi.duAn) LENH.datCaiDat({ duAn: d.id, ...c }); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (dk()) return true; await ngu(250); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const viec = () => dieuPhoi.viec;
  const U = process.env.MUSE_URL;
  const fmGhi = async () => (await net.fetch(`${U}/__fm/ghi`)).json();
  const cauHinh = (o) => net.fetch(`${U}/__fm/cau-hinh`, { method: 'POST', body: JSON.stringify(o) });
  const dangNhap = (flowId) => session.fromPartition(`persist:flow-${flowId}`).cookies.set({ url: U, name: 'fmusic_tk', value: flowId });
  const xongHet = (ds) => () => ds.length && ds.every((j) => j.trangThai === 'xong' || j.trangThai === 'loi');
  const inViec = (ds) => { for (const j of ds) ghi(`   #${j.so} ${j.nen} ${j.loai} ${j.trangThai} tk=${j.taiKhoan} ${j.loi || ''} ${(j.files || []).map((f) => path.basename(f)).join(',')}`); };
  const dongNhatKy = (tu) => { for (const d of LENH.trangThai().nhatKy.slice(tu)) ghi(`   | ${d.chu}`); };
  /** Nội dung file mp3 giả: "ID3-fm:<id bài>:<số giây>". */
  const docBai = (f) => { const m = fs.readFileSync(f, 'utf8').match(/^ID3-fm:([^:]+):(\d+)$/); return m ? { id: m[1], giay: +m[2] } : null; };
  const luu = (id) => (taiKhoan.store.get('taiKhoan').taiKhoan || []).find((a) => a.id === id) || {};

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Flow Music (trang flowmusic.app giả) ==');
      const nhac = path.join(tam, 'nhac');
      datCD({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0, tuThuLaiNhac: 0, tuChayLaiLoiNhac: 0, nghiNhac: 0,
        choNhacGiay: 120, thuMucNhac: nhac, tenNhac: '{stt}' });
      kiem(taiKhoan.ds.some((a) => a.id === 'nhac-flow-1' && a.nen === 'fmusic' && a.partition === 'persist:flow-flow-1' && a.ten === 'Flow 1'),
        'có sẵn tài khoản Flow Music "Flow 1" đi kèm tài khoản Google Flow (chung phiên persist:flow-flow-1)');
      kiem(!taiKhoan.ds.some((a) => a.nen === 'suno') && !fs.existsSync(path.join(app.getAppPath(), 'src', 'main', 'luong-suno.js')), 'không còn Suno');

      // 0) Kiểm tra: chưa đăng nhập → Chưa đăng nhập; đăng nhập (cookie trên phiên Flow) → Đã đăng nhập.
      ghi('-- 0. Kiểm tra tài khoản Flow Music');
      kiem(await LENH.kiemTaiKhoan({ id: 'nhac-flow-1' }) === 'can-dang-nhap', 'chưa đăng nhập → "Chưa đăng nhập"');
      await dangNhap('flow-1');
      kiem(await LENH.kiemTaiKhoan({ id: 'nhac-flow-1' }) === 'da-dang-nhap', 'đăng nhập ở phiên Google Flow → Flow Music "Đã đăng nhập" (dùng chung phiên)');
      const ua = session.fromPartition('persist:flow-flow-1').getUserAgent();
      kiem(/Electron\//.test(ua), `phiên giữ user agent thật như Flow (Google cho đăng nhập): ${ua}`);
      const soLop = win.contentView.children.length;
      LENH.moDangNhap({ id: 'nhac-flow-1', khung: { x: 300, y: 100, width: 800, height: 600 } });
      kiem(win.contentView.children.length === soLop + 1 && LENH.trangThai().dangNhap && LENH.trangThai().dangNhap.id === 'nhac-flow-1', 'mở khung đăng nhập Flow Music');
      await ngu(1000);
      await LENH.dongDangNhap();
      kiem(win.contentView.children.length === soLop, 'đóng khung đăng nhập');
      const xoa = await LENH.xoaTaiKhoan({ id: 'nhac-flow-1' });
      kiem(!xoa.ok && taiKhoan.tim('nhac-flow-1'), `không xoá riêng tài khoản Flow Music (${xoa.loi})`);
      await ngu(300);

      // 1) 3 prompt nhạc: gửi nguyên văn, 2 bài cùng lúc, mỗi lần tải bài dài hơn; tên theo số prompt.
      ghi('-- 1. Tạo 3 bài nhạc ở "Flow 1"');
      let nk = LENH.trangThai().nhatKy.length;
      const p1 = ['lofi chill piano, tiếng mưa, 80 bpm, instrumental', 'epic orchestral trailer', 'acoustic guitar ballad'];
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', nen: 'muse', prompts: p1, chay: true });
      const v1 = viec().filter((j) => j.loai === 'nhac');
      const daChayCungLuc = [];
      await cho(() => { daChayCungLuc.push(v1.filter((j) => j.trangThai === 'chay').length); return xongHet(v1)(); }, 150000, '3 bài nhạc xong');
      inViec(v1);
      dongNhatKy(nk);
      const g1 = await fmGhi();
      kiem(v1.length === 3 && v1.every((j) => j.nen === 'fmusic' && j.trangThai === 'xong' && j.taiKhoan === 'nhac-flow-1'), 'cả 3 việc nhạc xong ở tài khoản Flow Music "Flow 1"');
      kiem(JSON.stringify(g1.gui.map((g) => g.prompt)) === JSON.stringify(p1), `gửi NGUYÊN VĂN, đúng thứ tự prompt: ${JSON.stringify(g1.gui.map((g) => g.prompt))}`);
      kiem(g1.gui.every((g) => g.moi && g.tk === 'flow-1'), 'mỗi prompt một phiên chat mới');
      kiem(Math.max(...daChayCungLuc) === 2, `2 bài chạy cùng lúc mỗi tài khoản (tối đa thấy ${Math.max(...daChayCungLuc)})`);
      const f1 = v1.map((j) => j.files[0] || '');
      kiem(f1.map((f) => path.relative(nhac, f)).join() === '001.mp3,002.mp3,003.mp3' && f1.every((f) => fs.existsSync(f)),
        `file nhạc đặt tên theo số prompt trong thư mục đã chọn: ${f1.map((f) => path.relative(tam, f)).join(', ')}`);
      const b1 = f1.map((f) => (fs.existsSync(f) ? docBai(f) : null));
      const dai = (b, g) => b && b.giay === g;
      kiem(b1.filter(Boolean).length === 3 && b1.every((b) => dai(b, 178) || dai(b, 200)), `mỗi việc tải bài DÀI HƠN (2:58 / 3:20): ${JSON.stringify(b1)}`);
      kiem(g1.tai.length === 3 && g1.tai.every((t) => t.dd === 'mp3'), `mỗi việc tải đúng 1 file, định dạng MP3 qua menu của trang (${g1.tai.map((t) => t.id).join(', ')})`);
      kiem(g1.hoiWav >= 6, `đọc thời lượng 2 bài của mỗi lần (${g1.hoiWav} lần hỏi file nghe thử)`);
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /Việc #\d+ xong nhạc \(bài dài hơn: (2:58 \(bài kia 2:29\)|3:20 \(bài kia 2:41\))\)/.test(d.chu)), 'nhật ký ghi thời lượng 2 bài và bài được chọn');
      const tamNhac = path.join(app.getPath('userData'), 'nhac-tai-tam');
      kiem(!fs.existsSync(tamNhac) || !fs.readdirSync(tamNhac).length, 'file tạm đã được chuyển hết sang thư mục nhạc');
      kiem(!fs.existsSync(path.join(app.getPath('userData'), 'flow-tai-tam', 'khac')), 'phần tải về của tab Flow không giành file nhạc (phiên dùng chung)');

      // 2) "Flow 1" hết credit → bài tạo lại ở "Flow 2"; Flow 1 nghỉ (lưu mốc); tài khoản Google Flow "Flow 1" không nghỉ.
      ghi('-- 2. Flow Music "Flow 1" hết credit → tạo lại ở "Flow 2"');
      const f2 = LENH.themTaiKhoan({ ten: 'Flow 2', nen: 'flow' });
      const m2 = `nhac-${f2.id}`;
      kiem(taiKhoan.tim(m2) && taiKhoan.tim(m2).partition === `persist:flow-${f2.id}`, 'thêm tài khoản Google Flow là có tài khoản Flow Music đi kèm');
      await dangNhap(f2.id);
      await cauHinh({ hetCredit: ['flow-1'] });
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', prompts: ['jazz cafe saxophone'], chay: true });
      const v2 = viec().filter((j) => j.loai === 'nhac' && !v1.includes(j));
      await cho(xongHet(v2), 150000, 'bài nhạc tạo lại ở Flow 2 xong');
      inViec(v2);
      dongNhatKy(nk);
      const gui2 = (await fmGhi()).gui.slice(g1.gui.length);
      kiem(gui2.map((g) => g.tk).join() === `flow-1,${f2.id}`, `gửi ở "Flow 1" rồi TẠO LẠI ở "Flow 2" (${gui2.map((g) => g.tk)})`);
      kiem(v2[0] && v2[0].trangThai === 'xong' && v2[0].taiKhoan === m2 && new RegExp(`-${f2.id}$`).test((docBai(v2[0].files[0] || '') || {}).id || ''), 'file tải về là bài của "Flow 2"');
      kiem(path.basename(v2[0].files[0] || '') === '001 (2).mp3', `không ghi đè bài cũ cùng tên (${path.basename(v2[0].files[0] || '')})`);
      kiem(luu('nhac-flow-1').hetLuotDen > Date.now() + 5 * 3600e3 && /out of credits/.test(luu('nhac-flow-1').lyDoHetLuot || ''),
        `Flow Music "Flow 1" được đánh dấu hết lượt (đã LƯU): ${luu('nhac-flow-1').lyDoHetLuot}`);
      kiem(!(luu('flow-1').hetLuotDen > 0) && !dieuPhoi._nghi('flow-1'), 'tài khoản Google Flow "Flow 1" vẫn chạy ảnh / video bình thường');
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /↪ #\d+ Flow Music hết lượt: ".*out of credits.*\(ở "Flow 1"\) — tạo lại ở "Flow 2"/.test(d.chu)), 'nhật ký báo chuyển sang Flow 2');

      // 3) Producer chỉ trả lời bằng chữ (hỏi lại) → app nhắn thêm một lần, rồi có bài.
      ghi('-- 3. Producer chỉ trả lời bằng chữ → nhắn thêm "tạo bài luôn"');
      await cauHinh({ chiChu: 1 });
      const g3 = await fmGhi();
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', prompts: ['một bài gì đó vui vui'], chay: true });
      const v3 = viec().filter((j) => j.prompt === 'một bài gì đó vui vui');
      await cho(xongHet(v3), 150000, 'bài mục 3 xong');
      inViec(v3);
      dongNhatKy(nk);
      const gui3 = (await fmGhi()).gui.slice(g3.gui.length);
      kiem(gui3.length === 2 && gui3[0].moi && !gui3[1].moi && gui3[1].phien === gui3[0].phien && /create the song now/i.test(gui3[1].prompt),
        `nhắn thêm MỘT lần trong cùng phiên (${JSON.stringify(gui3.map((g) => [g.phien, g.prompt]))})`);
      kiem(v3[0] && v3[0].trangThai === 'xong' && fs.existsSync(v3[0].files[0] || ''), 'rồi tải được bài');

      // 4) Lần mở menu đầu không có MP3 → tải lại đúng bài, KHÔNG gửi lại prompt.
      ghi('-- 4. Tải hỏng → tải lại, không gửi lại prompt');
      await cauHinh({ hongTai: 1 });
      const g4 = await fmGhi();
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', prompts: ['piano mưa đêm'], chay: true });
      const v4 = viec().filter((j) => j.prompt === 'piano mưa đêm');
      await cho(xongHet(v4), 150000, 'bài mục 4 xong');
      inViec(v4);
      dongNhatKy(nk);
      const g4b = await fmGhi(), nk4 = LENH.trangThai().nhatKy.slice(nk).map((d) => d.chu);
      kiem(g4b.gui.length - g4.gui.length === 1, `chỉ gửi MỘT lần dù lần tải đầu hỏng (${g4b.gui.length - g4.gui.length})`);
      kiem(v4[0] && v4[0].trangThai === 'xong' && fs.existsSync(v4[0].files[0] || ''), 'tải được ở lần sau');
      kiem(nk4.some((x) => /tải lại bài này \(lần 2\/3\), không gửi lại prompt/.test(x)), 'nhật ký: tải lại đúng bài, không gửi lại prompt');

      // 5) Kiểm tra "Flow 1" (Flow Music) = bỏ mốc hết lượt.
      ghi('-- 5. Kiểm tra bỏ mốc hết lượt');
      await cauHinh({ hetCredit: [] });
      kiem(await LENH.kiemTaiKhoan({ id: 'nhac-flow-1' }) === 'da-dang-nhap' && !(luu('nhac-flow-1').hetLuotDen > Date.now()), 'Kiểm tra bỏ mốc hết lượt');
      // 6) Đăng xuất tài khoản Flow Music = đăng xuất cả Google Flow cùng tên (chung phiên).
      await LENH.dangXuat({ id: m2 });
      kiem(taiKhoan.tim(m2).trangThai === 'can-dang-nhap' && taiKhoan.tim(f2.id).trangThai === 'can-dang-nhap', 'đăng xuất một bên là cả hai đều "Chưa đăng nhập"');
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
