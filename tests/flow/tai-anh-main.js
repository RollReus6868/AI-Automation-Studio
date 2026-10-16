// ============================================================================
//  tai-anh-main.js — TẢI ẢNH LÊN FLOW KHI ENGINE KHÔNG THẤY Ô TẢI LÊN (1.2.1)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/tai-anh-main.js
//
//  Trang tests/fixture-tai-anh.html dựng các kiểu ô tải ảnh (Flow mới: ô chọn file tạo lúc bấm, không
//  gắn vào trang; Flow cũ: ô ẩn có sẵn; chỉ kéo-thả; không có gì). taiAnhLen() của
//  src/flow/main/tai-anh-len.js chạy trên một WebContentsView ĐANG ẨN (như tab Flow chạy ngầm) và
//  phải đưa được file THẬT (đúng tên, có nội dung) vào trang.
// ============================================================================
const { app, BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { taiAnhLen, moTaChanDoan } = require('../../src/flow/main/tai-anh-len');

const loi = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');

app.whenReady().then(async () => {
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'tai-anh-'));
  const f1 = path.join(tam, '371_68b883.png'), f2 = path.join(tam, '372_aa01.png');
  fs.writeFileSync(f1, PNG); fs.writeFileSync(f2, PNG);
  const w = new BaseWindow({ width: 1200, height: 900, show: true });
  await wait(500);
  console.log('\n══════════ TẢI ẢNH LÊN FLOW ══════════\n');
  const thu = async (kieu, an = true) => {
    const v = new WebContentsView({ webPreferences: { backgroundThrottling: false } });
    w.contentView.addChildView(v);
    v.setBounds({ x: 0, y: 0, width: 1100, height: 800 });
    v.setVisible(!an);
    const wc = v.webContents;
    await wc.loadFile(path.join(__dirname, '..', 'fixture-tai-anh.html'), { query: { kieu } });
    const t0 = Date.now();
    const r = await taiAnhLen(wc, [f1, f2], { choMs: 800 });
    await wait(500);
    const nhan = await wc.executeJavaScript('window.__nhan', true);
    const moHop = await wc.executeJavaScript('window.__soMoHop', true);
    w.contentView.removeChildView(v);
    wc.close();
    return { r, nhan, moHop, ms: Date.now() - t0 };
  };
  try {
    let k = await thu('menu');
    ok('Flow mới (ô chọn file tạo lúc bấm "Upload image"): trang nhận đủ 2 ảnh đúng tên',
      k.r.ok && k.nhan.join() === '371_68b883.png,372_aa01.png', JSON.stringify(k));
    ok('...qua hộp chọn file đã chặn (không hiện hộp chọn file cho người dùng)', k.r.cach === 'hop-chon-file' && k.moHop === 1, k.r.cach);
    ok('...ghi lại các nút đã bấm', /moMenu: Add media/.test(k.r.buoc.join()) && /Upload image/.test(k.r.buoc.join()), k.r.buoc.join(' | '));

    k = await thu('tab');
    ok('mục Upload chỉ hiện sau khi bấm tab "Images": vẫn tải được', k.r.ok && k.nhan.length === 2 && k.r.cach === 'hop-chon-file', JSON.stringify(k));

    k = await thu('input');
    ok('Flow cũ (bấm [+] thì có ô ẩn): đặt file thẳng vào ô', k.r.ok && k.r.cach === 'o-tai-len' && k.nhan.length === 2, JSON.stringify(k));

    k = await thu('keo');
    ok('chỉ nhận kéo-thả vào ô nhập prompt: trang nhận đủ 2 ảnh', k.r.ok && k.r.cach === 'keo-tha' && k.nhan.join() === '371_68b883.png,372_aa01.png', JSON.stringify(k));
    ok('...kéo-thả báo "chưa chắc" (để còn kiểm lại kho Flow)', k.r.chacChan === false);

    k = await thu('khong');
    ok('không có đường nào: trang không nhận gì, có chẩn đoán các nút quanh ô nhập', k.nhan.length === 0 && !!k.r.chanDoan, JSON.stringify(k.r));
    ok('...chẩn đoán đọc được', /ô nhập có/.test(moTaChanDoan(k.r.chanDoan)) && /arrow_forward|Start generation/.test(moTaChanDoan(k.r.chanDoan)), moTaChanDoan(k.r.chanDoan));

    // Tab đang hiện trên màn hình cũng chạy như tab ẩn.
    k = await thu('menu', false);
    ok('tab đang hiện: vẫn tải được', k.r.ok && k.nhan.length === 2, JSON.stringify(k.r));
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
