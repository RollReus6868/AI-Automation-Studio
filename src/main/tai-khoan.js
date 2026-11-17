'use strict';
const { laUrlDuAnFlow } = require('../flow/tab-flow');
// ============================================================================
//  tai-khoan.js — NHIỀU TÀI KHOẢN MUSE / GOOGLE FLOW, MỖI TÀI KHOẢN MỘT PHIÊN
//  Mỗi tài khoản là một session partition riêng — 'persist:muse-<id>' cho Muse,
//  'persist:flow-<id>' cho Google Flow — cookie và storage tách hẳn nhau, nên
//  nhiều tài khoản chạy cùng lúc không đá nhau ra. Người dùng tự đăng nhập
//  trong cửa sổ của app; app KHÔNG bao giờ nhận hay lưu mật khẩu.
//  Tài khoản Flow nhớ thêm `flowUrl` — trang dự án Flow mà luồng mở ra chạy.
// ============================================================================

const KHOA = 'taiKhoan';
// 1.4.0: thêm Drive — tài khoản Google chỉ dùng để tải kết quả lên drive.google.com (không nhận việc tạo).
// 1.5.0: bỏ Suno; mục Tạo nhạc chạy trên Google Flow Music (flowmusic.app). Tài khoản Flow Music KHÔNG tự thêm:
// mỗi tài khoản Google Flow có sẵn một tài khoản Flow Music đi kèm (id 'nhac-<id Flow>', dùng CHUNG phiên
// đăng nhập 'persist:flow-<id>' — đăng nhập Google một lần là chạy được cả hai). Tên theo tài khoản Flow;
// xoá tài khoản Flow là mất tài khoản Flow Music đi kèm. Trạng thái chạy (nghỉ, hết lượt…) tách riêng.
const NEN = ['muse', 'flow', 'fmusic', 'drive'];
const TEN_NEN = { muse: 'Muse', flow: 'Flow', fmusic: 'Flow Music', drive: 'Drive' };
const TEN_DAY_DU = { muse: 'Muse', flow: 'Google Flow', fmusic: 'Flow Music', drive: 'Google Drive' };
const chuanNen = (n) => (NEN.includes(n) ? n : 'muse');
const idNhac = (flowId) => `nhac-${flowId}`;

function slugId(raw) {
  return String(raw || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'tk';
}

class QuanLyTaiKhoan {
  constructor(store, log) {
    this.store = store;
    this.log = log || (() => {});
    const luu = store.get(KHOA)[KHOA];
    this.ds = Array.isArray(luu) && luu.length ? luu : [
      { id: 'tk-1', ten: 'Muse 1', nen: 'muse', partition: 'persist:muse-tk-1', bat: true, trangThai: 'chua-kiem' },
      { id: 'flow-1', ten: 'Flow 1', nen: 'flow', partition: 'persist:flow-flow-1', bat: true, trangThai: 'chua-kiem', flowUrl: '' }
    ];
    // 1.5.0: bỏ tài khoản Suno của bản cũ (phiên cũ của chúng được "Dọn dữ liệu thừa" dọn).
    const soSuno = this.ds.filter((a) => a.nen === 'suno').length;
    this.ds = this.ds.filter((a) => a.nen !== 'suno');
    for (const a of this.ds) a.nen = chuanNen(a.nen);   // dữ liệu của Muse Automation Studio cũ: không có nen = Muse
    this.dongBoNhac();
    if (soSuno) this.log('info', `👤 Bản 1.5.0 bỏ Suno: đã gỡ ${soSuno} tài khoản Suno — nhạc giờ tạo trên Flow Music bằng tài khoản Google Flow`);
    this.luu();
  }

  /**
   * 1.5.0: mỗi tài khoản Flow có đúng một tài khoản Flow Music đi kèm (cùng phiên, cùng tên, đứng ngay sau nó);
   * tài khoản Flow Music mồ côi (tài khoản Flow đã xoá) bị bỏ. Trả true nếu có đổi.
   */
  dongBoNhac() {
    const truoc = JSON.stringify(this.ds.map((a) => [a.id, a.ten]));
    const cu = new Map(this.ds.filter((a) => a.nen === 'fmusic').map((a) => [a.flowTk, a]));
    const ra = [];
    for (const a of this.ds) {
      if (a.nen === 'fmusic') continue;
      ra.push(a);
      if (a.nen !== 'flow') continue;
      const m = cu.get(a.id) || { id: idNhac(a.id), nen: 'fmusic', bat: true, trangThai: 'chua-kiem' };
      Object.assign(m, { ten: a.ten, flowTk: a.id, partition: a.partition });
      ra.push(m);
    }
    this.ds = ra;
    return JSON.stringify(this.ds.map((a) => [a.id, a.ten])) !== truoc;
  }

  luu() { this.store.set({ [KHOA]: this.ds }); }
  list() { return this.ds.map((a) => ({ ...a })); }
  tim(id) { return this.ds.find((a) => a.id === id) || null; }
  dangBat() { return this.ds.filter((a) => a.bat); }

  them(ten, nen) {
    nen = chuanNen(nen);
    if (nen === 'fmusic') nen = 'flow';   // Flow Music đi kèm tài khoản Flow — thêm tài khoản Flow là có

    const tenMd = `${TEN_NEN[nen]} ${this.ds.filter((a) => a.nen === nen).length + 1}`;
    const goc = slugId(ten || tenMd);
    let id = goc, n = 2;
    while (this.tim(id)) id = `${goc}-${n++}`;
    const a = { id, ten: String(ten || '').trim() || tenMd, nen,
      partition: `persist:${nen}-${id}`, bat: true, trangThai: 'chua-kiem' };
    if (nen === 'flow') a.flowUrl = '';
    this.ds.push(a);
    this.dongBoNhac();
    this.luu();
    this.log('success', `👤 Đã thêm tài khoản ${TEN_DAY_DU[nen]} "${a.ten}"${nen === 'flow' ? ' (kèm tài khoản Flow Music dùng chung đăng nhập)' : ''}`);
    return a;
  }

  sua(id, thay) {
    const a = this.tim(id);
    if (!a) return false;
    if (typeof thay.ten === 'string' && thay.ten.trim()) {
      // Tên tài khoản Flow Music = tên tài khoản Flow đi kèm (đổi một bên là đổi cả hai).
      const goc = a.nen === 'fmusic' ? this.tim(a.flowTk) : a;
      if (goc) goc.ten = thay.ten.trim();
      this.dongBoNhac();
    }
    if (typeof thay.bat === 'boolean') a.bat = thay.bat;
    if (typeof thay.trangThai === 'string') a.trangThai = thay.trangThai;
    if (thay.hanMuc && Array.isArray(thay.hanMuc.muc)) a.hanMuc = thay.hanMuc;   // mức token đọc từ Muse
    // Flow Music hết credit / chạm giới hạn: nghỉ tới lúc này (0 = bỏ).
    if (typeof thay.hetLuotDen === 'number') { a.hetLuotDen = thay.hetLuotDen; a.lyDoHetLuot = thay.hetLuotDen ? String(thay.lyDoHetLuot || '') : ''; }
    // Muse chặn tạo VIDEO theo khu vực (1.2.9): nhớ qua các lần chạy / mở app — tài khoản vẫn tạo ảnh (0 = bỏ).
    if (typeof thay.chanVideoDen === 'number') {
      a.chanVideoDen = thay.chanVideoDen;
      a.lyDoChanVideo = thay.chanVideoDen ? String(thay.lyDoChanVideo || '') : '';
      a.chanVideoHetLuot = !!(thay.chanVideoDen && thay.chanVideoHetLuot);   // 1.5.1: hết lượt video, không phải chặn khu vực
    }
    // 1.4.7: các lần Flow báo "hoạt động bất thường" [{luc, anh}] — để nhận ra tài khoản bị Google đánh dấu ([] = bỏ).
    if (Array.isArray(thay.batThuong)) {
      a.batThuong = thay.batThuong.filter((x) => x && Number.isFinite(Number(x.luc)))
        .map((x) => ({ luc: Number(x.luc), anh: Number.isFinite(Number(x.anh)) && x.anh !== null ? Number(x.anh) : null })).slice(-50);
      if (!a.batThuong.length) delete a.batThuong;
    }
    // Trang dự án Flow: chỉ nhận địa chỉ dự án Flow (flow.google.com hoặc labs.google; rỗng = app tự mở dự án mới).
    if (typeof thay.flowUrl === 'string' && a.nen === 'flow') {
      const u = thay.flowUrl.trim();
      if (!u || laUrlDuAnFlow(u) || /^file:/.test(u)) a.flowUrl = u;
    }
    this.luu();
    return true;
  }

  xoa(id) {
    const x = this.tim(id);
    if (x && x.nen === 'fmusic') return { ok: false, loi: 'Tài khoản Flow Music đi kèm tài khoản Google Flow cùng tên — muốn bỏ thì xoá tài khoản Flow đó (hoặc chọn "Không dùng" trong dự án)' };
    if (this.ds.filter((a) => a.nen !== 'fmusic').length <= 1) return { ok: false, loi: 'Phải giữ lại ít nhất một tài khoản' };
    const i = this.ds.findIndex((a) => a.id === id);
    if (i < 0) return { ok: false, loi: 'Không tìm thấy tài khoản' };
    const [a] = this.ds.splice(i, 1);
    this.dongBoNhac();
    this.luu();
    this.log('warning', `🗑 Đã xoá tài khoản "${a.ten}"`);
    return { ok: true, taiKhoan: a };
  }
}

module.exports = { QuanLyTaiKhoan, slugId, NEN, chuanNen, idNhac };
