// ============================================================================
//  run.js — kiểm thử logic thuần, chạy bằng node, không cần Electron
//  --------------------------------------------------------------------------
//  Tầng nhanh nhất trong ba tầng kiểm thử. Chạy được trong một giây nên dùng
//  để bắt lỗi ngay khi sửa code, trước khi đụng tới hai tầng chậm hơn
//  (giao diện qua Xvfb, và đường dán prompt qua Chromium thật).
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Đọc mã nguồn để soi tĩnh. GitHub Actions trên Windows checkout ra CRLF
// (core.autocrlf), nên cắt thân hàm theo '\n}\n' sẽ trượt: indexOf trả -1 và
// slice lấy tới gần hết file — bài kiểm "không được có X trong hàm" đỏ oan,
// bài "phải có X" xanh oan. Luôn chuẩn hoá về LF trước khi cắt.
// Bản gộp (AI Automation Studio): mã Flow nằm trong src/flow/ — các `case` engine chờ trả lời của
// main.js bản Flow nay ở src/flow/may-flow.js, TabManager nay là src/flow/tab-flow.js.
const DOI_DUONG = { 'main.js': ['src', 'flow', 'may-flow.js'], 'src/main/tabs.js': ['src', 'flow', 'tab-flow.js'] };
const docNguon = (...p) => {
  const k = p.join('/');
  const thuc = DOI_DUONG[k] || (p[0] === 'src' && (p[1] === 'inject' || p[1] === 'main') ? ['src', 'flow', ...p.slice(1)] : p);
  return fs.readFileSync(path.join(__dirname, '..', '..', ...thuc), 'utf8').replace(/\r\n/g, '\n');
};
/** Đọc file của bản gộp ĐÚNG đường dẫn (không chuyển hướng): main.js gốc, src/main/* của vỏ app… */
const docGoc = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8').replace(/\r\n/g, '\n');
/**
 * Thân hàm bắt đầu bằng `dau`, tới dấu `}` đóng CÙNG MỨC THỤT LỀ với dòng mở hàm.
 * Bản gộp: các hàm của máy Flow nằm lồng trong taoMayFlow() (thụt 2 dấu cách) — tìm
 * '\n}\n' như bản cũ sẽ lấy tới tận cuối taoMayFlow. Không thấy thì báo lỗi, không đoán.
 */
function thanHam(m, dau) {
  const i = m.indexOf(dau);
  if (i < 0) return '';
  const thut = m.slice(m.lastIndexOf('\n', i) + 1, i).match(/^[ \t]*/)[0];
  const j = m.indexOf('\n' + thut + '}\n', i);
  if (j < 0) throw new Error(`không tìm thấy cuối hàm "${dau}" — mã nguồn chưa chuẩn hoá xuống dòng?`);
  return m.slice(i, j);
}
const boGhiChu = (t) => t.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
/** Đoạn từ `dau` tới ngay trước `sau` (tìm sau `dau`). */
const khoiGiua = (m, dau, sau) => { const i = m.indexOf(dau); if (i < 0) return ''; const j = m.indexOf(sau, i + 1); return m.slice(i, j < 0 ? undefined : j); };

// ============================================================================
//  Bài đã bỏ khi gộp vào AI Automation Studio (lý do)
//  --------------------------------------------------------------------------
//  • đóng gói: có cả bản cài (nsis) lẫn bản một file (portable) — bản gộp chỉ phát hành bản cài nsis (+ zip Mac).
//  • đóng gói: tên file .exe nói rõ bản nào là bản nào — chỉ còn một file .exe; tên khớp bộ cập nhật đã kiểm ở tests/run.js.
//  • .bat: BUILD_EXE dựng sẵn winCodeSign, bỏ thư mục darwin — không còn BUILD_EXE.bat (bản .exe dựng trên GitHub Actions).
//  • .bat: build hỏng thì vẫn thử đường lui ra bản thư mục — như trên, không còn BUILD_EXE.bat.
//  • .bat: bước dựng winCodeSign có đường tải dự phòng — như trên, không còn BUILD_EXE.bat.
//  • tab ẩn KHÔNG bị thu về 0×0 — không còn TabManager.khungChoTab/applyBounds; tab Flow nay là cửa sổ ẩn
//    1280×800 (thay bằng bài "tab Flow là cửa sổ ẩn kích thước thật" bên dưới).
//  • macOS: file .command xuống dòng LF, có shebang, có quyền chạy — bản gộp không có file .command.
//  • macOS: node_modules chép từ Windows sang thì phải cài lại — kiểm trong CHAY_TU_NGUON.command, file đó không còn.
//  • macOS: DMG arm64 và x64 gắn vào hai ổ đĩa khác tên — bản gộp đóng gói Mac dạng zip, không có DMG.
//  • thư mục dữ liệu là Tool-flow-veo3, có chuyển dữ liệu cũ sang — bản gộp dùng thư mục AIAutomationStudio
//    (userData đặt trước whenReady đã kiểm ở tests/run.js).
//  • thời gian: nối đúng chỗ trong main.js và giao diện — bảng tiến độ theo tab (tabStatsPayload, đồng hồ quy
//    trình, chayTiepChuoi) bỏ; giao diện là hàng đợi chung, thời gian theo từng việc (batDauLuc/xongLuc).
//
//  Phần con đã bỏ trong bài được viết lại (tính năng không còn ở bản gộp):
//  • model: "không đọc danh sách model khi tab đang chạy" ('app:tabs:listModels' / nút Đọc model không còn).
//  • đường tự chỉ selector: nút "Chọn trên trang", "Tải báo cáo .txt", START_PICKING, preload uiPick/uiReport.
//  • shim/phong bì: RUN_UI_SELFTEST (mục Chẩn đoán giao diện không còn).
//  • cập nhật: mở trang phát hành giới hạn github.com (nút mở trang phát hành không còn; bộ cập nhật tự dựng link).
//  • an toàn: nút "gợi ý nhịp an toàn" (btnNhipAnToan) không còn trong Cài đặt → Google Flow.
//
//  (Lỗi bài kiểm từng chỉ ra khi gộp — Dừng / Tạm dừng không cắt ngang lần nghỉ giữa thao tác — đã sửa, bài kiểm ở mục nhịp thao tác.)
// ============================================================================

const {
  deaccentVi, normalizeForCompare, splitExtension,
  sanitizeDownloadPath, sanitizeSubfolder
} = require('../../src/flow/main/text-utils');
const { Store } = require('../../src/main/store');

let pass = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (err) {
    failures.push(`${name}\n     ${err.message}`);
  }
}

// Bài kiểm bất đồng bộ (2.8.8): phần kết luận ở cuối file chờ hết mới đếm.
const choAsync = [];
function testAsync(name, fn) {
  choAsync.push(Promise.resolve().then(fn).then(
    () => { pass++; },
    (err) => { failures.push(`${name}\n     ${err.message}`); }
  ));
}

// ── Bỏ dấu tiếng Việt ──────────────────────────────────────────────────────
test('Bỏ dấu giữ nguyên nghĩa', () => {
  assert.strictEqual(deaccentVi('Đường phố Hà Nội'), 'Duong pho Ha Noi');
  assert.strictEqual(deaccentVi('Chú mèo tam thể'), 'Chu meo tam the');
  assert.strictEqual(deaccentVi('ĐẸP'), 'DEP');
  assert.strictEqual(deaccentVi('sương mù nhẹ'), 'suong mu nhe');
});

test('Bỏ dấu không đụng chữ đã sạch', () => {
  assert.strictEqual(deaccentVi('Scene_01_final'), 'Scene_01_final');
});

// ── So sánh độ dài prompt ──────────────────────────────────────────────────
test('Chuẩn hoá gộp khoảng trắng để so đúng', () => {
  // Editor gộp khoảng trắng và biến xuống dòng thành ranh giới thẻ. Nếu so
  // thô thì prompt vào ĐỦ vẫn bị báo là thiếu. Đây đúng là lỗi đã mắc một lần
  // trong chính bài kiểm thử đường dán.
  assert.strictEqual(normalizeForCompare('a\n\nb'), 'a b');
  assert.strictEqual(normalizeForCompare('  a   b  '), 'a b');
  assert.strictEqual(normalizeForCompare('a\tb'), 'a b');
});

test('Chuẩn hoá không làm mất chữ có dấu', () => {
  const s = 'Đường phố Hà Nội về đêm';
  assert.strictEqual(normalizeForCompare(s), s);
});

// ── Tên file ───────────────────────────────────────────────────────────────
test('Tách phần mở rộng', () => {
  assert.deepStrictEqual(splitExtension('canh_01.mp4'), { stem: 'canh_01', ext: 'mp4' });
  assert.deepStrictEqual(splitExtension('a/b/c.png'),   { stem: 'c',       ext: 'png' });
  assert.deepStrictEqual(splitExtension('khongcoduoi'), { stem: 'khongcoduoi', ext: '' });
});

test('Tên file bỏ ký tự Windows cấm', () => {
  const out = sanitizeDownloadPath('phim: "canh 1" <chinh>|sua?');
  assert.ok(!/[\\:*?"<>|]/.test(out), 'còn ký tự cấm trong: ' + out);
});

test('Tên file luôn bỏ dấu', () => {
  // Chromium âm thầm từ chối nhiều tên file ngoài ASCII — lỗi thật ở bản 1.6.1.
  const out = sanitizeDownloadPath('Chú mèo tam thể.mp4');
  assert.ok(!/[^\x00-\x7f]/.test(out), 'còn ký tự ngoài ASCII: ' + out);
  assert.ok(out.includes('Chu_meo') || out.includes('Chu meo'), out);
});

test('Tên trùng thiết bị của Windows được đổi', () => {
  // CON, PRN, AUX, NUL, COM1-9, LPT1-9 không đặt được làm tên file trên Windows.
  assert.notStrictEqual(sanitizeDownloadPath('CON'), 'CON');
  assert.notStrictEqual(sanitizeDownloadPath('com1'), 'com1');
});

test('Tên file không kết thúc bằng dấu chấm hay khoảng trắng', () => {
  // Windows tự cắt đuôi, dẫn tới lệch tên so với thứ app nghĩ nó đã ghi.
  assert.ok(!/[. ]$/.test(sanitizeDownloadPath('canh_01. ')));
  assert.ok(!/^\./.test(sanitizeDownloadPath('...an')));
});

test('Tên file rỗng vẫn cho ra tên dùng được', () => {
  assert.ok(sanitizeDownloadPath('   ').length > 0);
  assert.ok(sanitizeDownloadPath('///').length > 0);
});

// ── Thư mục con ────────────────────────────────────────────────────────────
test('Thẻ {date} được thay', () => {
  const out = sanitizeSubfolder('FlowVideos/{date}');
  assert.ok(/^FlowVideos\/\d{4}-\d{2}-\d{2}$/.test(out), out);
});

test('Thư mục con chặn thoát lên thư mục cha', () => {
  const out = sanitizeSubfolder('../../Windows/System32');
  assert.ok(!out.includes('..'), 'còn ".." trong: ' + out);
});

test('Thư mục con rỗng trả về rỗng', () => {
  assert.strictEqual(sanitizeSubfolder(''), '');
  assert.strictEqual(sanitizeSubfolder('   '), '');
});

// ── Kho lưu trữ ────────────────────────────────────────────────────────────
test('Store đọc ghi đúng ba kiểu khoá', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  const s = new Store(path.join(dir, 'd.json'));

  s.set({ a: 1, b: 'hai', c: { d: true } });

  assert.deepStrictEqual(s.get('a'), { a: 1 });
  assert.deepStrictEqual(s.get(['a', 'b']), { a: 1, b: 'hai' });
  assert.deepStrictEqual(s.get({ a: 0, zzz: 'mac dinh' }), { a: 1, zzz: 'mac dinh' });
  assert.strictEqual(s.get(null).b, 'hai');

  s.remove('a');
  assert.deepStrictEqual(s.get('a'), {});

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Store ghi ra đĩa và đọc lại được', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  const file = path.join(dir, 'd.json');

  const s1 = new Store(file);
  s1.set({ veoSettings: { renameMaxLen: 40, prefix: 'Cảnh' } });
  s1.close();                       // ép ghi ngay, không chờ 250ms

  const s2 = new Store(file);
  assert.strictEqual(s2.get('veoSettings').veoSettings.renameMaxLen, 40);
  assert.strictEqual(s2.get('veoSettings').veoSettings.prefix, 'Cảnh');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Store gặp file hỏng thì bắt đầu lại, không ném lỗi', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  const file = path.join(dir, 'd.json');
  fs.writeFileSync(file, '{ dây không phải JSON', 'utf8');

  const s = new Store(file);         // không được ném
  assert.deepStrictEqual(s.get(null), {});
  // Bản hỏng phải được giữ lại để còn cứu dữ liệu
  assert.ok(fs.readdirSync(dir).some((f) => f.includes('.hong-')));

  fs.rmSync(dir, { recursive: true, force: true });
});

// ── Hàng đợi tên file theo tab ─────────────────────────────────────────────
test('Hàng đợi tên file tách biệt theo từng tab', () => {
  // Đây chính là lỗi "hai tab tải cùng lúc bị đổi chéo tên" của bản 1.7.0.
  const { DownloadManager } = require('../../src/flow/main/downloads');
  const dm = new DownloadManager({
    getSettings: () => ({}), findTabByWcId: () => null,
    notifyTab: () => {}, log: () => {}
  });

  dm.pushName('tab1', 'canh_01.mp4');
  dm.pushName('tab2', 'canh_99.mp4');
  dm.pushName('tab1', 'canh_02.mp4');

  assert.deepStrictEqual(dm.queueFor('tab1'), ['canh_01.mp4', 'canh_02.mp4']);
  assert.deepStrictEqual(dm.queueFor('tab2'), ['canh_99.mp4']);

  dm.clear('tab1');
  assert.deepStrictEqual(dm.queueFor('tab1'), []);
  assert.deepStrictEqual(dm.queueFor('tab2'), ['canh_99.mp4'], 'xoá tab1 không được đụng tab2');
});

test('Huỷ tên đã đặt trước chỉ gỡ đúng mục đó', () => {
  const { DownloadManager } = require('../../src/flow/main/downloads');
  const dm = new DownloadManager({
    getSettings: () => ({}), findTabByWcId: () => null,
    notifyTab: () => {}, log: () => {}
  });
  dm.pushName('tab1', 'a.mp4');
  dm.pushName('tab1', 'b.mp4');
  dm.popName('tab1', 'a.mp4');
  assert.deepStrictEqual(dm.queueFor('tab1'), ['b.mp4']);
});

test('Store bỏ thụt lề khi file lớn, và vẫn đọc lại được', () => {
  // Với 427 prompt, riêng phần thụt lề chiếm thêm hàng MB và phải ghi xuống
  // đĩa lại từ đầu sau MỖI lần lưu.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  const file = path.join(dir, 'd.json');

  const s = new Store(file);
  assert.strictEqual(s.prettyPrint, true, 'file nhỏ thì vẫn nên dễ đọc');

  s.set({ big: 'x'.repeat(3 * 1024 * 1024) });
  s.close();
  assert.strictEqual(s.prettyPrint, false, 'file lớn mà vẫn thụt lề');

  const s2 = new Store(file);
  assert.strictEqual(s2.get('big').big.length, 3 * 1024 * 1024, 'đọc lại bị mất dữ liệu');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Store chỉ cảnh báo dung lượng MỘT lần', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-store-'));
  const canhBao = [];
  const s = new Store(path.join(dir, 'd.json'), (m) => canhBao.push(m));

  s.checkSize(500 * 1024 * 1024);
  s.checkSize(510 * 1024 * 1024);
  s.checkSize(520 * 1024 * 1024);
  assert.strictEqual(canhBao.length, 1, 'cảnh báo lặp lại gây nhiễu nhật ký');

  s.checkSize(10 * 1024 * 1024);      // về mức bình thường -> đặt lại
  s.checkSize(500 * 1024 * 1024);
  assert.strictEqual(canhBao.length, 2, 'sau khi về mức thường thì phải báo lại được');

  fs.rmSync(dir, { recursive: true, force: true });
});

// ── Hợp đồng dữ liệu gửi cho engine ────────────────────────────────────────
// Đây là chỗ đã sai một lần và không có gì báo: engine nhận thiếu trường thì
// lặng lẽ ghi "No prompts to process!" rồi dừng, nhìn từ ngoài y như bấm Bắt
// đầu mà không có gì xảy ra.
const { buildJobs, splitJobs, buildStartMessage } = require('../../src/flow/main/jobs');

test('buildJobs đánh số từ 1, giữ nguyên nội dung', () => {
  const jobs = buildJobs(['một', 'hai', 'ba']);
  assert.deepStrictEqual(jobs, [
    { index: 1, text: 'một' },
    { index: 2, text: 'hai' },
    { index: 3, text: 'ba' }
  ]);
});

test('splitJobs chia liên tiếp, phần dư dồn cho tab đầu', () => {
  const jobs = buildJobs(Array.from({ length: 7 }, (_, i) => 'p' + (i + 1)));
  const parts = splitJobs(jobs, 3);

  assert.strictEqual(parts.length, 3);
  assert.deepStrictEqual(parts.map((p) => p.length), [3, 2, 2]);

  // Liên tiếp, không xen kẽ: tab đầu phải nhận 1,2,3 chứ không phải 1,4,7
  assert.deepStrictEqual(parts[0].map((j) => j.index), [1, 2, 3]);
  assert.deepStrictEqual(parts[1].map((j) => j.index), [4, 5]);
  assert.deepStrictEqual(parts[2].map((j) => j.index), [6, 7]);
});

test('splitJobs không tạo phần rỗng khi tab nhiều hơn prompt', () => {
  const parts = splitJobs(buildJobs(['a', 'b']), 5);
  assert.strictEqual(parts.length, 2);
  assert.ok(parts.every((p) => p.length > 0));
});

test('splitJobs với danh sách rỗng trả về rỗng', () => {
  assert.deepStrictEqual(splitJobs(buildJobs([]), 3), []);
});

test('Không sót prompt nào khi chia', () => {
  const prompts = Array.from({ length: 427 }, (_, i) => 'prompt ' + (i + 1));
  const parts = splitJobs(buildJobs(prompts), 4);
  const all = parts.flat().map((j) => j.index);
  assert.strictEqual(all.length, 427);
  assert.deepStrictEqual(all, Array.from({ length: 427 }, (_, i) => i + 1));
});

test('buildStartMessage có ĐỦ ba trường engine đọc', () => {
  const prompts = ['một', 'hai', 'ba', 'bốn'];
  const parts = splitJobs(buildJobs(prompts), 2);
  const msg = buildStartMessage(prompts, parts[1], { renameMaxLen: 30 });

  assert.strictEqual(msg.action, 'START_AUTOMATION');
  // Thiếu bất kỳ trường nào dưới đây là engine dừng im lặng.
  assert.ok(Array.isArray(msg.data.prompts), 'thiếu data.prompts');
  assert.ok(Array.isArray(msg.data.videosToCreate), 'thiếu data.videosToCreate');
  assert.ok(msg.data.settings && typeof msg.data.settings === 'object', 'thiếu data.settings');
});

test('data.prompts phải giữ danh sách ĐẦY ĐỦ, không cắt theo tab', () => {
  // Engine tra prompts[index - 1] theo số thứ tự TOÀN CỤC. Gửi danh sách đã
  // cắt thì tab thứ hai trở đi tra nhầm ô, và tên file lệch hết.
  const prompts = ['một', 'hai', 'ba', 'bốn'];
  const parts = splitJobs(buildJobs(prompts), 2);
  const msg = buildStartMessage(prompts, parts[1], {});

  assert.strictEqual(msg.data.prompts.length, 4, 'danh sách prompt bị cắt');

  const job = msg.data.videosToCreate[0];
  assert.strictEqual(job.index, 3);
  assert.strictEqual(msg.data.prompts[job.index - 1], job.text,
    'prompts[index-1] không khớp với text của việc');
});

test('videosToCreate đúng hình dạng { index, text }', () => {
  const msg = buildStartMessage(['a', 'b'], buildJobs(['a', 'b']), {});
  for (const j of msg.data.videosToCreate) {
    assert.strictEqual(typeof j.index, 'number');
    assert.strictEqual(typeof j.text, 'string');
  }
});

// ── Chia việc cho nhiều tài khoản ──────────────────────────────────────────
const { planRun } = require('../../src/flow/main/jobs');

const TABS_2TK = [
  { id: 't1', accountId: 'a' }, { id: 't2', accountId: 'a' },
  { id: 't3', accountId: 'b' }, { id: 't4', accountId: 'b' }
];

test('Kiểu "split" chia liên tiếp cho mọi tab, bất kể tài khoản', () => {
  const ke = planRun(Array.from({ length: 8 }, (_, i) => 'p' + (i + 1)), TABS_2TK, 'split');
  assert.strictEqual(ke.length, 4);
  assert.deepStrictEqual(ke.map((k) => k.part.length), [2, 2, 2, 2]);
  assert.deepStrictEqual(ke[0].part.map((j) => j.index), [1, 2]);
});

test('Kiểu "account" chia cho tài khoản trước, rồi mới chia trong tài khoản', () => {
  const ke = planRun(Array.from({ length: 8 }, (_, i) => 'p' + (i + 1)), TABS_2TK, 'account');

  const cuaA = ke.filter((k) => k.accountId === 'a').flatMap((k) => k.part.map((j) => j.index));
  const cuaB = ke.filter((k) => k.accountId === 'b').flatMap((k) => k.part.map((j) => j.index));

  // Mỗi tài khoản ôm một dải LIỀN MẠCH — đây là điểm khác cốt lõi so với 'split'
  assert.deepStrictEqual(cuaA.sort((x, y) => x - y), [1, 2, 3, 4]);
  assert.deepStrictEqual(cuaB.sort((x, y) => x - y), [5, 6, 7, 8]);
});

test('Chia theo tài khoản không sót và không trùng prompt nào', () => {
  const prompts = Array.from({ length: 427 }, (_, i) => 'p' + (i + 1));
  const ke = planRun(prompts, TABS_2TK, 'account');
  const tatCa = ke.flatMap((k) => k.part.map((j) => j.index)).sort((x, y) => x - y);
  assert.strictEqual(tatCa.length, 427, 'sót hoặc trùng prompt');
  assert.deepStrictEqual(tatCa, Array.from({ length: 427 }, (_, i) => i + 1));
});

test('Tài khoản có nhiều tab hơn vẫn chia đúng trong nội bộ', () => {
  const tabs = [
    { id: 't1', accountId: 'a' },
    { id: 't2', accountId: 'b' }, { id: 't3', accountId: 'b' }, { id: 't4', accountId: 'b' }
  ];
  const ke = planRun(Array.from({ length: 12 }, (_, i) => 'p' + (i + 1)), tabs, 'account');

  const cuaA = ke.filter((k) => k.accountId === 'a');
  const cuaB = ke.filter((k) => k.accountId === 'b');

  // Hai tài khoản chia đôi 12 -> mỗi bên 6; bên B lại chia 6 cho 3 tab -> 2/tab
  assert.strictEqual(cuaA[0].part.length, 6);
  assert.deepStrictEqual(cuaB.map((k) => k.part.length), [2, 2, 2]);
});

test('Không tab nào nhận phần rỗng', () => {
  const ke = planRun(['một', 'hai'], TABS_2TK, 'split');
  assert.ok(ke.every((k) => k.part.length > 0));
  assert.strictEqual(ke.length, 2, 'chỉ 2 prompt thì chỉ 2 tab có việc');
});

test('Không có prompt hoặc không có tab thì kế hoạch rỗng', () => {
  assert.deepStrictEqual(planRun([], TABS_2TK, 'account'), []);
  assert.deepStrictEqual(planRun(['a'], [], 'account'), []);
});

// ── Hợp đồng dữ liệu của lệnh ảnh ──────────────────────────────────────────
// handleCheckAssetNames(payload) trong flow-engine.js đọc payload.names và đòi
// mảng CHUỖI. Đưa mảng object vào là nó trả "Chưa có tên ảnh nào để kiểm tra"
// — im lặng đúng kiểu đã làm nút Bắt đầu không làm gì.
const { buildImageNames } = require('../../src/flow/main/jobs');

test('buildImageNames cho ra mảng CHUỖI, không phải object', () => {
  const names = buildImageNames({ files: [{ name: '01.png', path: '/x/01.png' }, { name: '02.png', path: '/x/02.png' }] });
  assert.deepStrictEqual(names, ['01.png', '02.png']);
  assert.ok(names.every((n) => typeof n === 'string'), 'còn lọt object vào danh sách tên');
});

test('buildImageNames chấp nhận cả mảng chuỗi sẵn', () => {
  assert.deepStrictEqual(buildImageNames({ files: ['a.png', 'b.png'] }), ['a.png', 'b.png']);
});

test('buildImageNames bỏ mục hỏng thay vì ném lỗi', () => {
  assert.deepStrictEqual(
    buildImageNames({ files: [{ name: 'a.png' }, null, {}, { name: '' }, 'b.png'] }),
    ['a.png', 'b.png']
  );
  assert.deepStrictEqual(buildImageNames({}), []);
  assert.deepStrictEqual(buildImageNames(null), []);
});


// ── Ảnh → Video ────────────────────────────────────────────────────────────
const { buildI2vNames, invalidI2vNames, buildI2vPrompts } = require('../../src/flow/main/jobs');

test('buildI2vNames đệm số 0 và ghép tiền/hậu tố', () => {
  assert.deepStrictEqual(
    buildI2vNames({ from: 1, to: 3, pad: 2, prefix: 'anh' }),
    ['anh01', 'anh02', 'anh03']);
  assert.deepStrictEqual(
    buildI2vNames({ from: 8, to: 11, pad: 3, prefix: 'c', suffix: '_v2' }),
    ['c008_v2', 'c009_v2', 'c010_v2', 'c011_v2']);
});

test('buildI2vNames chặn khoảng vô lý', () => {
  assert.deepStrictEqual(buildI2vNames({ from: 5, to: 1 }), [], 'to < from');
  assert.deepStrictEqual(buildI2vNames({ from: 1, to: 100000 }), [], 'khoảng quá lớn');
  assert.deepStrictEqual(buildI2vNames({ from: 'x', to: 3 }), []);
});

test('invalidI2vNames bắt mã làm hỏng @tag của Character Sync', () => {
  // Dấu cách và gạch nối làm Flow cắt @tag giữa chừng rồi lấy nhầm ảnh.
  assert.deepStrictEqual(
    invalidI2vNames(['ok_1', 'Ảnh01', 'co dau cach', 'gach-noi', 'cham.png']),
    ['co dau cach', 'gach-noi', 'cham.png']);
  assert.deepStrictEqual(invalidI2vNames(['a1', 'b2']), []);
});

test('buildI2vPrompts đặt @mã ở CUỐI câu', () => {
  const p = buildI2vPrompts(['a01', 'a02'], 'cho ảnh chuyển động nhẹ');
  assert.deepStrictEqual(p, [
    'cho ảnh chuyển động nhẹ @a01',
    'cho ảnh chuyển động nhẹ @a02'
  ]);
});

test('buildI2vPrompts ưu tiên câu lệnh riêng từng ảnh', () => {
  const p = buildI2vPrompts(['a01', 'a02', 'a03'], 'chung', ['riêng 1', '', 'riêng 3']);
  assert.deepStrictEqual(p, ['riêng 1 @a01', 'chung @a02', 'riêng 3 @a03']);
});

test('buildI2vPrompts không có câu lệnh thì vẫn ra @mã hợp lệ', () => {
  assert.deepStrictEqual(buildI2vPrompts(['a01'], ''), ['@a01']);
  assert.deepStrictEqual(buildI2vPrompts(['a01'], '   '), ['@a01']);
});

test('Chuỗi ảnh→video: mỗi tab chỉ nối ĐÚNG mã ảnh của phần nó nhận', () => {
  // Đây là điều kiện để nhiều tab chạy chuỗi song song mà không lẫn ảnh.
  const prompts = Array.from({ length: 6 }, (_, i) => 'p' + (i + 1));
  const maAnh = buildI2vNames({ from: 1, to: 6, pad: 2 });      // 01..06
  const tabs = [{ id: 't1', accountId: 'a' }, { id: 't2', accountId: 'b' }];
  const ke = planRun(prompts, tabs, 'account');

  const cuaT1 = ke.find((k) => k.tabId === 't1').part.map((j) => maAnh[j.index - 1]);
  const cuaT2 = ke.find((k) => k.tabId === 't2').part.map((j) => maAnh[j.index - 1]);

  assert.deepStrictEqual(cuaT1, ['01', '02', '03']);
  assert.deepStrictEqual(cuaT2, ['04', '05', '06']);
  assert.strictEqual(new Set([...cuaT1, ...cuaT2]).size, 6, 'có mã ảnh bị trùng giữa hai tab');
});

// ── Tên ảnh Flow sẽ đặt ────────────────────────────────────────────────────
// Đây là chỗ bản 2.3.0 sai và chỉ lộ ra sau khi mẻ ảnh đã chạy xong: app in
// "(001 → 002)" trong khi kho Flow hiện "01", "02". Mọi mong đợi dưới đây lấy
// từ generateFileName() trong flow-engine.js, không phải tôi tự nghĩ ra.
const { tenAnhTheoRename } = require('../../src/flow/main/jobs');

const VIEC = (n, bd = 1) =>
  Array.from({ length: n }, (_, i) => ({ index: bd + i, text: 'canh quay ' + (bd + i) }));

test('index_only + outputCount=1 -> "01","02" chứ KHÔNG phải "001"', () => {
  const t = tenAnhTheoRename(
    { renameMode: 'index_only', renameIndexPad: 2, outputCount: 1 }, VIEC(2));
  assert.deepStrictEqual(t, ['01', '02']);
});

test('index_only mặc định pad=2 khi không khai báo', () => {
  const t = tenAnhTheoRename({ renameMode: 'index_only', outputCount: 1 }, VIEC(3));
  assert.deepStrictEqual(t, ['01', '02', '03']);
});

test('index_only ghép tiền tố và hậu tố bằng dấu gạch dưới', () => {
  const t = tenAnhTheoRename({
    renameMode: 'index_only', renameIndexPad: 3, renamePrefix: 'Canh',
    renameSuffix: 'v2', outputCount: 1
  }, VIEC(2));
  assert.deepStrictEqual(t, ['Canh_001_v2', 'Canh_002_v2']);
});

test('renameStartIndex dịch cả dải số', () => {
  const t = tenAnhTheoRename(
    { renameMode: 'index_only', renameIndexPad: 2, renameStartIndex: 10, outputCount: 1 }, VIEC(3));
  assert.deepStrictEqual(t, ['10', '11', '12']);
});

test('outputCount > 1 thì mỗi prompt sinh nhiều ảnh, có đuôi _1 _2', () => {
  const t = tenAnhTheoRename(
    { renameMode: 'index_only', renameIndexPad: 2, outputCount: 2 }, VIEC(2));
  assert.deepStrictEqual(t, ['01_1', '01_2', '02_1', '02_2']);
});

test('tên ảnh bám theo số thứ tự TOÀN CỤC, không phải vị trí trong mẻ', () => {
  // Tab 2 nhận prompt 4–6: tên phải là 04,05,06 chứ không phải 01,02,03.
  const t = tenAnhTheoRename(
    { renameMode: 'index_only', renameIndexPad: 2, outputCount: 1 }, VIEC(3, 4));
  assert.deepStrictEqual(t, ['04', '05', '06']);
});

test('số ở đầu câu lệnh được ưu tiên, đúng như engine làm', () => {
  const t = tenAnhTheoRename(
    { renameMode: 'index_only', renameIndexPad: 2, outputCount: 1 },
    [{ index: 1, text: '12) một cảnh biển' }]);
  assert.deepStrictEqual(t, ['12']);
});

test('custom_list lấy đúng dòng theo số thứ tự', () => {
  const t = tenAnhTheoRename({
    renameMode: 'custom_list', renameCustomList: 'alpha\nbeta\ngamma', outputCount: 1
  }, VIEC(3));
  assert.deepStrictEqual(t, ['alpha', 'beta', 'gamma']);
});

test('chế độ mặc định sinh tên dài — và ta phát hiện được là @tag hỏng', () => {
  const t = tenAnhTheoRename({ renameMode: 'default', renameMaxLen: 30, outputCount: 1 },
    [{ index: 1, text: 'một cảnh biển rất đẹp' }]);
  assert.strictEqual(t.length, 1);
  assert.ok(t[0].startsWith('01_'), `tên phải bắt đầu bằng "01_", đang là ${t[0]}`);
  // Chính vì thế giao diện phải cảnh báo nên dùng "Chỉ số thứ tự".
  assert.ok(t[0].length > 4);
});

test('mã ảnh sinh ra ở index_only luôn hợp cú pháp @tag', () => {
  const t = tenAnhTheoRename({
    renameMode: 'index_only', renameIndexPad: 2, renamePrefix: 'Cảnh', outputCount: 1
  }, VIEC(3));
  assert.deepStrictEqual(invalidI2vNames(t), [], `có mã sai cú pháp: ${t.join(', ')}`);
});

test('nối ảnh→video từ tên suy ra: mã trong prompt khớp tên ảnh', () => {
  const s = { renameMode: 'index_only', renameIndexPad: 2, outputCount: 1 };
  const ten = tenAnhTheoRename(s, VIEC(2));
  const p = buildI2vPrompts(ten, 'cho ảnh chuyển động nhẹ');
  assert.deepStrictEqual(p, [
    'cho ảnh chuyển động nhẹ @01',
    'cho ảnh chuyển động nhẹ @02'
  ]);
});

// ── Cài đặt cho mẻ video nối tiếp ──────────────────────────────────────────
// Lỗi thật, bản 2.4.0: người dùng bật "Đồng bộ khung hình đầu/cuối", chuỗi
// ảnh→video nối tiếp giữ nguyên khoá đó, và engine ném lỗi ở MỌI prompt —
// 30/30 hỏng, không cái nào qua được bước dán:
//     ❌ Lỗi Khung hình: Bạn cần gắn thẻ 2 ảnh (@bắt_đầu @kết_thúc) trong Prompt!
// Vì prompt của chuỗi chỉ có đúng một thẻ @mã: mỗi video dựng từ một ảnh.
const { caiDatChuoiVideo } = require('../../src/flow/main/jobs');

test('chuỗi ảnh→video TẮT đồng bộ khung hình (đòi 2 thẻ @, chuỗi chỉ có 1)', () => {
  const { settings } = caiDatChuoiVideo({ keyframeSync: true, runMode: 'image' });
  assert.strictEqual(settings.keyframeSync, false);
});

test('tắt đồng bộ khung hình thì phải NÓI ra, không sửa lén', () => {
  const { daTat } = caiDatChuoiVideo({ keyframeSync: true });
  assert.strictEqual(daTat.length, 1);
  assert.ok(/khung hình/i.test(daTat[0]), `lời nhắn khó hiểu: ${daTat[0]}`);
});

test('vốn đã tắt thì không nhắn gì cho rối', () => {
  const { daTat } = caiDatChuoiVideo({ keyframeSync: false });
  assert.deepStrictEqual(daTat, []);
});

test('chuỗi luôn ép runMode=video và charSync=true', () => {
  // charSync là thứ khiến Flow lấy đúng ảnh @mã ra dùng. Tắt thì video sinh
  // ra từ chữ, chẳng liên quan gì tới mẻ ảnh vừa tạo.
  const { settings } = caiDatChuoiVideo({ runMode: 'image', charSync: false });
  assert.strictEqual(settings.runMode, 'video');
  assert.strictEqual(settings.charSync, true);
});

test('chuỗi giữ nguyên mọi cài đặt khác của bộ Video', () => {
  const { settings } = caiDatChuoiVideo({
    downloadQuality: '1080p', downloadSubfolder: 'Video/{date}',
    renameIndexPad: 3, multiTab: true, voiceSync: true
  });
  assert.strictEqual(settings.downloadQuality, '1080p');
  assert.strictEqual(settings.downloadSubfolder, 'Video/{date}');
  assert.strictEqual(settings.renameIndexPad, 3);
  assert.strictEqual(settings.multiTab, true);
  assert.strictEqual(settings.voiceSync, true);
});

test('caiDatChuoiVideo không sửa object gốc', () => {
  const goc = { keyframeSync: true, runMode: 'image' };
  caiDatChuoiVideo(goc);
  assert.strictEqual(goc.keyframeSync, true, 'đã sửa nhầm vào object của người gọi');
  assert.strictEqual(goc.runMode, 'image');
});

test('prompt chuỗi chỉ có ĐÚNG MỘT thẻ @ — nền tảng của hai bài trên', () => {
  const ten = tenAnhTheoRename({ renameMode: 'index_only', renameIndexPad: 2, outputCount: 1 },
    [{ index: 1, text: 'a' }, { index: 2, text: 'b' }]);
  for (const p of buildI2vPrompts(ten, 'cho ảnh chuyển động')) {
    const so = (p.match(/@/g) || []).length;
    assert.strictEqual(so, 1, `prompt có ${so} thẻ @: ${p}`);
  }
});

// ── Cấu hình đóng gói .exe ─────────────────────────────────────────────────
//
//  Không build được .exe ở đây (cần Windows hoặc wine), nhưng ĐÚNG HAI thứ
//  trong cấu hình từng làm hỏng bản build, và cả hai kiểm được bằng node:
//
//   1. publish phải là null. Không đặt thì electron-builder chạy thêm bước
//      sinh metadata cập nhật rồi NGÃ với
//          Cannot read properties of null (reading 'channel')
//      NGAY SAU KHI đã ghi xong cả hai file .exe. Mã thoát khác 0 nên
//      BUILD_EXE.bat báo "BUILD THAT BAI" dù file đã nằm sẵn trong dist —
//      đúng kiểu lỗi làm người dùng tưởng build hỏng.
//
//   2. Phải có ĐỦ hai đích: nsis (bản cài) và portable (một file chạy thẳng).
//      Thiếu portable là mất đúng thứ người dùng xin: "1 file .exe hoàn chỉnh".
const PKG = require('../../package.json');

test('đóng gói: publish = null để build không ngã ở bước cuối', () => {
  assert.strictEqual(PKG.build.publish, null,
    'thiếu publish:null — build sẽ báo thất bại dù .exe đã tạo xong');
});

test('đóng gói: mang theo đủ mã nguồn app chạy được', () => {
  for (const f of ['main.js', 'src/**/*', 'package.json']) {
    assert.ok(PKG.build.files.includes(f), `thiếu "${f}" trong build.files`);
  }
});

test('đóng gói: bản cài KHÔNG xoá dữ liệu khi gỡ', () => {
  // Tài khoản, cài đặt và dự án nằm ở %APPDATA%. Gỡ app mà xoá luôn là mất
  // trắng — và người dùng thường gỡ chỉ để cài lại bản mới.
  assert.strictEqual(PKG.build.nsis.deleteAppDataOnUninstall, false);
});

test('đóng gói: bản cài cho phép chọn thư mục, không cài lén', () => {
  assert.strictEqual(PKG.build.nsis.oneClick, false);
  assert.strictEqual(PKG.build.nsis.allowToChangeInstallationDirectory, true);
});

// Bản gộp: gốc repo là tests/flow/../.. ; chỉ còn CHAY_TU_NGUON.bat + CAI_NODEJS.bat
// (bản .exe dựng trên GitHub Actions, không còn BUILD_EXE.bat).
const GOC = path.join(__dirname, '..', '..');

test('script .bat cần có đủ: chạy nguồn, cài Node', () => {
  // Người dùng xin giữ CHAY_TU_NGUON.bat làm đường dự phòng — nếu ai đó dọn
  // nhầm thì bài này kêu ngay.
  for (const f of ['CHAY_TU_NGUON.bat', 'CAI_NODEJS.bat']) {
    assert.ok(fs.existsSync(path.join(GOC, f)), `thiếu ${f}`);
  }
});

test('script chạy nguồn gọi CAI_NODEJS.bat trước khi làm gì', () => {
  for (const f of ['CHAY_TU_NGUON.bat']) {
    const noiDung = fs.readFileSync(path.join(GOC, f), 'utf8');
    assert.ok(/call "%HERE%CAI_NODEJS\.bat"/.test(noiDung),
      `${f} không gọi CAI_NODEJS.bat — người mới lại phải tự đi tìm Node.js`);
  }
});


// ============================================================================
//  Các file .bat — lỗi ở đây làm app KHÔNG MỞ ĐƯỢC, nên kiểm kỹ hơn cả code
//  --------------------------------------------------------------------------
//  Bản 2.5.0 vấp đúng ba cái bên dưới cùng lúc và người dùng bị kẹt ở bước
//  [1/5], màn hình đứng im không một chữ. Không có cách nào chạy .bat trong
//  bài kiểm thử này (đây là máy Linux), nên chặn ở mức đọc file — rẻ mà đủ
//  bắt lại đúng ba lỗi đó nếu ai vô tình viết lại.
// ============================================================================

const BAT = ['CAI_NODEJS.bat', 'CHAY_TU_NGUON.bat'];
const docBat = (f) => fs.readFileSync(path.join(GOC, f), 'utf8');

test('.bat: không đọc biến từ file bằng "set /p" (nguồn gốc lỗi treo 2.5.0)', () => {
  // "set /p BIEN=<file" gặp file rỗng thì KHÔNG báo lỗi — nó quay ra chờ
  // người dùng gõ phím. Màn hình đứng im, không dòng nào, nhìn hệt như treo.
  for (const f of BAT) {
    const dong = docBat(f).split(/\r?\n/)
      .filter((l) => !/^\s*REM/i.test(l) && /set\s+\/p\s+"?\w+\s*=\s*</i.test(l));
    assert.strictEqual(dong.length, 0,
      `${f} còn đọc biến từ file bằng set /p:\n       ${dong.join('\n       ')}`);
  }
});

test('.bat: không có chcp 65001 (làm hỏng chính set /p, và không cần)', () => {
  for (const f of BAT) {
    assert.ok(!/^\s*chcp\s+65001/mi.test(docBat(f)),
      `${f} còn chcp 65001 — mọi chữ trong file đều không dấu nên không cần`);
  }
});

test('.bat: xuống dòng kiểu Windows (CRLF)', () => {
  // File .bat chỉ có LF chạy chập chờn trên cmd.exe, hay gặp nhất là nhảy
  // nhầm nhãn goto. Zip giữ nguyên byte nên sai ở đây là tới tay người dùng.
  for (const f of BAT) {
    const b = fs.readFileSync(path.join(GOC, f));
    const lf = (b.toString('binary').match(/\n/g) || []).length;
    const crlf = (b.toString('binary').match(/\r\n/g) || []).length;
    assert.strictEqual(lf, crlf, `${f} có ${lf - crlf} dòng chỉ xuống bằng LF`);
  }
});

test('.bat: không có dấu ! lạc trên MỌI dòng lệnh (delayed expansion nuốt mất)', () => {
  // Bật EnableDelayedExpansion rồi thì cmd.exe ăn mất dấu "!" ở bất cứ đâu
  // trên dòng, không riêng gì lệnh echo:
  //
  //    echo [!] xong              → in ra "[] xong"
  //    7za x ... -xr!darwin -y    → 7za nhận "-xrdarwin": THAM SỐ SAI
  //
  // Cái thứ hai là lỗi thật, và nó im lặng: 7za bỏ chạy, không giải nén gì,
  // mà bước sau vẫn đi tiếp như không có chuyện gì. "^!" cũng không thoát
  // được khi dòng nằm trong khối (...). Hai cách đúng: đừng dùng "!", hoặc
  // bọc riêng dòng đó bằng setlocal DisableDelayedExpansion.
  for (const f of BAT) {
    const dong = docBat(f).split(/\r?\n/);
    let tatMoRong = false;
    for (const l of dong) {
      if (/^\s*setlocal\s+DisableDelayedExpansion/i.test(l)) { tatMoRong = true; continue; }
      if (/^\s*endlocal/i.test(l)) { tatMoRong = false; continue; }
      if (tatMoRong) continue;                        // vùng đã tắt, "!" an toàn
      if (/^\s*REM/i.test(l) || !l.trim()) continue;
      // Bỏ các cách gọi biến HỢP LỆ trước khi soi phần còn lại:
      //   !BIEN!          lấy giá trị
      //   !BIEN:~0,1!     lấy vài ký tự đầu
      //   !BIEN:a=b!      thay chuỗi
      const con = l.replace(/![A-Za-z_]\w*(?::[^!]*)?!/g, '');
      assert.ok(!con.includes('!'),
        `${f} còn dấu ! lạc, cmd.exe sẽ nuốt mất:\n       ${l.trim()}`);
    }
  }
});

test('.bat: mọi setlocal DisableDelayedExpansion đều được đóng lại', () => {
  // Quên endlocal thì từ đó tới cuối file mọi "!BIEN!" đều không nở ra nữa,
  // và các bước sau lặng lẽ chạy với biến rỗng.
  for (const f of BAT) {
    let mo = 0;
    for (const l of docBat(f).split(/\r?\n/)) {
      if (/^\s*REM/i.test(l)) continue;
      if (/^\s*setlocal\s+DisableDelayedExpansion/i.test(l)) mo++;
      else if (/^\s*endlocal/i.test(l) && mo > 0) mo--;
    }
    assert.strictEqual(mo, 0, `${f} có ${mo} setlocal DisableDelayedExpansion chưa đóng`);
  }
});

test('.bat: không có dấu ngoặc chưa thoát trong lệnh echo', () => {
  // LỖI THẬT, bản 2.6.1: cửa sổ tự biến mất ở bước [4/6], nhật ký dừng ngay
  // tại dòng đó. Thủ phạm là MỘT dòng echo nằm trong khối else:
  //
  //     ) else (
  //         echo    Dang tai bo cong cu (khoang 5,6 MB)...
  //
  // Dấu ")" sau chữ MB ĐÓNG KHỐI else giữa chừng. Phần còn lại thành cú pháp
  // rác, cmd.exe bỏ chạy cả file và đóng cửa sổ ngay — không in nổi một chữ,
  // nên người dùng không có gì để gửi đi cả.
  //
  // Chỉ cấm trong khối thì vẫn còn bẫy: một dòng echo hôm nay ở ngoài, mai bị
  // chuyển vào khối là hỏng lại. Nên cấm hẳn: mọi dấu ngoặc trong chữ in ra
  // đều phải viết "^(" và "^)".
  for (const f of BAT) {
    for (const l of docBat(f).split(/\r?\n/)) {
      if (!/^\s*echo\s/i.test(l) || /^\s*REM/i.test(l)) continue;
      const t = l.replace(/"[^"]*"/g, '')          // ngoặc trong dấu nháy thì an toàn
                 .replace(/\^\(/g, '').replace(/\^\)/g, '');  // đã thoát rồi
      assert.ok(!/[()]/.test(t),
        `${f} có dấu ngoặc chưa thoát trong echo — sẽ đóng khối sớm:\n       ${l.trim()}`);
    }
  }
});

test('.bat: không nối dòng bằng ^ bên trong khối ( )', () => {
  // Cùng gốc với lỗi trên: cmd.exe đọc cả khối ( ) thành MỘT lệnh trước khi
  // chạy, và dấu ^ cuối dòng trong đó không còn đáng tin. Lệnh powershell
  // nhiều dòng của bản 2.6.1 nằm đúng trong một khối else.
  for (const f of BAT) {
    let sau = 0;
    for (const l of docBat(f).split(/\r?\n/)) {
      if (/^\s*REM/i.test(l)) continue;
      const t = l.replace(/"[^"]*"/g, '');
      if (sau > 0 && /\^\s*$/.test(l)) {
        assert.fail(`${f} nối dòng bằng ^ khi đang ở trong khối ( ):\n       ${l.trim()}`);
      }
      sau += (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
      if (sau < 0) sau = 0;
    }
  }
});

test('.bat: file chạy nguồn có lớp bọc giữ cửa sổ lại khi gặp sự cố', () => {
  // Lỗi cú pháp làm cmd.exe đóng cửa sổ ngay, người dùng không đọc được gì.
  // Lớp bọc tự gọi lại chính mình trong cửa sổ con: con có chết thì cha vẫn
  // còn, mang theo dòng báo lỗi.
  for (const f of ['CHAY_TU_NGUON.bat']) {
    const s = docBat(f);
    assert.ok(/if "%~1"=="--trong" goto :chinh/.test(s), `${f} thiếu lớp bọc giữ cửa sổ`);
    assert.ok(/cmd \/c ""%~f0" --trong"/.test(s), `${f} không tự gọi lại trong cửa sổ con`);
    assert.ok(/^:chinh\s*$/m.test(s), `${f} thiếu nhãn :chinh`);
    // Và phải thoát sớm khi chạy ngon, nếu không lần nào cũng bắt bấm phím.
    assert.ok(/if "%RC%"=="0" exit \/b 0/.test(s), `${f} chạy ngon vẫn bắt bấm phím`);
  }
});

test('.bat: mọi goto/call :nhãn đều có nhãn thật', () => {
  for (const f of BAT) {
    const s = docBat(f);
    const nhan = new Set([...s.matchAll(/^:(\w+)/gm)].map((m) => m[1].toLowerCase()));
    for (const m of s.matchAll(/\b(?:goto|call)\s+:(\w+)/g)) {
      const t = m[1].toLowerCase();
      if (t === 'eof') continue;
      assert.ok(nhan.has(t), `${f} nhảy tới :${m[1]} mà không có nhãn đó`);
    }
  }
});

// ============================================================================
//  Chế độ an toàn
// ============================================================================

const anToan = require('../../src/flow/main/an-toan');

test('an toàn: nhận ra câu Flow báo hoạt động bất thường', () => {
  assert.ok(anToan.laCanhBaoChan(
    'Chúng tôi nhận thấy có hoạt động bất thường nào đó. Vui lòng truy cập Trung tâm trợ giúp.'));
  assert.ok(anToan.laCanhBaoChan('We detected unusual activity from your account'));
  assert.ok(anToan.laCanhBaoChan('Too many requests'));
  // Lỗi thường của Flow thì KHÔNG được coi là bị chặn — nghỉ 10 phút vì một
  // prompt phạm chính sách là phí thời gian của người dùng.
  assert.ok(!anToan.laCanhBaoChan('Không thành công (Policy/Error)'));
  assert.ok(!anToan.laCanhBaoChan('Tạo thất bại'));
  assert.ok(!anToan.laCanhBaoChan(''));
  assert.ok(!anToan.laCanhBaoChan(null));
});

test('an toàn: danh sách câu cảnh báo hai bên KHÔNG được lệch nhau', () => {
  // flow-canh-bao.js chạy trong trang Flow nên phải chép lại danh sách. Chép
  // thì có ngày lệch, nên đối chiếu ngay tại đây.
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'flow', 'inject', 'flow-canh-bao.js'), 'utf8');
  const khoi = src.match(/var CUM_TU = \[([\s\S]*?)\];/);
  assert.ok(khoi, 'không tìm thấy danh sách CUM_TU trong flow-canh-bao.js');
  const ben = [...khoi[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepStrictEqual(ben, anToan.CUM_TU_CHAN,
    'danh sách câu cảnh báo bên trang và bên tiến trình chính đã lệch nhau');
});

test('an toàn: đếm lỗi KHÔNG đếm trùng khi engine gửi lại cả bảng', () => {
  // Engine gửi lại NGUYÊN bảng vài giây một lần. Đếm thẳng thì một lỗi duy
  // nhất cũng vượt ngưỡng trong nháy mắt và app tự dừng oan.
  const daDem = new Set();
  const rows = [
    { index: 1, status: 'COMPLETED' },
    { index: 2, status: 'ERROR', error: 'Không thành công (Policy/Error)', retries: 0 }
  ];
  assert.strictEqual(anToan.loiMoi(rows, daDem).length, 1);
  assert.strictEqual(anToan.loiMoi(rows, daDem).length, 0, 'đếm lại lần hai');
  assert.strictEqual(anToan.loiMoi(rows, daDem).length, 0, 'đếm lại lần ba');
  // Nhưng engine THỬ LẠI rồi hỏng nữa thì đó là một lần gõ cửa mới thật.
  rows[1].retries = 1;
  assert.strictEqual(anToan.loiMoi(rows, daDem).length, 1);
});

test('tài khoản lỗi: đếm prompt KHÁC NHAU hỏng liền nhau — một prompt thử lại nhiều lần không làm oan tài khoản', () => {
  const c = anToan.chuanHoaCaiDat({ nguong: 2 });
  const so = anToan.soMoi();
  so.promptLoi.add('tab#1#3');
  so.promptLoi.add('tab#1#3');                        // cùng prompt hỏng lần thử thứ hai
  assert.strictEqual(anToan.canNghi(so, Date.now(), c).nghi, false);
  so.promptLoi.add('tab#1#4');                        // prompt khác hỏng tiếp → tài khoản hỏng
  const qd = anToan.canNghi(so, Date.now(), c);
  assert.strictEqual(qd.nghi, true);
  assert.strictEqual(qd.soLoi, 2);
});

test('tài khoản lỗi: có prompt XONG xen giữa thì đếm lại từ đầu', () => {
  const daDem = new Set();
  assert.deepStrictEqual(anToan.xongMoi([{ index: 1, status: 'COMPLETED' }, { index: 2, status: 'ERROR' }], daDem), [1]);
  assert.deepStrictEqual(anToan.xongMoi([{ index: 1, status: 'COMPLETED' }], daDem), [], 'bảng gửi lại thì không đếm trùng');
  const so = anToan.soMoi();
  so.promptLoi.add('a'); so.coCauChan = true;
  anToan.xoaDauLoi(so);
  assert.strictEqual(so.promptLoi.size, 0);
  assert.strictEqual(so.coCauChan, false);
});

test('tài khoản lỗi: Flow nói "hoạt động bất thường" / hết tín dụng thì đổi ngay từ lỗi đầu', () => {
  const c = anToan.chuanHoaCaiDat({ nguong: 10 });
  const so = anToan.soMoi();
  so.coCauChan = true;
  assert.strictEqual(anToan.canNghi(so, Date.now(), c).nghi, false, 'chưa có prompt nào hỏng thì chưa đổi');
  so.promptLoi.add('x');
  const qd = anToan.canNghi(so, Date.now(), c);
  assert.strictEqual(qd.nghi, true);
  assert.strictEqual(qd.chacChan, true);
  assert.ok(anToan.laHetLuot('You do not have enough credits. Not enough credits to generate'));
  assert.ok(anToan.laHetLuot('Bạn không đủ tín dụng'));
  assert.ok(!anToan.laHetLuot('Không thành công (Policy/Error)'));
  // Chữ lỗi của engine nói hết tín dụng → lỗi đó "chắc chắn" là lỗi tài khoản.
  assert.strictEqual(anToan.loiMoi([{ index: 1, status: 'ERROR', error: 'Out of credits' }], new Set())[0].chacChan, true);
});

test('tài khoản lỗi: đang nghỉ rồi thì không xếp thêm lần nghỉ nữa', () => {
  const c = anToan.chuanHoaCaiDat({ nguong: 1 });
  const so = anToan.soMoi();
  so.dangNghi = true;
  so.promptLoi.add('x');
  assert.strictEqual(anToan.canNghi(so, Date.now(), c).nghi, false);
});

test('tài khoản lỗi: nghỉ gấp đôi khi bị lại, tối đa 4 lần số phút đặt', () => {
  const c = anToan.chuanHoaCaiDat({ nghiPhut: 15 });
  assert.deepStrictEqual([0, 1, 2, 3, 99].map((n) => anToan.thoiGianNghi(n, c) / 60000), [15, 30, 60, 60, 60]);
});

test('tài khoản lỗi: gõ bậy vào ô số thì lấy mặc định; khoá cũ của chế độ an toàn bị bỏ', () => {
  const c = anToan.chuanHoaCaiDat({ nguong: 'ba', nghiPhut: null, bat: false, cuaSoPhut: 5, cuMoi: 20 });
  assert.deepStrictEqual(c, { nguong: anToan.MAC_DINH.nguong, nghiPhut: anToan.MAC_DINH.nghiPhut });
  assert.strictEqual(anToan.chuanHoaCaiDat({ nguong: 9999 }).nguong, 10);
  assert.strictEqual(anToan.chuanHoaCaiDat({ nguong: -5 }).nguong, 1);
});

test('an toàn: càng nhiều tab thì nhịp càng thưa', () => {
  const a = anToan.nhipAnToan(1), b = anToan.nhipAnToan(3);
  assert.ok(b.delayMin > a.delayMin, '3 tab phải chờ lâu hơn 1 tab');
  assert.ok(b.delayMax > b.delayMin);
  assert.strictEqual(a.multiTabStagger, 0, 'một tab thì giãn cách giữa tab vô nghĩa');
  assert.ok(b.multiTabStagger > 0);
  // Hạ số lần thử lại là phần quan trọng nhất: lúc bị chặn, mỗi lần thử lại
  // là một lần gõ cửa nữa.
  assert.ok(a.maxRetries <= 3, 'nhịp an toàn phải hạ số lần thử lại');
  assert.strictEqual(a.randomScroll, true);
  assert.strictEqual(a.randomDelay, true);
});

test('an toàn: nhipAnToan chịu được số tab vô lý', () => {
  for (const v of [0, -3, null, undefined, 'hai', 999]) {
    const n = anToan.nhipAnToan(v);
    assert.ok(n.delayMin >= 20 && n.delayMin <= 200, `delayMin lạ với ${v}`);
  }
});

test('an toàn: đổi mili-giây sang chữ người đọc được', () => {
  assert.strictEqual(anToan.doDai(30000), '30 giây');
  assert.strictEqual(anToan.doDai(600000), '10 phút');
  assert.strictEqual(anToan.doDai(330000), '5 phút 30 giây');
});

// Bản gộp: các ô nằm ở Cài đặt → Google Flow (src/ui), app.js nối ô ↔ khoá bằng
// bảng O_FLOW_AN_TOAN, cài đặt lưu ở caiDat.flow.anToan (src/flow/cai-dat-flow.js).
/** Đọc bảng [['idÔ', 'khoá'], …] của Cài đặt → Google Flow trong src/ui/app.js. */
function bangOFlow(ten) {
  const app = docNguon('src', 'ui', 'app.js');
  const i = app.indexOf(`const ${ten} = [`);
  assert.ok(i >= 0, `không tìm thấy ${ten} trong src/ui/app.js`);
  const khoi = app.slice(i, app.indexOf('];', i));
  return [...khoi.matchAll(/\['(\w+)', '(\w+)'\]/g)].map((m) => [m[1], m[2]]);
}
const { FLOW_MAC_DINH, chuanHoaFlow, caiDatEngine } = require('../../src/flow/cai-dat-flow');

test('an toàn: giao diện có đủ ô, và trình dò cảnh báo được tiêm vào tab', () => {
  const html = docNguon('src', 'ui', 'index.html');
  const bang = bangOFlow('O_FLOW_AN_TOAN');
  for (const id of ['fNguong', 'fNghi']) {
    assert.ok(html.includes(`id="${id}"`), `giao diện thiếu ô #${id}`);
    assert.ok(bang.some(([o]) => o === id), `ô #${id} chưa nối vào O_FLOW_AN_TOAN — không lưu, không gửi đi`);
  }
  // 1.2.0: các ô của chế độ an toàn cũ đã bỏ hẳn (luôn bật, không cửa sổ phút, không giải lao).
  for (const id of ['fAnToan', 'fCuaSo', 'fNghiToiDa', 'fNhanDoi', 'fCuMoi', 'fGiaiLao']) assert.ok(!html.includes(`id="${id}"`), `ô cũ #${id} vẫn còn`);
  // 1.2.1: "Flow hỏng → Muse" thành công tắc chung Muse ⇄ Flow ở Cài đặt → Chạy (#cdDoiNen → caiDat.doiNenKhiLoi).
  assert.ok(!html.includes('id="fSangMuse"') && !bangOFlow('O_FLOW').some(([o]) => o === 'fSangMuse'), 'công tắc cũ #fSangMuse vẫn còn');
  assert.ok(html.includes('id="cdDoiNen"') && /doiNenKhiLoi:\s*\$\('#cdDoiNen'\)\.checked/.test(docNguon('src', 'ui', 'app.js')), 'thiếu công tắc Muse ⇄ Flow');
  // Khoá giao diện gửi PHẢI đúng khoá an-toan.js đọc, và có mặc định.
  const khoaDoc = Object.keys(anToan.chuanHoaCaiDat({})).sort();
  assert.deepStrictEqual([...new Set(bang.map(([, k]) => k))].sort(), khoaDoc, 'khoá ô an toàn lệch với an-toan.js');
  assert.deepStrictEqual(Object.keys(FLOW_MAC_DINH.anToan).sort(), khoaDoc, 'mặc định an toàn lệch với an-toan.js');
  // Đi tới tận engine/máy Flow: caiDatEngine mang anToan, chuanBiMe nạp nó trước khi giao mẻ.
  assert.strictEqual(caiDatEngine({ anToan: { nguong: 7 } }, { loai: 'anh', ten: [] }).anToan.nguong, 7);
  assert.ok(/datCaiDatAnToan\(settings\.anToan\)/.test(thanHam(docNguon('main.js'), 'async function chuanBiMe')),
    'chuanBiMe chưa nạp cài đặt an toàn của mẻ');
  const tabs = docNguon('src', 'main', 'tabs.js');
  assert.ok(/flow-canh-bao\.js/.test(tabs), 'tab-flow.js chưa nạp flow-canh-bao.js');
  assert.ok(/\['trình dò cảnh báo', n\.canhBao\]/.test(tabs), 'tab-flow.js chưa tiêm trình dò cảnh báo vào tab');
});

// Tạm dừng làm engine báo isRunning=false. Bản Flow cũ: main.js tưởng mẻ ảnh đã
// xong và nối sang video ngay giữa giờ nghỉ. Bản gộp: video chỉ được hàng đợi nối
// (dieu-phoi _noiVideo) khi một việc ảnh XONG có file — nên chốt chặn tương đương
// là: luồng Flow KHÔNG được kết thúc mẻ (báo xong/hỏng việc chưa xong) chỉ vì
// engine ngừng chạy lúc nghỉ hạ nhiệt, và gác "đứng im" không tính giờ nghỉ.
test('an toàn: nghỉ hạ nhiệt — luồng Flow không coi mẻ là xong, video chỉ nối từ ảnh đã có file', () => {
  const l = docNguon('src', 'flow', 'luong-flow.js');
  assert.ok(/if \(hetViecLuc && d && d\.isRunning === false\) ket\('xong'\)/.test(l),
    'onBang kết thúc mẻ khi isRunning=false mà chưa xong hết việc — nghỉ hạ nhiệt sẽ cắt mẻ');
  const gac = khoiGiua(l, 'const gac = setInterval(', '}, 5000);');
  const iNghi = gac.indexOf('if (t.nghiAnToan) { lanCuoi = Date.now(); return; }');
  assert.ok(iNghi > 0 && iNghi < gac.indexOf('this.dungYenMs'), 'gác đứng im tính cả giờ nghỉ hạ nhiệt — sẽ dừng mẻ giữa giờ nghỉ');
  const dp = docGoc('src', 'main', 'dieu-phoi.js');
  assert.strictEqual((dp.match(/this\._noiVideo\(/g) || []).length, 1, 'chỉ được nối video ở MỘT chỗ (việc ảnh xong)');
  assert.ok(/_noiVideo\(j, d\) \{\s*if \(j\.loai !== 'anh' \|\| !j\.chuoi \|\| j\.daNoiVideo \|\| !j\.files\[0\]\) return;/.test(dp),
    '_noiVideo phải đòi ảnh đã có file và chỉ nối một lần');
});

testAsync('an toàn: nghỉ hạ nhiệt — chạy thật LuongFlow: engine dừng giữa giờ nghỉ không kết thúc mẻ', async () => {
  const { LuongFlow } = require('../../src/flow/luong-flow');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-luong-'));
  const url = 'https://labs.google/fx/vi/tools/flow/project/thu';
  const wc = { isDestroyed: () => false, getURL: () => url, isLoading: () => false, executeJavaScript: async () => true };
  const tab = { id: 'flow1', ready: true, view: { webContents: wc } };
  let giao; const daGiao = new Promise((r) => { giao = r; });
  const tabs = { find: () => tab, taoTab: () => tab,
    dispatch: async (_id, m) => { if (m.action === 'START_AUTOMATION') giao(m); return { ok: true }; } };
  const may = { chuanBiMe: async (_t, s) => ({ ok: true, caiDat: s }) };
  const l = new LuongFlow({ id: 'L1', taiKhoan: { id: 'tk', ten: 'TK', flowUrl: url }, tabs, may, thuMucTam: dir });
  const kq = new Map();
  const j1 = { so: 1, loai: 'anh', tyLe: '16:9', prompt: 'a' }, j2 = { so: 2, loai: 'anh', tyLe: '16:9', prompt: 'b' };
  const ctx = { caiDat: {}, tenFile: (j) => `Viec_${j.so}`, anhCua: () => [], capNhat: () => {}, xong: (j, r) => kq.set(j.so, r) };
  const chay = l.chayMe([j1, j2], ctx);
  try {
    await daGiao;
    tab.onTai(path.join(dir, 'Viec_1.png'));
    tab.onBang([{ index: 1, status: 'COMPLETED', downloaded: true }, { index: 2, status: 'CREATING' }], { isRunning: true });
    assert.ok(kq.get(1) && kq.get(1).ok, 'việc 1 có file rồi phải báo xong');
    // Chế độ an toàn cho nghỉ: PAUSE → engine báo isRunning=false.
    tab.nghiAnToan = true;
    tab.onBang([{ index: 1, status: 'COMPLETED', downloaded: true }, { index: 2, status: 'CREATING' }], { isRunning: false });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(!kq.has(2), 'nghỉ hạ nhiệt mà việc 2 (chưa xong) đã bị báo kết quả');
    assert.ok(!l.ranh, 'nghỉ hạ nhiệt mà luồng đã nhả mẻ');
    // Hết giờ nghỉ, engine chạy tiếp và xong việc 2.
    tab.nghiAnToan = false;
    tab.onTai(path.join(dir, 'Viec_2.png'));
    tab.onBang([{ index: 1, status: 'COMPLETED', downloaded: true }, { index: 2, status: 'COMPLETED', downloaded: true }], { isRunning: false });
    await chay;
    assert.ok(kq.get(2) && kq.get(2).ok && kq.get(2).files[0].duongDan.endsWith('Viec_2.png'), 'việc 2 phải xong với đúng file của nó');
    assert.ok(l.ranh, 'xong mẻ thì luồng phải rảnh');
  } finally {
    if (l._ketMe) l._ketMe('dung');          // đừng để setInterval của gác giữ tiến trình
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Model video (2.8.0) ────────────────────────────────────────────────────
const modelKH = require('../../src/flow/main/model');
const LP = 'Veo 3.1 - Lite [Lower Priority]';
const LITE = 'Veo 3.1 - Lite';
const FAST = 'Veo 3.1 - Fast';

test('model: để trống thì KHÔNG đụng vào hộp chọn model (y như bản cũ)', () => {
  const k = modelKH.chuanHoaKeHoach({});
  assert.strictEqual(modelKH.coHieuLuc(k), false);
  assert.strictEqual(modelKH.chuanHoaKeHoach(undefined).thuLaiPhut, 30);
});

test('model: "Lite" và "Lite [Lower Priority]" là HAI model khác nhau (bẫy tiền tố)', () => {
  assert.ok(modelKH.laLowerPriority(LP));
  assert.ok(!modelKH.laLowerPriority(LITE));
  assert.ok(!modelKH.cungModel(LP, LITE));
  assert.ok(modelKH.cungModel(LITE, 'veo 3.1 – lite'));           // gạch dài, chữ thường
  assert.ok(modelKH.cungModel(LP, 'Veo 3.1 Lite (Lower priority)'));
});

test('model: khoá so sánh bên main GIỐNG HỆT bên trang Flow (flow-model.js)', () => {
  // Hai bản chạy ở hai nơi (tiến trình chính / trong trang) nên buộc phải là
  // hai bản chép. Lệch nhau là main tưởng đã đúng model trong khi trang chọn khác.
  const vm = require('vm');
  const cua = { window: {}, document: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'flow', 'inject', 'flow-model.js'), 'utf8'), cua);
  const khoaTrang = cua.window.__flowChuanHoaModel;
  for (const t of [LP, LITE, FAST, 'Veo 3.1 - Quality', 'Omni 1.1 Flash', 'volume_upVeo 3.1 - Lite', 'Véo 3.1 — Líte']) {
    assert.strictEqual(modelKH.khoaModel(t), khoaTrang(t), `lệch ở "${t}"`);
  }
});

test('model: xen kẽ N=2 là chính, phụ, chính, phụ', () => {
  const k = modelKH.chuanHoaKeHoach({ chinh: LP, phu: LITE, xenKeMoi: 2 });
  const ra = [1, 2, 3, 4].map((n) => modelKH.modelChoPrompt(k, n, false).model);
  assert.deepStrictEqual(ra, [LP, LITE, LP, LITE]);
});

test('model: xen kẽ N=3 là chính, chính, phụ', () => {
  const k = modelKH.chuanHoaKeHoach({ chinh: LP, phu: FAST, xenKeMoi: 3 });
  const ra = [1, 2, 3, 4, 5, 6].map((n) => modelKH.modelChoPrompt(k, n, false).model);
  assert.deepStrictEqual(ra, [LP, LP, FAST, LP, LP, FAST]);
});

test('model: xen kẽ thiếu model phụ hoặc N<2 thì tự tắt', () => {
  assert.strictEqual(modelKH.chuanHoaKeHoach({ chinh: LP, xenKeMoi: 2 }).xenKeMoi, 0);
  assert.strictEqual(modelKH.chuanHoaKeHoach({ chinh: LP, phu: LITE, xenKeMoi: 1 }).xenKeMoi, 0);
});

test('model: Lower Priority đang bị chặn → prompt mới dùng dự phòng, kể cả lượt xen kẽ', () => {
  const k = modelKH.chuanHoaKeHoach({ chinh: FAST, phu: LP, xenKeMoi: 2, duPhong: LITE });
  assert.strictEqual(modelKH.modelChoPrompt(k, 1, true).model, FAST);   // không phải LP thì giữ
  assert.strictEqual(modelKH.modelChoPrompt(k, 2, true).model, LITE);   // lượt LP → dự phòng
  assert.strictEqual(modelKH.modelChoPrompt(k, 2, false).model, LP);    // hết giờ tránh → LP lại
});

test('model: không có dự phòng thì vẫn là Lower Priority (để chế độ an toàn cho nghỉ)', () => {
  const k = modelKH.chuanHoaKeHoach({ chinh: LP });
  assert.strictEqual(modelKH.modelChoPrompt(k, 1, true).model, LP);
  assert.strictEqual(modelKH.nenChuyenDuPhong(k, LP), false);
});

test('model: dự phòng không được là chính Lower Priority', () => {
  assert.strictEqual(modelKH.chuanHoaKeHoach({ chinh: LP, duPhong: LP }).duPhong, '');
});

test('model: chỉ chuyển dự phòng khi ĐANG chạy Lower Priority', () => {
  const k = modelKH.chuanHoaKeHoach({ chinh: LP, duPhong: LITE });
  assert.strictEqual(modelKH.nenChuyenDuPhong(k, LP), true);
  // Đang chạy model tốn credit mà vẫn bị chặn = cả tài khoản bị nhắc → nghỉ.
  assert.strictEqual(modelKH.nenChuyenDuPhong(k, LITE), false);
  assert.strictEqual(modelKH.nenChuyenDuPhong(k, null), false);
});

test('model: tránh Lower Priority tăng dần 30 → 60 → 120 → trần 240 phút', () => {
  const ph = (n) => modelKH.thoiGianTranhLp(n, 30) / 60000;
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(ph), [30, 60, 120, 240, 240]);
});

test('model: nối dây trong máy Flow (may-flow.js) đủ các chỗ', () => {
  const m = docNguon('main.js');                         // → src/flow/may-flow.js
  const lay = (dau) => { const i = m.indexOf(dau); return i < 0 ? '' : m.slice(i, i + 2500); };
  // 1. Đổi model trong lượt xin bấm Tạo — lúc engine đứng chờ.
  assert.ok(/modelChoPrompt/.test(lay("case 'ACQUIRE_CREATE_SLOT'")), 'ACQUIRE_CREATE_SLOT chưa chọn model');
  // 2. Engine chỉ xin lượt khi giãn cách > 0 → phải ép tối thiểu 1 giây.
  // Soi TRỌN thân hàm, không phải 2.500 ký tự đầu: bước kiểm danh sách model
  // đầu mẻ (2.8.7) làm hàm dài ra và dòng ép giãn cách rơi ra ngoài cửa sổ cũ.
  const thanChuanBi = thanHam(m, 'async function chuanBiModel');
  assert.ok(thanChuanBi.length < 5000, 'cắt thân chuanBiModel sai');
  assert.ok(/multiTabStagger:\s*Math\.max\(1/.test(thanChuanBi), 'chưa ép giãn cách ≥ 1 giây');
  // 3. Bản gộp chỉ còn MỘT đường giao mẻ (luồng Flow → chuanBiMe → START_AUTOMATION; mẻ video nối
  //    sau ảnh nay là việc mới trong hàng đợi, cũng đi đường này): bộ cài đặt gửi engine phải là
  //    bộ đã qua chuanBiModel.
  const cb = thanHam(m, 'async function chuanBiMe');
  assert.ok(/kiemTruocKhiChay\(tab\.view\.webContents, await chuanBiModel\(tab, settings\)/.test(cb),
    'chuanBiMe chưa áp kế hoạch model vào bộ cài đặt giao cho engine');
  assert.ok(/return \{ ok: true, caiDat \}/.test(cb), 'chuanBiMe phải trả bộ cài đặt đã áp model');
  const l = docNguon('src', 'flow', 'luong-flow.js');
  assert.ok(/const cb = await this\.may\.chuanBiMe\(t, settings/.test(l) &&
    /buildStartMessage\(prompts, [^;]*, cb\.caiDat\)/.test(l), 'luồng Flow giao mẻ không qua chuanBiMe');
  // 4. Chuyển dự phòng TRƯỚC khi cho nghỉ.
  assert.ok(/thuChuyenDuPhong\(tab\.accountId, qd\)\) return;\s*\n\s*await batDauNghi/.test(m),
    'chế độ an toàn chưa thử chuyển dự phòng trước khi nghỉ');
  // 5. Đang chuyển dự phòng thì đánh dấu nghỉ (như lúc nghỉ) trước khi tạm dừng — gác đứng im của
  //    luồng Flow dựa vào cờ này để không cắt mẻ.
  assert.ok(/t\.nghiAnToan = true;\s*(nhipTT\.huy\(t\);\s*)?try \{ await tabs\.dispatch\(t\.id, \{ action: 'PAUSE_AUTOMATION' \}\)/.test(thanHam(m, 'async function thuChuyenDuPhong')),
    'chuyển dự phòng chưa đánh dấu nghiAnToan trước khi tạm dừng');
});

test('tải về kẹt: đếm từ file GẦN NHẤT của mẻ, mẻ đang tải lần lượt không bị cắt (CI Windows 1.2.0)', () => {
  const l = docNguon('src', 'flow', 'luong-flow.js');
  assert.ok(/files\.get\(j\)\.push\(duongDan\);\s*taiGanNhat = Date\.now\(\);/.test(l), 'file về phải ghi mốc taiGanNhat');
  assert.ok(/Date\.now\(\) - Math\.max\(luc, taiGanNhat\) < this\.choTaiMs/.test(l), 'hạn tải phải tính từ mốc muộn hơn (tạo xong / file gần nhất)');
});

test('kiểm trước mẻ: chỗ giao mẻ duy nhất và đường đọc kho sau F5 đều đi qua bộ lọc selector', () => {
  // Bản gộp: mọi mẻ giao qua LuongFlow.chayMe (một chỗ buildStartMessage duy nhất trong app).
  const nguon = [['main.js', docGoc('main.js')]];
  const quet = (d) => { for (const f of fs.readdirSync(path.join(GOC, d))) {
    const p = path.join(d, f);
    if (fs.statSync(path.join(GOC, p)).isDirectory()) { if (f !== 'inject') quet(p); }
    else if (f.endsWith('.js') && !/jobs\.js$/.test(f)) nguon.push([p, docGoc(p)]);
  } };
  quet('src');
  const giao = nguon.filter(([, s]) => /buildStartMessage\(/.test(s)).map(([p]) => p);
  assert.deepStrictEqual(giao, [path.join('src', 'flow', 'luong-flow.js')], `chỗ giao mẻ: ${giao.join(', ')}`);
  const conGui = nguon.filter(([, s]) => /action: 'START_AUTOMATION'/.test(s)).map(([p]) => p);
  assert.deepStrictEqual(conGui, [], `có chỗ tự gửi START_AUTOMATION, bỏ qua bộ lọc: ${conGui.join(', ')}`);
  const l = docNguon('src', 'flow', 'luong-flow.js');
  assert.ok(/buildStartMessage\([^;]*cb\.caiDat\)/.test(l), 'mẻ không dùng bộ cài đặt đã kiểm (cb.caiDat)');
  assert.ok(/t\.caiDatEngine = cb\.caiDat;/.test(l), 'tab chưa giữ bộ cài đặt đã kiểm — sau F5 engine đọc lại bản chưa lọc');
  const m = docNguon('main.js');
  assert.strictEqual((m.match(/kiemTruocKhiChay\(tab\.view\.webContents/g) || []).length, 1, 'chuanBiMe phải kiểm selector đúng một lần');
  assert.ok(/kiemTruocKhiChay\(tab\.view\.webContents/.test(thanHam(m, 'async function chuanBiMe')), 'kiểm selector phải nằm trong chuanBiMe');
  // flow:storage get (main.js gốc): phủ cài đặt của tab rồi MỚI lọc.
  const kho = khoiGiua(docGoc('main.js'), "ipcMain.handle('flow:storage'", "case 'set':");
  const iPhu = kho.indexOf('kq.veoSettings = tab.caiDatEngine');
  assert.ok(iPhu > 0 && iPhu < kho.indexOf('return locVeoSettings(kq);'), 'flow:storage get chưa lọc selector đã bỏ');
  const KT = require('../../src/flow/main/kiem-truoc');
  assert.strictEqual(KT.moTaTaiVe({ runMode: 'image', autoDownload: false, downloadMode: 'none' }).muc, 'warning');
  assert.strictEqual(KT.moTaTaiVe({ runMode: 'video', autoDownload: true, downloadMode: 'single' }).muc, 'info');
  // Lọc thật: selector đã bị bỏ thì đường đọc kho không trả nó lại; selector mới thì giữ.
  KT._DA_BO.set('tile', 'span.sai');
  try {
    const ra = KT.locVeoSettings({ veoSettings: { selectors: { tile: 'span.sai', createBtn: 'b' } } });
    assert.deepStrictEqual(ra.veoSettings.selectors, { createBtn: 'b' });
    const moi = KT.locVeoSettings({ veoSettings: { selectors: { tile: 'div.moi' } } });
    assert.deepStrictEqual(moi.veoSettings.selectors, { tile: 'div.moi' });
  } finally { KT._DA_BO.clear(); }
});

test('model: tiêm flow-model.js SAU flow-mode.js', () => {
  const t = docNguon('src', 'main', 'tabs.js');
  const a = t.indexOf("['trình đổi chế độ'"), b = t.indexOf("['trình chọn model'");
  assert.ok(a > 0 && b > a, 'flow-model.js phải tiêm ngay sau flow-mode.js');
  const mo = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'flow', 'inject', 'flow-mode.js'), 'utf8');
  for (const h of ['__flowBamMotLan', '__flowMoBang', '__flowTimBang', '__flowDongBang'])
    assert.ok(mo.includes(`window.${h}`), `flow-mode.js chưa phơi ${h}`);
});

test('model: giao diện có đủ ô và gửi settings.chonModel', () => {
  const html = docNguon('src', 'ui', 'index.html');
  const bang = bangOFlow('O_FLOW_MODEL');
  for (const id of ['fModelChinh', 'fModelPhu', 'fXenKe', 'fModelDuPhong', 'fThuLaiPhut']) {
    assert.ok(html.includes(`id="${id}"`), `thiếu ô #${id}`);
    assert.ok(bang.some(([o]) => o === id), `ô #${id} chưa nối vào O_FLOW_MODEL`);
  }
  // 2.8.7: ba ô tên model PHẢI là hộp chọn. Ô gõ chữ kèm gợi ý (<input
  // list>) lọc gợi ý theo chữ đang có trong ô — đã ghi sẵn một tên thì bấm
  // vào không hiện gì, đúng lỗi "không bấm chọn model chính được" 28/09/2026.
  for (const id of ['fModelChinh', 'fModelPhu', 'fModelDuPhong']) {
    assert.ok(new RegExp(`<select id="${id}"`).test(html), `#${id} phải là <select>, không phải ô gõ chữ`);
  }
  assert.ok(!/<input[^>]*\slist=/.test(html) && !/<datalist/.test(html),
    'còn ô gõ chữ kèm datalist — bấm vào sẽ không hiện đủ danh sách model');
  // Khoá giao diện gửi = khoá model.js đọc; caiDatEngine mang nguyên chonModel tới máy Flow.
  assert.deepStrictEqual(bang.map(([, k]) => k).sort(), Object.keys(modelKH.chuanHoaKeHoach({})).sort(),
    'khoá ô model lệch với chuanHoaKeHoach');
  assert.deepStrictEqual(Object.keys(FLOW_MAC_DINH.chonModel).sort(), Object.keys(modelKH.chuanHoaKeHoach({})).sort());
  const s = caiDatEngine({ chonModel: { chinh: FAST, phu: LITE, xenKeMoi: '3' } }, { loai: 'video', ten: [] });
  assert.strictEqual(s.chonModel.chinh, FAST);
  assert.strictEqual(modelKH.chuanHoaKeHoach(s.chonModel).xenKeMoi, 3, 'ô số gửi dạng chữ vẫn phải đọc được');
  assert.ok(/modelKH\.chuanHoaKeHoach\(settings\.chonModel\)/.test(thanHam(docNguon('main.js'), 'async function chuanBiModel')),
    'chuanBiModel không đọc settings.chonModel');
  // Nạp lại cài đặt: hộp chọn phải được dựng lại theo giá trị đã lưu (kể cả tên không có trong gợi ý).
  const app = docNguon('src', 'ui', 'app.js');
  const ve = thanHam(app, 'function veCaiDat');
  for (const id of ['fModelChinh', 'fModelPhu', 'fModelDuPhong']) assert.ok(ve.includes(`'${id}'`), `veCaiDat chưa dựng lại #${id}`);
  assert.ok(/la \? `<option value="\$\{esc\(v\)\}">/.test(thanHam(app, 'function datChonModel')),
    'tên model đã lưu mà không có trong gợi ý sẽ bị mất khi mở lại Cài đặt');
});

// ── Tự cập nhật (2.8.0) ────────────────────────────────────────────────────
// Phần chạy thật (máy chủ giả, tải, mã băm, đổi app Mac) ở tests/cap-nhat-test.js.
test('cập nhật: tên file đóng gói khớp đúng thứ app đi tìm', () => {
  const CN = require('../../src/main/cap-nhat');
  const pkg = JSON.parse(fs.readFileSync(path.join(GOC, 'package.json'), 'utf8'));
  const v = pkg.version;
  const ten = (mau, arch) => mau.replace('${version}', v).replace('${arch}', arch).replace('${ext}', 'zip');
  const rel = { assets: [
    { name: pkg.build.nsis.artifactName.replace('${version}', v) },
    { name: ten(pkg.build.mac.artifactName, 'arm64') },
    { name: ten(pkg.build.mac.artifactName, 'x64') }
  ] };
  assert.ok(CN.chonTaiSan(rel, 'win32', 'x64'), 'app Windows không nhận ra bộ cài của chính mình');
  assert.ok(CN.chonTaiSan(rel, 'darwin', 'arm64'), 'app Mac chip Apple không nhận ra gói của mình');
  assert.ok(CN.chonTaiSan(rel, 'darwin', 'x64'), 'app Mac Intel không nhận ra gói của mình');
  assert.notStrictEqual(CN.chonTaiSan(rel, 'darwin', 'arm64').ten, CN.chonTaiSan(rel, 'darwin', 'x64').ten, 'Mac chip Apple và Intel lấy nhầm gói của nhau');
  assert.strictEqual(CN.layRepo(pkg) !== null, true, 'package.json thiếu địa chỉ repo GitHub');
});

test('cập nhật: workflow phát hành đủ ba file, và chặn thẻ lệch phiên bản', () => {
  const y = fs.readFileSync(path.join(GOC, '.github', 'workflows', 'phat-hanh.yml'), 'utf8');
  for (const f of ['-setup.exe', '-mac-arm64.zip', '-mac-x64.zip']) assert.ok(y.includes(f), `phat-hanh.yml không kiểm ${f}`);
  assert.ok(/khong trung package\.json/.test(y), 'thiếu chốt chặn thẻ ≠ version — app sẽ cài đi cài lại mãi');
  assert.ok(/uses: \.\/\.github\/workflows\/build-windows\.yml/.test(y) && /uses: \.\/\.github\/workflows\/build-mac\.yml/.test(y));
  // Hai workflow đóng gói KHÔNG tự chạy theo thẻ nữa — nếu không mỗi thẻ sinh ba lượt dựng.
  for (const f of ['build-windows.yml', 'build-mac.yml']) {
    const w = fs.readFileSync(path.join(GOC, '.github', 'workflows', f), 'utf8');
    assert.ok(/workflow_call:/.test(w), `${f} thiếu workflow_call`);
    assert.ok(!/^\s*push:/m.test(w), `${f} vẫn tự chạy khi push thẻ`);
  }
});

test('cập nhật: main.js dựng bộ cập nhật, cài khi thoát, không cài đè lúc luồng Flow đang nghỉ hạ nhiệt', () => {
  const m = docGoc('main.js');
  assert.ok(/capNhat = new BoCapNhat\(\{[\s\S]{0,200}repo: layRepo\(pkg\)/.test(m), 'chưa dựng bộ cập nhật với repo trong package.json');
  assert.ok(/capNhat\.kiemTra\(\{ imLang: true \}\)/.test(m), 'chưa tự kiểm bản mới');
  assert.ok(/before-quit[\s\S]{0,600}nenCaiKhiThoat\(\)[\s\S]{0,120}e\.preventDefault\(\)/.test(m),
    'before-quit chưa giữ app lại để cài');
  // Tab đang nghỉ hạ nhiệt cũng là tab đang chạy mẻ — không được cài đè. Bản gộp: "đang chạy" =
  // còn luồng chưa rảnh; luồng Flow giữ mẻ (dsViec) suốt giờ nghỉ (xem bài nghỉ hạ nhiệt ở trên).
  assert.ok(/coTabDangChay: \(\) => dieuPhoi\.coViecDangChay\(\)/.test(m), 'bộ cập nhật không hỏi hàng đợi có luồng đang chạy');
  assert.ok(/coViecDangChay\(\) \{ return this\.luong\.some\(\(x\) => !x\.luong\.ranh\); \}/.test(docGoc('src', 'main', 'dieu-phoi.js')));
  const { LuongFlow } = require('../../src/flow/luong-flow');
  const l = new LuongFlow({ id: 'L', taiKhoan: { id: 'tk', ten: 'TK' }, tabs: {}, may: {}, thuMucTam: os.tmpdir() });
  assert.strictEqual(l.ranh, true);
  l.dsViec = [{ so: 1 }];
  assert.strictEqual(l.ranh, false, 'luồng Flow đang giữ mẻ (kể cả lúc nghỉ) phải tính là đang chạy');
});

// ── 1.2.1: tải ảnh lên Flow khi engine không thấy ô tải lên ─────────────────
testAsync('1.2.1 nhật ký 16/10/2026 "Không tìm thấy ô tải ảnh lên của Flow" → bấm nút Tải lên của Flow, đưa file THẬT (tên = mã ảnh); hỏng thì việc báo lỗi + chẩn đoán', async () => {
  const { LuongFlow } = require('../../src/flow/luong-flow');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gan-anh-'));
  const goc = path.join(dir, '001.png');
  fs.writeFileSync(goc, Buffer.from('anh-that'));
  const chay = async ({ engineOk, taiOk, khoSauTai = true }) => {
    let kho = new Set(), goiTai = [];
    const nhatKy = [];
    const tabs = { dispatch: async (_id, m) => {
      if (m.action === 'CHECK_ASSET_NAMES') return { ok: true, missing: m.data.names.filter((n) => !kho.has(n)) };
      if (m.action === 'UPLOAD_IMAGES_TO_FLOW') {
        if (!engineOk) return { ok: false, error: 'Không tìm thấy ô tải ảnh lên của Flow. Hãy mở menu [+] → tab Hình ảnh một lần rồi thử lại.' };
        for (const a of m.data.images) kho.add(a.name.replace(/\.[^.]+$/, ''));
        return { ok: true };
      }
      return { ok: true };
    } };
    const l = new LuongFlow({ id: 'L1', taiKhoan: { id: 'tk', ten: 'TK' }, tabs, may: {}, thuMucTam: dir,
      docAnh: (p) => ({ b64: fs.readFileSync(p).toString('base64'), mime: 'image/png' }), log: (m, c) => nhatKy.push(`[${m}] ${c}`),
      taiAnhLen: async (wc, files) => {
        goiTai.push(files.map((f) => [path.basename(f), fs.readFileSync(f, 'utf8')]));
        if (!taiOk) return { ok: false, buoc: [], loi: 'không thấy ô tải lên, nút Tải lên hay ô nhập prompt', chanDoan: { oNhap: true, soInput: 0, nut: ['[add_2] "Add media"'] } };
        if (khoSauTai) for (const f of files) kho.add(path.basename(f).replace(/\.[^.]+$/, ''));
        return { ok: true, cach: 'hop-chon-file', chacChan: true, buoc: ['moMenu: Add media', 'bamTaiLen: Upload image'] };
      } });
    l._ngu = async () => true;
    l.tab = { id: 't1', view: { webContents: { isDestroyed: () => false, executeJavaScript: async () => { throw new Error('giả'); } } } };
    const j = { so: 1, loai: 'video', thamChieu: [goc] };
    const r = await l._ganAnh([j], { anhCua: (v) => v.thamChieu }, 0);
    return { r, j, goiTai, nhatKy };
  };
  try {
    let k = await chay({ engineOk: false, taiOk: true });
    const ma = k.r.maCua.get(k.j)[0];
    assert.strictEqual(k.r.hong.size, 0, k.nhatKy.join('\n'));
    assert.deepStrictEqual(k.goiTai, [[[`${ma}.png`, 'anh-that']]], 'file đưa lên mang tên mã ảnh, đúng nội dung ảnh nguồn');
    assert.ok(k.nhatKy.some((x) => /Engine không tải được ảnh lên \(Không tìm thấy ô tải ảnh lên/.test(x)), k.nhatKy.join('\n'));
    assert.ok(k.nhatKy.some((x) => /Đã đưa 1 ảnh lên Flow \(bấm Add media → Upload image\)/.test(x)), k.nhatKy.join('\n'));
    assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.startsWith('tai-len-')), [], 'dọn thư mục tạm chứa bản chép');
    k = await chay({ engineOk: true, taiOk: true });
    assert.ok(k.r.hong.size === 0 && k.goiTai.length === 0, 'engine tải được thì không bấm gì thêm');
    k = await chay({ engineOk: false, taiOk: false });
    assert.ok(/Không đưa được ảnh lên kho Flow/.test(k.r.hong.get(k.j)), 'tải hỏng → việc báo lỗi (điều phối chuyển tài khoản / sang Muse)');
    assert.ok(k.nhatKy.some((x) => /Tải ảnh lên Flow hỏng: không thấy ô tải lên/.test(x)) && k.nhatKy.some((x) => /Quanh ô nhập Flow: ô nhập có, 0 ô chọn file, nút: \[add_2\] "Add media"/.test(x)), k.nhatKy.join('\n'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── macOS ──────────────────────────────────────────────────────────────────

test('macOS: cấu hình đóng gói đủ để Mac chip Apple mở được', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(GOC, 'package.json'), 'utf8'));
  const b = pkg.build;
  assert.ok(b.mac, 'package.json thiếu mục build.mac');
  // identity phải là null TƯỜNG MINH: để trống thì electron-builder đi tìm
  // chứng chỉ, không có thì bỏ ký — và bản arm64 không ký là "app bị hỏng".
  assert.strictEqual(b.mac.identity, null, 'build.mac.identity phải là null (tự ký ad-hoc ở afterPack)');
  assert.strictEqual(b.afterPack, 'tools/ky-mac.js', 'thiếu afterPack ký ad-hoc');
  assert.ok(fs.existsSync(path.join(GOC, b.afterPack)), 'không thấy tools/ky-mac.js');
  assert.ok(fs.existsSync(path.join(GOC, b.mac.icon)), `không thấy icon Mac ${b.mac.icon}`);
  const archs = new Set(b.mac.target.flatMap((t) => t.arch));
  assert.ok(archs.has('arm64') && archs.has('x64'), 'phải dựng cả chip Apple (arm64) lẫn Intel (x64)');
  // Không được đụng tới phần Windows đang chạy tốt.
  assert.strictEqual(b.publish, null, 'mất "publish": null — build Windows sẽ báo hỏng');
  assert.ok(!('signAndEditExecutable' in (b.win || {})), 'không được tắt signAndEditExecutable');
});

test('macOS: hook ký bỏ qua bản Windows, dừng hẳn nếu không ký được bản Mac', () => {
  // afterPack chạy cho MỌI nền tảng — nhánh Windows phải thoát ngay dòng đầu,
  // nếu không nó làm hỏng BUILD_EXE.bat đang chạy tốt.
  const s = fs.readFileSync(path.join(GOC, 'tools', 'ky-mac.js'), 'utf8');
  assert.ok(/if \(context\.electronPlatformName !== 'darwin'\) return;/.test(s),
    'hook ký chưa bỏ qua bản Windows');
  assert.strictEqual(typeof require(path.join(GOC, 'tools', 'ky-mac.js')).default, 'function');
  assert.ok(/throw new Error/.test(s), 'không ký được mà vẫn cho qua — sẽ phát hành bản không mở được');
});

test('macOS: đóng cửa sổ là thoát hẳn, và có menu Sửa để Cmd+V dán được', () => {
  const m = boGhiChu(docGoc('main.js'));
  const khoi = m.slice(m.indexOf("app.on('window-all-closed'"));
  const than = khoi.slice(0, khoi.indexOf(');\n') + 2);
  assert.ok(/app\.quit\(\)/.test(than) && !/darwin/.test(than),
    'window-all-closed trên Mac không thoát — luồng Flow chạy ngầm không cửa sổ');
  // Cửa sổ luồng ẩn không được giữ app sống: đóng cửa sổ chính là thoát.
  assert.ok(/win\.on\('closed', \(\) => \{[^}]*app\.quit\(\)/.test(m), 'đóng cửa sổ chính chưa thoát app');
  // Bản gộp không tự đặt menu → Electron dùng menu mặc định (có Sửa: copy/paste/selectAll).
  // Ai đặt menu riêng thì phải giữ ba vai trò đó; xoá menu (null) là mất Cmd+V trên Mac.
  assert.ok(!/setApplicationMenu\(\s*null\s*\)/.test(m), 'xoá menu ứng dụng — Cmd+V không dán được trên Mac');
  if (/setApplicationMenu\(/.test(m)) {
    for (const vt of ['copy', 'paste', 'selectAll']) assert.ok(m.includes(`role: '${vt}'`), `menu Mac thiếu vai trò ${vt}`);
  }
});

// ── Engine: đếm ảnh trước/sau khi bấm Tạo phải CÙNG một bộ lọc ─────────────
//
//  LỖI THẬT 22/09/2026. Nhật ký ghi ở cả 6 tab:
//      🔎 Verify: newTile=false, txtCleared=false(len=2421), newImg=true
//  rồi "✅ Create accepted — monitoring for 4 tiles..." và treo mãi ở
//  "⏳ Đang chờ thẻ video mới xuất hiện".
//
//  Nguyên nhân: chỗ đếm TRƯỚC khi bấm dùng '[data-tile-id] img, …' (chỉ ảnh
//  trong thẻ) còn hai chỗ đếm SAU khi bấm dùng 'img, …' (mọi ảnh trên trang).
//  Nhỏ so với lớn nên newImg gần như luôn true — cú bấm Tạo trượt vẫn được
//  coi là thành công, và lỗi thật (Flow đổi giao diện lưới thẻ) bị che kín.
//
//  Bài kiểm này so THẲNG chuỗi selector ở ba chỗ. Đảo một chữ là đỏ ngay.
test('engine: đếm ảnh trước và sau khi bấm Tạo dùng cùng một selector', () => {
  const e = docNguon('src', 'inject', 'flow-engine.js');

  const lay = (re, ten) => {
    const m = e.match(re);
    assert.ok(m, `không tìm thấy ${ten} trong flow-engine.js — code đã đổi, xem lại bài kiểm này`);
    return m[1];
  };

  const truoc = lay(/_preClickImageCount = document\.querySelectorAll\('([^']+)'\)/,
                    'chỗ đếm TRƯỚC khi bấm (_preClickImageCount)');
  const sau1  = lay(/const currentImageCount = document\.querySelectorAll\('([^']+)'\)/,
                    'chỗ đếm SAU khi bấm (currentImageCount)');
  const sau2  = lay(/const currentImageCount2 = document\.querySelectorAll\('([^']+)'\)/,
                    'chỗ đếm SAU khi bấm lần 2 (currentImageCount2)');

  assert.strictEqual(truoc, sau1,
    `đếm trước ("${truoc}") khác đếm sau ("${sau1}") — newImg sẽ luôn true và treo im lặng`);
  assert.strictEqual(truoc, sau2,
    `đếm trước ("${truoc}") khác đếm sau lần 2 ("${sau2}") — retry cũng bị che lỗi`);

  // Chốt thêm: không được quay lại bộ lọc hẹp theo [data-tile-id]. Giao diện
  // Flow mới không còn thuộc tính đó, nên đếm hẹp là luôn ra 0 ở cả hai đầu
  // và newImg thành luôn FALSE — lại sai theo hướng ngược lại.
  assert.ok(!truoc.includes('[data-tile-id]'),
    'bộ lọc đếm ảnh không được phụ thuộc [data-tile-id] (giao diện Flow mới đã bỏ)');
});

// ── MỌI action engine GỬI phải có người trả lời ở tiến trình chính ─────────
//
//  Đây là bài kiểm cho CẢ MỘT LOẠI lỗi, không phải một lỗi lẻ. Engine gửi
//  action mà main.js không có `case` thì nó rơi vào nhánh default và nhận
//  { success:false, error:'Action chưa hỗ trợ: …' } — engine coi như lỗi kết
//  nối rồi bỏ qua trong im lặng. Đã cắn thật hai lần:
//
//    • REGISTER_TAB thiếu  -> ba tab dùng chung khoá 'single', ghi đè dự án.
//    • UI_BREAK thiếu      -> app không biết giao diện Flow đã vỡ, mục Chẩn
//                             đoán im lìm trong khi engine đang kêu.
//
//  Thà bài kiểm này đỏ khi thêm tính năng, còn hơn để lặng lẽ mất dữ liệu.
test('mọi action engine gửi đều có case trong máy Flow (may-flow.js handleEngineMessage)', () => {
  const e = docNguon('src', 'inject', 'flow-engine.js');
  const may = docNguon('main.js');                       // → src/flow/may-flow.js
  const m = thanHam(may, 'async function handleEngineMessage');
  assert.ok(m.length > 1000, 'không cắt được thân handleEngineMessage');
  // main.js gốc phải chuyển MỌI message của engine vào đúng bộ định tuyến này.
  assert.ok(/ipcMain\.handle\('flow:message'[\s\S]{0,200}mayFlow\.handleEngineMessage\(message, event\.sender\)/.test(docGoc('main.js')),
    "kênh 'flow:message' không đi vào mayFlow.handleEngineMessage");

  const gui = new Set();
  const nhat = (re) => { let x; while ((x = re.exec(e))) gui.add(x[1]); };
  nhat(/sendMessage\(\{\s*action:\s*'([A-Z_]+)'/g);
  nhat(/\bbg\('([A-Z_]+)'/g);
  nhat(/action:\s*'([A-Z_]+)'\s*,\s*data/g);

  // Bỏ ra những action engine NHẬN (app gửi xuống), không phải engine gửi lên.
  const engineNhan = new Set();
  let y; const reNhan = /message\.action === '([A-Z_]+)'/g;
  while ((y = reNhan.exec(e))) engineNhan.add(y[1]);

  const nhan = new Set();
  let z; const reCase = /case '([A-Z_]+)':/g;
  while ((z = reCase.exec(m))) nhan.add(z[1]);

  const thieu = [...gui].filter((a) => !engineNhan.has(a) && !nhan.has(a)).sort();
  assert.ok(gui.size >= 25, `chỉ nhặt được ${gui.size} action — biểu thức nhặt có thể đã hỏng`);
  assert.deepStrictEqual(thieu, [],
    `may-flow.js chưa trả lời ${thieu.length} action engine gửi: ${thieu.join(', ')}`);
});

// ── Đường tự vá selector phải nối đủ từ đầu tới cuối ──────────────────────
//
//  Engine dặn người dùng "bấm Chọn trên trang hoặc Tải báo cáo .txt" khi nó
//  trượt. Trước 2.8.2 hai nút đó KHÔNG TỒN TẠI trong app, và settings.selectors
//  — khoá mà resolveSelector() của engine đọc — không hề được giao diện gom.
//  Nên cơ chế tự vá của engine nằm đó chết. Bài kiểm này canh cả 5 mắt nối.
test('selector người dùng tự chỉ đi đủ đường: cài đặt Flow → engine (settings.selectors) và bấm Tạo', () => {
  // Bản gộp bỏ nút "Chọn trên trang" / "Tải báo cáo .txt" (xem danh sách đã bỏ ở đầu file), nhưng
  // selector đã lưu trong caiDat.flow.selectors vẫn phải tới được engine và trình bấm Tạo.
  const e = docNguon('src', 'inject', 'flow-engine.js');
  // 1. Engine vẫn đọc settings.selectors — nếu Google/engine đổi thì phải biết.
  assert.ok(/state\.settings\.selectors/.test(e), 'engine không còn đọc settings.selectors — xem lại resolveSelector()');
  // 2. Lưu: chuẩn hoá giữ selectors; lưu cài đặt (gộp với bản cũ) không làm rơi selectors.
  const sel = { createBtn: 'button.tao', tile: 'div.the' };
  assert.deepStrictEqual(chuanHoaFlow({ selectors: sel }).selectors, sel);
  assert.ok(/m\.flow = chuanHoaFlow\(\{ \.\.\.this\.caiDat\.flow, \.\.\.\(c\.flow \|\| \{\}\) \}\)/.test(docGoc('src', 'main', 'dieu-phoi.js')),
    'lưu Cài đặt → Flow ghi đè mất selectors đã lưu');
  // 3. Gửi engine: bộ cài đặt của mẻ mang selectors (và là bản sao, không dính object gốc).
  const s = caiDatEngine({ selectors: sel }, { loai: 'anh', ten: [] });
  assert.deepStrictEqual(s.selectors, sel);
  assert.notStrictEqual(s.selectors, sel);
  // 4. Trình bấm Tạo (chạy ngoài engine) tự đọc selector người dùng từ cài đặt Flow hiện hành.
  const m = docNguon('main.js');
  assert.ok(/const selectorNguoiDung = \(\) => \(\(o\.layCaiDat && o\.layCaiDat\(\)\) \|\| \{\}\)\.selectors \|\| \{\};/.test(m));
  assert.ok(/layCaiDat: \(\) => dieuPhoi\.caiDat\.flow/.test(docGoc('main.js')), 'main.js chưa đưa cài đặt Flow cho máy Flow');
});

// ── Trả lời KHÔNG ĐỒNG BỘ của engine phải về được tới nơi ─────────────────
//
//  BẰNG CHỨNG THẬT: báo cáo chẩn đoán 10:13 ngày 22/09/2026, chỗ đáng lẽ là
//  bảng 6 phần tử kèm outerHTML, chỉ có đúng:
//      ──── 1. TỰ KIỂM NGAY LÚC XUẤT BÁO CÁO ────
//      { "ok": true }
//
//  chrome-shim cũ chạy đồng bộ nên mọi sendResponse gọi sau đều mất. Engine
//  có ĐÚNG BA chỗ trả lời kiểu đó, và cả ba đều là tính năng người dùng bấm:
//  tự kiểm giao diện, tải ảnh lên Flow, kiểm tên ảnh.
//
//  Bài này canh hai đầu: shim có CHỜ, và main.js có MỞ PHONG BÌ.
//  (Đường đầu-cuối thật nằm ở tầng 4 — tests/tabs-main.js, bài 3b2.)
test('shim chờ sendResponse gọi sau, và luồng Flow mở phong bì', () => {
  const shim = docNguon('src', 'inject', 'chrome-shim.js');
  const e = docNguon('src', 'inject', 'flow-engine.js');

  // Engine vẫn còn dùng kiểu trả lời sau chứ? Nếu Google/engine đổi thì phải biết.
  const soChoTraSau = (e.match(/return true;\s*\/\/ trả lời không đồng bộ|sendResponse\);\s*\n\s*return true;/g) || []).length;
  assert.ok(/return true;/.test(e) && soChoTraSau >= 1,
    'engine không còn chỗ nào trả lời không đồng bộ — xem lại bài kiểm này');

  assert.ok(/=== true\)\s*choKhongDongBo = true/.test(shim),
    'chrome-shim không còn nhận biết người nghe trả về true → mọi trả lời sau sẽ mất');
  assert.ok(/new Promise\(/.test(shim),
    'chrome-shim không trả về Promise → không thể chờ sendResponse gọi sau');
  assert.ok(/setTimeout\(\(\) => tra\(true\)/.test(shim),
    'thiếu trần thời gian chờ — một người nghe hỏng là treo cả app');

  // moPhongBi nay ở src/flow/tab-flow.js; mở đúng phong bì { ok, result } của shim.
  const { moPhongBi } = require('../../src/flow/tab-flow.js');
  assert.deepStrictEqual(moPhongBi({ ok: true, result: { ok: true, missing: ['a'] } }), { ok: true, missing: ['a'] });
  assert.deepStrictEqual(moPhongBi({ ok: false, error: 'hết giờ', result: { ok: false } }), { ok: false, loiVo: 'hết giờ' });
  assert.deepStrictEqual(moPhongBi({ ok: true }), { ok: true });

  // Mọi lệnh trả lời KHÔNG ĐỒNG BỘ app gửi xuống đều phải đi qua moPhongBi.
  const l = docNguon('src', 'flow', 'luong-flow.js');
  assert.ok(/const \{ FLOW_URL, FLOW_HOST_RE, moPhongBi \} = require\('\.\/tab-flow'\)/.test(l), 'luong-flow.js chưa lấy moPhongBi');
  for (const ten of ['CHECK_ASSET_NAMES', 'UPLOAD_IMAGES_TO_FLOW']) {
    const re = new RegExp(`moPhongBi\\(await this\\.tabs\\.dispatch\\(t\\.id, \\{ action: '${ten}'`);
    assert.ok(re.test(l), `${ten} chưa mở phong bì của shim — luồng sẽ nhận { ok:true } rỗng`);
  }
  const tatCa = [docGoc('main.js'), l, docNguon('main.js'), docGoc('src', 'main', 'dieu-phoi.js')].join('\n');
  for (const ten of ['CHECK_ASSET_NAMES', 'UPLOAD_IMAGES_TO_FLOW', 'RUN_UI_SELFTEST']) {
    const tong = (tatCa.match(new RegExp(`dispatch\\([^)]*action: '${ten}'`, 'g')) || []).length;
    const boc = (tatCa.match(new RegExp(`moPhongBi\\(await [\\w.]+\\.dispatch\\([^)]*action: '${ten}'`, 'g')) || []).length;
    assert.strictEqual(boc, tong, `có ${tong - boc} chỗ gửi ${ten} không mở phong bì`);
  }
});

// ── Bấm nút Tạo: đi qua trình mới, và KHÔNG submit hai lần ────────────────
//
//  Nhật ký 22/09/2026: "🖱️ Create clicked (wasDisabled: false)" rồi
//  "newTile=false, txtCleared=false(len=21804), newImg=false" — bấm mà Flow
//  không nhận. Hai chỗ hở: hàm bấm cũ không đọc selector người dùng tự chỉ,
//  và chỉ thử đúng một kiểu bấm.
test('lệnh bấm Tạo đi qua flow-bam-tao.js kèm selector người dùng', () => {
  const m = docNguon('main.js');                         // → src/flow/may-flow.js
  const t = docNguon('src', 'main', 'tabs.js');          // → src/flow/tab-flow.js
  // Bỏ dòng ghi chú trước khi soi: chính ghi chú trong file cũng NHẮC TỚI
  // đoạn code sai (để giải thích vì sao không được dùng), nên soi cả ghi chú
  // là bài kiểm đỏ oan. Đây là lỗi tôi mắc ngay khi viết bài kiểm này.
  const b = boGhiChu(docNguon('src', 'inject', 'flow-bam-tao.js'));

  // File tiêm phải được nạp VÀ có trong chuỗi tiêm, nếu không __flowBamTao
  // không tồn tại trên trang và app lặng lẽ rơi về hàm cũ.
  assert.ok(/flow-bam-tao\.js/.test(t), 'tab-flow.js không đọc flow-bam-tao.js');
  assert.ok(/\['trình bấm nút Tạo', n\.bamTao\]/.test(t), 'flow-bam-tao.js chưa có trong chuỗi tiêm');
  // Phải tiêm SAU flow-mode.js: nó dùng lại __flowBamMotLan / __flowNhinThay.
  assert.ok(t.indexOf("['trình đổi chế độ', n.mode]") > 0 &&
    t.indexOf("['trình đổi chế độ', n.mode]") < t.indexOf("['trình bấm nút Tạo', n.bamTao]"),
    'flow-bam-tao.js phải tiêm SAU trình đổi chế độ');

  const bam = khoiGiua(m, "case 'INJECT_CLICK_CREATE'", "case 'INJECT_RENAME_INPUT'");
  assert.ok(/window\.__flowBamTao/.test(bam), 'INJECT_CLICK_CREATE không gọi __flowBamTao');
  assert.ok(/const sel = selectorNguoiDung\(\)\.createBtn/.test(bam),
    'lệnh bấm Tạo không lấy selector người dùng tự chỉ — đúng lỗi 22/09');
  // Cả đường chuột thật lẫn đường các kiểu bấm JS đều nhận selector đó.
  assert.ok(/__flowBamTaoChuanBi\(\$\{JSON\.stringify\(\{ selector: sel \}\)\}\)/.test(bam), 'chuột thật chưa dùng selector người dùng');
  assert.ok(/__flowBamTao\(\$\{JSON\.stringify\(\{ selector: sel \}\)\}\)/.test(bam), 'các kiểu bấm JS chưa dùng selector người dùng');

  // Enter và Space phải là HAI bước riêng. Gộp lại (kiểu 'phim' của
  // flow-mode.js gửi cả hai) là submit hai lần với nút nghe cả hai phím —
  // tests/bam-tao-main.js đã bắt đúng lỗi này khi viết bản đầu.
  assert.ok(/'click', 'chuot', 'enter', 'space'/.test(b),
    'thứ tự kiểu bấm phải tách Enter và Space thành hai bước');
  assert.ok(!/__flowBamMotLan\(el, 'phim'\)/.test(b),
    "không được dùng kiểu 'phim' dùng chung: nó gửi Enter RỒI Space → submit hai lần");
  // Dừng ngay khi thấy ăn, chứ không bắn hết cho chắc.
  assert.ok(/if \(kq\.an\)/.test(b) && /return \{\s*\n?\s*ok: true/.test(b),
    'phải dừng ngay khi một kiểu bấm đã ăn');
});

// ── 2.8.7: Flow bỏ "Veo 3.1 - Lite [Lower Priority]" ──────────────────────
//
//  Nhật ký 28/09/2026: "Flow có 4 model: Omni 1.1 Flash · Veo 3.1 - Lite ·
//  Veo 3.1 - Fast · Veo 3.1 - Quality". Người dùng còn lưu tên Lower Priority
//  từ trước. Ba bài dưới canh: kế hoạch bị lọc theo danh sách THẬT, gợi ý
//  mặc định hai bên khớp nhau và không còn Lower Priority, và nối dây đủ.
test('model: lọc kế hoạch theo danh sách Flow thật', () => {
  const MK = require('../../src/flow/main/model');
  const DS = ['Omni 1.1 Flash', 'Veo 3.1 - Lite', 'Veo 3.1 - Fast', 'Veo 3.1 - Quality'];

  // Tên cũ Flow không còn → bỏ, và nói ra đã bỏ gì.
  const k1 = MK.chuanHoaKeHoach({ chinh: 'Veo 3.1 - Lite [Lower Priority]', phu: 'Veo 3.1 - Fast', xenKeMoi: 2 });
  const r1 = MK.locTheoDanhSach(k1, DS);
  assert.strictEqual(r1.keHoach.chinh, '', 'tên Lower Priority phải bị bỏ khi Flow không còn');
  assert.deepStrictEqual(r1.daBo, [{ truong: 'chinh', ten: 'Veo 3.1 - Lite [Lower Priority]' }]);
  assert.strictEqual(r1.keHoach.phu, 'Veo 3.1 - Fast', 'model phụ Flow còn thì phải giữ');

  // BẪY TIỀN TỐ: "Veo 3.1 - Lite" có trong danh sách KHÔNG được làm tên Lower
  // Priority lọt qua (so bằng nhau sau chuẩn hoá, không so "có chứa").
  assert.ok(!MK.locTheoDanhSach(MK.chuanHoaKeHoach({ chinh: 'Veo 3.1 - Lite [Lower Priority]' }), ['Veo 3.1 - Lite'])
    .keHoach.chinh, 'tiền tố "Veo 3.1 - Lite" không được coi là khớp Lower Priority');

  // Tên còn trên Flow thì giữ nguyên, kể cả khác hoa thường / khoảng trắng.
  const r2 = MK.locTheoDanhSach(MK.chuanHoaKeHoach({ chinh: 'veo 3.1  - FAST' }), DS);
  assert.strictEqual(r2.keHoach.chinh, 'veo 3.1 - FAST');
  assert.deepStrictEqual(r2.daBo, []);

  // Model phụ bị bỏ → tắt luôn xen kẽ, không để N còn đó mà không có gì để xen.
  const r3 = MK.locTheoDanhSach(MK.chuanHoaKeHoach({ chinh: 'Veo 3.1 - Lite', phu: 'Veo 9 Ultra', xenKeMoi: 3 }), DS);
  assert.strictEqual(r3.keHoach.phu, '');
  assert.strictEqual(r3.keHoach.xenKeMoi, 0);

  // Flow không còn Lower Priority nào → dự phòng vô nghĩa, bỏ (nó chỉ chạy
  // khi ĐANG dùng Lower Priority). Còn Lower Priority thì giữ.
  const kDp = MK.chuanHoaKeHoach({ chinh: 'Veo 3.1 - Lite', duPhong: 'Veo 3.1 - Fast' });
  assert.strictEqual(MK.locTheoDanhSach(kDp, DS).keHoach.duPhong, '');
  assert.strictEqual(MK.locTheoDanhSach(kDp, DS.concat('Veo 3.1 - Lite [Lower Priority]')).keHoach.duPhong,
    'Veo 3.1 - Fast', 'Google đưa Lower Priority trở lại thì dự phòng phải chạy lại được');

  // Đọc danh sách thất bại ([]) → KHÔNG lọc gì cả.
  assert.deepStrictEqual(MK.locTheoDanhSach(k1, []).keHoach, k1);
});

test('model: gợi ý mặc định khớp hai bên và không còn Lower Priority', () => {
  const MK = require('../../src/flow/main/model');
  const ui = docNguon('src', 'ui', 'app.js');
  const m = ui.match(/const DS_MODEL_VIDEO = (\[[^\]]*\]);/);
  assert.ok(m, 'không tìm thấy DS_MODEL_VIDEO trong src/ui/app.js');
  const dsUi = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepStrictEqual(dsUi, MK.MODEL_GOI_Y, 'gợi ý model ở giao diện lệch với src/flow/main/model.js');
  assert.ok(!MK.MODEL_GOI_Y.some(MK.laLowerPriority), 'gợi ý mặc định còn Lower Priority — Flow đã bỏ');
  // Logic Lower Priority vẫn còn nguyên, để Google đưa nó trở lại vẫn chạy.
  assert.ok(MK.laLowerPriority('Veo 3.1 - Lite [Lower Priority]'));
});

test('model: đầu mẻ kiểm danh sách thật, prompt đầu luôn xác nhận model', () => {
  const m = docNguon('main.js');
  const than = (dau) => thanHam(m, dau);

  const cb = than('async function chuanBiModel');
  assert.ok(/__flowListModels/.test(cb) && /locTheoDanhSach/.test(cb),
    'chuanBiModel chưa đối chiếu kế hoạch với danh sách model thật trên Flow');
  // Lọc TRƯỚC khi đọc model đang chọn và TRƯỚC khi gán tab.keHoachModel.
  assert.ok(cb.indexOf('locTheoDanhSach') < cb.indexOf('tab.keHoachModel = k'),
    'phải lọc kế hoạch trước khi giao nó cho tab');

  const dm = than('async function datModel(tab, ten');
  assert.ok(/baoKhiGiuNguyen/.test(dm) && /đúng kế hoạch/.test(dm),
    'datModel vẫn im lặng khi model đã đúng — nhật ký không phân biệt được "đã đúng" với "không chạy"');
  assert.ok(/datModel\(tab, model, lyDo, tab\.demPromptMoi === 1\)/.test(m),
    'prompt đầu mẻ chưa bật xác nhận model thành lời');
});

// ── 2.8.7a: soi tĩnh phải ra cùng kết quả trên checkout CRLF (Windows CI) ──
test('soi tĩnh: cắt thân hàm như nhau dù file xuống dòng CRLF', () => {
  const lf = docNguon('main.js');
  const crlf = docNguon('main.js').replace(/\r?\n/g, '\r\n');
  const chuan = crlf.replace(/\r\n/g, '\n');
  for (const dau of ['async function ghiLyDoTheLoi', 'async function chuanBiModel', 'async function datModel']) {
    const a = thanHam(lf, dau), b = thanHam(chuan, dau);
    assert.ok(a && a.length < 20000, `thân "${dau}" cắt sai (dài ${a.length})`);
    assert.strictEqual(a, b, `thân "${dau}" khác nhau giữa LF và CRLF`);
  }
  assert.throws(() => thanHam(crlf, 'async function ghiLyDoTheLoi'), /cuối hàm/,
    'cắt trên CRLF thô phải báo lỗi, không được lặng lẽ lấy tới cuối file');
});

// ── 2.8.7: ghi lý do Flow viết trên thẻ lỗi ───────────────────────────────
test('thẻ lỗi: đọc chữ Flow ghi trên thẻ và ghi vào nhật ký', () => {
  const m = docNguon('main.js');
  const cb = docNguon('src', 'inject', 'flow-canh-bao.js');
  assert.ok(/window\.__flowDocLyDoTheLoi = function/.test(cb), 'flow-canh-bao.js chưa phơi __flowDocLyDoTheLoi');
  assert.ok(/flow-error-tile/.test(cb), 'chưa dò thẻ flow-error-tile');
  assert.ok(/async function ghiLyDoTheLoi/.test(m), 'main.js thiếu ghiLyDoTheLoi');
  // 1.2.0: UPDATE_TABLE_DATA → theoDoiAnToan (luôn chạy) → có prompt vừa hỏng thì đọc chữ trên thẻ
  // (vừa ghi nhật ký, vừa để nhận ra "hoạt động bất thường" / hết tín dụng ghi trên thẻ).
  const khoi = m.slice(m.indexOf("case 'UPDATE_TABLE_DATA'"), m.indexOf("case 'UPDATE_PROGRESS'"));
  assert.ok(/theoDoiAnToan\(tab, hangs\)/.test(khoi), 'UPDATE_TABLE_DATA chưa gọi theoDoiAnToan');
  const td = thanHam(m, 'async function theoDoiAnToan');
  assert.ok(/ghiLyDoTheLoi\(tab/.test(td), 'theoDoiAnToan chưa đọc chữ trên thẻ lỗi');
  assert.ok(!/caiDatAnToan\.bat/.test(td), 'nhận diện tài khoản lỗi luôn bật');
  const g = thanHam(m, 'async function ghiLyDoTheLoi');
  assert.ok(g, 'không cắt được thân ghiLyDoTheLoi');
  assert.ok(!/caiDatAnToan\.bat/.test(g), 'đọc lý do thẻ lỗi không được phụ thuộc chế độ an toàn');
  assert.ok(/_lyDoDaGhi/.test(g), 'phải lọc trùng — lưới còn thẻ lỗi cũ thì câu đó lặp mãi');
});

// ── 2.8.8: nghỉ giữa các thao tác trong một prompt ─────────────────────────
const NT = require('../../src/flow/main/nhip-thao-tac');

test('nhịp thao tác: chuẩn hoá cài đặt', () => {
  assert.deepStrictEqual(NT.chuanHoa({}), { bat: false, min: 1, max: 4 });
  assert.deepStrictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: '2', nghiThaoTacMax: '5' }),
    { bat: true, min: 2, max: 5 });
  // Gõ ngược thì đổi chỗ, không bỏ.
  assert.deepStrictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: 6, nghiThaoTacMax: 2 }),
    { bat: true, min: 2, max: 6 });
  // Dấu phẩy kiểu Việt, và trần 60 giây.
  assert.strictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: '1,5', nghiThaoTacMax: 999 }).min, 1.5);
  assert.strictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: 1, nghiThaoTacMax: 999 }).max, 60);
  // Bật mà cả hai đầu là 0 thì coi như tắt.
  assert.strictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: 0, nghiThaoTacMax: 0 }).bat, false);
  assert.strictEqual(NT.chuanHoa({ nghiThaoTacBat: true, nghiThaoTacMin: -3, nghiThaoTacMax: 'abc' }).min, 0);
});

test('nhịp thao tác: bốc thời gian nằm trong khoảng người dùng chọn', () => {
  const k = { bat: true, min: 2, max: 5 };
  assert.strictEqual(NT.bocMs(k, () => 0), 2000);
  assert.strictEqual(NT.bocMs(k, () => 0.999999), 5000);
  assert.strictEqual(NT.bocMs({ bat: false, min: 2, max: 5 }, () => 0.5), 0, 'tắt thì không nghỉ');
  for (let i = 0; i < 500; i++) {
    const ms = NT.bocMs(k);
    assert.ok(ms >= 2000 && ms <= 5000, `ra ngoài khoảng: ${ms}`);
  }
  // Ngẫu nhiên THẬT: 500 lần không được ra cùng một số.
  const ds = new Set(Array.from({ length: 500 }, () => NT.bocMs(k)));
  assert.ok(ds.size > 50, 'khoảng nghỉ không ngẫu nhiên');
});

testAsync('nhịp thao tác: nghỉ đủ, ghi nhật ký có giới hạn, bấm Dừng là cắt ngang', async () => {
  const log = [];
  let daNgu = 0;
  const ngu = async (ms) => { daNgu += ms; };
  const tab = { id: 'tab1' };
  NT.ganChoTab(tab, { nghiThaoTacBat: true, nghiThaoTacMin: 3, nghiThaoTacMax: 3 });
  const ms = await NT.nghi(tab, 'truocTao', (m) => log.push(m), { ngu });
  assert.strictEqual(ms, 3000);
  assert.strictEqual(daNgu, 3000);
  assert.ok(/Nghỉ 3,0s — nhập xong, trước khi bấm Tạo/.test(log[0]), log[0]);

  // Không tràn nhật ký: 30 lần nghỉ chỉ ra 10 dòng + 1 dòng báo.
  for (let i = 0; i < 29; i++) await NT.nghi(tab, 'truocNhap', (m) => log.push(m), { ngu });
  assert.strictEqual(log.length, 11, `ghi ${log.length} dòng`);

  // Tắt thì không nghỉ và không ghi gì.
  const t2 = { id: 't2' };
  NT.ganChoTab(t2, { nghiThaoTacBat: false, nghiThaoTacMin: 3, nghiThaoTacMax: 3 });
  assert.strictEqual(await NT.nghi(t2, 'truocTai', () => { throw new Error('không được ghi'); }, { ngu }), 0);

  // Dừng giữa chừng: nghỉ 60 giây, bấm Dừng sau 1 giây → thôi ngay.
  const t3 = { id: 't3' };
  NT.ganChoTab(t3, { nghiThaoTacBat: true, nghiThaoTacMin: 60, nghiThaoTacMax: 60 });
  let dem = 0;
  const nguRoiDung = async (x) => { dem += x; if (dem >= 1000) NT.huy(t3); };
  const da = await NT.nghi(t3, 'truocTao', null, { ngu: nguRoiDung });
  assert.ok(da <= 1250, `bấm Dừng rồi vẫn nghỉ ${da}ms`);
});

test('nhịp thao tác: nối đúng chỗ trong máy Flow (may-flow.js)', () => {
  const m = boGhiChu(docNguon('main.js'));               // → src/flow/may-flow.js
  const khoi = (dau, sau) => khoiGiua(m, dau, sau);

  const dan = khoi("case 'INJECT_PASTE'", "case 'INJECT_CLICK_CREATE'");
  const iTruoc = dan.indexOf("nhipTT.nghi(tab, 'truocNhap'");
  const iDan = dan.indexOf('pastePrompt(');
  const iSau = dan.indexOf("nhipTT.nghi(tab, 'truocTao'");
  assert.ok(iTruoc >= 0 && iTruoc < iDan, 'chưa nghỉ TRƯỚC khi nhập prompt');
  assert.ok(iSau > iDan, 'chưa nghỉ SAU khi nhập, trước khi trả lời engine (trước khi bấm Tạo)');
  assert.ok(iSau < dan.lastIndexOf('return {'), 'phải nghỉ trước khi trả lời engine');

  // KHÔNG nghỉ trong INJECT_CLICK_CREATE: engine đã chụp danh sách thẻ trước
  // khi gửi lệnh này — nghỉ ở đó thì ảnh chụp cũ, dễ nhận nhầm thẻ.
  const bam = khoi("case 'INJECT_CLICK_CREATE'", "case 'INJECT_RENAME_INPUT'");
  assert.ok(bam && !/nhipTT\.nghi/.test(bam), 'không được nghỉ bên trong INJECT_CLICK_CREATE');

  assert.ok(/nhipTT\.nghi\(tab, 'truocDoiTen'/.test(khoi("case 'INJECT_RENAME_INPUT'", "case 'SET_NEXT_FILENAME'")),
    'chưa nghỉ trước khi đổi tên');
  const tai = khoi("case 'SET_NEXT_FILENAME'", "case 'UNSET_NEXT_FILENAME'");
  assert.ok(tai.indexOf("nhipTT.nghi(tab, 'truocTai'") >= 0 &&
    tai.indexOf("nhipTT.nghi(tab, 'truocTai'") < tai.indexOf('pushName('), 'chưa nghỉ trước khi tải về');
  const slot = khoi("case 'ACQUIRE_CREATE_SLOT'", "case 'CAN_SHUTDOWN'");
  assert.ok(slot.indexOf("nhipTT.nghi(tab, 'truocModel'") >= 0 &&
    slot.indexOf("nhipTT.nghi(tab, 'truocModel'") < slot.indexOf('datModel('), 'chưa nghỉ trước khi đổi model');

  // Gắn cấu hình ở đường giao việc duy nhất (chuanBiMe — luồng Flow gọi trước mỗi mẻ, kể cả mẻ
  // video nối sau ảnh). Gắn lại MỖI mẻ để đếm dòng nhật ký đặt lại từ đầu.
  assert.strictEqual((m.match(/^\s+ganNhipThaoTac\(tab, settings\);/gm) || []).length, 1,
    'phải gắn nhịp thao tác đúng một chỗ giao việc');
  assert.ok(/ganNhipThaoTac\(tab, settings\);/.test(thanHam(m, 'async function chuanBiMe')), 'chuanBiMe chưa gắn nhịp thao tác');
  // Tạm dừng / Dừng phải cắt ngang lần nghỉ đang chờ (kẻo dán prompt cũ sau khi đã dừng).
  const mf = boGhiChu(docNguon('src', 'flow', 'may-flow.js'));
  const lf = boGhiChu(docNguon('src', 'flow', 'luong-flow.js'));
  const demPause = (mf.match(/PAUSE_AUTOMATION/g) || []).length;
  assert.strictEqual((mf.match(/nhipTT\.huy\(t\);[^\n]*\n?[^\n]*PAUSE_AUTOMATION/g) || []).length, demPause, 'mọi PAUSE_AUTOMATION phải đi sau nhipTT.huy(t)');
  const demStop = (lf.match(/STOP_AUTOMATION/g) || []).length;
  assert.strictEqual((lf.match(/nhipTT\.huy\(t\);[^\n]*\n\s*this\.tabs\.dispatch\(t\.id, \{ action: 'STOP_AUTOMATION' \}\)/g) || []).length, demStop, 'mọi STOP_AUTOMATION của luồng phải đi sau nhipTT.huy(t)');
});

test('nhịp thao tác: giao diện có ô và gửi đi đúng khoá', () => {
  const html = docNguon('src', 'ui', 'index.html');
  for (const id of ['fNghiTT', 'fNghiTTMin', 'fNghiTTMax'])
    assert.ok(html.includes(`id="${id}"`), `thiếu #${id}`);
  const bang = bangOFlow('O_FLOW');
  const khoa = (id) => (bang.find(([o]) => o === id) || [])[1];
  assert.deepStrictEqual([khoa('fNghiTT'), khoa('fNghiTTMin'), khoa('fNghiTTMax')],
    ['nghiThaoTacBat', 'nghiThaoTacMin', 'nghiThaoTacMax'], 'O_FLOW chưa có ô nghỉ — không lưu, không gửi đi');
  // Khoá giao diện gửi PHẢI đúng khoá tiến trình chính đọc, và caiDatEngine mang chúng theo mẻ.
  const nt = docNguon('src', 'main', 'nhip-thao-tac.js');
  for (const k of ['nghiThaoTacBat', 'nghiThaoTacMin', 'nghiThaoTacMax'])
    assert.ok(nt.includes('r.' + k), `nhip-thao-tac.js không đọc ${k}`);
  const s = caiDatEngine({ nghiThaoTacBat: true, nghiThaoTacMin: '2', nghiThaoTacMax: '5' }, { loai: 'anh', ten: [] });
  assert.deepStrictEqual(NT.chuanHoa(s), { bat: true, min: 2, max: 5 }, 'mẻ gửi đi không mang đúng cài đặt nhịp thao tác');
  assert.strictEqual(NT.chuanHoa(caiDatEngine({}, { loai: 'anh', ten: [] })).bat, false, 'mặc định phải TẮT');
});

// ── 2.8.9: thời gian quy trình, ảnh tham chiếu dính, model ảnh ────────────
const TG = require('../../src/flow/main/thoi-gian');

test('thời gian: đồng hồ quy trình và dự đoán lúc xong (cả mẻ video nối sau)', () => {
  const t0 = 1_000_000;
  // Mẻ 10 ảnh, sẽ nối 10 video. Sau 120 s xong 2 ảnh → 60 s/ảnh.
  let q = TG.batDau(t0, 'image', 10, 10);
  let u = TG.uocTinh(q, { done: 2, failed: 0 }, {}, t0 + 120000);
  assert.strictEqual(u.daChayMs, 120000);
  assert.strictEqual(u.conLaiMs, 8 * 60000 + 10 * TG.MAC_DINH_MS.video, 'còn = 8 ảnh × 60 s + 10 video × mặc định');
  assert.strictEqual(u.xongLuc, t0 + 120000 + u.conLaiMs);
  assert.ok(/thuc-te/.test(u.nguon));
  // Lỗi cũng là đã xử lý xong (không chạy lại).
  u = TG.uocTinh(q, { done: 1, failed: 1 }, {}, t0 + 120000);
  assert.strictEqual(u.conLaiMs, 8 * 60000 + 10 * TG.MAC_DINH_MS.video);
  // Có lịch sử video thì dùng lịch sử cho mẻ chờ nối.
  u = TG.uocTinh(q, { done: 2 }, { video: 90000 }, t0 + 120000);
  assert.strictEqual(u.conLaiMs, 8 * 60000 + 10 * 90000);
  // Chưa xong cái nào: dùng lịch sử, trừ phần đã chạy, nhưng còn ≥ nửa prompt.
  u = TG.uocTinh(TG.batDau(t0, 'image', 3, 0), { done: 0 }, { image: 40000 }, t0 + 30000);
  assert.strictEqual(u.conLaiMs, 3 * 40000 - 30000);
  assert.strictEqual(u.nguon, 'lich-su');
  u = TG.uocTinh(TG.batDau(t0, 'image', 1, 0), { done: 0 }, {}, t0 + 999999);
  assert.strictEqual(u.conLaiMs, TG.MAC_DINH_MS.image * 0.5, 'prompt đầu chạy lâu hơn dự kiến: không về 0');
  assert.strictEqual(u.nguon, 'mac-dinh');
  // Đang nghỉ hạ nhiệt: cộng thời gian nghỉ còn lại.
  const coNghi = TG.uocTinh(q, { done: 2 }, {}, t0 + 120000, 5 * 60000);
  assert.strictEqual(coNghi.conLaiMs, 8 * 60000 + 10 * TG.MAC_DINH_MS.video + 5 * 60000);
  // Sang mẻ video: đồng hồ tổng GIỮ NGUYÊN, không đặt lại.
  q = TG.sangPhaVideo(q, t0 + 600000, 10);
  u = TG.uocTinh(q, { done: 0 }, {}, t0 + 600000);
  assert.strictEqual(u.batDau, t0);
  assert.strictEqual(u.daChayMs, 600000);
  assert.strictEqual(u.conLaiMs, 10 * TG.MAC_DINH_MS.video);
  // Xong: đồng hồ đứng.
  q = TG.ketThuc(q, t0 + 1600000);
  u = TG.uocTinh(q, { done: 10 }, {}, t0 + 9999999);
  assert.strictEqual(u.daChayMs, 1600000);
  assert.strictEqual(u.conLaiMs, 0);
  assert.strictEqual(TG.ketThuc(q, t0 + 1).ketThuc, t0 + 1600000, 'kết thúc hai lần không dời mốc');
  // Lịch sử: trộn nửa cũ nửa mới.
  assert.deepStrictEqual(TG.ghiLichSu({}, 'image', 50000), { image: 50000 });
  assert.deepStrictEqual(TG.ghiLichSu({ image: 50000 }, 'image', 70000), { image: 60000 });
  assert.strictEqual(TG.dinhDang(3725000), '1:02:05');
  assert.strictEqual(TG.dinhDang(65000), '1:05');
  assert.strictEqual(TG.uocTinh(null), null);
});

test('ảnh tham chiếu dính: nối đúng chỗ', () => {
  const m = boGhiChu(docNguon('main.js'));               // → src/flow/may-flow.js
  const dan = khoiGiua(m, "case 'INJECT_PASTE'", "case 'INJECT_CLICK_CREATE'");
  assert.ok(dan.indexOf('donAnhThamChieuTruocKhiDan(tab)') >= 0 &&
    dan.indexOf('donAnhThamChieuTruocKhiDan(tab)') < dan.indexOf('pastePrompt('), 'phải gỡ ảnh dính TRƯỚC khi dán');
  const don = thanHam(m, 'async function donAnhThamChieuTruocKhiDan');
  assert.ok(/tab\.goAnhTC/.test(don) && /thamChieu\.goHet\(/.test(don), 'chỉ gỡ khi mẻ cho phép (tab.goAnhTC)');
  assert.ok(/tab\.dungAnhTC\) return null/.test(thanHam(m, 'async function theoDoiAnhThamChieu')),
    'mẻ Character Sync / khung hình: không được theo dõi (lẫn ảnh cố ý)');
  // Đếm sau từng bước để lần ra bước nào làm ảnh dính.
  assert.ok(/theoDoiAnhThamChieu\(tab, `đổi tên/.test(m), 'chưa đếm sau bước đổi tên');
  assert.ok(/theoDoiAnhThamChieu\(tab, 'mở menu thẻ/.test(m), 'chưa đếm sau khi mở menu tải');
  assert.ok(/theoDoiAnhThamChieu\(tab, 'bấm Tạo'\)/.test(m), 'chưa đếm sau khi bấm Tạo');
  // Tải xong: DownloadManager báo DOWNLOAD_DONE qua notifyTab trong main.js gốc → đếm qua máy Flow.
  const tb = khoiGiua(docGoc('main.js'), 'notifyTab: (tabId, payload) => {', 'return tabsFlow.dispatch(tabId, payload);');
  assert.ok(/payload\.action === 'DOWNLOAD_DONE'/.test(tb) && /mayFlow\.theoDoiAnhThamChieu\(t, 'tải về'\)/.test(tb),
    'chưa đếm sau khi tải xong');
  assert.ok(/\btheoDoiAnhThamChieu,/.test(m.slice(m.lastIndexOf('return {'))), 'máy Flow chưa xuất theoDoiAnhThamChieu cho main.js');
  // Gắn luật ở đường giao việc duy nhất (chuanBiMe).
  assert.strictEqual((m.match(/^\s+await ganAnhThamChieu\(tab, settings\);/gm) || []).length, 1, 'gắn luật đúng một chỗ giao việc');
  assert.ok(/await ganAnhThamChieu\(tab, settings\);/.test(thanHam(m, 'async function chuanBiMe')), 'chuanBiMe chưa gắn luật ảnh tham chiếu');
  const tabs = docNguon('src', 'main', 'tabs.js');
  assert.ok(/flow-anh-tham-chieu\.js/.test(tabs) && /\['trình dò ảnh tham chiếu', n\.thamChieu\]/.test(tabs),
    'tab-flow.js chưa tiêm flow-anh-tham-chieu.js');
  // Công tắc ở Cài đặt → Google Flow: lưu / gửi đi, và BẬT sẵn.
  assert.ok(bangOFlow('O_FLOW').some(([id, k]) => id === 'fGoAnh' && k === 'goAnhThamChieu'), 'công tắc gỡ ảnh chưa được lưu / gửi đi');
  assert.ok(/id="fGoAnh"/.test(docNguon('src', 'ui', 'index.html')), 'thiếu công tắc #fGoAnh');
  assert.strictEqual(chuanHoaFlow({}).goAnhThamChieu, true, 'công tắc gỡ ảnh phải BẬT sẵn');
  const thamChieu = require('../../src/flow/main/anh-tham-chieu');
  assert.strictEqual(thamChieu.nenGo(caiDatEngine({}, { loai: 'anh', ten: [] })), true, 'mặc định phải gỡ ảnh dính');
  assert.strictEqual(thamChieu.nenGo(caiDatEngine({ goAnhThamChieu: false }, { loai: 'anh', ten: [] })), false, 'tắt công tắc mà vẫn gỡ');
  assert.strictEqual(thamChieu.nenGo(caiDatEngine({}, { loai: 'video', ten: [], coAnh: true })), false, 'mẻ có ảnh @ (Character Sync) mà vẫn gỡ');
});

test('model ảnh: mặc định Nano Banana 2 Lite, áp sau khi đổi sang chế độ ảnh', () => {
  assert.strictEqual(FLOW_MAC_DINH.modelAnh, 'Nano Banana 2 Lite', 'mặc định Model ảnh phải là Nano Banana 2 Lite');
  assert.strictEqual(chuanHoaFlow({}).modelAnh, 'Nano Banana 2 Lite');
  assert.strictEqual(chuanHoaFlow({ modelAnh: '' }).modelAnh, '', 'để trống (giữ nguyên trên Flow) phải được tôn trọng');
  assert.strictEqual(caiDatEngine({}, { loai: 'anh', ten: [] }).modelAnh, 'Nano Banana 2 Lite', 'modelAnh chưa được gửi đi');
  assert.ok(bangOFlow('O_FLOW').some(([id, k]) => id === 'fModelAnh' && k === 'modelAnh'), 'modelAnh chưa được lưu / gửi đi');
  const app = docNguon('src', 'ui', 'app.js');
  assert.ok(/fModelAnh: \{ ds: \[[^\]]*'Nano Banana 2 Lite'/.test(app), 'hộp Model ảnh thiếu Nano Banana 2 Lite');
  assert.ok(/datChonModel\('fModelAnh', f\.modelAnh\)/.test(thanHam(app, 'function veCaiDat')),
    'nạp lại cài đặt: tên model ảnh chưa có trong hộp sẽ bị mất');
  const m = boGhiChu(docNguon('main.js'));               // → src/flow/may-flow.js
  const cb = thanHam(m, 'async function chuanBiMe');
  const iCheDo = cb.indexOf('await datCheDoKienTri(tab, settings.runMode');
  const iAnh = cb.indexOf("if (settings.runMode === 'image') await datModelAnh(tab, settings);");
  assert.ok(iCheDo >= 0 && iAnh > iCheDo, 'phải chọn model ảnh SAU khi đã sang chế độ ảnh');
  assert.ok(/if \(!doi\.ok\) return/.test(cb.slice(iCheDo, iAnh)), 'đổi chế độ hỏng thì không được chọn model ảnh / giao mẻ');
  const dma = thanHam(m, 'async function datModelAnh');
  assert.ok(/tab\.modelHienTai = null/.test(dma), 'chọn model ảnh xong phải xoá modelHienTai (của kế hoạch video)');
});

// ── 1.2.0: nhận diện tài khoản lỗi chạy thật trong máy Flow (tab giả) ──────
testAsync('tài khoản lỗi (máy Flow): 2 prompt khác nhau hỏng → đổi tài khoản ngay; thử lại cùng prompt / có prompt xong xen giữa thì chưa', async () => {
  const { taoMayFlow } = require('../../src/flow/may-flow');
  const doi = [], nhatKy = [];
  let theLoi = [];
  const tab = { id: 'T1', accountId: 'flow-1', accountName: 'Flow 1', busy: true, ready: true,
    view: { webContents: { id: 7, isDestroyed: () => false,
      executeJavaScript: async (js) => (/__flowDocLyDoTheLoi/.test(js) ? { ok: true, lyDo: theLoi } : /__flowDoCanhBao/.test(js) ? { co: false } : null) } } };
  const tabs = { tabs: [tab], findByWcId: (id) => (id === 7 ? tab : null), find: () => tab, dispatch: async () => ({ ok: true }) };
  const may = taoMayFlow({ tabs, taiVe: {}, log: (m, c) => nhatKy.push(c), thongBao: () => {},
    nghiTaiKhoan: (id, ms, lyDo) => { doi.push([id, ms, lyDo]); return true; } });
  may.datCaiDatAnToan({ nguong: 2, nghiPhut: 15 });
  const bang = async (rows, isRunning = true) => { await may.handleEngineMessage({ action: 'UPDATE_TABLE_DATA', data: { rows, isRunning } }, { id: 7 }); await new Promise((r) => setTimeout(r, 5)); };
  await bang([{ index: 1, status: 'ERROR', retries: 0, error: 'Không thành công (Policy/Error)' }]);
  await bang([{ index: 1, status: 'ERROR', retries: 1, error: 'Không thành công (Policy/Error)' }]);
  assert.strictEqual(doi.length, 0, 'MỘT prompt thử lại hỏng lần nữa chưa phải tài khoản hỏng');
  await bang([{ index: 1, status: 'ERROR', retries: 1 }, { index: 2, status: 'COMPLETED' }]);
  await bang([{ index: 1, status: 'ERROR', retries: 1 }, { index: 2, status: 'COMPLETED' }, { index: 3, status: 'ERROR', retries: 0 }]);
  assert.strictEqual(doi.length, 0, 'có prompt xong xen giữa → đếm lại từ đầu');
  await bang([{ index: 3, status: 'ERROR', retries: 0 }, { index: 4, status: 'ERROR', retries: 0 }]);
  assert.strictEqual(doi.length, 1, '2 prompt khác nhau hỏng liền nhau → đổi tài khoản');
  assert.deepStrictEqual(doi[0].slice(0, 2), ['flow-1', 15 * 60000]);
  // Chữ trên thẻ lỗi nói hết tín dụng → đổi ngay từ lỗi đầu tiên.
  theLoi = ['Not enough credits to generate'];
  await bang([{ index: 5, status: 'ERROR', retries: 0 }]);
  assert.strictEqual(doi.length, 2, 'hết tín dụng ghi trên thẻ → đổi tài khoản ngay');
  assert.strictEqual(doi[1][1], 30 * 60000, 'bị lại → nghỉ gấp đôi');
  assert.ok(nhatKy.some((x) => /Not enough credits/.test(x)), 'chữ trên thẻ vẫn ghi vào nhật ký');
  // Lỗi đến khi tab đã thôi chạy (việc đã về điều phối) → bỏ dấu lỗi, mẻ SAU không bị đổi oan.
  theLoi = [];
  await bang([{ index: 6, status: 'ERROR', retries: 0 }, { index: 7, status: 'ERROR', retries: 0 }], false);
  assert.strictEqual(doi.length, 2, 'không tab nào chạy thì không đổi tài khoản');
  await bang([{ index: 1, status: 'ERROR', retries: 0 }]);
  assert.strictEqual(doi.length, 2, 'mẻ mới hỏng 1 prompt — dấu lỗi cũ không được cộng dồn vào');
});

// ── Kết luận ───────────────────────────────────────────────────────────────
(async () => {
await Promise.all(choAsync);
console.log('');
console.log('─'.repeat(58));
if (failures.length) {
  console.log(`KẾT QUẢ: ${pass} pass, ${failures.length} LỖI\n`);
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}\n`));
  console.log('─'.repeat(58));
  process.exit(1);
}
console.log(`KẾT QUẢ: ${pass}/${pass} PASS`);
console.log('─'.repeat(58));
console.log('');
})();
