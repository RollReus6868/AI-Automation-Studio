'use strict';
// node tests/giao-dien-ram.js  (Linux: xvfb-run -a node tests/giao-dien-ram.js)
// ----------------------------------------------------------------------------
// 1.3.4 — Giao diện KHÔNG phình RAM khi hàng đợi có nhiều video đã xong.
// Người dùng 18/10/2026: Task Manager báo app 7,7 GB, một tiến trình 2,1 GB, app giật. Đo trên máy kiểm:
// trang Tạo video với 200 video xong → tiến trình giao diện 1,8 GB lúc mở, 3,4 GB sau 10 giây trạng thái đổi
// (mỗi dòng là một <video preload="metadata">, cả danh sách vẽ lại mỗi lần một việc đổi bước).
// Bài này dựng dữ liệu 200 video xong + 100 việc chờ rồi chạy APP THẬT; kịch bản: tests/giao-dien-ram-chay.js.
// ----------------------------------------------------------------------------
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'ram-ui-'));
const thuMucVideo = path.join(tam, 'video');
fs.mkdirSync(thuMucVideo, { recursive: true });
fs.mkdirSync(path.join(tam, 'data'), { recursive: true });
const mau = fs.readFileSync(path.join(__dirname, 'fixture-video.mp4'));
const anhThamChieu = path.join(__dirname, '..', 'icons', 'icon256.png');
const viec = [];
for (let n = 1; n <= 300; n++) {
  const xong = n <= 200;
  const j = { id: n, nen: 'muse', duAn: 'da-ram', so: n, stt: n, loai: 'video', prompt: `Animate this image into a smooth cinematic video number ${n}`,
    tyLe: '16:9', thamChieu: [anhThamChieu], nhanVat: [], chuoi: null, tuAnh: 0, trangThai: xong ? 'xong' : 'cho', buoc: '', thread: '',
    taiKhoan: 'tk-1', files: [], tam: false, loi: '', thu: 0, taoLuc: 1792303991280 + n, daQuaNen: [], tkLoi: [], vongTk: 0 };
  if (xong) {
    const f = path.join(thuMucVideo, `${String(n).padStart(3, '0')}.mp4`);
    fs.writeFileSync(f, mau);
    Object.assign(j, { files: [f], batDauLuc: 1792304287032 + n, xongLuc: 1792304428538 + n });
  }
  viec.push(j);
}
fs.writeFileSync(path.join(tam, 'data', 'du-lieu.json'), JSON.stringify({
  duAn: [{ id: 'da-ram', ten: 'Dự án RAM', so: 300, taoLuc: 1792217727436, taiKhoan: ['tk-1'], chaySong: { muse: 1, flow: 1, suno: 1 }, soLoai: { anh: 0, video: 300, nhac: 0 } }],
  viec, nhanVat: [], mauPrompt: []
}));

const electron = require('electron');
const args = ['.'];
if (process.platform === 'linux') args.push('--no-sandbox');
const p = spawn(electron, args, {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, MUSE_TEST: 'tests/giao-dien-ram-chay.js', MUSE_DATA_DIR: path.join(tam, 'data'), MUSE_NO_UPDATE_CHECK: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let raChu = '';
p.stdout.on('data', (d) => { raChu += d; process.stdout.write(d); });
p.stderr.on('data', (d) => { const s = String(d); if (!/dbus|bus\.cc|viz_main|command_buffer|Fontconfig|gpu|ffmpeg_common/i.test(s)) process.stderr.write(s); });
const hen = setTimeout(() => { console.log('RAM GIAO DIỆN: QUÁ GIỜ (240s)'); p.kill('SIGKILL'); }, 240000);
p.on('exit', (code) => {
  clearTimeout(hen);
  try { fs.rmSync(tam, { recursive: true, force: true }); } catch (_) {}
  console.log(code === 0 ? 'RAM GIAO DIỆN: PASS' : `RAM GIAO DIỆN: FAIL (mã ${code})`);
  if (code !== 0 && process.env.GITHUB_ACTIONS) {
    const esc = (x) => x.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=RAM giao dien ${process.platform}::${esc(raChu.split('\n').filter((l) => /✘|LỖI|KẾT QUẢ|RAM/.test(l)).join('\n').slice(-5000))}`);
  }
  process.exit(code === 0 ? 0 : 1);
});
