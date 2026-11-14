'use strict';
// node tests/run.js — logic thuần + bộ điều phối với luồng giả + bài kiểm tĩnh soi mã nguồn.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const HD = require('../src/main/hang-doi');
const { DieuPhoi } = require('../src/main/dieu-phoi');
const { QuanLyTaiKhoan } = require('../src/main/tai-khoan');

let pass = 0;
const loi = [];
const choAsync = [];
function test(ten, fn) {
  try { fn(); pass++; console.log(`   ✓ ${ten}`); } catch (e) { loi.push(ten); console.log(`   ✗ ${ten}\n     ${e.message}`); }
}
function testAsync(ten, fn) {
  choAsync.push(Promise.resolve().then(fn).then(() => { pass++; console.log(`   ✓ ${ten}`); },
    (e) => { loi.push(ten); console.log(`   ✗ ${ten}\n     ${e.message}`); }));
}
/** Đọc nguồn, chuẩn hoá CRLF (máy build Windows checkout CRLF), bỏ dòng ghi chú. */
function docNguon(f, giuGhiChu) {
  const s = fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
  return giuGhiChu ? s : s.split('\n').filter((d) => !/^\s*(\/\/|\*|\/\*)/.test(d)).join('\n');
}

console.log('\n── hang-doi.js ───────────────────────────────');
test('tách prompt theo dòng (bỏ dòng trống, CRLF)', () => {
  assert.deepStrictEqual(HD.tachPrompt('a\r\n\r\n b \nc', 'dong'), ['a', 'b', 'c']);
});
test('tách prompt theo đoạn (prompt nhiều dòng)', () => {
  assert.deepStrictEqual(HD.tachPrompt('dòng 1\ndòng 2\n\n  \nđoạn 2', 'doan'), ['dòng 1\ndòng 2', 'đoạn 2']);
});
test('slug tên dự án tiếng Việt', () => {
  assert.strictEqual(HD.slugTen('Mặc định'), 'Mac_dinh');
  assert.strictEqual(HD.slugTen('Truyện người que #2'), 'Truyen_nguoi_que_2');
  assert.strictEqual(HD.slugTen('Đà Lạt'), 'Da_lat');
  assert.strictEqual(HD.slugTen('***'), 'Du_an');
});
test('tìm nhân vật: đúng nguyên từ, không phân biệt hoa thường', () => {
  const ds = [{ id: 1, ten: 'Lan' }, { id: 2, ten: 'Minh Anh' }, { id: 3, ten: '' }];
  assert.deepStrictEqual(HD.timNhanVat('lan đứng cạnh Minh Anh', ds).map((x) => x.id), [1, 2]);
  assert.deepStrictEqual(HD.timNhanVat('trời se lạnh, Lanh chanh', ds).map((x) => x.id), []);
  assert.deepStrictEqual(HD.timNhanVat('(Lan)', ds).map((x) => x.id), [1]);
});
test('câu lệnh: tỷ lệ + prompt + nhân vật + tham chiếu đánh số đúng', () => {
  const t = HD.taoTinNhan({ loai: 'anh', tyLe: '16:9', prompt: ' Lan ở biển ', thamChieu: ['a', 'b'] },
    [{ ten: 'Lan', moTa: 'tóc ngắn', anh: ['x', 'y'] }]);
  assert.ok(t.startsWith('Tạo 1 ảnh tỷ lệ 16:9: Lan ở biển'), t);
  assert.ok(t.includes('Nhân vật "Lan" là ảnh 1–2 đính kèm (tóc ngắn)'), t);
  assert.ok(t.includes('Dùng ảnh 3–4 đính kèm làm ảnh tham chiếu.'), t);
  assert.ok(!/\n\n/.test(t), 'không có dòng trống thừa');
});
test('câu lệnh video: ảnh đính kèm là khung hình đầu; không tham chiếu thì không có dòng thừa', () => {
  const v = HD.taoTinNhan({ loai: 'video', tyLe: '9:16', prompt: 'corgi', thamChieu: ['a'] }, []);
  assert.ok(v.startsWith('Tạo 1 video tỷ lệ 9:16: corgi'));
  assert.ok(v.includes('Dùng ảnh 1 đính kèm làm khung hình đầu'));
  const a = HD.taoTinNhan({ loai: 'anh', tyLe: '1:1', prompt: 'mèo', thamChieu: [] }, []);
  assert.strictEqual(a, 'Tạo 1 ảnh tỷ lệ 1:1: mèo\nChỉ trả về ảnh, không hỏi lại, không giải thích.');
});
test('câu lệnh theo mẫu người dùng', () => {
  assert.strictEqual(HD.taoTinNhan({ loai: 'anh', tyLe: '4:3', prompt: 'p' }, [], { anh: '[{tyLe}] {prompt}' }), '[4:3] p');
});
test('tên file: Mac_dinh/Mac_dinh_083.png, _2 khi nhiều file, đuôi theo mime', () => {
  const d = { ten: 'Mặc định' };
  assert.strictEqual(HD.tenFile(d, { so: 83 }, 'image/png', 0), 'Mac_dinh/Mac_dinh_083.png');
  assert.strictEqual(HD.tenFile(d, { so: 83 }, 'image/webp', 1), 'Mac_dinh/Mac_dinh_083_2.webp');
  assert.strictEqual(HD.tenFile(d, { so: 1200 }, 'video/mp4', 0), 'Mac_dinh/Mac_dinh_1200.mp4');
});
test('mẫu tên file: ký hiệu, thư mục con, ký tự cấm, không thoát ra ngoài bằng ..', () => {
  const d = { ten: 'Truyện người que' };
  const j = { so: 7, stt: 42, loai: 'video', prompt: 'Lan đứng ở ban công lúc hoàng hôn rực rỡ', taoLuc: new Date(2026, 9, 10).getTime() };
  assert.strictEqual(HD.tenFile(d, j, 'video/mp4', 0, '{duAn}_{stt}'), 'Truyen_nguoi_que_042.mp4');
  assert.strictEqual(HD.tenFile(d, j, 'video/mp4', 0, 'video/{ngay}/{stt}_{prompt}'), 'video/2026-10-10/042_Lan_dung_o_ban_cong_luc.mp4');
  assert.strictEqual(HD.tenFile(d, j, 'video/mp4', 0, '../../{stt}?:*'), '_/_/042___.mp4');
  assert.strictEqual(HD.tenFile(d, j, 'video/mp4', 0, '   '), 'Truyen_nguoi_que/Truyen_nguoi_que_007.mp4');
  assert.strictEqual(HD.tenFile(d, { so: 3 }, 'image/png', 0, '{stt}'), '003.png', 'thiếu stt thì dùng số hàng đợi');
});
test('chọn khoảng prompt: giữ số thứ tự gốc, bỏ trống = tới cuối, ngoài khoảng = rỗng', () => {
  const ds = ['a', 'b', 'c', 'd', 'e'];
  assert.deepStrictEqual(HD.chonKhoang(ds, 2, 4).map((x) => x.stt), [2, 3, 4]);
  assert.deepStrictEqual(HD.chonKhoang(ds, '', '').map((x) => x.prompt), ds);
  assert.deepStrictEqual(HD.chonKhoang(ds, 4, 99).map((x) => x.stt), [4, 5]);
  assert.deepStrictEqual(HD.chonKhoang(ds, 9, ''), []);
});
test('việc kế tiếp: cũ nhất trước, ưu tiên chat dở của mình, bỏ qua chat dở của người khác', () => {
  const ds = [
    { id: 1, trangThai: 'xong', taoLuc: 1 },
    { id: 2, trangThai: 'cho', taoLuc: 5 },
    { id: 3, trangThai: 'cho', taoLuc: 3, thread: 'x', taiKhoan: 'B' },
    { id: 4, trangThai: 'cho', taoLuc: 9, thread: 'y', taiKhoan: 'A' }
  ];
  assert.strictEqual(HD.viecKeTiep(ds).id, 3);
  assert.strictEqual(HD.viecKeTiep(ds, (j) => j.thread && j.taiKhoan === 'A').id, 4);
  assert.strictEqual(HD.viecKeTiep(ds, null, (j) => j.thread && j.taiKhoan !== 'A').id, 2);
  assert.strictEqual(HD.viecKeTiep([{ trangThai: 'loi' }]), null);
});
test('video nối từ ảnh được chạy trước các ảnh còn chờ (ảnh và video song song)', () => {
  const ds = [
    { id: 1, trangThai: 'cho', taoLuc: 1, loai: 'anh' },
    { id: 2, trangThai: 'cho', taoLuc: 2, loai: 'anh' },
    { id: 9, trangThai: 'cho', taoLuc: 50, loai: 'video', tuAnh: 7 },
    { id: 8, trangThai: 'cho', taoLuc: 40, loai: 'video', tuAnh: 6 }
  ];
  assert.strictEqual(HD.viecKeTiep(ds).id, 8, 'video nối cũ nhất');
  assert.strictEqual(HD.viecKeTiep(ds.slice(0, 2)).id, 1);
  assert.strictEqual(HD.viecKeTiep(ds, (j) => j.id === 2).id, 2, 'chat dở của mình vẫn ưu tiên nhất');
});
test('{tenAnh}: tên ảnh nguồn bỏ đuôi; không có ảnh thì bằng {stt}', () => {
  assert.strictEqual(HD.tenFile({ ten: 'A' }, { so: 4, stt: 2, thamChieu: ['C:\\anh\\canh 01.png'] }, 'video/mp4', 0, '{tenAnh}'), 'canh 01.mp4');
  assert.strictEqual(HD.tenFile({ ten: 'A' }, { so: 4, stt: 2, thamChieu: ['/x/nv.png', '/y/z/hai.jpg'] }, 'video/mp4', 0, 'v/{tenAnh}'), 'v/hai.mp4');
  assert.strictEqual(HD.tenFile({ ten: 'A' }, { so: 4, stt: 2 }, 'video/mp4', 0, '{tenAnh}'), '002.mp4');
});
test('tiến độ ước: không bao giờ 100 khi chưa xong, tăng dần, ≥1', () => {
  const j = { trangThai: 'chay', batDauLuc: 1000 };
  let truoc = 0;
  for (const t of [0, 5, 20, 35, 60, 200, 5000]) {
    const p = HD.tienDoUoc(j, 1000 + t * 1000, 35);
    assert.ok(p >= truoc && p >= 1 && p <= 99, `t=${t} p=${p}`);
    truoc = p;
  }
  assert.strictEqual(HD.tienDoUoc({ trangThai: 'xong' }, 0, 35), 100);
  assert.strictEqual(HD.tienDoUoc({ trangThai: 'cho' }, 0, 35), 0);
});
test('thời gian dự kiến = trung bình việc xong gần đây', () => {
  assert.strictEqual(HD.thoiGianDuKien([], 'video'), 80);
  const ds = [{ loai: 'anh', trangThai: 'xong', batDauLuc: 1, xongLuc: 30001 }, { loai: 'anh', trangThai: 'xong', batDauLuc: 1, xongLuc: 50001 }];
  assert.strictEqual(HD.thoiGianDuKien(ds, 'anh'), 40);
});
test('Muse trả chữ: chỉ coi là lỗi khi không gõ, không có khung, đã đợi đủ', () => {
  const kq = { chu: 'Bạn muốn gì?', dangGo: false, soKhungAnh: 0, soKhungVideo: 0 };
  assert.ok(HD.laTraLoiChu(kq, 61, 60));
  assert.ok(!HD.laTraLoiChu(kq, 30, 60));
  assert.ok(!HD.laTraLoiChu({ ...kq, dangGo: true }, 99, 60));
  assert.ok(!HD.laTraLoiChu({ ...kq, soKhungVideo: 1 }, 99, 60), 'đã có khung video (đang nạp) thì chưa phải lỗi');
});
test('xong: ảnh cần ảnh, video cần video', () => {
  assert.ok(HD.daXong('anh', { soAnh: 1, soVideo: 0 }));
  assert.ok(!HD.daXong('video', { soAnh: 1, soVideo: 0 }));
});
test('thứ tự tự nhiên cho ảnh trong thư mục', () => {
  assert.deepStrictEqual(['anh10.png', 'anh2.png', 'Anh1.png'].sort(HD.soSanhTuNhien), ['Anh1.png', 'anh2.png', 'anh10.png']);
});

console.log('\n── dieu-phoi.js (luồng giả) ───────────────────');
function khoGia(duLieu) {
  const data = { ...(duLieu || {}) };
  return { data, get: (k) => { const o = {}; for (const x of [].concat(k)) if (data[x] !== undefined) o[x] = data[x]; return o; }, set: (o) => Object.assign(data, o) };
}
function dungDieuPhoi(o = {}) {
  const store = khoGia(o.duLieu);
  const tk = new QuanLyTaiKhoan(store, () => {});
  const nhatKy = [];
  const dp = new DieuPhoi({
    store, taiKhoan: tk, log: (m, c) => nhatKy.push(`[${m}] ${c}`), bao: () => {},
    taoLuong: o.taoLuong || (() => ({ ranh: true, dung() {} })), huyLuong: o.huyLuong || (() => {}),
    docFile: (p) => ({ ten: path.basename(p), mime: 'image/png', b64: 'AA==' }),
    ghiFile: o.ghiFile || (() => {}), chuyenFile: o.chuyenFile || (() => {}), thuMucRaMacDinh: '/ra', thuMucTam: '/tam',
    tonTai: o.tonTai || (() => false), donDep: o.donDep, hetLuot: o.hetLuot, bayGio: o.bayGio, ramLuong: o.ramLuong, ramApp: o.ramApp,
    lenDrive: o.lenDrive, lenDriveWeb: o.lenDriveWeb, chayLaiFlow: o.chayLaiFlow, dsFile: o.dsFile
  });
  clearInterval(dp.hen); clearInterval(dp.henTheoDoi);
  return { dp, tk, store, nhatKy };
}
test('thêm: số bản, ảnh theo dòng, tự nhận nhân vật, số thứ tự liên tục theo dự án', () => {
  const { dp } = dungDieuPhoi();
  dp.nhanVat = [{ id: 'nv1', ten: 'Lan', anh: ['l.png'] }];
  const r = dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts: ['Lan ở biển', 'mèo'], soBan: 2, tuNhanVat: true,
    thamChieu: ['chung.png'], thamChieuTheoDong: [['a1.png'], ['a2.png']], tyLe: '4:3', hauTo: 'điện ảnh' });
  assert.strictEqual(r.so, 4);
  assert.deepStrictEqual(dp.viec.map((j) => j.so), [1, 2, 3, 4]);
  assert.deepStrictEqual(dp.viec[0].nhanVat, ['nv1']);
  assert.deepStrictEqual(dp.viec[2].nhanVat, []);
  assert.deepStrictEqual(dp.viec[2].thamChieu, ['chung.png', 'a2.png']);
  assert.strictEqual(dp.viec[0].prompt, 'Lan ở biển điện ảnh');
  assert.strictEqual(dp.viec[0].tyLe, '4:3');
  assert.strictEqual(dp.them({ prompts: ['  '] }).ok, false);
});
test('khoảng prompt: chỉ thêm prompt 2–3, ảnh theo dòng vẫn khớp số gốc', () => {
  const { dp } = dungDieuPhoi();
  const r = dp.them({ prompts: ['p1', 'p2', 'p3', 'p4'], tuSo: 2, denSo: 3, thamChieuTheoDong: [['a1'], ['a2'], ['a3'], ['a4']] });
  assert.strictEqual(r.so, 2);
  assert.deepStrictEqual(dp.viec.map((j) => [j.prompt, j.stt, j.thamChieu[0]]), [['p2', 2, 'a2'], ['p3', 3, 'a3']]);
  assert.strictEqual(dp.them({ prompts: ['x'], tuSo: 5 }).ok, false);
});
test('ảnh xong → tự thêm video dùng ảnh đó, chung prompt, cùng số thứ tự, chỉ một lần', () => {
  const { dp } = dungDieuPhoi();
  dp.them({ prompts: ['a', 'b'], tyLe: '16:9', tuSo: 2, chuoiVideo: { prompt: 'zoom chậm', tyLe: '' } });
  const anh = dp.viec[0];
  dp._ketThuc(anh, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  const v = dp.viec.find((j) => j.loai === 'video');
  assert.ok(v, 'có việc video');
  assert.deepStrictEqual([v.prompt, v.tyLe, v.stt, v.tuAnh, v.thamChieu], ['zoom chậm', '16:9', 2, anh.id, anh.files]);
  dp._ketThuc(anh, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  assert.strictEqual(dp.viec.filter((j) => j.loai === 'video').length, 1, 'tạo lại ảnh không nhân đôi video');
  dp.them({ loai: 'video', prompts: ['v'], chuoiVideo: { prompt: 'x' } });
  assert.strictEqual(dp.viec[dp.viec.length - 1].chuoi, null, 'video không nối tiếp');
});
test('1.4.6: chuoiVideo.prompts — prompt video RIÊNG từng ảnh theo số prompt ảnh, thiếu dòng → dùng chung / mặc định', () => {
  const { dp } = dungDieuPhoi();
  const r = dp.them({ prompts: ['a1', 'a2', 'a3', 'a4'], chuoiVideo: { prompt: 'chung', prompts: ['v1', '', 'v3'] } });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(dp.viec.map((j) => [j.stt, j.chuoi.prompt]), [[1, 'v1'], [2, 'chung'], [3, 'v3'], [4, 'chung']]);
  // Nối video: ảnh xong → việc video mang đúng prompt riêng của ảnh đó.
  const a3 = dp.viec.find((j) => j.stt === 3), a2 = dp.viec.find((j) => j.stt === 2);
  dp._ketThuc(a3, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  dp._ketThuc(a2, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  const v3 = dp.viec.find((j) => j.tuAnh === a3.id), v2 = dp.viec.find((j) => j.tuAnh === a2.id);
  assert.deepStrictEqual([v3.prompt, v3.stt, v3.loai], ['v3', 3, 'video']);
  assert.strictEqual(v2.prompt, 'chung');
  // Không có prompt dùng chung + chỉ có prompts → hợp lệ; ảnh thiếu dòng dùng prompt video mặc định.
  const b = dungDieuPhoi().dp;
  assert.strictEqual(b.them({ prompts: ['x1', 'x2', 'x3'], chuoiVideo: { prompt: '  ', prompts: ['r1'] } }).ok, true);
  assert.deepStrictEqual(b.viec.map((j) => j.chuoi && j.chuoi.prompt), ['r1', HD.PROMPT_VIDEO_MAC_DINH, HD.PROMPT_VIDEO_MAC_DINH]);
  // Chọn prompt số 3 → ảnh stt 3 lấy dòng 3 của file (không phải dòng 1).
  const c = dungDieuPhoi().dp;
  c.them({ prompts: ['a1', 'a2', 'a3', 'a4'], chonSo: '3', chuoiVideo: { prompt: 'chung', prompts: ['v1', 'v2', 'v3'] } });
  assert.deepStrictEqual(c.viec.map((j) => [j.stt, j.chuoi.prompt]), [[3, 'v3']]);
  // prompt rỗng + prompts toàn dòng rỗng → không có chuỗi video.
  const e = dungDieuPhoi().dp;
  e.them({ prompts: ['a'], chuoiVideo: { prompt: '', prompts: ['', ' '] } });
  assert.strictEqual(e.viec[0].chuoi, null);
});
test('1.4.6: giao diện có nút nhập file prompt riêng cho "Ảnh xong → tự tạo video" và "Tạo video từ thư mục ảnh"', () => {
  const ui = docNguon('src/ui/app.js'), m = docNguon('main.js'), html = docNguon('src/ui/index.html', true);
  for (const id of ['nutPromptRiengChuoi', 'ghiPromptRiengChuoi', 'boPromptRiengChuoi', 'nutPromptRiengThuMuc', 'ghiPromptRiengThuMuc', 'boPromptRiengThuMuc'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(/\n  nhapPromptRieng: /.test(m), 'LENH.nhapPromptRieng');
  assert.ok(/api\.call\('nhapPromptRieng'\)/.test(ui));
  assert.ok(/prompts: rieng/.test(ui), 'thamSoTao gửi chuoiVideo.prompts');
  assert.ok(/rieng: U\.rieng/.test(ui), 'luuUi lưu file prompt riêng');
  assert.ok(!/tất cả video dùng chung prompt bên dưới|tất cả dùng chung prompt bên dưới/.test(html), 'câu mô tả cũ đã sửa');
});
test('thư mục + mẫu tên riêng cho ảnh/video; tắt tải về → ghi vào thư mục tạm', () => {
  const ghi = [];
  const { dp } = dungDieuPhoi({ ghiFile: (p) => ghi.push(p.replace(/\\/g, '/')) });
  dp.datCaiDat({ thuMucAnh: '/A', thuMucVideo: '/V', tenAnh: 'anh_{stt}', tenVideo: '{duAn}/vid_{stt}', taiVideo: false });
  dp.them({ prompts: ['x'] });
  dp.them({ loai: 'video', prompts: ['y'] });
  dp._ketThuc(dp.viec[0], { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  dp._ketThuc(dp.viec[1], { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
  assert.deepStrictEqual(ghi, ['/A/anh_001.png', '/tam/mac-dinh/Mac_dinh/vid_001.mp4']);   // 1.4.1: thư mục tạm riêng từng dự án
  assert.strictEqual(dp.viec[1].tam, true);
  assert.strictEqual(dp.viec[0].tam, false);
});
test('không ghi đè file người khác: trùng tên thì thêm (2), Tạo lại thì ghi đè file của chính nó', () => {
  const daCo = new Set(['/ra/x_001.png']);
  const ghi = [];
  const { dp } = dungDieuPhoi({ tonTai: (p) => daCo.has(p.replace(/\\/g, '/')), ghiFile: (p) => { ghi.push(p.replace(/\\/g, '/')); daCo.add(p.replace(/\\/g, '/')); } });
  dp.datCaiDat({ tenAnh: 'x_{stt}' });
  dp.them({ prompts: ['a'] });
  const j = dp.viec[0];
  dp._ketThuc(j, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  assert.strictEqual(ghi[0], '/ra/x_001 (2).png');
  dp._ketThuc(j, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  assert.strictEqual(ghi[1], '/ra/x_001 (2).png', 'Tạo lại: cùng file của chính việc đó');
});
test('nâng cấp từ 1.0.0: thuMucRa cũ thành thư mục của cả ảnh lẫn video', () => {
  const { dp } = dungDieuPhoi({ duLieu: { caiDat: { thuMucRa: '/cu' } } });
  assert.deepStrictEqual([dp.thuMucRa('anh'), dp.thuMucRa('video'), dp.caiDat.thuMucRa], ['/cu', '/cu', undefined]);
});
test('chế độ Người mẫu: nhân vật chọn tay thắng tự nhận', () => {
  const { dp } = dungDieuPhoi();
  dp.nhanVat = [{ id: 'nv1', ten: 'Lan', anh: ['l.png'] }, { id: 'nv2', ten: 'Minh', anh: ['m.png'] }];
  dp.them({ prompts: ['Lan đi chơi'], nhanVatIds: ['nv2', 'khong-co'], tuNhanVat: true });
  assert.deepStrictEqual(dp.viec[0].nhanVat, ['nv2']);
});
test('mở app: việc đang chạy lúc tắt → về hàng chờ, GIỮ thread', () => {
  const { dp } = dungDieuPhoi({ duLieu: { viec: [{ id: 5, so: 1, duAn: 'mac-dinh', trangThai: 'chay', thread: 'http://t/1', buoc: 'tao', nhanVat: [], files: [] }] } });
  assert.strictEqual(dp.viec[0].trangThai, 'cho');
  assert.strictEqual(dp.viec[0].thread, 'http://t/1');
  assert.strictEqual(dp.idMoi, 6);
});
test('kết thúc lỗi: thử lại lần 1 giữ chat (nếu còn dùng được), lần sau gửi mới, hết lượt thì Lỗi', () => {
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ tuThuLai: 2 });
  dp.them({ prompts: ['a'] });
  const j = dp.viec[0];
  Object.assign(j, { thread: 't1', taiKhoan: 'tk-1' });
  dp._ketThuc(j, { ok: false, loi: 'quá giờ', giuThread: true }, null);
  assert.strictEqual(j.trangThai, 'cho'); assert.strictEqual(j.thread, 't1');
  dp._ketThuc(j, { ok: false, loi: 'quá giờ', giuThread: true }, null);
  assert.strictEqual(j.trangThai, 'cho'); assert.strictEqual(j.thread, '');
  dp._ketThuc(j, { ok: false, loi: 'quá giờ' }, null);
  assert.strictEqual(j.trangThai, 'loi'); assert.strictEqual(j.loi, 'quá giờ');
});
test('kết thúc: chưa đăng nhập → việc về hàng chờ, tài khoản bị đánh dấu', () => {
  const { dp, tk } = dungDieuPhoi();
  dp.them({ prompts: ['a'] });
  dp._ketThuc(dp.viec[0], { ok: false, canDangNhap: true }, tk.tim('tk-1'));
  assert.strictEqual(dp.viec[0].trangThai, 'cho');
  assert.strictEqual(tk.tim('tk-1').trangThai, 'can-dang-nhap');
  assert.strictEqual(dp.viec[0].thu, 0, 'không tính là một lần thử');
});
test('kết thúc thành công: ghi file đúng tên, đánh dấu tài khoản đã đăng nhập', () => {
  const ghi = [];
  const { dp, tk } = dungDieuPhoi({ ghiFile: (p, b) => ghi.push([p, b.length]) });
  dp.them({ prompts: ['a'] });
  dp._ketThuc(dp.viec[0], { ok: true, files: [{ mime: 'image/png', b64: 'AAAA' }, { mime: 'image/png', b64: 'AA==' }] }, tk.tim('tk-1'));
  assert.strictEqual(dp.viec[0].trangThai, 'xong');
  // 1.0.2: tên ảnh mặc định {stt}.
  assert.deepStrictEqual(ghi.map((x) => path.relative('/ra', x[0]).replace(/\\/g, '/')), ['001.png', '001_2.png']);
  assert.strictEqual(tk.tim('tk-1').trangThai, 'da-dang-nhap');
});
test('cài đặt bị kẹp trong khoảng an toàn; mẫu thiếu {prompt} trả về mẫu gốc', () => {
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ luongMoiTK: 99, nghiGiuaLanGui: -5, choAnhGiay: 'x', mau: { anh: 'không có chỗ prompt' } });
  assert.strictEqual(dp.caiDat.luongMoiTK, 20);
  assert.strictEqual(dp.caiDat.nghiGiuaLanGui, 0);
  assert.strictEqual(dp.caiDat.choAnhGiay, 180);
  assert.strictEqual(dp.caiDat.mau.anh, HD.MAU_MAC_DINH.anh);
});
testAsync('hết lượt mà còn việc lỗi → tự chạy lại tối đa N lượt; Tạo lại tay thì đếm lại từ đầu', async () => {
  let lanChay = 0;
  const taoLuong = () => ({ id: 'L', ranh: true, viec: null, dung() {},
    async chay(j) { this.ranh = false; lanChay++; await new Promise((r) => setTimeout(r, 5)); this.ranh = true; return { ok: false, loi: 'hỏng' }; } });
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong });
  dp.datCaiDat({ tuThuLai: 0, tuChayLaiLoi: 2, luongMoiTK: 1, nghiGiuaLanGui: 0 });
  dp.them({ prompts: ['a'] });
  dp.chayTatCa();
  for (let i = 0; i < 60 && dp.dangChay; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 15)); }
  const j = dp.viec[0];
  assert.strictEqual(lanChay, 3, 'chạy 1 lần + 2 lượt lại');
  assert.deepStrictEqual([j.trangThai, j.vongLai], ['loi', 2]);
  assert.ok(nhatKy.some((d) => /tự chạy lại 1 việc lỗi \(lượt 2\/2\)/.test(d)));
  dp.taoLai([j.id]);
  assert.strictEqual(j.vongLai, 0);
});
test('dự án: không xoá dự án cuối, xoá dự án xoá luôn việc của nó', () => {
  const { dp } = dungDieuPhoi();
  assert.strictEqual(dp.xoaDuAn('mac-dinh').ok, false);
  const d = dp.taoDuAn('Truyện người que');
  assert.strictEqual(d.id, 'truyen_nguoi_que');
  dp.them({ duAn: d.id, prompts: ['x'] });
  assert.strictEqual(dp.xoaDuAn(d.id).ok, true);
  assert.strictEqual(dp.viec.length, 0);
});
testAsync('điều phối: chỉ tài khoản CHÍNH chạy (dự phòng không mở luồng khi không lỗi), không giao một việc cho hai luồng', async () => {
  const daChay = [];
  const taoLuong = (a, stt) => ({
    id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j) { this.ranh = false; this.viec = j; daChay.push([this.id, j.id]); await new Promise((r) => setTimeout(r, 20)); this.ranh = true; this.viec = null; return { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }; }
  });
  const { dp, tk } = dungDieuPhoi({ taoLuong });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0 });
  dp.them({ prompts: ['1', '2', '3', '4', '5', '6', '7'] });
  dp.chayTatCa();
  for (let i = 0; i < 40 && dp.dangChay; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 30)); }
  dp._vong();   // nhịp kế tiếp của bộ hẹn giờ 1 giây: dọn luồng
  assert.strictEqual(dp.luong.length, 0, 'chạy xong thì dọn luồng');
  assert.strictEqual(new Set(daChay.map((x) => x[1])).size, 7);
  assert.strictEqual(daChay.length, 7, 'mỗi việc chạy đúng 1 lần');
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  assert.deepStrictEqual([...new Set(daChay.map((x) => x[0]))].sort(), ['tk-1-1', 'tk-1-2']);
});
/** Luồng giả: tài khoản nằm trong `hong` thì trả lỗi (hoặc kq riêng), còn lại xong. */
const luongGia = (daChay, hong, kq) => (a, stt) => ({
  id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
  async chay(j) {
    this.ranh = false; this.viec = j; daChay.push([a.id, j.so]);
    await new Promise((r) => setTimeout(r, 10)); this.ranh = true; this.viec = null;
    return hong.has(a.id) ? (kq || { ok: false, loi: 'Quá 180 giây chưa thấy kết quả', giuThread: true }) : { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
  }
});
async function chayHet(dp) { for (let i = 0; i < 200 && dp.dangChay; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 15)); } dp._vong(); }
testAsync('1.4.8: "Tạo ảnh xong hết rồi mới tạo video" — video chỉ bắt đầu khi không còn ảnh chạy / chờ; tắt thì chạy song song như cũ', async () => {
  const chay = async (bat) => {
    const nk = [];   // [loai, 'bd'|'xong', so]
    const taoLuong = (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
      async chay(j) { this.ranh = false; this.viec = j; nk.push([j.loai, 'bd', j.so]); await new Promise((r) => setTimeout(r, 25));
        nk.push([j.loai, 'xong', j.so]); this.ranh = true; this.viec = null;
        return { ok: true, files: [{ mime: j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] }; } });
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong });
    dp.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0, anhTruocVideo: bat });
    dp.them({ loai: 'video', prompts: ['v rời'] });
    dp.them({ prompts: ['a1', 'a2', 'a3'], chuoiVideo: { prompt: 'zoom' } });
    dp.chayTatCa();
    await chayHet(dp);
    return { dp, nk, nhatKy };
  };
  const { dp, nk, nhatKy } = await chay(true);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong') && dp.viec.filter((j) => j.loai === 'video').length === 4, JSON.stringify(dp.viec.map((j) => [j.loai, j.trangThai])));
  const anhXongCuoi = nk.map((x, i) => (x[0] === 'anh' && x[1] === 'xong' ? i : -1)).reduce((a, b) => Math.max(a, b));
  const videoBdDau = nk.findIndex((x) => x[0] === 'video' && x[1] === 'bd');
  assert.ok(videoBdDau > anhXongCuoi, `video đầu tiên phải bắt đầu sau ảnh cuối cùng xong: ${JSON.stringify(nk)}`);
  assert.ok(nhatKy.some((d) => /⏳ Ảnh xong hết rồi mới tạo video/.test(d)) && nhatKy.some((d) => /▶ Hết ảnh đang chạy/.test(d)), nhatKy.join('\n'));
  assert.strictEqual(dp.caiDat.anhTruocVideo, true);
  // Tắt → video rời chạy ngay cùng lúc với ảnh (như trước 1.4.8).
  const tat = await chay(false);
  const vd = tat.nk.findIndex((x) => x[0] === 'video' && x[1] === 'bd');
  const ax = tat.nk.map((x, i) => (x[0] === 'anh' && x[1] === 'xong' ? i : -1)).reduce((a, b) => Math.max(a, b));
  assert.ok(vd < ax, `tắt công tắc: video chạy song song với ảnh: ${JSON.stringify(tat.nk)}`);
  // Chung cả app, mặc định bật; bộ cũ không có khoá → bật.
  assert.strictEqual(dungDieuPhoi().dp.caiDat.anhTruocVideo, true);
  assert.strictEqual(dungDieuPhoi({ duLieu: { caiDat: { anhTruocVideo: false } } }).dp.caiDat.anhTruocVideo, false);
});
testAsync('1.4.8: giữ video — video bấm Chạy riêng không bị giữ; ảnh còn chờ mà mọi tài khoản ảnh đang nghỉ thì video cứ chạy', async () => {
  const daChay = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongGia(daChay, new Set()) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  dp.them({ prompts: ['a1'] });
  dp.them({ loai: 'video', prompts: ['v1'] });
  const [a, v] = dp.viec;
  // Ảnh chờ có tài khoản chạy được → video bị giữ (không vào nhamToi).
  let nham = new Map([[a, ['tk-1']], [v, ['tk-1']]]);
  dp._giuVideo(nham);
  assert.deepStrictEqual([...nham.keys()], [a]);
  // Video chạy riêng → không giữ.
  v.chayRieng = true;
  nham = new Map([[a, ['tk-1']], [v, ['tk-1']]]);
  dp._giuVideo(nham);
  assert.deepStrictEqual([...nham.keys()], [a, v]);
  delete v.chayRieng;
  // Ảnh chờ nhưng không tài khoản nào chạy được ngay (nghỉ / hết lượt) → video cứ chạy.
  nham = new Map([[a, []], [v, ['tk-1']]]);
  dp._giuVideo(nham);
  assert.deepStrictEqual([...nham.keys()], [a, v]);
  // Ảnh đang chạy → giữ.
  a.trangThai = 'chay';
  nham = new Map([[v, ['tk-1']]]);
  dp._giuVideo(nham);
  assert.strictEqual(nham.size, 0);
});
test('1.4.8: trang Muse chạy ngầm có preload "Máy mượt" (rAF thưa, dừng video tự phát), khung đăng nhập thì không', () => {
  const fs = require('fs');
  const m = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const tao = m.slice(m.indexOf('function taoCuaSoAn('), m.indexOf('function dongCuaSoAn('));
  assert.ok(/preload: path\.join\(__dirname, 'src\/main\/preload-muse\.js'\)/.test(tao) && /--muse-nhe=\$\{nhe \? 1 : 0\}/.test(tao), 'taoCuaSoAn gắn preload-muse cho Muse');
  assert.ok(/\(tk\.nen \|\| 'muse'\) === 'muse'/.test(tao), 'chỉ trang Muse');
  const view = m.slice(m.indexOf('const WEB_PREFS'), m.indexOf('function taoCuaSoAn('));
  assert.ok(!/preload-muse/.test(view), 'khung đăng nhập không dùng preload-muse');
  assert.ok(/window\.__museNhe !== undefined && \(window\.__museNhe = \$\{nhe\}\)/.test(m), 'đổi Máy mượt giữa chừng thì báo trang Muse');
  // Chạy hàm cài của preload trên window giả: rAF thưa khi bật, như cũ khi tắt; cancel đúng; play → pause.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'preload-muse.js'), 'utf8');
  const caiNhe = new Function(`${src.slice(src.indexOf('function caiNhe'), src.indexOf('\ntry {'))}; return caiNhe;`)();
  const goiRaf = [], huy = [], nghe = {};
  const timers = [];
  const w = { requestAnimationFrame: (cb) => { goiRaf.push(cb); return goiRaf.length; }, cancelAnimationFrame: (k) => huy.push(k) };
  const g = { window: w, document: { addEventListener: (ten, f, cap) => { nghe[ten] = [f, cap]; } },
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout: (k) => { timers[k - 1] = null; } };
  const chay = new Function('window', 'document', 'setTimeout', 'clearTimeout', `(${caiNhe.toString()})(true)`);
  chay(g.window, g.document, g.setTimeout, g.clearTimeout);
  assert.strictEqual(w.__museNhe, true);
  let lan = 0;
  const k = w.requestAnimationFrame(() => lan++);
  assert.ok(k > 1e9 && goiRaf.length === 0 && timers[0][1] === 200, 'bật: chờ 200 ms rồi mới xin khung');
  timers[0][0](); goiRaf[0](123);
  assert.strictEqual(lan, 1);
  const k2 = w.requestAnimationFrame(() => lan++);
  w.cancelAnimationFrame(k2);
  assert.strictEqual(timers[1], null, 'cancel huỷ cả hẹn giờ chờ');
  w.cancelAnimationFrame(5); assert.deepStrictEqual(huy, [5], 'mã rAF thật (trước khi cài) vẫn huỷ được');
  w.__museNhe = false;
  w.requestAnimationFrame(() => lan++);
  assert.strictEqual(goiRaf.length, 2, 'tắt: xin khung ngay');
  const [f, cap] = nghe.play;
  let dung = 0;
  w.__museNhe = true; f({ target: { pause: () => dung++ } });
  w.__museNhe = false; f({ target: { pause: () => dung++ } });
  assert.deepStrictEqual([cap, dung], [true, 1], 'play → dừng khi bật, nghe ở pha bắt');
});
test('chọn tài khoản cho việc: chat dở → đúng tài khoản; chưa lỗi ở đâu → tài khoản chính; lỗi → dự phòng kế tiếp', () => {
  const ds = ['A', 'B', 'C'];
  assert.strictEqual(HD.taiKhoanChoViec({}, ds), 'A');
  assert.strictEqual(HD.taiKhoanChoViec({ tkLoi: ['A'] }, ds), 'B');
  assert.strictEqual(HD.taiKhoanChoViec({ tkLoi: ['A', 'B'] }, ds), 'C');
  assert.strictEqual(HD.taiKhoanChoViec({ tkLoi: ['A', 'B', 'C'] }, ds), 'A', 'lỗi hết mà còn lượt → lại từ chính');
  assert.strictEqual(HD.taiKhoanChoViec({ thread: 't', taiKhoan: 'B' }, ds), 'B', 'chat dở lấy tiếp đúng chỗ');
  assert.strictEqual(HD.taiKhoanChoViec({ thread: 't', taiKhoan: 'B' }, ds, (id) => id === 'B'), 'A', 'tài khoản của chat dở đang nghỉ → tài khoản khác');
  assert.strictEqual(HD.taiKhoanChoViec({}, ds, (id) => id === 'A'), 'B', 'chính đang nghỉ → dự phòng');
  assert.strictEqual(HD.taiKhoanChoViec({}, ['A'], () => true), null);
});
testAsync('tài khoản chính lỗi → việc chuyển NGAY sang dự phòng; lỗi liên tiếp → chính tạm nghỉ, việc sau chạy thẳng dự phòng', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongGia(daChay, new Set(['tk-1'])) });
  tk.them('Hai'); tk.them('Ba');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  const d = dp.taoDuAn('P', ['tk-1', 'ba']);       // chính tk-1, dự phòng "Ba"; "Hai" không thuộc dự án
  dp.them({ duAn: d.id, prompts: ['1', '2', '3', '4'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.taiKhoan === 'ba'), dp.viec.map((j) => j.trangThai + j.taiKhoan).join());
  assert.ok(!daChay.some((x) => x[0] === 'hai'), 'tài khoản ngoài dự án không bao giờ chạy');
  assert.strictEqual(daChay.filter((x) => x[0] === 'tk-1').length, 2, 'chính lỗi 2 việc liền thì tạm nghỉ, không thử thêm');
  assert.ok(nhatKy.some((x) => /↪ #1 .*chuyển sang "Ba"/.test(x)));
  assert.ok(nhatKy.some((x) => /"Muse 1": lỗi 2 việc liên tiếp, lần gần nhất: .+ — tạm nghỉ/.test(x)));
});
testAsync('một tài khoản: lỗi thì thử lại như cũ (không tạm nghỉ)', async () => {
  const daChay = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongGia(daChay, new Set(['tk-1'])) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0 });
  dp.them({ prompts: ['1', '2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.strictEqual(daChay.length, 4, 'mỗi việc 1 lần + 1 lần thử lại');
  assert.ok(dp.viec.every((j) => j.trangThai === 'loi'));
});
// 1.4.9: luồng giả — tài khoản trong `treo` đứng mãi (như trang ngầm sập / tải file đứng), trả lời khi bài kiểm gọi `tha`.
const luongTreo = (daChay, treo, tha) => (a, stt) => ({
  id: `${a.id}-${stt}`, ranh: true, viec: null, dungLan: 0, dung() { this.dungLan++; },
  async chay(j) {
    this.ranh = false; this.viec = j; daChay.push([a.id, j.so]);
    if (treo.has(a.id)) await new Promise((r) => tha.push(r));      // không bao giờ tự trả lời — dung() cũng không cắt được
    else await new Promise((r) => setTimeout(r, 10));
    this.ranh = true; this.viec = null;
    return { ok: true, files: [{ mime: 'image/png', b64: treo.has(a.id) ? 'TUFOR0hJ' : 'AA==' }] };
  }
});
testAsync('1.4.9 canh treo: việc đứng mãi (99%) quá hạn → bỏ, đóng luồng treo, chạy ở tài khoản kế tiếp; kết quả muộn của luồng treo bị bỏ', async () => {
  const daChay = [], tha = [], huy = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongTreo(daChay, new Set(['tk-1']), tha), huyLuong: (l) => huy.push(l) });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0, choAnhGiay: 180 });
  const d = dp.taoDuAn('P', ['tk-1', 'hai']);
  dp.them({ duAn: d.id, prompts: ['một'] });
  dp.chayTatCa();
  for (let i = 0; i < 20 && !tha.length; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 10)); }
  const j = dp.viec[0];
  assert.deepStrictEqual([j.trangThai, j.taiKhoan, tha.length], ['chay', 'tk-1', 1]);
  // Chưa quá hạn (180 s + 600 s) → vẫn chờ.
  const x = dp.luong.find((y) => y.taiKhoanId === 'tk-1');
  x.giaoLuc = Date.now() - (180 + 590) * 1000;
  dp._vong();
  assert.deepStrictEqual([j.trangThai, huy.length], ['chay', 0], 'chưa tới hạn cứng thì không bỏ');
  x.giaoLuc = Date.now() - (180 + 601) * 1000;
  await chayHet(dp);
  assert.deepStrictEqual([j.trangThai, j.taiKhoan], ['xong', 'hai'], JSON.stringify([j.trangThai, j.taiKhoan, j.loi]));
  assert.strictEqual(huy.filter((l) => /^tk-1-/.test(l.id)).length, 1, 'luồng treo bị đóng (cửa sổ ngầm huỷ, mở luồng mới)');
  assert.ok(huy[0].id.startsWith('tk-1-') && huy[0].dungLan >= 1 && !dp.luong.some((y) => y.luong === huy[0]), huy.map((l) => l.id).join());
  assert.ok(nhatKy.some((t) => /⏱ .*#1: Treo quá 13 phút.*đổi tài khoản/.test(t)), nhatKy.join('\n'));
  assert.ok(nhatKy.some((t) => /↪ #1 Treo quá 13 phút.*\(ở "Muse 1"\) — chuyển sang "Hai"/.test(t)), nhatKy.join('\n'));
  assert.strictEqual(dp.loiLienTiep['tk-1'], 1, 'treo tính là một lỗi của tài khoản treo');
  // Luồng treo trả lời muộn → bỏ, không ghi đè kết quả ở "Hai".
  const files = j.files.slice();
  tha.forEach((r) => r());
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual([j.trangThai, j.taiKhoan, j.files], ['xong', 'hai', files]);
  // Flow không qua canh treo của điều phối (luồng Flow tự có hạn treo theo từng việc).
  const f = dungDieuPhoi().dp;
  f.luong = [{ taiKhoanId: 'f', giaoLuc: 1, viecGiao: {}, luong: { nen: 'flow', ranh: false, viec: {} } }];
  f._canhTreo();
  assert.strictEqual(f.luong.length, 1);
});
testAsync('1.4.9 nút "Đổi tài khoản": việc đang chạy (kể cả đang treo) chuyển NGAY sang tài khoản kế tiếp, không tính lỗi; một tài khoản → báo không đổi được', async () => {
  const daChay = [], tha = [], huy = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongTreo(daChay, new Set(['tk-1', 'hai']), tha), huyLuong: (l) => huy.push(l) });
  tk.them('Hai'); tk.them('Ba');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  const d = dp.taoDuAn('P', ['tk-1', 'hai', 'ba']);
  dp.them({ duAn: d.id, prompts: ['một'] });
  dp.chayTatCa();
  for (let i = 0; i < 20 && !tha.length; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 10)); }
  const j = dp.viec[0];
  assert.strictEqual(j.taiKhoan, 'tk-1');
  // Muse 1 → Hai (kế tiếp trong thứ tự của dự án).
  let r = dp.doiTaiKhoan([j.id]);
  assert.deepStrictEqual(r.doi, [{ so: 1, tu: 'Muse 1', den: 'Hai' }]);
  for (let i = 0; i < 20 && tha.length < 2; i++) { dp._vong(); await new Promise((r2) => setTimeout(r2, 10)); }
  assert.deepStrictEqual([j.trangThai, j.taiKhoan], ['chay', 'hai']);
  assert.deepStrictEqual(huy.map((l) => l.id), ['tk-1-1'], 'luồng cũ (đang treo) bị đóng');
  // Hai cũng treo; Ba đang nghỉ → bỏ qua Ba, quay vòng về Muse 1.
  dp.nghiDen.ba = Date.now() + 60000;
  r = dp.doiTaiKhoan([j.id]);
  assert.deepStrictEqual(r.doi.map((x) => x.den), ['Muse 1']);
  delete dp.nghiDen.ba;
  // Thứ tự quay vòng tk-1 → hai → ba: từ Muse 1 lại sang Hai, từ Hai sang Ba.
  for (let i = 0; i < 20 && tha.length < 3; i++) { dp._vong(); await new Promise((r2) => setTimeout(r2, 10)); }
  r = dp.doiTaiKhoan([j.id]);
  assert.deepStrictEqual(r.doi.map((x) => x.den), ['Hai']);
  for (let i = 0; i < 20 && tha.length < 4; i++) { dp._vong(); await new Promise((r2) => setTimeout(r2, 10)); }
  r = dp.doiTaiKhoan([j.id]);
  assert.deepStrictEqual(r.doi.map((x) => x.den), ['Ba']);
  await chayHet(dp);
  assert.deepStrictEqual([j.trangThai, j.taiKhoan], ['xong', 'ba'], JSON.stringify([j.trangThai, j.taiKhoan, j.loi]));
  assert.deepStrictEqual([dp.loiLienTiep['tk-1'] || 0, dp.loiLienTiep.hai || 0, j.thu || 0], [0, 0, 0], 'đổi tay không tính lỗi / lần thử');
  assert.ok(nhatKy.some((t) => /⇄ #1: đổi tài khoản tay "Muse 1" → "Hai"/.test(t)), nhatKy.join('\n'));
  tha.forEach((f) => f());
  await new Promise((r2) => setTimeout(r2, 20));
  assert.deepStrictEqual([j.trangThai, j.taiKhoan, j.files.length], ['xong', 'ba', 1], 'kết quả muộn của luồng cũ bị bỏ');
  // Việc đã xong / chờ chưa có tài khoản → không đổi; dự án một tài khoản → báo lỗi rõ.
  assert.strictEqual(dp.doiTaiKhoan([j.id]).doi.length, 0);
  const m = dungDieuPhoi({ taoLuong: luongTreo([], new Set(['tk-1']), []) });
  m.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  m.dp.them({ prompts: ['x'] });
  m.dp.chayTatCa();
  for (let i = 0; i < 10; i++) { m.dp._vong(); await new Promise((r2) => setTimeout(r2, 10)); }
  const k = m.dp.doiTaiKhoan([m.dp.viec[0].id]);
  assert.ok(!k.ok && /Không có tài khoản Muse nào khác dùng được cho #1/.test(k.loi), JSON.stringify(k));
  assert.strictEqual(m.dp.viec[0].trangThai, 'chay', 'không đổi được thì việc vẫn chạy như cũ');
});
test('1.4.9 luồng Muse: hạn từng bước — lấy file / hỏi trang / mở trang đứng mãi thì luồng vẫn trả lời (không treo)', () => {
  const { execFileSync } = require('child_process');
  const ma = `
    const { Luong } = require(${JSON.stringify(path.join(__dirname, '../src/main/luong'))});
    const cach = process.argv[1];
    const wc = { isDestroyed: () => false,
      loadURL: () => (cach === 'mo' ? new Promise(() => {}) : Promise.resolve()),
      executeJavaScript: (c) => {
        if (/phienBan/.test(c)) return Promise.resolve(true);
        if (/trangThai\\(\\)/.test(c)) return Promise.resolve({ coONhap: true });
        if (/gui\\(/.test(c)) return Promise.resolve({ ok: true, thread: 'https://muse/thread/1' });
        if (/ketQua\\(\\)/.test(c)) return cach === 'hoi' ? new Promise(() => {}) : Promise.resolve({ soAnh: 1, soVideo: 0 });
        if (/layFile/.test(c)) return cach === 'mo' ? Promise.resolve([{ loai: 'anh', mime: 'image/png', b64: 'AA==' }]) : new Promise(() => {});
        return Promise.resolve(0);
      } };
    const l = new Luong({ id: 'L', wc, nguon: '', goc: 'https://muse' });
    const t = Date.now();
    l.chay({ so: 7, loai: 'anh' }, { tinNhan: 'x', choToiDaGiay: 60, choChuGiay: 30, choGui: async () => {}, capNhat: () => {} })
      .then((r) => { console.log(JSON.stringify({ r, ms: Date.now() - t })); process.exit(0); });
    setTimeout(() => { console.log('TREO'); process.exit(0); }, 30000);`;
  const env = { ...process.env, MUSE_HAN_GOI_MS: '300', MUSE_HAN_LAY_FILE_MS: '400', MUSE_HAN_MO_TRANG_MS: '300', MUSE_HAN_GUI_MS: '300' };
  const chay = (cach) => { const o = execFileSync(process.execPath, ['-e', ma, cach], { env, encoding: 'utf8' }).trim(); assert.notStrictEqual(o, 'TREO', cach); return JSON.parse(o); };
  const lay = chay('lay');
  assert.ok(!lay.r.ok && /Muse đã trả kết quả nhưng không lấy được file \(trang Muse không trả lời quá 0 giây\)/.test(lay.r.loi) && !lay.r.giuThread, JSON.stringify(lay));
  const hoi = chay('hoi');
  assert.ok(!hoi.r.ok && /Trang Muse hỏng: trang Muse không trả lời/.test(hoi.r.loi), JSON.stringify(hoi));
  const mo = chay('mo');
  assert.ok(mo.r.ok, 'mở trang đứng (loadURL không xong) vẫn chạy tiếp tới lấy kết quả: ' + JSON.stringify(mo));
  // Trong trang: tải file gốc có hạn (AbortController), lấy file truyền hạn xuống.
  const m = docNguon('src/inject/muse-trang.js'), l = docNguon('src/main/luong.js');
  assert.ok(/async function taiBlob\(url, hanMs\)/.test(m) && /ac\.abort\(\)/.test(m) && !/await fetch\(img\.src\)|await fetch\(v\.currentSrc/.test(m));
  assert.ok(/hanMs: HAN_LAY_FILE_MS - 15000/.test(l));
});
test('1.4.12 laHetLuot: Muse báo hết lượt tạo (24 giờ / hôm nay / limit) — không nhầm từ chối ảnh, chặn khu vực, trả lời thường', () => {
  const co = ['Bạn đã hết lượt tạo video trong 24 giờ qua. Vui lòng thử lại sau.', 'Mình chưa thể tạo video vì bạn đã đạt giới hạn tạo video trong 24 giờ qua.',
    "You've reached your daily limit for video generation. Try again tomorrow.", 'Video generation limit reached. Please try again in 24 hours.',
    'Lượt tạo video hôm nay đã hết', 'Bạn đã dùng hết lượt tạo ảnh hôm nay'];
  const khong = ['Mình không thể tạo video từ ảnh này.', 'Đây là video của bạn!', 'Here is your image', 'Hãy mô tả giới hạn của bức ảnh',
    'Lỗi 403: không khả dụng tại khu vực của bạn', ''];
  assert.deepStrictEqual(co.map(HD.laHetLuot), co.map(() => true));
  assert.deepStrictEqual(khong.map(HD.laHetLuot), khong.map(() => false));
  assert.deepStrictEqual(co.map(HD.laTuChoi), co.map(() => false), 'hết lượt không bị coi là "từ chối ảnh" (bản cũ: việc sang Flow)');
  assert.strictEqual(HD.laTuChoi(khong[0]), true);
});
testAsync('1.4.12 hết lượt video 24 giờ: việc sang NGAY tài khoản kế tiếp, không tính lỗi; tài khoản thôi nhận video 24 giờ nhưng vẫn tạo ảnh', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, dung() {},
    async chay(j) {
      this.ranh = false; daChay.push([a.id, j.loai, j.so]); await new Promise((r) => setTimeout(r, 5)); this.ranh = true;
      if (a.id === 'tk-1' && j.loai === 'video') return { ok: false, chanLoai: true, hetLuotLoai: true, loi: 'Muse báo hết lượt tạo video: "Bạn đã hết lượt tạo video trong 24 giờ qua."' };
      return { ok: true, files: [{ mime: j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] };
    } }) });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0, anhTruocVideo: false });
  const d = dp.taoDuAn('P', ['tk-1', 'hai']);
  dp.them({ duAn: d.id, loai: 'video', prompts: ['v1'] });
  dp.chayTatCa();
  await chayHet(dp);
  const v = dp.viec[0];
  assert.deepStrictEqual([v.trangThai, v.taiKhoan, v.thu || 0, dp.loiLienTiep['tk-1'] || 0], ['xong', 'hai', 0, 0], JSON.stringify(v));
  assert.deepStrictEqual(daChay.map((x) => x[0]), ['tk-1', 'hai'], 'chỉ thử Muse 1 một lần rồi sang Hai ngay');
  const a = tk.tim('tk-1');
  assert.ok(a.chanVideoDen > Date.now() + 23.9 * 3600e3 && /hết lượt tạo video/.test(a.lyDoChanVideo), JSON.stringify(a));
  assert.ok(nhatKy.some((x) => /↪ #1 chuyển ngay sang "Hai" — không tính lỗi/.test(x)), nhatKy.join('\n'));
  // Video sau không vào Muse 1 nữa; ảnh vẫn vào Muse 1.
  daChay.length = 0;
  dp.them({ duAn: d.id, loai: 'video', prompts: ['v2', 'v3'] });
  dp.them({ duAn: d.id, loai: 'anh', prompts: ['a1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(daChay.filter((x) => x[1] === 'video').every((x) => x[0] === 'hai') && daChay.some((x) => x[1] === 'anh' && x[0] === 'tk-1'), JSON.stringify(daChay));
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
});
test('1.4.12 luồng Muse: Muse trả lời "hết lượt tạo video" → báo ngay (không chờ đủ thời gian trả chữ), không phải "từ chối"', () => {
  const { execFileSync } = require('child_process');
  const ma = `
    const { Luong } = require(${JSON.stringify(path.join(__dirname, '../src/main/luong'))});
    const wc = { isDestroyed: () => false, loadURL: () => Promise.resolve(),
      executeJavaScript: (c) => {
        if (/phienBan/.test(c)) return Promise.resolve(true);
        if (/trangThai\\(\\)/.test(c)) return Promise.resolve({ coONhap: true });
        if (/gui\\(/.test(c)) return Promise.resolve({ ok: true, thread: 'https://muse/thread/1' });
        if (/ketQua\\(\\)/.test(c)) return Promise.resolve({ soAnh: 0, soVideo: 0, soKhungAnh: 0, soKhungVideo: 0, dangGo: false, chu: 'Bạn đã hết lượt tạo video trong 24 giờ qua. Vui lòng thử lại sau.' });
        return Promise.resolve(0);
      } };
    const l = new Luong({ id: 'L', wc, nguon: '', goc: 'https://muse' });
    const t = Date.now();
    l.chay({ so: 3, loai: 'video' }, { tinNhan: 'x', choToiDaGiay: 300, choChuGiay: 120, choGui: async () => {}, capNhat: () => {} })
      .then((r) => { console.log(JSON.stringify({ r, ms: Date.now() - t })); process.exit(0); });`;
  const o = JSON.parse(execFileSync(process.execPath, ['-e', ma], { encoding: 'utf8' }).trim());
  assert.ok(o.r.chanLoai && o.r.hetLuotLoai && !o.r.tuChoi && /Muse báo hết lượt tạo video: "Bạn đã hết lượt/.test(o.r.loi), JSON.stringify(o));
  assert.ok(o.ms < 10000, `báo ngay sau lần hỏi kết quả đầu, không chờ 120 s trả chữ (${o.ms} ms)`);
});

// 1.4.12: luồng kiểm việc dở giả — kq(j) quyết định kết quả mở lại chat cũ; ghi lại ctx (chiKiem, không gửi).
const luongKiem = (nhat, kq) => (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
  async chay(j, ctx) {
    this.ranh = false; this.viec = j;
    nhat.push({ tk: a.id, stt, so: j.so, thread: j.thread, chiKiem: !!ctx.chiKiem });
    ctx.capNhat({ buoc: j.thread ? 'mo-lai' : 'mo-trang' });
    if (!j.thread) ctx.capNhat({ buoc: 'gui', guiLuc: Date.now() });
    if (!j.thread) ctx.capNhat({ thread: `https://muse/thread/${a.id}-${j.so}`, buoc: 'tao' });
    await new Promise((r) => setTimeout(r, 5));
    this.ranh = true; this.viec = null;
    return kq(j, ctx, a);
  } });
const XONG = { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] };
/** Dữ liệu như lúc app tắt đột ngột: việc video Muse #1 đang chạy ở Muse 1 đã có chat. */
function duLieuTatGiuaChung(them = {}) {
  const { dp, store } = dungDieuPhoi();
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0, anhTruocVideo: false });
  dp.them({ loai: 'video', prompts: ['mèo chạy'] });
  Object.assign(dp.viec[0], { trangThai: 'chay', taiKhoan: 'tk-1', thread: 'https://muse/thread/cu', buoc: 'tao', batDauLuc: Date.now() - 60000 }, them);
  dp.luu();
  return JSON.parse(JSON.stringify(store.data));
}
testAsync('1.4.12 mở app sau khi tắt giữa chừng: việc Muse dở được KIỂM chat cũ trước — xong rồi thì tải về, không gửi lại prompt', async () => {
  const nhat = [];
  const { dp, nhatKy } = dungDieuPhoi({ duLieu: duLieuTatGiuaChung(), taoLuong: luongKiem(nhat, () => XONG) });
  const j = dp.viec[0];
  assert.deepStrictEqual([j.trangThai, j.thread, dp.choKiem.has(j.id)], ['cho', 'https://muse/thread/cu', true]);
  // Bấm Chạy trước khi kiểm xong → việc chưa được giao cho luồng nào (không gửi lại).
  dp.chayTatCa();
  dp._vong();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(nhat, [], 'chưa kiểm thì không giao việc dở cho luồng chạy');
  assert.strictEqual(dp.kiemKhiMo().so, 1);
  await chayHet(dp);
  assert.deepStrictEqual(nhat, [{ tk: 'tk-1', stt: 'kiem', so: 1, thread: 'https://muse/thread/cu', chiKiem: true }], JSON.stringify(nhat));
  assert.deepStrictEqual([j.trangThai, j.taiKhoan, j.files.length], ['xong', 'tk-1', 1]);
  assert.ok(nhatKy.some((x) => /🔎 #1: chat cũ ở "Muse 1" đã có kết quả — đã tải về, không tạo lại/.test(x)), nhatKy.join('\n'));
});
testAsync('1.4.12 kiểm việc dở: Muse còn đang tạo → giữ chat, hẹn kiểm lại; chat trống → chạy như thường ở tài khoản cũ (chờ tiếp chat, không gửi lại)', async () => {
  const nhat = [];
  let lan = 0;
  const { dp, nhatKy } = dungDieuPhoi({ duLieu: duLieuTatGiuaChung(), taoLuong: luongKiem(nhat, (j, ctx) => {
    if (ctx.chiKiem) return ++lan === 1 ? { ok: false, chuaXong: true, dangTao: true, giuThread: true } : { ok: false, chuaXong: true, dangTao: false, giuThread: true };
    return XONG;
  }) });
  const j = dp.viec[0];
  dp.kiemKhiMo();
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(j.trangThai === 'cho' && j.thread === 'https://muse/thread/cu' && j.kiemLai > Date.now(), JSON.stringify(j));
  assert.ok(nhatKy.some((x) => /Muse vẫn đang tạo trong chat cũ ở "Muse 1" — giữ chat, kiểm lại sau 2 phút/.test(x)));
  dp.chayTatCa();
  dp._vong();
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(nhat.length, 1, 'đang hẹn kiểm lại thì không giao');
  j.kiemLai = Date.now() - 1;           // tới giờ kiểm lại
  dp._vong();
  await chayHet(dp);
  // Lần kiểm 2: chat trống → thôi giữ; tài khoản cũ dùng được → luồng chạy MỞ LẠI chat cũ (có thread), không gửi mới.
  assert.deepStrictEqual(nhat.map((x) => [x.stt, x.chiKiem, x.thread]),
    [['kiem', true, 'https://muse/thread/cu'], ['kiem', true, 'https://muse/thread/cu'], [1, false, 'https://muse/thread/cu']], JSON.stringify(nhat));
  assert.strictEqual(j.trangThai, 'xong');
});
testAsync('1.4.12 chat dở ở tài khoản giờ không nhận việc này (hết lượt / nghỉ): kiểm chat cũ TRƯỚC khi gửi lại ở tài khoản khác (bản cũ gửi lại ngay → trùng)', async () => {
  for (const [ten, kq, mong] of [['chat cũ đã xong', XONG, [['kiem', 'tk-1']]], ['chat cũ trống', { ok: false, chuaXong: true, dangTao: false }, [['kiem', 'tk-1'], [1, 'hai']]]]) {
    const nhat = [];
    const b = dungDieuPhoi({ duLieu: duLieuTatGiuaChung(), taoLuong: luongKiem(nhat, (j, ctx) => (ctx.chiKiem ? kq : XONG)) });
    b.tk.them('Hai');
    b.dp.choKiem.clear();                       // như đã qua lần kiểm khi mở (hoặc chat dở vì lỗi khi đang chạy)
    // Muse 1 không nhận video nữa (hết lượt / chặn 24 giờ — mốc này không bị xoá khi bấm Chạy).
    b.tk.sua('tk-1', { chanVideoDen: Date.now() + 3600e3, lyDoChanVideo: 'hết lượt' });
    b.dp.chayTatCa();
    await chayHet(b.dp);
    const j = b.dp.viec[0];
    assert.deepStrictEqual(nhat.map((x) => [x.stt, x.tk]), mong, `${ten}: ${JSON.stringify(nhat)}`);
    assert.strictEqual(j.trangThai, 'xong', ten);
    assert.strictEqual(j.taiKhoan, mong[mong.length - 1][1], ten);
  }
});
testAsync('1.4.12 nút "Kiểm tra việc dở": kiểm việc dừng / lỗi có chat; việc đang kiểm bị Dừng thì giữ Đã dừng; chat vừa có thì ghi ngay ra đĩa', async () => {
  const nhat = [];
  let tha;
  const { dp, store } = dungDieuPhoi({ taoLuong: luongKiem(nhat, (j, ctx) => (ctx.chiKiem ? new Promise((r) => { tha = () => r(XONG); }) : XONG)) });
  let ghiNgay = 0;
  store.flushNow = () => { ghiNgay++; };
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, anhTruocVideo: false });
  dp.them({ loai: 'video', prompts: ['a', 'b', 'c'] });
  const [a, b, c] = dp.viec;
  Object.assign(a, { trangThai: 'dung', taiKhoan: 'tk-1', thread: 'https://muse/thread/a' });
  Object.assign(b, { trangThai: 'loi', taiKhoan: 'tk-1', thread: 'https://muse/thread/b' });
  Object.assign(c, { trangThai: 'loi', taiKhoan: 'tk-1', thread: '' });   // chưa gửi → không phải việc dở
  assert.strictEqual(dp.demViecDo(), 2);
  assert.deepStrictEqual(dp.kiemViecDo(null), { ok: true, so: 2 });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual([a.trangThai, a.buoc, a.dangKiem], ['chay', 'kiem', true]);
  dp.dungViec([a.id]);                          // bấm Dừng giữa lúc kiểm
  tha();
  for (let i = 0; i < 30 && !(b.trangThai === 'xong'); i++) { await new Promise((r) => setTimeout(r, 10)); if (tha && b.dangKiem) tha(); }
  assert.deepStrictEqual([a.trangThai, b.trangThai, c.trangThai], ['dung', 'xong', 'loi'], JSON.stringify([a.trangThai, b.trangThai, c.trangThai]));
  // Chạy mới: vừa có chat là ghi ngay ra đĩa (tắt đột ngột không mất chat → không gửi lại).
  Object.assign(c, { trangThai: 'cho', loi: '' });
  const truoc = ghiNgay;
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(ghiNgay >= truoc + 2 && c.trangThai === 'xong' && c.thread === 'https://muse/thread/tk-1-3', `${ghiNgay - truoc} lần ghi ngay · ${c.thread}`);
});
// 1.4.13 — RAM: luồng giả đếm số lần tạo / đóng và số luồng chạy cùng lúc.
function luongDem() {
  const tao = [], huy = [];
  let dang = 0, max = 0;
  const taoLuong = (a, stt) => {
    const l = { id: `${a.id}-${stt}-${tao.length + 1}`, ranh: true, viec: null, nen: a.nen === 'muse' ? undefined : a.nen, dung() {},
      async chay(j) {
        this.ranh = false; this.viec = j; dang++; max = Math.max(max, dang);
        await new Promise((r) => setTimeout(r, 15));
        dang--; this.ranh = true; this.viec = null;
        return { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
      } };
    tao.push(l);
    return l;
  };
  return { tao, huy, taoLuong, huyLuong: (l) => huy.push(l), max: () => max };
}
test('1.4.13 cài đặt RAM: mặc định 10 việc / 900 MB / tự động; kẹp khoảng; RAM tối đa là cài đặt chung cả app', () => {
  const { dp } = dungDieuPhoi();
  assert.deepStrictEqual([dp.caiDat.lamMoiLuongSau, dp.caiDat.ramLuongToiDa, dp.caiDat.ramAppToiDa], [10, 900, 0]);
  dp.datCaiDat({ lamMoiLuongSau: 0, ramLuongToiDa: 50, ramAppToiDa: '6,5'.replace(',', '.') });
  assert.deepStrictEqual([dp.caiDat.lamMoiLuongSau, dp.caiDat.ramLuongToiDa, dp.caiDat.ramAppToiDa], [10, 300, 6.5]);
  dp.datCaiDat({ lamMoiLuongSau: 9999, ramLuongToiDa: 0, ramAppToiDa: -3 });
  assert.deepStrictEqual([dp.caiDat.lamMoiLuongSau, dp.caiDat.ramLuongToiDa, dp.caiDat.ramAppToiDa], [500, 0, 0]);
  assert.ok(dp._ramToiDaGB() > 0 && Math.abs(dp._ramToiDaGB() - Math.round(require('os').totalmem() / 1073741824 * 0.75 * 10) / 10) < 0.11, 'tự động = 75% RAM máy');
  dp.datCaiDat({ ramAppToiDa: 4 });
  assert.strictEqual(dp._ramToiDaGB(), 4);
  const src = docNguon('src/main/dieu-phoi.js');
  assert.ok(/const KHOA_CHUNG = \[[^\]]*'ramAppToiDa'/.test(src), 'RAM tối đa là cài đặt chung cả app');
});
testAsync('1.4.13 làm mới luồng Muse: chạy xong N việc → đóng hẳn trang, mở trang mới; việc vẫn chạy đủ', async () => {
  const L = luongDem();
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: L.taoLuong, huyLuong: L.huyLuong, ramLuong: () => 512 });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, lamMoiLuongSau: 2 });
  dp.them({ prompts: ['a', 'b', 'c', 'd', 'e'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  assert.strictEqual(L.tao.length, 3, `5 việc, làm mới sau mỗi 2 việc → 3 trang (${L.tao.length})`);
  assert.deepStrictEqual(L.huy.map((l) => l.id).slice(0, 2), [L.tao[0].id, L.tao[1].id]);
  assert.ok(nhatKy.some((x) => /♻ Làm mới luồng tk-1-1-1 \(đã chạy 2 việc; trang đang dùng 512 MB\) — đóng trang cũ trả RAM/.test(x)), nhatKy.join('\n'));
});
testAsync('1.4.13 làm mới luồng khi trang Muse quá ngưỡng MB (0 = không xét); luồng Flow / Suno không bị làm mới', async () => {
  for (const [nguong, mong] of [[800, 3], [0, 1]]) {
    const L = luongDem();
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: L.taoLuong, huyLuong: L.huyLuong, ramLuong: () => 1200 });
    dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, lamMoiLuongSau: 50, ramLuongToiDa: nguong });
    dp.them({ prompts: ['a', 'b', 'c'] });
    dp.chayTatCa();
    await chayHet(dp);
    assert.strictEqual(L.tao.length, mong, `ngưỡng ${nguong}: ${L.tao.length} trang`);
    if (nguong) assert.ok(nhatKy.some((x) => /♻ .*trang Muse dùng quá 800 MB; trang đang dùng 1,2 GB/.test(x)), nhatKy.join('\n'));
  }
  const { dp } = dungDieuPhoi({ ramLuong: () => 99999 });
  dp.datCaiDat({ lamMoiLuongSau: 1 });
  for (const nen of ['flow', 'suno']) {
    const x = { taiKhoanId: 'x', duAn: null, luong: { nen, ranh: true, dung() {} } };
    dp.luong.push(x);
    dp._lamMoiLuong(x);
    assert.ok(dp.luong.includes(x), `${nen}: không làm mới`);
  }
});
testAsync('1.4.13 RAM cả app chạm giới hạn: chỉ một luồng Muse chạy, luồng rảnh bị đóng, việc vẫn xong; dưới giới hạn → chạy đủ luồng', async () => {
  let ram = 9 * 1073741824;
  const L = luongDem();
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: L.taoLuong, huyLuong: L.huyLuong, ramLuong: () => 300, ramApp: () => ram });
  dp.datCaiDat({ luongMoiTK: 3, nghiGiuaLanGui: 0, lamMoiLuongSau: 100, ramAppToiDa: 8 });
  dp.them({ prompts: ['a', 'b', 'c', 'd', 'e', 'f'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  assert.strictEqual(L.max(), 1, `chạm giới hạn → một luồng Muse chạy một lúc (${L.max()})`);
  assert.ok(nhatKy.some((x) => /⏸ RAM app 9,0 GB — chạm giới hạn 8,0 GB/.test(x)), nhatKy.join('\n'));
  assert.ok(nhatKy.some((x) => /♻ .*RAM cả app chạm giới hạn/.test(x)), 'luồng chạy xong được làm mới để trả RAM');
  // Có trễ: 7,5 GB (≥ 90 %) vẫn giữ; 7 GB → mở lại đủ luồng.
  ram = 7.5 * 1073741824; dp._ram.luc = 0;
  assert.strictEqual(dp._quaRam(), true);
  ram = 7 * 1073741824; dp._ram.luc = 0;
  assert.strictEqual(dp._quaRam(), false);
  assert.ok(nhatKy.some((x) => /▶ RAM app còn 7,0 GB \(dưới giới hạn 8,0 GB\)/.test(x)));
  const L2 = luongDem();
  const b = dungDieuPhoi({ taoLuong: L2.taoLuong, huyLuong: L2.huyLuong, ramApp: () => 2 * 1073741824 });
  b.dp.datCaiDat({ luongMoiTK: 3, nghiGiuaLanGui: 0, ramAppToiDa: 8 });
  b.dp.them({ prompts: ['a', 'b', 'c', 'd', 'e', 'f'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  assert.strictEqual(L2.max(), 3, `dưới giới hạn → 3 luồng cùng lúc như cũ (${L2.max()})`);
});
// Lần thử thứ n (đếm chung mọi tài khoản) hỏng nếu nằm trong `hongLan`.
const luongTheoLan = (daChay, hongLan) => (a, stt) => ({
  id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
  async chay(j) {
    this.ranh = false; daChay.push(a.id);
    await new Promise((r) => setTimeout(r, 5)); this.ranh = true;
    return hongLan(daChay.length) ? { ok: false, loi: 'Muse trả lời chữ, không có video' } : { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
  }
});
testAsync('lỗi → lần lượt các tài khoản phụ → quay về tài khoản chính (vòng 2) → xong', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongTheoLan(daChay, (n) => n <= 3) });
  tk.them('Hai'); tk.them('Ba');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 2, tuChayLaiLoi: 0 });
  const d = dp.taoDuAn('P', ['tk-1', 'hai', 'ba']);
  dp.them({ duAn: d.id, prompts: ['1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(daChay, ['tk-1', 'hai', 'ba', 'tk-1'], 'chính → phụ 1 → phụ 2 → lại chính');
  assert.deepStrictEqual([dp.viec[0].trangThai, dp.viec[0].taiKhoan], ['xong', 'tk-1']);
  assert.ok(nhatKy.some((x) => /↪ #1 .*\(ở "Ba"\) — chuyển sang "Muse 1" \(vòng 2\/3\)/.test(x)), nhatKy.join('\n'));
});
testAsync('lỗi liên tục ở MỌI tài khoản → tài khoản nghỉ dần → hết tài khoản thì tạm dừng hàng chờ (việc về Chờ)', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongTheoLan(daChay, () => true) });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 5, tuChayLaiLoi: 0 });
  dp.them({ prompts: ['1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(daChay, ['tk-1', 'hai', 'tk-1', 'hai'], 'vòng 1 rồi vòng 2, lỗi 2 lần liền thì tài khoản nghỉ');
  assert.deepStrictEqual([dp.dangChay, dp.viec[0].trangThai], [false, 'cho']);
  assert.ok(nhatKy.some((x) => /TẠM DỪNG/.test(x)));
});
testAsync('hết số vòng (lỗi ở mọi tài khoản đủ vòng) → Lỗi, nói rõ đã thử bao nhiêu vòng', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongTheoLan(daChay, () => true) });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ prompts: ['1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(daChay, ['tk-1', 'hai']);
  assert.strictEqual(dp.viec[0].trangThai, 'loi');
  assert.ok(nhatKy.some((x) => /❌ #1 .*đã thử 1 vòng qua 2 tài khoản/.test(x)), nhatKy.join('\n'));
});
test('video nối từ ảnh: lưu cạnh ảnh nguồn, cùng tên (325.jpg → 325.mp4); tắt tuỳ chọn → theo thư mục / mẫu video', () => {
  const ghi = [];
  const { dp } = dungDieuPhoi({ ghiFile: (p) => ghi.push(p.replace(/\\/g, '/')) });
  dp.datCaiDat({ thuMucAnh: '/anh', thuMucVideo: '/video' });
  dp.them({ prompts: ['a', 'b'], chuoiVideo: { prompt: 'zoom' } });
  const [a1, a2] = dp.viec;
  dp._ketThuc(a1, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
  assert.strictEqual(a1.files[0].replace(/\\/g, '/'), '/anh/001.jpg', 'ảnh mặc định tên {stt}');
  const v1 = dp.viec.find((j) => j.tuAnh === a1.id);
  dp._ketThuc(v1, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
  assert.strictEqual(v1.files[0].replace(/\\/g, '/'), '/anh/001.mp4', 'video nằm cạnh ảnh, cùng tên');
  dp.datCaiDat({ videoCanhAnh: false });
  dp._ketThuc(a2, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
  const v2 = dp.viec.find((j) => j.tuAnh === a2.id);
  dp._ketThuc(v2, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
  assert.ok(v2.files[0].replace(/\\/g, '/').startsWith('/video/Mac_dinh/'), v2.files[0]);
});
test('1.0.4: tắt "cạnh ảnh" + chọn thư mục riêng → video nối từ ảnh vào thư mục đó, cùng tên ảnh; bật lại thì về cạnh ảnh', () => {
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ thuMucAnh: '/anh', thuMucVideo: '/video', videoCanhAnh: false, thuMucVideoAnh: '  /video-tu-anh ' });
  assert.strictEqual(dp.caiDat.thuMucVideoAnh, '/video-tu-anh');
  dp.them({ prompts: ['a', 'b', 'c'], chuoiVideo: { prompt: 'zoom' } });
  const chay = (a) => {
    dp._ketThuc(a, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
    const v = dp.viec.find((j) => j.tuAnh === a.id);
    dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
    return v.files[0].replace(/\\/g, '/');
  };
  const [a1, a2, a3] = dp.viec.filter((j) => j.loai === 'anh');
  assert.strictEqual(chay(a1), '/video-tu-anh/001.mp4');
  dp.datCaiDat({ videoCanhAnh: true });
  assert.strictEqual(chay(a2), '/anh/002.mp4', 'bật lại cạnh ảnh → thư mục riêng nằm im');
  dp.datCaiDat({ videoCanhAnh: false, thuMucVideoAnh: '' });
  assert.ok(chay(a3).startsWith('/video/Mac_dinh/'), 'bỏ thư mục riêng → theo trang Tạo video');
});
test('1.4.5: bỏ ô "Thư mục lưu video tạo từ ảnh" ở Cài đặt (trùng ô của trang Tạo ảnh) và lệnh chonThuMucVideoAnh', () => {
  const ui = docNguon('src/ui/app.js'), m = docNguon('main.js');
  const html = docNguon('src/ui/index.html', true);
  for (const id of ['cdThuMucVideoAnh', 'cdChonThuMucVideoAnh', 'cdMoThuMucVideoAnh', 'cdBoThuMucVideoAnh']) assert.ok(!html.includes(`id="${id}"`), id);
  assert.ok(!ui.includes("'chonThuMucVideoAnh'") && !m.includes('chonThuMucVideoAnh:'));
  assert.ok(html.includes('id="nutThuMucVideoDuAn"'), 'ô của trang Tạo ảnh vẫn còn');
});
test('1.4.5: Lưu cài đặt trả bộ vừa lưu (giao diện vẽ lại từ đó, không từ trạng thái cũ) (lần lưu đầu không còn bị đẩy về số cũ)', () => {
  let bao = 0;
  const { dp } = dungDieuPhoi();
  dp.o.bao = () => { bao++; };
  const d = dp.taoDuAn('P');
  bao = 0;
  const r = dp.datCaiDat({ luongMoiTK: '7', flow: { delayMin: '60', delayMax: '120' } }, d.id);
  assert.ok(r && r.ok && bao >= 1);
  assert.deepStrictEqual([r.caiDat.luongMoiTK, r.caiDat.flow.delayMin, r.caiDat.flow.delayMax], [7, 60, 120]);
  assert.strictEqual(r.caiDat, dp.cd(d.id));
  assert.strictEqual(r.caiDatChung, dp.caiDat);
  const ui = docNguon('src/ui/app.js');
  assert.ok(/(const|function) datCD[\s\S]{0,900}caiDatDuAn/.test(ui), 'giao diện phải cập nhật S từ kết quả datCaiDat');
});
test('1.4.5: Lưu làm cài đặt mặc định → dự án mới + mọi dự án đang có, giữ thư mục / mẫu tên riêng', () => {
  const { dp } = dungDieuPhoi();
  const a = dp.taoDuAn('A'), b = dp.taoDuAn('B');
  dp.datCaiDat({ thuMucAnh: '/b-anh', tenAnh: '{duAn}_{stt}', luongMoiTK: 2 }, b.id);
  dp.datCaiDat({ thuMucAnh: '/a-anh', tenVideo: '{stt}' }, a.id);
  const r = dp.datMacDinh({ luongMoiTK: '5', nghiGiuaLanGui: '9', flow: { tabMoiTK: 1, meToiDa: 8, delayMin: 60, delayMax: 120 } }, a.id);
  assert.ok(r.ok);
  assert.strictEqual(r.soDuAn, dp.duAn.length);
  for (const c of [dp.caiDat, dp.cd(a.id), dp.cd(b.id)]) {
    assert.deepStrictEqual([c.luongMoiTK, c.nghiGiuaLanGui, c.flow.meToiDa, c.flow.delayMin, c.flow.delayMax], [5, 9, 8, 60, 120]);
  }
  assert.strictEqual(dp.cd(b.id).thuMucAnh, '/b-anh', 'thư mục của dự án khác giữ nguyên');
  assert.strictEqual(dp.cd(b.id).tenAnh, '{duAn}_{stt}', 'mẫu tên của dự án khác giữ nguyên');
  assert.strictEqual(dp.cd(a.id).thuMucAnh, '/a-anh');
  assert.notStrictEqual(dp.caiDat.thuMucAnh, '/a-anh', 'thư mục không chép vào cài đặt chung');
  const c = dp.taoDuAn('C');
  assert.strictEqual(dp.cd(c.id).luongMoiTK, 5, 'dự án mới dùng cài đặt mặc định');
  assert.deepStrictEqual(Object.keys(r.caiDatDuAn).sort(), dp.duAn.filter((x) => x.id !== c.id).map((x) => x.id).sort());
});
test('1.4.5: cả máy nghỉ Flow — mọi tài khoản Flow khác nghỉ, luồng dừng; Muse không đụng; tài khoản nghỉ lâu hơn giữ nguyên', () => {
  const { dp, tk, nhatKy } = dungDieuPhoi();
  const f1 = tk.them('F1', 'flow'), f2 = tk.them('F2', 'flow'), f3 = tk.them('F3', 'flow');
  const dung = [];
  dp.luong = [{ taiKhoanId: f2.id, luong: { ranh: false, dung: (l) => dung.push([f2.id, l]) } },
    { taiKhoanId: 'tk-1', luong: { ranh: false, dung: (l) => dung.push(['tk-1', l]) } }];
  dp.nghiDen[f3.id] = Date.now() + 5 * 3600000;
  const ds = dp.nghiCaFlow(2 * 3600000, '2 tài khoản Flow bị báo hoạt động bất thường trong 30 phút', f1.id);
  assert.ok(ds.includes(f2.id) && !ds.includes(f1.id) && !ds.includes(f3.id) && !ds.includes('tk-1'), JSON.stringify(ds));
  assert.ok(dp.nghiDen[f2.id] > Date.now() + 3600000 && !dp.nghiDen[f1.id] && !dp.nghiDen['tk-1']);
  assert.ok(dp.nghiDen[f3.id] > Date.now() + 4 * 3600000, 'đang nghỉ lâu hơn thì không rút ngắn');
  assert.deepStrictEqual(dung.map((x) => x[0]), [f2.id]);
  assert.ok(nhatKy.some((x) => /Cả máy nghỉ Flow 2 giờ/.test(x)));
});
test('1.4.7: cả máy nghỉ — thẻ đỏ ghi rõ tài khoản này không bị báo', () => {
  const { dp, tk } = dungDieuPhoi();
  const f1 = tk.them('F1', 'flow'), f2 = tk.them('F2', 'flow');
  dp.nghiCaFlow(2 * 3600000, '2 tài khoản Flow bị báo hoạt động bất thường trong 30 phút', f1.id);
  const sk = dp.sucKhoeTk()[f2.id];
  assert.strictEqual(sk.muc, 'loi');
  assert.ok(/Cả máy nghỉ Flow \(tài khoản này không bị báo\): 2 tài khoản Flow bị báo/.test(sk.chu), sk.chu);
});
test('1.4.7: nhớ lần Flow báo bất thường trên tài khoản → cảnh báo "nghi bị Google đánh dấu", bỏ cảnh báo được', () => {
  const { dp, tk, nhatKy } = dungDieuPhoi();
  const f = tk.them('Flow 5', 'flow'), g = tk.them('Flow 1', 'flow');
  // Lần đầu (mở app chưa làm việc nào → không biết số việc): chưa cảnh báo.
  assert.strictEqual(dp.ghiBatThuong(f.id).nghi, false);
  assert.ok(!dp.sucKhoeTk()[f.id].danhDau);
  assert.strictEqual(tk.tim(f.id).batThuong.length, 1, 'phải lưu lên tài khoản (nhớ qua lần mở app)');
  assert.strictEqual(tk.tim(f.id).batThuong[0].anh, null);
  // Làm xong 1 việc rồi bị báo lại, sau đó 2 việc rồi bị báo nữa → 2 lần "sớm" + 3 lần trong 3 ngày → nghi.
  dp.xongTuBatThuong[f.id] += 1;
  dp.ghiBatThuong(f.id);
  assert.deepStrictEqual(tk.tim(f.id).batThuong.map((x) => x.anh), [null, 1]);
  dp.xongTuBatThuong[f.id] += 2;
  const r = dp.ghiBatThuong(f.id);
  assert.ok(r.nghi);
  const sk = dp.sucKhoeTk();
  assert.ok(sk[f.id].danhDau && /không nên dùng/.test(sk[f.id].danhDau.lyDo), JSON.stringify(sk[f.id]));
  assert.ok(!sk[g.id].danhDau, 'tài khoản khác không bị cảnh báo');
  assert.strictEqual(nhatKy.filter((x) => /nghi đã bị Google đánh dấu/.test(x)).length, 1, 'nhật ký ghi cảnh báo đúng một lần khi vừa thành nghi');
  dp.ghiBatThuong(f.id);
  assert.strictEqual(nhatKy.filter((x) => /nghi đã bị Google đánh dấu/.test(x)).length, 1, 'bị báo thêm không ghi lặp');
  assert.deepStrictEqual(dp.boDanhDau(f.id), { ok: true });
  assert.ok(!tk.tim(f.id).batThuong && !dp.sucKhoeTk()[f.id].danhDau, 'Bỏ cảnh báo xoá lịch sử');
  assert.strictEqual(dp.boDanhDau('khong-co').ok, false);
});
test('1.4.7: việc xong đếm vào số việc kể từ lần bị báo bất thường', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'main', 'dieu-phoi.js'), 'utf8');
  const i = src.indexOf("trangThai: 'xong', buoc: ''"), k = src.indexOf('this.xongTuBatThuong[j.taiKhoan] = (this.xongTuBatThuong[j.taiKhoan] || 0) + 1');
  assert.ok(i > 0 && k > i && k - i < 800, 'nhánh việc xong của _ketThuc phải tăng xongTuBatThuong');
  const mf = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'flow', 'may-flow.js'), 'utf8');
  assert.ok(/o\.ghiBatThuong\(accountId\)/.test(mf), 'máy Flow phải báo lần bị bất thường lên điều phối');
  const m = require('fs').readFileSync(require('path').join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/ghiBatThuong: \(tkId\) => dieuPhoi\.ghiBatThuong\(tkId\)/.test(m), 'main.js phải nối ghiBatThuong');
});
test('1.4.5: mốc 6 — thư mục video tạo từ ảnh ở Cài đặt chuyển sang ô của dự án (chỉ khi tắt "cạnh ảnh")', () => {
  const duLieu = { caiDat: { moc: 5, videoCanhAnh: false, thuMucVideoAnh: '/chung' },
    duAn: [{ id: 'a', ten: 'A' }, { id: 'b', ten: 'B', caiDat: { videoCanhAnh: true, thuMucVideoAnh: '/b' } },
      { id: 'c', ten: 'C', thuMucVideoAnh: '/c-rieng', caiDat: { videoCanhAnh: false, thuMucVideoAnh: '/c' } }] };
  const { dp } = dungDieuPhoi({ duLieu });
  const tim = (id) => dp.duAn.find((d) => d.id === id);
  assert.strictEqual(tim('a').thuMucVideoAnh, '/chung', 'dự án theo cài đặt chung');
  assert.ok(!tim('b').thuMucVideoAnh, 'đang bật cạnh ảnh → thư mục đó vốn không dùng, không chuyển');
  assert.strictEqual(tim('c').thuMucVideoAnh, '/c-rieng', 'ô của dự án đã chọn thì giữ');
  assert.strictEqual(dp.caiDat.thuMucVideoAnh, '');
  for (const id of ['a', 'b', 'c']) assert.strictEqual(dp.cd(id).thuMucVideoAnh, '');
  assert.strictEqual(dp.caiDat.moc, 6);
});
test('video nối từ ảnh KHÔNG tải về (ảnh ở bộ nhớ tạm) → video theo thư mục video như cũ', () => {
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ taiAnh: false, thuMucVideo: '/video' });
  dp.them({ prompts: ['a'], chuoiVideo: { prompt: 'zoom' } });
  dp._ketThuc(dp.viec[0], { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
  const v = dp.viec.find((j) => j.loai === 'video');
  dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
  assert.ok(v.files[0].replace(/\\/g, '/').startsWith('/video/'), v.files[0]);
});
test('nâng cấp 1.0.2: mẫu tên ảnh mặc định cũ → {stt}, thử lại 1 → 2 vòng; giá trị tự đặt thì giữ', () => {
  const c = dungDieuPhoi({ duLieu: { caiDat: { tenAnh: '{duAn}/{duAn}_{so}', tuThuLai: 1, moc: 1 } } }).dp.caiDat;
  assert.deepStrictEqual([c.tenAnh, c.tuThuLai, c.moc], ['{stt}', 2, 6]);
  const t = dungDieuPhoi({ duLieu: { caiDat: { tenAnh: 'anh_{so}', tuThuLai: 4, moc: 1 } } }).dp.caiDat;
  assert.deepStrictEqual([t.tenAnh, t.tuThuLai], ['anh_{so}', 4]);
  assert.strictEqual(dungDieuPhoi({ duLieu: { caiDat: { tenAnh: '{duAn}/{duAn}_{so}', moc: 2 } } }).dp.caiDat.tenAnh, '{duAn}/{duAn}_{so}', 'đã nâng cấp thì không đổi nữa');
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ tenAnh: '  ', tenVideo: '' });
  assert.deepStrictEqual([dp.caiDat.tenAnh, dp.caiDat.tenVideo], ['{stt}', '{duAn}/{duAn}_{so}']);
});
testAsync('chạy hết hàng chờ → dọn theo tuỳ chọn (chat Muse đã xong, dự án Flow đã dùng) RỒI mới tới tắt máy / cập nhật token', async () => {
  const thuTu = [];
  let don = null;
  // Luồng Muse giả ghi lại đường dẫn chat như luồng thật (capNhat({thread})); việc 2 thì Muse trả chữ → Lỗi, giữ chat.
  const taoLuong = (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j, ctx) {
      this.ranh = false; ctx.capNhat({ thread: `https://muse.ai/thread/${j.so}` });
      await new Promise((r) => setTimeout(r, 5)); this.ranh = true;
      return j.so === 2 ? { ok: false, loi: 'Muse trả lời chữ', giuThread: true } : { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
    } });
  const { dp } = dungDieuPhoi({
    taoLuong,
    donDep: async (d) => { don = d; await new Promise((r) => setTimeout(r, 20)); thuTu.push('don'); },
    hetLuot: () => thuTu.push('het')
  });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, xoaChatKhiXong: true, xoaDuAnFlowKhiXong: true });
  dp.them({ prompts: ['1', '2'] });
  dp.chayTatCa();
  await chayHet(dp);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepStrictEqual(thuTu, ['don', 'het']);
  assert.deepStrictEqual([...don.muse.keys()], ['tk-1']);
  assert.deepStrictEqual(don.muse.get('tk-1'), [{ id: dp.viec[0].id, thread: 'https://muse.ai/thread/1' }], 'chỉ chat của việc ĐÃ XONG');
  assert.deepStrictEqual(don.flow, []);
  // Tuỳ chọn tắt → không dọn gì, vẫn gọi hetLuot.
  const b = dungDieuPhoi({ taoLuong: luongGia([], new Set()), donDep: () => { throw new Error('không được gọi'); }, hetLuot: () => thuTu.push('het2') });
  b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  b.dp.them({ prompts: ['1'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(thuTu.includes('het2'));
});
test('xoá dự án Flow: đọc đúng mã dự án từ địa chỉ (cả labs.google lẫn flow.google.com)', () => {
  const { maDuAn } = require('../src/flow/main/xoa-du-an');
  assert.strictEqual(maDuAn('https://flow.google.com/project/abc-123?x=1'), 'abc-123');
  assert.strictEqual(maDuAn('https://labs.google/fx/vi/tools/flow/project/9f8e'), '9f8e');
  assert.strictEqual(maDuAn('https://flow.google.com/'), '');
});
testAsync('Muse mất kết nối: có dự phòng → chuyển ngay; không còn tài khoản nào → tạm dừng, việc về Chờ', async () => {
  const daChay = [];
  const mat = { ok: false, matKetNoi: true, loi: 'Muse mất kết nối ("Connecting...")', giuThread: true };
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongGia(daChay, new Set(['tk-1']), mat) });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ prompts: ['1', '2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.taiKhoan === 'hai'));
  assert.strictEqual(daChay.filter((x) => x[0] === 'tk-1').length, 1, 'mất kết nối 1 lần là nghỉ ngay');
  const b = dungDieuPhoi({ taoLuong: luongGia([], new Set(['tk-1']), mat) });
  b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  b.dp.them({ prompts: ['1'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  assert.deepStrictEqual([b.dp.dangChay, b.dp.viec[0].trangThai, b.dp.viec[0].thu], [false, 'cho', 0]);
  assert.ok(b.nhatKy.some((x) => /"Muse 1": Muse mất kết nối \("Connecting\.\.\."\).*TẠM DỪNG/.test(x)));
});
test('dự án nhớ tài khoản theo thứ tự [chính, dự phòng…]; bỏ tài khoản đã xoá / chưa đăng nhập; chưa chọn = mọi tài khoản', () => {
  const { dp, tk } = dungDieuPhoi();
  tk.them('Hai'); tk.them('Ba');
  assert.deepStrictEqual(dp._dsTk('mac-dinh'), ['tk-1', 'hai', 'ba']);
  dp.datTaiKhoanDuAn('mac-dinh', ['ba', 'tk-1', 'khong-co', 'ba']);
  assert.deepStrictEqual(dp.duAn[0].taiKhoan, ['ba', 'tk-1']);
  tk.sua('ba', { trangThai: 'can-dang-nhap' });
  assert.deepStrictEqual(dp._dsTk('mac-dinh'), ['tk-1']);
});
test('nâng cấp: thời gian chờ mặc định cũ (240/600 s) → mới (180/300 s), giá trị người dùng tự đặt thì giữ', () => {
  assert.deepStrictEqual((({ choAnhGiay, choVideoGiay }) => [choAnhGiay, choVideoGiay])(dungDieuPhoi({ duLieu: { caiDat: { choAnhGiay: 240, choVideoGiay: 600 } } }).dp.caiDat), [180, 300]);
  assert.deepStrictEqual((({ choAnhGiay, choVideoGiay }) => [choAnhGiay, choVideoGiay])(dungDieuPhoi({ duLieu: { caiDat: { choAnhGiay: 400, choVideoGiay: 900 } } }).dp.caiDat), [400, 900]);
  assert.strictEqual(dungDieuPhoi({ duLieu: { caiDat: { choAnhGiay: 240, moc: 1 } } }).dp.caiDat.choAnhGiay, 240, 'đã nâng cấp rồi thì không đổi nữa');
});
testAsync('giãn nhịp gửi theo tài khoản: hai luồng cùng tài khoản không gửi cùng lúc', async () => {
  const { dp } = dungDieuPhoi();
  dp.datCaiDat({ nghiGiuaLanGui: 1 });
  const t0 = Date.now();
  await Promise.all([dp.choGui('A'), dp.choGui('A'), dp.choGui('B')]);
  const ms = Date.now() - t0;
  assert.ok(ms >= 950 && ms < 1800, `mất ${ms}ms`);
});

console.log('\n── kiểm tĩnh ─────────────────────────────────');
test('mọi lệnh giao diện gọi đều có trong LENH của main.js', () => {
  const ui = docNguon('src/ui/app.js');
  const goi = new Set([...ui.matchAll(/api\.call\('([a-zA-Z]+)'/g)].map((m) => m[1]));
  const main = docNguon('main.js');
  const khoi = main.slice(main.indexOf('const LENH = {'), main.indexOf("ipcMain.handle('app'"));
  const thieu = [...goi].filter((l) => !new RegExp(`\\n\\s+${l}:`).test(khoi));
  assert.deepStrictEqual(thieu, []);
  assert.ok(goi.size > 30, `chỉ thấy ${goi.size} lệnh — regex hỏng?`);
});
test('1.0.2: nút Xuất .txt nhật ký, Tải về hàng loạt, ba công tắc Tải về & dọn dẹp được nối và lưu', () => {
  const ui = docNguon('src/ui/app.js');
  const html = docNguon('src/ui/index.html', true);
  for (const id of ['nutXuatLog', 'chonTai', 'cdVideoCanhAnh', 'cdXoaChat', 'cdXoaDuAnFlow']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(/\$\('#nutXuatLog'\)\.onclick[\s\S]{0,200}api\.call\('xuatNhatKy'/.test(ui));
  assert.ok(/\$\('#chonTai'\)\.onclick[\s\S]{0,1500}api\.call\('taiNhieu', \{ ids, mau: U\.mauTai, tuChat: v\.tuChat \}/.test(ui), 'Tải về gửi kèm mẫu tên + tuỳ chọn lấy lại từ chat');
  const luu = ui.slice(ui.indexOf("$('#cdLuu').onclick"), ui.indexOf("toast('Đã lưu cài đặt')"));
  for (const k of ['videoCanhAnh', 'xoaChatKhiXong', 'xoaDuAnFlowKhiXong']) assert.ok(luu.includes(k), `Lưu cài đặt thiếu ${k}`);
});
test('1.0.3: tải về hàng loạt — file trên máy còn thì chép, mất thì lấy lại từ chat Muse, không thì báo', () => {
  const con = new Set(['/a/1.mp4', '/a/2.png', '/a/4a.png']);
  const v = (so, thay) => Object.assign({ id: so, so, nen: 'muse', trangThai: 'xong', files: [`/a/${so}.mp4`], thread: `https://muse.ai/thread/t${so}`, taiKhoan: 'tk-1' }, thay);
  const kq = HD.keHoachTai([
    v(5, { files: ['/mat/5.mp4'] }),                         // mất file, còn chat → lấy lại
    v(1),                                                     // còn file → chép
    v(2, { files: ['/a/2.png'], thread: '' }),                // còn file, không chat → chép
    v(3, { files: ['/mat/3.mp4'], thread: '' }),              // mất file, hết chat → không được
    v(4, { files: ['/a/4a.png', '/mat/4b.png'] }),            // mất 1 trong 2 file, còn chat → lấy lại cả việc
    v(6, { nen: 'flow', files: ['/mat/6.mp4'] }),             // Flow không có chat → không được
    v(7, { files: ['/mat/7.mp4'], thread: 'https://muse.ai/thread/new' }),   // chưa từng gửi được → không được
    v(8, { trangThai: 'loi' }), v(9, { trangThai: 'chay' })
  ], (f) => con.has(f));
  assert.deepStrictEqual(kq.coFile.map((x) => `${x.j.so}:${x.i}:${x.nguon}`), ['1:0:/a/1.mp4', '2:0:/a/2.png']);
  assert.deepStrictEqual(kq.tuChat.map((j) => j.so), [4, 5]);
  assert.deepStrictEqual(kq.khongDuoc.map((j) => j.so), [3, 6, 7]);
  assert.strictEqual(kq.chuaXong, 2);
  // Đặt tên lại: mặc định {stt} — video #154 nối từ ảnh có stt 154 → 154.mp4.
  assert.strictEqual(HD.tenFile({ ten: 'X' }, { so: 300, stt: 154, loai: 'video' }, 'video/mp4', 0, HD.MAU_TEN_ANH_MAC_DINH), '154.mp4');
});
test('1.0.3: main.js tải về hàng loạt — lấy lại từ chat bằng luồng chỉ MỞ chat cũ (có thread), không ghi đè file', () => {
  const m = docNguon('main.js');
  const t = m.slice(m.indexOf('taiNhieu: async'), m.indexOf('kiemCapNhat:'));
  assert.ok(/hd\.keHoachTai\(/.test(t) && /LENH\.chonThuMucTai\(/.test(t));
  assert.ok(/l\.chay\(\{ \.\.\.j, files: \[\] \}/.test(t), 'bản sao việc giữ thread → Luong đi nhánh tiepTuc, không gửi prompt');
  assert.ok(/fs\.existsSync\(p\) \|\| daDung\.has\(p\)/.test(t), 'trùng tên → (2), không ghi đè');
  assert.ok(/dongCuaSoAn\(w\)/.test(t) && /dangTaiNhieu = false/.test(t));
});
test('1.0.2: mọi công tắc trong Cài đặt đứng TRƯỚC chữ, sát lề trái', () => {
  const css = docNguon('src/ui/style.css');
  const q = css.match(/\n\.dong-cong-tac \{([^}]*)\}/);
  assert.ok(q && /flex-direction:\s*row-reverse/.test(q[1]) && /justify-content:\s*flex-end/.test(q[1]), q && q[1]);
  // Không quy tắc nào khác đảo lại hướng.
  assert.ok(!/\.dong-cong-tac[^{]*\{[^}]*flex-direction:\s*row\s*;/.test(css));
});
test('mọi id giao diện app.js dùng ($("#x")) đều có trong index.html', () => {
  const ui = docNguon('src/ui/app.js');
  const html = docNguon('src/ui/index.html', true);
  const ids = new Set([...ui.matchAll(/\$\('#([A-Za-z0-9]+)['\s]/g)].map((m) => m[1]));
  // id có thể nằm trong index.html hoặc trong HTML hộp thoại app.js tự dựng.
  const thieu = [...ids].filter((id) => !html.includes(`id="${id}"`) && !ui.includes(`id="${id}"`));
  assert.deepStrictEqual(thieu, []);
});
test('mọi icon dùng đều có trong icons.js', () => {
  global.window = {};
  require('../src/ui/icons.js');
  const co = window.ICON;
  const dung = new Set([...docNguon('src/ui/index.html', true).matchAll(/data-icon="([a-z0-9-]+)"/g), ...docNguon('src/ui/app.js').matchAll(/ic\('([a-z0-9-]+)'/g)].map((m) => m[1]));
  assert.deepStrictEqual([...dung].filter((n) => !co[n]), []);
});
test('trang giả dùng đúng các thuộc tính trình trợ giúp dò (giữ hai bên khớp nhau)', () => {
  const tro = docNguon('src/inject/muse-trang.js', true);
  const gia = docNguon('tests/fixture-muse.html', true);
  const chuoi = new Set([...tro.matchAll(/(aria-label|data-testid|data-message-role|data-pel-click)="([^"]+)"|\[(data-hatch-[\w-]+)\]/g)].map((m) => m[2] || m[3]));
  assert.ok(chuoi.size >= 7, `chỉ thấy ${chuoi.size}`);
  assert.deepStrictEqual([...chuoi].filter((c) => !gia.includes(c)), []);
});
test('nhãn Muse: hiểu cả tiếng Anh (đã đo) lẫn tiếng Việt, không nhầm nút khác', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const NHAN = eval('(' + s.match(/const NHAN = (\{[\s\S]*?\});/)[1] + ')');
  const dung = { gui: ['Send', 'Gửi', 'Gửi tin nhắn'], goDinhKem: ['Remove attachment', 'Xóa tệp đính kèm', 'Gỡ tệp'],
    dangGo: ['Assistant is typing', 'Trợ lý đang nhập'], mo: ['Open generated image 1', 'Mở hình ảnh đã tạo'], dong: ['Close', 'Đóng'] };
  for (const [k, ds] of Object.entries(dung)) for (const x of ds) assert.ok(NHAN[k].test(x), `${k} phải nhận "${x}"`);
  for (const x of ['Gửi phản hồi', 'Send feedback', 'Attach file']) assert.ok(!NHAN.gui.test(x), `gui không được nhận "${x}"`);
});
test('gửi xong mà đường dẫn vẫn /thread/new thì KHÔNG giữ làm chat (mở lại là chat trống, chờ suông)', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const gui = s.slice(s.indexOf('async function gui('), s.indexOf('function anhDaNap('));
  assert.ok(/thread: \/\\\/new\$\/\.test\(location\.pathname\) \? '' : location\.href/.test(gui));
});
test('trạng thái Muse: nhận "Connecting..." là mất kết nối, không nhầm "Connected"/"Đã kết nối"', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const re = eval(s.match(/const MAT_KET_NOI = (\/.*\/i);/)[1]);
  for (const x of ['Connecting...', 'Reconnecting…', 'Đang kết nối...', 'Mất kết nối', 'Connection error']) assert.ok(re.test(x), x);
  for (const x of ['Connected', 'Đã kết nối', 'Working', 'Đang làm việc', '']) assert.ok(!re.test(x), x);
});
test('xoá chat: mở menu ⋯ chỉ bằng pointerdown (click nổi lên hàng → Muse chuyển chat)', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const x = s.slice(s.indexOf('async function xoaHang('), s.indexOf('async function xoaChatDangMo('));
  // 1.3.0: pointerdown trước; chỉ khi menu KHÔNG mở mới bấm đủ (Muse đổi kiểu menu).
  const i = x.indexOf("nut.dispatchEvent(new PointerEvent('pointerdown'"), k = x.indexOf('bam(nut)');
  assert.ok(i > 0 && k > i && /if \(!muc && !menuMo\(\)\) \{ bam\(nut\)/.test(x) && !/bam\(nutChat/.test(x));
});
test('1.3.0 xoá chat Muse: dò cả giao diện mới (liên kết /thread/, nút ⋯ hiện khi rê chuột, mục "Delete" theo chữ, hộp alertdialog), hỏng thì lưu tệp chẩn đoán', () => {
  const s = docNguon('src/inject/muse-trang.js');
  assert.ok(/a\[href\*="\/thread\/"\]/.test(s) && /function reChuot\(/.test(s) && /role="alertdialog"/.test(s) && /XOA\.test\(chuCua\(e\)\)/.test(s));
  assert.ok(/chanDoan: chanDoanXoa\(\)/.test(s));
  const m = docNguon('main.js');
  assert.ok(/chan-doan-muse/.test(m) && /luuChanDoanMuse\(/.test(m.slice(m.indexOf('async function xoaChat('), m.indexOf('async function donDep('))));
});
test('1.3.2 xoá chat Muse: nhận ra đã xoá bằng id nút ⋯ (danh sách nạp bù nên số hàng không đổi), xét HÀNG chứa nút (nút ẩn tới khi rê chuột)', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const x = s.slice(s.indexOf('function daXoa('), s.indexOf('const thongBaoMuse'));
  assert.ok(/document\.getElementById\(chup\.idNut\)/.test(x) && /conHien\(hangCuaNut\(b\)\)/.test(x) && !/conHien\(b\)/.test(x), 'không xét chính nút ⋯ (display:none khi chưa rê chuột)');
  assert.ok(/con \* 2 >= chup\.idKhac\.length/.test(x), 'Muse vẽ lại cả danh sách (mất hết id) thì không tin là đã xoá');
  const h = s.slice(s.indexOf('async function xoaHang('), s.indexOf('async function diemXoa('));
  assert.ok(/cho\(\(\) => daXoa\(h, chup\), 15000\)/.test(h) && !/hangGoc\(\)\.length < truoc/.test(h));
  assert.ok(/hopLoi = /.test(h) && /thongBaoMuse\(\)/.test(h), 'chẩn đoán giữ HTML hộp xác nhận + thông báo Muse');
});
test('1.3.2 xoá chat Muse: bấm JavaScript không xoá được → tiến trình chính bấm chuột thật (rê vào hàng cho nút ⋯ hiện, rồi bấm)', () => {
  const m = docNguon('main.js');
  const x = m.slice(m.indexOf('async function xoaChat('), m.indexOf('async function donDep('));
  assert.ok(/nenThuChuotThat\(r\)/.test(x) && /xoaChatChuotThat\(wc, \{ dangMo \}\)/.test(x) && /chuotThat = true/.test(x));
  const t = docNguon('src/main/xoa-chat-muse.js');
  const i = t.indexOf("reChuotThat(wc, hang.x, hang.y)"), k = t.indexOf("choDiem('nutHien'"), b = t.indexOf("bamChuotThat(wc, nut.x, nut.y)");
  assert.ok(i > 0 && k > i && b > k, 'rê chuột thật vào hàng TRƯỚC khi tìm nút ⋯');
  const { nenThuChuotThat } = require('../src/main/xoa-chat-muse');
  for (const loi of ['xoa-xong-nhung-danh-sach-khong-doi', 'xoa-xong-nhung-danh-sach-khong-doi · Muse báo: x', 'khong-mo-duoc-menu', 'khong-thay-nut-xac-nhan'])
    assert.ok(nenThuChuotThat({ ok: false, loi }), loi);
  for (const r of [{ ok: true }, { ok: false, loi: 'menu-khong-co-delete: Pin' }, { ok: false, loi: 'khong-thay-chat' }, null])
    assert.ok(!nenThuChuotThat(r), JSON.stringify(r));
});
test('trình trợ giúp kết thúc bằng undefined; (executeJavaScript không phải sao chép hàm)', () => {
  assert.ok(/\nundefined;\s*$/.test(docNguon('src/inject/muse-trang.js', true)));
});
test('trình viewer: mở thì luôn đóng (finally), kể cả khi không lấy được ảnh', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const than = s.slice(s.indexOf('async function layFile('), s.indexOf('window.__muse ='));
  assert.ok(/moXem = x\.daMo/.test(than), 'đánh dấu đã mở theo daMo, không theo việc có ảnh');
  assert.ok(/finally \{\s*if \(moXem\) \{ dongTrinhXem\(\)/.test(than));
});
test('luồng chạy ngầm là CỬA SỔ ẨN (trang luôn visible), không phải WebContentsView ẩn; giữ 1280×800', () => {
  const m = docNguon('main.js');
  const luong = m.slice(m.indexOf('function taoLuong('), m.indexOf('function huyLuong('));
  const an = m.slice(m.indexOf('function taoCuaSoAn('), m.indexOf('function dongCuaSoAn('));
  assert.ok(/taoCuaSoAn\(/.test(luong), 'taoLuong dùng taoCuaSoAn');
  assert.ok(!/WebContentsView|setVisible\(/.test(luong), 'không dùng view ẩn — Muse không nạp ô soạn tin');
  assert.ok(/new BrowserWindow\(/.test(an) && /show: false/.test(an) && /width: 1280, height: 800/.test(an));
  assert.ok(/backgroundThrottling: false/.test(m.slice(m.indexOf('const WEB_PREFS'), m.indexOf('function ganWc('))));
  const kiem = m.slice(m.indexOf('async function kiemTaiKhoan('), m.indexOf('// ── File'));
  assert.ok(/taoCuaSoAn\(/.test(kiem) && !/setVisible\(false\)/.test(kiem));
});
test('cửa sổ luồng chỉ ẩn khi bấm X, nhưng đóng thật khi app thoát', () => {
  const m = docNguon('main.js');
  assert.ok(/w\.on\('close', \(e\) => \{ if \(!appDangThoat && !w\.__huy\)/.test(m));
  assert.ok(/app\.on\('before-quit', \(e\) => \{\s*appDangThoat = true;/.test(m));
});
test('trình trợ giúp: chờ ô soạn tin được nạp trước khi điền; đọc chữ lỗi bỏ qua SVG', () => {
  const s = docNguon('src/inject/muse-trang.js');
  const gui = s.slice(s.indexOf('async function gui('), s.indexOf('function anhDaNap('));
  assert.ok(gui.indexOf('daNap(t)') > 0 && gui.indexOf('daNap(t)') < gui.indexOf('datGiaTri.call'), 'chờ nạp TRƯỚC khi điền');
  const loi = s.slice(s.indexOf('function chuLoiTrenTrang('), s.indexOf('const daNap'));
  assert.ok(/instanceof HTMLElement/.test(loi) && /String\(e\.innerText \|\| ''\)/.test(loi));
});
test('userData đặt TRƯỚC whenReady', () => {
  const m = docNguon('main.js');
  assert.ok(m.indexOf("app.setPath('userData'") < m.indexOf('app.whenReady()'));
});
test('package.json: tên file phát hành khớp bộ cập nhật, đủ thư mục đóng gói', () => {
  const pkg = JSON.parse(docNguon('package.json', true));
  assert.strictEqual(pkg.build.nsis.artifactName, 'AIAutomationStudio-${version}-setup.exe');
  assert.strictEqual(pkg.build.mac.artifactName, 'AIAutomationStudio-${version}-mac-${arch}.${ext}');
  assert.ok(pkg.build.files.includes('src/**/*') && pkg.build.files.includes('main.js'));
  assert.ok(/github\.com\/[^/]+\/[^/]+/.test(pkg.repository.url));
  assert.strictEqual(pkg.build.mac.identity, null);
});
test('RELEASE_NOTES / GHI_CHU_BAN_MOI nhắc đúng phiên bản', () => {
  const pkg = JSON.parse(docNguon('package.json', true));
  assert.ok(docNguon('GHI_CHU_BAN_MOI.md', true).includes(pkg.version));
});

console.log('\n── Google Flow trong hàng đợi ────────────────');
const CF = require('../src/flow/cai-dat-flow');
test('cài đặt Flow: kẹp giá trị, giữ khoá con khi lưu thiếu, Flow chỉ có 16:9 / 9:16', () => {
  const c = CF.chuanHoaFlow({ outputCount: 9, delayMin: 50, delayMax: 10, meToiDa: 0, tabMoiTK: 7, anToan: { nguong: 5 }, chatLuongAnh: 'x' });
  assert.strictEqual(c.outputCount, 4);
  assert.ok(c.delayMax >= c.delayMin);
  assert.strictEqual(c.meToiDa, 1);
  assert.strictEqual(c.tabMoiTK, 4);
  assert.strictEqual(c.anToan.nguong, 5);
  assert.strictEqual(c.anToan.nghiPhut, 15, 'thiếu khoá con thì lấy mặc định');
  assert.deepStrictEqual(Object.keys(c.anToan).sort(), ['caMayBat', 'caMayPhut', 'nghiPhut', 'nguong'], '1.4.7: 4 khoá nhận diện tài khoản lỗi (thêm công tắc + số phút cả máy nghỉ)');
  // Bộ cũ (chế độ an toàn: "3 lỗi trong 5 phút") mang nghĩa khác → lấy mặc định mới.
  assert.deepStrictEqual(CF.chuanHoaFlow({ anToan: { bat: false, nguong: 3, cuaSoPhut: 5, nghiPhut: 10, cuMoi: 20 } }).anToan, { nguong: 2, nghiPhut: 15, caMayBat: true, caMayPhut: 120 });
  assert.strictEqual(CF.chuanHoaFlow({ sangMuseKhiHong: true }).sangMuseKhiHong, undefined, '1.2.1: thành công tắc chung doiNenKhiLoi');
  assert.strictEqual(CF.chuanHoaFlow({}).maxRetries, 1);
  assert.strictEqual(c.chatLuongAnh, 'img_1k');
  assert.deepStrictEqual(['16:9', '9:16', '4:3', '1:1', '3:4'].map(CF.tyLeFlow), ['16:9', '9:16', '16:9', '9:16', '9:16']);
});
test('cài đặt mẻ gửi engine: ép tải ngay từng file, tên theo danh sách, multiTab bật, khung hình tắt', () => {
  const s = CF.caiDatEngine(CF.chuanHoaFlow({ voiceSync: true }), { loai: 'anh', tyLe: '1:1', coAnh: true, ten: ['A_001', 'A_002'] });
  assert.strictEqual(s.runMode, 'image');
  assert.strictEqual(s.aspectRatio, '9:16');
  assert.strictEqual(s.renameMode, 'custom_list');
  assert.strictEqual(s.renameCustomList, 'A_001\nA_002');
  assert.ok(s.downloadImmediately && !s.downloadZip && s.autoDownload);
  assert.ok(s.multiTab, 'thiếu multiTab là các tab ghi đè dự án của nhau');
  assert.ok(s.keyframeSync === false && s.charSync === true && s.charSyncStripTag === true);
  assert.strictEqual(s.voiceSync, false, 'giọng nói chỉ có nghĩa ở chế độ video');
  assert.strictEqual(s.autoShutdown, false, 'tắt máy do hàng đợi quyết, không theo từng mẻ');
  const v = CF.caiDatEngine({}, { loai: 'video', tyLe: '16:9', coAnh: false, ten: [] });
  assert.ok(v.runMode === 'video' && v.downloadQuality === '1080p' && v.charSync === false);
});
test('khoá mẻ: cùng dự án + loại + tỷ lệ Flow + có/không ảnh mới chung mẻ', () => {
  const j = { duAn: 'p', loai: 'anh', tyLe: '9:16', thamChieu: [], nhanVat: [] };
  assert.strictEqual(CF.khoaMe(j), CF.khoaMe({ ...j, tyLe: '1:1' }), '1:1 cũng thành 9:16 trên Flow');
  assert.notStrictEqual(CF.khoaMe(j), CF.khoaMe({ ...j, tyLe: '16:9' }));
  assert.notStrictEqual(CF.khoaMe(j), CF.khoaMe({ ...j, loai: 'video' }));
  assert.notStrictEqual(CF.khoaMe(j), CF.khoaMe({ ...j, thamChieu: ['a.png'] }));
  assert.notStrictEqual(CF.khoaMe(j), CF.khoaMe({ ...j, duAn: 'q' }));
});
test('mã ảnh @tên: chỉ [A-Za-z0-9_], khác thư mục thì khác mã', () => {
  const { maAnh } = require('../src/flow/luong-flow');
  const a = maAnh('/x/Ảnh đẹp (1).png'), b = maAnh('/y/Ảnh đẹp (1).png');
  assert.ok(/^[A-Za-z0-9_]+$/.test(a), a);
  assert.notStrictEqual(a, b);
});
/** Luồng giả cho cả hai nền tảng: Muse chạy từng việc, Flow chạy cả mẻ (chayMe). */
const luongGiaHaiNen = (daChay, hong = new Set()) => (a, stt) => (a.nen === 'flow' ? {
  id: `${a.id}-${stt}`, nen: 'flow', ranh: true, viec: null, dung() {},
  async chayMe(ds, ctx) {
    this.ranh = false;
    daChay.push({ tk: a.id, so: ds.map((j) => j.so), ten: ds.map((j) => ctx.tenFile(j)), anh: ds.map((j) => ctx.anhCua(j)) });
    await new Promise((r) => setTimeout(r, 10));
    for (const j of ds) {
      ctx.xong(j, hong.has(a.id) ? { ok: false, loi: 'Flow: tạo hỏng' }
        : { ok: true, files: [{ duongDan: `/tam/${ctx.tenFile(j)}.${j.loai === 'video' ? 'mp4' : 'png'}` }], flowTen: ctx.tenFile(j) });
    }
    this.ranh = true;
  }
} : luongGia(daChay, hong)(a, stt));
testAsync('Flow: gom mẻ theo khoá, tối đa "mỗi mẻ"; việc Muse chỉ chạy tài khoản Muse, việc Flow chỉ chạy tài khoản Flow', async () => {
  const daChay = [], chuyen = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay), chuyenFile: (a, b) => chuyen.push([a, b]), tonTai: () => false });
  dp.datCaiDat({ nghiGiuaLanGui: 0, flow: { meToiDa: 3 } });
  dp.them({ nen: 'flow', loai: 'anh', tyLe: '9:16', prompts: ['1', '2', '3', '4', '5'] });
  dp.them({ nen: 'flow', loai: 'anh', tyLe: '16:9', prompts: ['ngang'] });
  dp.them({ nen: 'muse', loai: 'anh', prompts: ['m1', 'm2'] });
  dp.chayTatCa();
  await chayHet(dp);
  const me = daChay.filter((x) => x.so);
  assert.deepStrictEqual(me.map((x) => x.so), [[1, 2, 3], [4, 5], [6]], JSON.stringify(me.map((x) => x.so)));
  assert.ok(me.every((x) => x.tk === 'flow-1'));
  assert.deepStrictEqual(me[0].ten, ['Mac_dinh_001', 'Mac_dinh_002', 'Mac_dinh_003']);
  const muse = daChay.filter((x) => Array.isArray(x));
  assert.deepStrictEqual(muse.map((x) => x[0]), ['tk-1', 'tk-1'], 'việc Muse không lọt sang tài khoản Flow');
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'), dp.viec.map((j) => j.trangThai).join());
  const j1 = dp.viec[0];
  assert.ok(/[\\/]001\.png$/.test(j1.files[0]) && chuyen.some(([a, b]) => a === '/tam/Mac_dinh_001.png' && b === j1.files[0]), 'file Flow tải về được chuyển ra thư mục kết quả');
  assert.deepStrictEqual(j1.flowTen, { tk: 'flow-1', ten: 'Mac_dinh_001' });
});
testAsync('tự xoá dự án Flow khi xong: chỉ tài khoản Flow đã chạy trong lượt; xoá xong thì ảnh Flow không còn dùng lại được', async () => {
  let don = null;
  const { dp, tk } = dungDieuPhoi({ taoLuong: luongGiaHaiNen([]), donDep: async (d) => { don = d; } });
  tk.them('Flow 2', 'flow');
  dp.datCaiDat({ nghiGiuaLanGui: 0, xoaDuAnFlowKhiXong: true });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['1'] });
  dp.chayTatCa();
  await chayHet(dp);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepStrictEqual([don.flow, don.muse.size, don.duAn], [['flow-1'], 0, 'mac-dinh']);
  // Lượt trước dừng giữa chừng (không dọn) → lượt sau không xoá dự án của tài khoản chỉ chạy ở lượt trước.
  dp.tkFlowDaChay.set('mac-dinh', new Set(['flow-2']));
  dp.dungTatCa();
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['2'] });
  dp.chayTatCa();
  await chayHet(dp);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepStrictEqual(don.flow, ['flow-1']);
  assert.ok(dp.viec[0].flowTen);
  dp.datFlowUrl('mac-dinh', 'flow-1', 'https://flow.google.com/project/abc');
  dp.boFlowTen('flow-1', 'mac-dinh');
  assert.strictEqual(dp.viec[0].flowTen, null);
  assert.strictEqual(dp.flowUrlCua('mac-dinh', 'flow-1'), '', 'xoá xong thì dự án quên địa chỉ dự án Flow đó');
});
testAsync('nối qua lại: ảnh Flow → video Muse (kèm ảnh Flow); ảnh Muse → video Flow (kèm ảnh Muse)', async () => {
  const daChay = [], co = new Set();   // file đã ghi ra thư mục kết quả (ảnh nguồn của video phải "tồn tại")
  const { dp } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay), tonTai: (p) => co.has(p),
    ghiFile: (p) => co.add(p), chuyenFile: (_a, b) => co.add(b) });
  dp.datCaiDat({ nghiGiuaLanGui: 0 });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['a'], chuoiVideo: { prompt: 'đi', nen: 'muse' } });
  dp.them({ nen: 'muse', loai: 'anh', prompts: ['b'], chuoiVideo: { prompt: 'chạy', nen: 'flow' } });
  dp.chayTatCa();
  await chayHet(dp);
  const [aF, aM] = dp.viec;
  const vM = dp.viec.find((j) => j.tuAnh === aF.id), vF = dp.viec.find((j) => j.tuAnh === aM.id);
  assert.ok(vM && vM.nen === 'muse' && vM.loai === 'video' && vM.trangThai === 'xong' && vM.taiKhoan === 'tk-1');
  assert.deepStrictEqual(vM.thamChieu, [aF.files[0]]);
  assert.ok(vF && vF.nen === 'flow' && vF.trangThai === 'xong' && vF.taiKhoan === 'flow-1');
  assert.deepStrictEqual(daChay.find((x) => x.so && x.so[0] === vF.so).anh, [[aM.files[0]]], 'mẻ Flow nhận ảnh Muse để tải lên');
  assert.ok(!aM.flowTen && !vF.flowAnh, 'ảnh Muse không có tên trên Flow');
});
testAsync('Flow: chuỗi mặc định cùng nền tảng với ảnh; ảnh Flow → video Flow nhớ tên ảnh trên Flow', async () => {
  const co = new Set();
  const { dp } = dungDieuPhoi({ taoLuong: luongGiaHaiNen([]), tonTai: (p) => co.has(p), chuyenFile: (_a, b) => co.add(b) });
  dp.datCaiDat({ nghiGiuaLanGui: 0 });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['a'], chuoiVideo: { prompt: 'đi' } });
  dp.chayTatCa();
  await chayHet(dp);
  const v = dp.viec.find((j) => j.loai === 'video');
  assert.strictEqual(v.nen, 'flow');
  assert.deepStrictEqual(v.flowAnh, { tk: 'flow-1', ten: 'Mac_dinh_001', file: dp.viec[0].files[0] });
});
testAsync('Flow: tài khoản Flow lỗi → việc chuyển sang tài khoản Flow dự phòng (không sang Muse)', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay, new Set(['flow-1'])) });
  const f2 = tk.them('Flow 2', 'flow');
  dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['1', '2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.taiKhoan === f2.id && j.tkLoi.includes('flow-1')), dp.viec.map((j) => j.trangThai + j.taiKhoan).join());
  assert.ok(!daChay.some((x) => Array.isArray(x)), 'không tài khoản Muse nào chạy việc Flow');
  assert.ok(nhatKy.some((x) => /chuyển sang "Flow 2"/.test(x)));
});
test('1.2.0 chạy nhiều tài khoản cùng lúc: nhóm = N tài khoản dùng được đầu danh sách; lỗi / nghỉ thì dự phòng vào thay', () => {
  const ds = ['A', 'B', 'C', 'D'];
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({}, ds, null, 2), ['A', 'B']);
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({ tkLoi: ['A'] }, ds, null, 2), ['B'], 'việc lỗi ở A → tài khoản khác trong nhóm');
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({ tkLoi: ['A', 'B'] }, ds, null, 2), ['C'], 'cả nhóm lỗi việc này → dự phòng kế tiếp');
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({}, ds, (id) => id === 'A', 2), ['B', 'C'], 'A nghỉ → C vào nhóm');
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({ tkLoi: ds }, ds, null, 2), ['A'], 'lỗi ở mọi tài khoản → về chính (hết vòng)');
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({ thread: 't', taiKhoan: 'B' }, ds, null, 3), ['B'], 'chat dở → đúng tài khoản');
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({}, ds, null, 9), ds);
  assert.deepStrictEqual(HD.taiKhoanChoViecDs({}, ['A'], () => true, 2), []);
  // 1 tài khoản cùng lúc = đúng như bản cũ (chính → dự phòng).
  for (const j of [{}, { tkLoi: ['A'] }, { tkLoi: ['A', 'B'] }, { tkLoi: ds }]) assert.deepStrictEqual(HD.taiKhoanChoViecDs(j, ds, null, 1), [HD.taiKhoanChoViec(j, ds)]);
});
testAsync('1.2.0 Muse: dự án chạy 2 tài khoản cùng lúc — hai tài khoản chạy song song, dự phòng thứ 3 chỉ vào khi một tài khoản hỏng', async () => {
  const daChay = [], hong = new Set();
  let dang = 0, max = 0;
  const taoLuong = (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j) {
      this.ranh = false; this.viec = j; daChay.push([a.id, j.so]); dang++; max = Math.max(max, dang);
      await new Promise((r) => setTimeout(r, 20)); dang--; this.ranh = true; this.viec = null;
      return hong.has(a.id) ? { ok: false, loi: 'Muse lỗi' } : { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
    } });
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong });
  tk.them('Hai'); tk.them('Ba');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  const d = dp.taoDuAn('P', ['tk-1', 'hai', 'ba'], { muse: 2 });
  assert.deepStrictEqual(d.chaySong, { muse: 2, flow: 1, suno: 1 });
  dp.them({ duAn: d.id, prompts: ['1', '2', '3', '4', '5', '6'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  assert.strictEqual(max, 2, 'hai tài khoản chạy CÙNG LÚC');
  assert.deepStrictEqual([...new Set(daChay.map((x) => x[0]))].sort(), ['hai', 'tk-1'], 'dự phòng "Ba" không chạy khi không ai lỗi');
  // Tài khoản chính hỏng → lỗi liên tiếp thì nghỉ, "Ba" vào nhóm cùng "Hai".
  hong.add('tk-1'); daChay.length = 0;
  dp.them({ duAn: d.id, prompts: ['7', '8', '9', '10', '11', '12'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'), dp.viec.map((j) => j.trangThai).join());
  assert.ok(dp._nghi('tk-1'), 'tài khoản hỏng tạm nghỉ');
  assert.ok(daChay.some((x) => x[0] === 'ba'), 'dự phòng vào thay tài khoản hỏng');
  assert.ok(nhatKy.some((x) => /tạm nghỉ tài khoản này/.test(x)));
  dp.datTaiKhoanDuAn(d.id, ['tk-1'], { muse: 99, flow: '2', suno: 0 });
  assert.deepStrictEqual(dp.duAn.find((x) => x.id === d.id).chaySong, { muse: 50, flow: 2, suno: 1 }, 'kẹp 1–50');
});
testAsync('1.2.0 Flow: 2 tài khoản cùng lúc chia đều mẻ, chạy song song', async () => {
  const daChay = [];
  const { dp, tk } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay) });
  const f2 = tk.them('Flow 2', 'flow');
  tk.them('Flow 3', 'flow');
  dp.datCaiDat({ nghiGiuaLanGui: 0, flow: { meToiDa: 10 } });
  const d = dp.taoDuAn('P', ['flow-1', f2.id], { flow: 2 });
  dp.them({ duAn: d.id, nen: 'flow', loai: 'anh', prompts: ['1', '2', '3', '4', '5', '6'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  const me = daChay.filter((x) => x.so);
  assert.deepStrictEqual(me.map((x) => [x.tk, x.so.length]).sort(), [['flow-1', 3], [f2.id, 3]], JSON.stringify(me));
});
testAsync('Flow hỏng mọi tài khoản → dừng Flow, việc còn lại (ảnh + video) tự chạy ở Muse', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay, new Set(['flow-1'])) });
  tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0, flow: { meToiDa: 1 } });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['1', '2', '3'] });
  dp.them({ nen: 'flow', loai: 'video', prompts: ['v'] });
  dp.chayTatCa();
  await chayHet(dp);
  const anh = dp.viec.filter((j) => j.loai === 'anh');
  assert.ok(anh.every((j) => j.trangThai === 'xong' && j.nen === 'muse' && j.taiKhoan === 'tk-1' && j.tuFlow), anh.map((j) => j.trangThai + j.nen + j.taiKhoan).join());
  assert.ok(dp._nghi('flow-1'), 'tài khoản Flow hỏng tạm nghỉ (Muse tính là dự phòng)');
  assert.ok(nhatKy.some((x) => /🔀 Flow → Muse/.test(x)), nhatKy.join('\n'));
  const v = dp.viec.find((j) => j.loai === 'video');
  assert.ok(v.nen === 'muse' && v.trangThai === 'xong' && v.daQuaNen, '1.2.1: video Flow cũng sang Muse (bên nào lỗi đổi sang bên kia) — ' + v.nen + v.trangThai);
});
// ── Nhật ký 18/10/2026 00:42: 5 tài khoản Flow chạy cùng lúc, lần lượt lỗi, chỉ còn 1 chạy mà Muse ngồi không ──
const duAnHaiBen = (o = {}) => {
  const b = dungDieuPhoi({ taoLuong: o.taoLuong || (() => ({ ranh: true, dung() {} })), tonTai: (p) => String(p).startsWith('/anh/') });
  const flow = ['flow-1', ...['Flow 2', 'Flow 3', 'Flow 4', 'Flow 5', 'Flow 6'].map((t) => b.tk.them(t, 'flow').id)];
  const muse = ['tk-1', ...['Muse 2', 'Muse 3', 'Muse 4'].map((t) => b.tk.them(t).id)];
  for (const id of [...flow, ...muse]) b.tk.sua(id, { trangThai: 'da-dang-nhap' });
  b.dp.datCaiDat({ luongMoiTK: 2, nghiGiuaLanGui: 0, tuThuLai: 1, tuChayLaiLoi: 0, flow: { meToiDa: 1, tabMoiTK: 1 } });
  // Flow: 5 Chạy + 1 Dự phòng; Muse: 1 Chạy + 3 Dự phòng (như ảnh hộp tài khoản của người dùng).
  const d = b.dp.taoDuAn('Judah', [...flow, ...muse], { flow: 5, muse: 1 });
  b.dp.them({ duAn: d.id, nen: 'flow', loai: 'video', prompts: Array.from({ length: 30 }, (_, i) => `v${i + 1}`),
    thamChieuTheoDong: Array.from({ length: 30 }, (_, i) => [`/anh/${i + 1}.png`]) });
  b.dp.duAnChay.add(d.id);
  return { ...b, d, flow, muse };
};
test('giữ đủ số tài khoản chạy cùng lúc: dự phòng Flow vào thay trước, chưa thiếu thì KHÔNG mượn Muse', () => {
  const { dp, flow, nhatKy } = duAnHaiBen();
  dp._choNghi(flow[0], 'hết credit');
  dp._canBang();
  assert.ok(dp.viec.every((j) => j.nen === 'flow' && !j.muon), '1 tài khoản lỗi, Flow 6 dự phòng vào thay → vẫn đủ 5');
  assert.ok(!nhatKy.some((x) => /🔀/.test(x)));
  assert.strictEqual(dp._soSong(dp.viec[0].duAn, 'muse'), 1, 'Muse vẫn chạy 1 tài khoản');
});
test('giữ đủ số tài khoản chạy cùng lúc: còn 1/5 tài khoản Flow → Muse chạy thêm 4 tài khoản, nhận việc vừa đủ (không cả hàng chờ)', () => {
  const { dp, d, flow, nhatKy } = duAnHaiBen();
  for (const id of flow.slice(1)) dp._choNghi(id, 'hoạt động bất thường');   // 5/6 tài khoản Flow nghỉ, còn flow-1
  dp._canBang();
  const muon = dp.viec.filter((j) => j.nen === 'muse');
  assert.strictEqual(muon.length, 8, `thiếu 4 tài khoản × 2 luồng Muse = 8 việc — được ${muon.length}`);
  assert.deepStrictEqual(muon.map((j) => j.so), [1, 2, 3, 4, 5, 6, 7, 8], 'mượn việc đầu hàng chờ');
  assert.ok(muon.every((j) => j.muon && j.muon.tu === 'flow' && j.tuFlow && j.thamChieu[0] === `/anh/${j.so}.png`), 'giữ ảnh nguồn');
  assert.strictEqual(dp._soSong(d.id, 'muse'), 5, 'Muse: 1 tài khoản Chạy + 4 tài khoản mượn');
  assert.strictEqual(dp._soSong(d.id, 'flow'), 5);
  assert.ok(nhatKy.some((x) => /🔀 Flow → Muse: dự án "Judah" chạy 5 tài khoản Flow cùng lúc nhưng chỉ còn 1 tài khoản chạy được video — Muse chạy thêm 4 tài khoản, nhận 8 video/.test(x)), nhatKy.join('\n'));
  dp._canBang();
  assert.strictEqual(dp.viec.filter((j) => j.nen === 'muse').length, 8, 'gọi lại không mượn thêm khi chưa chạy xong');
  // Một tài khoản Flow hết giờ nghỉ → thiếu 3 → trả 2 video chưa chạy (mới mượn trả trước).
  dp.nghiDen[flow[1]] = 0;
  dp._canBang();
  assert.deepStrictEqual(dp.viec.filter((j) => j.nen === 'muse').map((j) => j.so), [1, 2, 3, 4, 5, 6]);
  const tra = dp.viec.find((j) => j.so === 8);
  assert.ok(tra.nen === 'flow' && !tra.muon && !tra.tuFlow && !(tra.daQuaNen || []).length, JSON.stringify(tra));
  // Flow có lại đủ tài khoản → mọi việc mượn chưa chạy quay về Flow.
  dp.nghiDen = {};
  dp._canBang();
  assert.ok(dp.viec.every((j) => j.nen === 'flow' && !j.muon), dp.viec.map((j) => j.nen).join());
  assert.ok(nhatKy.some((x) => /🔀 Flow đã có lại tài khoản chạy được .* 6 video chưa chạy quay về Flow/.test(x)), nhatKy.join('\n'));
  assert.strictEqual(dp._soSong(d.id, 'muse'), 1);
});
test('giữ đủ số tài khoản chạy cùng lúc: mọi tài khoản Flow nghỉ → Muse chạy thêm 5 tài khoản (mượn 10 việc, không phải cả 30)', () => {
  const { dp, d, flow } = duAnHaiBen();
  for (const id of flow) dp._choNghi(id, 'hoạt động bất thường');
  dp._canBang();
  assert.strictEqual(dp.viec.filter((j) => j.nen === 'muse').length, 10);
  assert.strictEqual(dp._soSong(d.id, 'muse'), 6);
  // Việc đang chạy ở Muse không bị kéo về.
  dp.viec.filter((j) => j.nen === 'muse').forEach((j, i) => { if (i < 3) j.trangThai = 'chay'; });
  dp.nghiDen = {};
  dp._canBang();
  assert.deepStrictEqual(dp.viec.filter((j) => j.nen === 'muse').map((j) => j.trangThai), ['chay', 'chay', 'chay']);
});
test('giữ đủ số tài khoản chạy cùng lúc — chiều ngược lại: Muse bị chặn video ở mọi tài khoản → Flow chạy thêm tài khoản', () => {
  const b = dungDieuPhoi({ tonTai: (p) => String(p).startsWith('/anh/') });
  const m2 = b.tk.them('Muse 2').id, f2 = b.tk.them('Flow 2', 'flow').id;
  for (const id of ['tk-1', m2, 'flow-1', f2]) b.tk.sua(id, { trangThai: 'da-dang-nhap' });
  b.dp.datCaiDat({ luongMoiTK: 3, nghiGiuaLanGui: 0, flow: { meToiDa: 2, tabMoiTK: 1 } });
  const d = b.dp.taoDuAn('P', ['tk-1', m2, 'flow-1', f2], { muse: 2, flow: 1 });
  b.dp.them({ duAn: d.id, loai: 'video', prompts: ['a', 'b', 'c', 'd', 'e', 'f'], thamChieu: ['/anh/x.png'] });
  b.dp.them({ duAn: d.id, loai: 'anh', prompts: ['anh'] });
  b.dp.duAnChay.add(d.id);
  b.tk.sua('tk-1', { chanVideoDen: Date.now() + 3600000 });
  b.dp._canBang();
  assert.strictEqual(b.dp.viec.filter((j) => j.nen === 'flow').length, 2, 'thiếu 1 tài khoản Muse → Flow nhận 1 tài khoản × 1 tab × 2 mỗi mẻ');
  b.tk.sua(m2, { chanVideoDen: Date.now() + 3600000 });
  b.dp._canBang();
  assert.strictEqual(b.dp.viec.filter((j) => j.nen === 'flow').length, 4, 'thiếu 2 → 4 việc');
  assert.strictEqual(b.dp._soSong(d.id, 'flow'), 3);
  assert.ok(b.dp.viec.find((j) => j.loai === 'anh').nen === 'muse', 'ảnh Muse không bị chặn → không mượn');
});
testAsync('giữ đủ số tài khoản chạy cùng lúc: chạy thật — Flow còn 1 tài khoản, Muse chạy song song nhiều tài khoản, xong hết', async () => {
  const daChay = [];
  let dang = 0, max = 0;
  const muse = new Set();
  const taoLuong = (a, stt) => (a.nen === 'flow' ? luongGiaHaiNen(daChay)(a, stt) : { id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j) {
      this.ranh = false; this.viec = j; daChay.push([a.id, j.so]); dang++; max = Math.max(max, dang); muse.add(a.id);
      await new Promise((r) => setTimeout(r, 30)); dang--; this.ranh = true; this.viec = null;
      return { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] };
    } });
  const { dp, flow } = duAnHaiBen({ taoLuong });
  for (const id of flow.slice(1)) dp._choNghi(id, 'hoạt động bất thường');
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'), dp.viec.map((j) => j.trangThai).join());
  assert.ok(daChay.some((x) => x.so && x.tk === 'flow-1'), 'Flow 1 vẫn chạy');
  assert.ok(muse.size >= 4 && max >= 5, `Muse chạy nhiều tài khoản cùng lúc: ${[...muse]} · tối đa ${max} việc cùng lúc`);
});
// ── 1.3.7: tài khoản riêng cho ảnh / video, màu đỏ / xanh của tài khoản ─────────────────────────────
test('1.3.7 tài khoản riêng từng loại: ảnh chỉ "Flow 1", video không dùng "Flow 1"; số chạy cùng lúc tính theo loại', () => {
  const { dp, tk } = dungDieuPhoi();
  const f2 = tk.them('Flow 2', 'flow'), f3 = tk.them('Flow 3', 'flow');
  for (const id of ['flow-1', f2.id, f3.id]) tk.sua(id, { trangThai: 'da-dang-nhap' });
  // Flow 1 + Flow 2 Chạy, Flow 3 Dự phòng; ảnh: bỏ Flow 2, Flow 3; video: bỏ Flow 1.
  const d = dp.taoDuAn('Rieng', ['flow-1', f2.id, f3.id], { flow: 2 }, undefined, { anh: [f2.id, f3.id], video: ['flow-1'], la: ['x'] });
  assert.deepStrictEqual(d.boLoai, { anh: [f2.id, f3.id], video: ['flow-1'] }, 'chỉ giữ khoá anh / video');
  assert.deepStrictEqual(dp._dsTk(d.id, 'flow', 'anh'), ['flow-1']);
  assert.deepStrictEqual(dp._dsTk(d.id, 'flow', 'video'), [f2.id, f3.id]);
  assert.deepStrictEqual(dp._dsTk(d.id, 'flow'), ['flow-1', f2.id, f3.id], 'không nói loại = mọi tài khoản như cũ');
  assert.strictEqual(dp._soSong(d.id, 'flow', true, 'video'), 1, 'video: chỉ Flow 2 là tài khoản Chạy — Flow 3 vẫn là dự phòng');
  assert.strictEqual(dp._soSong(d.id, 'flow', true, 'anh'), 1);
  assert.strictEqual(dp._soSong(d.id, 'flow', true), 2);
  dp.them({ duAn: d.id, nen: 'flow', loai: 'anh', prompts: ['a'] });
  dp.them({ duAn: d.id, nen: 'flow', loai: 'video', prompts: ['v'] });
  const [anh, vid] = dp.viec;
  assert.deepStrictEqual(dp._tkCho(anh), ['flow-1']);
  assert.deepStrictEqual(dp._tkCho(vid), [f2.id], 'video không bao giờ vào Flow 1');
  vid.tkLoi = [f2.id];
  assert.deepStrictEqual(dp._tkCho(vid), [f3.id], 'Flow 2 lỗi video → dự phòng Flow 3, không phải Flow 1');
  dp._choNghi('flow-1', 'hoạt động bất thường');
  assert.deepStrictEqual(dp._tkCho(anh), [], 'Flow 1 nghỉ → ảnh chờ (không lấy tài khoản chỉ dành cho video)');
  // Lỗi ở tài khoản ảnh → không chuyển sang tài khoản video.
  delete dp.nghiDen['flow-1'];
  Object.assign(anh, { trangThai: 'chay', taiKhoan: 'flow-1' });
  dp.datCaiDat({ doiNenKhiLoi: false, tuThuLai: 1, duAn: d.id });
  dp._ketThuc(anh, { ok: false, loi: 'Flow: tạo hỏng' }, tk.tim('flow-1'));
  assert.ok(anh.trangThai === 'cho' && !dp._tkCho(anh).some((id) => id !== 'flow-1'), JSON.stringify(dp._tkCho(anh)));
  // Lưu lại từ hộp thoại: đổi được, bỏ trống = dùng cho mọi loại.
  dp.datTaiKhoanDuAn(d.id, ['flow-1', f2.id, f3.id], { flow: 2 }, { anh: [], video: [] });
  assert.deepStrictEqual(dp._dsTk(d.id, 'flow', 'video'), ['flow-1', f2.id, f3.id]);
  dp.datTaiKhoanDuAn(d.id, ['flow-1'], { flow: 1 });
  assert.deepStrictEqual(dp.duAn.find((x) => x.id === d.id).boLoai, { anh: [], video: [] }, 'không gửi boLoai thì giữ nguyên');
});
testAsync('1.3.7 chạy thật: ảnh chỉ chạy "Flow 1", video nối từ ảnh chỉ chạy "Flow 2" (tải lại ảnh lên Flow 2)', async () => {
  const daChay = [];
  const { dp, tk } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay) });
  const f2 = tk.them('Flow 2', 'flow');
  for (const id of ['flow-1', f2.id]) tk.sua(id, { trangThai: 'da-dang-nhap' });
  const d = dp.taoDuAn('Rieng', ['flow-1', f2.id], { flow: 2 }, undefined, { anh: [f2.id], video: ['flow-1'] });
  dp.datCaiDat({ nghiGiuaLanGui: 0, flow: { meToiDa: 1 }, duAn: d.id });
  dp.them({ duAn: d.id, nen: 'flow', loai: 'anh', prompts: ['1', '2', '3'], chuoiVideo: { prompt: 'zoom', nen: 'flow' } });
  dp.chayDuAn(d.id);
  await chayHet(dp);
  const me = daChay.filter((x) => x.so);
  const loaiCua = (so, i) => dp.viec.filter((j) => j.so === so)[i];
  assert.ok(dp.viec.length === 6 && dp.viec.every((j) => j.trangThai === 'xong'), dp.viec.map((j) => `${j.loai}${j.so}:${j.trangThai}`).join());
  for (const j of dp.viec) assert.strictEqual(j.taiKhoan, j.loai === 'anh' ? 'flow-1' : f2.id, `${j.loai} #${j.so} chạy ở ${j.taiKhoan}`);
  assert.ok(me.length === 6 && loaiCua(1, 0), 'đủ 6 mẻ');
});
test('1.3.7 bỏ ô Video ở MỌI tài khoản Flow → video Flow tạm dừng, nhật ký nói rõ cần bật lại ô Video; bật Muse ⇄ Flow thì video sang Muse', () => {
  const { dp, tk, nhatKy } = dungDieuPhoi();
  tk.sua('flow-1', { trangThai: 'da-dang-nhap' }); tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  const d = dp.taoDuAn('X', ['flow-1', 'tk-1'], { flow: 1 }, undefined, { video: ['flow-1'] });
  dp.datCaiDat({ doiNenKhiLoi: false, duAn: d.id });
  dp.them({ duAn: d.id, nen: 'flow', loai: 'video', prompts: ['v'] });
  dp.chayDuAn(d.id);
  for (let i = 0; i < 3; i++) dp._vong();
  assert.ok(dp.viec[0].trangThai === 'cho' && !dp.dangChay, 'tạm dừng, không phí lượt');
  assert.ok(nhatKy.some((x) => /⏸ .*không tài khoản nào được bật ô video Flow — bấm nút tài khoản cạnh tên dự án/.test(x)), nhatKy.join('\n'));
  const b = dungDieuPhoi({ taoLuong: () => ({ ranh: true, dung() {}, chay: () => new Promise(() => {}) }) });
  b.tk.sua('flow-1', { trangThai: 'da-dang-nhap' }); b.tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  const d2 = b.dp.taoDuAn('Y', ['flow-1', 'tk-1'], { flow: 1 }, undefined, { video: ['flow-1'] });
  b.dp.them({ duAn: d2.id, nen: 'flow', loai: 'video', prompts: ['v'] });
  b.dp.chayDuAn(d2.id);
  assert.deepStrictEqual([b.dp.viec[0].nen, b.dp.viec[0].taiKhoan], ['muse', 'tk-1'], 'Muse ⇄ Flow bật (mặc định) → video chạy ở Muse');
});
test('1.3.8 tài khoản lỗi ghi RÕ lỗi: nghỉ vì lỗi liên tiếp kèm lỗi gần nhất (chữ Muse/Flow báo), thẻ đỏ + hộp tạm dừng ghi đúng câu đó', () => {
  const { dp, tk, nhatKy } = dungDieuPhoi();
  const m2 = tk.them('Muse 2', 'muse');
  for (const id of ['tk-1', m2.id]) tk.sua(id, { trangThai: 'da-dang-nhap' });
  dp.them({ loai: 'video', prompts: ['a', 'b'] });
  const cau = 'Muse trả lời chữ, không có video: "Your video limit for the last 24 hours has been reached. Please try again later."';
  for (const j of dp.viec) { Object.assign(j, { trangThai: 'chay', taiKhoan: 'tk-1' }); dp._ketThuc(j, { ok: false, loi: cau }, tk.tim('tk-1')); }
  const sk = dp.trangThai().sucKhoe['tk-1'];
  assert.ok(sk.muc === 'loi' && sk.chu.includes('lỗi 2 việc liên tiếp, lần gần nhất: Muse trả lời chữ') && sk.chu.includes('Your video limit for the last 24 hours'), sk.chu);
  assert.ok(nhatKy.some((x) => /⚠ "Muse 1": lỗi 2 việc liên tiếp, lần gần nhất: .*Your video limit/.test(x)), nhatKy.join('\n'));
  // Lỗi rất dài → một dòng, cắt ở 200 ký tự.
  const d = dungDieuPhoi();
  d.tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  d.dp.them({ prompts: ['x'] });
  Object.assign(d.dp.viec[0], { trangThai: 'chay', taiKhoan: 'tk-1' });
  d.dp._ketThuc(d.dp.viec[0], { ok: false, loi: 'dòng 1\n' + 'x'.repeat(400) }, d.tk.tim('tk-1'));
  const loi = d.dp.ketQuaTk['tk-1'].loi;
  assert.ok(loi.length === 200 && loi.endsWith('…') && !/\n/.test(loi), loi);
  // Hộp tạm dừng: tài khoản không nghỉ mà lỗi → ghi lỗi đó thay vì "đang lỗi".
  d.dp._baoTamDung(d.dp.viec, 'dự án');
  assert.ok(d.nhatKy.some((x) => /⏸ .*"Muse 1": lỗi: dòng 1 xxx/.test(x)), d.nhatKy.slice(-1)[0]);
});
test('1.3.8 hộp chọn tài khoản: tài khoản đỏ ghi lý do ngay dưới tên; máy Flow nghỉ thì thẻ đỏ lấy lý do thật', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'app.js'), 'utf8');
  assert.ok(/sk\.muc === 'loi' \? `<small class="ly-loi">\$\{esc\(sk\.chu\)\}/.test(a));
  const m = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/lyDo: so\.lyDoNghi \|\| /.test(m));
});
test('1.3.7 tình trạng tài khoản: xám chưa kiểm → xanh khi xong việc → đỏ khi lỗi / nghỉ / chặn / chưa đăng nhập', () => {
  const { dp, tk } = dungDieuPhoi();
  const sk = (id) => dp.trangThai().sucKhoe[id];
  assert.strictEqual(sk('tk-1').muc, 'cho');
  tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  assert.strictEqual(sk('tk-1').muc, 'tot');
  dp.them({ prompts: ['a', 'b'] });
  const [a, b] = dp.viec;
  Object.assign(a, { trangThai: 'chay', taiKhoan: 'tk-1' });
  assert.deepStrictEqual([sk('tk-1').muc, sk('tk-1').dang], ['tot', 1]);
  dp._ketThuc(a, { ok: false, loi: 'Quá 180 giây chưa thấy kết quả' }, tk.tim('tk-1'));
  assert.strictEqual(sk('tk-1').muc, 'loi');
  assert.ok(/Quá 180 giây/.test(sk('tk-1').chu), sk('tk-1').chu);
  Object.assign(b, { trangThai: 'chay', taiKhoan: 'tk-1' });
  dp._ketThuc(b, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, tk.tim('tk-1'));
  assert.ok(sk('tk-1').muc === 'tot' && sk('tk-1').luc > 0, JSON.stringify(sk('tk-1')));
  dp._choNghi('tk-1', 'lỗi 3 việc liên tiếp');
  assert.ok(sk('tk-1').muc === 'loi' && sk('tk-1').den > Date.now() && /lỗi 3 việc/.test(sk('tk-1').chu));
  delete dp.nghiDen['tk-1'];
  tk.sua('tk-1', { chanVideoDen: Date.now() + 3600000 });
  assert.ok(sk('tk-1').muc === 'loi' && /chặn tạo video/.test(sk('tk-1').chu));
  tk.sua('tk-1', { chanVideoDen: 0, trangThai: 'can-dang-nhap' });
  assert.ok(sk('tk-1').muc === 'loi' && /Chưa đăng nhập/.test(sk('tk-1').chu));
  tk.sua('suno-1', { trangThai: 'da-dang-nhap', hetLuotDen: Date.now() + 60000 });
  assert.strictEqual(sk('suno-1').muc, 'loi');
  // Flow tự cho tài khoản nghỉ (dự án không còn tài khoản Flow nào khác) — máy Flow báo qua o.nghiFlow.
  dp.o.nghiFlow = (id) => (id === 'flow-1' ? { den: Date.now() + 60000, lyDo: 'Flow báo lỗi' } : null);
  tk.sua('flow-1', { trangThai: 'da-dang-nhap' });
  assert.strictEqual(sk('flow-1').muc, 'loi');
});
test('1.3.7 giao diện: thẻ tài khoản tô đỏ / xanh, hộp chọn tài khoản có ô Ảnh / Video; lệnh lưu gửi boLoai', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'app.js'), 'utf8');
  const c = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'style.css'), 'utf8');
  const m = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.ok(/the-tk tk-\$\{nen\} sk-\$\{sk\.muc\}/.test(a) && /veSucKhoe\(sk\)/.test(a));
  assert.ok(/\.the-tk\.sk-loi \{/.test(c) && /\.the-tk\.sk-tot \{/.test(c));
  assert.ok(/name="loai_\$\{l\}_\$\{esc\(id\)\}"/.test(a) && /boLoai: layBoLoai\(v\)/.test(a) && /boLoai: bo \}/.test(a));
  assert.ok(/datTaiKhoanDuAn: \(\{ id, taiKhoan: ds, chaySong, boLoai \}\)/.test(m) && /nghiFlow:/.test(m));
});
testAsync('tắt "Muse ⇄ Flow": ảnh Flow không sang Muse', async () => {
  const daChay = [];
  const { dp, tk } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay, new Set(['flow-1'])) });
  tk.sua('tk-1', { trangThai: 'da-dang-nhap' });
  dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, doiNenKhiLoi: false, flow: { meToiDa: 1 } });
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['1', '2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.nen === 'flow' && j.trangThai === 'loi'), dp.viec.map((j) => j.trangThai + j.nen).join());
  assert.ok(!daChay.some((x) => Array.isArray(x)), 'không tài khoản Muse nào chạy');
});
// ── 1.2.1: Muse ⇄ Flow — bên nào lỗi thì việc tự sang bên kia ─────────────────────────────────────
test('1.2.1 nhận ra Muse TỪ CHỐI tạo (ảnh chụp 16/10/2026: "Mình không thể tạo video từ ảnh này.")', () => {
  for (const c of ['Mình không thể tạo video từ ảnh này.', 'Xin lỗi, mình không thể tạo video từ hình ảnh này vì nó có thể vi phạm chính sách.',
    'Mình chưa thể tạo ảnh theo yêu cầu này.', "I can't create a video from this image.", 'Sorry, I am unable to generate a video from this photo.',
    'I cannot animate this image.', 'Tôi không tạo được video từ ảnh bạn gửi.']) assert.ok(HD.laTuChoi(c), c);
  for (const c of ['Bạn muốn video theo phong cách nào?', 'Đây là video của bạn!', 'Mình có thể tạo video từ ảnh này, bạn muốn chuyển động thế nào?',
    'Block vẫn còn (lỗi 403, tạo video không khả dụng tại khu vực này).', 'Không thể kết nối máy chủ.', '', 'x'.repeat(500) + ' không thể tạo video']) {
    assert.ok(!HD.laTuChoi(c), c);
  }
});
// Muse giả: việc có số trong `tuChoi` thì Muse trả "không thể tạo video từ ảnh này"; tài khoản trong `hong` thì lỗi thường.
const luongMuseFlow = (daChay, { tuChoi = new Set(), hong = new Set(), flowHong = new Set() } = {}) => (a, stt) => (a.nen === 'flow'
  ? luongGiaHaiNen(daChay, flowHong)(a, stt)
  : { id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j) {
      this.ranh = false; this.viec = j; daChay.push([a.id, j.so, j.loai]);
      await new Promise((r) => setTimeout(r, 10)); this.ranh = true; this.viec = null;
      if (tuChoi.has(j.so)) return { ok: false, tuChoi: true, loi: 'Muse từ chối tạo video: "Mình không thể tạo video từ ảnh này."' };
      if (hong.has(a.id)) return { ok: false, loi: 'Muse lỗi' };
      return { ok: true, files: [{ mime: j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] };
    } });
testAsync('1.2.1 Muse từ chối tạo video từ MỘT ảnh → chỉ ảnh đó sang Flow tạo video (đúng ảnh nguồn), còn lại vẫn ở Muse', async () => {
  const daChay = [];
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong: luongMuseFlow(daChay, { tuChoi: new Set([2]) }), tonTai: (p) => p.startsWith('/anh/') });
  tk.sua('flow-1', { trangThai: 'da-dang-nhap' });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 2, tuChayLaiLoi: 0, flow: { meToiDa: 5 } });
  dp.them({ loai: 'video', prompts: ['v1', 'v2', 'v3'], thamChieuTheoDong: [['/anh/001.png'], ['/anh/002.png'], ['/anh/003.png']] });
  dp.chayTatCa();
  await chayHet(dp);
  const [v1, v2, v3] = dp.viec;
  assert.ok([v1, v3].every((j) => j.trangThai === 'xong' && j.nen === 'muse' && j.taiKhoan === 'tk-1'), dp.viec.map((j) => j.trangThai + j.nen + j.taiKhoan).join());
  assert.ok(v2.trangThai === 'xong' && v2.nen === 'flow' && v2.taiKhoan === 'flow-1', `${v2.trangThai} ${v2.nen} ${v2.taiKhoan} ${v2.loi}`);
  const me = daChay.filter((x) => x.so);
  assert.deepStrictEqual(me.map((x) => [x.so, x.anh]), [[[2], [['/anh/002.png']]]], 'Flow nhận đúng việc #2 với đúng ảnh nguồn');
  assert.strictEqual(daChay.filter((x) => Array.isArray(x) && x[1] === 2).length, 1, 'không phí thêm lượt Muse cho ảnh Muse đã từ chối');
  assert.ok(nhatKy.some((x) => /🔀 Muse → Flow: #2 Muse từ chối tạo video/.test(x)), nhatKy.join('\n'));
  assert.ok(!dp._nghi('tk-1') && !dp.loiLienTiep['tk-1'], 'từ chối là lỗi của ảnh: tài khoản Muse không bị tính lỗi / nghỉ');
});
testAsync('1.2.1 Muse từ chối nhưng không có tài khoản Flow nào dùng được ("Flow 1" mặc định chưa đăng nhập) → không chuyển, xử lý như lỗi thường', async () => {
  const daChay = [];
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongMuseFlow(daChay, { tuChoi: new Set([1]) }), tonTai: (p) => String(p).startsWith('/anh/') });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ loai: 'video', prompts: ['v1'], thamChieu: ['/anh/a.png'] });
  dp.chayTatCa();
  await chayHet(dp);
  const j = dp.viec[0];
  assert.ok(j.trangThai === 'loi' && j.nen === 'muse' && /từ chối/.test(j.loi), `${j.trangThai} ${j.nen} ${j.loi}`);
  assert.ok(!daChay.some((x) => x.so), 'tài khoản Flow chưa đăng nhập không nhận việc');
  assert.ok(!nhatKy.some((x) => /🔀/.test(x)));
});
testAsync('1.2.1 Muse hỏng ở MỌI tài khoản → việc chuyển sang Flow chạy tiếp; Flow cũng hỏng → Lỗi, không đẩy qua lại mãi', async () => {
  const daChay = [];
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongMuseFlow(daChay, { hong: new Set(['tk-1']) }), tonTai: (p) => String(p).startsWith('/anh/') });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, flow: { meToiDa: 5 } });
  const d = dp.taoDuAn('P', ['tk-1', 'flow-1']);        // dự án tự chọn "Flow 1" → được nhận việc chuyển sang
  dp.them({ duAn: d.id, loai: 'anh', prompts: ['a1', 'a2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.nen === 'flow' && j.taiKhoan === 'flow-1'), dp.viec.map((j) => j.trangThai + j.nen + j.taiKhoan).join());
  assert.ok(nhatKy.some((x) => /🔀 Muse → Flow/.test(x)), nhatKy.join('\n'));
  // Cả hai bên hỏng.
  const daChay2 = [];
  const b = dungDieuPhoi({ taoLuong: luongMuseFlow(daChay2, { hong: new Set(['tk-1']), flowHong: new Set(['flow-1']) }), tonTai: (p) => String(p).startsWith('/anh/') });
  b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0, flow: { meToiDa: 5 } });
  const d2 = b.dp.taoDuAn('P', ['tk-1', 'flow-1']);
  b.dp.them({ duAn: d2.id, loai: 'anh', prompts: ['a1'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  const j = b.dp.viec[0];
  assert.ok(j.trangThai === 'loi' && j.nen === 'flow' && j.daQuaNen.includes('muse') && j.daQuaNen.includes('flow'), `${j.trangThai} ${j.nen} ${j.daQuaNen}`);
  assert.strictEqual(daChay2.filter((x) => Array.isArray(x)).length, 1, 'Muse chạy đúng 1 lần');
  assert.strictEqual(daChay2.filter((x) => x.so).length, 1, 'Flow chạy đúng 1 lần — không quay lại Muse');
  assert.strictEqual(b.nhatKy.filter((x) => /🔀/.test(x)).length, 1, b.nhatKy.join('\n'));
});
test('1.2.1 nâng cấp: tắt "Flow hỏng → Muse" ở 1.2.0 thì công tắc chung Muse ⇄ Flow cũng tắt; còn lại bật', () => {
  const tat = dungDieuPhoi({ duLieu: { caiDat: { moc: 3, flow: { sangMuseKhiHong: false } } } }).dp.caiDat;
  assert.deepStrictEqual([tat.doiNenKhiLoi, tat.flow.sangMuseKhiHong, tat.moc], [false, undefined, 6]);
  for (const flow of [{ sangMuseKhiHong: true }, {}]) {
    const c = dungDieuPhoi({ duLieu: { caiDat: { moc: 3, flow } } }).dp.caiDat;
    assert.deepStrictEqual([c.doiNenKhiLoi, c.flow.sangMuseKhiHong], [true, undefined], JSON.stringify(flow));
  }
  const daTat = dungDieuPhoi({ duLieu: { caiDat: { moc: 4, doiNenKhiLoi: false } } }).dp;
  assert.strictEqual(daTat.caiDat.doiNenKhiLoi, false, 'đã ở mốc 4 thì giữ lựa chọn người dùng');
  daTat.datCaiDat({ doiNenKhiLoi: true });
  assert.strictEqual(daTat.caiDat.doiNenKhiLoi, true);
});
// 1.4.6: cài đặt chạy tách theo nơi chạy — thử thêm / chạy lại lỗi / nghỉ gửi riêng Muse, Flow, Suno.
test('1.4.6 nâng cấp: thử thêm / chạy lại lỗi / nghỉ gửi của bản cũ (dùng chung) → chép sang khoá riêng Flow, Suno (cả chung lẫn từng dự án); đã có khoá mới thì giữ', () => {
  const k = (c) => [c.tuThuLai, c.tuChayLaiLoi, c.nghiGiuaLanGui, c.tuThuLaiFlow, c.tuChayLaiLoiFlow, c.tuThuLaiSuno, c.tuChayLaiLoiSuno, c.nghiSuno];
  const cu = { tuThuLai: 4, tuChayLaiLoi: 3, nghiGiuaLanGui: 7, moc: 6 };
  const { dp } = dungDieuPhoi({ duLieu: { caiDat: { ...cu }, duAn: [
    { id: 'mac-dinh', ten: 'Mặc định' },
    { id: 'p2', ten: 'P2', caiDat: { ...cu, moc: undefined, tuThuLai: 5, tuChayLaiLoi: 1, nghiGiuaLanGui: 9 } }] } });
  assert.deepStrictEqual(k(dp.caiDat), [4, 3, 7, 4, 3, 4, 3, 7], 'cài đặt chung');
  assert.deepStrictEqual(k(dp.cd('mac-dinh')), [4, 3, 7, 4, 3, 4, 3, 7], 'dự án chưa có cài đặt riêng theo cài đặt chung');
  assert.deepStrictEqual(k(dp.cd('p2')), [5, 1, 9, 5, 1, 5, 1, 9], 'cài đặt riêng của dự án chép từ số của chính dự án đó');
  // Bản đã có khoá mới (đã lưu ở 1.4.6) → giữ nguyên, kể cả 0.
  const moi = { tuThuLaiFlow: 0, tuChayLaiLoiFlow: 1, tuThuLaiSuno: 6, tuChayLaiLoiSuno: 0, nghiSuno: 20 };
  const b = dungDieuPhoi({ duLieu: { caiDat: { ...cu, ...moi }, duAn: [{ id: 'mac-dinh', ten: 'Mặc định', caiDat: { ...cu, ...moi, tuThuLaiFlow: 2, nghiSuno: 0 } }] } }).dp;
  assert.deepStrictEqual(k(b.caiDat), [4, 3, 7, 0, 1, 6, 0, 20]);
  assert.deepStrictEqual(k(b.cd('mac-dinh')), [4, 3, 7, 2, 1, 6, 0, 0], 'nghỉ Suno 0 = không nghỉ (không bị đẩy về 3)');
  // Lưu từ trang Cài đặt (chuỗi số) → đúng khoá, đúng khoảng; nghỉ 0 giữ 0.
  b.datCaiDat({ tuThuLaiFlow: '5', tuChayLaiLoiFlow: '99', tuThuLaiSuno: '-1', tuChayLaiLoiSuno: '2', nghiSuno: '9', nghiGiuaLanGui: '0' }, 'mac-dinh');
  assert.deepStrictEqual(k(b.cd('mac-dinh')), [4, 3, 0, 5, 10, 0, 2, 9]);
});
/** Luồng giả ba nơi: Muse "tk-1" lỗi, Flow "flow-1" lỗi, Suno lỗi; đếm số lần chạy từng việc. */
const luongBaNenHong = (daChay) => (a, stt) => (a.nen === 'suno' ? {
  id: `${a.id}-${stt}`, nen: 'suno', ranh: true, viec: null, dung() {},
  async chay(j) {
    this.ranh = false; this.viec = j; daChay.push(['suno', j.so]);
    await new Promise((r) => setTimeout(r, 10)); this.ranh = true; this.viec = null;
    return { ok: false, loi: 'Suno: tạo hỏng' };
  }
} : luongMuseFlow(daChay, { hong: new Set(['tk-1']), flowHong: new Set(['flow-1']) })(a, stt));
const demLan = (daChay) => ({
  muse: daChay.filter((x) => Array.isArray(x) && x[0] === 'tk-1').length,
  flow: daChay.filter((x) => x && x.tk === 'flow-1').reduce((n, x) => n + x.so.length, 0),
  suno: daChay.filter((x) => Array.isArray(x) && x[0] === 'suno').length
});
testAsync('1.4.6 thử thêm (vòng) riêng từng nơi: Muse 0 vòng, Flow 2 vòng, Suno 1 vòng → Muse chạy 1 lần, Flow 3 lần, Suno 2 lần', async () => {
  const daChay = [];
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongBaNenHong(daChay) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, nghiSuno: 0, doiNenKhiLoi: false, tuThuLai: 0, tuChayLaiLoi: 0,
    tuThuLaiFlow: 2, tuChayLaiLoiFlow: 0, tuThuLaiSuno: 1, tuChayLaiLoiSuno: 0, flow: { meToiDa: 5 } });
  dp.them({ nen: 'muse', loai: 'anh', prompts: ['m1'] });
  dp.them({ nen: 'flow', loai: 'anh', tyLe: '16:9', prompts: ['f1'] });
  dp.them({ loai: 'nhac', prompts: ['lofi'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(demLan(daChay), { muse: 1, flow: 3, suno: 2 }, JSON.stringify(daChay));
  assert.ok(dp.viec.every((j) => j.trangThai === 'loi'), dp.viec.map((j) => j.nen + j.trangThai).join());
  assert.deepStrictEqual(dp.viec.map((j) => j.nen), ['muse', 'flow', 'suno'], 'tắt Muse ⇄ Flow thì không chuyển bên');
  assert.ok(nhatKy.some((x) => /thử lại ở "Flow 1" \(2\/2\)/.test(x)), nhatKy.join('\n'));
});
testAsync('1.4.6 hết lượt → tự chạy lại việc lỗi theo số RIÊNG từng nơi: Flow 2 lượt, Muse 0, Suno 1', async () => {
  const daChay = [];
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongBaNenHong(daChay) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, nghiSuno: 0, doiNenKhiLoi: false, tuThuLai: 0, tuChayLaiLoi: 0,
    tuThuLaiFlow: 0, tuChayLaiLoiFlow: 2, tuThuLaiSuno: 0, tuChayLaiLoiSuno: 1, flow: { meToiDa: 5 } });
  dp.them({ nen: 'muse', loai: 'anh', prompts: ['m1'] });
  dp.them({ nen: 'flow', loai: 'anh', tyLe: '16:9', prompts: ['f1'] });
  dp.them({ loai: 'nhac', prompts: ['lofi'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(demLan(daChay), { muse: 1, flow: 3, suno: 2 }, JSON.stringify(daChay));
  assert.deepStrictEqual(dp.viec.map((j) => [j.nen, j.trangThai, j.vongLai || 0]), [['muse', 'loi', 0], ['flow', 'loi', 2], ['suno', 'loi', 1]]);
  assert.ok(nhatKy.some((x) => /↻ Hết lượt — tự chạy lại 2 việc lỗi/.test(x)), 'lượt 1: Flow + Suno chạy lại, Muse không');
  // Đảo lại: Muse 1 lượt, Flow 0 → Muse chạy 2 lần, Flow 1 lần.
  const daChay2 = [];
  const b = dungDieuPhoi({ taoLuong: luongBaNenHong(daChay2) });
  b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, doiNenKhiLoi: false, tuThuLai: 0, tuChayLaiLoi: 1, tuThuLaiFlow: 0, tuChayLaiLoiFlow: 0, flow: { meToiDa: 5 } });
  b.dp.them({ nen: 'muse', loai: 'anh', prompts: ['m1'] });
  b.dp.them({ nen: 'flow', loai: 'anh', tyLe: '16:9', prompts: ['f1'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  assert.deepStrictEqual(demLan(daChay2), { muse: 2, flow: 1, suno: 0 }, JSON.stringify(daChay2));
});
test('1.4.6 trang Cài đặt: thẻ riêng Chung (Muse + Flow) / Muse / Google Flow / Suno / Cả app có nhãn nơi chạy; ô mới được nối đọc + lưu', () => {
  const html = docNguon('src/ui/index.html', true), ui = docNguon('src/ui/app.js'), css = docNguon('src/ui/style.css');
  const cd = html.slice(html.indexOf('id="trang-caidat"'), html.indexOf('</main>', html.indexOf('id="trang-caidat"')));
  /** Đoạn HTML của thẻ có id (tới thẻ kế tiếp). */
  const the = (id) => { const i = cd.indexOf(`id="${id}"`); assert.ok(i >= 0, `thiếu thẻ #${id}`); const j = cd.indexOf('<div class="the-cai', i); return cd.slice(i, j < 0 ? undefined : j); };
  const coO = (id, ...o) => { const t = the(id); for (const x of o) assert.ok(t.includes(`id="${x}"`), `#${x} phải ở thẻ #${id}`); return t; };
  assert.ok(/<h3>[^\n]*Chung \(Muse \+ Flow\)<span class="ap ap-muse">Muse<\/span><span class="ap ap-flow">Google Flow<\/span><\/h3>/.test(the('cdChungThe')));
  coO('cdChungThe', 'cdDoiNen', 'cdVideoCanhAnh');
  assert.ok(/Muse — khi chạy<span class="ap ap-muse">/.test(coO('cdMuseThe', 'cdLuong', 'cdNghi', 'cdThuLai', 'cdChayLaiLoi', 'cdChoAnh', 'cdChoVideo', 'cdChoChu', 'cdPng', 'cdXoaChat', 'cdMauAnh', 'cdMauVideo', 'cdMauGoc')));
  assert.ok(/Google Flow — khi chạy<span class="ap ap-flow">/.test(coO('cdFlow', 'fTab', 'fThuLai', 'cdThuLaiFlow', 'cdChayLaiLoiFlow', 'cdXoaDuAnFlow', 'fNguong')));
  assert.ok(/Suno — khi chạy<span class="ap ap-suno">/.test(coO('cdSunoThe', 'cdChoNhac', 'cdNghiSuno', 'cdThuLaiSuno', 'cdChayLaiLoiSuno')));
  assert.ok(/Cả app<span class="ap ap-app">/.test(coO('cdAppThe', 'cdXemLuong', 'cdTatMay', 'cdNheMay')));
  for (const id of ['cdChungThe', 'cdMuseThe', 'cdFlow', 'cdSunoThe', 'cdAppThe']) assert.ok(/<small class="mo">(Chỉ áp|Áp|Chung cho)/.test(the(id)), `thẻ #${id} có dòng nói thẻ áp cho đâu`);
  assert.ok(!/Muse \/ Suno/.test(cd) && !/ap-tat-ca/.test(cd), 'không còn ô dùng chung Muse / Suno');
  assert.ok(cd.indexOf('id="cdAppThe"') < cd.indexOf('class="thanh-luu-cd"'), 'thanh Lưu vẫn ở cuối');
  for (const n of ['muse', 'flow', 'suno']) assert.ok(new RegExp(`\\n\\.ap-${n} \\{`).test(css), `.ap-${n}`);
  for (const [o, k] of [['cdThuLaiFlow', 'tuThuLaiFlow'], ['cdChayLaiLoiFlow', 'tuChayLaiLoiFlow'], ['cdThuLaiSuno', 'tuThuLaiSuno'], ['cdChayLaiLoiSuno', 'tuChayLaiLoiSuno'], ['cdNghiSuno', 'nghiSuno']]) {
    assert.ok(ui.includes(`$('#${o}').value = c.${k};`), `vẽ #${o}`);
    assert.ok(ui.includes(`${k}: $('#${o}').value`), `lưu #${o}`);
  }
  assert.ok(!/Cài đặt → Chạy/.test(html), 'hướng dẫn không còn trỏ tới thẻ "Chạy" cũ');
});
test('nhật ký 16/10/2026: Muse báo chặn 403 / chặn khu vực → nhận ra là lỗi TÀI KHOẢN', () => {
  assert.ok(HD.laChanKhuVuc('Block vẫn còn (lỗi 403, tạo video không khả dụng tại khu vực này). Ảnh + prompt đã lưu vào hàng chờ, sẽ chạy lại khi block được gỡ.'));
  assert.ok(HD.laChanKhuVuc('Đã lưu request vào hàng đợi (44 video chờ). Video vẫn bị chặn khu vực (lỗi 403), sẽ tạo ngay khi giới hạn được gỡ.'));
  assert.ok(HD.laChanKhuVuc('Video generation is not available in your region yet.'));
  for (const c of ['Bạn muốn ảnh theo phong cách nào?', 'Mình không thể tạo ảnh này vì vi phạm chính sách nội dung.', 'Khu vực biển xanh, bãi cát trắng như bạn mô tả', 'Ảnh 403 x 600 pixel', '']) {
    assert.ok(!HD.laChanKhuVuc(c), c);
  }
});
testAsync('Muse chặn video (403) ở một tài khoản → tài khoản đó thôi nhận VIDEO ngay, video sang tài khoản khác, ảnh vẫn chạy ở nó', async () => {
  const daChay = [];
  const taoLuong = (a, stt) => ({ id: `${a.id}-${stt}`, ranh: true, viec: null, dung() {},
    async chay(j) {
      this.ranh = false; this.viec = j; daChay.push([a.id, j.loai, j.so]);
      await new Promise((r) => setTimeout(r, 10)); this.ranh = true; this.viec = null;
      if (a.id === 'tk-1' && j.loai === 'video') return { ok: false, chanLoai: true, loi: 'Muse báo tài khoản bị chặn tạo video: "lỗi 403"' };
      return { ok: true, files: [{ mime: j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] };
    } });
  const { dp, tk, nhatKy } = dungDieuPhoi({ taoLuong });
  tk.them('Hai');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ loai: 'video', prompts: ['v1', 'v2', 'v3'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.taiKhoan === 'hai' && !j.thu), dp.viec.map((j) => j.trangThai + j.taiKhoan + j.thu).join());
  assert.strictEqual(daChay.filter((x) => x[0] === 'tk-1' && x[1] === 'video').length, 1, 'chỉ phí đúng MỘT lần ở tài khoản bị chặn');
  assert.ok(nhatKy.some((x) => /thôi nhận VIDEO 24 giờ \(vẫn tạo ảnh\)/.test(x)), nhatKy.filter((x) => /403/.test(x)).join(' | '));
  assert.ok(!dp._nghi('tk-1'), 'không nghỉ cả tài khoản');
  dp.them({ loai: 'anh', prompts: ['a1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.strictEqual(dp.viec.find((j) => j.loai === 'anh').taiKhoan, 'tk-1', 'ảnh vẫn chạy ở tài khoản chính');
  // 1.2.9: mốc chặn video lưu TRÊN TÀI KHOẢN (~24 giờ) — bấm Chạy lần sau (xoá nghiLoai) vẫn không gửi video vào tk-1.
  const a1 = tk.tim('tk-1');
  assert.ok(a1.chanVideoDen > Date.now() + 23 * 3600e3 && a1.chanVideoDen <= Date.now() + 24 * 3600e3, String(a1.chanVideoDen - Date.now()));
  assert.ok(/403/.test(a1.lyDoChanVideo));
  dp.them({ loai: 'video', prompts: ['v4'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.strictEqual(daChay.filter((x) => x[0] === 'tk-1' && x[1] === 'video').length, 1, 'lần chạy sau không phí thêm lượt video ở tài khoản bị chặn');
  assert.strictEqual(dp.viec.find((j) => j.prompt === 'v4').taiKhoan, 'hai');
  tk.sua('tk-1', { chanVideoDen: 0 });                       // bấm Kiểm tra (main.js) = bỏ mốc
  assert.ok(!dp._nghiLoai('tk-1', 'video') && !tk.tim('tk-1').lyDoChanVideo);
});
test('1.2.9: Kiểm tra do NGƯỜI DÙNG bấm mới bỏ mốc "Muse chặn video"; lần kiểm tự động lúc mở app thì giữ', () => {
  const m = docNguon('main.js');
  assert.ok(/kiemTaiKhoan: \(\{ id \}\) => kiemTaiKhoan\(id, true\)/.test(m), 'nút Kiểm tra phải truyền nguoiBam');
  assert.ok(/if \(nguoiBam && \(tk\.chanVideoDen \|\| 0\) > Date\.now\(\)\) \{\s*taiKhoan\.sua\(id, \{ chanVideoDen: 0 \}\)/.test(m));
  assert.ok(/await kiemTaiKhoan\(a\.id\); \}/.test(m), 'cập nhật token tự động không được bỏ mốc');
  const a = docNguon('src/ui/app.js');
  assert.ok(/veHanMuc\(a\.hanMuc\) \+ veChanVideo\(a\)/.test(a), 'thẻ tài khoản Muse chưa hiện mốc chặn video');
});
test('1.2.9: thư mục video "Ảnh xong → tự tạo video" RIÊNG từng dự án — ưu tiên hơn cài đặt chung, dự án khác không bị ảnh hưởng', () => {
  const { dp } = dungDieuPhoi();
  const d1 = dp.duAn[0], d2 = dp.taoDuAn('Hai', []);
  dp.datCaiDat({ thuMucAnh: '/anh', thuMucVideo: '/video', videoCanhAnh: true });
  assert.ok(dp.datThuMucVideoDuAn(d1.id, '  /video-du-an-1 ').ok);
  assert.strictEqual(d1.thuMucVideoAnh, '/video-du-an-1');
  const xong = (d, ten) => {
    dp.them({ duAn: d.id, loai: 'anh', prompts: [ten], chuoiVideo: { prompt: 'đi bộ' } });
    const a = dp.viec[dp.viec.length - 1];
    Object.assign(a, { trangThai: 'chay', taiKhoan: 'tk-1' });
    dp._ketThuc(a, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
    const v = dp.viec.find((j) => j.tuAnh === a.id);
    Object.assign(v, { trangThai: 'chay', taiKhoan: 'tk-1' });
    dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
    return [a.files[0], v.files[0]];
  };
  const [anh1, video1] = xong(d1, 'p1');
  assert.strictEqual(path.dirname(video1), path.normalize('/video-du-an-1'), video1);
  assert.strictEqual(path.basename(video1, '.mp4'), path.basename(anh1, path.extname(anh1)), 'video cùng tên ảnh');
  const [anh2, video2] = xong(d2, 'p2');
  assert.strictEqual(path.dirname(video2), path.dirname(anh2), 'dự án chưa chọn thư mục → theo cài đặt chung (cạnh ảnh)');
  assert.ok(dp.datThuMucVideoDuAn(d1.id, '').ok && !('thuMucVideoAnh' in d1), 'Bỏ → về cài đặt chung');
  const m = docNguon('main.js'), h = docNguon('src/ui/index.html'), a = docNguon('src/ui/app.js');
  assert.ok(/chonThuMucVideoDuAn: async \(\{ id \}\)/.test(m) && /boThuMucVideoDuAn: \(\{ id \}\)/.test(m));
  const khu = h.slice(h.indexOf('id="khuChuoi"'), h.indexOf('id="nangCao"'));
  assert.ok(/id="nutThuMucVideoDuAn"/.test(khu) && /id="ghiThuMucVideoDuAn"/.test(khu), 'nút chọn thư mục phải nằm trong mục "Ảnh xong → tự tạo video" của trang Tạo ảnh');
  assert.ok(/api\.call\('chonThuMucVideoDuAn', \{ id: d\.id \}\)/.test(a) && /api\.call\('boThuMucVideoDuAn', \{ id: d\.id \}\)/.test(a));
});
test('1.2.0 mục Tài khoản: thẻ riêng Muse / Google Flow / Suno, mỗi thẻ chỉ hiện tài khoản và nút Thêm của nơi đó', () => {
  const h = docNguon('src/ui/index.html'), a = docNguon('src/ui/app.js');
  for (const n of ['muse', 'flow', 'suno']) assert.ok(new RegExp(`id="nenTk"[\\s\\S]*data-v="${n}"`).test(h), `thiếu thẻ ${n}`);
  assert.ok(/class="nut-gradient nho chi-flow" id="nutThemTKFlow"/.test(h) && /class="nut-gradient nho chi-suno" id="nutThemTKSuno"/.test(h));
  assert.ok(/S\.taiKhoan\.filter\(\(a\) => nenTk\(a\) === U\.nenTk\)/.test(a), 'danh sách chưa lọc theo thẻ đang chọn');
  assert.ok(/nenTk: U\.nenTk/.test(a), 'thẻ đang chọn chưa được nhớ');
});
testAsync('Flow: lỗi mất kết nối / tạm nghỉ an toàn (daNghi) → việc về hàng chờ, không tính lần thử, không nghỉ chồng', async () => {
  const { dp } = dungDieuPhoi();
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['1'] });
  const j = dp.viec[0];
  Object.assign(j, { trangThai: 'chay', taiKhoan: 'flow-1' });
  dp._ketThuc(j, { ok: false, matKetNoi: true, daNghi: true, loi: 'Flow nhắc hoạt động bất thường' }, dp.o.taiKhoan.tim('flow-1'));
  assert.ok(j.trangThai === 'cho' && !j.thu);
  assert.ok(!dp._nghi('flow-1'), 'máy Flow đã cho nghỉ rồi thì điều phối không đặt thêm lần nữa');
  Object.assign(j, { trangThai: 'chay', taiKhoan: 'flow-1' });
  dp._ketThuc(j, { ok: false, matKetNoi: true, loi: 'Không vào được trang dự án Flow' }, dp.o.taiKhoan.tim('flow-1'));
  assert.ok(j.trangThai === 'cho' && dp._nghi('flow-1'), 'mất kết nối thường → tài khoản tạm nghỉ');
});
test('tài khoản: mặc định có Muse 1 + Flow 1 + Suno 1, phiên tách theo nền tảng; dự án chọn tài khoản theo từng nền tảng', () => {
  const { dp, tk } = dungDieuPhoi();
  assert.deepStrictEqual(tk.ds.map((a) => [a.id, a.nen, a.partition]), [['tk-1', 'muse', 'persist:muse-tk-1'], ['flow-1', 'flow', 'persist:flow-flow-1'], ['suno-1', 'suno', 'persist:suno-suno-1']]);
  const f2 = tk.them('Flow 2', 'flow');
  assert.strictEqual(f2.partition, `persist:flow-${f2.id}`);
  const d = dp.taoDuAn('P', [f2.id, 'tk-1']);
  assert.deepStrictEqual(dp._dsTk(d.id, 'flow'), [f2.id], 'chỉ chọn Flow 2 thì Flow 1 không chạy dự án này');
  assert.deepStrictEqual(dp._dsTk(d.id, 'muse'), ['tk-1']);
  const d2 = dp.taoDuAn('Q', ['tk-1']);
  assert.deepStrictEqual(dp._dsTk(d2.id, 'flow'), ['flow-1', f2.id], 'chưa chọn tài khoản Flow nào = mọi tài khoản Flow');
  assert.strictEqual(tk.sua(f2.id, { flowUrl: 'https://evil.example/x' }) && tk.tim(f2.id).flowUrl, '', 'chỉ nhận URL dự án Flow');
  // Google dời Flow sang flow.google.com (15/10/2026): địa chỉ dự án mới phải được nhận và LƯU.
  tk.sua(f2.id, { flowUrl: 'https://flow.google.com/project/47741c48-4019-4392-9dab-d179db623498' });
  assert.strictEqual(tk.tim(f2.id).flowUrl, 'https://flow.google.com/project/47741c48-4019-4392-9dab-d179db623498');
  tk.sua(f2.id, { flowUrl: 'https://flow.google.com/' });
  assert.strictEqual(tk.tim(f2.id).flowUrl, 'https://flow.google.com/project/47741c48-4019-4392-9dab-d179db623498', 'trang chủ Flow không phải dự án');
  tk.sua(f2.id, { flowUrl: 'https://labs.google/fx/vi/tools/flow/project/abc' });
  assert.strictEqual(tk.tim(f2.id).flowUrl, 'https://labs.google/fx/vi/tools/flow/project/abc');
});
test('model Flow: hộp chọn thật (<select>), gợi ý video khớp model.js, tên đã lưu lạ vẫn hiện', () => {
  const html = docNguon('src/ui/index.html', true), ui = docNguon('src/ui/app.js', true);
  for (const id of ['fModelAnh', 'fModelChinh', 'fModelPhu']) assert.ok(new RegExp(`<select id="${id}"`).test(html), id);
  const ds = JSON.parse(ui.match(/const DS_MODEL_VIDEO = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepStrictEqual(ds, require('../src/flow/main/model').MODEL_GOI_Y);
  assert.ok(/không có trong danh sách gợi ý/.test(ui));
});
test('main.js: tab Flow có preload cầu nối, phiên Flow giữ nguyên user agent; mọi lệnh engine qua máy Flow', () => {
  const m = docNguon('main.js');
  assert.ok(/preload-flow\.js/.test(m) && /ipcMain\.handle\('flow:message'[\s\S]{0,200}mayFlow\.handleEngineMessage/.test(m));
  assert.ok(/ipcMain\.handle\('flow:storage'/.test(m) && /tab\.caiDatEngine/.test(m), 'mỗi tab đọc lại đúng cài đặt mẻ của nó sau khi engine tự F5');
  assert.ok(/taiVeFlow\.attach\(/.test(m), 'tải về của phiên Flow phải đi qua DownloadManager');
});

console.log('\n── Suno (tạo nhạc) ────────────────────────────');
const { chonBaiDaiHon } = require('../src/main/luong-suno');
/** Luồng giả Suno: tài khoản trong `hetLuot` báo hết lượt, còn lại trả file mp3 đã tải về thư mục tạm. */
const luongGiaSuno = (daChay, hetLuot = new Set(), dangChay = { n: 0, max: 0 }) => (a, stt) => (a.nen === 'suno' ? {
  id: `${a.id}-${stt}`, nen: 'suno', ranh: true, viec: null, dung() {},
  async chay(j) {
    this.ranh = false; this.viec = j; daChay.push(['suno', a.id, j.so]);
    dangChay.n++; dangChay.max = Math.max(dangChay.max, dangChay.n);
    await new Promise((r) => setTimeout(r, 15));
    dangChay.n--; this.ranh = true; this.viec = null;
    return hetLuot.has(a.id) ? { ok: false, hetLuot: true, loi: 'Suno hết lượt tải về: "Download limit reached"' }
      : { ok: true, files: [{ duongDan: `/tam/suno-${j.so}.mp3` }], ghiChu: 'bài dài hơn: 2:41 (bài kia 2:05)' };
  }
} : luongGiaHaiNen(daChay)(a, stt));
test('Suno: trong 2 bài mới đầu tiên lấy bài DÀI HƠN (bằng nhau → bài trên; bài 3–4 bản nghe thử không xét)', () => {
  const c = (id, giay) => ({ id, giay });
  assert.strictEqual(chonBaiDaiHon([c('a', 125), c('b', 161), c('c', 240), c('d', 240)]).id, 'b');
  assert.strictEqual(chonBaiDaiHon([c('a', 170), c('b', 161)]).id, 'a');
  assert.strictEqual(chonBaiDaiHon([c('a', 150), c('b', 150)]).id, 'a');
  assert.strictEqual(chonBaiDaiHon([c('a', 90)]).id, 'a');
  assert.strictEqual(chonBaiDaiHon([]), null);
});
testAsync('Suno: việc nhạc chỉ chạy ở tài khoản Suno (1 luồng), song song với ảnh Muse; tên {stt}.mp3 trong thư mục nhạc', async () => {
  const daChay = [], chuyen = [], dem = { n: 0, max: 0 };
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongGiaSuno(daChay, new Set(), dem), chuyenFile: (a, b) => chuyen.push([a, b]) });
  dp.datCaiDat({ nghiGiuaLanGui: 0, luongMoiTK: 3, thuMucNhac: '/nhac', tenNhac: '{stt}' });
  dp.them({ loai: 'nhac', nen: 'muse', prompts: ['lofi chill piano', 'epic orchestral', 'acoustic guitar'] });
  dp.them({ nen: 'muse', loai: 'anh', prompts: ['m1', 'm2'] });
  const nhac = dp.viec.filter((j) => j.loai === 'nhac');
  assert.ok(nhac.length === 3 && nhac.every((j) => j.nen === 'suno'), 'loai nhac luôn chạy ở Suno, kể cả khi gửi nhầm nen');
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'), dp.viec.map((j) => j.trangThai + j.loi).join());
  assert.deepStrictEqual(daChay.filter((x) => x[0] === 'suno').map((x) => x[1]), ['suno-1', 'suno-1', 'suno-1']);
  assert.ok(daChay.some((x) => x[0] === 'tk-1'), 'ảnh Muse vẫn chạy cùng lúc ở tài khoản Muse');
  assert.strictEqual(dem.max, 1, 'mỗi tài khoản Suno chỉ một luồng');
  assert.deepStrictEqual(nhac.map((j) => j.files[0].replace(/\\/g, '/')), ['/nhac/001.mp3', '/nhac/002.mp3', '/nhac/003.mp3']);
  assert.ok(chuyen.some(([a, b]) => a === '/tam/suno-1.mp3' && b === nhac[0].files[0]), 'file Suno tải về được chuyển ra thư mục nhạc');
  assert.ok(nhatKy.some((x) => /Việc #1 xong nhạc \(bài dài hơn: 2:41 \(bài kia 2:05\)\)/.test(x)), nhatKy.join('\n'));
  assert.ok(nhac.every((j) => !j.tam), 'nhạc luôn tải về (không có công tắc tắt)');
});
testAsync('Suno hết lượt → việc TẠO LẠI ở tài khoản Suno dự phòng, tài khoản hết lượt nghỉ 6 giờ (nhớ qua lần mở app); hết cả thì tạm dừng', async () => {
  const daChay = [];
  const { dp, tk, store, nhatKy } = dungDieuPhoi({ taoLuong: luongGiaSuno(daChay, new Set(['suno-1'])) });
  const s2 = tk.them('Suno 2', 'suno');
  dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ loai: 'nhac', prompts: ['a', 'b'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong' && j.taiKhoan === s2.id), dp.viec.map((j) => j.trangThai + j.taiKhoan + j.loi).join());
  assert.deepStrictEqual(daChay.filter((x) => x[1] === 'suno-1').map((x) => x[2]), [1], 'hết lượt một lần là nghỉ, việc sau chạy thẳng dự phòng');
  assert.ok(dp.viec.every((j) => !j.tkLoi || !j.tkLoi.length) && dp.viec[0].thu === 0, 'hết lượt không tính là lần thử lỗi');
  assert.ok(nhatKy.some((x) => /↪ #1 Suno hết lượt tải về.*\(ở "Suno 1"\) — tạo lại ở "Suno 2"/.test(x)), nhatKy.join('\n'));
  const a1 = tk.tim('suno-1');
  assert.ok(a1.hetLuotDen > Date.now() + 5.9 * 3600e3 && /Download limit/.test(a1.lyDoHetLuot));
  const { QuanLyTaiKhoan: Q } = require('../src/main/tai-khoan');
  assert.ok(new Q(store, () => {}).tim('suno-1').hetLuotDen === a1.hetLuotDen, 'mốc hết lượt lưu trên tài khoản');
  assert.ok(dp._nghi('suno-1') && !dp._nghi(s2.id));
  // Cả hai tài khoản Suno hết lượt → việc nhạc về Chờ, hàng chờ tạm dừng (không lặp vô ích).
  const daChay2 = [];
  const b = dungDieuPhoi({ taoLuong: luongGiaSuno(daChay2, new Set(['suno-1', 'suno-2'])) });
  b.tk.them('Suno 2', 'suno');
  b.dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  b.dp.them({ loai: 'nhac', prompts: ['x'] });
  b.dp.chayTatCa();
  await chayHet(b.dp);
  assert.strictEqual(b.dp.dangChay, false);
  assert.strictEqual(b.dp.viec[0].trangThai, 'cho');
  assert.strictEqual(daChay2.length, 2, 'mỗi tài khoản thử đúng một lần');
  assert.ok(b.nhatKy.some((x) => /không còn tài khoản dự phòng nào còn lượt/.test(x)));
});
test('Suno: cài đặt nhạc (thư mục, mẫu tên mặc định {stt}, chờ tối đa kẹp 120–3600 s); tên file .mp3', () => {
  const { dp } = dungDieuPhoi();
  assert.strictEqual(dp.caiDat.tenNhac, '{stt}');
  dp.datCaiDat({ choNhacGiay: 5, tenNhac: '' });
  assert.strictEqual(dp.caiDat.choNhacGiay, 120);
  assert.strictEqual(dp.caiDat.tenNhac, '{stt}', 'mẫu trống → về {stt}');
  dp.datCaiDat({ choNhacGiay: 99999 });
  assert.strictEqual(dp.caiDat.choNhacGiay, 3600);
  assert.strictEqual(dp.thuMucRa('nhac'), '/ra', 'chưa chọn thư mục nhạc → thư mục mặc định');
  dp.datCaiDat({ thuMucNhac: '/nhac' });
  assert.strictEqual(dp.thuMucRa('nhac'), '/nhac');
  assert.strictEqual(HD.tenFile({ ten: 'P' }, { so: 7, stt: 7, loai: 'nhac', prompt: 'x', taoLuc: 0 }, 'audio/mpeg', 0, '{stt}'), '007.mp3');
  assert.strictEqual(HD.mimeTuDuoi('/a/b.mp3'), 'audio/mpeg');
});
test('Suno: trình trợ giúp — Styles + Lyrics trống, chỉ xét 2 bài mới, tải bằng menu Download của Suno (không lấy thẳng CDN), captcha để người dùng tự giải', () => {
  const t = docNguon('src/inject/suno-trang.js'), l = docNguon('src/main/luong-suno.js'), m = docNguon('main.js');
  assert.ok(/;\s*undefined;\s*$/.test(docNguon('src/inject/suno-trang.js', true).trim() + '\n'.trim()), 'kết thúc bằng undefined;');
  assert.ok(/create-form-styles-wrapper/.test(t) && /Lyrics editor/.test(t) && /Create song/.test(t));
  assert.ok(/moi\.slice\(0, 2\)/.test(l), 'chỉ chờ / xét 2 bài mới đầu tiên');
  assert.ok(/window\.__suno\.taiMp3\(/.test(l) && !/fetch\(/.test(t), 'tải qua menu của Suno, trình trợ giúp không tự fetch file');
  assert.ok(/hienCuaSo\(\)/.test(l) && !/recaptcha.*click|hcaptcha.*click/i.test(t), 'captcha: hiện cửa sổ, không bấm hộ');
  assert.ok(/will-download/.test(m) && /choTaiSuno/.test(m), 'main.js bắt file tải về của phiên Suno');
  assert.ok(/hetLuotDen: 0/.test(m), 'Kiểm tra tài khoản Suno xoá mốc hết lượt');
});
test('Suno: câu báo hết lượt — nhận hộp Out of Downloads / toast hết lượt, KHÔNG nhận chữ thường của hộp Download thật', () => {
  const vm = require('vm');
  const ctx = { window: {} };
  vm.runInNewContext(docNguon('src/inject/suno-trang.js', true), ctx);
  const s = ctx.window.__suno;
  // Chữ thật trong hộp Download (ảnh người dùng gửi 15/10/2026) khi tải được.
  const thuong = "Download 'Morning Light Breaks Throu…' · M4A · MP3 · WAV · MP4 video asset · Stems & MIDI · Manage · Download · You've unlocked this song. You can return and download at any time. Learn more.";
  assert.strictEqual(s.cauHetLuot(thuong), '');
  assert.strictEqual(s.cauHetLuot("Download 'X' · MP3 · Download · You've reached your download limit for this month. Upgrade to Pro for more downloads."),
    "You've reached your download limit for this month. Upgrade to Pro for more downloads.");
  assert.ok(s.cauHetLuot('Not enough credits. Upgrade to Pro to get more credits.'));
  assert.ok(s.cauHetLuot("Out of Downloads · You don't have any downloads left. Subscribe for a monthly allowance, or buy downloads for the songs you want."));
  const t = docNguon('src/inject/suno-trang.js');
  assert.ok(/function hopTai\(\)/.test(t) && /dungChu\(e, \/\^mp3\$\/i\)/.test(t) && /NHAN\.nutTai/.test(t), 'tải: hộp chọn định dạng → ô MP3 → nút Download');
});
// ── 1.2.4: nhật ký 16/10/2026 — hộp Download có nút "Unlock & Download"; tải hỏng thì app GỬI LẠI prompt ──
function sunoGia({ cu = [], taiHong = 0, dsTre = 0, hetGio = null } = {}) {
  // Trang Suno giả ở mức lệnh window.__suno.*: danh sách bài, Create đẻ 4 bài (đang tạo → xong sau vài lần hỏi).
  const tp = { ds: cu.map((id) => ({ id, trangThai: 'complete', giay: 180 })), tao: 0, taiMp3: [], dsGoi: 0, taiHong };
  const goi = async (bt) => {
    if (/trangThai\(\)/.test(bt)) return { coForm: true };
    if (/captcha\(\)/.test(bt)) return false;
    if (/dsClip\(\)/.test(bt)) {
      tp.dsGoi++;
      if (tp.dsGoi <= dsTre) return [];                       // danh sách nạp muộn
      for (const c of tp.ds) if (c.trangThai !== 'complete' && ++c.hoi > 2) Object.assign(c, { trangThai: 'complete' });
      return tp.ds.map((c) => ({ ...c }));
    }
    if (/chuanBi\(/.test(bt)) return { ok: true };
    if (/hetGioTao\(\)/.test(bt)) return hetGio;
    if (/bamTao\(\)/.test(bt)) {
      tp.tao++;
      tp.ds = [130, 170, 240, 60].map((giay, i) => ({ id: `moi${tp.tao}-${i + 1}`, trangThai: 'streaming', giay, hoi: 0 })).concat(tp.ds);
      return { ok: true };
    }
    if (/taiMp3\(/.test(bt)) {
      const id = JSON.parse(bt.match(/taiMp3\((.*)\)$/)[1]);
      tp.taiMp3.push(id);
      if (tp.taiHong > 0) { tp.taiHong--; return { ok: false, loi: 'hop-khong-co-nut-download', chu: 'Download · Unlock & Download' }; }
      tp.choTai && tp.choTai({ ok: true, duongDan: `/tam/${id}.mp3`, mime: 'audio/mpeg' });
      return { ok: true, moKhoa: true, cach: 'mo-khoa' };
    }
    if (/thongBao\(\)|hetLuotTai\(\)|cauHetLuot\(/.test(bt)) return '';
    return { ok: false };
  };
  return { tp, goi };
}
function luongSunoGia(tp, goi, nhatKy) {
  const { LuongSuno } = require('../src/main/luong-suno');
  const l = new LuongSuno({ id: 'S1', taiKhoan: { id: 'suno-1' }, wc: {}, nguon: '', url: 'x', log: (m, c) => nhatKy.push(`[${m}] ${c}`),
    choTaiVe: () => { let res; const hua = new Promise((r) => { res = r; }); tp.choTai = res; return { hua, huy: () => {}, daBatDau: () => false }; } });
  l.goi = goi; l.moTrang = async () => {}; l.ngu = async () => true;
  return l;
}
const ctxSuno = (j) => ({ choToiDaGiay: 600, choGui: async () => {}, capNhat: (t) => Object.assign(j, t) });

testAsync('1.2.4 Suno tải hỏng → nạp lại trang, tải lại ĐÚNG bài đã tạo, không bấm Create lần nữa', async () => {
  const nhatKy = [];
  const { tp, goi } = sunoGia({ cu: ['cu-1', 'cu-2'], taiHong: 1 });
  const j = { so: 348, prompt: 'lofi' };
  const r = await luongSunoGia(tp, goi, nhatKy)._chay(j, ctxSuno(j), 0);
  assert.ok(r.ok, JSON.stringify(r) + '\n' + nhatKy.join('\n'));
  assert.strictEqual(tp.tao, 1, 'chỉ bấm Create MỘT lần');
  assert.deepStrictEqual(tp.taiMp3, ['moi1-2', 'moi1-2'], 'tải lại đúng bài dài hơn trong 2 bài mới');
  assert.ok(nhatKy.some((x) => /tải lại bài này \(lần 2\/3\), không gửi lại prompt/.test(x)), nhatKy.join('\n'));
  assert.ok(nhatKy.some((x) => /Suno đang tạo 4 bài \(moi1-1, moi1-2, moi1-3, moi1-4\)/.test(x)), nhatKy.join('\n'));
  assert.deepStrictEqual(j.sunoBai, { tk: 'suno-1', ids: ['moi1-1', 'moi1-2'] }, 'nhớ bài của việc trên tài khoản này');
});

testAsync('1.2.4 Suno tải hỏng cả 3 lần → việc lỗi; lần chạy sau ở CÙNG tài khoản tải lại bài cũ, KHÔNG gửi lại prompt; tài khoản khác thì tạo mới', async () => {
  const nhatKy = [];
  const { tp, goi } = sunoGia({ cu: ['cu-1'], taiHong: 3 });
  const j = { so: 348, prompt: 'lofi' };
  const l = luongSunoGia(tp, goi, nhatKy);
  let r = await l._chay(j, ctxSuno(j), 0);
  assert.ok(!r.ok && /hop-khong-co-nut-download/.test(r.loi) && !r.hetLuot, JSON.stringify(r));
  assert.strictEqual(tp.tao, 1);
  r = await l._chay(j, ctxSuno(j), 0);
  assert.ok(r.ok && tp.tao === 1, `lần sau không bấm Create (đã bấm ${tp.tao} lần)`);
  assert.ok(nhatKy.some((x) => /dùng lại 2 bài đã tạo lần trước \(moi1-1, moi1-2\) — không gửi lại prompt/.test(x)), nhatKy.join('\n'));
  // Bài của tài khoản khác → không dùng được ở đây, tạo mới.
  const j2 = { so: 349, prompt: 'jazz', sunoBai: { tk: 'suno-2', ids: ['moi1-1'] } };
  r = await l._chay(j2, ctxSuno(j2), 0);
  assert.ok(r.ok && tp.tao === 2, 'bài ở tài khoản khác → tạo mới ở tài khoản này');
});

testAsync('1.2.4 Suno: danh sách bài nạp muộn → KHÔNG tính bài cũ là bài mới (nhật ký: "Suno đang tạo 14 bài")', async () => {
  const nhatKy = [];
  const { tp, goi } = sunoGia({ cu: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'], dsTre: 4 });
  const j = { so: 349, prompt: 'x' };
  const r = await luongSunoGia(tp, goi, nhatKy)._chay(j, ctxSuno(j), 0);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(nhatKy.some((x) => /Suno đang tạo 4 bài/.test(x)) && !nhatKy.some((x) => /đang tạo 14 bài/.test(x)), nhatKy.join('\n'));
  assert.deepStrictEqual(tp.taiMp3, ['moi1-2']);
});

testAsync('1.2.5 Suno hết credit ("Create again in 9:44:35") → KHÔNG bấm Create, tài khoản nghỉ đúng tới giờ Suno ghi; bài đã tạo vẫn tải được', async () => {
  const nhatKy = [];
  const hetGio = { chu: 'Create again in 9:44:35', giay: 9 * 3600 + 44 * 60 + 35 };
  const { tp, goi } = sunoGia({ cu: ['c1'], hetGio });
  const j = { so: 354, prompt: 'x' };
  const l = luongSunoGia(tp, goi, nhatKy);
  let r = await l._chay(j, ctxSuno(j), 0);
  assert.ok(!r.ok && r.hetLuot && /Suno hết credit tạo bài: "Create again in 9:44:35"/.test(r.loi), JSON.stringify(r));
  assert.strictEqual(r.nghiMs, (hetGio.giay + 60) * 1000);
  assert.strictEqual(tp.tao, 0, 'không bấm Create khi Suno ghi "Create again in"');
  // Bài đã tạo trước đó (tải hỏng) vẫn tải lại được dù hết credit tạo bài.
  const j2 = { so: 353, prompt: 'y', sunoBai: { tk: 'suno-1', ids: ['c1'] } };
  r = await l._chay(j2, ctxSuno(j2), 0);
  assert.ok(r.ok && tp.tao === 0 && tp.taiMp3.join() === 'c1', JSON.stringify(r));
  // Điều phối: tài khoản nghỉ theo nghiMs của luồng (không phải 6 giờ cố định).
  const NGHI = 3 * 3600e3;
  // Luồng giả như luongGiaSuno (bận trong lúc chạy) — CI Windows từng đọc mốc trước khi việc kịp chạy (NaN giờ).
  const { dp, tk } = dungDieuPhoi({ taoLuong: (a, stt) => (a.nen === 'suno' ? { id: `${a.id}-${stt}`, nen: 'suno', ranh: true, viec: null, dung() {},
    async chay(j) {
      this.ranh = false; this.viec = j;
      await new Promise((x) => setTimeout(x, 15));
      this.ranh = true; this.viec = null;
      return { ok: false, hetLuot: true, nghiMs: NGHI, loi: 'Suno hết credit tạo bài: "Create again in 2:59:00"' };
    } } : luongGiaHaiNen([])(a, stt)) });
  dp.datCaiDat({ nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0 });
  dp.them({ loai: 'nhac', prompts: ['a'] });
  dp.chayTatCa();
  await chayHet(dp);
  for (let i = 0; i < 200 && !(tk.tim('suno-1').hetLuotDen > 0); i++) { dp._vong(); await new Promise((x) => setTimeout(x, 15)); }
  const a1 = tk.tim('suno-1');
  assert.ok(Math.abs(a1.hetLuotDen - (Date.now() + NGHI)) < 60e3, `nghỉ ~3 giờ (còn ${((a1.hetLuotDen - Date.now()) / 3600e3).toFixed(2)} giờ)`);
  assert.ok(/Create again in/.test(a1.lyDoHetLuot));
});

test('1.2.4 Suno: nhận nút "Unlock & Download" và nút "Download “<tên bài>”" sau khi mở khoá; Tạo lại bỏ bài đã nhớ', () => {
  const vm = require('vm');
  const ctx = { window: {} };
  vm.runInNewContext(docNguon('src/inject/suno-trang.js', true), ctx);
  assert.strictEqual(typeof ctx.window.__suno.bamTaiSauMoKhoa, 'function');
  const t = docNguon('src/inject/suno-trang.js');
  const NUT = eval(t.match(/nutTai: (\/.*\/i),/)[1]), SAU = eval(t.match(/nutTaiSauMoKhoa: (\/.*\/i),/)[1]);
  for (const c of ['Download', 'Unlock & Download', 'Unlock and Download', 'Tải xuống']) assert.ok(NUT.test(c), c);
  for (const c of ['Download all', 'Downloads', "Download 'First Light in the Room'", 'Unlock']) assert.ok(!NUT.test(c), c);
  assert.ok(SAU.test('Download “First Light in the Room”') && !SAU.test('Download') && !SAU.test('Downloads'));
  // 1.2.5 (video 16/10/2026): nút "Preparing..." sau Unlock; nút Create "Create again in 9:44:35" khi hết credit.
  const CB = eval(t.match(/dangChuanBi: (\/.*\/i),/)[1]), TL = eval(t.match(/choTaoLai: (\/.*\/i),/)[1]);
  assert.ok(CB.test('Preparing...') && CB.test('Preparing…') && !CB.test('Unlock & Download'));
  assert.ok(TL.test('Create again in 9:44:35') && TL.exec('Create again in 9:44:35')[2] === '9:44:35' && TL.test('Create again in 05:12') && !TL.test('Create'));
  const dp = docNguon('src/main/dieu-phoi.js');
  assert.ok(/sunoBai: null/.test(dp.slice(dp.indexOf('taoLai(ids, chay) {'), dp.indexOf('taoLai(ids, chay) {') + 600)), 'Tạo lại phải bỏ sunoBai');
});

test('1.2.5 Hộp thoại dài (chọn tài khoản nhiều nơi chạy) tự cuộn, nút Lưu / Huỷ luôn thấy; chọn tài khoản gọn hai cột', () => {
  const c = docNguon('src/ui/style.css'), h = docNguon('src/ui/index.html'), a = docNguon('src/ui/app.js');
  assert.ok(/\.hop \{[^}]*max-height: calc\(100vh - 32px\)[^}]*display: flex; flex-direction: column/.test(c), 'hộp không cao quá cửa sổ');
  assert.ok(/#hopNoiDung \{[^}]*min-height: 0; overflow-y: auto/.test(c), 'nội dung hộp tự cuộn');
  assert.ok(/\.hop-nut \{[^}]*flex: none/.test(c) && /<div id="hopNoiDung" class="cuon">/.test(h));
  // 1.3.0: mỗi tài khoản một hàng gọn (tên + vai), xếp nhiều cột.
  assert.ok(/class="chon-tk-vai"/.test(a) && /\.chon-tk-vai \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(300px, 1fr\)\)/.test(c));
});

test('Suno: giao diện có mục Tạo nhạc, nút Thêm Suno, ô chờ tối đa; trang nhạc ẩn phần chỉ dành cho ảnh / video', () => {
  const h = docNguon('src/ui/index.html'), a = docNguon('src/ui/app.js'), c = docNguon('src/ui/style.css');
  assert.ok(/data-trang="nhac"[\s\S]{0,80}data-icon="music"/.test(h));
  for (const id of ['nenTao', 'cheDo', 'thaAnh', 'tyLe', 'khuChuoi', 'khuVideoThuMuc', 'locNen', 'chonXoaChat']) {
    assert.ok(new RegExp(`class="[^"]*khong-nhac[^"]*" id="${id}"`).test(h), `#${id} phải ẩn ở trang nhạc`);
  }
  assert.ok(/body\.trang-nhac \.khong-nhac \{ display: none !important; \}/.test(c));
  assert.ok(/classList\.toggle\('trang-nhac', trang === 'nhac'\)/.test(a));
  assert.ok(/themTk\('suno'\)/.test(a) && /id="nutThemTKSuno"/.test(h));
  assert.ok(/choNhacGiay: \$\('#cdChoNhac'\)\.value/.test(a) && /\$\('#cdChoNhac'\)\.value = c\.choNhacGiay/.test(a));
  assert.ok(/nhac: \{ tai: '', ten: 'tenNhac' \}/.test(a), 'mẫu tên nhạc lưu vào tenNhac');
});

// ── 1.3.0: dự án chạy song song, cài đặt riêng, số thứ tự riêng, dừng / chạy từng việc ─────────
test('1.3.0 ô "Chạy prompt số": 98, 303, 305-350 · khoảng mở · bỏ đoạn sai · số vượt quá', () => {
  const r = HD.docSoChay('98, 303, 305-350', 350);
  assert.strictEqual(r.so.length, 48);
  assert.deepStrictEqual([r.so[0], r.so[1], r.so[2], r.so[47]], [98, 303, 305, 350]);
  assert.strictEqual(HD.gonSo(r.so), '98, 303, 305–350');
  assert.deepStrictEqual(HD.docSoChay('305 - 307; 5', 400).so, [5, 305, 306, 307]);
  assert.deepStrictEqual(HD.docSoChay('8-', 10).so, [8, 9, 10]);
  assert.deepStrictEqual(HD.docSoChay('-2', 10).so, [1, 2]);
  const x = HD.docSoChay('abc, 0, 3, 12', 10);
  assert.deepStrictEqual([x.so, x.loi, x.ngoai], [[3], ['abc', '0'], [12]]);
  assert.deepStrictEqual(HD.chonTheoSo(['a', 'b', 'c'], '').map((v) => v.stt), [1, 2, 3], 'trống = mọi prompt');
  const { dp } = dungDieuPhoi();
  const kq = dp.them({ prompts: Array.from({ length: 10 }, (_, i) => `p${i + 1}`), chonSo: '2, 5-6, 99' });
  assert.strictEqual(kq.so, 3);
  assert.deepStrictEqual(dp.viec.map((j) => [j.stt, j.prompt]), [[2, 'p2'], [5, 'p5'], [6, 'p6']]);
  assert.strictEqual(dp.them({ prompts: ['a'], chonSo: '7' }).ok, false, 'không có số nào hợp lệ → không thêm');
});
test('1.3.0 số thứ tự RIÊNG cho ảnh / video (350 ảnh → video cũng từ #1); video nối từ ảnh mang đúng số của ảnh; nâng cấp giữ số cũ', () => {
  const { dp } = dungDieuPhoi();
  dp.them({ prompts: ['1', '2', '3'], chuoiVideo: { prompt: 'đi' } });
  dp.them({ loai: 'video', prompts: ['v1', 'v2'] });
  assert.deepStrictEqual(dp.viec.map((j) => [j.loai, j.so]), [['anh', 1], ['anh', 2], ['anh', 3], ['video', 1], ['video', 2]]);
  const anh3 = dp.viec[2];
  dp._ketThuc(anh3, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  const v = dp.viec.find((j) => j.tuAnh === anh3.id);
  assert.deepStrictEqual([v.loai, v.so, v.stt], ['video', 3, 3], 'video từ ảnh #3 là video #3');
  const anh1 = dp.viec[0];
  dp._ketThuc(anh1, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  assert.strictEqual(dp.viec.find((j) => j.tuAnh === anh1.id).so, 4, 'video #1 đã có (tạo tay) → lấy số kế tiếp, không trùng');
  // Dữ liệu cũ (một bộ đếm chung d.so): mỗi loại bắt đầu từ số lớn nhất đang có của loại đó.
  const cu = dungDieuPhoi({ duLieu: { duAn: [{ id: 'mac-dinh', ten: 'Mặc định', so: 5 }], viec: [
    { id: 1, duAn: 'mac-dinh', so: 1, loai: 'anh', trangThai: 'xong', files: [] }, { id: 2, duAn: 'mac-dinh', so: 2, loai: 'anh', trangThai: 'xong', files: [] },
    { id: 3, duAn: 'mac-dinh', so: 5, loai: 'video', trangThai: 'xong', files: [] }] } });
  cu.dp.them({ prompts: ['x'] }); cu.dp.them({ loai: 'video', prompts: ['y'] }); cu.dp.them({ loai: 'nhac', prompts: ['z'] });
  assert.deepStrictEqual(cu.dp.viec.slice(3).map((j) => [j.loai, j.so]), [['anh', 3], ['video', 6], ['nhac', 1]]);
});
test('1.3.0 cài đặt RIÊNG từng dự án: đổi ở dự án này không ảnh hưởng dự án khác; dự án mới chép cài đặt + thư mục con riêng; tắt máy là cài đặt chung', () => {
  const ghi = [];
  const { dp } = dungDieuPhoi({ ghiFile: (p) => ghi.push(p) });
  const a = dp.taoDuAn('Truyện A', null, null, 'mac-dinh');
  assert.ok(a.caiDat, 'dự án mới có cài đặt riêng ngay từ đầu');
  assert.deepStrictEqual([a.caiDat.thuMucAnh, a.caiDat.thuMucVideo, a.caiDat.thuMucNhac].map((x) => x.replace(/\\/g, '/')), ['/ra/Truyen_a', '', '/ra/Truyen_a'],
    'mẫu tên video mặc định {duAn}/{duAn}_{so} đã tách theo dự án → giữ thư mục video như dự án nguồn');
  dp.datCaiDat({ tenAnh: 'A_{stt}', luongMoiTK: 5, tatMayKhiXong: true, flow: { meToiDa: 4 } }, a.id);
  assert.deepStrictEqual([dp.cd(a.id).tenAnh, dp.cd(a.id).luongMoiTK, dp.cd(a.id).flow.meToiDa], ['A_{stt}', 5, 4]);
  assert.deepStrictEqual([dp.cd('mac-dinh').tenAnh, dp.cd('mac-dinh').luongMoiTK], ['{stt}', 3], 'dự án khác giữ nguyên');
  assert.strictEqual(dp.caiDat.tatMayKhiXong, true, 'tắt máy khi xong: cài đặt chung');
  assert.ok(!('tatMayKhiXong' in dp.cd(a.id)));
  // Dự án cũ chưa có bộ riêng: đổi cài đặt của nó → tạo bộ riêng từ cài đặt chung, cài đặt chung không đổi.
  dp.datCaiDat({ tenAnh: 'M_{stt}' }, 'mac-dinh');
  assert.deepStrictEqual([dp.cd('mac-dinh').tenAnh, dp.caiDat.tenAnh], ['M_{stt}', '{stt}']);
  dp.them({ duAn: a.id, prompts: ['x'] });
  dp._ketThuc(dp.viec[0], { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  assert.strictEqual(ghi[0].replace(/\\/g, '/'), '/ra/Truyen_a/A_001.png', 'file theo thư mục + mẫu tên của đúng dự án');
  const st = dp.trangThai();
  assert.strictEqual(st.caiDatDuAn[a.id].tenAnh, 'A_{stt}');
  assert.strictEqual(st.thuMucDuAn[a.id].anh.replace(/\\/g, '/'), '/ra/Truyen_a');
  // Dự án mới tạo từ dự án đang ở thư mục con của nó → thư mục ANH EM (không lồng /ra/Truyen_a/Truyen_b).
  const b = dp.taoDuAn('Truyện B', null, null, a.id);
  assert.strictEqual(b.caiDat.thuMucAnh.replace(/\\/g, '/'), '/ra/Truyen_b');
  // Dự án nguồn lưu ở thư mục người dùng tự chọn → thư mục con trong đó; mẫu tên có {duAn} → giữ nguyên thư mục.
  dp.datCaiDat({ thuMucAnh: '/E/Videos', thuMucVideo: '/E/Clip', tenVideo: '{duAn}/{stt}' }, 'mac-dinh');
  const c = dp.taoDuAn('Truyện C', null, null, 'mac-dinh');
  assert.deepStrictEqual([c.caiDat.thuMucAnh, c.caiDat.thuMucVideo, c.caiDat.thuMucVideoAnh].map((x) => x.replace(/\\/g, '/')), ['/E/Videos/Truyen_c', '/E/Clip', '']);
});
/** Luồng giả 1.3.0: nhớ dự án của luồng; `dung()` cắt ngang việc đang chạy như luồng thật (giữ chat). */
const luongDuAn = (nhat, o = {}) => (a, stt, duAnId) => {
  const l = { id: `${a.id}-${duAnId || 'chung'}-${stt}`, nen: a.nen || 'muse', duAn: duAnId, ranh: true, viec: null, soDung: 0,
    dung() { this.soDung++; if (this._cat) this._cat({ ok: false, dung: true, giuThread: true }); },
    async chay(j, ctx) {
      this.ranh = false; this.viec = j; nhat.push({ bd: j.duAn, so: j.so, luong: this.id, duAnLuong: duAnId, t: Date.now() });
      ctx.capNhat({ thread: `https://muse.ai/thread/${j.id}` });
      const r = await new Promise((giai) => { this._cat = giai; setTimeout(() => giai({ ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }), o.ms || 15); });
      this._cat = null; this.ranh = true; this.viec = null;
      return r;
    } };
  (o.luong || []).push(l);
  return l;
};
testAsync('1.3.0 hai dự án chạy SONG SONG trên CÙNG tài khoản: luồng riêng từng dự án, dự án 2 không phải chờ hết hàng của dự án 1', async () => {
  const nhat = [], luong = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongDuAn(nhat, { luong }) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  const b = dp.taoDuAn('B', ['tk-1'], null, 'mac-dinh');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 }, b.id);
  dp.them({ prompts: ['1', '2', '3', '4', '5', '6'] });
  dp.chayDuAn('mac-dinh');
  dp.them({ duAn: b.id, loai: 'anh', prompts: ['b1', 'b2'], chay: true });
  await chayHet(dp);
  assert.ok(dp.viec.every((j) => j.trangThai === 'xong'));
  const dauB = nhat.findIndex((x) => x.bd === b.id), cuoiA = nhat.map((x) => x.bd).lastIndexOf('mac-dinh');
  assert.ok(dauB >= 0 && dauB < cuoiA, `dự án B bắt đầu khi dự án A còn việc (B ở lượt ${dauB}, A xong ở lượt ${cuoiA})`);
  assert.ok(nhat.every((x) => x.bd === x.duAnLuong), 'mỗi luồng chỉ nhận việc của dự án mình');
  assert.deepStrictEqual([...new Set(luong.map((l) => l.duAn))].sort(), ['b', 'mac-dinh']);
});
testAsync('1.3.0 Chạy / Dừng theo dự án: chạy dự án A không chạy B; dừng A thì B vẫn chạy', async () => {
  const nhat = [], luong = [];
  const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongDuAn(nhat, { luong, ms: 40 }) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  const b = dp.taoDuAn('B', ['tk-1'], null, 'mac-dinh');
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 }, b.id);
  dp.them({ prompts: ['1', '2', '3'] });
  dp.them({ duAn: b.id, prompts: ['b1', 'b2', 'b3'] });
  dp.chayDuAn('mac-dinh');
  assert.deepStrictEqual(dp.trangThai().duAnChay, ['mac-dinh']);
  dp.chayDuAn(b.id);
  await new Promise((r) => setTimeout(r, 10)); dp._vong();
  dp.dungDuAn('mac-dinh');
  await chayHet(dp);
  const cuaA = dp.viec.filter((j) => j.duAn === 'mac-dinh'), cuaB = dp.viec.filter((j) => j.duAn === b.id);
  assert.ok(cuaB.every((j) => j.trangThai === 'xong'), 'B chạy hết dù A đã dừng');
  assert.ok(cuaA.some((j) => j.trangThai === 'cho'), 'A dừng: việc còn ở hàng chờ');
  assert.ok(cuaA.every((j) => j.trangThai !== 'chay'));
  assert.ok(nhatKy.some((x) => /Đã dừng dự án "Mặc định"/.test(x)) && nhatKy.some((x) => /Dự án "B": đã chạy hết hàng chờ/.test(x)));
  assert.strictEqual(dp.dangChay, false);
});
testAsync('1.3.0 DỪNG RIÊNG một việc đang chạy (giữ chat) — việc khác chạy tiếp; bấm CHẠY việc đó khi dự án đang nghỉ thì chỉ chạy đúng việc đó, lấy tiếp chat cũ', async () => {
  const nhat = [], luong = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongDuAn(nhat, { luong, ms: 60 }) });
  dp.datCaiDat({ luongMoiTK: 3, nghiGiuaLanGui: 0 });
  dp.them({ prompts: ['1', '2', '3', '4'] });
  dp.chayDuAn('mac-dinh');
  await new Promise((r) => setTimeout(r, 10));
  const j2 = dp.viec[1], j4 = dp.viec[3];
  assert.strictEqual(j2.trangThai, 'chay');
  assert.strictEqual(dp.dungViec([j2.id, j4.id]), 2);
  await new Promise((r) => setTimeout(r, 5));
  assert.deepStrictEqual([j2.trangThai, j4.trangThai], ['dung', 'dung'], 'việc đang chạy và việc đang chờ đều "Đã dừng"');
  assert.ok(j2.thread, 'giữ chat để chạy tiếp lấy kết quả');
  await chayHet(dp);
  assert.deepStrictEqual(dp.viec.map((j) => j.trangThai), ['xong', 'dung', 'xong', 'dung'], 'việc khác vẫn chạy xong');
  assert.strictEqual(dp.dangChay, false, 'dự án chạy hết (việc đã dừng không giữ dự án chạy mãi)');
  // Chạy riêng việc #4 khi dự án đang nghỉ: chỉ #4 chạy, #2 vẫn dừng.
  const truoc = nhat.length;
  assert.strictEqual(dp.chayViec([j4.id]), 1);
  assert.ok(j4.chayRieng && dp.dangChay && dp.trangThai().duAnChay.length === 0);
  await chayHet(dp);
  assert.deepStrictEqual([j4.trangThai, j2.trangThai], ['xong', 'dung']);
  assert.deepStrictEqual(nhat.slice(truoc).map((x) => x.so), [4]);
  assert.ok(!j4.chayRieng && !dp.dangChay);
  // Việc đã dừng giữa chừng còn chat → chạy lại lấy tiếp chat cũ (không gửi lại prompt).
  const chat = j2.thread;
  dp.chayViec([j2.id]);
  assert.strictEqual(j2.thread, chat);
  await chayHet(dp);
  assert.strictEqual(j2.trangThai, 'xong');
});
testAsync('1.3.0 bấm Chạy một việc đang chờ khi dự án ĐANG chạy → lên đầu hàng chờ', async () => {
  const nhat = [];
  const { dp } = dungDieuPhoi({ taoLuong: luongDuAn(nhat, { ms: 10 }) });
  dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0 });
  dp.them({ prompts: ['1', '2', '3', '4', '5'] });
  dp.chayViec([dp.viec[4].id]);
  dp.chayDuAn('mac-dinh');
  await chayHet(dp);
  assert.strictEqual(nhat[0].so, 5, 'việc #5 được bấm Chạy chạy trước');
});
testAsync('1.3.0 Flow: dừng riêng MỘT việc trong mẻ đang chạy → bỏ kết quả việc đó, việc khác của mẻ vẫn xong; dừng hết mẻ thì dừng tab', async () => {
  const luong = [];
  const taoLuong = (a, stt, duAnId) => {
    const l = { id: `${a.id}-${stt}`, nen: 'flow', duAn: duAnId, ranh: true, dsViec: null, soDung: 0, dung() { this.soDung++; },
      get viec() { return this.dsViec && this.dsViec[0]; },
      async chayMe(ds, ctx) {
        this.ranh = false; this.dsViec = ds;
        await new Promise((r) => setTimeout(r, 30));
        for (const j of ds) ctx.xong(j, { ok: true, files: [{ duongDan: `/tam/${ctx.tenFile(j)}.png` }], flowTen: ctx.tenFile(j) });
        this.dsViec = null; this.ranh = true;
      } };
    luong.push(l);
    return l;
  };
  const { dp } = dungDieuPhoi({ taoLuong });
  dp.datCaiDat({ nghiGiuaLanGui: 0, flow: { meToiDa: 3, tabMoiTK: 1 } });
  dp.them({ nen: 'flow', prompts: ['1', '2', '3'] });
  dp.chayDuAn('mac-dinh');
  await new Promise((r) => setTimeout(r, 5));
  const [a, b] = dp.viec;
  dp.dungViec([b.id]);
  assert.strictEqual(luong[0].soDung, 0, 'còn việc khác trong mẻ → không dừng cả tab');
  await chayHet(dp);
  assert.deepStrictEqual(dp.viec.map((j) => j.trangThai), ['xong', 'dung', 'xong']);
  assert.deepStrictEqual(b.files, [], 'kết quả về sau của việc đã dừng bị bỏ');
  // Dừng cả mẻ → dừng tab.
  dp.them({ nen: 'flow', prompts: ['4'] });
  dp.chayDuAn('mac-dinh');
  await new Promise((r) => setTimeout(r, 5));
  const j4 = dp.viec[3];
  dp.dungViec([j4.id]);
  assert.ok(luong.some((l) => l.soDung === 1));
  void a;
});
testAsync('1.3.0 Flow: mỗi dự án tab riêng + dự án Flow riêng; tên video trên Flow có "v" (không trùng tên ảnh cùng số)', async () => {
  const daChay = [], taoLuongDuAn = [];
  const goc = luongGiaHaiNen(daChay);
  const { dp } = dungDieuPhoi({ taoLuong: (a, stt, duAnId) => { taoLuongDuAn.push([a.id, duAnId]); return goc(a, stt); } });
  dp.datCaiDat({ nghiGiuaLanGui: 0 });
  const b = dp.taoDuAn('B', ['flow-1'], null, 'mac-dinh');
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['a1'] });
  dp.them({ duAn: b.id, nen: 'flow', loai: 'video', prompts: ['v1'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.deepStrictEqual(daChay.map((x) => x.ten[0]).sort(), ['B_v001', 'Mac_dinh_001']);
  assert.deepStrictEqual(taoLuongDuAn.map((x) => x.join(':')).sort(), ['flow-1:b', 'flow-1:mac-dinh']);
  assert.strictEqual(dp.datFlowUrl(b.id, 'flow-1', 'https://flow.google.com/project/xyz'), true);
  assert.strictEqual(dp.datFlowUrl(b.id, 'flow-1', 'https://example.com/'), false, 'chỉ nhận địa chỉ dự án Flow');
  assert.deepStrictEqual([dp.flowUrlCua(b.id, 'flow-1'), dp.flowUrlCua('mac-dinh', 'flow-1')], ['https://flow.google.com/project/xyz', ''], 'dự án khác không dùng chung dự án Flow');
});
testAsync('1.3.0 Suno: một luồng mỗi tài khoản DÙNG CHUNG mọi dự án, chia lượt đều (dự án sau không phải chờ hết dự án trước)', async () => {
  const thuTu = [];
  const taoLuong = (a, stt, duAnId) => ({ id: `${a.id}-${stt}`, nen: a.nen, duAn: duAnId, ranh: true, viec: null, dung() {},
    async chay(j) { this.ranh = false; this.viec = j; thuTu.push([j.duAn, duAnId]); await new Promise((r) => setTimeout(r, 5)); this.ranh = true; this.viec = null; return { ok: true, files: [{ mime: 'audio/mpeg', b64: 'AA==' }] }; } });
  const { dp } = dungDieuPhoi({ taoLuong });
  dp.datCaiDat({ nghiGiuaLanGui: 0 });
  const b = dp.taoDuAn('B', null, null, 'mac-dinh');
  dp.them({ loai: 'nhac', prompts: ['1', '2', '3', '4'] });
  dp.them({ duAn: b.id, loai: 'nhac', prompts: ['b1', 'b2'] });
  dp.chayTatCa();
  await chayHet(dp);
  assert.ok(thuTu.every((x) => x[1] === null), 'luồng Suno không gắn dự án');
  assert.ok(thuTu.slice(0, 4).some((x) => x[0] === b.id), `B được chia lượt sớm: ${thuTu.map((x) => x[0]).join(',')}`);
});
test('1.3.0 giao diện: nút Chạy / Dừng theo dự án, nút Dừng / Chạy ở từng việc + thanh chọn, ô "Chạy prompt số", chọn ĐÍCH DANH tài khoản chạy', () => {
  const a = docNguon('src/ui/app.js'), h = docNguon('src/ui/index.html', true), m = docNguon('main.js');
  assert.ok(/api\.call\(duAnDangChay\(d\.id\) \? 'dung' : 'chay', \{ duAn: d\.id \}\)/.test(a), 'nút trên cùng chạy / dừng DỰ ÁN đang mở');
  assert.ok(/data-dk="dungViec"/.test(a) && /data-dk="chayViec"/.test(a) && /dieuKhienViec\(dk\.dataset\.dk, \[id\]\)/.test(a));
  for (const id of ['chonSo', 'chonChay', 'chonDung', 'cdTieuDe', 'cdDuAnGhi']) assert.ok(h.includes(`id="${id}"`), id);
  assert.ok(!h.includes('id="tuSo"') && !h.includes('id="denSo"'));
  assert.ok(/chonSo: \$\('#chonSo'\)\.value/.test(a) && /HD\.docSoChay\(chonSo, ds\.length\)/.test(a));
  assert.ok(/\['chay', 'Chạy'\], \['du', 'Dự phòng'\], \['khong', 'Không dùng'\]/.test(a) && /name="vai_\$\{esc\(id\)\}"/.test(a));
  assert.ok(/dungViec: \(\{ ids \}\) => dieuPhoi\.dungViec\(ids\)/.test(m) && /chayViec: \(\{ ids \}\) => dieuPhoi\.chayViec\(ids\)/.test(m));
  assert.ok(/const datCD = \(c\) => api\.call\('datCaiDat', \{ \.\.\.c, duAn:/.test(a) && !/api\.call\('datCaiDat', \{(?! \.\.\.c)/.test(a), 'mọi chỗ lưu cài đặt đều kèm dự án');
  assert.ok(/\['dung', 'Đã dừng'\]/.test(a) && /\.pill\.dung/.test(docNguon('src/ui/style.css')));
});
test('1.3.0 vai tài khoản trong hộp thoại → thứ tự [chạy…, dự phòng…] + số chạy cùng lúc', () => {
  const a = docNguon('src/ui/app.js');
  const vaiSrc = a.slice(a.indexOf('const vaiTk = '), a.indexOf('const viecTheoId'));
  const DS_NEN = ['muse', 'flow', 'suno'];
  // eslint-disable-next-line no-new-func
  const f = new Function('DS_NEN', vaiSrc + '; return { vaiTk, laySong, layTk };')(DS_NEN);
  const v = { thuTu_muse: 'm1,m2,m3,m4', vai_m1: 'du', vai_m2: 'chay', vai_m3: 'khong', vai_m4: 'chay', thuTu_flow: 'f1,f2', vai_f1: 'du', vai_f2: 'du', thuTu_suno: '' };
  assert.deepStrictEqual(f.layTk(v), ['m2', 'm4', 'm1', 'f1', 'f2']);
  assert.deepStrictEqual(f.laySong(v), { muse: 2, flow: 1, suno: 1 }, 'không chọn "Chạy" mà có dự phòng → dự phòng đầu thành Chạy');
});

console.log('\n── 1.3.4 RAM / giật ──────────────────────────');
test('1.3.4 danh sách + Thư viện không còn <video> cho từng việc (ảnh nhỏ chụp sẵn), vẽ theo từng dòng', () => {
  const a = docNguon('src/ui/app.js'), c = docNguon('src/ui/style.css');
  assert.ok(!/<video[^>]*preload="metadata"/.test(a), 'không còn <video preload="metadata"> trong danh sách / thư viện');
  const thumb = a.slice(a.indexOf('function thumbHtml'), a.indexOf('function dongViec'));
  assert.ok(!/<video/.test(thumb) && /anhVideoHtml\(f, /.test(thumb), 'dòng video dùng ảnh nhỏ');
  const tv = a.slice(a.indexOf('function veThuVien'), a.indexOf('// ── Tài khoản'));
  assert.ok(!/<video/.test(tv) && /veTheoDong\(hop, ds\.map/.test(tv), 'thư viện dùng ảnh nhỏ + vẽ theo dòng');
  const hang = a.slice(a.indexOf('function veHang'), a.indexOf('function thumbHtml'));
  assert.ok(/veTheoDong\(hop, ds\.slice\(0, MAX\)\.map\(\(j\) => \(\{ khoa: j\.id, html: dongHtml\(j\) \}\)\)/.test(hang) && /const html = dongViec\(j\);/.test(hang), 'hàng đợi vẽ theo dòng (1.4.14: HTML dòng nhớ theo đối tượng việc)');
  assert.ok(/v\.removeAttribute\('src'\)/.test(a) && /toDataURL\('image\/jpeg'/.test(a), 'chụp xong thì nhả video');
  assert.ok(/new IntersectionObserver/.test(a), 'chỉ chụp video đang hiện trên màn hình');
  assert.ok(/img\[data-vthumb\]:not\(\[src\]\)[^{]*\{ visibility: hidden; \}/.test(c), 'ảnh chưa chụp: visibility (display:none làm IntersectionObserver không thấy)');
  assert.ok(/\.luoi-tv \{[^}]*grid-auto-rows: max-content/.test(c), 'lưới thư viện không co hàng');
});
test('1.3.4 tiến trình chính: gom ghi du-lieu.json 1,5 s, báo giao diện 250 ms, RAM từng phần vào nhật ký, xoay vòng nhat-ky.txt, luồng Muse dừng video', () => {
  const m = docNguon('main.js'), l = docNguon('src/main/luong.js'), st = docNguon('src/main/store.js');
  assert.ok(/new Store\(path\.join\(app\.getPath\('userData'\), 'du-lieu\.json'\), \(m\) => log\('warning', m\), \{ nhipMs: 1500 \}\)/.test(m));
  assert.ok(/this\.nhipMs = o\.nhipMs \|\| 250/.test(st) && /\}, this\.nhipMs\);/.test(st));
  // 1.4.0: nhịp 250 ms, hàng đợi lớn thì thưa dần (tối đa 1 s); thu nhỏ thì thôi báo.
  assert.ok(/win\.webContents\.send\('state', trangThaiGui\(\)\);\n  \}, [^\n]*nhipBao\(\)\);/.test(m) && /Math\.min\(1000, 250 \+/.test(m) && /if \(win\.isMinimized\(\)\) \{ boLoBao = true; return; \}/.test(m));
  assert.ok(/function baoRam\(\)/.test(m) && /if \(dieuPhoi\.dangChay \|\| dieuPhoi\.luong\.length\) baoRam\(\)/.test(m) && /app\.getAppMetrics\(\)/.test(m));
  assert.ok(/nhat-ky-cu\.txt/.test(m) && /20 \* 1024 \* 1024/.test(m));
  assert.ok(/spellcheck: false/.test(m));
  assert.ok(/querySelectorAll\('video, audio'\)\.forEach\(\(m\) => \{ try \{ m\.pause\(\); \}/.test(l));
});
testAsync('1.3.4 Store ghi theo nhịp nhipMs (không ghi sớm hơn, vẫn ghi sau nhịp)', async () => {
  const { Store } = require('../src/main/store');
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-nhip-'));
  const f = path.join(dir, 'd.json');
  const s = new Store(f, null, { nhipMs: 600 });
  assert.strictEqual(new Store(path.join(dir, 'e.json')).nhipMs, 250, 'mặc định 250');
  s.set({ a: 1 });
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(!fs.existsSync(f), 'chưa tới nhịp thì chưa ghi');
  s.set({ a: 2 });
  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(JSON.parse(fs.readFileSync(f, 'utf8')).a, 2, 'tới nhịp thì ghi bản mới nhất');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── 1.3.6: Hẹn giờ chạy riêng từng chức năng ────────────────────────────────
{
  const HG = require('../src/main/hen-gio');
  const luc = (s) => new Date(s).getTime();   // giờ máy (không có Z)
  test('1.3.6 hẹn giờ: chuẩn hoá giờ, khung 22:00→06:00 qua nửa đêm, mỗi lần hẹn chỉ chạy một lần', () => {
    assert.deepStrictEqual(['7:05', '07h30', '22.00', '24:00', '9:60', 'x', ''].map(HG.chuanGio), ['07:05', '07:30', '22:00', '', '', '', '']);
    const h = HG.chuanHen({ bat: true, batDau: '22:00', ketThuc: '06:00' });
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-18T21:59:59')), null, 'chưa tới giờ');
    const r = HG.denGioChay(h, luc('2026-10-18T22:00:00'));
    assert.deepStrictEqual([r.khoa, r.den], ['2026-10-18 22:00', luc('2026-10-19T06:00:00')], 'dừng 6 giờ sáng HÔM SAU');
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-19T03:00:00')).khoa, '2026-10-18 22:00', 'mở app lúc 3 giờ sáng (trong khung) vẫn chạy lần hẹn tối qua');
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-19T06:00:00')), null, 'hết khung');
    assert.strictEqual(HG.denGioChay({ ...h, daChay: '2026-10-18 22:00' }, luc('2026-10-18T23:00:00')), null, 'đã chạy lần này thì thôi');
    assert.strictEqual(HG.denGioChay({ ...h, daChay: '2026-10-18 22:00' }, luc('2026-10-19T22:00:00')).khoa, '2026-10-19 22:00', 'hôm sau chạy tiếp');
    assert.strictEqual(HG.denGioChay({ ...h, bat: false }, luc('2026-10-18T22:00:00')), null, 'tắt thì không chạy');
    assert.strictEqual(HG.lanChayToi(h, luc('2026-10-18T12:00:00')), luc('2026-10-18T22:00:00'));
    assert.strictEqual(HG.lanChayToi({ ...h, daChay: '2026-10-18 22:00' }, luc('2026-10-18T23:00:00')), luc('2026-10-19T22:00:00'));
    // Cùng ngày: 08:00 → 11:30
    const s = HG.chuanHen({ bat: true, batDau: '08:00', ketThuc: '11:30' });
    assert.strictEqual(HG.denGioChay(s, luc('2026-10-18T09:00:00')).den, luc('2026-10-18T11:30:00'));
  });
  test('1.3.6 hẹn giờ: không giờ dừng thì chỉ bắt đầu trong 10 phút sau giờ hẹn; "một lần" chỉ tính mốc sau lúc đặt', () => {
    const h = HG.chuanHen({ bat: true, batDau: '02:00' });
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-18T02:09:00')).den, 0, 'trễ 9 phút (máy vừa thức) vẫn chạy, chạy tới hết');
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-18T02:10:00')), null, 'mở app buổi trưa không tự chạy hẹn 2 giờ sáng');
    assert.strictEqual(HG.denGioChay(h, luc('2026-10-18T12:00:00')), null);
    const mot = HG.chuanHen({ bat: true, batDau: '22:00', ketThuc: '23:00', lap: 'mot', datLuc: luc('2026-10-18T22:30:00') });
    assert.strictEqual(HG.denGioChay(mot, luc('2026-10-18T22:31:00')), null, 'đặt "một lần" lúc 22:30 cho mốc 22:00 → không chạy bù mốc đã qua');
    assert.strictEqual(HG.denGioChay(mot, luc('2026-10-19T22:00:00')).khoa, '2026-10-19 22:00', '→ chạy mốc 22:00 hôm sau');
    assert.strictEqual(HG.chuanHen({ batDau: '22:00', ketThuc: '22:00' }).ketThuc, '', 'giờ dừng trùng giờ bắt đầu = không có giờ dừng');
  });

  /** Luồng giả: ghi [loai, duAn, so] mỗi việc chạy; `cham` ms mỗi việc. */
  const luongHen = (daChay, cham = 8) => (a, stt, duAnId) => ({
    id: `${a.id}-${stt}`, nen: a.nen, duAn: duAnId, ranh: true, viec: null, soDung: 0,
    dung() { this.soDung++; this.biDung = true; },
    async chay(j) {
      this.ranh = false; this.viec = j; this.biDung = false; daChay.push([j.loai, j.duAn, j.so]);
      await new Promise((r) => setTimeout(r, cham)); this.ranh = true; this.viec = null;
      if (this.biDung) return { ok: false, dung: true };   // như luồng thật: bị dừng → việc về hàng chờ
      return { ok: true, files: [{ mime: j.loai === 'nhac' ? 'audio/mpeg' : j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] };
    }
  });
  const henCua = (dp, l) => dp.henGio.find((h) => h.loai === l);   // 1.4.14: henGio là danh sách
  const chayCua = (dp, l) => [...dp.henDangChay.values()].find((x) => x.loai === l);
  const chayVong = async (dp, n = 120) => { for (let i = 0; i < n; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 10)); } };

  testAsync('1.3.6 hẹn giờ Tạo ảnh: tới giờ chỉ chạy việc ẢNH (mọi dự án) + video nối từ ảnh; video / nhạc khác giữ Chờ; chạy hết thì xong lượt', async () => {
    const daChay = [];
    let gio = luc('2026-10-18T21:59:00');
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongHen(daChay), bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0, luongMoiTK: 2 });
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.them({ loai: 'anh', prompts: ['a1', 'a2'], chuoiVideo: { prompt: 'zoom' } });
    dp.them({ duAn: b.id, loai: 'anh', prompts: ['b1'] });
    dp.them({ loai: 'video', prompts: ['v1'] });
    dp.them({ loai: 'nhac', prompts: ['n1'] });
    assert.strictEqual(dp.datHenGio('anh', { bat: true, batDau: '22:00' }).ok, true);
    await chayVong(dp, 10);
    assert.strictEqual(daChay.length, 0, 'chưa tới giờ thì chưa chạy gì');
    assert.strictEqual(dp.dangChay, false);
    gio = luc('2026-10-18T22:00:05');
    await chayVong(dp);
    assert.deepStrictEqual(daChay.filter((x) => x[0] === 'anh').map((x) => `${x[1]}#${x[2]}`).sort(), ['b#1', 'mac-dinh#1', 'mac-dinh#2'], 'ảnh của cả hai dự án');
    assert.strictEqual(daChay.filter((x) => x[0] === 'video').length, 2, 'đúng 2 video nối từ 2 ảnh có "tự tạo video"');
    assert.ok(daChay.every((x) => x[0] !== 'nhac'), 'nhạc không chạy');
    const v1 = dp.viec.find((j) => j.loai === 'video' && j.prompt === 'v1');
    assert.strictEqual(v1.trangThai, 'cho', 'video nhập tay (không nối từ ảnh) chờ hẹn của Tạo video');
    assert.strictEqual(dp.viec.find((j) => j.loai === 'nhac').trangThai, 'cho');
    assert.strictEqual(dp.henDangChay.size, 0, 'chạy hết thì xong lượt hẹn');
    assert.strictEqual(dp.duAnChay.size, 0, 'không bật nút Chạy dự án');
    assert.ok(nhatKy.some((x) => /⏰ Đến giờ hẹn 22:00: bắt đầu Tạo ảnh — 3 việc đang chờ, mọi dự án, chạy tới hết/.test(x)), nhatKy.join('\n'));
    assert.ok(nhatKy.some((x) => /✅ Hẹn giờ Tạo ảnh: đã chạy hết việc ảnh đang chờ/.test(x)));
    assert.ok(nhatKy.some((x) => /Đã chạy hết hàng chờ/.test(x)), 'hết mọi thứ → báo hết lượt như khi bấm Chạy (tắt máy khi xong dùng được)');
    // Cùng ngày: thêm ảnh mới → không chạy lại; hôm sau đúng giờ → chạy.
    dp.them({ loai: 'anh', prompts: ['moi'] });
    gio = luc('2026-10-18T22:05:00');
    await chayVong(dp, 10);
    assert.strictEqual(dp.viec.find((j) => j.prompt === 'moi').trangThai, 'cho', 'mỗi lần hẹn chỉ chạy một lần');
    gio = luc('2026-10-19T22:00:00');
    await chayVong(dp, 40);
    assert.strictEqual(dp.viec.find((j) => j.prompt === 'moi').trangThai, 'xong', 'hôm sau chạy tiếp');
  });

  testAsync('1.3.6 hẹn giờ độc lập: ảnh 22:00, nhạc 22:30 (chỉ dự án B) — mỗi chức năng chạy đúng giờ của nó', async () => {
    const daChay = [];
    let gio = luc('2026-10-18T22:00:00');
    const { dp } = dungDieuPhoi({ taoLuong: luongHen(daChay), bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0 });
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.them({ loai: 'anh', prompts: ['a1'] });
    dp.them({ loai: 'nhac', prompts: ['n-macdinh'] });
    dp.them({ duAn: b.id, loai: 'nhac', prompts: ['n-b'] });
    dp.datHenGio('anh', { bat: true, batDau: '22:00' });
    dp.datHenGio('nhac', { bat: true, batDau: '22:30', duAn: b.id });
    await chayVong(dp, 40);
    assert.deepStrictEqual(daChay.map((x) => x[0]), ['anh'], '22:00: chỉ ảnh');
    gio = luc('2026-10-18T22:30:00');
    await chayVong(dp, 40);
    assert.deepStrictEqual(daChay.map((x) => `${x[0]}:${x[1]}`), ['anh:mac-dinh', 'nhac:b'], '22:30: nhạc của dự án B, nhạc dự án khác vẫn chờ');
    assert.strictEqual(dp.viec.find((j) => j.prompt === 'n-macdinh').trangThai, 'cho');
  });

  testAsync('1.3.6 tới giờ dừng → luồng đang làm việc theo hẹn dừng, việc còn lại giữ Chờ; nút Dừng dự án bỏ dự án khỏi lượt hẹn', async () => {
    const daChay = [];
    let gio = luc('2026-10-18T22:00:00');
    // Video theo hẹn chạy tới khi bị bảo dừng (không phụ thuộc tốc độ máy: máy CI Windows chậm từng làm việc 60 ms xong
    // trước giờ dừng → không còn luồng nào để dừng); ảnh xong ngay.
    const tao = (a, stt, duAnId) => ({
      id: `${a.id}-${stt}`, nen: a.nen, duAn: duAnId, ranh: true, viec: null, soDung: 0,
      dung() { this.soDung++; this.biDung = true; if (this.xong) this.xong(); },
      async chay(j) {
        this.ranh = false; this.viec = j; this.biDung = false; daChay.push([j.loai, j.duAn, j.so]);
        await new Promise((r) => { this.xong = r; if (j.loai !== 'video') setTimeout(r, 8); });
        this.xong = null; this.ranh = true; this.viec = null;
        if (this.biDung) return { ok: false, dung: true };
        return { ok: true, files: [{ mime: j.loai === 'video' ? 'video/mp4' : 'image/png', b64: 'AA==' }] };
      }
    });
    const ds = [];
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: (a, s, d) => { const l = tao(a, s, d); ds.push(l); return l; }, bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0, luongMoiTK: 1 });
    dp.them({ loai: 'video', prompts: ['1', '2', '3', '4', '5', '6'] });
    dp.datHenGio('video', { bat: true, batDau: '22:00', ketThuc: '22:10' });
    await chayVong(dp, 3);
    assert.ok(chayCua(dp, 'video') && dp.dangChay);
    assert.strictEqual(dp.duAnDangChay('mac-dinh'), true);
    dp.datHenGio('video', { ketThuc: '23:00' });
    assert.strictEqual(chayCua(dp, 'video').den, luc('2026-10-18T23:00:00'), 'đổi giờ dừng lúc đang chạy → áp ngay');
    dp.datHenGio('video', { ketThuc: '22:10' });
    gio = luc('2026-10-18T22:10:00');
    dp._vong();
    assert.strictEqual(dp.henDangChay.size, 0);
    assert.ok(ds.some((l) => l.soDung === 1), 'luồng đang chạy được bảo dừng');
    assert.ok(nhatKy.some((x) => /⏰ Hết giờ hẹn Tạo video \(22:10\) — 1 luồng đang chạy dừng lại/.test(x)), nhatKy.join('\n'));
    await chayVong(dp, 20);
    assert.ok(dp.viec.filter((j) => j.trangThai === 'cho').length >= 4, 'việc chưa chạy giữ Chờ');
    // Dừng dự án giữa lượt hẹn → dự án đó thôi chạy trong lượt này.
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.them({ duAn: b.id, loai: 'anh', prompts: ['b1', 'b2'] });
    dp.them({ loai: 'anh', prompts: ['m1'] });
    dp.datHenGio('anh', { bat: true, batDau: '22:10' });
    dp._vong();
    dp.dungDuAn(b.id);
    await chayVong(dp, 30);
    assert.ok(dp.viec.filter((j) => j.duAn === b.id && j.loai === 'anh').every((j) => j.trangThai === 'cho'), 'dự án B bị Dừng thì không chạy theo hẹn');
    assert.strictEqual(dp.viec.find((j) => j.prompt === 'm1').trangThai, 'xong');
  });

  testAsync('1.3.6 hẹn giờ với Flow: mẻ Flow chỉ gom việc ẢNH đang theo hẹn, video Flow cùng dự án không bị kéo theo', async () => {
    const daChay = [];
    let gio = luc('2026-10-18T22:00:00');
    const { dp } = dungDieuPhoi({ taoLuong: luongGiaHaiNen(daChay), bayGio: () => gio, tonTai: () => false });
    dp.datCaiDat({ nghiGiuaLanGui: 0, flow: { meToiDa: 5 } });
    dp.them({ nen: 'flow', loai: 'anh', tyLe: '9:16', prompts: ['1', '2', '3'] });
    dp.them({ nen: 'flow', loai: 'video', tyLe: '9:16', prompts: ['v'] });
    dp.datHenGio('anh', { bat: true, batDau: '22:00' });
    await chayVong(dp, 40);
    assert.deepStrictEqual(daChay.map((x) => x.so), [[1, 2, 3]], 'một mẻ 3 ảnh');
    assert.strictEqual(dp.viec.find((j) => j.loai === 'video').trangThai, 'cho');
  });
  test('1.3.6 hẹn "một lần" tự tắt sau khi chạy; không có việc chờ → bỏ qua có báo; giờ sai → báo lỗi; xoá dự án của hẹn → tắt hẹn', () => {
    let gio = luc('2026-10-18T07:00:00');
    const { dp, nhatKy, store } = dungDieuPhoi({ bayGio: () => gio });
    assert.strictEqual(dp.datHenGio('anh', { bat: true, batDau: '25:00' }).ok, false);
    assert.strictEqual(dp.datHenGio('anh', { bat: true, batDau: '07:00', ketThuc: 'abc' }).ok, false);
    assert.strictEqual(dp.datHenGio('xyz', { bat: true }).ok, false);
    dp.datHenGio('nhac', { bat: true, batDau: '07:00', lap: 'mot' });
    assert.strictEqual(henCua(dp, 'nhac').bat, false, 'một lần → tắt sau khi tới giờ');
    assert.ok(nhatKy.some((x) => /⏰ Hẹn giờ Tạo nhạc \(07:00\): không có việc nhạc nào đang chờ \(mọi dự án\) — bỏ qua lần này/.test(x)), nhatKy.join('\n'));
    assert.strictEqual(dp.henDangChay.size, 0);
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.datHenGio('video', { bat: true, batDau: '23:00', duAn: b.id });
    assert.deepStrictEqual(store.get(['henGio']).henGio.find((h) => h.loai === 'video').duAnDs, [b.id], 'hẹn giờ lưu xuống đĩa');
    dp.xoaDuAn(b.id);
    assert.deepStrictEqual([henCua(dp, 'video').bat, henCua(dp, 'video').duAnDs], [false, []]);
    const st = dp.trangThai();
    assert.ok(Array.isArray(st.henGio) && 'lanToi' in st.henGio.find((h) => h.loai === 'nhac') && !st.henGio.some((h) => h.loai === 'anh') && typeof st.henChay === 'object');
    // Mở lại app: hẹn giữ nguyên.
    const dp2 = dungDieuPhoi({ duLieu: store.get(['duAn', 'viec', 'caiDat', 'henGio']), bayGio: () => gio }).dp;
    assert.strictEqual(henCua(dp2, 'nhac').daChay, '2026-10-18 07:00');
  });

  test('1.3.6 hẹn giờ: giao diện có trang Hẹn giờ 3 thẻ, lệnh có trong LENH, giữ máy không ngủ khi có hẹn', () => {
    const html = docNguon('src/ui/index.html'), m = docNguon('main.js'), ui = docNguon('src/ui/app.js');
    assert.ok(/data-trang="hengio"/.test(html) && /id="trang-hengio"/.test(html));
    assert.deepStrictEqual([...html.matchAll(/class="the-cai the-hen" data-loai="(\w+)"/g)].map((x) => x[1]), ['anh', 'video', 'nhac']);
    assert.ok(/datHenGio: \(\{ loai, hen \}\) => dieuPhoi\.datHenGio\(loai, hen\)/.test(m) && /dungHen: \(\{ loai, id \}\) => dieuPhoi\.dungHen\(id \|\| loai\)/.test(m) && /xoaHenGio: \(\{ id \}\) => dieuPhoi\.xoaHenGio\(id\)/.test(m));
    assert.ok(/powerSaveBlocker\.start\('prevent-app-suspension'\)/.test(m) && /powerSaveBlocker\.stop\(chanNgu\)/.test(m));
    assert.ok(/'hengio', 'nhanvat'/.test(ui) && /api\.call\('datHenGio'/.test(ui));
  });
}

console.log('\n── 1.4.0 ──────────────────────────────────────');
{
  const os = require('os');
  const DR = require('../src/main/drive');
  /** Dự án có 1 tài khoản Muse + 1 tài khoản Flow đã đăng nhập. */
  const haiBen = (o = {}) => {
    const b = dungDieuPhoi(o);
    b.tk.sua('tk-1', { trangThai: 'da-dang-nhap' }); b.tk.sua('flow-1', { trangThai: 'da-dang-nhap' });
    b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, flow: { meToiDa: 1, tabMoiTK: 1 } });
    const d = b.dp.taoDuAn('Hai ben', o.tk || ['tk-1', 'flow-1']);
    return { ...b, d };
  };

  test('1.4.0 đổi tay sang Flow: việc chờ / đã xong về hàng chờ ở Flow; nhạc và việc đã ở Flow bỏ qua; dự án thiếu tài khoản Flow → báo', () => {
    const { dp, d, tk, nhatKy } = haiBen();
    dp.them({ duAn: d.id, prompts: ['a', 'b'] });
    dp.them({ duAn: d.id, nen: 'flow', prompts: ['c'] });
    const [a, b, c] = dp.viec;
    Object.assign(b, { trangThai: 'xong', taiKhoan: 'tk-1', thread: 't/1', xongLuc: 5 });
    const r = dp.doiNenViec([a.id, b.id, c.id], 'flow', false);
    assert.deepStrictEqual([r.doi, r.daO, r.khongTk.length], [2, 1, 0]);
    for (const j of [a, b]) {
      assert.deepStrictEqual([j.nen, j.trangThai, j.thread, j.taiKhoan, j.xongLuc], ['flow', 'cho', '', '', 0]);
      assert.deepStrictEqual(j.daQuaNen, ['muse', 'flow'], 'đổi tay rồi: Muse ⇄ Flow tự động không đổi ngược');
    }
    assert.ok(nhatKy.some((x) => /🔀 Đổi tay 2 việc sang Flow: #1, #2/.test(x)), nhatKy.join('\n'));
    // Đổi ngược về Muse: đánh dấu tuFlow như khi Flow tự chuyển sang Muse.
    dp.doiNenViec([a.id], 'muse', false);
    assert.deepStrictEqual([a.nen, a.tuFlow], ['muse', true]);
    // Không có tài khoản Flow dùng được (tài khoản Flow duy nhất chưa đăng nhập).
    tk.sua('flow-1', { trangThai: 'can-dang-nhap' });
    const d2 = dp.taoDuAn('Chi Muse', ['tk-1']);
    dp.them({ duAn: d2.id, prompts: ['x'] });
    const x = dp.viec[dp.viec.length - 1];
    const r2 = dp.doiNenViec([x.id], 'flow', false);
    assert.deepStrictEqual([r2.doi, r2.khongTk, x.nen], [0, ['Chi Muse'], 'muse']);
    assert.ok(nhatKy.some((l) => /⛔ Không đổi được sang Flow: dự án "Chi Muse" chưa có tài khoản Flow/.test(l)));
    // Nhạc không đổi.
    dp.them({ duAn: d.id, loai: 'nhac', nen: 'suno', prompts: ['lofi'] });
    assert.strictEqual(dp.doiNenViec([dp.viec[dp.viec.length - 1].id], 'flow', false).nhac, 1);
  });

  testAsync('1.4.0 đổi sang Flow việc ĐANG chạy ở Muse: luồng Muse dừng trước, rồi chạy ngay ở Flow (không hai bên cùng chạy)', async () => {
    const daChay = [];
    let dungMuse = 0;
    const flowGia = luongGiaHaiNen(daChay);
    const taoLuong = (a, stt) => a.nen === 'flow' ? flowGia(a, stt) : {
      id: `${a.id}-${stt}`, ranh: true, viec: null,
      dung() { dungMuse++; if (this._xong) this._xong({ ok: false, dung: true, loi: 'Đã dừng' }); },
      chay(j) { this.ranh = false; this.viec = j; daChay.push({ tk: a.id, so: [j.so] }); return new Promise((r) => { this._xong = (k) => { this.ranh = true; this.viec = null; r(k); }; }); }
    };
    const { dp, d } = haiBen({ taoLuong });
    dp.them({ duAn: d.id, prompts: ['a'] });
    const j = dp.viec[0];
    dp.chayDuAn(d.id);
    for (let i = 0; i < 20 && j.trangThai !== 'chay'; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 10)); }
    assert.strictEqual(j.trangThai, 'chay');
    assert.strictEqual(j.taiKhoan, 'tk-1');
    const r = dp.doiNenViec([j.id], 'flow');
    assert.strictEqual(r.doi, 1);
    await chayHet(dp);
    assert.strictEqual(dungMuse >= 1, true, 'đã dừng luồng Muse');
    assert.deepStrictEqual([j.trangThai, j.nen, j.taiKhoan], ['xong', 'flow', 'flow-1']);
    assert.deepStrictEqual(daChay.map((x) => x.tk), ['tk-1', 'flow-1']);
    assert.strictEqual(j.chuyenNen, undefined);
  });

  testAsync('1.4.0 đổi sang Muse việc đang chạy trong mẻ Flow: kết quả Flow về sau bị BỎ, việc xong ở Muse', async () => {
    const daChay = [];
    let dungFlow = 0;
    const museGia = luongGia(daChay, new Set());
    const taoLuong = (a, stt) => a.nen !== 'flow' ? museGia(a, stt) : {
      id: `${a.id}-${stt}`, nen: 'flow', ranh: true, viec: null, dsViec: [], dung() { dungFlow++; },
      async chayMe(ds, ctx) {
        this.ranh = false; this.dsViec = ds; daChay.push([a.id, ds[0].so]);
        await new Promise((r) => setTimeout(r, 80));
        for (const x of ds) ctx.xong(x, { ok: true, files: [{ duongDan: '/tam/flow.png' }], flowTen: 'f' });
        this.ranh = true; this.dsViec = [];
      }
    };
    const { dp, d } = haiBen({ taoLuong });
    dp.them({ duAn: d.id, nen: 'flow', prompts: ['a'] });
    const j = dp.viec[0];
    dp.chayDuAn(d.id);
    for (let i = 0; i < 20 && j.trangThai !== 'chay'; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 10)); }
    assert.deepStrictEqual([j.trangThai, j.taiKhoan], ['chay', 'flow-1']);
    dp.doiNenViec([j.id], 'muse');
    assert.strictEqual(dungFlow, 1, 'mẻ chỉ có việc này → dừng tab');
    await chayHet(dp);
    await new Promise((r) => setTimeout(r, 120));   // mẻ Flow cũ trả kết quả muộn
    assert.deepStrictEqual([j.trangThai, j.nen, j.taiKhoan], ['xong', 'muse', 'tk-1']);
    assert.ok(!(j.files || []).some((f) => /flow\.png/.test(f)), 'không lấy file của mẻ Flow cũ');
  });

  test('1.4.0 đổi prompt hàng loạt: thay cả prompt / tìm-thay chữ, bỏ qua việc đang chạy, việc đã xong tạo lại; prompt video nối từ ảnh đổi riêng từng ảnh', () => {
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongGia([], new Set()) });
    dp.them({ prompts: ['mèo ở biển', 'chó ở biển', 'gà ở biển'], chuoiVideo: { prompt: 'zoom chậm' } });
    const [a, b, c] = dp.viec;
    c.trangThai = 'chay';
    Object.assign(b, { trangThai: 'xong', xongLuc: 9 });
    let r = dp.doiPrompt([a.id, b.id, c.id], { cach: 'tim', tim: 'biển', thay: 'núi' });
    assert.deepStrictEqual([r.doi, r.dangChay, a.prompt, b.prompt, c.prompt, b.trangThai], [2, 1, 'mèo ở núi', 'chó ở núi', 'gà ở biển', 'xong']);
    assert.ok(nhatKy.some((x) => /✏ Đã đổi prompt 2 việc \(thay "biển" → "núi"\) · bỏ qua 1 việc đang chạy/.test(x)), nhatKy.join('\n'));
    r = dp.doiPrompt([b.id], { cach: 'thay', moi: '  chó trên tàu ', taoLai: true });
    assert.deepStrictEqual([r.doi, r.taoLai, b.prompt, b.trangThai, b.xongLuc], [1, 1, 'chó trên tàu', 'cho', 0]);
    dp.dungTatCa();
    assert.strictEqual(dp.doiPrompt([a.id], { cach: 'thay', moi: ' ' }).ok, false);
    assert.strictEqual(dp.doiPrompt([a.id], { cach: 'tim', tim: '' }).ok, false);
    // Prompt video nối từ ảnh: các ảnh thêm cùng lượt dùng chung một đối tượng chuoi — đổi ảnh a không đổi ảnh b.
    assert.deepStrictEqual(a.chuoi, b.chuoi);
    r = dp.doiPrompt([a.id], { cach: 'thay', dich: 'chuoi', moi: 'xoay quanh' });
    assert.deepStrictEqual([r.doi, a.chuoi.prompt, b.chuoi.prompt, a.prompt], [1, 'xoay quanh', 'zoom chậm', 'mèo ở núi']);
    dp.them({ loai: 'video', prompts: ['v'] });
    assert.strictEqual(dp.doiPrompt([dp.viec[3].id], { dich: 'chuoi', moi: 'x' }).khongDoi, 1, 'video không có prompt nối');
  });

  test('1.4.0 "Chạy lại ngay" tài khoản đang nghỉ vì lỗi: xoá mốc nghỉ / chặn video / đếm lỗi, máy Flow chạy lại, dự án tự tạm dừng chạy tiếp', () => {
    const goiFlow = [];
    const { dp, tk, d, nhatKy } = haiBen({ taoLuong: luongGia([], new Set()), chayLaiFlow: (id) => goiFlow.push(id) });
    dp.them({ duAn: d.id, prompts: ['a'] });
    const j = dp.viec[0];
    j.tkLoi = ['tk-1', 'x'];
    const muon = Date.now() + 3600e3;
    Object.assign(dp, { nghiDen: { 'tk-1': muon }, lyDoNghi: { 'tk-1': 'lỗi 2 việc liên tiếp' }, loiLienTiep: { 'tk-1': 2 }, nghiLoai: { 'tk-1:video': muon, 'tk-2:video': muon } });
    dp.ketQuaTk['tk-1'] = { ok: false, loi: 'hỏng', luc: 1 };
    tk.sua('tk-1', { chanVideoDen: muon });
    assert.strictEqual(dp.sucKhoeTk()['tk-1'].muc, 'loi');
    const r = dp.chayLaiTaiKhoan('tk-1');
    assert.deepStrictEqual(r, { ok: true, tiep: 0 });
    assert.deepStrictEqual([dp.nghiDen['tk-1'], dp.lyDoNghi['tk-1'], !!dp.loiLienTiep['tk-1'], dp.ketQuaTk['tk-1']], [undefined, undefined, false, undefined]);
    assert.deepStrictEqual(Object.keys(dp.nghiLoai), ['tk-2:video'], 'chỉ xoá chặn của đúng tài khoản');
    assert.strictEqual(tk.tim('tk-1').chanVideoDen, 0);
    assert.deepStrictEqual(j.tkLoi, ['x']);
    assert.deepStrictEqual(goiFlow, ['tk-1']);
    assert.strictEqual(dp.sucKhoeTk()['tk-1'].muc !== 'loi', true);
    // Dự án đã tự tạm dừng vì hết tài khoản → bấm Chạy lại tài khoản thì dự án chạy tiếp.
    dp.duAnTamDung.add(d.id);
    assert.deepStrictEqual(dp.chayLaiTaiKhoan('tk-1'), { ok: true, tiep: 1 });
    assert.ok(dp.duAnChay.has(d.id) && !dp.duAnTamDung.has(d.id));
    assert.ok(nhatKy.some((x) => /▶ "Muse 1": đã bỏ trạng thái nghỉ \/ lỗi .*chạy tiếp dự án "Hai ben"/.test(x)), nhatKy.join('\n'));
    dp.dungTatCa();
    assert.strictEqual(dp.chayLaiTaiKhoan('khong-co').ok, false);
  });

  test('1.4.0 đồng hồ dự án: đếm giờ khi chạy, máy treo không cộng cả quãng, dừng giữ tổng; lượt mới đếm lại từ 0', () => {
    let gio = 1_000_000;
    const { dp } = dungDieuPhoi({ bayGio: () => gio });
    dp.them({ prompts: ['a', 'b'] });
    dp.duAnChay.add('mac-dinh');
    dp._demGio();
    let g = dp.dongHo()['mac-dinh'];
    assert.deepStrictEqual([g.dangChay, g.daChay, g.batDau], [true, 0, gio]);
    gio += 1000; dp._demGio();
    gio += 1000; dp._demGio();
    gio += 600000; dp._demGio();     // máy ngủ 10 phút: chỉ cộng tối đa 5 s
    g = dp.dongHo()['mac-dinh'];
    assert.deepStrictEqual([g.daChay, g.tong], [7000, 7000]);
    assert.ok(g.conLai > 0 && g.soCon === 2);
    dp.duAnChay.delete('mac-dinh');
    gio += 1000; dp._demGio();
    g = dp.dongHo()['mac-dinh'];
    assert.deepStrictEqual([g.dangChay, g.daChay, g.xongLuc], [false, 7000, gio]);
    dp.duAnChay.add('mac-dinh');
    gio += 1000; dp._demGio();
    gio += 1000; dp._demGio();
    g = dp.dongHo()['mac-dinh'];
    assert.deepStrictEqual([g.dangChay, g.daChay, g.tong], [true, 1000, 8000], 'lượt mới từ 0, tổng cộng dồn');
    assert.ok(dp.trangThai().dongHo['mac-dinh'] && typeof dp.trangThai().luc === 'number');
  });

  test('1.4.0 dự đoán thời gian còn lại: chưa có việc xong → theo trung bình mặc định ÷ số chạy cùng lúc; đã chạy ≥1 phút → theo tốc độ thật', () => {
    const t = 10_000_000;
    const cho = (n, x = {}) => Array.from({ length: n }, () => ({ loai: 'anh', trangThai: 'cho', ...x }));
    assert.deepStrictEqual(HD.duDoanConLai(cho(3), t), { conLai: 105000, soCon: 3 });
    assert.deepStrictEqual(HD.duDoanConLai(cho(3), t, { songSong: 3 }), { conLai: 35000, soCon: 3 });
    assert.deepStrictEqual(HD.duDoanConLai(cho(1, { chuoi: { prompt: 'v' } }), t), { conLai: 35000 + 80000, soCon: 2 }, 'ảnh còn nối video');
    assert.deepStrictEqual(HD.duDoanConLai([{ loai: 'anh', trangThai: 'xong' }], t), { conLai: 0, soCon: 0 });
    // Lượt này: 2 ảnh xong, mỗi ảnh 20 s, nhưng đã chạy 80 s → tốc độ thật chậm gấp đôi.
    const xong = [0, 1].map((i) => ({ loai: 'anh', trangThai: 'xong', batDauLuc: t - 50000 - i, xongLuc: t - 30000 - i }));
    assert.deepStrictEqual(HD.duDoanConLai([...xong, ...cho(3)], t, { batDauLuot: t - 80000, daChayMs: 80000, songSong: 1 }), { conLai: 120000, soCon: 3 });
    // Việc đang chạy: phần còn thiếu.
    assert.deepStrictEqual(HD.duDoanConLai([{ loai: 'anh', trangThai: 'chay', batDauLuc: t - 20000 }], t), { conLai: 15000, soCon: 1 });
  });

  testAsync('1.4.0 Google Drive: chép vào <Drive>/<Tên dự án>/images|Videos, trùng tên thêm (2), đưa lại thì ghi đè đúng file của việc, thiếu thư mục Drive → báo', async () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'));
    const nguon = fs.mkdtempSync(path.join(os.tmpdir(), 'nguon-'));
    try {
      const f = path.join(nguon, '001.png'); fs.writeFileSync(f, 'anh1');
      const v = path.join(nguon, '001.mp4'); fs.writeFileSync(v, 'video');
      assert.strictEqual(DR.tenThuMucDuAn('Tập 1: Biển?'), 'Tập 1 Biển');
      assert.strictEqual(DR.tenThuMucDuAn('con'), 'con_');
      let r = await DR.chepLenDrive({ goc, tenDuAn: 'Tập 1: Biển?', loai: 'anh', files: [f] });
      const d1 = path.join(goc, 'Tập 1 Biển', 'images', '001.png');
      assert.deepStrictEqual([r.ok, r.files], [true, [d1]]);
      assert.strictEqual(fs.readFileSync(d1, 'utf8'), 'anh1');
      r = await DR.chepLenDrive({ goc, tenDuAn: 'Tập 1: Biển?', loai: 'anh', files: [f] });
      assert.deepStrictEqual(r.files, [path.join(goc, 'Tập 1 Biển', 'images', '001 (2).png')], 'việc khác cùng tên: không ghi đè');
      fs.writeFileSync(f, 'anh1 tao lai');
      r = await DR.chepLenDrive({ goc, tenDuAn: 'Tập 1: Biển?', loai: 'anh', files: [f], cu: [d1] });
      assert.deepStrictEqual(r.files, [d1]);
      assert.strictEqual(fs.readFileSync(d1, 'utf8'), 'anh1 tao lai', 'Tạo lại: ghi đè file Drive của chính việc đó');
      r = await DR.chepLenDrive({ goc, tenDuAn: 'Tập 1: Biển?', loai: 'video', files: [v] });
      assert.deepStrictEqual(r.files, [path.join(goc, 'Tập 1 Biển', 'Videos', '001.mp4')]);
      assert.strictEqual((await DR.chepLenDrive({ goc: path.join(goc, 'khong-co'), tenDuAn: 'x', loai: 'anh', files: [f] })).ok, false);
      assert.match((await DR.chepLenDrive({ goc: '', tenDuAn: 'x', loai: 'anh', files: [f] })).loi, /Chưa chọn thư mục Google Drive/);
      assert.strictEqual((await DR.chepLenDrive({ goc, tenDuAn: 'x', loai: 'nhac', files: [f] })).ok, false);
    } finally { fs.rmSync(goc, { recursive: true, force: true }); fs.rmSync(nguon, { recursive: true, force: true }); }
    // Tìm thư mục Drive (Google Drive cho máy tính).
    const fsx = (co) => ({ statSync: (p) => { if (!co.includes(p)) throw new Error('ENOENT'); return { isDirectory: () => true }; }, readdirSync: () => ['GoogleDrive-a@b'] });
    assert.deepStrictEqual(DR.timThuMucDrive({ platform: 'win32', home: 'C:\\Users\\A', fsx: fsx(['G:\\My Drive', 'G:\\Drive của tôi']) }), ['G:\\My Drive', 'G:\\Drive của tôi']);
    const mac = path.join('/Users/a', 'Library', 'CloudStorage', 'GoogleDrive-a@b', 'My Drive');
    assert.deepStrictEqual(DR.timThuMucDrive({ platform: 'darwin', home: '/Users/a', fsx: fsx([mac]) }), [mac]);
  });

  testAsync('1.4.0 việc xong → tự đưa lên Drive (khi bật); tắt thì không; nhạc không; lỗi Drive chỉ ghi nhật ký, việc vẫn Xong; "Lên Drive" tay', async () => {
    const goi = [];
    let traLoi = { ok: true };
    const lenDrive = async (x) => { goi.push(x); return traLoi.ok ? { ok: true, files: x.files.map((f) => `/G/${x.tenDuAn}/${DR.THU_MUC_LOAI[x.loai]}/${path.basename(f)}`) } : traLoi; };
    const { dp, nhatKy } = dungDieuPhoi({ lenDrive });
    dp.them({ prompts: ['a', 'b'] });
    dp.them({ loai: 'video', prompts: ['v'] });
    const [a, b, v] = dp.viec;
    dp._ketThuc(a, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.strictEqual(goi.length, 0, 'mặc định tắt');
    dp.datCaiDat({ driveBat: true, thuMucDrive: '/G' });
    dp._ketThuc(b, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
    dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.deepStrictEqual(goi.map((x) => [x.goc, x.tenDuAn, x.loai]), [['/G', 'Mặc định', 'anh'], ['/G', 'Mặc định', 'video']]);
    assert.deepStrictEqual(b.drive, ['/G/Mặc định/images/002.png']);
    assert.ok(nhatKy.some((x) => /☁ #2 đã đưa lên Google Drive/.test(x)));
    // Lỗi: việc vẫn Xong, báo một lần.
    traLoi = { ok: false, loi: 'Không thấy thư mục Google Drive' };
    assert.deepStrictEqual(dp.lenDriveViec([a.id, b.id]), { ok: true, so: 2, boQua: 0 });
    await dp._driveCho;
    assert.deepStrictEqual([a.trangThai, a.driveLoi], ['xong', 'Không thấy thư mục Google Drive']);
    assert.strictEqual(nhatKy.filter((x) => /chưa đưa lên Google Drive: Không thấy/.test(x)).length, 1, 'cùng lỗi không tràn nhật ký');
    assert.deepStrictEqual(goi[goi.length - 1].cu, ['/G/Mặc định/images/002.png'], 'đưa lại: báo file cũ để ghi đè');
    dp.datCaiDat({ thuMucDrive: '' });
    assert.strictEqual(dp.lenDriveViec([a.id]).ok, false);
    dp.datCaiDat({ thuMucDrive: '/G' });
    dp.them({ loai: 'nhac', nen: 'suno', prompts: ['lofi'] });
    const n = dp.viec[dp.viec.length - 1];
    const truoc = goi.length;
    dp._ketThuc(n, { ok: true, files: [{ mime: 'audio/mpeg', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.strictEqual(goi.length, truoc, 'nhạc không lên Drive');
  });

  testAsync('1.4.0 Drive cách 2 "tải thẳng lên drive.google.com": dùng tài khoản nền Drive; thiếu / sai tài khoản → báo, không tải', async () => {
    const goiWeb = [], goiMay = [];
    const { dp, tk, nhatKy } = dungDieuPhoi({ lenDrive: async (x) => { goiMay.push(x); return { ok: true, files: ['/G/x'] }; },
      lenDriveWeb: async (x) => { goiWeb.push(x); return { ok: true, files: x.files.map((f) => `Drive: ${x.tenDuAn}/${DR.THU_MUC_LOAI[x.loai]}/${path.basename(f)}`) }; } });
    const dr = tk.them('Drive chính', 'drive');
    assert.deepStrictEqual([dr.nen, dr.partition], ['drive', `persist:drive-${dr.id}`]);
    dp.datCaiDat({ driveBat: true, driveCach: 'web', driveTk: '' });
    dp.them({ prompts: ['a', 'b'] });
    const [a, b] = dp.viec;
    dp._ketThuc(a, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.strictEqual(goiWeb.length, 0);
    assert.match(a.driveLoi, /Chưa chọn tài khoản Google Drive/);
    assert.ok(nhatKy.some((x) => /☁ #1 chưa đưa lên Google Drive: Chưa chọn tài khoản Google Drive/.test(x)));
    dp.datCaiDat({ driveTk: 'tk-1' });     // tài khoản Muse không dùng để tải lên Drive
    assert.match(dp.lenDriveViec([a.id]).loi, /Chưa chọn tài khoản Google Drive/);
    dp.datCaiDat({ driveTk: dr.id });
    dp._ketThuc(b, { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.deepStrictEqual(goiWeb.map((x) => [x.tkId, x.tenDuAn, x.loai]), [[dr.id, 'Mặc định', 'anh']]);
    assert.deepStrictEqual(b.drive, ['Drive: Mặc định/images/002.png']);
    assert.strictEqual(goiMay.length, 0, 'cách web không chép vào thư mục máy');
    assert.deepStrictEqual(dp.lenDriveViec([a.id, b.id]), { ok: true, so: 2, boQua: 0 });
    await dp._driveCho;
    assert.deepStrictEqual(goiWeb[goiWeb.length - 1].cu, ['Drive: Mặc định/images/002.png'], 'đưa lại: báo bản cũ để Thay thế');
    // Tài khoản Drive không bao giờ nhận việc tạo.
    assert.ok(!dp._dsTkGoc('mac-dinh', 'muse').includes(dr.id) && !dp._dsTkGoc('mac-dinh', 'flow').includes(dr.id));
    assert.deepStrictEqual([dp.caiDat.driveCach, chuanCach(dp, 'xyz')], ['web', 'may']);
  });
  const chuanCach = (dp, v) => { dp.datCaiDat({ driveCach: v }); return dp.caiDat.driveCach; };

  testAsync('1.4.1 nhiều dự án: tắt tải về → thư mục tạm RIÊNG từng dự án (không " (2)"); thư mục máy trùng tên → Drive vẫn đúng tên theo mẫu', async () => {
    const coSan = new Set(), goi = [];
    const { dp } = dungDieuPhoi({
      tonTai: (p) => coSan.has(p), ghiFile: (p) => coSan.add(p), chuyenFile: (a, p) => coSan.add(p),
      lenDrive: async (x) => { goi.push(x); return { ok: true, files: x.ten.map((t) => `/G/${x.tenDuAn}/${DR.THU_MUC_LOAI[x.loai]}/${t}`) }; }
    });
    const A = dp.taoDuAn('Tập A'), B = dp.taoDuAn('Tập B');
    for (const d of [A, B]) dp.datCaiDat({ taiAnh: false, taiVideo: false, driveBat: true, thuMucDrive: '/G' }, d.id);
    dp.them({ duAn: A.id, prompts: ['a1'] });
    dp.them({ duAn: B.id, prompts: ['b1'] });
    const [a, b] = dp.viec.filter((j) => j.duAn === A.id || j.duAn === B.id);
    dp._ketThuc(a, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
    dp._ketThuc(b, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.deepStrictEqual([a.files[0], b.files[0]], [path.join('/tam', A.id, '001.jpg'), path.join('/tam', B.id, '001.jpg')], 'mỗi dự án một thư mục tạm');
    assert.deepStrictEqual(goi.map((x) => [x.tenDuAn, x.ten]), [['Tập A', ['001.jpg']], ['Tập B', ['001.jpg']]]);
    // Bật tải về, HAI dự án dùng CHUNG một thư mục máy → trên máy thành "001 (2).jpg", Drive vẫn "001.jpg".
    for (const d of [A, B]) dp.datCaiDat({ taiAnh: true, taiVideo: true, thuMucAnh: '/chung', thuMucVideo: '/chung', videoCanhAnh: true }, d.id);
    dp.them({ duAn: A.id, prompts: ['a2'] });
    dp.them({ duAn: B.id, prompts: ['b2'] });
    const [a2, b2] = dp.viec.filter((j) => (j.duAn === A.id || j.duAn === B.id) && j.trangThai === 'cho');
    dp._ketThuc(a2, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
    dp._ketThuc(b2, { ok: true, files: [{ mime: 'image/jpeg', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.deepStrictEqual([a2.files[0], b2.files[0]], [path.join('/chung', '001.jpg'), path.join('/chung', '001 (2).jpg')], 'máy: không ghi đè, thêm (2) như cũ');
    assert.deepStrictEqual(b2.tenDrive, ['001.jpg']);
    assert.deepStrictEqual(goi[goi.length - 1].ten, ['001.jpg'], 'Drive: tên đúng theo mẫu, không mang (2)');
    // Video nối từ ảnh "001 (2).jpg" (mẫu {tenAnh}) → trên Drive "001.mp4" theo tên Drive của ảnh.
    dp.them({ duAn: B.id, loai: 'video', prompts: ['v'], thamChieu: [b2.files[0]] });
    const v = dp.viec[dp.viec.length - 1];
    v.tuAnh = b2.id;
    dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
    await dp._driveCho;
    assert.deepStrictEqual([v.files[0], v.tenDrive], [path.join('/chung', '001 (2).mp4'), ['001.mp4']]);
    assert.deepStrictEqual(goi[goi.length - 1].ten, ['001.mp4']);
    // Việc cũ (bản 1.4.0, chưa có tenDrive) → tên file như trước.
    delete a.tenDrive;
    dp.lenDriveViec([a.id]);
    await dp._driveCho;
    assert.deepStrictEqual(goi[goi.length - 1].ten, ['001.jpg']);
    // drive.js chép theo tên đưa vào.
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-ten-'));
    try {
      const f = path.join(goc, '001 (2).jpg');
      fs.writeFileSync(f, 'x');
      const r = await DR.chepLenDrive({ goc, tenDuAn: 'Tập B', loai: 'anh', files: [f], ten: ['001.jpg'] });
      assert.deepStrictEqual(r.files, [path.join(goc, 'Tập B', 'images', '001.jpg')]);
    } finally { fs.rmSync(goc, { recursive: true, force: true }); }
  });

  test('1.4.2 quét thư mục: khớp tên theo mẫu ({stt}, {duAn}/{duAn}_{so}, {ngay}, " (2)", "_2", mọi đuôi cùng loại)', () => {
    const d = { ten: 'Mặc định' };
    const k = (mau, loai, f, j = {}) => HD.mauKhopFile(d, { stt: 253, so: 253, prompt: 'mèo', loai, ...j }, loai, mau).test(f);
    assert.ok(k('{stt}', 'anh', '253.jpg') && k('{stt}', 'anh', '253.PNG') && k('{stt}', 'anh', '253 (2).webp') && k('{stt}', 'anh', '253_2.png'));
    assert.ok(!k('{stt}', 'anh', '1253.jpg') && !k('{stt}', 'anh', '253.mp4') && !k('{stt}', 'anh', '254.jpg'));
    assert.ok(k('', 'video', 'Mac_dinh/Mac_dinh_253.mp4') && !k('', 'video', 'Mac_dinh_253.mp4'));
    assert.ok(k('{ngay}_{stt}', 'anh', '2026-01-02_253.jpg'));
    assert.ok(k('{tenAnh}', 'video', '253 (2).mp4', { thamChieu: ['C:\\ra\\253 (2).jpg'] }));
  });

  test('1.4.2 "Bỏ qua số đã có file trong thư mục": chỉ làm số còn thiếu + số chưa làm; việc đang chờ không thêm trùng; tắt thì như cũ', () => {
    const ra = path.join('/ra');
    const { dp, nhatKy } = dungDieuPhoi({ dsFile: (g) => (g === ra ? ['001.jpg', '002.png', '004 (2).jpg', 'ghi-chu.txt', 'con/003.jpg'] : []) });
    dp.datCaiDat({ thuMucAnh: ra }, 'mac-dinh');
    const prompts = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts });
    assert.deepStrictEqual([q.coSan, q.thieu, q.dangCho, q.thuMuc], [[1, 2, 4], [3, 5], [], ra]);
    let r = dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts, boQuaDaCo: true });
    assert.deepStrictEqual([r.ok, r.so, r.boQua], [true, 2, 3]);
    assert.deepStrictEqual(dp.viec.map((j) => [j.stt, j.prompt]), [[3, 'p3'], [5, 'p5']]);
    assert.ok(nhatKy.some((x) => /🔎 Quét thư mục .*đã có 3 → bỏ qua \(số 1[-–]2, 4\); làm 2 số còn thiếu/.test(x)), nhatKy.join('\n'));
    // Quét lại: 3, 5 đang chờ → không còn gì để làm, không thêm trùng.
    r = dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts, boQuaDaCo: true });
    assert.strictEqual(r.ok, false);
    assert.match(r.loi, /đã có ảnh trong thư mục hoặc đang chờ/);
    assert.strictEqual(dp.viec.length, 2);
    // "Chỉ chạy prompt số" vẫn áp trước khi quét.
    const q45 = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts, chonSo: '4-5' });
    assert.deepStrictEqual([q45.ok, q45.thuMuc, q45.coSan, q45.dangCho, q45.thieu, q45.chiVideo], [true, ra, [4], [5], [], []]);
    // Tắt (mặc định) → thêm đủ như cũ.
    r = dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts });
    assert.deepStrictEqual([r.so, r.boQua], [5, 0]);
    // Cài đặt dự án nhớ công tắc; lệnh không gửi kèm thì theo cài đặt.
    assert.strictEqual(dp.cd('mac-dinh').boQuaDaCo, false);
    dp.datCaiDat({ boQuaDaCo: true }, 'mac-dinh');
    dp.viec = [];
    assert.strictEqual(dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts }).so, 2);
  });

  test('1.4.2 quét thư mục: video (mẫu mặc định), việc đã xong còn file, tắt tải về → quét thư mục tạm của dự án', () => {
    const coFile = new Set([path.join('/vid', 'khac', 'x.mp4'), '/ngoai/y.mp4']);
    const { dp } = dungDieuPhoi({ tonTai: (p) => coFile.has(p),
      dsFile: (g) => ({ '/vid': ['Mac_dinh/Mac_dinh_001.mp4'], [path.join('/tam', 'mac-dinh')]: ['002.png'] }[g] || []) });
    dp.datCaiDat({ thuMucVideo: '/vid' }, 'mac-dinh');
    let q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'video', prompts: ['a', 'b', 'c'] });
    assert.deepStrictEqual([q.coSan, q.thieu], [[1], [2, 3]]);
    // Việc video #3 đã xong, file còn trong thư mục quét (tên khác — mẫu tên đã đổi) → coi là đã có.
    dp.them({ duAn: 'mac-dinh', loai: 'video', prompts: ['a', 'b', 'c'], chonSo: '3' });
    Object.assign(dp.viec[0], { trangThai: 'xong', files: [path.join('/vid', 'khac', 'x.mp4')] });
    q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'video', prompts: ['a', 'b', 'c'] });
    assert.deepStrictEqual([q.coSan, q.thieu], [[1, 3], [2]]);
    // 1.4.3: file của việc đã xong nằm NGOÀI thư mục quét → không tính (thư mục quét là chuẩn).
    dp.viec[0].files = ['/ngoai/y.mp4'];
    assert.deepStrictEqual(dp.quetDaCo({ duAn: 'mac-dinh', loai: 'video', prompts: ['a', 'b', 'c'] }).thieu, [2, 3]);
    dp.viec[0].files = [path.join('/vid', 'khac', 'x.mp4')];
    coFile.clear();   // file đã bị xoá → làm lại
    assert.deepStrictEqual(dp.quetDaCo({ duAn: 'mac-dinh', loai: 'video', prompts: ['a', 'b', 'c'] }).thieu, [2, 3]);
    dp.datCaiDat({ taiAnh: false }, 'mac-dinh');
    q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts: ['a', 'b'] });
    assert.deepStrictEqual([q.thuMuc, q.coSan, q.thieu], [path.join('/tam', 'mac-dinh'), [2], [1]]);
  });

  test('1.4.3 "Quét thư mục" chọn thư mục: quét đúng thư mục đó theo SỐ trong tên file (không cần khớp mẫu), file mới lưu vào đó', () => {
    const chon = path.join('/may', 'lam-do');
    const { dp, nhatKy } = dungDieuPhoi({ dsFile: (g) => (path.resolve(g) === path.resolve(chon)
      ? ['1.jpg', '0002.png', 'anh_4.jpg', '6 (2).jpg', '7_2.webp', 'ghi-chu.txt', '8.mp4', 'con/3.jpg'] : []) });
    dp.datCaiDat({ thuMucAnh: '/ra', tenAnh: '{duAn}/{stt}' }, 'mac-dinh');
    // Chưa chọn: quét thư mục lưu (/ra, trống).
    const prompts = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
    assert.deepStrictEqual(dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts }).thieu, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.ok(dp.datThuMucQuet('mac-dinh', 'anh', chon).ok);
    const d = dp.duAn.find((x) => x.id === 'mac-dinh');
    assert.deepStrictEqual([d.thuMucQuet, dp.cd('mac-dinh').thuMucAnh, dp.cd('mac-dinh').boQuaDaCo], [{ anh: chon }, chon, true]);
    // File có sẵn tên chỉ là số → mẫu "{duAn}/{stt}" đổi thành "{stt}": file mới nằm cùng chỗ, cùng kiểu tên.
    assert.strictEqual(dp.cd('mac-dinh').tenAnh, '{stt}');
    assert.ok(nhatKy.some((x) => /Mẫu tên ảnh đổi từ "\{duAn\}\/\{stt\}" thành "\{stt\}"/.test(x)), nhatKy.join('\n'));
    assert.ok(nhatKy.some((x) => /🔎 .*quét ảnh ở thư mục/.test(x)));
    // Không có prompt → tóm tắt thư mục: số có file (chỉ file ảnh, không xét thư mục con), số bị sót.
    let q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts: [] });
    assert.deepStrictEqual([q.ok, q.thuMuc, q.chon, q.soCo, q.lo, q.coSan], [true, chon, true, [1, 2, 4, 6, 7], [3, 5], []]);
    assert.strictEqual(q.viDu, path.join(chon, '008.png'));
    q = dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts });
    assert.deepStrictEqual([q.coSan, q.thieu], [[1, 2, 4, 6, 7], [3, 5, 8, 9]]);
    const r = dp.them({ duAn: 'mac-dinh', loai: 'anh', prompts });
    assert.deepStrictEqual([r.so, r.boQua, dp.viec.map((j) => j.stt)], [4, 5, [3, 5, 8, 9]]);
    // Video: thư mục video chưa chọn → quét thư mục video, không lẫn file ảnh.
    assert.deepStrictEqual(dp.quetDaCo({ duAn: 'mac-dinh', loai: 'video', prompts: [] }).thuMuc, dp.thuMucRa('video', 'mac-dinh'));
    // Đổi thư mục lưu ảnh ở chỗ khác → thôi quét thư mục đã chọn.
    dp.datCaiDat({ thuMucAnh: '/khac' }, 'mac-dinh');
    assert.strictEqual(d.thuMucQuet, undefined);
    assert.strictEqual(dp.quetDaCo({ duAn: 'mac-dinh', loai: 'anh', prompts: [] }).thuMuc, '/khac');
    // Số trong tên file.
    assert.deepStrictEqual(['253', '0253', '253 (2)', '253_2', 'anh_253', 'Tap_1_253', 'abc'].map(HD.soTuTen), [253, 253, 253, 253, 253, 253, 0]);
  });

  test('1.4.2 quét thư mục + "Ảnh xong → tự tạo video": ảnh có mà thiếu video → chỉ tạo video từ ảnh đó, video lưu cạnh ảnh', () => {
    const ghi = [];
    const { dp } = dungDieuPhoi({ ghiFile: (p) => ghi.push(p), dsFile: (g) => (path.resolve(g) === path.resolve('/ra') ? ['001.jpg', '001.mp4', '002.jpg'] : []) });
    dp.datCaiDat({ thuMucAnh: '/ra', videoCanhAnh: true }, 'mac-dinh');
    const p = { duAn: 'mac-dinh', loai: 'anh', nen: 'flow', prompts: ['a1', 'a2', 'a3'], chuoiVideo: { prompt: 'chạy', nen: 'muse' }, boQuaDaCo: true };
    const q = dp.quetDaCo(p);
    assert.deepStrictEqual([q.coSan, q.thieu, q.chiVideo], [[1], [3], [{ stt: 2, anh: path.join('/ra', '002.jpg') }]]);
    const r = dp.them(p);
    assert.deepStrictEqual([r.so, r.boQua], [2, 1]);
    const [v, a] = dp.viec;
    assert.deepStrictEqual([v.loai, v.nen, v.stt, v.so, v.prompt, v.thamChieu, v.anhCoSan], ['video', 'muse', 2, 2, 'chạy', [path.join('/ra', '002.jpg')], true]);
    assert.deepStrictEqual([a.loai, a.nen, a.stt, !!a.chuoi], ['anh', 'flow', 3, true]);
    dp._ketThuc(v, { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
    assert.deepStrictEqual(ghi, [path.join('/ra', '002.mp4')], 'video lưu cạnh ảnh, cùng tên ảnh');
  });

  test('1.4.2 giao diện: công tắc "Bỏ qua số đã có file" + Quét thư mục; thẻ "Lưu ảnh & video"; nhãn áp dụng cạnh MỌI cài đặt', () => {
    const html = docNguon('src/ui/index.html'), ui = docNguon('src/ui/app.js'), m = docNguon('main.js');
    for (const id of ['boQuaDaCo', 'nutQuet', 'ghiQuet', 'ncApDung']) {
      assert.ok(new RegExp(`id="${id}"`).test(html), id);
    }
    assert.ok(/quetDaCo: \(p\) => dieuPhoi\.quetDaCo\(p\)/.test(m) && /dsFile: \(goc\) =>/.test(m));
    assert.ok(/boQuaDaCo: \$\('#boQuaDaCo'\)\.checked/.test(ui) && /api\.call\('quetDaCo'/.test(ui));
    // 1.4.3: nút Quét thư mục mở hộp chọn thư mục rồi quét đúng thư mục đó; hiện thư mục đang quét + Bỏ chọn.
    assert.ok(/id="quetDang"/.test(html) && /id="boQuet"/.test(html));
    assert.ok(/api\.call\('chonThuMucQuet'/.test(ui) && /api\.call\('boThuMucQuet'/.test(ui));
    assert.ok(/chonThuMucQuet: async/.test(m) && /showOpenDialog\(win, \{ title: `Chọn thư mục đang có/.test(m) && /dieuPhoi\.datThuMucQuet\(/.test(m));
    // Mọi ô của trang Cài đặt (trừ Drive / Flow nâng cao chỉ chọn cách) có nhãn ảnh / video / nhạc / cả app ngay cạnh.
    const caiDat = html.slice(html.indexOf('id="trang-caidat"'));
    for (const id of ['cdLuong', 'cdChoAnh', 'cdChoVideo', 'cdPng', 'cdVideoCanhAnh', 'fChatAnh', 'fChatVideo', 'fModelAnh', 'fModelChinh', 'cdMauAnh', 'cdMauVideo', 'cdTatMay']) {
      const dong = caiDat.split('\n').find((l) => l.includes(`id="${id}"`)) || '';
      assert.ok(/class="ap ap-(anh|video|anh-video|nhac|tat-ca|app)"/.test(dong), `${id} có nhãn áp dụng`);
    }
    assert.ok(/id="fChatAnh"/.test(caiDat.split('\n').find((l) => l.includes('ap-anh"') && l.includes('fChatAnh')) || ''));
  });

  test('1.4.1 bật "tự đưa lên Google Drive" → tự tắt "Tải ảnh về" + "Tải video về"; bật lại tay thì giữ; cài đặt khác giữ nguyên', () => {
    const { dp, nhatKy } = dungDieuPhoi();
    const d = dp.taoDuAn('Tập C');
    dp.datCaiDat({ thuMucAnh: '/anh' }, d.id);
    assert.deepStrictEqual([dp.cd(d.id).taiAnh, dp.cd(d.id).taiVideo], [true, true]);
    dp.datCaiDat({ driveBat: true, thuMucDrive: '/G' }, d.id);
    assert.deepStrictEqual([dp.cd(d.id).taiAnh, dp.cd(d.id).taiVideo, dp.cd(d.id).thuMucAnh], [false, false, '/anh']);
    assert.ok(nhatKy.some((x) => /đã tự tắt "Tải ảnh về" và "Tải video về"/.test(x)));
    assert.deepStrictEqual([dp.caiDat.taiAnh, dp.caiDat.driveBat], [true, false], 'dự án khác / cài đặt chung không đổi');
    dp.datCaiDat({ taiAnh: true }, d.id);
    dp.datCaiDat({ driveBat: true, luongMoiTK: 3 }, d.id);   // lưu lại khi Drive vẫn bật → không tắt nữa
    assert.deepStrictEqual([dp.cd(d.id).taiAnh, dp.cd(d.id).taiVideo], [true, false]);
    dp.datCaiDat({ driveBat: true });                          // cài đặt chung cũng vậy
    assert.deepStrictEqual([dp.caiDat.taiAnh, dp.caiDat.taiVideo], [false, false]);
  });

  test('1.4.0 Drive cách 2: trang Drive (drive-trang.js) không gán innerHTML; giao diện có ô chọn cách + tài khoản, thẻ Drive ở mục Tài khoản', () => {
    const dt = docNguon('src/inject/drive-trang.js'), dw = docNguon('src/main/drive-web.js'), html = docNguon('src/ui/index.html'), ui = docNguon('src/ui/app.js'), m = docNguon('main.js');
    assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(dt), 'Trusted Types');
    assert.ok(/Page\.setInterceptFileChooserDialog/.test(dw) && /DOM\.setFileInputFiles/.test(dw) && /Input\.dispatchDragEvent/.test(dw));
    for (const id of ['cdDriveCach', 'cdDriveTk', 'cdDriveTkMoi', 'nutThemTKDrive']) assert.ok(new RegExp(`id="${id}"`).test(html), id);
    assert.ok(/<button data-v="drive"/.test(html) && /chi-drive/.test(html));
    assert.ok(/a\.nen === 'drive'\) \? a\.nen : 'muse'/.test(ui), 'tài khoản Drive không bị coi là Muse ở hộp tài khoản dự án');
    assert.ok(/const DS_NEN = \['muse', 'flow', 'suno'\];/.test(ui), 'hộp tài khoản dự án chỉ Muse / Flow / Suno');
    assert.ok(/driveCach: \$\('#cdDriveCach'\)\.value, driveTk: \$\('#cdDriveTk'\)\.value/.test(ui));
    assert.ok(/lenDriveWeb: \(x\) => lenDriveWeb\(x\)/.test(m) && /tk\.nen === 'drive'/.test(m));
  });

  test('1.4.0 giao diện + lệnh: đổi prompt, đổi Muse/Flow, Lên Drive, Chạy lại tài khoản, đồng hồ, thẻ Google Drive, chế độ nhẹ máy', () => {
    const html = docNguon('src/ui/index.html'), m = docNguon('main.js'), ui = docNguon('src/ui/app.js');
    for (const id of ['chipDongHo', 'chonDoiPrompt', 'chonSangMuse', 'chonSangFlow', 'chonDrive', 'nutChayLaiTk', 'cdNheMay', 'cdDrive', 'cdThuMucDrive', 'cdTimDrive', 'cdChonDrive']) {
      assert.ok(new RegExp(`id="${id}"`).test(html), id);
    }
    for (const l of ['doiPrompt', 'doiNenViec', 'lenDriveViec', 'chayLaiTaiKhoan', 'chayLaiMoiTaiKhoan', 'chonThuMucDrive', 'timDrive', 'datThuMucDrive']) {
      assert.ok(new RegExp(`\\n  ${l}: `).test(m), `LENH.${l}`);
      assert.ok(new RegExp(`api\\.call\\('${l}'`).test(ui), `giao diện gọi ${l}`);
    }
    assert.ok(/lenDrive: \(x\) => chepLenDrive\(x\)/.test(m) && /chayLaiFlow: \(id\) => .*mayFlow\.chayLaiNgay\(id\)/.test(m));
    assert.ok(/PRIORITY_BELOW_NORMAL/.test(m) && /nheMay !== false/.test(m), 'chế độ nhẹ máy hạ ưu tiên trang chạy nền');
    assert.ok(/chayLaiNgay/.test(docNguon('src/flow/may-flow.js')));
  });

  test('1.4.4 bớt CPU: trang chạy ngầm tắt hiệu ứng CSS động (theo "Máy mượt"), giao diện báo thưa khi không dùng app, nhật ký ghi CPU từng phần', () => {
    const m = docNguon('main.js'), html = docNguon('src/ui/index.html');
    // CSS lớp người dùng, chỉ animation (không transition), chèn lại mỗi lần trang nạp tài liệu mới, gỡ khi tắt Máy mượt.
    const css = (/const CSS_TAT_DONG = '([^']+)'/.exec(m) || [])[1] || '';
    assert.ok(/animation-duration:\.01ms!important/.test(css) && /animation-iteration-count:1!important/.test(css) && !/transition/.test(css), css);
    assert.ok(/insertCSS\(CSS_TAT_DONG, \{ cssOrigin: 'user' \}\)/.test(m) && /removeInsertedCSS\(k\)/.test(m));
    assert.ok(/on\('dom-ready', \(\) => \{ datUuTien\(w\.webContents\); cssDong\.delete\(w\.webContents\); datHieuUng\(w\.webContents\); \}\)/.test(m));
    assert.ok(/datUuTien\(w\.webContents\); datHieuUng\(w\.webContents\);/.test(m), 'bật / tắt Máy mượt áp cho trang đang mở');
    // Không ở trong app → báo 2 giây một lần; quay lại → báo ngay.
    assert.ok(/!win\.isFocused\(\) \? Math\.max\(2000, nhipBao\(\)\) : nhipBao\(\)/.test(m) && /win\.on\('focus', \(\) => baoNgay\(\)\)/.test(m));
    assert.ok(/⚙ CPU app: /.test(m) && /percentCPUUsage/.test(m) && /os\.cpus\(\)\.length/.test(m));
    assert.ok(/tắt hiệu ứng động trên các trang đó/.test(html));
  });

  test('1.4.0 cài đặt mới: Drive theo dự án, nhẹ máy là cài đặt chung (mặc định bật); mở app không giữ đồng hồ đang chạy', () => {
    const { dp } = dungDieuPhoi({ duLieu: { duAn: [{ id: 'mac-dinh', ten: 'Mặc định', taiKhoan: ['tk-1'], dongHo: { luot: 5, tong: 9, dangChay: true } }] } });
    assert.deepStrictEqual([dp.caiDat.driveBat, dp.caiDat.thuMucDrive, dp.caiDat.nheMay], [false, '', true]);
    assert.strictEqual(dp.duAn[0].dongHo.dangChay, false);
    const d = dp.taoDuAn('B');
    dp.datCaiDat({ driveBat: true, thuMucDrive: 'G:\\My Drive', nheMay: false }, d.id);
    assert.deepStrictEqual([dp.cd(d.id).driveBat, dp.cd(d.id).thuMucDrive, dp.cd('mac-dinh').driveBat], [true, 'G:\\My Drive', false]);
    assert.strictEqual(dp.caiDat.nheMay, false, 'nhẹ máy lưu vào cài đặt chung');
  });
}

// ── 1.4.9: "Tạo video từ thư mục ảnh" theo dõi thư mục ─────────────────────
{
  const os = require('os');
  const TD = require('../src/main/theo-doi-thu-muc');
  const thuMucTam = () => fs.mkdtempSync(path.join(os.tmpdir(), 'theo-doi-'));
  // Ghi ảnh với mtime đặt sẵn (giây) — đồng hồ của DieuPhoi là đồng hồ giả.
  const ghiAnh = (dir, ten, mtimeS, noiDung = 'anh') => {
    const f = path.join(dir, ten);
    fs.writeFileSync(f, noiDung);
    fs.utimesSync(f, mtimeS, mtimeS);
    return f;
  };

  test('1.4.9 theo dõi thư mục: chỉ nhận ảnh đã ghi xong (đứng yên 2 lần quét, cũ hơn 3 s), không nhận lại ảnh đã có', () => {
    const dir = thuMucTam();
    const a = ghiAnh(dir, '2.png', 1000), b = ghiAnh(dir, '10.jpg', 1000);
    ghiAnh(dir, 'ghi-chu.txt', 1000);
    const daCo = new Set([a]);
    const l1 = TD.docThuMuc(dir, daCo);
    assert.deepStrictEqual(l1.ds, [a, b], 'xếp tên tự nhiên, chỉ ảnh');
    assert.deepStrictEqual([...l1.ung.keys()], [b], 'ảnh đã nhận không stat lại');
    // Lần quét đầu: chưa có lần trước → chưa nhận.
    let r = TD.chonAnhMoi(l1.ung, new Map(), 1010 * 1000);
    assert.deepStrictEqual(r.moi, []);
    // Lần sau, đứng yên → nhận.
    r = TD.chonAnhMoi(TD.docThuMuc(dir, daCo).ung, r.truoc, 1015 * 1000);
    assert.deepStrictEqual(r.moi, [b]);
    // Ảnh đang ghi dở: size đổi giữa 2 lần quét → chưa nhận; mtime quá mới (< 3 s) → chưa nhận.
    const c = ghiAnh(dir, '11.png', 2000, 'x');
    const t1 = TD.docThuMuc(dir, new Set([a, b])).ung;
    ghiAnh(dir, '11.png', 2000, 'xxxxx');
    r = TD.chonAnhMoi(TD.docThuMuc(dir, new Set([a, b])).ung, t1, 2010 * 1000);
    assert.deepStrictEqual(r.moi, [], 'size đổi → còn đang ghi');
    r = TD.chonAnhMoi(TD.docThuMuc(dir, new Set([a, b])).ung, r.truoc, 2001 * 1000);
    assert.deepStrictEqual(r.moi, [], 'mtime mới hơn 3 s → chưa nhận');
    r = TD.chonAnhMoi(TD.docThuMuc(dir, new Set([a, b])).ung, r.truoc, 2004 * 1000);
    assert.deepStrictEqual(r.moi, [c]);
    assert.strictEqual(TD.docThuMuc(path.join(dir, 'khong-co'), new Set()), null, 'thư mục không còn → null');
    assert.strictEqual(TD.promptCho(1, 'chung', ['', '  ', 'r3']), 'chung');
    assert.strictEqual(TD.promptCho(2, 'chung', ['', '', 'r3']), 'r3');
    assert.strictEqual(TD.promptCho(5, '', null), HD.PROMPT_VIDEO_MAC_DINH);
  });

  test('1.4.9 theo dõi thư mục: ảnh mới → việc video đúng ảnh, prompt riêng theo vị trí, số tiếp nối; ảnh đã có không làm lại', () => {
    const dir = thuMucTam();
    let gio = 5000 * 1000;
    const { dp, nhatKy } = dungDieuPhoi({ bayGio: () => gio });
    const a1 = ghiAnh(dir, '1.png', 4000), a2 = ghiAnh(dir, '2.png', 4000);
    // Như lúc bấm Tạo: 2 ảnh có sẵn thành 2 video.
    dp.them({ duAn: 'mac-dinh', loai: 'video', nen: 'muse', prompts: ['r1', 'r2'], thamChieuTheoDong: [[a1], [a2]] });
    const k = dp.theoDoiThuMuc({ duAn: 'mac-dinh', thuMuc: dir, anhDaCo: [a1, a2], prompt: 'chung', prompts: ['r1', 'r2', '', 'r4'],
      thamSo: { nen: 'muse', tyLe: '16:9' }, tuChay: false });
    assert.ok(k.ok && k.theoDoi.soAnhDaCo === 2, JSON.stringify(k));
    gio += 6000; assert.strictEqual(dp.quetTheoDoi(), 0, 'không có ảnh mới');
    const a3 = ghiAnh(dir, '3.png', 5005), a4 = ghiAnh(dir, '4.png', 5005);
    gio += 5000; assert.strictEqual(dp.quetTheoDoi(), 0, 'ảnh mới mới thấy lần đầu — chờ lần sau');
    gio += 5000; assert.strictEqual(dp.quetTheoDoi(), 2);
    const moi = dp.viec.slice(2);
    assert.deepStrictEqual(moi.map((j) => [j.loai, j.nen, j.thamChieu, j.prompt, j.so, j.stt, j.tyLe]),
      [['video', 'muse', [a3], 'chung', 3, 3, '16:9'], ['video', 'muse', [a4], 'r4', 4, 4, '16:9']]);
    assert.ok(nhatKy.some((x) => /📂 Thư mục ".+": thêm 2 ảnh mới → 2 video \(#3–4\)/.test(x)), nhatKy.join('\n'));
    gio += 5000; assert.strictEqual(dp.quetTheoDoi(), 0, 'ảnh đã nhận không thêm lại');
    assert.strictEqual(dp.trangThai().duAn[0].theoDoi.soDaThem, 2);
    assert.strictEqual(dp.trangThai().duAn[0].theoDoi.daCo, undefined, 'giao diện không nhận cả danh sách ảnh');
    assert.ok(!dp.duAnChay.has('mac-dinh'), 'tuChay tắt → không tự chạy');
    // Thư mục mất rồi có lại: ghi nhật ký một lần, giữ theo dõi.
    const tam = `${dir}-doi`;
    fs.renameSync(dir, tam);
    gio += 5000; dp.quetTheoDoi(); gio += 5000; dp.quetTheoDoi();
    assert.strictEqual(nhatKy.filter((x) => /không thấy thư mục theo dõi/.test(x)).length, 1);
    assert.ok(dp.trangThai().duAn[0].theoDoi.mat);
    fs.renameSync(tam, dir);
    gio += 5000; dp.quetTheoDoi();
    assert.ok(!dp.trangThai().duAn[0].theoDoi.mat && nhatKy.some((x) => /đã có lại/.test(x)));
    assert.ok(dp.boTheoDoiThuMuc('mac-dinh').ok && !dp.duAn[0].theoDoi);
    ghiAnh(dir, '5.png', 5000);
    gio += 5000; dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(dp.quetTheoDoi(), 0, 'dừng theo dõi → không thêm');
    dp.dong();
  });

  test('1.4.10 số video + prompt theo SỐ trong tên ảnh (001, 006, 016… ảnh tạo không theo thứ tự), không theo vị trí trong thư mục', () => {
    // Hàm dùng chung (giao diện + tiến trình chính).
    assert.deepStrictEqual(HD.soTheoTenAnh(['C:\\anh\\001.jpg', '/a/016.jpg', '/a/anh_061.png']), [1, 16, 61]);
    assert.strictEqual(HD.soTheoTenAnh(['/a/001.jpg', '/a/bia.jpg']), null, 'có ảnh không mang số → ghép theo vị trí như cũ');
    assert.strictEqual(HD.soTheoTenAnh(['/a/016.jpg', '/a/16.png']), null, 'trùng số → ghép theo vị trí như cũ');
    assert.strictEqual(HD.soTheoTenAnh([]), null);
    const g = HD.ghepThuMucAnh(['/a/001.jpg', '/a/002.jpg', '/a/016.jpg', '/a/061.jpg'], (n) => `p${n}`);
    assert.deepStrictEqual([g.theoTen, g.so, g.prompts.length, g.prompts[15], g.theoDong[15], g.theoDong[2]], [true, [1, 2, 16, 61], 61, 'p16', ['/a/016.jpg'], []]);
    const v = HD.ghepThuMucAnh(['/a/bia.jpg', '/a/cuoi.jpg'], (n) => `p${n}`);
    assert.deepStrictEqual([v.theoTen, v.so, v.prompts, v.theoDong], [false, [1, 2], ['p1', 'p2'], [['/a/bia.jpg'], ['/a/cuoi.jpg']]]);

    // Tạo (như giao diện gửi): ảnh 016 → việc #16, prompt số 16 (dòng 16 của file riêng), khung đầu = 016.jpg.
    const dir = thuMucTam();
    const anh = ['001.jpg', '006.jpg', '016.jpg', '061.jpg'].map((f) => ghiAnh(dir, f, 100));
    const rieng = Array.from({ length: 61 }, (_, i) => `animation ${i + 1}`);
    const t = HD.ghepThuMucAnh(anh, (n) => rieng[n - 1]);
    const { dp } = dungDieuPhoi();
    const r = dp.them({ duAn: 'mac-dinh', loai: 'video', nen: 'muse', prompts: t.prompts, thamChieuTheoDong: t.theoDong, chonSo: t.so.join(', '), soTheoAnh: true });
    assert.ok(r.ok && r.so === 4, JSON.stringify(r));
    assert.deepStrictEqual(dp.viec.map((j) => [j.so, j.stt, j.prompt, path.basename(j.thamChieu[0])]),
      [[1, 1, 'animation 1', '001.jpg'], [6, 6, 'animation 6', '006.jpg'], [16, 16, 'animation 16', '016.jpg'], [61, 61, 'animation 61', '061.jpg']]);
    // Tên file video theo mẫu {stt} / {so} / {tenAnh} đều ra đúng số ảnh.
    const j16 = dp.viec[2];
    assert.deepStrictEqual(['{stt}', '{so}', '{tenAnh}'].map((m) => HD.tenFile(dp.duAn[0], j16, 'video/mp4', 0, m)), ['016.mp4', '016.mp4', '016.mp4']);

    // Theo dõi thư mục: ảnh 018 rồi 017 thêm vào sau (không theo thứ tự) → việc #18, #17 với prompt số 18, 17.
    let gio = 7000 * 1000;
    const b = dungDieuPhoi({ bayGio: () => gio });
    const d2 = thuMucTam();
    const c = ['001.jpg', '006.jpg'].map((f) => ghiAnh(d2, f, 100));
    b.dp.theoDoiThuMuc({ duAn: 'mac-dinh', thuMuc: d2, anhDaCo: c, prompt: 'chung', prompts: rieng.slice(0, 17), thamSo: { nen: 'muse' }, tuChay: false });
    const a18 = ghiAnh(d2, '018.jpg', 6990), a17 = ghiAnh(d2, '017.jpg', 6990);
    gio += 5000; b.dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(b.dp.quetTheoDoi(), 2);
    assert.deepStrictEqual(b.dp.viec.map((j) => [j.so, j.stt, j.prompt, j.thamChieu[0]]).sort((x, y) => x[0] - y[0]),
      [[17, 17, 'animation 17', a17], [18, 18, 'chung', a18]], 'dòng 18 không có trong file riêng → prompt dùng chung');
    b.dp.dong();
  });

  test('1.4.9 theo dõi thư mục: Tạo & chạy → ảnh mới tự chạy lại dự án đã hết hàng chờ; Dừng → chỉ thêm việc; mở lại app vẫn theo dõi', () => {
    const dir = thuMucTam();
    let gio = 9000 * 1000;
    const tao = () => ({ ranh: true, dung() {}, chay: () => new Promise(() => {}) });
    const { dp, store, nhatKy } = dungDieuPhoi({ bayGio: () => gio, taoLuong: tao });
    const a1 = ghiAnh(dir, 'a1.png', 8000);
    dp.theoDoiThuMuc({ duAn: 'mac-dinh', thuMuc: dir, prompt: 'p', thamSo: { nen: 'muse' }, tuChay: true });
    assert.deepStrictEqual(dp.duAn[0].theoDoi.daCo, [a1], 'không gửi anhDaCo → mọi ảnh đang có');
    ghiAnh(dir, 'a2.png', 9000);
    gio += 5000; dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(dp.quetTheoDoi(), 1);
    assert.ok(dp.duAnChay.has('mac-dinh'), 'tuChay → tự chạy dự án');
    assert.ok(nhatKy.some((x) => /tự chạy lại dự án/.test(x)));
    // Hết hàng chờ (như _xetXong) rồi ảnh mới → chạy lại.
    for (const j of dp.viec) Object.assign(j, { trangThai: 'xong' });
    dp.duAnChay.delete('mac-dinh');
    ghiAnh(dir, 'a3.png', 9005);
    gio += 5000; dp.quetTheoDoi(); gio += 5000; dp.quetTheoDoi();
    assert.ok(dp.duAnChay.has('mac-dinh'), 'dự án đã chạy hết hàng chờ → ảnh mới chạy lại');
    assert.ok(dp.coTheoDoiTuChay());
    // Dừng dự án → ảnh mới vẫn thành việc nhưng không tự chạy.
    dp.dungDuAn('mac-dinh');
    assert.strictEqual(dp.duAn[0].theoDoi.tuChay, false);
    assert.ok(!dp.coTheoDoiTuChay());
    for (const j of dp.viec) Object.assign(j, { trangThai: 'xong' });
    ghiAnh(dir, 'a4.png', 9020);
    gio += 5000; dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(dp.quetTheoDoi(), 1);
    assert.ok(!dp.duAnChay.has('mac-dinh'), 'đã Dừng → không tự chạy');
    // Bấm Chạy (kể cả khi không còn việc chờ) → ảnh mới lại tự chạy.
    dp.chayDuAn('mac-dinh');
    assert.strictEqual(dp.duAn[0].theoDoi.tuChay, true);
    dp.dong();
    // Mở lại app (DieuPhoi mới, cùng dữ liệu): vẫn theo dõi, ảnh đã nhận không làm lại, ảnh mới vẫn nhận.
    const b = dungDieuPhoi({ duLieu: store.data, bayGio: () => gio, taoLuong: tao });
    assert.ok(b.dp.duAn[0].theoDoi && b.dp.duAn[0].theoDoi.daCo.length === 4);
    gio += 5000; b.dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(b.dp.quetTheoDoi(), 0);
    ghiAnh(dir, 'a5.png', 9030);
    gio += 5000; b.dp.quetTheoDoi(); gio += 5000;
    assert.strictEqual(b.dp.quetTheoDoi(), 1);
    assert.strictEqual(b.dp.viec[b.dp.viec.length - 1].thamChieu[0], path.join(dir, 'a5.png'));
    // Xoá dự án → bỏ theo dõi.
    const d2 = b.dp.taoDuAn('B');
    b.dp.theoDoiThuMuc({ duAn: d2.id, thuMuc: dir, thamSo: {} });
    assert.ok(b.dp._gac.has(d2.id));
    assert.ok(b.dp.xoaDuAn(d2.id).ok && !b.dp._gac.has(d2.id));
    b.dp.dong();
  });

  test('1.4.9 theo dõi thư mục: "Tắt máy khi xong" không tắt khi còn theo dõi tự chạy; giao diện có công tắc + gọi lệnh có trong LENH', () => {
    const m = docNguon('main.js'), ui = docNguon('src/ui/app.js'), html = docNguon('src/ui/index.html');
    assert.ok(/if \(dieuPhoi\.coTheoDoiTuChay\(\)\) log\('warning'/.test(m) && /else mayFlow\.handleEngineMessage\(\{ action: 'TRIGGER_SHUTDOWN'/.test(m));
    assert.ok(/theoDoiThuMuc: \(p\) => dieuPhoi\.theoDoiThuMuc\(p\)/.test(m) && /boTheoDoiThuMuc: \(\{ duAn \}\) => dieuPhoi\.boTheoDoiThuMuc\(duAn\)/.test(m));
    assert.ok(/id="theoDoiThuMuc"/.test(html) && /id="nutBoTheoDoi"/.test(html) && /Theo dõi thư mục/.test(html));
    assert.ok(/api\.call\('theoDoiThuMuc', td\)/.test(ui) && /U\.theoDoiTm \? thamSoTheoDoi\(ts, chay\)/.test(ui));
  });
}

// ── 1.4.12: Dọn dữ liệu thừa (src/main/don-dep.js) ───────────────────────────────────────────────────────────
{
  const os = require('os');
  const DD = require('../src/main/don-dep');
  const KB = 1024;
  /** Cây thư mục giả như userData thật (đo bằng Electron 33). */
  function cayGia() {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-'));
    const ghi = (rel, byte, cu = true) => {
      const p = path.join(ud, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.alloc(byte, 1));
      if (cu) { const t = new Date(Date.now() - 2 * 3600e3); fs.utimesSync(p, t, t); }
      return p;
    };
    const P = (tk) => path.join('Partitions', tk);
    for (const tk of ['muse-tk-1', 'flow-flow-1', 'muse-tk-da-xoa']) {
      ghi(path.join(P(tk), 'Cache', 'Cache_Data', 'data_1'), 100 * KB);
      ghi(path.join(P(tk), 'Code Cache', 'js', 'a'), 50 * KB);
      ghi(path.join(P(tk), 'GPUCache', 'data_0'), 10 * KB);
      ghi(path.join(P(tk), 'DawnWebGPUCache', 'x'), 10 * KB);
      ghi(path.join(P(tk), 'Service Worker', 'CacheStorage', 'c', 'x'), 30 * KB);
      ghi(path.join(P(tk), 'Service Worker', 'ScriptCache', 's'), 1 * KB);
      ghi(path.join(P(tk), 'Service Worker', 'Database', 'd'), 1 * KB);
      ghi(path.join(P(tk), 'Cookies'), 2 * KB);
      ghi(path.join(P(tk), 'Network', 'Cookies'), 2 * KB);
      ghi(path.join(P(tk), 'Local Storage', 'leveldb', 'l'), 3 * KB);
      ghi(path.join(P(tk), 'IndexedDB', 'i'), 4 * KB);
    }
    ghi(path.join('Cache', 'Cache_Data', 'g'), 20 * KB);   // phiên mặc định (giao diện app)
    ghi(path.join('Local Storage', 'leveldb', 'ui'), 1 * KB);
    ghi('du-lieu.json', 5 * KB);
    ghi('du-lieu.json.hong-1700000000000', 7 * KB);
    ghi('nhat-ky.txt', 2 * KB);
    ghi('nhat-ky-cu.txt', 9 * KB);
    ghi(path.join('suno-tai-tam', 'bai.mp3'), 40 * KB);
    ghi(path.join('suno-tai-tam', 'dang-tai.mp3'), 40 * KB, false);   // vừa ghi: đang tải → để yên
    ghi(path.join('flow-tai-tam', 'tk-1-1', 'me-a', 'v.mp4'), 60 * KB);
    const flowDung = ghi(path.join('flow-tai-tam', 'tk-1-2', 'me-b', 'dung.mp4'), 5 * KB);   // việc còn trỏ tới
    ghi(path.join('flow-tai-tam', 'tk-1-2', 'me-c', 'rac.mp4'), 5 * KB);
    ghi(path.join('ket-qua-tam', 'da-xoa', 'x.png'), 8 * KB);           // dự án đã xoá
    const conDung = ghi(path.join('ket-qua-tam', 'mac-dinh', '001.png'), 8 * KB);   // việc còn trỏ tới (tắt Tải về)
    ghi(path.join('ket-qua-tam', 'mac-dinh', 'mo-coi.png'), 8 * KB);
    ghi(path.join('cap-nhat', 'AIAutomationStudio-1.4.10-setup.exe'), 70 * KB);
    ghi(path.join('cap-nhat', 'AIAutomationStudio-1.4.13-setup.exe'), 70 * KB);   // bản mới đang chờ cài
    ghi(path.join('Crashpad', 'completed', 'r.dmp'), 6 * KB);
    ghi(path.join('Crashpad', 'settings.dat'), 1 * KB);
    ghi(path.join('nhan-vat', 'nv1', 'a.png'), 11 * KB);
    const cd = path.join(ud, 'chan-doan-flow');
    ghi(path.join('chan-doan-flow', 'loi-1.html'), 12 * KB);
    const o = { userData: ud, partitions: ['persist:muse-tk-1', 'persist:flow-flow-1'], dangMo: [path.join(ud, P('flow-flow-1'))],
      fileViec: [conDung, flowDung], duAnIds: ['mac-dinh'], thuMucChanDoan: [cd], phienBan: '1.4.12' };
    return { ud, o, conDung, flowDung, P };
  }
  const muc = (kq, ma) => kq.muc.find((m) => m.ma === ma);

  testAsync('1.4.12 dọn dữ liệu: quét đúng dung lượng từng mục (giữ đăng nhập, file việc còn dùng, nhân vật, bộ cài bản mới)', async () => {
    const { ud, o, P } = cayGia();
    try {
      const kq = await DD.quet(o);
      const c = muc(kq, 'cache');
      // tk-1 (không mở): 200 KB xoá trên đĩa; flow-1 (đang mở): 200 KB qua API phiên; phiên mặc định 20 KB qua API.
      assert.strictEqual(c.byte, (200 + 200 + 20) * KB);
      assert.deepStrictEqual(c.api.map((p) => path.relative(ud, p)).sort(), ['', P('flow-flow-1')].sort());
      assert.ok(c.xoa.every((p) => p.includes(P('muse-tk-1'))) && c.xoa.length === 5, c.xoa.join('\n'));
      assert.ok(!c.xoa.some((p) => /Cookies|Local Storage|IndexedDB|Network|ScriptCache|Database/.test(p)), 'không đụng đăng nhập');
      const b = muc(kq, 'phien-cu');
      assert.deepStrictEqual(b.xoa.map((p) => path.relative(ud, p)), [P('muse-tk-da-xoa')]);
      assert.strictEqual(b.byte, (200 + 2 + 2 + 3 + 4 + 1 + 1) * KB);
      const t = muc(kq, 'tam');
      assert.deepStrictEqual(t.xoa.map((p) => path.relative(ud, p)).sort(),
        [path.join('flow-tai-tam', 'tk-1-1'), path.join('flow-tai-tam', 'tk-1-2', 'me-c'), path.join('ket-qua-tam', 'da-xoa'), path.join('ket-qua-tam', 'mac-dinh', 'mo-coi.png'), path.join('suno-tai-tam', 'bai.mp3')].sort());
      assert.deepStrictEqual([muc(kq, 'nhat-ky-cu').byte, muc(kq, 'chan-doan').byte, muc(kq, 'cap-nhat').byte, muc(kq, 'bao-loi').byte], [9 * KB, 12 * KB, 70 * KB, 13 * KB]);
      assert.deepStrictEqual(muc(kq, 'cap-nhat').xoa.map((p) => path.basename(p)), ['AIAutomationStudio-1.4.10-setup.exe']);
      assert.deepStrictEqual([kq.duLieuJson, kq.nhanVat], [5 * KB, 11 * KB]);
      const tt = DD.tomTat(kq);
      assert.ok(tt.muc.every((m) => !m.xoa && !m.api) && tt.muc.length === 7);
      assert.deepStrictEqual([DD.docByte(1536), DD.docByte(3.25 * 1024 ** 3), DD.docByte(500)], ['1,5 KB', '3,3 GB', '500 byte']);
    } finally { fs.rmSync(ud, { recursive: true, force: true }); }
  });

  testAsync('1.4.12 dọn dữ liệu: dọn xong vẫn còn đăng nhập (Cookies, Local Storage, IndexedDB), file việc còn dùng, nhật ký đang ghi, nhân vật', async () => {
    const { ud, o, conDung, flowDung, P } = cayGia();
    try {
      const kq = await DD.quet(o);
      const r = await DD.donDep(kq, kq.muc.map((m) => m.ma));
      assert.strictEqual(r.khongXoa, 0, JSON.stringify(r));
      const con = (rel) => fs.existsSync(path.join(ud, rel));
      for (const tk of ['muse-tk-1', 'flow-flow-1']) {
        for (const rel of ['Cookies', path.join('Network', 'Cookies'), path.join('Local Storage', 'leveldb', 'l'), path.join('IndexedDB', 'i'), path.join('Service Worker', 'Database', 'd')]) {
          assert.ok(con(path.join(P(tk), rel)), `${tk}/${rel} phải còn`);
        }
      }
      assert.ok(!con(path.join(P('muse-tk-1'), 'Cache')) && !con(path.join(P('muse-tk-1'), 'Service Worker', 'CacheStorage')), 'cache phiên không mở: xoá trên đĩa');
      assert.ok(con(path.join(P('flow-flow-1'), 'Cache', 'Cache_Data', 'data_1')), 'phiên đang mở: không xoá file trên đĩa (dọn qua API)');
      assert.ok(!con(P('muse-tk-da-xoa')), 'phiên tài khoản đã xoá: xoá cả thư mục');
      assert.ok(fs.existsSync(flowDung) && !con(path.join('flow-tai-tam', 'tk-1-2', 'me-c')), 'thư mục tạm có file việc còn dùng: chỉ xoá phần thừa');
      assert.ok(fs.existsSync(conDung) && con(path.join('suno-tai-tam', 'dang-tai.mp3')) && con('nhat-ky.txt') && con('du-lieu.json') &&
        con(path.join('nhan-vat', 'nv1', 'a.png')) && con(path.join('cap-nhat', 'AIAutomationStudio-1.4.13-setup.exe')) && con(path.join('Crashpad', 'settings.dat')));
      assert.ok(!con('nhat-ky-cu.txt') && !con(path.join('chan-doan-flow', 'loi-1.html')) && !con('du-lieu.json.hong-1700000000000') &&
        !con(path.join('ket-qua-tam', 'mac-dinh', 'mo-coi.png')) && !con(path.join('cap-nhat', 'AIAutomationStudio-1.4.10-setup.exe')));
      // Chỉ dọn mục đã chọn.
      const k2 = cayGia();
      const q2 = await DD.quet(k2.o);
      await DD.donDep(q2, ['nhat-ky-cu']);
      assert.ok(!fs.existsSync(path.join(k2.ud, 'nhat-ky-cu.txt')) && fs.existsSync(path.join(k2.ud, k2.P('muse-tk-da-xoa'))) && fs.existsSync(path.join(k2.ud, 'suno-tai-tam', 'bai.mp3')));
      fs.rmSync(k2.ud, { recursive: true, force: true });
    } finally { fs.rmSync(ud, { recursive: true, force: true }); }
  });

  test('1.4.12 dọn dữ liệu: LENH quetDuLieu / donDuLieu, phiên đang mở dọn qua API (giữ đăng nhập), giao diện ở Cài đặt → Cả app', () => {
    const m = docNguon('main.js'), ui = docNguon('src/ui/app.js'), html = docNguon('src/ui/index.html');
    assert.ok(/quetDuLieu: async \(\) => DD\.tomTat\(await DD\.quet\(moiTruongDonDep\(\)\)\)/.test(m) && /donDuLieu: \(\{ muc \}\) => donDuLieu\(muc \|\| \[\]\)/.test(m));
    assert.ok(/await ses\.clearCache\(\);/.test(m) && /clearStorageData\(\{ storages: \['shadercache', 'cachestorage'\] \}\)/.test(m));
    assert.ok(!/clearStorageData\(\{ storages: \[[^\]]*(cookies|localstorage|indexdb)/.test(m), 'dọn không được xoá cookie / localStorage / IndexedDB');
    assert.ok(/fileViec: dieuPhoi\.viec\.flatMap\(\(j\) => \[\.\.\.\(j\.files \|\| \[\]\), \.\.\.\(j\.thamChieu \|\| \[\]\)\]\)/.test(m));
    assert.ok(/id="cdDonDuLieu"/.test(html) && /id="cdDungLuong"/.test(html) && /Dọn dữ liệu thừa/.test(html));
    assert.ok(/api\.call\('quetDuLieu'\)/.test(ui) && /api\.call\('donDuLieu', \{ muc \}\)/.test(ui));
  });
}

console.log('\n── 1.4.14 ─────────────────────────────────────');
{
  const os = require('os');
  const HG = require('../src/main/hen-gio');
  const DD = require('../src/main/don-dep');
  const luc = (x) => new Date(x).getTime();
  const luongHen = (daChay) => (a, stt, duAnId) => ({
    id: `${a.id}-${stt}`, nen: a.nen, duAn: duAnId, ranh: true, viec: null,
    dung() { this.biDung = true; },
    async chay(j) {
      this.ranh = false; this.viec = j; this.biDung = false; daChay.push([j.loai, j.duAn, j.so]);
      await new Promise((r) => setTimeout(r, 5)); this.ranh = true; this.viec = null;
      if (this.biDung) return { ok: false, dung: true };
      return { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] };
    }
  });
  const chayVong = async (dp, n = 60) => { for (let i = 0; i < n; i++) { dp._vong(); await new Promise((r) => setTimeout(r, 8)); } };

  test('1.4.14 hẹn giờ: dữ liệu cũ {anh, video, nhac} → danh sách (bỏ hẹn mặc định chưa đổi), id không trùng, duAn → duAnDs', () => {
    const cu = { anh: { bat: true, batDau: '22:00', ketThuc: '', lap: 'ngay', duAn: 'b', datLuc: 1, daChay: '' },
      video: { ...HG.HEN_MAC_DINH, duAn: '' }, nhac: { bat: false, batDau: '07:00', ketThuc: '', lap: 'mot', duAn: '', datLuc: 1, daChay: '2026-10-18 07:00' } };
    const ds = HG.chuanBoHen(cu);
    assert.deepStrictEqual(ds.map((h) => [h.id, h.loai, h.bat, h.duAnDs.join()]), [['anh-1', 'anh', true, 'b'], ['nhac-1', 'nhac', false, '']]);
    assert.ok(ds.every((h) => !('duAn' in h)));
    assert.deepStrictEqual(HG.chuanBoHen(ds), ds, 'chuẩn hoá lần hai không đổi gì');
    assert.deepStrictEqual(HG.chuanBoHen([{ loai: 'anh', id: 'x' }, { loai: 'anh', id: 'x' }, { loai: 'zz' }]).map((h) => h.id), ['x', 'anh-1']);
    assert.deepStrictEqual(HG.chuanBoHen(undefined), []);
    // Mở app bản mới trên dữ liệu cũ.
    const { dp } = dungDieuPhoi({ duLieu: { henGio: cu } });
    assert.ok(Array.isArray(dp.henGio) && dp.henGio.length === 2 && dp.henGio[0].duAnDs[0] === 'b');
  });

  testAsync('1.4.14 hai hẹn Tạo ảnh: 22:00 chỉ dự án B, 22:30 dự án Mặc định + C — mỗi hẹn chạy đúng dự án của nó, dự án D giữ Chờ', async () => {
    const daChay = [];
    let gio = luc('2026-11-14T21:59:00');
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: luongHen(daChay), bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0 });
    const b = dp.taoDuAn('B', null, null, 'mac-dinh'), c = dp.taoDuAn('C', null, null, 'mac-dinh'), d = dp.taoDuAn('D', null, null, 'mac-dinh');
    for (const x of ['mac-dinh', b.id, c.id, d.id]) dp.them({ duAn: x, loai: 'anh', prompts: ['1', '2'] });
    const r1 = dp.datHenGio('anh', { moi: true, bat: true, batDau: '22:00', duAnDs: [b.id] });
    const r2 = dp.datHenGio('anh', { moi: true, bat: true, batDau: '22:30', duAnDs: ['mac-dinh', c.id, 'khong-co'] });
    assert.ok(r1.ok && r2.ok && r1.henGio.id !== r2.henGio.id);
    assert.deepStrictEqual(r2.henGio.duAnDs, ['mac-dinh', c.id], 'dự án không tồn tại bị bỏ');
    assert.ok(nhatKy.some((x) => /⏰ Hẹn giờ Tạo ảnh: bắt đầu 22:30, chạy tới hết hàng chờ, mỗi ngày — 2 dự án: "Mặc định|2 dự án: "/.test(x)), nhatKy.join('\n'));
    gio = luc('2026-11-14T22:00:05');
    await chayVong(dp);
    assert.deepStrictEqual([...new Set(daChay.map((x) => x[1]))], [b.id], '22:00: chỉ dự án B');
    gio = luc('2026-11-14T22:30:05');
    await chayVong(dp);
    assert.deepStrictEqual([...new Set(daChay.map((x) => x[1]))].sort(), [b.id, c.id, 'mac-dinh'].sort(), '22:30: thêm Mặc định + C');
    assert.ok(dp.viec.filter((j) => j.duAn === d.id).every((j) => j.trangThai === 'cho'), 'dự án D không thuộc hẹn nào → giữ Chờ');
    assert.strictEqual(dp.henDangChay.size, 0, 'chạy hết → xong cả hai lượt hẹn');
    const st = dp.trangThai();
    assert.strictEqual(st.henGio.filter((h) => h.loai === 'anh').length, 2);
  });

  testAsync('1.4.14 dừng / xoá MỘT hẹn đang chạy không đụng hẹn kia; xoá dự án → bỏ khỏi hẹn, hẹn hết dự án thì tắt', async () => {
    let gio = luc('2026-11-14T22:00:00');
    const ds = [];
    const tao = (a, stt, duAnId) => { const l = { id: `${a.id}-${stt}`, nen: a.nen, duAn: duAnId, ranh: true, viec: null,
      dung() { this.biDung = true; if (this.xong) this.xong(); },
      async chay(j) { this.ranh = false; this.viec = j; this.biDung = false; await new Promise((r) => { this.xong = r; }); this.ranh = true; this.viec = null; return { ok: false, dung: true }; } };
      ds.push(l); return l; };
    const { dp } = dungDieuPhoi({ taoLuong: tao, bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0, luongMoiTK: 1 });
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.them({ loai: 'anh', prompts: ['1'] });
    dp.them({ duAn: b.id, loai: 'video', prompts: ['v'] });
    dp.them({ duAn: b.id, loai: 'anh', prompts: ['b1'] });
    const h1 = dp.datHenGio('anh', { moi: true, bat: true, batDau: '22:00', duAnDs: ['mac-dinh'] }).henGio;
    const hb = dp.datHenGio('anh', { moi: true, bat: true, batDau: '22:00', duAnDs: [b.id] }).henGio;   // cùng chức năng, cùng giờ
    const h2 = dp.datHenGio('video', { moi: true, bat: true, batDau: '22:00', duAnDs: [b.id] }).henGio;
    await chayVong(dp, 5);
    assert.ok(dp.henDangChay.has(h1.id) && dp.henDangChay.has(h2.id));
    assert.strictEqual(dp.dungHen(h1.id), true);
    assert.ok(!dp.henDangChay.has(h1.id) && dp.henDangChay.has(h2.id) && dp.henDangChay.has(hb.id), 'dừng một hẹn ảnh: hẹn ảnh kia và hẹn video vẫn chạy');
    assert.ok(dp.viec.find((j) => j.prompt === 'b1').trangThai === 'chay', 'việc ảnh của dự án B (hẹn kia) không bị dừng');
    dp.dungHen(hb.id);
    assert.strictEqual(dp.xoaHenGio(h2.id).ok, true);
    assert.ok(!dp.henDangChay.has(h2.id) && !dp.henGio.some((h) => h.id === h2.id));
    assert.ok(ds.every((l) => l.biDung), 'luồng của cả hai lượt được bảo dừng');
    assert.strictEqual(dp.xoaHenGio('khong-co').ok, false);
    assert.strictEqual(dp.datHenGio('anh', { id: 'khong-co', bat: true }).ok, false, 'sửa hẹn không tồn tại → báo lỗi');
    // Một hẹn hai dự án: xoá một dự án → còn dự án kia; xoá nốt → tắt.
    await chayVong(dp, 5);
    const c = dp.taoDuAn('C', null, null, 'mac-dinh');
    const h3 = dp.datHenGio('nhac', { moi: true, bat: true, batDau: '05:00', duAnDs: [b.id, c.id] }).henGio;
    dp.xoaDuAn(c.id);
    assert.deepStrictEqual([dp.henGio.find((h) => h.id === h3.id).bat, dp.henGio.find((h) => h.id === h3.id).duAnDs], [true, [b.id]]);
    dp.xoaDuAn(b.id);
    assert.deepStrictEqual([dp.henGio.find((h) => h.id === h3.id).bat, dp.henGio.find((h) => h.id === h3.id).duAnDs], [false, []]);
    // Sửa hẹn theo id (không tạo hẹn mới); bản cũ datHenGio(loai, {duAn}) vẫn chạy.
    const n = dp.henGio.length;
    dp.datHenGio('nhac', { id: h3.id, batDau: '06:00', duAnDs: [] });
    assert.ok(dp.henGio.length === n && dp.henGio.find((h) => h.id === h3.id).batDau === '06:00');
    const d = dp.taoDuAn('D', null, null, 'mac-dinh');
    dp.datHenGio('nhac', { duAn: d.id });
    assert.deepStrictEqual(dp.henGio.find((h) => h.loai === 'nhac').duAnDs, [d.id], 'không id, không moi → sửa hẹn đầu của chức năng');
  });

  test('1.4.14 gửi hàng đợi theo phần đổi: chỉ việc đổi, thứ tự khi thêm / xoá, gói lệch bản → xin lại bản đủ', () => {
    const g = HD.taoGoiViec();
    const v = [{ id: 1, a: 1 }, { id: 2, a: 1 }, { id: 3, a: 1 }];
    const g1 = g.lay(v, true);
    let kho = HD.ghepGoiViec(null, g1);
    assert.ok(g1.du && g1.doi.length === 3 && kho.ds.map((j) => j.id).join() === '1,2,3');
    const g2 = g.lay(v);
    assert.ok(!g2.du && g2.doi.length === 0 && g2.thuTu === null, 'không đổi gì → gói rỗng');
    const k2 = HD.ghepGoiViec(kho, g2);
    assert.strictEqual(k2.ds, kho.ds, 'không đổi → giữ nguyên mảng (giao diện khỏi dựng lại)');
    kho = k2;
    v[1] = { ...v[1], a: 2 };
    const g3 = g.lay(v);
    assert.deepStrictEqual(g3.doi.map((j) => j.id), [2]);
    const giu = kho.ds[0];
    kho = HD.ghepGoiViec(kho, g3);
    assert.ok(kho.ds[1].a === 2 && kho.ds[0] === giu, 'việc không đổi giữ nguyên đối tượng (HTML dòng nhớ theo đối tượng)');
    v.splice(0, 1); v.push({ id: 4, a: 1 });
    const g4 = g.lay(v);
    assert.deepStrictEqual([g4.doi.map((j) => j.id), g4.thuTu], [[4], [2, 3, 4]]);
    kho = HD.ghepGoiViec(kho, g4);
    assert.ok(kho.ds.map((j) => j.id).join() === '2,3,4' && !kho.map.has(1), 'việc bị xoá ra khỏi bản giao diện');
    const lech = g.lay(v); lech.tu = 999;
    assert.strictEqual(HD.ghepGoiViec(kho, lech), null, 'gói không nối tiếp → null (giao diện xin bản đủ)');
    assert.strictEqual(HD.ghepGoiViec(null, g.lay(v)), null, 'chưa có bản đủ → null');
  });

  test('1.4.14 chọn việc theo số "1,3,4,8,6,10-50": đúng id, số không có thì báo, chữ sai thì báo', () => {
    const ds = [...Array(60)].map((_, i) => ({ id: 100 + i, so: i + 1 })).filter((j) => j.so !== 12);
    const r = HD.chonViecTheoSo(ds, '1,3,4,8,6,10-14, 70, abc');
    assert.deepStrictEqual(r.so, [1, 3, 4, 6, 8, 10, 11, 13, 14]);
    assert.deepStrictEqual(r.ids, [100, 102, 103, 105, 107, 109, 110, 112, 113]);
    assert.deepStrictEqual([r.thieu, r.loi], [[12, 70], ['abc']]);
    assert.deepStrictEqual(HD.chonViecTheoSo([{ id: 1, so: 5 }, { id: 2, so: 5 }], '5').ids, [1, 2], 'hai việc cùng số (ảnh + video nối) → chọn cả hai');
  });

  testAsync('1.4.14 xoá dự án → dọn dữ liệu tạm của dự án: ket-qua-tam, thư mục Flow tải dở (đúng mẫu tên), file tạm của việc; giữ file dự án khác còn dùng', async () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'xoa-da-'));
    try {
      const w = (rel, n = 10) => { const p = path.join(ud, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.alloc(n)); return p; };
      w('ket-qua-tam/du-an/001.png', 100); w('ket-qua-tam/du-an/002.png', 100);
      w('ket-qua-tam/du-an-1/001.png');                       // dự án khác tên gần giống
      w('flow-tai-tam/flow-1-du-an-1/a.mp4'); w('flow-tai-tam/flow-1-du-an-12/b.mp4');
      w('flow-tai-tam/flow-1-du-an-1-1/c.mp4');               // tab 1 của dự án "du-an-1" — KHÔNG được xoá khi xoá "du-an"
      w('flow-tai-tam/khac/x.mp4');
      const sunoCua = w('suno-tai-tam/bai-du-an.mp3'), sunoKhac = w('suno-tai-tam/bai-khac.mp3');
      const dung = w('ket-qua-tam/du-an/003.png');            // dự án khác còn trỏ tới (ảnh tham chiếu)
      const r = await DD.thuDuAn({ userData: ud, duAnId: 'du-an', tkIds: ['flow-1', 'tk-1'],
        fileDuAn: [path.join(ud, 'ket-qua-tam/du-an/001.png'), sunoCua, '/ngoai/app/anh.png'], fileConDung: [dung, sunoKhac] });
      assert.strictEqual(r.soKetQua, 2, 'báo 2 file kết quả tạm (003 còn dùng không tính)');
      const x = await DD.xoaDs(r.xoa);
      assert.strictEqual(x.khongXoa, 0);
      const con = (rel) => fs.existsSync(path.join(ud, rel));
      assert.ok(!con('ket-qua-tam/du-an/001.png') && !con('ket-qua-tam/du-an/002.png') && con('ket-qua-tam/du-an/003.png'));
      assert.ok(!con('flow-tai-tam/flow-1-du-an-1') && !con('flow-tai-tam/flow-1-du-an-12'));
      assert.ok(con('flow-tai-tam/flow-1-du-an-1-1/c.mp4') && con('flow-tai-tam/khac/x.mp4') && con('ket-qua-tam/du-an-1/001.png'), 'không đụng dự án "du-an-1"');
      assert.ok(!fs.existsSync(sunoCua) && fs.existsSync(sunoKhac));
      assert.ok(r.byte >= 200);
    } finally { fs.rmSync(ud, { recursive: true, force: true }); }
    // Điều phối trả file của việc trong dự án để dọn; main.js gọi dọn ngay sau khi xoá.
    const { dp } = dungDieuPhoi();
    const d = dp.taoDuAn('X', null, null, 'mac-dinh');
    dp.them({ duAn: d.id, loai: 'anh', prompts: ['a'], thamChieu: ['/tc.png'] });
    dp.viec[0].files = ['/f.png'];
    assert.deepStrictEqual(dp.xoaDuAn(d.id).fileDuAn.sort(), ['/f.png', '/tc.png']);
    const m = docNguon('main.js'), ui = docNguon('src/ui/app.js');
    assert.ok(/xoaDuAn: \(\{ id \}\) => xoaDuAnVaDon\(id\)/.test(m) && /await DD\.thuDuAn\(moiTruongDuAn\(id, r\.fileDuAn\)\)/.test(m));
    assert.ok(/api\.call\('thuDuLieuDuAn', \{ id: d\.id \}\)/.test(ui));
  });

  test('1.4.14 bớt phần làm chậm: thanh tiến độ không transition, dòng cô lập bố cục, gửi trạng thái theo phần đổi', () => {
    const css = docNguon('src/ui/style.css', true), ui = docNguon('src/ui/app.js'), m = docNguon('main.js');
    assert.ok(/\.thanh-tien div \{[^}]*\}/.test(css) && !/\.thanh-tien div \{[^}]*transition/.test(css), 'thanh tiến độ không transition width');
    assert.ok(/#dsHang \.dong-viec \{ contain: layout paint style; \}/.test(css) && !/content-visibility/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')));
    assert.ok(/s\.goiViec = goiViec\.lay\(s\.viec, du\);/.test(m) && /trangThaiDu: \(\) =>/.test(m));
    assert.ok(/HD\.ghepGoiViec\(U\.khoViec, s\.goiViec\)/.test(ui) && /api\.call\('trangThaiDu'\)/.test(ui));
    assert.ok(!/_conDung\(/.test(docNguon('src/main/dieu-phoi.js')) && !/diagnose\(/.test(docNguon('src/flow/tab-flow.js')), 'hàm không ai gọi đã bỏ');
  });
}

Promise.all(choAsync).then(() => {
  console.log('\n──────────────────────────────────────────────');
  console.log(`KẾT QUẢ: ${pass}/${pass + loi.length} PASS`);
  if (loi.length) { console.log('HỎNG:\n - ' + loi.join('\n - ')); process.exit(1); }
});
