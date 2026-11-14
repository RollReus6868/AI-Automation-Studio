'use strict';
// node tests/hieu-nang.js  (Linux: xvfb-run -a node tests/hieu-nang.js)
// ----------------------------------------------------------------------------
// 1.4.14 — ĐO CPU khi hàng đợi LỚN (người dùng: "kiểm tra các chức năng nào thừa và làm chậm tool thì xoá đi").
// Dựng 5 dự án × 1.000 việc ảnh (2/3 đã xong, mỗi ảnh xong nối 1 video chờ) rồi chạy APP THẬT; kịch bản
// tests/hieu-nang-chay.js giả "đang chạy": một việc đổi bước 4 lần/giây trong 20 giây, đo CPU lõi app + giao diện
// và số lần ghi du-lieu.json. In số đo; HIEU_NANG_NGUONG=<%> thì FAIL khi CPU lõi app + giao diện vượt ngưỡng.
// Đo 1.4.14 (xvfb, phần mềm vẽ): giao diện 50% → 12% một nhân. Chẩn đoán thêm: HN_PROFILE=1 in hàm tốn CPU nhất của
// giao diện (+ dòng nóng trong veHang); HN_CSS='…' chèn CSS thử (vd tắt một hiệu ứng) để so.
// ----------------------------------------------------------------------------
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'hieu-nang-'));
fs.mkdirSync(path.join(tam, 'data'), { recursive: true });
const SO_DA = 5, MOI_DA = 1000;
const p = 'A cinematic wide shot of an ancient city at dawn, golden light over stone walls, mist in the valley, people walking with baskets, highly detailed, dramatic composition. ';
const duAn = [], viec = [];
let id = 0;
for (let k = 0; k < SO_DA; k++) {
  const da = `da-${k}`;
  duAn.push({ id: da, ten: `Dự án ${k + 1}`, so: MOI_DA, taoLuc: 1792217727436, taiKhoan: ['tk-1'], chaySong: { muse: 1, flow: 1, suno: 1 }, soLoai: { anh: MOI_DA, video: 0, nhac: 0 } });
  for (let n = 1; n <= MOI_DA; n++) {
    const xong = n % 3 !== 0;
    viec.push({ id: ++id, nen: 'muse', duAn: da, so: n, stt: n, loai: 'anh', prompt: `${n}. ${p}${p}`, tyLe: '16:9', thamChieu: [], nhanVat: [],
      chuoi: { prompt: `Slow zoom in. ${p}`, tyLe: '' }, tuAnh: 0, trangThai: xong ? 'xong' : 'cho', buoc: '', thread: xong ? `https://muse.ai/thread/${id}` : '',
      taiKhoan: xong ? 'tk-1' : '', files: xong ? [path.join(tam, 'ra', da, `${String(n).padStart(3, '0')}.png`)] : [], tam: false, loi: '', thu: 0,
      taoLuc: 1792303991280 + id, daQuaNen: [], tkLoi: [], vongTk: 0, ...(xong ? { batDauLuc: 1792304287032 + id, xongLuc: 1792304428538 + id } : {}) });
    if (xong) viec.push({ id: ++id, nen: 'muse', duAn: da, so: n, stt: n, loai: 'video', prompt: `Slow zoom in. ${p}`, tyLe: '16:9', thamChieu: [viec[viec.length - 1].files[0]],
      nhanVat: [], chuoi: null, tuAnh: id - 1, henLoai: 'anh', trangThai: 'cho', buoc: '', thread: '', taiKhoan: '', files: [], tam: false, loi: '', thu: 0,
      taoLuc: 1792303991280 + id, daQuaNen: [], tkLoi: [], vongTk: 0 });
  }
}
fs.writeFileSync(path.join(tam, 'data', 'du-lieu.json'), JSON.stringify({ duAn, viec, nhanVat: [], mauPrompt: [] }));
console.log(`Dữ liệu: ${viec.length} việc, du-lieu.json ${(fs.statSync(path.join(tam, 'data', 'du-lieu.json')).size / 1048576).toFixed(1)} MB`);

const electron = require('electron');
const args = ['.'];
if (process.platform === 'linux') args.push('--no-sandbox');
const pr = spawn(electron, args, {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, MUSE_TEST: 'tests/hieu-nang-chay.js', MUSE_DATA_DIR: path.join(tam, 'data'), MUSE_NO_UPDATE_CHECK: '1', MUSE_KIEM_KHI_MO_MS: '600000' },
  stdio: ['ignore', 'pipe', 'pipe']
});
pr.stdout.on('data', (d) => process.stdout.write(d));
pr.stderr.on('data', (d) => { const s = String(d); if (!/dbus|bus\.cc|viz_main|command_buffer|Fontconfig|gpu|ffmpeg_common/i.test(s)) process.stderr.write(s); });
const hen = setTimeout(() => { console.log('HIỆU NĂNG: QUÁ GIỜ (240s)'); pr.kill('SIGKILL'); }, 240000);
pr.on('exit', (code) => {
  clearTimeout(hen);
  try { fs.rmSync(tam, { recursive: true, force: true }); } catch (_) {}
  console.log(code === 0 ? 'HIỆU NĂNG: PASS' : `HIỆU NĂNG: FAIL (mã ${code})`);
  process.exit(code === 0 ? 0 : 1);
});
