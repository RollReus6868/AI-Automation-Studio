// ============================================================================
//  xoa-du-an-main.js — TỰ XOÁ DỰ ÁN FLOW TRÊN TRANG CHỦ (1.3.3)
//  --------------------------------------------------------------------------
//  Chạy:  xvfb-run -a npx electron --no-sandbox tests/flow/xoa-du-an-main.js
//
//  Nhật ký người dùng 18/10/2026 10:29: 5 tài khoản đều "Không tìm được nút xoá của dự án (bước nut-menu)",
//  chữ thẻ "Tháng 10 17 - 20:27 edit delete" — thẻ Flow mới có nút "edit" + "delete" ngay trên thẻ, không còn ⋮.
//  Bài chạy xoaDuAnFlow THẬT trên tests/fixture-flow-trang-chu.html với thẻ mới, thẻ mới chỉ hiện nút khi rê chuột,
//  và thẻ cũ (⋮ → menu). Đòi: đúng dự án bị xoá, hai dự án kia còn, KHÔNG bao giờ bấm "edit".
// ============================================================================
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { xoaDuAnFlow } = require('../../src/flow/main/xoa-du-an');

const loi = [];
const ok = (ten, dk, ct = '') => { console.log(`   ${dk ? '✓' : '✗'} ${ten}${ct ? ' — ' + ct : ''}`); if (!dk) loi.push(ten + (ct ? ' — ' + ct : '')); };
const FIX = 'file://' + path.join(__dirname, '..', 'fixture-flow-trang-chu.html');

app.on('window-all-closed', () => {});   // đóng cửa sổ của từng kiểu thẻ không được làm thoát bài
app.whenReady().then(async () => {
  console.log('\n══════════ TỰ XOÁ DỰ ÁN FLOW ══════════\n');
  try {
    for (const kieu of ['moi', 'an', 'cu']) {
      const trangChu = `${FIX}?kieu=${kieu}`;
      let cuaSo = null;
      const taoCuaSo = () => (cuaSo = new BrowserWindow({ show: false, webPreferences: { partition: `xoa-${kieu}` } }));
      // Trang sạch cho mỗi kiểu thẻ (partition riêng).
      const r = await xoaDuAnFlow('https://flow.google.com/project/du-an-2', { taoCuaSo, dongCuaSo: () => {}, trangChu, choMs: 8000 });
      const con = await cuaSo.webContents.executeJavaScript('({ ds: JSON.parse(localStorage.duAn), sua: localStorage.daBamSua || "" })', true);
      cuaSo.destroy();
      const ten = kieu === 'moi' ? 'thẻ mới (edit + delete trên thẻ)' : kieu === 'an' ? 'thẻ mới, nút chỉ hiện khi rê chuột' : 'thẻ cũ (⋮ → menu)';
      ok(`[${ten}] xoá được dự án`, r.ok, JSON.stringify(r));
      ok(`[${ten}] ...đúng dự án đó, hai dự án kia còn`, JSON.stringify(con.ds) === '["du-an-1","du-an-3"]', JSON.stringify(con.ds));
      ok(`[${ten}] ...không bấm nút "edit"`, !con.sua);
    }
  } catch (err) {
    loi.push(err.stack || err.message);
  }
  console.log(loi.length ? `\nKẾT QUẢ: ${loi.length} LỖI\n - ${loi.join('\n - ')}` : '\nKẾT QUẢ: tất cả đạt');
  app.exit(loi.length ? 1 : 0);
});
