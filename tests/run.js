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
    taoLuong: o.taoLuong || (() => ({ ranh: true, dung() {} })), huyLuong: () => {},
    docFile: (p) => ({ ten: path.basename(p), mime: 'image/png', b64: 'AA==' }),
    ghiFile: o.ghiFile || (() => {}), chuyenFile: o.chuyenFile || (() => {}), thuMucRaMacDinh: '/ra', thuMucTam: '/tam',
    tonTai: o.tonTai || (() => false), donDep: o.donDep, hetLuot: o.hetLuot, bayGio: o.bayGio
  });
  clearInterval(dp.hen);
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
test('thư mục + mẫu tên riêng cho ảnh/video; tắt tải về → ghi vào thư mục tạm', () => {
  const ghi = [];
  const { dp } = dungDieuPhoi({ ghiFile: (p) => ghi.push(p.replace(/\\/g, '/')) });
  dp.datCaiDat({ thuMucAnh: '/A', thuMucVideo: '/V', tenAnh: 'anh_{stt}', tenVideo: '{duAn}/vid_{stt}', taiVideo: false });
  dp.them({ prompts: ['x'] });
  dp.them({ loai: 'video', prompts: ['y'] });
  dp._ketThuc(dp.viec[0], { ok: true, files: [{ mime: 'image/png', b64: 'AA==' }] }, null);
  dp._ketThuc(dp.viec[1], { ok: true, files: [{ mime: 'video/mp4', b64: 'AA==' }] }, null);
  assert.deepStrictEqual(ghi, ['/A/anh_001.png', '/tam/Mac_dinh/vid_001.mp4']);
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
  assert.ok(nhatKy.some((x) => /"Muse 1": lỗi 2 việc liên tiếp — tạm nghỉ/.test(x)));
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
test('1.0.4: Cài đặt có nút chọn thư mục video tạo từ ảnh, nối lệnh chonThuMucVideoAnh (lưu ngay, tắt cạnh ảnh)', () => {
  const ui = docNguon('src/ui/app.js'), m = docNguon('main.js');
  const html = docNguon('src/ui/index.html', true);
  for (const id of ['cdThuMucVideoAnh', 'cdChonThuMucVideoAnh', 'cdMoThuMucVideoAnh', 'cdBoThuMucVideoAnh']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(/\$\('#cdChonThuMucVideoAnh'\)\.onclick[\s\S]{0,120}api\.call\('chonThuMucVideoAnh', \{ duAn/.test(ui));
  assert.ok(/chonThuMucVideoAnh: async[\s\S]{0,400}datCaiDat\(\{ thuMucVideoAnh: r\.filePaths\[0\], videoCanhAnh: false \}, duAn\)/.test(m));
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
  assert.deepStrictEqual([c.tenAnh, c.tuThuLai, c.moc], ['{stt}', 2, 5]);
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
  assert.deepStrictEqual(Object.keys(c.anToan).sort(), ['nghiPhut', 'nguong'], 'chỉ còn 2 khoá nhận diện tài khoản lỗi');
  // Bộ cũ (chế độ an toàn: "3 lỗi trong 5 phút") mang nghĩa khác → lấy mặc định mới.
  assert.deepStrictEqual(CF.chuanHoaFlow({ anToan: { bat: false, nguong: 3, cuaSoPhut: 5, nghiPhut: 10, cuMoi: 20 } }).anToan, { nguong: 2, nghiPhut: 15 });
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
  b.dp.datCaiDat({ luongMoiTK: 1, nghiGiuaLanGui: 0, tuThuLai: 0, tuChayLaiLoi: 0, flow: { meToiDa: 5 } });
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
  assert.deepStrictEqual([tat.doiNenKhiLoi, tat.flow.sangMuseKhiHong, tat.moc], [false, undefined, 5]);
  for (const flow of [{ sangMuseKhiHong: true }, {}]) {
    const c = dungDieuPhoi({ duLieu: { caiDat: { moc: 3, flow } } }).dp.caiDat;
    assert.deepStrictEqual([c.doiNenKhiLoi, c.flow.sangMuseKhiHong], [true, undefined], JSON.stringify(flow));
  }
  const daTat = dungDieuPhoi({ duLieu: { caiDat: { moc: 4, doiNenKhiLoi: false } } }).dp;
  assert.strictEqual(daTat.caiDat.doiNenKhiLoi, false, 'đã ở mốc 4 thì giữ lựa chọn người dùng');
  daTat.datCaiDat({ doiNenKhiLoi: true });
  assert.strictEqual(daTat.caiDat.doiNenKhiLoi, true);
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
  for (const id of ['fModelAnh', 'fModelChinh', 'fModelPhu', 'fModelDuPhong']) assert.ok(new RegExp(`<select id="${id}"`).test(html), id);
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
  assert.ok(/veTheoDong\(hop, ds\.slice\(0, MAX\)\.map\(\(j\) => \(\{ khoa: j\.id, html: dongViec\(j\) \}\)\)/.test(hang), 'hàng đợi vẽ theo dòng');
  assert.ok(/v\.removeAttribute\('src'\)/.test(a) && /toDataURL\('image\/jpeg'/.test(a), 'chụp xong thì nhả video');
  assert.ok(/new IntersectionObserver/.test(a), 'chỉ chụp video đang hiện trên màn hình');
  assert.ok(/img\[data-vthumb\]:not\(\[src\]\)[^{]*\{ visibility: hidden; \}/.test(c), 'ảnh chưa chụp: visibility (display:none làm IntersectionObserver không thấy)');
  assert.ok(/\.luoi-tv \{[^}]*grid-auto-rows: max-content/.test(c), 'lưới thư viện không co hàng');
});
test('1.3.4 tiến trình chính: gom ghi du-lieu.json 1,5 s, báo giao diện 250 ms, RAM từng phần vào nhật ký, xoay vòng nhat-ky.txt, luồng Muse dừng video', () => {
  const m = docNguon('main.js'), l = docNguon('src/main/luong.js'), st = docNguon('src/main/store.js');
  assert.ok(/new Store\(path\.join\(app\.getPath\('userData'\), 'du-lieu\.json'\), \(m\) => log\('warning', m\), \{ nhipMs: 1500 \}\)/.test(m));
  assert.ok(/this\.nhipMs = o\.nhipMs \|\| 250/.test(st) && /\}, this\.nhipMs\);/.test(st));
  assert.ok(/win\.webContents\.send\('state', trangThai\(\)\);\n  \}, 250\);/.test(m));
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
    assert.strictEqual(dp.loaiChay.size, 0, 'chạy hết thì xong lượt hẹn');
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
    const tao = luongHen(daChay, 60);
    const ds = [];
    const { dp, nhatKy } = dungDieuPhoi({ taoLuong: (a, s, d) => { const l = tao(a, s, d); ds.push(l); return l; }, bayGio: () => gio });
    dp.datCaiDat({ nghiGiuaLanGui: 0, luongMoiTK: 1 });
    dp.them({ loai: 'video', prompts: ['1', '2', '3', '4', '5', '6'] });
    dp.datHenGio('video', { bat: true, batDau: '22:00', ketThuc: '22:10' });
    await chayVong(dp, 3);
    assert.ok(dp.loaiChay.has('video') && dp.dangChay);
    assert.strictEqual(dp.duAnDangChay('mac-dinh'), true);
    dp.datHenGio('video', { ketThuc: '23:00' });
    assert.strictEqual(dp.loaiChay.get('video').den, luc('2026-10-18T23:00:00'), 'đổi giờ dừng lúc đang chạy → áp ngay');
    dp.datHenGio('video', { ketThuc: '22:10' });
    gio = luc('2026-10-18T22:10:00');
    dp._vong();
    assert.strictEqual(dp.loaiChay.size, 0);
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
    assert.strictEqual(dp.henGio.nhac.bat, false, 'một lần → tắt sau khi tới giờ');
    assert.ok(nhatKy.some((x) => /⏰ Hẹn giờ Tạo nhạc \(07:00\): không có việc nhạc nào đang chờ \(mọi dự án\) — bỏ qua lần này/.test(x)), nhatKy.join('\n'));
    assert.strictEqual(dp.loaiChay.size, 0);
    const b = dp.taoDuAn('B', null, null, 'mac-dinh');
    dp.datHenGio('video', { bat: true, batDau: '23:00', duAn: b.id });
    assert.strictEqual(store.get(['henGio']).henGio.video.duAn, b.id, 'hẹn giờ lưu xuống đĩa');
    dp.xoaDuAn(b.id);
    assert.deepStrictEqual([dp.henGio.video.bat, dp.henGio.video.duAn], [false, '']);
    const st = dp.trangThai();
    assert.ok(st.henGio.anh && 'lanToi' in st.henGio.anh && typeof st.henChay === 'object');
    // Mở lại app: hẹn giữ nguyên.
    const dp2 = dungDieuPhoi({ duLieu: store.get(['duAn', 'viec', 'caiDat', 'henGio']), bayGio: () => gio }).dp;
    assert.strictEqual(dp2.henGio.nhac.daChay, '2026-10-18 07:00');
  });

  test('1.3.6 hẹn giờ: giao diện có trang Hẹn giờ 3 thẻ, lệnh có trong LENH, giữ máy không ngủ khi có hẹn', () => {
    const html = docNguon('src/ui/index.html'), m = docNguon('main.js'), ui = docNguon('src/ui/app.js');
    assert.ok(/data-trang="hengio"/.test(html) && /id="trang-hengio"/.test(html));
    assert.deepStrictEqual([...html.matchAll(/class="the-cai the-hen" data-loai="(\w+)"/g)].map((x) => x[1]), ['anh', 'video', 'nhac']);
    assert.ok(/datHenGio: \(\{ loai, hen \}\) => dieuPhoi\.datHenGio\(loai, hen\)/.test(m) && /dungHen: \(\{ loai \}\) => dieuPhoi\.dungHen\(loai\)/.test(m));
    assert.ok(/powerSaveBlocker\.start\('prevent-app-suspension'\)/.test(m) && /powerSaveBlocker\.stop\(chanNgu\)/.test(m));
    assert.ok(/'hengio', 'nhanvat'/.test(ui) && /api\.call\('datHenGio'/.test(ui));
  });
}

Promise.all(choAsync).then(() => {
  console.log('\n──────────────────────────────────────────────');
  console.log(`KẾT QUẢ: ${pass}/${pass + loi.length} PASS`);
  if (loi.length) { console.log('HỎNG:\n - ' + loi.join('\n - ')); process.exit(1); }
});
