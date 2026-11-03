'use strict';
// ============================================================================
//  luong.js — MỘT LUỒNG = một trang muse.ai chạy ngầm của một tài khoản.
//  Mỗi việc: mở chat phụ MỚI (/thread/new) → đính kèm ảnh → dán prompt → gửi
//  → chờ Muse trả ảnh/video → lấy file gốc. Chat mới cho mỗi việc nên không
//  bao giờ dính ngữ cảnh hay ảnh của prompt trước.
//
//  Việc đã có `thread` (dừng giữa chừng, tắt app) → mở lại đúng chat đó và chỉ
//  CHỜ LẤY KẾT QUẢ, không gửi lại prompt.
// ============================================================================

const hd = require('./hang-doi');

// 1.4.9: hạn cho từng thao tác với trang Muse (biến môi trường chỉ để bài kiểm rút ngắn).
const HAN_GOI_MS = Number(process.env.MUSE_HAN_GOI_MS) || 60000;           // một lần hỏi trang (trạng thái, kết quả…)
const HAN_GUI_MS = Number(process.env.MUSE_HAN_GUI_MS) || 180000;          // gửi prompt (đính kèm ảnh ≤30 s, nút Gửi ≤60 s…)
const HAN_LAY_FILE_MS = Number(process.env.MUSE_HAN_LAY_FILE_MS) || 240000; // lấy file gốc (video vài chục MB)
const HAN_MO_TRANG_MS = Number(process.env.MUSE_HAN_MO_TRANG_MS) || 45000;

/** Promise có hạn: quá `ms` thì trả lỗi (promise gốc vẫn chạy nốt, kết quả về sau bị bỏ). */
function hanChot(p, ms, ten) {
  let h;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(h)),
    new Promise((_, loi) => { h = setTimeout(() => loi(new Error(`${ten} không trả lời quá ${Math.round(ms / 1000)} giây`)), ms); })
  ]);
}

class Luong {
  /**
   * @param o.id, o.taiKhoan  ({id, ten, partition})
   * @param o.wc            webContents của trang chạy ngầm
   * @param o.nguon         mã trình trợ giúp src/inject/muse-trang.js
   * @param o.goc           địa chỉ gốc, mặc định https://muse.ai
   * @param o.log(muc, chu)
   */
  constructor(o) {
    Object.assign(this, { id: o.id, taiKhoan: o.taiKhoan, wc: o.wc, nguon: o.nguon,
      goc: (o.goc || 'https://muse.ai').replace(/\/$/, ''), log: o.log || (() => {}) });
    this.viec = null;
    this.huy = 0;
    // Muse kẹt "Connecting..." quá lâu chừng này → coi là mất kết nối (vừa mở trang Muse cũng hiện thoáng qua).
    this.choKetNoiMs = Number(process.env.MUSE_CHO_KET_NOI_MS) || 60000;
  }

  get ranh() { return !this.viec; }

  dung() { this.huy++; }

  async ngu(ms, huyLuc) {
    const het = Date.now() + ms;
    while (Date.now() < het) {
      if (this.huy !== huyLuc) return false;
      await new Promise((r) => setTimeout(r, Math.min(250, het - Date.now())));
    }
    return this.huy === huyLuc;
  }

  async moTrang(url) {
    // 1.4.9: loadURL chỉ xong khi trang nạp HẾT — một tài nguyên của Muse treo là đứng mãi ở đây (việc kẹt "99%").
    try { await hanChot(this.wc.loadURL(url), HAN_MO_TRANG_MS, 'mở trang Muse'); } catch (_) { /* SPA tự chuyển hướng → ERR_ABORTED / quá hạn: chờ ô nhập bên dưới */ }
  }

  /**
   * Chạy mã trong trang. 1.4.9: có HẠN — trang ngầm sập (hết RAM) / đứng thì executeJavaScript không bao giờ trả lời,
   * việc đứng mãi ở "99%", nút Dừng cũng không ăn (nhật ký người dùng 11/2026). Quá hạn → ném lỗi như trang hỏng.
   */
  async goi(bieuThuc, hanMs = HAN_GOI_MS) {
    const co = await hanChot(this.wc.executeJavaScript('!!(window.__muse && window.__muse.phienBan === 1)', true), HAN_GOI_MS, 'trang Muse').catch(() => false);
    if (!co) await hanChot(this.wc.executeJavaScript(this.nguon, true), HAN_GOI_MS, 'trang Muse');
    return await hanChot(this.wc.executeJavaScript(bieuThuc, true), hanMs, 'trang Muse');
  }

  /**
   * Chạy một việc.
   * @param job
   * @param ctx { tinNhan, files:[{ten,mime,b64}], png, choToiDaGiay, choChuGiay,
   *              choGui():Promise (giãn nhịp theo tài khoản), capNhat(thay) }
   * @returns {ok, files} | {ok:false, loi, canDangNhap?, dung?, matKetNoi?, giuThread?}
   */
  async chay(job, ctx) {
    this.viec = job;
    const huyLuc = this.huy;
    try {
      return await this._chay(job, ctx, huyLuc);
    } catch (err) {
      return { ok: false, loi: `Lỗi luồng: ${err.message}`, giuThread: true };
    } finally {
      this.viec = null;
      // 1.3.4: cửa sổ luồng ẩn KHÔNG bị hãm (backgroundThrottling:false) → video kết quả Muse cứ phát lặp trong lúc
      // luồng chờ việc kế tiếp, tốn CPU / RAM vô ích. Lấy file xong thì dừng mọi video / âm thanh trên trang.
      try {
        if (!this.wc.isDestroyed()) this.wc.executeJavaScript("document.querySelectorAll('video, audio').forEach((m) => { try { m.pause(); } catch (e) {} }); 0", true).catch(() => {});
      } catch (_) {}
    }
  }

  async _chay(job, ctx, huyLuc) {
    const tiepTuc = !!job.thread;
    ctx.capNhat({ buoc: tiepTuc ? 'mo-lai' : 'mo-trang' });
    await this.moTrang(tiepTuc ? job.thread : `${this.goc}/thread/new`);

    // Chờ trang sẵn sàng: có ô nhập (đã đăng nhập) hoặc thấy màn đăng nhập.
    // 1.4.9: chờ theo GIỜ (30 s như cũ 120 × 250 ms), không theo số lần — mỗi lần hỏi có thể chờ tới hạn của nó.
    let tt = null;
    for (const hetSan = Date.now() + 30000; ;) {
      tt = await this.goi('window.__muse.trangThai()', 15000).catch(() => null);
      if (Date.now() >= hetSan && !(tt && (tt.coONhap || tt.canDangNhap))) break;
      if (tt && (tt.coONhap || tt.canDangNhap)) break;
      if (!(await this.ngu(250, huyLuc))) return { ok: false, dung: true, giuThread: true };
    }
    if (tt && tt.canDangNhap) return { ok: false, canDangNhap: true, loi: 'Tài khoản chưa đăng nhập Muse' };
    if (!tt || !tt.coONhap) return { ok: false, loi: 'Không mở được trang Muse (không thấy ô nhập)', giuThread: true };

    // Muse mất kết nối tới máy ảo của tài khoản ("Connecting...") → chat/ảnh/video không nạp: đừng gửi
    // (mất dấu chat, phí lượt) và đừng chờ suông 600 giây.
    for (const het = Date.now() + this.choKetNoiMs; tt && tt.matKetNoi && Date.now() < het;) {
      if (!(await this.ngu(1000, huyLuc))) return { ok: false, dung: true, giuThread: true };
      tt = await this.goi('window.__muse.trangThai()').catch(() => tt);
    }
    if (tt && tt.matKetNoi) return { ok: false, matKetNoi: true, loi: `Muse mất kết nối ("${tt.trangThaiMuse}")`, giuThread: true };

    if (!tiepTuc) {
      await ctx.choGui();
      if (this.huy !== huyLuc) return { ok: false, dung: true };
      ctx.capNhat({ buoc: 'gui' });
      const r = await this.goi(`window.__muse.gui(${JSON.stringify({ text: ctx.tinNhan, files: ctx.files || [] })})`, HAN_GUI_MS);
      if (!r || !r.ok) {
        if (r && r.loi === 'can-dang-nhap') return { ok: false, canDangNhap: true, loi: 'Tài khoản chưa đăng nhập Muse' };
        const GIAI_THICH = {
          'o-soan-tin-chua-nap': 'ô soạn tin của Muse không nạp xong sau 30 giây',
          'nut-gui-bi-tat': 'nút Gửi của Muse không bật được sau 60 giây',
          'gui-khong-an': 'bấm Gửi nhưng Muse không nhận',
          'khong-dinh-kem-duoc': 'không đính kèm được ảnh',
          'khong-dan-duoc-prompt': 'không dán được prompt vào ô soạn tin',
          'khong-thay-o-nhap': 'không thấy ô soạn tin'
        };
        const ma = r ? r.loi : '?';
        return { ok: false, loi: `Gửi prompt hỏng: ${GIAI_THICH[ma] || ma}${r && r.chu ? ` (${r.chu})` : ''}` };
      }
      ctx.capNhat({ thread: r.thread, buoc: 'tao' });
      this.log('info', `[${this.id}] #${job.so} đã gửi → ${r.thread}`);
    } else {
      ctx.capNhat({ buoc: 'tao' });
    }

    const het = Date.now() + ctx.choToiDaGiay * 1000;
    let coChuLuc = 0;
    let lanLoiTrang = 0;
    let lanLayHong = 0;
    let matTu = 0;
    while (Date.now() < het) {
      if (!(await this.ngu(3000, huyLuc))) return { ok: false, dung: true, giuThread: true };
      let kq;
      try {
        kq = await this.goi('window.__muse.ketQua()');
        lanLoiTrang = 0;
      } catch (err) {
        // Trang sập / đang nạp lại: mở lại chat rồi chờ tiếp, tối đa 3 lần liền.
        if (++lanLoiTrang > 3) return { ok: false, loi: `Trang Muse hỏng: ${err.message}`, giuThread: true };
        if (job.thread) await this.moTrang(job.thread);
        continue;
      }
      if (kq.canDangNhap) return { ok: false, canDangNhap: true, loi: 'Muse đòi đăng nhập lại', giuThread: true };
      matTu = kq.matKetNoi ? matTu || Date.now() : 0;
      if (matTu && Date.now() - matTu > this.choKetNoiMs) {
        return { ok: false, matKetNoi: true, loi: `Muse mất kết nối ("${kq.trangThaiMuse}") — chưa tải được kết quả`, giuThread: true };
      }

      if (hd.daXong(job.loai, kq)) {
        ctx.capNhat({ buoc: 'tai' });
        // Chờ chút cho các khung khác (nếu Muse trả nhiều) nạp xong.
        await this.ngu(1500, huyLuc);
        // 1.4.9: lấy file có hạn — tải video gốc từ máy chủ Muse đứng giữa chừng là việc kẹt mãi ở bước "Đang tải".
        let files = null, loiLay = '';
        try {
          files = await this.goi(`window.__muse.layFile(${JSON.stringify({ png: !!ctx.png, hanMs: HAN_LAY_FILE_MS - 15000 })})`, HAN_LAY_FILE_MS);
        } catch (err) { loiLay = err.message; }
        const dung = (files || []).filter((f) => f.loai === (job.loai === 'video' ? 'video' : 'anh'));
        if (dung.length) return { ok: true, files: dung, chu: kq.chu };
        // Khung có mà chưa lấy được file → thử lại vòng sau, nhưng không mãi (quá hạn lấy file: thử thêm 1 lần).
        if (loiLay) this.log('warning', `[${this.id}] #${job.so} lấy file chưa được: ${loiLay}`);
        if (++lanLayHong >= (loiLay ? 2 : 5) || (loiLay && Date.now() >= het)) {
          return { ok: false, loi: `Muse đã trả kết quả nhưng không lấy được file${loiLay ? ` (${loiLay})` : ' (5 lần)'}`, giuThread: !loiLay };
        }
        continue;
      }

      if (kq.chu && !coChuLuc) coChuLuc = Date.now();
      // Muse nói tài khoản bị chặn khu vực / 403 → báo ngay, khỏi chờ đủ thời gian "trả chữ".
      if (kq.chu && !kq.dangGo && !kq.soKhungAnh && !kq.soKhungVideo && hd.laChanKhuVuc(kq.chu)) {
        return { ok: false, chanLoai: true, loi: `Muse báo tài khoản bị chặn tạo ${job.loai === 'video' ? 'video' : 'ảnh'}: "${kq.chu.slice(0, 200)}"` };
      }
      const giay = coChuLuc ? (Date.now() - coChuLuc) / 1000 : 0;
      // Muse từ chối tạo từ ảnh / prompt này → báo ngay (chờ vài giây cho chắc không có khung nào nạp):
      // điều phối chuyển riêng việc này sang Flow.
      if (kq.chu && !kq.dangGo && !kq.soKhungAnh && !kq.soKhungVideo && giay >= 5 && hd.laTuChoi(kq.chu)) {
        return { ok: false, tuChoi: true, loi: `Muse từ chối tạo ${job.loai === 'video' ? 'video' : 'ảnh'}: "${kq.chu.slice(0, 200)}"` };
      }
      if (hd.laTraLoiChu(kq, giay, ctx.choChuGiay)) {
        return { ok: false, loi: `Muse trả lời chữ, không có ${job.loai === 'video' ? 'video' : 'ảnh'}: "${kq.chu.slice(0, 200)}"` };
      }
    }
    return { ok: false, loi: `Quá ${ctx.choToiDaGiay} giây chưa thấy kết quả`, giuThread: true };
  }
}

module.exports = { Luong };
