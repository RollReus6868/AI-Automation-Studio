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
    tonTai: o.tonTai || (() => false), donDep: o.donDep, hetLuot: o.hetLuot
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
  assert.deepStrictEqual([c.tenAnh, c.tuThuLai, c.moc], ['{stt}', 2, 2]);
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
  assert.ok(/\$\('#chonTai'\)\.onclick[\s\S]{0,120}api\.call\('taiNhieu', \{ ids: \[\.\.\.U\.chon\] \}/.test(ui));
  const luu = ui.slice(ui.indexOf("$('#cdLuu').onclick"), ui.indexOf("toast('Đã lưu cài đặt')"));
  for (const k of ['videoCanhAnh', 'xoaChatKhiXong', 'xoaDuAnFlowKhiXong']) assert.ok(luu.includes(k), `Lưu cài đặt thiếu ${k}`);
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
  assert.ok(/nutChat\(h\)\.dispatchEvent\(new PointerEvent\('pointerdown'/.test(x) && !/bam\(nutChat/.test(x));
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
  assert.strictEqual(c.anToan.bat, true, 'thiếu khoá con thì lấy mặc định');
  assert.strictEqual(c.chatLuongAnh, 'img_2k');
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
  assert.deepStrictEqual([don.flow, don.muse.size], [['flow-1'], 0]);
  // Lượt trước dừng giữa chừng (không dọn) → lượt sau không xoá dự án của tài khoản chỉ chạy ở lượt trước.
  dp.tkFlowDaChay.add('flow-2');
  dp.dungTatCa();
  dp.them({ nen: 'flow', loai: 'anh', prompts: ['2'] });
  dp.chayTatCa();
  await chayHet(dp);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepStrictEqual(don.flow, ['flow-1']);
  assert.ok(dp.viec[0].flowTen);
  dp.boFlowTen('flow-1');
  assert.strictEqual(dp.viec[0].flowTen, null);
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
test('tài khoản: mặc định có Muse 1 + Flow 1, phiên tách theo nền tảng; dự án chọn tài khoản theo từng nền tảng', () => {
  const { dp, tk } = dungDieuPhoi();
  assert.deepStrictEqual(tk.ds.map((a) => [a.id, a.nen, a.partition]), [['tk-1', 'muse', 'persist:muse-tk-1'], ['flow-1', 'flow', 'persist:flow-flow-1']]);
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

Promise.all(choAsync).then(() => {
  console.log('\n──────────────────────────────────────────────');
  console.log(`KẾT QUẢ: ${pass}/${pass + loi.length} PASS`);
  if (loi.length) { console.log('HỎNG:\n - ' + loi.join('\n - ')); process.exit(1); }
});
