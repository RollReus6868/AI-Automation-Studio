'use strict';
// Kịch bản đầu-cuối SUNO (mục Tạo nhạc), chạy BÊN TRONG app thật (MUSE_TEST). Chạy bằng: node tests/e2e.js suno
// Trang Suno là bản GIẢ (tests/fixture-suno.html) chép cấu trúc trang Create thật: bài này kiểm phần của APP
// (điền Styles ở Advanced, xoá lời cũ, chọn bài dài hơn trong 2 bài đầu, tải MP3 qua menu Download, đặt tên,
// hết lượt → tạo lại ở tài khoản Suno phụ, Kiểm tra bỏ mốc hết lượt), KHÔNG kiểm được giao diện Suno thật.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eSuno({ win, app, LENH, dieuPhoi, taiKhoan }) {
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
  const U = process.env.MUSE_URL;
  const sunoGui = async () => (await net.fetch(`${U}/__suno-gui`)).json();
  const cauHinh = (o) => net.fetch(`${U}/__suno-cau-hinh`, { method: 'POST', body: JSON.stringify(o) });
  const dangNhap = (id) => session.fromPartition(`persist:suno-${id}`).cookies.set({ url: U, name: 'suno_tk', value: id });
  const xongHet = (ds) => () => ds.every((j) => j.trangThai === 'xong' || j.trangThai === 'loi');
  const inViec = (ds) => { for (const j of ds) ghi(`   #${j.so} ${j.nen} ${j.loai} ${j.trangThai} tk=${j.taiKhoan} ${j.loi || ''} ${(j.files || []).map((f) => path.basename(f)).join(',')}`); };
  const dongNhatKy = (tu) => { for (const d of LENH.trangThai().nhatKy.slice(tu)) ghi(`   | ${d.chu}`); };
  /** Nội dung file mp3 giả: "ID3-gia:<id bài>:<số giây>". */
  const docBai = (f) => { const m = fs.readFileSync(f, 'utf8').match(/^ID3-gia:([^:]+):(\d+)$/); return m ? { id: m[1], giay: +m[2] } : null; };

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Suno (trang Create giả) ==');
      const nhac = path.join(tam, 'nhac');
      LENH.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, choNhacGiay: 120, thuMucNhac: nhac, tenNhac: '{stt}' });
      kiem(taiKhoan.ds.some((a) => a.id === 'suno-1' && a.nen === 'suno' && a.partition === 'persist:suno-suno-1'),
        'có sẵn tài khoản "Suno 1" (phiên riêng persist:suno-suno-1)');

      // 0) Chưa đăng nhập → Kiểm tra báo chưa đăng nhập; đăng nhập rồi → đã đăng nhập.
      ghi('-- 0. Kiểm tra tài khoản Suno');
      kiem(await LENH.kiemTaiKhoan({ id: 'suno-1' }) === 'can-dang-nhap', 'chưa đăng nhập Suno → "Chưa đăng nhập"');
      await dangNhap('suno-1');
      kiem(await LENH.kiemTaiKhoan({ id: 'suno-1' }) === 'da-dang-nhap', 'đã đăng nhập Suno → "Đã đăng nhập"');

      // 1) Hai prompt nhạc ở Suno 1: Advanced, prompt vào Styles, lời trống; tải bài dài hơn trong 2 bài đầu.
      ghi('-- 1. Tạo 2 bài nhạc ở "Suno 1"');
      let nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', nen: 'suno', prompts: ['lofi chill piano, tiếng mưa, 80 bpm', 'epic orchestral trailer'], chay: true });
      const v1 = viec().filter((j) => j.loai === 'nhac');
      await cho(xongHet(v1), 150000, '2 bài nhạc xong');
      inViec(v1);
      dongNhatKy(nk);
      const g1 = await sunoGui();
      kiem(v1.length === 2 && v1.every((j) => j.nen === 'suno' && j.trangThai === 'xong' && j.taiKhoan === 'suno-1'), 'cả 2 việc nhạc xong ở "Suno 1"');
      kiem(g1.gui.length === 2 && g1.gui.every((g) => g.cheDo === 'advanced'), `app chuyển sang Advanced trước khi Create (${g1.gui.map((g) => g.cheDo)})`);
      kiem(g1.gui[0] && g1.gui[0].styles === 'lofi chill piano, tiếng mưa, 80 bpm' && g1.gui[1].styles === 'epic orchestral trailer',
        'prompt nằm NGUYÊN VĂN trong ô Styles (không bọc mẫu câu lệnh Muse)');
      kiem(g1.gui.every((g) => g.loi === ''), `ô Lời để trống (đã xoá lời cũ): ${JSON.stringify(g1.gui.map((g) => g.loi))}`);
      const f1 = v1.map((j) => j.files[0] || '');
      kiem(f1.map((f) => path.relative(nhac, f)).join() === '001.mp3,002.mp3' && f1.every((f) => fs.existsSync(f)),
        `file nhạc đặt tên {stt} trong thư mục đã chọn: ${f1.map((f) => path.relative(tam, f)).join(', ')}`);
      const b1 = f1.map((f) => (fs.existsSync(f) ? docBai(f) : null));
      kiem(b1[0] && b1[0].giay === 161 && /^s1-2-/.test(b1[0].id), `bài 1: tải bài dài hơn (2:41, bài thứ 2) — tải được ${JSON.stringify(b1[0])}`);
      kiem(b1[1] && b1[1].giay === 200 && /^s2-1-/.test(b1[1].id), `bài 2: tải bài dài hơn (3:20, bài thứ 1) — tải được ${JSON.stringify(b1[1])}`);
      kiem(!g1.tai.some((id) => /^s\d+-[34]-/.test(id)), 'không bao giờ tải bài 3–4 (bản nghe thử), kể cả bài 3 dài 4:00');
      kiem(g1.tai.length === 2, `mỗi việc tải đúng 1 file (${g1.tai.join(', ')})`);
      kiem(g1.dinhDang.join() === 'MP3,MP3', `hộp Download: app tự chọn MP3 (trang chọn sẵn M4A) rồi bấm Download (${g1.dinhDang.join(', ')})`);
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /Việc #\d+ xong nhạc \(bài dài hơn: 2:41 \(bài kia 2:05\)\)/.test(d.chu)), 'nhật ký ghi thời lượng 2 bài và bài được chọn');
      kiem(fs.existsSync(path.join(app.getPath('userData'), 'suno-tai-tam')) && !fs.readdirSync(path.join(app.getPath('userData'), 'suno-tai-tam')).length,
        'file tạm đã được chuyển hết sang thư mục nhạc');

      // 2) Suno 1 hết lượt TẢI → bài tạo lại và tải ở Suno 2; Suno 1 nghỉ (lưu mốc).
      ghi('-- 2. "Suno 1" hết lượt tải → tạo lại ở "Suno 2"');
      const s2 = LENH.themTaiKhoan({ ten: 'Suno 2', nen: 'suno' });
      await dangNhap(s2.id);
      await cauHinh({ hetTai: ['suno-1'] });
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', nen: 'suno', prompts: ['jazz cafe saxophone'], chay: true });
      const v2 = viec().filter((j) => j.loai === 'nhac' && !v1.includes(j));
      await cho(xongHet(v2), 200000, 'bài nhạc tạo lại ở Suno 2 xong');
      inViec(v2);
      dongNhatKy(nk);
      const g2 = await sunoGui();
      const gui2 = g2.gui.slice(g1.gui.length);
      kiem(gui2.map((g) => g.tk).join() === `suno-1,${s2.id}`, `Create ở "Suno 1" rồi TẠO LẠI ở "Suno 2" (${gui2.map((g) => g.tk)})`);
      kiem(v2[0] && v2[0].trangThai === 'xong' && v2[0].taiKhoan === s2.id && fs.existsSync(v2[0].files[0] || '') &&
        new RegExp(`-${s2.id}$`).test((docBai(v2[0].files[0]) || {}).id || ''), 'file tải về là bài của "Suno 2"');
      // {stt} = số dòng prompt trong lần thêm (bài này là dòng 1) → trùng 001.mp3 của mục 1 thì thêm (2), không ghi đè.
      kiem(path.basename(v2[0].files[0] || '') === '001 (2).mp3' && docBai(f1[0]).giay === 161, `không ghi đè bài cũ cùng tên (${path.basename(v2[0].files[0] || '')})`);
      const luu = (id) => (taiKhoan.store.get('taiKhoan').taiKhoan || []).find((a) => a.id === id) || {};
      kiem(luu('suno-1').hetLuotDen > Date.now() + 5 * 3600e3 && /Out of Downloads — You don't have any downloads left/.test(luu('suno-1').lyDoHetLuot || ''),
        `"Suno 1" được đánh dấu hết lượt (đã LƯU): ${luu('suno-1').lyDoHetLuot}`);
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /↪ #\d+ Suno hết lượt tải về: "Out of Downloads — You don't have any downloads left\..*\(ở "Suno 1"\) — tạo lại ở "Suno 2"/.test(d.chu)), 'nhật ký báo chuyển sang Suno 2');

      // 3) Bài sau chạy thẳng Suno 2 (Suno 1 đang nghỉ); Suno 2 hết credit → không còn tài khoản → tạm dừng, việc về Chờ.
      ghi('-- 3. "Suno 2" hết credit → hết tài khoản → tạm dừng');
      await cauHinh({ hetTao: [s2.id] });
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'nhac', nen: 'suno', prompts: ['ambient drone'], chay: true });
      const v3 = viec().filter((j) => j.loai === 'nhac' && !v1.includes(j) && !v2.includes(j));
      await cho(() => !dieuPhoi.dangChay, 120000, 'hàng chờ tạm dừng');
      inViec(v3);
      dongNhatKy(nk);
      const gui3 = (await sunoGui()).gui.slice(g2.gui.length);
      kiem(gui3.map((g) => g.tk).join() === s2.id, `không gửi lại ở "Suno 1" đang nghỉ, chỉ thử "Suno 2" (${gui3.map((g) => g.tk)})`);
      kiem(v3[0] && v3[0].trangThai === 'cho' && /hết lượt tạo bài/.test(v3[0].loi), `việc về Chờ, ghi lý do: ${v3[0] && v3[0].loi}`);
      kiem(!dieuPhoi.dangChay, 'không còn tài khoản Suno nào còn lượt → hàng chờ tạm dừng');

      // 4) Kiểm tra "Suno 1" = bỏ mốc hết lượt; bỏ giới hạn trên trang → Chạy tất cả chạy được ở Suno 1.
      ghi('-- 4. Kiểm tra bỏ mốc hết lượt, chạy lại');
      await cauHinh({ hetTai: [], hetTao: [s2.id] });
      kiem(await LENH.kiemTaiKhoan({ id: 'suno-1' }) === 'da-dang-nhap' && !(luu('suno-1').hetLuotDen > Date.now()), 'Kiểm tra "Suno 1" bỏ mốc hết lượt');
      LENH.chay();
      await cho(xongHet(v3), 150000, 'việc chờ chạy lại ở Suno 1');
      inViec(v3);
      kiem(v3[0] && v3[0].trangThai === 'xong' && v3[0].taiKhoan === 'suno-1' && fs.existsSync(v3[0].files[0] || ''), 'việc nhạc còn chờ xong ở "Suno 1"');
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
