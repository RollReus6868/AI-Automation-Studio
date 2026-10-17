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
// 1.1.0: thêm Suno (mục Tạo nhạc) — phiên 'persist:suno-<id>'.
const NEN = ['muse', 'flow', 'suno'];
const TEN_NEN = { muse: 'Muse', flow: 'Flow', suno: 'Suno' };
const TEN_DAY_DU = { muse: 'Muse', flow: 'Google Flow', suno: 'Suno' };
const chuanNen = (n) => (NEN.includes(n) ? n : 'muse');

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
    for (const a of this.ds) a.nen = chuanNen(a.nen);   // dữ liệu của Muse Automation Studio cũ: không có nen = Muse
    // 1.1.0: máy chưa có tài khoản Suno nào thì tạo sẵn "Suno 1" (người dùng tự đăng nhập trong app).
    if (!this.ds.some((a) => a.nen === 'suno') && !this.tim('suno-1')) {
      this.ds.push({ id: 'suno-1', ten: 'Suno 1', nen: 'suno', partition: 'persist:suno-suno-1', bat: true, trangThai: 'chua-kiem' });
    }
    this.luu();
  }

  luu() { this.store.set({ [KHOA]: this.ds }); }
  list() { return this.ds.map((a) => ({ ...a })); }
  tim(id) { return this.ds.find((a) => a.id === id) || null; }
  dangBat() { return this.ds.filter((a) => a.bat); }

  them(ten, nen) {
    nen = chuanNen(nen);
    const tenMd = `${TEN_NEN[nen]} ${this.ds.filter((a) => a.nen === nen).length + 1}`;
    const goc = slugId(ten || tenMd);
    let id = goc, n = 2;
    while (this.tim(id)) id = `${goc}-${n++}`;
    const a = { id, ten: String(ten || '').trim() || tenMd, nen,
      partition: `persist:${nen}-${id}`, bat: true, trangThai: 'chua-kiem' };
    if (nen === 'flow') a.flowUrl = '';
    this.ds.push(a);
    this.luu();
    this.log('success', `👤 Đã thêm tài khoản ${TEN_DAY_DU[nen]} "${a.ten}"`);
    return a;
  }

  sua(id, thay) {
    const a = this.tim(id);
    if (!a) return false;
    if (typeof thay.ten === 'string' && thay.ten.trim()) a.ten = thay.ten.trim();
    if (typeof thay.bat === 'boolean') a.bat = thay.bat;
    if (typeof thay.trangThai === 'string') a.trangThai = thay.trangThai;
    if (thay.hanMuc && Array.isArray(thay.hanMuc.muc)) a.hanMuc = thay.hanMuc;   // mức token đọc từ Muse
    // Suno hết lượt tạo / tải về: nghỉ tới lúc này (0 = bỏ).
    if (typeof thay.hetLuotDen === 'number') { a.hetLuotDen = thay.hetLuotDen; a.lyDoHetLuot = thay.hetLuotDen ? String(thay.lyDoHetLuot || '') : ''; }
    // Muse chặn tạo VIDEO theo khu vực (1.2.9): nhớ qua các lần chạy / mở app — tài khoản vẫn tạo ảnh (0 = bỏ).
    if (typeof thay.chanVideoDen === 'number') { a.chanVideoDen = thay.chanVideoDen; a.lyDoChanVideo = thay.chanVideoDen ? String(thay.lyDoChanVideo || '') : ''; }
    // Trang dự án Flow: chỉ nhận địa chỉ dự án Flow (flow.google.com hoặc labs.google; rỗng = app tự mở dự án mới).
    if (typeof thay.flowUrl === 'string' && a.nen === 'flow') {
      const u = thay.flowUrl.trim();
      if (!u || laUrlDuAnFlow(u) || /^file:/.test(u)) a.flowUrl = u;
    }
    this.luu();
    return true;
  }

  xoa(id) {
    if (this.ds.length <= 1) return { ok: false, loi: 'Phải giữ lại ít nhất một tài khoản' };
    const i = this.ds.findIndex((a) => a.id === id);
    if (i < 0) return { ok: false, loi: 'Không tìm thấy tài khoản' };
    const [a] = this.ds.splice(i, 1);
    this.luu();
    this.log('warning', `🗑 Đã xoá tài khoản "${a.ten}"`);
    return { ok: true, taiKhoan: a };
  }
}

module.exports = { QuanLyTaiKhoan, slugId, NEN, chuanNen };
