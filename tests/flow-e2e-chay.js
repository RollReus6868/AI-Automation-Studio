'use strict';
// Kịch bản đầu-cuối GOOGLE FLOW, chạy BÊN TRONG app thật (MUSE_TEST). Chạy bằng: node tests/e2e.js flow
// Trang Flow + engine Flow là bản GIẢ (tests/flow-gia/) nói đúng hợp đồng message của engine thật:
// bài này kiểm phần của APP (hàng đợi, mẻ, tên file, tải về, kho ảnh @tên, chuyển tài khoản, nối Flow ⇄ Muse),
// KHÔNG kiểm được giao diện thật của Google Flow.
const fs = require('fs');
const path = require('path');
const { session, net } = require('electron');

module.exports = function e2eFlow({ win, app, LENH, dieuPhoi, taiKhoan }) {
  const tam = process.env.MUSE_E2E_TAM;
  const nhatKyFile = path.join(tam, 'e2e-log.txt');
  const ghi = (s) => { fs.appendFileSync(nhatKyFile, s + '\n'); console.log(s); };
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  const loi = [];
  const kiem = (dk, ten) => { ghi(`${dk ? '  ✔' : '  ✘'} ${ten}`); if (!dk) loi.push(ten); };
  // 1.3.0: cài đặt theo dự án — bài kiểm đặt cho bộ chung (dự án tạo bằng LENH.taoDuAn theo bộ chung) và MỌI dự án đang có.
  const datCD = (c) => { LENH.datCaiDat(c); for (const d of dieuPhoi.duAn) LENH.datCaiDat({ duAn: d.id, ...c }); };
  const cho = async (dk, ms, ten) => {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (dk()) return true; await ngu(250); }
    ghi(`  ⏱ quá giờ chờ: ${ten}`);
    return false;
  };
  const viec = () => dieuPhoi.viec;
  const flowGhi = async () => (await net.fetch(`${process.env.MUSE_URL}/__flow-ghi`)).json();
  const daGui = async () => (await net.fetch(`${process.env.MUSE_URL}/__da-gui`)).json();
  const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQAy2wIDqvFBJQAAAABJRU5ErkJggg==', 'base64');
  const xongHet = (ds) => () => ds.every((j) => j.trangThai === 'xong' || j.trangThai === 'loi');
  const inViec = (ds) => { for (const j of ds) ghi(`   #${j.so} ${j.nen} ${j.loai} ${j.trangThai} tk=${j.taiKhoan} ${j.loi || ''} ${(j.files || []).map((f) => path.basename(f)).join(',')}`); };
  const dongNhatKy = (tu) => { for (const d of LENH.trangThai().nhatKy.slice(tu)) ghi(`   | ${d.chu}`); };

  win.webContents.once('did-finish-load', async () => {
    try {
      ghi('== E2E Google Flow (trang + engine giả) ==');
      await session.fromPartition('persist:muse-tk-1').cookies.set({ url: process.env.MUSE_URL, name: 'muse_login', value: '1' });
      const ra = path.join(tam, 'ra');
      datCD({ luongMoiTK: 2, nghiGiuaLanGui: 0, choChuGiay: 15, tuThuLai: 0, tuChayLaiLoi: 0, thuMucAnh: ra, thuMucVideo: ra,
        flow: { delayMin: 1, delayMax: 1, randomDelay: false, modelAnh: '', maxRetries: 1, anToan: { bat: false } } });
      kiem(taiKhoan.ds.some((a) => a.id === 'flow-1' && a.nen === 'flow' && a.partition === 'persist:flow-flow-1'),
        'có sẵn tài khoản "Flow 1" (phiên riêng persist:flow-flow-1)');

      // 1) Mẻ ảnh Flow → mỗi ảnh xong tự tạo video ở MUSE.
      ghi('-- 1. Flow tạo ảnh (một mẻ) → Muse tạo video');
      let nk = LENH.trangThai().nhatKy.length;
      // Flow tự mở lại dự án cũ "gia-cu" khi tab vào trang chủ lần đầu (xem trang Flow giả).
      await session.fromPartition('persist:flow-flow-1').cookies.set({ url: process.env.FLOW_TEST_URL, name: 'flow_mo_du_an_cu', value: 'gia-cu' });
      LENH.them({ duAn: 'mac-dinh', loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['con mèo', 'con chó', 'con gà'],
        chuoiVideo: { prompt: 'chuyển động nhẹ', nen: 'muse' }, chay: true });
      const anh1 = viec().filter((j) => j.nen === 'flow' && j.loai === 'anh');
      await cho(() => xongHet(anh1)() && viec().filter((j) => j.loai === 'video').length === 3 && xongHet(viec().filter((j) => j.loai === 'video'))(),
        120000, 'ảnh Flow + video Muse xong');
      const video1 = viec().filter((j) => j.loai === 'video');
      inViec([...anh1, ...video1]);
      const g1 = await flowGhi();
      const start1 = g1.filter((x) => x.loai === 'start');
      kiem(start1.length === 1 && start1[0].d.videosToCreate.length === 3, `3 prompt ảnh giao trong MỘT mẻ (${start1.length} mẻ)`);
      const s1 = start1[0] ? start1[0].d.settings : {};
      kiem(s1.runMode === 'image' && s1.aspectRatio === '9:16' && s1.multiTab === true && s1.downloadImmediately === true &&
        s1.keyframeSync === false && s1.charSync === false && s1.renameMode === 'custom_list',
        `cài đặt mẻ đúng (runMode=${s1.runMode}, tỷ lệ=${s1.aspectRatio}, multiTab, tải ngay, tên theo danh sách)`);
      kiem(String(s1.renameCustomList || '').split('\n').length === 3, `tên file 3 dòng: ${JSON.stringify(s1.renameCustomList)}`);
      kiem(g1.some((x) => x.loai === 'mode' && x.d.mode === 'image'), 'app đổi Flow sang chế độ ảnh trước khi giao mẻ');
      kiem(anh1.every((j) => j.trangThai === 'xong' && j.taiKhoan === 'flow-1' && j.files.length === 1 && /\.png$/.test(j.files[0]) && fs.existsSync(j.files[0])),
        'cả 3 ảnh xong ở "Flow 1", file .png nằm trong thư mục kết quả');
      kiem(anh1.every((j) => j.flowTen && j.flowTen.tk === 'flow-1' && j.flowTen.ten), 'nhớ tên ảnh trên Flow (để video Flow dùng lại bằng @tên)');
      kiem(new Set(anh1.map((j) => fs.readFileSync(j.files[0]).length)).size === 1 && fs.readFileSync(anh1[0].files[0]).equals(PNG1),
        'nội dung file ảnh đúng là file Flow tải về');
      // Đọc từ KHO đã lưu (không phải object trong bộ nhớ — luồng gán thẳng vào đó nên che mất lỗi kho từ chối địa chỉ).
      // 1.3.0: địa chỉ dự án Flow lưu theo DỰ ÁN của app (mỗi dự án app một dự án Flow riêng ở từng tài khoản).
      const flowUrlLuu = (duAnId, tkId) => (((dieuPhoi.o.store.get('duAn').duAn || []).find((d) => d.id === duAnId) || {}).flowUrl || {})[tkId] || '';
      const luu1 = flowUrlLuu('mac-dinh', 'flow-1');
      kiem(/\/project\//.test(luu1), `nhớ (đã LƯU) trang dự án Flow của dự án "Mặc định" ở tài khoản: ${luu1}`);
      kiem(LENH.trangThai().nhatKy.some((d) => /Mở dự án Flow mới/.test(d.chu)), 'trang chủ Flow: bấm được nút NỔI "+ Dự án mới" (position:fixed) có biểu tượng chữ đứng trước');
      kiem(!luu1.includes('gia-cu') && LENH.trangThai().nhatKy.some((d) => /dự án Flow cũ — về trang chủ/.test(d.chu)),
        'Flow mở lại dự án cũ → app về trang chủ, tạo dự án MỚI (không dùng dự án cũ)');
      await session.fromPartition('persist:flow-flow-1').cookies.remove(process.env.FLOW_TEST_URL, 'flow_mo_du_an_cu');
      kiem(video1.length === 3 && video1.every((j) => j.nen === 'muse' && j.trangThai === 'xong' && j.taiKhoan === 'tk-1' && /\.mp4$/.test(j.files[0] || '')),
        'mỗi ảnh Flow sinh đúng 1 video chạy ở MUSE, xong có file .mp4');
      const gui1 = (await daGui()).filter((g) => /chuyển động nhẹ/.test(g.prompt));
      kiem(gui1.length === 3 && gui1.every((g) => g.soFile === 1), `Muse nhận 3 prompt video, mỗi prompt kèm đúng 1 ảnh Flow (${gui1.map((g) => g.soFile)})`);
      const truoc = LENH.trangThai().nhatKy.slice(nk);
      kiem(truoc.some((d) => /Giao mẻ 3 ảnh cho Flow/.test(d.chu)), 'nhật ký báo giao mẻ cho Flow');

      // 2) Muse tạo ảnh → Flow tạo video: ảnh được tải lên kho Flow, prompt kèm @tên, bật Character Sync.
      ghi('-- 2. Muse tạo ảnh → Flow tạo video');
      nk = LENH.trangThai().nhatKy.length;
      const soTruoc2 = viec().length;
      LENH.them({ duAn: 'mac-dinh', loai: 'anh', nen: 'muse', tyLe: '16:9', prompts: ['bãi biển'],
        chuoiVideo: { prompt: 'sóng vỗ', nen: 'flow' }, chay: true });
      const anh2 = viec()[soTruoc2];
      await cho(() => { const v = viec().find((j) => j.tuAnh === anh2.id); return v && xongHet([v])(); }, 120000, 'video Flow từ ảnh Muse xong');
      const vid2 = viec().find((j) => j.tuAnh === anh2.id);
      inViec([anh2, vid2].filter(Boolean));
      const g2 = (await flowGhi()).slice(g1.length);
      const up2 = g2.filter((x) => x.loai === 'upload');
      const st2 = g2.filter((x) => x.loai === 'start');
      kiem(anh2.trangThai === 'xong' && anh2.nen === 'muse', 'ảnh tạo ở Muse xong');
      kiem(vid2 && vid2.nen === 'flow' && vid2.trangThai === 'xong' && /\.mp4$/.test(vid2.files[0] || '') && fs.existsSync(vid2.files[0]),
        'video chạy ở FLOW, xong có file .mp4');
      kiem(up2.length === 1 && up2[0].d.names.length === 1 && /^data:image\//.test(up2[0].d.dataUrl[0]), 'ảnh Muse được tải lên kho Flow (1 ảnh, dạng data URL)');
      const ma2 = up2[0] ? up2[0].d.names[0].replace(/\.[^.]+$/, '') : '?';
      const p2 = st2[0] ? st2[0].d.prompts[0] : '';
      kiem(st2.length === 1 && p2 === `sóng vỗ @${ma2}`, `prompt video gửi Flow kèm @tên ảnh ("${p2}")`);
      const s2 = st2[0] ? st2[0].d.settings : {};
      kiem(s2.runMode === 'video' && s2.charSync === true && s2.keyframeSync === false && s2.aspectRatio === '16:9',
        `mẻ video: chế độ video, Character Sync bật, khung hình tắt, tỷ lệ theo ảnh (${s2.aspectRatio})`);
      kiem(g2.some((x) => x.loai === 'mode' && x.d.mode === 'video'), 'app đổi Flow sang chế độ video');

      // 3) Flow ảnh → Flow video CÙNG tài khoản: dùng lại tên ảnh trên Flow, KHÔNG tải lên lại.
      ghi('-- 3. Flow ảnh → Flow video (cùng tài khoản)');
      const soTruoc3 = viec().length, g3dau = (await flowGhi()).length, nk3 = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: 'mac-dinh', loai: 'anh', nen: 'flow', tyLe: '16:9', prompts: ['ngọn núi'],
        chuoiVideo: { prompt: 'mây bay', nen: 'flow' }, chay: true });
      const anh3 = viec()[soTruoc3];
      await cho(() => { const v = viec().find((j) => j.tuAnh === anh3.id); return v && xongHet([v])(); }, 120000, 'video Flow từ ảnh Flow xong');
      const vid3 = viec().find((j) => j.tuAnh === anh3.id);
      inViec([anh3, vid3].filter(Boolean));
      const g3 = (await flowGhi()).slice(g3dau);
      const st3 = g3.filter((x) => x.loai === 'start');
      kiem(vid3 && vid3.trangThai === 'xong' && vid3.nen === 'flow', 'video Flow xong');
      kiem(!g3.some((x) => x.loai === 'upload'), 'không tải ảnh lên lại (ảnh đã có trên Flow của tài khoản này)');
      kiem(st3.length === 2 && st3[1].d.prompts[0] === `mây bay @${anh3.flowTen && anh3.flowTen.ten}`,
        `prompt video dùng đúng tên ảnh trên Flow (${st3[1] && st3[1].d.prompts[0]})`);
      if (anh3.nen !== 'flow' || st3.length !== 2) dongNhatKy(nk3);   // CI đỏ mục này → có nhật ký để truy

      // 4) Tài khoản Flow hỏng → việc chuyển NGAY sang tài khoản Flow dự phòng.
      ghi('-- 4. Flow 1 lỗi → chuyển sang Flow 2');
      const tk2 = await LENH.themTaiKhoan({ ten: 'Flow 2', nen: 'flow' });
      kiem(tk2 && tk2.nen === 'flow' && /^persist:flow-/.test(tk2.partition), `thêm tài khoản Flow (${tk2 && tk2.partition})`);
      await session.fromPartition('persist:flow-flow-1').cookies.set({ url: process.env.MUSE_URL, name: 'flow_hong', value: '1' });
      nk = LENH.trangThai().nhatKy.length;
      const soTruoc4 = viec().length;
      LENH.them({ duAn: 'mac-dinh', loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['dự phòng 1', 'dự phòng 2'], chay: true });
      const v4 = viec().slice(soTruoc4);
      await cho(xongHet(v4), 120000, 'việc chuyển sang Flow 2 xong');
      inViec(v4);
      kiem(v4.every((j) => j.trangThai === 'xong' && j.taiKhoan === tk2.id && (j.tkLoi || []).includes('flow-1')),
        'cả 2 việc lỗi ở "Flow 1" rồi xong ở "Flow 2"');
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /chuyển sang "Flow 2"/.test(d.chu)), 'nhật ký báo chuyển tài khoản');
      kiem(!viec().slice(soTruoc4).some((j) => j.nen === 'muse'), 'việc Flow không bị đẩy sang tài khoản Muse');
      await session.fromPartition('persist:flow-flow-1').cookies.remove(process.env.MUSE_URL, 'flow_hong');

      // 5) Dừng giữa mẻ: engine nhận STOP, việc về hàng chờ (không thành lỗi).
      ghi('-- 5. Dừng giữa mẻ Flow');
      const soTruoc5 = viec().length, g5dau = (await flowGhi()).length;
      LENH.them({ duAn: 'mac-dinh', loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['CHAM dừng 1', 'CHAM dừng 2'], chay: true });
      const v5 = viec().slice(soTruoc5);
      await cho(() => v5.some((j) => /Flow đang tạo/.test(j.buoc || '')), 60000, 'mẻ đang tạo');
      LENH.dung();
      await cho(() => v5.every((j) => j.trangThai === 'cho') && !dieuPhoi.coViecDangChay(), 20000, 'việc về Chờ');
      inViec(v5);
      kiem(v5.every((j) => j.trangThai === 'cho' && !j.thu), 'Dừng → cả mẻ về hàng chờ, không tính lần thử');
      kiem((await flowGhi()).slice(g5dau).some((x) => x.loai === 'stop'), 'engine Flow nhận lệnh dừng');
      LENH.xoaViec({ ids: v5.map((j) => j.id) });

      // 6) Tài khoản chưa đăng nhập Google: nhận ra trang đăng nhập, đánh dấu, việc về hàng chờ.
      ghi('-- 6. Tài khoản Flow chưa đăng nhập');
      const tk3 = await LENH.themTaiKhoan({ ten: 'Flow 3', nen: 'flow' });
      await session.fromPartition(tk3.partition).cookies.set({ url: process.env.MUSE_URL, name: 'flow_dang_xuat', value: '1' });
      // Tắt "Muse ⇄ Flow" ở bước này: chỉ kiểm nhận ra chưa đăng nhập (bật thì ảnh sang Muse — mục 9).
      datCD({ doiNenKhiLoi: false });
      const d6id = LENH.taoDuAn({ ten: 'Chi Flow 3', taiKhoan: [tk3.id] }).id;
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: d6id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['chưa đăng nhập'], chay: true });
      const v6 = viec().filter((j) => j.duAn === d6id);
      await cho(() => taiKhoan.ds.find((a) => a.id === tk3.id).trangThai === 'can-dang-nhap' && !dieuPhoi.coViecDangChay(), 60000, 'nhận ra chưa đăng nhập');
      inViec(v6);
      kiem(taiKhoan.ds.find((a) => a.id === tk3.id).trangThai === 'can-dang-nhap', 'tài khoản bị đánh dấu "chưa đăng nhập"');
      kiem(v6.every((j) => j.trangThai === 'cho'), 'việc về hàng chờ (không thành lỗi)');
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /"Flow 3" chưa đăng nhập Flow/.test(d.chu)), 'nhật ký nói rõ tài khoản Flow nào chưa đăng nhập');
      LENH.dung();
      LENH.xoaViec({ ids: v6.map((j) => j.id) });
      datCD({ doiNenKhiLoi: true });

      // 7) 1.0.2: chạy hết hàng chờ → tự xoá dự án Flow vừa dùng (đúng dự án đó, dự án khác của người dùng
      //    giữ nguyên); tài khoản quên địa chỉ dự án → lần chạy sau tự mở dự án mới.
      ghi('-- 7. Tự xoá dự án Flow khi chạy xong');
      const dsDuAn = async () => (await net.fetch(`${process.env.MUSE_URL}/__flow-du-an`)).json();
      datCD({ xoaDuAnFlowKhiXong: true });
      const d7id = LENH.taoDuAn({ ten: 'Xoa du an', taiKhoan: ['flow-1'] }).id;
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: d7id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['xoá dự án sau khi xong'], chay: true });
      const v7 = viec().filter((j) => j.duAn === d7id);
      await cho(() => LENH.trangThai().nhatKy.slice(nk).some((d) => /đã xoá dự án Flow|không tự xoá được dự án Flow/.test(d.chu)), 120000, 'tự xoá dự án Flow');
      const url7 = (LENH.trangThai().nhatKy.slice(nk).map((d) => d.chu.match(/tự xoá dự án Flow (\S+)…/)).find(Boolean) || [])[1] || '';
      const ma7 = (url7.match(/\/project\/([^/?#]+)/) || [])[1];
      inViec(v7);
      dongNhatKy(nk);
      const con7 = await dsDuAn();
      kiem(v7.every((j) => j.trangThai === 'xong'), 'việc Flow xong trước khi dọn');
      kiem(ma7 && !con7.includes(ma7), `dự án Flow vừa dùng (${ma7}) đã bị xoá trên trang chủ Flow`);
      kiem(con7.includes('gia-khac'), 'dự án khác của người dùng (gia-khac) vẫn còn');
      kiem(!flowUrlLuu(d7id, 'flow-1'), 'dự án app quên địa chỉ dự án Flow đã xoá');
      // Lần chạy sau tự mở dự án mới.
      datCD({ xoaDuAnFlowKhiXong: false });
      LENH.them({ duAn: d7id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['chạy sau khi xoá dự án'], chay: true });
      const v7b = viec().filter((j) => j.duAn === d7id && !v7.includes(j));
      await cho(xongHet(v7b), 120000, 'chạy lại sau khi xoá dự án');
      const url7b = flowUrlLuu(d7id, 'flow-1');
      kiem(v7b.every((j) => j.trangThai === 'xong') && /\/project\//.test(url7b) && !url7b.includes(ma7), `lần sau tự mở dự án mới (${url7b})`);
      dongNhatKy(Math.max(0, LENH.trangThai().nhatKy.length - 8));
      // 1.3.2 (nhật ký 18/10/2026 01:34): dự án Flow đã nhớ bị xoá BÊN FLOW → Flow mở trang 404?reason=project.
      // App phải quên địa chỉ đó + ảnh trong dự án đó, tạo dự án Flow mới, không kẹt 120 giây.
      ghi('-- 7b. Dự án Flow đã nhớ bị xoá bên Flow (trang 404)');
      const daXoa7 = `${process.env.FLOW_TEST_URL}/project/da-xoa-tren-flow`;
      dieuPhoi.datFlowUrl(d7id, 'flow-1', daXoa7);
      kiem(flowUrlLuu(d7id, 'flow-1') === daXoa7 && v7b.some((j) => j.flowTen && j.flowTen.tk === 'flow-1'), 'chuẩn bị: dự án app nhớ dự án Flow đã bị xoá');
      nk = LENH.trangThai().nhatKy.length;
      const t7c = Date.now();
      LENH.them({ duAn: d7id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['dự án Flow đã bị xoá'], chay: true });
      const v7c = viec().filter((j) => j.duAn === d7id && !v7.includes(j) && !v7b.includes(j));
      await cho(xongHet(v7c), 120000, 'chạy khi dự án Flow đã bị xoá');
      const url7c = flowUrlLuu(d7id, 'flow-1');
      inViec(v7c);
      kiem(v7c.every((j) => j.trangThai === 'xong') && /\/project\//.test(url7c) && !/da-xoa|\/404/.test(url7c) && Date.now() - t7c < 60000,
        `trang 404 → tự tạo dự án Flow mới, việc xong (${url7c}, ${Math.round((Date.now() - t7c) / 1000)} giây)`);
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /Dự án Flow đã lưu không còn nữa \(Flow báo 404/.test(d.chu)), 'nhật ký nói rõ dự án Flow đã lưu không còn');
      kiem(v7b.every((j) => !j.flowTen), 'quên tên ảnh nằm trong dự án Flow đã bị xoá (video Flow sẽ tải ảnh lên lại)');
      dongNhatKy(nk);

      // 8) 1.2.0: dự án chạy 2 tài khoản Flow CÙNG LÚC — mẻ chia đôi, hai tài khoản chạy song song.
      ghi('-- 8. Hai tài khoản Flow chạy cùng lúc');
      const d8id = LENH.taoDuAn({ ten: 'Song song', taiKhoan: ['flow-1', tk2.id], chaySong: { flow: 2 } }).id;
      const g8dau = (await flowGhi()).length;
      LENH.them({ duAn: d8id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['CHAM song 1', 'CHAM song 2', 'CHAM song 3', 'CHAM song 4'], chay: true });
      const v8 = viec().filter((j) => j.duAn === d8id);
      let cungLuc = false;
      await cho(() => { if (new Set(v8.filter((j) => j.trangThai === 'chay').map((j) => j.taiKhoan)).size === 2) cungLuc = true; return xongHet(v8)(); }, 120000, 'hai tài khoản Flow xong');
      inViec(v8);
      const st8 = (await flowGhi()).slice(g8dau).filter((x) => x.loai === 'start');
      kiem(v8.every((j) => j.trangThai === 'xong'), 'cả 4 ảnh xong');
      kiem(v8.filter((j) => j.taiKhoan === 'flow-1').length === 2 && v8.filter((j) => j.taiKhoan === tk2.id).length === 2,
        `mỗi tài khoản 2 ảnh (${v8.map((j) => j.taiKhoan).join(', ')})`);
      kiem(cungLuc, 'hai tài khoản chạy CÙNG LÚC (không chờ nhau)');
      kiem(st8.length === 2 && st8.every((x) => x.d.videosToCreate.length === 2), `2 mẻ, mỗi mẻ 2 prompt (${st8.map((x) => x.d.videosToCreate.length).join('+')})`);

      // 9) 1.2.0: mọi tài khoản Flow của dự án hỏng khi tạo ảnh → ảnh tự tạo tiếp ở Muse.
      ghi('-- 9. Flow hỏng hết → ảnh sang Muse');
      await session.fromPartition('persist:flow-flow-1').cookies.set({ url: process.env.MUSE_URL, name: 'flow_hong', value: '1' });
      const d9id = LENH.taoDuAn({ ten: 'Flow sang Muse', taiKhoan: ['flow-1', 'tk-1'] }).id;
      nk = LENH.trangThai().nhatKy.length;
      LENH.them({ duAn: d9id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['sang muse 1', 'sang muse 2'], chay: true });
      const v9 = viec().filter((j) => j.duAn === d9id);
      await cho(xongHet(v9), 180000, 'ảnh xong ở Muse');
      inViec(v9);
      dongNhatKy(nk);
      kiem(v9.every((j) => j.trangThai === 'xong' && j.nen === 'muse' && j.taiKhoan === 'tk-1' && fs.existsSync(j.files[0])), 'ảnh hỏng ở Flow được tạo xong ở Muse');
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /🔀 Flow → Muse: /.test(d.chu)), 'nhật ký báo chuyển sang Muse');
      await session.fromPartition('persist:flow-flow-1').cookies.remove(process.env.MUSE_URL, 'flow_hong');

      // 10) Nhật ký 16/10/2026: Flow tạo xong mà tải về kẹt mãi (engine tự thử tải lại ~16 phút) → app thôi chờ
      //     sau FLOW_CHO_TAI_MS, việc sang tài khoản khác.
      ghi('-- 10. Tạo xong mà tải về kẹt → sang tài khoản khác');
      await session.fromPartition('persist:flow-flow-1').cookies.set({ url: process.env.MUSE_URL, name: 'flow_khong_tai', value: '1' });
      const d10id = LENH.taoDuAn({ ten: 'Tai ket', taiKhoan: ['flow-1', tk2.id] }).id;
      nk = LENH.trangThai().nhatKy.length;
      const bd10 = Date.now();
      dieuPhoi.nghiDen = {}; dieuPhoi.loiLienTiep = {};   // Flow 1 vừa nghỉ ở mục 9 — cho chạy lại
      LENH.them({ duAn: d10id, loai: 'anh', nen: 'flow', tyLe: '9:16', prompts: ['tải kẹt'], chay: true });
      const v10 = viec().filter((j) => j.duAn === d10id);
      await cho(xongHet(v10), 120000, 'việc tải kẹt chạy xong ở tài khoản khác');
      inViec(v10);
      dongNhatKy(nk);
      kiem(v10.every((j) => j.trangThai === 'xong' && j.taiKhoan === tk2.id && (j.tkLoi || []).includes('flow-1')), 'tải kẹt ở "Flow 1" → xong ở "Flow 2"');
      kiem(LENH.trangThai().nhatKy.slice(nk).some((d) => /chưa tải về được/.test(d.chu)), 'nhật ký nói rõ tải về bị kẹt');
      kiem(Date.now() - bd10 < 90000, `không chờ tải kẹt quá lâu (${Math.round((Date.now() - bd10) / 1000)} giây)`);
      await session.fromPartition('persist:flow-flow-1').cookies.remove(process.env.MUSE_URL, 'flow_khong_tai');

      // 11) 1.2.1 (ảnh chụp + nhật ký 16/10/2026): Muse trả "Mình không thể tạo video từ ảnh này." → CHỈ ảnh đó sang
      //     Flow tạo video, ảnh khác vẫn ở Muse. Flow mới: engine không thấy ô tải ảnh lên → app tự bấm [+] "Add media"
      //     → "Upload image", đưa file thật vào hộp chọn file.
      ghi('-- 11. Muse từ chối tạo video từ ảnh → ảnh đó sang Flow (Flow mới: bấm nút tải ảnh lên)');
      await session.fromPartition('persist:flow-flow-1').cookies.set({ url: process.env.MUSE_URL, name: 'flow_upload_moi', value: '1' });
      dieuPhoi.nghiDen = {}; dieuPhoi.loiLienTiep = {};
      const anh11 = [path.join(tam, 'nguon-tu-choi.png'), path.join(tam, 'nguon-thuong.png')];
      for (const f of anh11) fs.writeFileSync(f, PNG1);
      const d11id = LENH.taoDuAn({ ten: 'Tu choi', taiKhoan: ['tk-1', 'flow-1'] }).id;
      nk = LENH.trangThai().nhatKy.length;
      const g11dau = (await flowGhi()).length;
      LENH.them({ duAn: d11id, loai: 'video', nen: 'muse', tyLe: '9:16', prompts: ['TU_CHOI sóng biển', 'mây trôi'],
        thamChieuTheoDong: anh11.map((f) => [f]), chay: true });
      const v11 = viec().filter((j) => j.duAn === d11id);
      await cho(xongHet(v11), 180000, 'video từ chối ở Muse xong ở Flow');
      inViec(v11);
      dongNhatKy(nk);
      const g11 = (await flowGhi()).slice(g11dau);
      const nk11 = LENH.trangThai().nhatKy.slice(nk).map((d) => d.chu);
      const [tc, th] = v11;
      kiem(tc && tc.trangThai === 'xong' && tc.nen === 'flow' && tc.taiKhoan === 'flow-1' && /\.mp4$/.test(tc.files[0] || '') && fs.existsSync(tc.files[0]),
        'video Muse từ chối được tạo xong ở FLOW, có file .mp4');
      kiem(th && th.trangThai === 'xong' && th.nen === 'muse' && th.taiKhoan === 'tk-1', 'video còn lại vẫn tạo ở Muse');
      kiem((await daGui()).filter((g) => /TU_CHOI/.test(g.prompt)).length === 1, 'không gửi lại Muse ảnh đã bị từ chối');
      kiem(nk11.some((c) => /🔀 Muse → Flow: #\d+ Muse từ chối tạo video: "Mình không thể tạo video từ ảnh này\."/.test(c)), 'nhật ký nói rõ vì sao chuyển sang Flow');
      const len11 = g11.filter((x) => x.loai === 'tai-len-trang');
      const ma11 = len11[0] && len11[0].d.files[0] ? len11[0].d.files[0].ten.replace(/\.[^.]+$/, '') : '?';
      kiem(g11.some((x) => x.loai === 'upload-hong'), 'engine báo không thấy ô tải ảnh lên (như Flow mới)');
      kiem(len11.length === 1 && len11[0].d.files.length === 1 && len11[0].d.files[0].co === PNG1.length && /^Nguon_tu_choi_[0-9a-f]{6}$/.test(ma11),
        `app bấm "Add media" → "Upload image", trang Flow nhận đúng 1 ảnh thật (${JSON.stringify(len11.map((x) => x.d.files))})`);
      kiem(nk11.some((c) => /Đã đưa 1 ảnh lên Flow \(bấm Add media → Upload image\)/.test(c)), 'nhật ký ghi cách đã tải ảnh lên');
      const st11 = g11.filter((x) => x.loai === 'start');
      kiem(st11.length === 1 && st11[0].d.prompts[0] === `TU_CHOI sóng biển @${ma11}`, `prompt video gửi Flow kèm @tên ảnh vừa tải lên ("${st11[0] ? st11[0].d.prompts[0] : ''}")`);
      await session.fromPartition('persist:flow-flow-1').cookies.remove(process.env.MUSE_URL, 'flow_upload_moi');
    } catch (err) {
      ghi('LỖI KỊCH BẢN: ' + err.stack);
      loi.push('ngoại lệ');
    }
    ghi(loi.length ? `KẾT QUẢ: ${loi.length} lỗi` : 'KẾT QUẢ: tất cả đạt');
    app.exit(loi.length ? 1 : 0);
  });
};
