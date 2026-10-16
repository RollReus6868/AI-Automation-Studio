'use strict';
// ============================================================================
//  hang-doi.js — LOGIC THUẦN của hàng đợi: dự án, việc, tên file, câu lệnh.
//  Không đụng Electron, không đụng đĩa → node tests/run.js kiểm được hết.
//  Giao diện cũng nạp file này (window.HD) — một nguồn duy nhất cho cách tách
//  prompt, ước tiến độ, tìm nhân vật.
//
//  Một "việc" (job) = một prompt cần ra MỘT ảnh hoặc MỘT video:
//    { id, duAn, so, loai:'anh'|'video', prompt, tyLe, thamChieu:[đường dẫn],
//      nhanVat:[id], trangThai, buoc, thread, taiKhoan, files:[], loi,
//      thu, taoLuc, batDauLuc, xongLuc }
//  trangThai: 'cho' | 'chay' | 'xong' | 'loi'
//  `thread` còn giữ khi việc quay lại 'cho' (dừng giữa chừng, tắt app): lần
//  sau chỉ cần mở lại chat đó lấy kết quả, KHÔNG gửi lại prompt (đỡ tốn lượt).
// ============================================================================

const TY_LE = ['9:16', '16:9', '1:1', '4:3', '3:4'];

const MAU_MAC_DINH = {
  anh: 'Tạo 1 ảnh tỷ lệ {tyLe}: {prompt}\n{thamChieu}\nChỉ trả về ảnh, không hỏi lại, không giải thích.',
  video: 'Tạo 1 video tỷ lệ {tyLe}: {prompt}\n{thamChieu}\nChỉ trả về video, không hỏi lại, không giải thích.'
};

/** "Mặc định" → "Mac_dinh" — an toàn cho tên thư mục/tệp trên Windows lẫn Mac. */
function slugTen(ten) {
  const s = String(ten || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'Du_an';
}

/**
 * Tách khối chữ thành danh sách prompt.
 * cach 'dong'   : mỗi dòng một prompt (bỏ dòng trống)
 * cach 'doan'   : các đoạn cách nhau bằng dòng trống (prompt nhiều dòng)
 */
function tachPrompt(chu, cach) {
  const s = String(chu || '').replace(/\r\n?/g, '\n');
  const ds = cach === 'doan' ? s.split(/\n\s*\n/) : s.split('\n');
  return ds.map((x) => x.trim()).filter(Boolean);
}

/** Tìm nhân vật được nhắc tên trong prompt (không phân biệt hoa thường, đúng nguyên từ). */
function timNhanVat(prompt, dsNhanVat) {
  const p = ' ' + String(prompt || '').toLowerCase() + ' ';
  return (dsNhanVat || []).filter((nv) => {
    const ten = String(nv.ten || '').trim().toLowerCase();
    if (!ten) return false;
    const i = p.indexOf(ten);
    if (i < 0) return false;
    const truoc = p.charAt(i - 1), sau = p.charAt(i + ten.length);
    const laChu = (c) => /[\p{L}\p{N}_]/u.test(c);
    return !laChu(truoc) && !laChu(sau);
  });
}

/**
 * Câu lệnh gửi Muse cho một việc.
 * @param job      việc
 * @param nhanVat  [{ten, moTa, anh:[...]}] đã chọn cho việc này (theo thứ tự đính kèm)
 * @param mau      {anh, video} mẫu câu lệnh người dùng sửa được
 */
function taoTinNhan(job, nhanVat, mau) {
  const m = (mau && mau[job.loai]) || MAU_MAC_DINH[job.loai];
  const dong = [];
  let stt = 1;
  for (const nv of nhanVat || []) {
    const n = (nv.anh || []).length;
    if (!n) continue;
    const vt = n === 1 ? `ảnh ${stt}` : `ảnh ${stt}–${stt + n - 1}`;
    dong.push(`Nhân vật "${nv.ten}" là ${vt} đính kèm${nv.moTa ? ` (${nv.moTa})` : ''}: giữ nguyên khuôn mặt và đặc điểm.`);
    stt += n;
  }
  const soThamChieu = (job.thamChieu || []).length;
  if (soThamChieu) {
    const vt = soThamChieu === 1 ? `ảnh ${stt}` : `ảnh ${stt}–${stt + soThamChieu - 1}`;
    dong.push(job.loai === 'video'
      ? `Dùng ${vt} đính kèm làm khung hình đầu / tham chiếu cho video.`
      : `Dùng ${vt} đính kèm làm ảnh tham chiếu.`);
  }
  return m
    .replace(/\{tyLe\}/g, job.tyLe || '9:16')
    .replace(/\{prompt\}/g, String(job.prompt || '').trim())
    .replace(/\{thamChieu\}/g, dong.join('\n'))
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const MAU_TEN_MAC_DINH = '{duAn}/{duAn}_{so}';
const MAU_TEN_ANH_MAC_DINH = '{stt}';   // 1.0.2: người dùng muốn ảnh tải về mặc định tên là số thứ tự prompt
const PROMPT_VIDEO_MAC_DINH = 'Làm cho ảnh chuyển động tự nhiên, máy quay chuyển động nhẹ, giữ nguyên bố cục, nhân vật và phong cách của ảnh.';

/** Một đoạn đường dẫn an toàn trên Windows lẫn Mac: bỏ ký tự cấm, bỏ '..', bỏ dấu chấm/cách cuối. */
function sachDoan(s) {
  return String(s).replace(/[<>:"\\|?*\x00-\x1f]/g, '_').replace(/^\.+$/, '_').replace(/[. ]+$/, '').trim();
}

/**
 * Tên file theo mẫu người dùng đặt (đường dẫn tương đối, có thể có thư mục con "/").
 *   {duAn}   tên dự án không dấu        {so}  số thứ tự trong hàng đợi (3 chữ số)
 *   {stt}    số thứ tự prompt trong mẻ  {prompt} 6 từ đầu của prompt, không dấu
 *   {ngay}   ngày tạo YYYY-MM-DD        {loai} anh | video
 *   {tenAnh} tên file ảnh nguồn (video tạo từ ảnh) — không có thì bằng {stt}
 * Thêm _2, _3 nếu Muse trả nhiều file cho một việc.
 */
function tenFile(duAn, job, mime, thuTu, mau) {
  const so3 = (n) => String(n || 0).padStart(3, '0');
  const d = new Date(job.taoLuc || Date.now());
  const ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const giaTri = {
    duAn: slugTen(duAn && duAn.ten), so: so3(job.so), stt: so3(job.stt || job.so), ngay, loai: job.loai || 'anh',
    prompt: slugTen(String(job.prompt || '').split(/\s+/).slice(0, 6).join(' ')).slice(0, 40),
    // Tên ảnh nguồn (ảnh đính kèm cuối — ảnh của chính việc này khi tạo video từ ảnh), bỏ đuôi.
    tenAnh: (String((job.thamChieu || []).slice(-1)[0] || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '')) || so3(job.stt || job.so)
  };
  const m = String(mau || '').trim() || MAU_TEN_MAC_DINH;
  const doan = m.replace(/\{(\w+)\}/g, (x, k) => (k in giaTri ? giaTri[k] : x))
    .split(/[\\/]+/).map(sachDoan).filter(Boolean);
  if (!doan.length) doan.push(`${giaTri.duAn}_${giaTri.so}`);
  const duoi = /audio\/(mpeg|mp3)/.test(mime) ? 'mp3' : /wav/.test(mime) ? 'wav' : /audio\/(mp4|x-m4a|aac)/.test(mime) ? 'm4a'
    : /mp4/.test(mime) ? 'mp4' : /webm/.test(mime) ? 'webm' : /quicktime/.test(mime) ? 'mov' : /png/.test(mime) ? 'png'
    : /jpe?g/.test(mime) ? 'jpg' : /webp/.test(mime) ? 'webp' : (/video/.test(mime) ? 'mp4' : /audio/.test(mime) ? 'mp3' : 'png');
  doan[doan.length - 1] += `${thuTu > 0 ? '_' + (thuTu + 1) : ''}.${duoi}`;
  return doan.join('/');
}

/** Kiểu tệp theo đuôi (file Flow tải về đĩa). */
function mimeTuDuoi(p) {
  const d = String(p || '').split('.').pop().toLowerCase();
  return { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' }[d] || 'application/octet-stream';
}

/**
 * Chọn prompt từ số `tu` đến số `den` (đếm từ 1, gồm cả hai đầu; bỏ trống = tới cùng).
 * Trả [{prompt, stt}] — stt giữ đúng số thứ tự gốc để đặt tên file / ghép ảnh theo dòng.
 */
function chonKhoang(prompts, tu, den) {
  const n = prompts.length;
  let a = parseInt(tu, 10), b = parseInt(den, 10);
  a = Number.isFinite(a) && a > 0 ? a : 1;
  b = Number.isFinite(b) && b > 0 ? Math.min(b, n) : n;
  const ra = [];
  for (let i = a; i <= b; i++) ra.push({ prompt: prompts[i - 1], stt: i });
  return ra;
}

/**
 * Việc kế tiếp nên chạy: cũ nhất trước.
 * uuTien(job) → true: lấy ngay (việc có chat dở của chính tài khoản này).
 * boQua(job)  → true: luồng này không được nhận (chat dở của tài khoản khác đang chạy).
 */
function viecKeTiep(jobs, uuTien, boQua) {
  const truoc = (a, b) => !b || a.taoLuc < b.taoLuc || (a.taoLuc === b.taoLuc && a.id < b.id);
  let tot = null, video = null;
  for (const j of jobs) {
    if (j.trangThai !== 'cho') continue;
    if (boQua && boQua(j)) continue;
    if (uuTien && uuTien(j)) return j;
    // Video nối từ ảnh vừa xong được chạy NGAY (song song với các ảnh còn lại), không xếp sau cả mẻ ảnh.
    if (j.tuAnh && truoc(j, video)) video = j;
    if (truoc(j, tot)) tot = j;
  }
  return video || tot;
}

/** Thời gian dự kiến (giây) = trung bình 10 việc xong gần nhất cùng loại, mặc định ảnh 35s, video 80s. */
function thoiGianDuKien(jobs, loai) {
  const xong = jobs.filter((j) => j.loai === loai && j.trangThai === 'xong' && j.batDauLuc && j.xongLuc)
    .sort((a, b) => b.xongLuc - a.xongLuc).slice(0, 10);
  if (!xong.length) return loai === 'nhac' ? 150 : loai === 'video' ? 80 : 35;   // Suno free ~2–3 phút một lần Create
  const tb = xong.reduce((s, j) => s + (j.xongLuc - j.batDauLuc), 0) / xong.length / 1000;
  return Math.max(10, Math.round(tb));
}

/** Tiến độ ước lượng 0–99 khi đang chạy (100 chỉ khi xong thật). */
function tienDoUoc(job, bayGio, duKienGiay) {
  if (job.trangThai === 'xong') return 100;
  if (job.trangThai !== 'chay' || !job.batDauLuc) return 0;
  const t = (bayGio - job.batDauLuc) / 1000;
  // Tới 90% theo dự kiến, sau đó bò chậm dần tới 99%, không bao giờ giả "xong".
  const p = t <= duKienGiay ? (t / duKienGiay) * 90 : 90 + 9 * (1 - Math.exp(-(t - duKienGiay) / duKienGiay));
  return Math.max(1, Math.min(99, Math.round(p)));
}

/** Đã đủ chưa để coi là xong: ảnh cần ≥1 ảnh, video cần ≥1 video. */
function daXong(loai, kq) {
  return loai === 'video' ? kq.soVideo > 0 : kq.soAnh > 0;
}

/**
 * Muse trả CHỮ mà không có ảnh/video, không còn gõ, không còn khung nào đang
 * nạp, và đã đợi đủ lâu → coi như Muse hỏi lại / từ chối.
 */
function laTraLoiChu(kq, giayTuKhiCoChu, choToiDa) {
  return !!kq.chu && !kq.dangGo && !kq.soKhungAnh && !kq.soKhungVideo && giayTuKhiCoChu >= choToiDa;
}

/**
 * Tài khoản nên chạy việc này. Mỗi dự án có danh sách tài khoản theo thứ tự ưu tiên: đầu = tài khoản
 * CHÍNH, sau = DỰ PHÒNG (chỉ dùng khi tài khoản trước lỗi).
 *  1. Chat dở (đã gửi) của một tài khoản còn dùng được → lấy tiếp ở đúng tài khoản đó.
 *  2. Tài khoản đầu tiên việc này CHƯA lỗi (j.tkLoi) và không đang tạm nghỉ.
 *  3. Đã lỗi ở mọi tài khoản nhưng còn lượt thử → tài khoản đầu tiên không tạm nghỉ.
 * @param dsTk  [id…] đã lọc tài khoản dùng được, theo thứ tự ưu tiên
 * @param nghi  (id) → true nếu tài khoản đang tạm nghỉ (lỗi liên tiếp / Muse mất kết nối)
 * @returns id hoặc null (không còn tài khoản nào chạy được)
 */
function taiKhoanChoViec(j, dsTk, nghi) {
  return taiKhoanChoViecDs(j, dsTk, nghi, 1)[0] || null;
}

/**
 * 1.2.0 — dự án chạy nhiều tài khoản CÙNG LÚC: các tài khoản việc này được phép chạy ngay bây giờ.
 * Nhóm chạy cùng lúc = `soSong` tài khoản dùng được (không nghỉ) đầu danh sách; tài khoản trong nhóm
 * nghỉ / hỏng thì tài khoản dự phòng kế tiếp tự vào nhóm. Việc đi tới tài khoản nào trong nhóm còn
 * rảnh trước (chưa lỗi việc này).
 *  1. Chat dở của một tài khoản còn dùng được → chỉ tài khoản đó.
 *  2. Các tài khoản trong nhóm chưa lỗi việc này.
 *  3. Cả nhóm đã lỗi việc này → tài khoản dự phòng đầu tiên chưa lỗi.
 *  4. Lỗi ở mọi tài khoản → [tài khoản đầu tiên dùng được] (điều phối tính là hết một vòng).
 * soSong = 1 cho đúng kết quả của taiKhoanChoViec cũ (chính → dự phòng theo thứ tự).
 * @returns [id…] (rỗng = không còn tài khoản nào chạy được)
 */
function taiKhoanChoViecDs(j, dsTk, nghi, soSong = 1) {
  const duoc = dsTk.filter((id) => !(nghi && nghi(id)));
  if (j.thread && j.taiKhoan && duoc.includes(j.taiKhoan)) return [j.taiKhoan];
  const loi = j.tkLoi || [];
  const nhom = duoc.slice(0, Math.max(1, parseInt(soSong, 10) || 1)).filter((id) => !loi.includes(id));
  if (nhom.length) return nhom;
  const chuaLoi = duoc.find((id) => !loi.includes(id));
  if (chuaLoi) return [chuaLoi];
  return duoc.length ? [duoc[0]] : [];
}

/** Thứ tự tự nhiên: anh2 < anh10. */
function soSanhTuNhien(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Tải về hàng loạt các việc đã chọn: việc nào lấy từ file trên máy, việc nào phải lấy lại từ chat Muse.
 * Chỉ việc đã Xong. File trên máy còn → chép; mất mà việc Muse còn đường dẫn chat + tài khoản → lấy lại
 * từ chat cũ (mở chat, KHÔNG gửi lại prompt); còn lại → không lấy được.
 * @returns {{coFile:[{j,i,nguon}], tuChat:[j], khongDuoc:[j], chuaXong:number}}  (theo thứ tự số việc)
 */
function keHoachTai(viec, tonTai) {
  const kq = { coFile: [], tuChat: [], khongDuoc: [], chuaXong: 0 };
  for (const j of [...viec].sort((a, b) => a.so - b.so || a.id - b.id)) {
    if (j.trangThai !== 'xong') { kq.chuaXong++; continue; }
    const files = j.files || [];
    const con = files.map((f, i) => ({ j, i, nguon: f })).filter((x) => x.nguon && tonTai(x.nguon));
    if (files.length && con.length === files.length) kq.coFile.push(...con);
    else if ((j.nen || 'muse') === 'muse' && j.thread && j.taiKhoan && !/\/thread\/new\b/.test(j.thread)) kq.tuChat.push(j);
    else if (con.length) kq.coFile.push(...con);
    else kq.khongDuoc.push(j);
  }
  return kq;
}

const HD = {
  TY_LE, MAU_MAC_DINH, MAU_TEN_MAC_DINH, MAU_TEN_ANH_MAC_DINH, PROMPT_VIDEO_MAC_DINH, slugTen, tachPrompt, timNhanVat, taoTinNhan, tenFile, mimeTuDuoi, chonKhoang,
  viecKeTiep, taiKhoanChoViec, taiKhoanChoViecDs, thoiGianDuKien, tienDoUoc, daXong, laTraLoiChu, soSanhTuNhien, keHoachTai
};
// Dùng chung cho tiến trình chính (require) và giao diện (<script> → window.HD).
if (typeof module !== 'undefined' && module.exports) module.exports = HD;
else window.HD = HD;
