'use strict';
// ============================================================================
//  luong-nhac.js — MỘT LUỒNG FLOW MUSIC = một trang flowmusic.app chạy ngầm (cửa sổ ẩn, tắt tiếng)
//  của một tài khoản Google (dùng chung phiên đăng nhập với tài khoản Google Flow cùng tên).
//  Mỗi việc: mở trang chủ (= phiên chat mới) → dán prompt NGUYÊN VĂN → Gửi → chờ Producer tạo xong
//  (thường 2 bài A/B) → trong 2 bài đầu lấy bài DÀI HƠN → tải MP3 bằng menu của chính trang
//  (More options → Download → MP3).
//  Producer chỉ trả lời bằng chữ (hỏi lại) → nhắn thêm MỘT lần "tạo bài luôn" trong cùng phiên.
//  Trang báo hết credit / chạm giới hạn → trả {hetLuot}: điều phối cho tài khoản nghỉ, bài sang
//  tài khoản dự phòng. Tải hỏng → mở lại đúng phiên đó, tải lại bài đó (không gửi lại prompt).
// ============================================================================

const CHO_TRANG_MS = 30000;        // chờ trang có ô chat (hoặc báo cần đăng nhập)
const CHO_PHIEN_MS = 45000;        // bấm Gửi mà chừng này chưa sang /session/<id> → lỗi
const LANG_IM_MS = 15000;          // gửi xong chừng này mà trang đứng yên, không bài, không đang làm → Producer chỉ trả lời chữ
const CHO_TAI_MS = 120000;         // bấm MP3 → trang tải file về (blob) — thường vài giây
const SO_LAN_TAI = 3;
const NHAC_LAI = 'Please create the song now from my description above, without asking any more questions.';

function mmss(giay) { const g = Math.round(giay || 0); return `${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`; }

/** Trong các bài (theo thứ tự trên trang), xét 2 bài đầu, lấy bài dài hơn (bằng nhau / không đọc được → bài trên). */
function chonBaiDaiHon(ds) {
  const dau = ds.slice(0, 2);
  return dau.reduce((tot, c) => (!tot || (c.giay || 0) > (tot.giay || 0) ? c : tot), null);
}

class LuongNhac {
  /**
   * @param o.id, o.taiKhoan, o.wc (webContents cửa sổ ẩn), o.nguon (src/inject/nhac-trang.js), o.url (trang chủ flowmusic.app)
   * @param o.choTaiVe(ms) → {hua: Promise<{ok, duongDan, mime}|{ok:false, hetGio}>, huy(), daBatDau()}
   * @param o.log(muc, chu)
   */
  constructor(o) {
    Object.assign(this, { id: o.id, taiKhoan: o.taiKhoan, wc: o.wc, nguon: o.nguon, url: o.url,
      choTaiVe: o.choTaiVe, log: o.log || (() => {}) });
    this.nen = 'fmusic';
    this.viec = null;
    this.huy = 0;
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

  /** loadURL có hạn (trang không trả lời thì thôi chờ, vòng sau tự hỏi lại). */
  async moTrang(url) {
    await Promise.race([this.wc.loadURL(url).catch(() => {}), new Promise((r) => setTimeout(r, 30000))]);
  }

  /** Gọi vào trang (tự tiêm nhac-trang.js), có hạn — trang sập / đứng thì báo lỗi, không chờ mãi. */
  async goi(bieuThuc, hanMs = 30000) {
    const lam = async () => {
      const co = await this.wc.executeJavaScript('!!(window.__fmusic && window.__fmusic.phienBan === 1)', true).catch(() => false);
      if (!co) await this.wc.executeJavaScript(this.nguon, true);
      return await this.wc.executeJavaScript(bieuThuc, true);
    };
    let hen;
    try {
      return await Promise.race([lam(), new Promise((_, tc) => { hen = setTimeout(() => tc(new Error('trang không trả lời')), hanMs); })]);
    } finally { clearTimeout(hen); }
  }

  /** Địa chỉ trang phiên <id> (cùng gốc với trang chủ đã cấu hình: https://www.flowmusic.app/session/<id>). */
  urlPhien(id) { try { return new URL(`session/${id}`, this.url).href; } catch (_) { return `https://www.flowmusic.app/session/${id}`; } }

  async chay(job, ctx) {
    this.viec = job;
    const huyLuc = this.huy;
    try {
      return await this._chay(job, ctx, huyLuc);
    } catch (err) {
      return { ok: false, loi: `Lỗi luồng Flow Music: ${err.message}` };
    } finally {
      this.viec = null;
    }
  }

  /** Chờ trang có ô chat hoặc báo cần đăng nhập. */
  async _choTrang(huyLuc) {
    let tt = null;
    for (const het = Date.now() + CHO_TRANG_MS; Date.now() < het;) {
      tt = await this.goi('window.__fmusic.trangThai()', 5000).catch(() => null);
      if (tt && (tt.coO || tt.canDangNhap)) return tt;
      if (!(await this.ngu(500, huyLuc))) return { dung: true };
    }
    return tt || {};
  }

  async _chay(job, ctx, huyLuc) {
    const tk = this.taiKhoan.id;
    let phien = job.nhacPhien && job.nhacPhien.tk === tk && job.nhacPhien.url ? job.nhacPhien : null;
    let chon = phien && phien.chon ? phien.chon : null;

    if (phien) {
      // Lần trước đã gửi prompt ở CHÍNH tài khoản này → mở lại đúng phiên đó, không gửi lại (gửi lại là tốn thêm credit).
      ctx.capNhat({ buoc: 'Mở lại phiên Flow Music cũ' });
      this.log('info', `[${this.id}] #${job.so}: mở lại phiên Flow Music đã gửi (${phien.url}) — không gửi lại prompt`);
      await this.moTrang(phien.url);
      const tt = await this._choTrang(huyLuc);
      if (tt.dung) return { ok: false, dung: true };
      if (tt.canDangNhap) return { ok: false, canDangNhap: true, loi: 'Tài khoản chưa đăng nhập Flow Music' };
    } else {
      ctx.capNhat({ buoc: 'Đang mở Flow Music' });
      await this.moTrang(this.url);
      const tt = await this._choTrang(huyLuc);
      if (tt.dung) return { ok: false, dung: true };
      if (tt.canDangNhap) return { ok: false, canDangNhap: true, loi: 'Tài khoản chưa đăng nhập Flow Music (đăng nhập Google ở tài khoản Flow cùng tên)' };
      if (!tt.coO) return { ok: false, loi: 'Không mở được Flow Music (không thấy ô chat)' };
      await ctx.choGui();
      if (this.huy !== huyLuc) return { ok: false, dung: true };
      ctx.capNhat({ buoc: 'Đang gửi prompt' });
      const g = await this.goi(`window.__fmusic.gui(${JSON.stringify(String(job.prompt))})`);
      if (!g || !g.ok) return { ok: false, loi: `Không gửi được prompt lên Flow Music (${g ? g.loi : '?'})` };
      // Chờ trang chuyển sang /session/<id> — nhớ phiên để tải hỏng thì mở lại đúng chỗ.
      let id = '';
      for (const het = Date.now() + CHO_PHIEN_MS; Date.now() < het && !id;) {
        if (!(await this.ngu(500, huyLuc))) return { ok: false, dung: true };
        const t = await this.goi('window.__fmusic.trangThai()', 5000).catch(() => null);
        id = t && t.phien;
      }
      if (!id) {
        const t = await this.goi(`window.__fmusic.tinhTrang(${JSON.stringify(String(job.prompt))})`, 5000).catch(() => null);
        const c = t ? await this.goi(`window.__fmusic.cauHetLuot(${JSON.stringify(`${t.thongBao} ${t.chuTrang}`)})`, 5000).catch(() => '') : '';
        if (c) return { ok: false, hetLuot: true, loi: `Flow Music hết lượt: "${c}"` };
        return { ok: false, loi: `Bấm Gửi nhưng Flow Music không mở phiên mới${t && t.thongBao ? ` ("${t.thongBao}")` : ''}` };
      }
      phien = { tk, url: this.urlPhien(id) };
      ctx.capNhat({ nhacPhien: phien });
      this.log('info', `[${this.id}] #${job.so} đã gửi → Flow Music đang tạo (phiên ${id.slice(0, 8)})`);
    }

    if (!chon) {
      ctx.capNhat({ buoc: 'Flow Music đang tạo nhạc' });
      const kq = await this._choBai(job, ctx, huyLuc, phien);
      if (!kq.ok) return kq;
      const bai = kq.the.slice(0, 2);
      const giay = await this.goi(`window.__fmusic.thoiLuong(${JSON.stringify(bai.map((b) => b.id))})`, 40000).catch(() => ({}));
      for (const b of bai) b.giay = Number(giay && giay[b.id]) || 0;
      chon = chonBaiDaiHon(bai);
      const kia = bai.find((b) => b !== chon);
      chon.ghiChu = kia ? (chon.giay && kia.giay ? `bài dài hơn: ${mmss(chon.giay)} (bài kia ${mmss(kia.giay)})` : 'không đọc được thời lượng — lấy bài đầu')
        : (chon.giay ? mmss(chon.giay) : '');
      ctx.capNhat({ nhacPhien: { ...phien, chon } });
      this.log('info', `[${this.id}] #${job.so}: Flow Music tạo xong ${kq.the.length} bài — chọn "${chon.ten}"${chon.ghiChu ? ` (${chon.ghiChu})` : ''}`);
    }
    await this.goi('window.__fmusic.dungPhat()', 5000).catch(() => {});

    // Tải MP3 bằng menu của trang; hỏng thì mở lại phiên và tải lại ĐÚNG bài đó.
    ctx.capNhat({ buoc: 'Đang tải về' });
    let kq = null;
    for (let lan = 1; lan <= SO_LAN_TAI; lan++) {
      kq = await this._taiBai(chon, huyLuc);
      if (kq.ok) return { ok: true, files: kq.files, ghiChu: chon.ghiChu || '', clip: chon.id };
      if (kq.dung) return kq;
      if (lan < SO_LAN_TAI) {
        this.log('warning', `⚠ [${this.id}] #${job.so}: ${kq.loi} — tải lại bài này (lần ${lan + 1}/${SO_LAN_TAI}), không gửi lại prompt`);
        await this.goi('window.__fmusic.dongMenu()', 5000).catch(() => {});
        await this.moTrang(phien.url);
        const tt = await this._choTrang(huyLuc);
        if (tt.dung) return { ok: false, dung: true };
        for (let i = 0; i < 20; i++) {
          const t = await this.goi('window.__fmusic.tinhTrang()', 5000).catch(() => null);
          if (t && t.the.some((b) => b.id === chon.id)) break;
          if (!(await this.ngu(500, huyLuc))) return { ok: false, dung: true };
        }
      }
    }
    return kq;
  }

  /** Chờ Producer tạo xong. {ok:true, the:[{id, ten}]} hoặc lỗi / hết lượt. */
  async _choBai(job, ctx, huyLuc, phien) {
    const batDau = Date.now();
    let imTu = 0, daNhac = false, lanCuoiPt = '';
    for (const het = Date.now() + ctx.choToiDaGiay * 1000; Date.now() < het;) {
      if (!(await this.ngu(3000, huyLuc))) return { ok: false, dung: true };
      const t = await this.goi(`window.__fmusic.tinhTrang(${JSON.stringify(String(job.prompt))})`, 10000).catch(() => null);
      if (!t) { await this.moTrang(phien.url); continue; }   // trang sập / đứng → mở lại đúng phiên
      if (t.the.length && !t.dangTao.length && !t.ban) return { ok: true, the: t.the };
      if (t.dangTao.length) {
        const pt = t.dangTao.map((x) => (x.pt === null ? '…' : `${x.pt}%`)).join(' · ');
        if (pt !== lanCuoiPt) { lanCuoiPt = pt; ctx.capNhat({ buoc: `Flow Music đang tạo ${pt}` }); }
      }
      const imLang = !t.the.length && !t.dangTao.length && !t.ban && !t.dangNghi;
      if (!imLang) { imTu = 0; continue; }
      if (!imTu) imTu = Date.now();
      if (Date.now() - batDau < LANG_IM_MS || Date.now() - imTu < 6000) continue;
      // Producer đứng yên mà không có bài: hết credit? hay chỉ trả lời bằng chữ (hỏi lại)?
      const c = await this.goi(`window.__fmusic.cauHetLuot(${JSON.stringify(`${t.thongBao} ${t.chuTrang}`)})`, 5000).catch(() => '');
      if (c) return { ok: false, hetLuot: true, loi: `Flow Music hết lượt: "${c}"` };
      if (!daNhac) {
        daNhac = true;
        this.log('warning', `[${this.id}] #${job.so}: Producer chỉ trả lời bằng chữ, chưa tạo bài — nhắn thêm "tạo bài luôn" (một lần)`);
        const g = await this.goi(`window.__fmusic.gui(${JSON.stringify(NHAC_LAI)})`).catch(() => null);
        if (!g || !g.ok) return { ok: false, loi: `Producer không tạo bài, nhắn thêm cũng không được (${g ? g.loi : '?'})` };
        imTu = 0;
        continue;
      }
      const duoi = String(t.chuTrang || '').replace(NHAC_LAI, '').trim().slice(-200);
      return { ok: false, loi: `Flow Music không tạo bài nào — Producer trả lời: "${duoi}"` };
    }
    return { ok: false, loi: `Quá ${ctx.choToiDaGiay} giây Flow Music chưa tạo xong bài` };
  }

  /** Một lần tải MP3 của bài `chon`: More options → Download → MP3; tiến trình chính bắt file. */
  async _taiBai(chon, huyLuc) {
    const cho = this.choTaiVe(CHO_TAI_MS);
    const tm = await this.goi(`window.__fmusic.taiMp3(${JSON.stringify(chon.id)})`, 30000).catch((err) => ({ ok: false, loi: err.message }));
    if (!tm || !tm.ok) {
      cho.huy();
      return { ok: false, loi: `Không bấm được Download → MP3 của Flow Music (${tm ? tm.loi : '?'}${tm && tm.menu ? ` · menu: ${tm.menu.join(' | ')}` : ''})` };
    }
    let f = null;
    cho.hua.then((x) => { f = x; });
    while (!f) {
      if (!(await this.ngu(500, huyLuc))) { cho.huy(); return { ok: false, dung: true }; }
    }
    await this.goi('window.__fmusic.dongMenu()', 5000).catch(() => {});
    if (!f.ok) {
      const t = await this.goi('window.__fmusic.tinhTrang()', 5000).catch(() => null);
      return { ok: false, loi: f.hetGio ? `Bấm MP3 nhưng Flow Music không gửi file nào${t && t.thongBao ? ` ("${t.thongBao}")` : ''}` : f.loi };
    }
    return { ok: true, files: [{ duongDan: f.duongDan, mime: f.mime }] };
  }
}

module.exports = { LuongNhac, chonBaiDaiHon };
