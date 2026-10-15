'use strict';
// ============================================================================
//  luong-suno.js — MỘT LUỒNG SUNO = một trang suno.com/create chạy ngầm (cửa sổ ẩn)
//  của một tài khoản. Mỗi việc: mở trang Create → tab Songs + Advanced → xoá form →
//  điền prompt vào ô Styles (lời để trống = nhạc không lời) → Create → chờ các bài
//  MỚI hiện ra → trong 2 bài mới đầu tiên, lấy bài DÀI HƠN → tải MP3 bằng menu
//  ⋯ → Download → hộp chọn MP3 → nút Download của chính Suno.
//
//  Tài khoản free: một lần Create ra 4 bài — 2 bài đủ dài (v6-mini) ở trên, 2 bản
//  nghe thử 1:00 ("Upgrade for full song") ở dưới — nên chỉ xét 2 bài đầu.
//  Suno báo hết lượt (hết credit tạo bài / hết lượt tải) → trả {hetLuot}: điều phối
//  cho tài khoản nghỉ và tạo lại bài ở tài khoản dự phòng.
//  Suno hỏi captcha → hiện cửa sổ luồng cho người dùng tự giải, chờ tối đa 5 phút
//  (app không giải hộ, không né).
// ============================================================================

const CHO_BAI_MOI_MS = 60000;     // bấm Create mà chừng này chưa thấy bài mới → đọc lý do Suno báo
const CHO_CAPTCHA_MS = 5 * 60000;
const CHO_TAI_MS = 60000;

function mmss(giay) { return `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, '0')}`; }

/** Trong các bài mới (theo thứ tự trên trang), xét 2 bài đầu, lấy bài dài hơn (bằng nhau → bài trên). */
function chonBaiDaiHon(moi) {
  const dau = moi.slice(0, 2);
  return dau.reduce((tot, c) => (!tot || c.giay > tot.giay ? c : tot), null);
}

class LuongSuno {
  /**
   * @param o.id, o.taiKhoan, o.wc (webContents cửa sổ ẩn), o.nguon (src/inject/suno-trang.js), o.url (trang Create)
   * @param o.choTaiVe(ms) → {hua: Promise<{ok, duongDan, mime}|{ok:false, hetGio}>, huy()}
   * @param o.hienCuaSo()  hiện cửa sổ luồng (captcha)      o.log(muc, chu)
   */
  constructor(o) {
    Object.assign(this, { id: o.id, taiKhoan: o.taiKhoan, wc: o.wc, nguon: o.nguon, url: o.url,
      choTaiVe: o.choTaiVe, hienCuaSo: o.hienCuaSo || (() => {}), log: o.log || (() => {}) });
    this.nen = 'suno';
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

  async moTrang(url) { try { await this.wc.loadURL(url); } catch (_) { /* SPA tự chuyển hướng → bỏ qua */ } }

  async goi(bieuThuc) {
    const co = await this.wc.executeJavaScript('!!(window.__suno && window.__suno.phienBan === 1)', true).catch(() => false);
    if (!co) await this.wc.executeJavaScript(this.nguon, true);
    return await this.wc.executeJavaScript(bieuThuc, true);
  }

  async chay(job, ctx) {
    this.viec = job;
    const huyLuc = this.huy;
    try {
      return await this._chay(job, ctx, huyLuc);
    } catch (err) {
      return { ok: false, loi: `Lỗi luồng Suno: ${err.message}` };
    } finally {
      this.viec = null;
    }
  }

  /** Câu Suno báo "hết lượt" trong chữ đang hiện ('' = không phải) (hết credit / giới hạn tải / mời nâng cấp) không — luật nằm ở suno-trang.js. */
  async _laHetLuot(chu) {
    if (!chu) return '';
    return String(await this.goi(`window.__suno.cauHetLuot(${JSON.stringify(String(chu))})`).catch(() => '') || '');
  }

  /**
   * Thông báo Suno MỚI hiện sau một cú bấm: bỏ các dòng đã có từ trước (băng rôn "Upgrade…" thường trực
   * không được coi là báo hết lượt).
   */
  async _thongBaoMoi(goc) {
    const cu = new Set(String(goc || '').split(' · '));
    const tb = await this.goi('window.__suno.thongBao()').catch(() => '');
    return String(tb || '').split(' · ').filter((x) => x && !cu.has(x)).join(' · ');
  }

  /** Suno hỏi captcha → hiện cửa sổ cho người dùng tự giải, chờ hết captcha. false = hết giờ / bị dừng. */
  async _choCaptcha(job, ctx, huyLuc) {
    const co = await this.goi('window.__suno.captcha()').catch(() => false);
    if (!co) return true;
    this.log('warning', `🧩 [${this.id}] #${job.so}: Suno hỏi xác minh (captcha) — giải giúp trong cửa sổ "${this.id}" vừa hiện`);
    ctx.capNhat({ buoc: 'Chờ bạn giải captcha của Suno' });
    this.hienCuaSo();
    for (const het = Date.now() + CHO_CAPTCHA_MS; Date.now() < het;) {
      if (!(await this.ngu(2000, huyLuc))) return false;
      if (!(await this.goi('window.__suno.captcha()').catch(() => true))) return true;
    }
    return false;
  }

  async _chay(job, ctx, huyLuc) {
    ctx.capNhat({ buoc: 'Đang mở Suno' });
    await this.moTrang(this.url);
    let tt = null;
    for (let i = 0; i < 120; i++) {
      tt = await this.goi('window.__suno.trangThai()').catch(() => null);
      if (tt && (tt.coForm || tt.canDangNhap)) break;
      if (!(await this.ngu(250, huyLuc))) return { ok: false, dung: true };
    }
    if (tt && tt.canDangNhap) return { ok: false, canDangNhap: true, loi: 'Tài khoản chưa đăng nhập Suno' };
    if (!tt || !tt.coForm) return { ok: false, loi: 'Không mở được trang Create của Suno (không thấy nút Create)' };
    if (!(await this._choCaptcha(job, ctx, huyLuc))) return { ok: false, loi: 'Suno hỏi captcha mà chưa được giải' };

    const cb = await this.goi(`window.__suno.chuanBi(${JSON.stringify({ styles: job.prompt })})`);
    if (!cb || !cb.ok) return { ok: false, loi: `Không điền được prompt vào ô Styles của Suno (${cb ? cb.loi : '?'})` };
    if (cb.coLoi) this.log('warning', `[${this.id}] #${job.so}: ô Lời của Suno còn chữ cũ, không xoá được — bài có thể có lời`);

    const truoc = new Set((await this.goi('window.__suno.dsClip()')).map((c) => c.id));
    const tbGoc = await this.goi('window.__suno.thongBao()').catch(() => '');
    await ctx.choGui();
    if (this.huy !== huyLuc) return { ok: false, dung: true };
    ctx.capNhat({ buoc: 'Đang gửi prompt' });
    const bt = await this.goi('window.__suno.bamTao()');
    if (!bt || !bt.ok) {
      const tb = await this._thongBaoMoi(tbGoc) || (bt && bt.chu);
      { const c = await this._laHetLuot(tb); if (c) return { ok: false, hetLuot: true, loi: `Suno hết lượt tạo bài: "${c}"` }; }
      return { ok: false, loi: `Nút Create của Suno không bấm được${tb ? ` ("${tb}")` : ''}` };
    }

    // Chờ bài MỚI xuất hiện (khác danh sách trước khi bấm).
    // Thông báo của Suno (toast) chỉ hiện vài giây → đọc NGAY trong lúc chờ, không đợi hết giờ mới đọc.
    let moi = [], tbCuoi = '';
    for (const het = Date.now() + CHO_BAI_MOI_MS; Date.now() < het && !moi.length;) {
      if (!(await this.ngu(1000, huyLuc))) return { ok: false, dung: true };
      moi = (await this.goi('window.__suno.dsClip()').catch(() => [])).filter((c) => !truoc.has(c.id));
      if (moi.length) break;
      const tb = await this._thongBaoMoi(tbGoc);
      if (tb) tbCuoi = tb;
      { const c = await this._laHetLuot(tb); if (c) return { ok: false, hetLuot: true, loi: `Suno hết lượt tạo bài: "${c}"` }; }
      if (!(await this._choCaptcha(job, ctx, huyLuc))) return { ok: false, loi: 'Suno hỏi captcha mà chưa được giải' };
    }
    if (!moi.length) return { ok: false, loi: `Bấm Create nhưng Suno không tạo bài nào${tbCuoi ? ` ("${tbCuoi}")` : ''}` };
    this.log('info', `[${this.id}] #${job.so} đã gửi → Suno đang tạo ${moi.length} bài (${moi.map((c) => c.id.slice(0, 8)).join(', ')})`);
    ctx.capNhat({ buoc: 'Suno đang tạo nhạc' });

    // Chờ 2 bài đầu xong hẳn (có thời lượng).
    const ids = moi.slice(0, 2).map((c) => c.id);
    let xong = [];
    for (const het = Date.now() + ctx.choToiDaGiay * 1000; Date.now() < het;) {
      if (!(await this.ngu(3000, huyLuc))) return { ok: false, dung: true };
      const ds = await this.goi('window.__suno.dsClip()').catch(() => null);
      if (!ds) { await this.moTrang(this.url); continue; }   // trang sập / tự nạp lại → mở lại, danh sách vẫn còn
      const cua = ids.map((id) => ds.find((c) => c.id === id)).filter(Boolean);
      if (cua.length && cua.every((c) => /error|fail/i.test(c.trangThai))) return { ok: false, loi: 'Suno báo lỗi khi tạo bài' };
      xong = cua.filter((c) => c.trangThai === 'complete' && c.giay > 0);
      if (xong.length === ids.length) break;
    }
    if (!xong.length) return { ok: false, loi: `Quá ${ctx.choToiDaGiay} giây Suno chưa tạo xong bài` };
    const chon = chonBaiDaiHon(xong);
    const ghiChu = xong.length > 1 ? `bài dài hơn: ${mmss(chon.giay)} (bài kia ${mmss(xong.find((c) => c !== chon).giay)})` : `${mmss(chon.giay)}`;

    // Tải MP3 bằng menu của Suno; tiến trình chính bắt file qua will-download của cửa sổ này.
    ctx.capNhat({ buoc: 'Đang tải về' });
    const tbGocTai = await this.goi('window.__suno.thongBao()').catch(() => '');
    const cho = this.choTaiVe(CHO_TAI_MS);
    const tm = await this.goi(`window.__suno.taiMp3(${JSON.stringify(chon.id)})`).catch((err) => ({ ok: false, loi: err.message }));
    const tbSauBam = await this._thongBaoMoi(tbGocTai);
    if (!tm || !tm.ok) {
      cho.huy();
      // Hộp "Out of Downloads" của Suno: tài khoản hết lượt tải → tạo lại ở tài khoản Suno dự phòng.
      if (tm && tm.hetLuotTai) return { ok: false, hetLuot: true, loi: `Suno hết lượt tải về: "${tm.chu || 'Out of Downloads'}"` };
      const tbLoi = tbSauBam || (tm && tm.chu) || '';
      { const c = await this._laHetLuot(tbSauBam) || await this._laHetLuot(tm && tm.chu); if (c) return { ok: false, hetLuot: true, loi: `Suno hết lượt tải về: "${c}"` }; }
      return { ok: false, loi: `Không bấm được Download của Suno (${tm ? tm.loi : '?'}${tm && tm.menu ? ` · menu: ${tm.menu.join(' | ')}` : ''}${tbLoi ? ` · Suno: "${tbLoi.slice(0, 200)}"` : ''})` };
    }
    // Chờ file; trong lúc chờ, Suno báo hết lượt tải (toast vài giây) thì thôi chờ ngay.
    let f = null, tbTai = tbSauBam;
    { const c = await this._laHetLuot(tbSauBam); if (c) { cho.huy(); return { ok: false, hetLuot: true, loi: `Suno hết lượt tải về: "${c}"` }; } }
    cho.hua.then((x) => { f = x; });
    while (!f) {
      if (!(await this.ngu(1000, huyLuc))) { cho.huy(); return { ok: false, dung: true }; }
      if (f) break;
      const tb = await this._thongBaoMoi(tbGocTai);
      if (tb) tbTai = tb;
      { const c = f ? '' : await this._laHetLuot(tb); if (c) { cho.huy(); return { ok: false, hetLuot: true, loi: `Suno hết lượt tải về: "${c}"` }; } }
      const het = f ? '' : await this.goi('window.__suno.hetLuotTai()').catch(() => '');
      if (het) { cho.huy(); return { ok: false, hetLuot: true, loi: `Suno hết lượt tải về: "${het}"` }; }
    }
    if (!f.ok) return { ok: false, loi: f.hetGio ? `Bấm Download MP3 nhưng Suno không gửi file nào${tbTai ? ` ("${tbTai}")` : ''}` : f.loi };
    return { ok: true, files: [{ duongDan: f.duongDan, mime: f.mime }], ghiChu, clip: chon.id };
  }
}

module.exports = { LuongSuno, chonBaiDaiHon };
