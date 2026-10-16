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
const CHO_TAI_MS = 240000;      // Unlock & Download → "Preparing..." ~40 s (video 16/10/2026) rồi mới có file
const CHO_DS_MS = 15000;          // chờ danh sách bài của trang Create nạp xong (tài khoản trống: thôi chờ sau chừng này)
const SO_LAN_TAI = 3;             // tải hỏng → nạp lại trang, tải lại ĐÚNG bài đó (không gửi lại prompt)
const CHO_SAU_MO_KHOA_MS = 5000;  // sau "Unlock & Download" chừng này chưa có file → bấm nút "Download “<tên bài>”" nếu có

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

    // Danh sách bài nạp SAU form (bất đồng bộ): chụp danh sách trước khi bấm Create khi nó còn trống / đang nạp
    // thì mọi bài cũ bị tính là bài mới (nhật ký 16/10/2026: "Suno đang tạo 14 bài"). Chờ danh sách đứng yên.
    const truocDs = await this._choDanhSach(huyLuc);
    if (!truocDs) return { ok: false, dung: true };

    // Lần trước đã tạo bài ở CHÍNH tài khoản này nhưng tải hỏng → tải lại đúng các bài đó, KHÔNG gửi lại prompt
    // (gửi lại là tốn thêm credit và đẻ thêm bài — nhật ký 16/10/2026).
    let ids = null;
    const cu = job.sunoBai && job.sunoBai.tk === this.taiKhoan.id ? job.sunoBai : null;
    if (cu && (cu.ids || []).length) {
      const con = cu.ids.filter((id) => truocDs.some((c) => c.id === id));
      if (con.length) {
        ids = con;
        this.log('info', `[${this.id}] #${job.so}: dùng lại ${con.length} bài đã tạo lần trước (${con.map((x) => x.slice(0, 8)).join(', ')}) — không gửi lại prompt`);
      } else {
        this.log('warning', `[${this.id}] #${job.so}: không còn thấy bài đã tạo lần trước trên Suno — tạo lại`);
      }
    }

    if (!ids) {
      // Hết credit trong ngày: nút Create ghi "Create again in 9:44:35" → tài khoản nghỉ tới lúc đó, bài sang tài khoản khác.
      { const h = await this.goi('window.__suno.hetGioTao()').catch(() => null); if (h && h.chu) return this._hetGioTao(h); }
      const cb = await this.goi(`window.__suno.chuanBi(${JSON.stringify({ styles: job.prompt })})`);
      if (!cb || !cb.ok) return { ok: false, loi: `Không điền được prompt vào ô Styles của Suno (${cb ? cb.loi : '?'})` };
      if (cb.coLoi) this.log('warning', `[${this.id}] #${job.so}: ô Lời của Suno còn chữ cũ, không xoá được — bài có thể có lời`);

      const truoc = new Set([...truocDs, ...(await this.goi('window.__suno.dsClip()').catch(() => []))].map((c) => c.id));
      const tbGoc = await this.goi('window.__suno.thongBao()').catch(() => '');
      await ctx.choGui();
      if (this.huy !== huyLuc) return { ok: false, dung: true };
      ctx.capNhat({ buoc: 'Đang gửi prompt' });
      const bt = await this.goi('window.__suno.bamTao()');
      if (bt && bt.hetGioTao && bt.hetGioTao.chu) return this._hetGioTao(bt.hetGioTao);
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
      // Bài vừa bấm Create đang tạo (chưa "complete"); bài đã xong mà lọt vào đây là bài cũ nạp muộn.
      const dangTao = moi.filter((c) => c.trangThai !== 'complete');
      if (dangTao.length) moi = dangTao;
      this.log('info', `[${this.id}] #${job.so} đã gửi → Suno đang tạo ${moi.length} bài (${moi.map((c) => c.id.slice(0, 8)).join(', ')})`);
      ids = moi.slice(0, 2).map((c) => c.id);
      // Nhớ bài của việc này trên tài khoản này: tải hỏng thì lần sau tải lại, không tạo thêm.
      ctx.capNhat({ sunoBai: { tk: this.taiKhoan.id, ids } });
    }
    ctx.capNhat({ buoc: 'Suno đang tạo nhạc' });

    // Chờ 2 bài đầu xong hẳn (có thời lượng).
    let xong = [];
    for (const het = Date.now() + ctx.choToiDaGiay * 1000; Date.now() < het;) {
      const ds = await this.goi('window.__suno.dsClip()').catch(() => null);
      if (!ds) { await this.moTrang(this.url); if (!(await this.ngu(3000, huyLuc))) return { ok: false, dung: true }; continue; }   // trang sập / tự nạp lại → mở lại
      const cua = ids.map((id) => ds.find((c) => c.id === id)).filter(Boolean);
      if (cua.length && cua.every((c) => /error|fail/i.test(c.trangThai))) return { ok: false, loi: 'Suno báo lỗi khi tạo bài' };
      xong = cua.filter((c) => c.trangThai === 'complete' && c.giay > 0);
      if (xong.length === ids.length) break;
      if (!(await this.ngu(3000, huyLuc))) return { ok: false, dung: true };
    }
    if (!xong.length) return { ok: false, loi: `Quá ${ctx.choToiDaGiay} giây Suno chưa tạo xong bài` };
    const chon = chonBaiDaiHon(xong);
    const ghiChu = xong.length > 1 ? `bài dài hơn: ${mmss(chon.giay)} (bài kia ${mmss(xong.find((c) => c !== chon).giay)})` : `${mmss(chon.giay)}`;

    // Tải MP3 bằng menu ⋯ của Suno; hỏng (không phải hết lượt) thì nạp lại trang và tải lại ĐÚNG bài đó.
    ctx.capNhat({ buoc: 'Đang tải về' });
    let kq = null;
    for (let lan = 1; lan <= SO_LAN_TAI; lan++) {
      kq = await this._taiBai(chon, huyLuc);
      if (kq.ok) return { ok: true, files: kq.files, ghiChu, clip: chon.id };
      if (kq.dung || kq.hetLuot) return kq;
      if (lan < SO_LAN_TAI) {
        this.log('warning', `⚠ [${this.id}] #${job.so}: ${kq.loi} — tải lại bài này (lần ${lan + 1}/${SO_LAN_TAI}), không gửi lại prompt`);
        await this.goi('window.__suno.dongHop()').catch(() => {});
        await this.moTrang(this.url);
        if (!(await this._choDanhSach(huyLuc))) return { ok: false, dung: true };
      }
    }
    return kq;
  }

  _hetGioTao(h) {
    return { ok: false, hetLuot: true, nghiMs: (Math.max(0, h.giay) + 60) * 1000, loi: `Suno hết credit tạo bài: "${h.chu}"` };
  }

  /**
   * Chờ danh sách bài của trang Create nạp xong: có bài và giữ nguyên ~1,5 s (tài khoản chưa có bài nào thì
   * thôi chờ sau CHO_DS_MS). Trả danh sách, null = bị dừng.
   */
  async _choDanhSach(huyLuc) {
    let truoc = '', giong = 0, ds = [];
    for (const het = Date.now() + CHO_DS_MS; Date.now() < het;) {
      ds = await this.goi('window.__suno.dsClip()').catch(() => []);
      const khoa = ds.map((c) => c.id).join();
      giong = khoa && khoa === truoc ? giong + 1 : 0;
      truoc = khoa;
      if (giong >= 3) break;
      if (!(await this.ngu(500, huyLuc))) return null;
    }
    return ds;
  }

  /** Một lần tải MP3 của bài `chon`: ⋯ → Download → MP3 → (Unlock &) Download; tiến trình chính bắt file. */
  async _taiBai(chon, huyLuc) {
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
      return { ok: false, loi: `Không bấm được Download của Suno (${tm ? tm.loi : '?'}${tm && tm.nut ? ` · nút ${tm.nut}` : ''}${tm && tm.menu ? ` · menu: ${tm.menu.join(' | ')}` : ''}${tbLoi ? ` · Suno: "${tbLoi.slice(0, 200)}"` : ''})` };
    }
    if (tm.moKhoa) this.log('info', `[${this.id}] Đã bấm "Unlock & Download" của Suno (mở khoá bài = trừ 1 lượt tải của tài khoản)${tm.dangChuanBi ? ' — Suno đang chuẩn bị file (Preparing…), chờ tải về' : ''}`);
    else if (tm.cach === 'dang-chuan-bi') this.log('info', `[${this.id}] Bài đã mở khoá, Suno đang chuẩn bị file (Preparing…) — chờ tải về`);
    // Chờ file; trong lúc chờ, Suno báo hết lượt tải (toast vài giây) thì thôi chờ ngay.
    let f = null, tbTai = tbSauBam, daBamLai = false;
    const batDau = Date.now();
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
      // Mở khoá xong mà Suno chưa gửi file, hộp hiện nút "Download “<tên bài>”" → bấm nút đó (một lần).
      if (!f && !daBamLai && Date.now() - batDau > CHO_SAU_MO_KHOA_MS && !(cho.daBatDau && cho.daBatDau())) {
        const b = await this.goi('window.__suno.bamTaiSauMoKhoa()').catch(() => null);
        if (b && b.ok) { daBamLai = true; this.log('info', `[${this.id}] Bấm "${b.chu}" sau khi mở khoá bài`); }
      }
    }
    await this.goi('window.__suno.dongHop()').catch(() => {});
    if (!f.ok) return { ok: false, loi: f.hetGio ? `Bấm Download MP3 nhưng Suno không gửi file nào${tbTai ? ` ("${tbTai}")` : ''}` : f.loi };
    return { ok: true, files: [{ duongDan: f.duongDan, mime: f.mime }] };
  }
}

module.exports = { LuongSuno, chonBaiDaiHon };
