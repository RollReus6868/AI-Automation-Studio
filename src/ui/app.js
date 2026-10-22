// ============================================================================
//  app.js — giao diện AI Automation Studio (JS thuần, không cần build)
//  Muse và Google Flow dùng chung MỘT hàng đợi; cột Tạo có nút "Chạy trên".
//  S = trạng thái tiến trình chính đẩy sang; U = trạng thái riêng của giao diện.
//  HD = src/main/hang-doi.js (dùng chung logic với tiến trình chính).
// ============================================================================
(function () {
  'use strict';
  const api = window.app;
  const $ = (s, g) => (g || document).querySelector(s);
  const $$ = (s, g) => Array.from((g || document).querySelectorAll(s));
  const KHOA = 'ai-studio-ui';

  let S = null;
  const U = Object.assign({
    trang: 'anh', duAn: '', loc: 'tat', tim: '', moiNhat: true, cheDo: 'tudo', tyLe: { anh: '9:16', video: '9:16' },
    nhap: { anh: '', video: '', nhac: '' }, tvLoc: 'tat', tvDuAn: '', chuoi: { bat: false, prompt: '', tyLe: '', nen: '' }, promptThuMuc: '',
    nen: { anh: 'muse', video: 'muse' }, locNen: '', nenTk: 'muse'
  }, docLuu());
  if (!U.nen || typeof U.nen !== 'object') U.nen = { anh: 'muse', video: 'muse' };
  if (!U.nhap || typeof U.nhap !== 'object') U.nhap = { anh: '', video: '', nhac: '' };
  U.chon = new Set(); U.chiTiet = null; U.nvChon = new Set(); U.log = []; U.dangNhapMo = false;
  // Ảnh tham chiếu / thư mục ảnh RIÊNG cho từng trang: ảnh gắn ở trang video không được dính sang trang ảnh.
  U.tc = { anh: { ds: [], thuMuc: null }, video: { ds: [], thuMuc: null }, nhac: { ds: [], thuMuc: null } };
  const TC = () => U.tc[loaiTrang()];

  function docLuu() { try { return JSON.parse(localStorage.getItem(KHOA)) || {}; } catch (_) { return {}; } }
  function luuUi() {
    try {
      localStorage.setItem(KHOA, JSON.stringify({ trang: U.trang, duAn: U.duAn, loc: U.loc, moiNhat: U.moiNhat, cheDo: U.cheDo,
        tyLe: U.tyLe, nhap: U.nhap, tvLoc: U.tvLoc, tvDuAn: U.tvDuAn, chuoi: U.chuoi, promptThuMuc: U.promptThuMuc, nen: U.nen, locNen: U.locNen, nenTk: U.nenTk, mauTai: U.mauTai }));
    } catch (_) {}
  }

  // ── Tiện ích ────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${(window.ICON || {})[n] || ''}</svg>`;
  const ic = (n, cls) => `<i data-icon="${n}"${cls ? ` class="${cls}"` : ''}>${svg(n)}</i>`;
  function veIcon(goc) { for (const el of $$('i[data-icon]', goc)) if (!el.firstChild) el.innerHTML = svg(el.dataset.icon); }
  function fileUrl(p) {
    if (!p) return '';
    const x = String(p).replace(/\\/g, '/');
    return 'file://' + (x.startsWith('/') ? '' : '/') + encodeURI(x).replace(/#/g, '%23').replace(/\?/g, '%3F');
  }
  /** Chỉ thay HTML khi thật sự khác — tránh video đang phát bị nạp lại mỗi lần trạng thái đổi. */
  function datHtml(el, html) {
    if (el.__html === html) return false;
    el.__html = html;
    el.innerHTML = html;
    return true;
  }

  /**
   * 1.3.4 — Danh sách vẽ theo TỪNG DÒNG: chỉ dòng có HTML đổi mới bị thay, dòng khác giữ nguyên phần tử.
   * Trước đây mỗi lần trạng thái đổi (việc xong, đổi bước… vài lần mỗi giây khi đang chạy) cả danh sách bị
   * vẽ lại → hàng trăm ảnh / video bị tạo lại, giao diện phình hàng GB RAM và giật.
   * ds = [{ khoa, html }] theo đúng thứ tự; duoi = HTML phần cuối (vd "Còn N việc nữa") hoặc ''.
   */
  function veTheoDong(hop, ds, duoi) {
    if (!hop.__dong || hop.__html !== undefined) { hop.innerHTML = ''; hop.__dong = new Map(); hop.__html = undefined; }
    const cu = hop.__dong, moi = new Map();
    const tam = document.createElement('template');
    let truoc = null, doi = false;
    for (const { khoa, html } of ds) {
      let x = cu.get(khoa);
      if (!x || x.html !== html) {
        tam.innerHTML = html.trim();
        const el = tam.content.firstElementChild;
        if (x) { x.el.replaceWith(el); } 
        x = { html, el };
        doi = true;
      }
      cu.delete(khoa);
      moi.set(khoa, x);
      const dung = truoc ? truoc.nextSibling : hop.firstChild;
      if (dung !== x.el) { hop.insertBefore(x.el, dung); doi = true; }
      truoc = x.el;
    }
    for (const x of cu.values()) { x.el.remove(); doi = true; }
    hop.__dong = moi;
    // Phần cuối (không thuộc dòng nào): luôn nằm sau dòng cuối.
    let c = hop.__duoi;
    if (duoi) {
      if (!c || c.__html !== duoi) { if (c) c.remove(); tam.innerHTML = duoi.trim(); c = tam.content.firstElementChild; c.__html = duoi; hop.__duoi = c; doi = true; }
      if ((truoc ? truoc.nextSibling : hop.firstChild) !== c) hop.insertBefore(c, truoc ? truoc.nextSibling : hop.firstChild);
    } else if (c) { c.remove(); hop.__duoi = null; doi = true; }
    if (doi) ganAnhVideo(hop);
    return doi;
  }
  /** Thay cả hộp bằng một khối HTML (vd "Hàng đợi trống") — bỏ bộ nhớ dòng của veTheoDong. */
  function datHtmlHop(hop, html) {
    if (hop.__dong) { hop.__dong = null; hop.__duoi = null; hop.__html = undefined; }
    return datHtml(hop, html);
  }

  // ── Ảnh nhỏ cho video (1.3.4) ─────────────────────────────────────────────
  // Danh sách / Thư viện từng đặt <video preload="metadata"> cho MỖI video đã xong: 200 video = 200 trình
  // phát video sống cùng lúc (mỗi cái giữ bộ giải mã + khung hình) → hàng GB RAM. Giờ mỗi video chỉ được mở
  // MỘT lần, chụp một khung hình nhỏ (JPEG ~160 px) rồi đóng ngay; danh sách hiện ảnh nhỏ đó. Chỉ chụp video
  // đang hiện trên màn hình, lần lượt từng cái.
  const ANH_VIDEO = new Map();          // khoá → dataURL ('' = không đọc được, hiện biểu tượng)
  const ANH_VIDEO_TOI_DA = 3000;
  const choChup = [];
  let dangChup = false;
  const nhinThay = 'IntersectionObserver' in window ? new IntersectionObserver((ds) => {
    for (const e of ds) if (e.isIntersecting) { nhinThay.unobserve(e.target); xepChup(e.target.dataset.vthumb, e.target.dataset.vk); }
  }, { rootMargin: '300px' }) : null;
  /** HTML ảnh nhỏ của video f (khoá đổi khi video được tải lại). Ảnh được gắn sau bằng ganAnhVideo. */
  const anhVideoHtml = (f, khoa) => `<img data-vthumb="${esc(f)}" data-vk="${esc(khoa)}" alt="">`;
  function datAnhVideo(img) {
    const u = ANH_VIDEO.get(img.dataset.vk);
    if (u === undefined) return false;
    if (u) { if (img.getAttribute('src') !== u) img.src = u; img.classList.remove('vthumb-loi'); }
    else img.classList.add('vthumb-loi');
    return true;
  }
  function ganAnhVideo(goc) {
    for (const img of goc.querySelectorAll('img[data-vthumb]')) {
      if (datAnhVideo(img)) continue;
      if (nhinThay) nhinThay.observe(img); else xepChup(img.dataset.vthumb, img.dataset.vk);
    }
  }
  function xepChup(f, khoa) {
    if (ANH_VIDEO.has(khoa) || choChup.some((x) => x.khoa === khoa)) return;
    choChup.push({ f, khoa });
    chupTiep();
  }
  async function chupTiep() {
    if (dangChup) return;
    dangChup = true;
    try {
      while (choChup.length) {
        const { f, khoa } = choChup.shift();
        if (ANH_VIDEO.has(khoa)) continue;
        const u = await chupVideo(f);
        if (ANH_VIDEO.size >= ANH_VIDEO_TOI_DA) ANH_VIDEO.delete(ANH_VIDEO.keys().next().value);
        ANH_VIDEO.set(khoa, u);
        for (const img of document.querySelectorAll('img[data-vthumb]')) if (img.dataset.vk === khoa) datAnhVideo(img);
      }
    } finally { dangChup = false; }
  }
  window.__anhVideo = { soDaChup: () => ANH_VIDEO.size, cho: () => choChup.length };   // cho bài kiểm thử
  /** Mở video, lấy khung hình ở giây 0,5 (video ngắn hơn: giữa video), thu nhỏ thành JPEG rồi đóng video. */
  function chupVideo(f) {
    return new Promise((xong) => {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto';
      let het = false;
      const ket = (u) => {
        if (het) return;
        het = true; clearTimeout(hen);
        v.removeAttribute('src');
        try { v.load(); } catch (_) {}
        xong(u);
      };
      const hen = setTimeout(() => ket(''), 15000);
      v.onerror = () => ket('');
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (_) { ket(''); } };
      v.onseeked = () => {
        try {
          const r = 200, w = v.videoWidth || 16, h = v.videoHeight || 9, k = Math.min(1, r / Math.max(w, h));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          ket(c.toDataURL('image/jpeg', 0.75));
        } catch (_) { ket(''); }
      };
      v.src = fileUrl(f);
    });
  }
  const loaiTrang = () => (U.trang === 'video' || U.trang === 'nhac' ? U.trang : 'anh');
  /** Nơi chạy đang chọn ở cột Tạo của trang hiện tại: 'muse' | 'flow' — trang nhạc luôn là 'suno'. */
  const nenTrang = () => (loaiTrang() === 'nhac' ? 'suno' : U.nen[loaiTrang()] === 'flow' ? 'flow' : 'muse');
  const TEN_NEN = { muse: 'Muse', flow: 'Google Flow', suno: 'Suno', drive: 'Google Drive' };
  const DS_NEN = ['muse', 'flow', 'suno'];
  const DS_NEN_TK = [...DS_NEN, 'drive'];   // 1.4.0: thẻ Drive ở mục Tài khoản (không nhận việc tạo)
  const TEN_LOAI = { anh: 'ảnh', video: 'video', nhac: 'nhạc' };
  const ICON_LOAI = { anh: 'image', video: 'film', nhac: 'music' };
  const TY_LE_FLOW = ['16:9', '9:16'];
  const nenTk = (a) => (a && (a.nen === 'flow' || a.nen === 'suno' || a.nen === 'drive') ? a.nen : 'muse');
  const so3 = (n) => String(n).padStart(3, '0');
  function gio(t) {
    if (!t) return '';
    const d = new Date(t), nay = new Date();
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return d.toDateString() === nay.toDateString() ? `Hôm nay, ${hm}` : `${d.getDate()}/${d.getMonth() + 1}, ${hm}`;
  }
  // 1.4.0: đồng hồ dự án — đã chạy (giờ:phút:giây) và còn bao lâu (≈ x giờ y phút).
  const hai = (n) => String(n).padStart(2, '0');
  const dongHoChu = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${hai(Math.floor(t / 3600))}:${hai(Math.floor((t % 3600) / 60))}:${hai(t % 60)}`; };
  function khoangChu(ms) {
    const p = Math.round(ms / 60000);
    if (p < 1) return 'dưới 1 phút';
    if (p < 60) return `${p} phút`;
    return p % 60 ? `${Math.floor(p / 60)} giờ ${p % 60} phút` : `${Math.floor(p / 60)} giờ`;
  }
  /** Số đo đồng hồ của dự án, đếm tiếp từ lúc tiến trình chính đo (S.luc) — chip tự chạy từng giây, không cần chờ trạng thái mới. */
  function soDongHo(id) {
    const g = S && S.dongHo && S.dongHo[id];
    if (!g) return null;
    const troi = g.dangChay ? Math.max(0, Date.now() - (S.nhanLuc || Date.now())) : 0;
    return { ...g, daChay: g.daChay + troi, conLai: Math.max(0, (g.conLai || 0) - troi) };
  }
  function veDongHo() {
    const chip = $('#chipDongHo');
    const d = S && duAnHienTai(), g = d && soDongHo(d.id);
    if (!g || (!g.dangChay && !g.soCon && !g.daChay)) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.classList.toggle('chay', g.dangChay);
    const xongLuc = g.soCon ? new Date(Date.now() + g.conLai) : null;
    chip.lastElementChild.textContent = g.dangChay ? `${dongHoChu(g.daChay)}${g.soCon ? ` · còn ≈ ${khoangChu(g.conLai)}` : ''}`
      : g.soCon ? `Dự kiến ≈ ${khoangChu(g.conLai)}` : `Lần trước ${dongHoChu(g.daChay)}`;
    chip.title = (g.dangChay ? `Dự án đã chạy lượt này ${dongHoChu(g.daChay)}` : g.daChay ? `Lượt chạy gần nhất: ${dongHoChu(g.daChay)}` : 'Dự án chưa chạy') +
      ` · tổng thời gian chạy ${dongHoChu(g.tong)}` +
      (g.soCon ? ` · còn ${g.soCon} việc (tính cả video sẽ tạo từ ảnh) · dự đoán ${g.dangChay ? 'xong' : 'chạy hết trong'} ≈ ${khoangChu(g.conLai)}${g.dangChay ? `, khoảng ${hai(xongLuc.getHours())}:${hai(xongLuc.getMinutes())}` : ''}` : '') +
      '. Dự đoán theo tốc độ thật của lượt đang chạy (lượt mới chạy thì theo thời gian trung bình mỗi việc).';
  }
  let henToast = null;
  function toast(chu, loi) {
    const t = $('#toast');
    t.textContent = chu; t.className = 'toast' + (loi ? ' loi' : ''); t.hidden = false;
    clearTimeout(henToast); henToast = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const duAnHienTai = () => (S && (S.duAn.find((d) => d.id === U.duAn) || S.duAn[0])) || null;
  /**
   * 1.3.0 — mỗi dự án có cài đặt riêng: S.caiDat / S.thuMuc là bộ của DỰ ÁN ĐANG MỞ (S.caiDatChung = cài đặt
   * chung của app, vd tắt máy khi xong). Đổi dự án → gọi lại.
   */
  function apDuAn() {
    if (!S) return;
    if (!S.caiDatChung) S.caiDatChung = S.caiDat;
    const d = duAnHienTai(), id = d && d.id;
    S.caiDat = (S.caiDatDuAn && S.caiDatDuAn[id]) || S.caiDatChung;
    S.thuMuc = (S.thuMucDuAn && S.thuMucDuAn[id]) || S.thuMuc;
  }
  /** Lưu cài đặt vào dự án đang mở. */
  const datCD = (c) => api.call('datCaiDat', { ...c, duAn: (duAnHienTai() || {}).id });
  const duAnDangChay = (id) => !!(S && (S.duAnChay || []).includes(id));
  /** 1.3.6: việc đang chờ thuộc lượt hẹn giờ đang chạy (theo loại việc; video nối từ ảnh theo hẹn của ảnh). */
  const theoHen = (j) => !!(S && [j.loai, j.henLoai].some((l) => { const x = l && (S.henChay || {})[l]; return x && (!x.duAn || x.duAn === j.duAn); }));
  /**
   * Tài khoản chạy dự án trên MỘT nơi chạy, theo thứ tự [chính, dự phòng…]; chưa chọn tài khoản nào
   * của nơi đó = mọi tài khoản của nơi đó (giống điều phối).
   */
  const tkCuaDuAn = (d, nen) => {
    const cuaNen = (id) => S.taiKhoan.some((a) => a.id === id && nenTk(a) === nen);
    const ds = d && d.taiKhoan ? d.taiKhoan.filter(cuaNen) : [];
    return ds.length ? ds : S.taiKhoan.filter((a) => nenTk(a) === nen).map((a) => a.id);
  };
  const tenTk = (id) => (S.taiKhoan.find((a) => a.id === id) || { ten: id }).ten;
  /**
   * Ô chọn tài khoản trong hộp thoại (1.3.0): mỗi tài khoản của từng nơi chạy chọn ĐÍCH DANH một vai —
   * "Chạy" (chạy cùng lúc, chọn bao nhiêu cũng được), "Dự phòng" (vào thay khi tài khoản đang chạy lỗi / nghỉ,
   * theo thứ tự từ trên xuống) hoặc "Không dùng". Trước đây chỉ chọn được SỐ tài khoản chạy cùng lúc.
   * Gọn (16/10/2026, ảnh người dùng: hộp dài quá màn hình): các tài khoản xếp nhiều cột, hộp thoại tự cuộn.
   */
  const VAI_TK = [['chay', 'Chạy'], ['du', 'Dự phòng'], ['khong', 'Không dùng']];
  // 1.3.7: mỗi tài khoản Muse / Flow chọn được dùng cho Ảnh, Video hay cả hai (vd Flow 1 chỉ tạo ảnh).
  const LOAI_TK = [['anh', 'Ảnh'], ['video', 'Video']];
  const boLoaiCua = (d, l, id) => !!(d && d.boLoai && (d.boLoai[l] || []).includes(id));
  function htmlChonTk(d) {
    return `<p class="chon-tk-giai"><b>Chạy</b>: các tài khoản chạy cùng lúc (chọn bao nhiêu cũng được). <b>Dự phòng</b>: chỉ vào thay khi một tài khoản đang chạy lỗi / nghỉ, theo thứ tự từ trên xuống. <b>Không dùng</b>: dự án không đụng tới. Ô <b>Ảnh</b> / <b>Video</b>: tài khoản đó tạo loại nào (bỏ chọn Video = tài khoản chỉ tạo ảnh).</p>` +
      DS_NEN.map((nen) => {
        const tk = S.taiKhoan.filter((a) => nenTk(a) === nen);
        if (!tk.length) return `<div class="chon-tk nhom-nen"><b>${TEN_NEN[nen]}</b><span>Chưa có tài khoản ${TEN_NEN[nen]} — thêm ở mục Tài khoản.</span></div>`;
        const ds = tkCuaDuAn(d, nen), song = Math.min(soSong(d, nen), ds.length);
        const thuTu = [...ds, ...tk.map((a) => a.id).filter((id) => !ds.includes(id))];
        return `<div class="chon-tk nhom-nen"><b>${TEN_NEN[nen]}</b><input type="hidden" name="thuTu_${nen}" value="${esc(thuTu.join(','))}">
        <div class="chon-tk-vai">${thuTu.map((id, i) => {
          const a = tk.find((x) => x.id === id);
          const vai = i < song ? 'chay' : ds.includes(id) ? 'du' : 'khong';
          const loai = nen === 'suno' ? '' : `<span class="loai-tk">${LOAI_TK.map(([l, t]) =>
            `<label title="Dùng tài khoản này để tạo ${t.toLowerCase()}"><input type="checkbox" name="loai_${l}_${esc(id)}" ${boLoaiCua(d, l, id) ? '' : 'checked'}>${t}</label>`).join('')}</span>`;
          const sk = skTk(id);
          return `<div class="hang-vai" data-vai="${vai}"><span title="${esc(`${a.ten} — ${sk.chu}`)}"><i class="cham-sk sk-${sk.muc}"></i>${esc(a.ten)}${a.trangThai === 'can-dang-nhap' ? ' <small>(chưa đăng nhập)</small>' : ''}</span>` +
            loai + `<select name="vai_${esc(id)}" data-vai-tk>${VAI_TK.map(([k, t]) => `<option value="${k}" ${k === vai ? 'selected' : ''}>${t}</option>`).join('')}</select>` +
            // 1.3.8: tài khoản đang lỗi → ghi rõ lỗi ngay dưới tên (không phải rê chuột mới thấy).
            (sk.muc === 'loi' ? `<small class="ly-loi">${esc(sk.chu)}${a.trangThai !== 'can-dang-nhap' ? ` <button type="button" class="lien-ket" data-chay-lai-tk="${esc(id)}" title="Lỗi đã sửa xong — cho tài khoản nhận việc lại ngay">Chạy lại ngay</button>` : ''}</small>` : '') + '</div>';
        }).join('')}</div><small class="mo">Để "Không dùng" hết = dự án dùng mọi tài khoản ${TEN_NEN[nen]}.</small></div>`;
      }).join('');
  }
  /** Dự án chạy mấy tài khoản của nơi này cùng lúc (giống _soSong của điều phối). */
  const soSong = (d, nen) => (d && d.chaySong && d.chaySong[nen]) || 1;
  /** Vai đã chọn trong hộp thoại: {chay:[id…], du:[id…]} theo thứ tự hiện; không có tài khoản "Chạy" mà có dự phòng → dự phòng đầu thành Chạy. */
  const vaiTk = (v, nen) => {
    const ids = String(v['thuTu_' + nen] || '').split(',').filter(Boolean);
    const chay = ids.filter((id) => v['vai_' + id] === 'chay'), du = ids.filter((id) => v['vai_' + id] === 'du');
    if (!chay.length && du.length) chay.push(du.shift());
    return { chay, du };
  };
  const laySong = (v) => Object.fromEntries(DS_NEN.map((nen) => [nen, Math.max(1, vaiTk(v, nen).chay.length)]));
  const layTk = (v) => DS_NEN.flatMap((nen) => { const x = vaiTk(v, nen); return [...x.chay, ...x.du]; });
  /** 1.3.7: {anh: [id…], video: [id…]} — tài khoản bỏ chọn ô Ảnh / Video (không dùng cho loại đó). */
  const layBoLoai = (v) => Object.fromEntries(LOAI_TK.map(([l]) => [l,
    Object.keys(v).filter((k) => k.startsWith(`loai_${l}_`) && v[k] === false).map((k) => k.slice(`loai_${l}_`.length))]));
  const viecTheoId = (id) => S && S.viec.find((j) => j.id === id);
  /** Khoá cài đặt Tải về / Tên file của từng trang Tạo (nhạc luôn tải về: không có khoá công tắc). */
  const khoaTai = (loai = loaiTrang()) => ({ video: { tai: 'taiVideo', ten: 'tenVideo' }, nhac: { tai: '', ten: 'tenNhac' } }[loai] || { tai: 'taiAnh', ten: 'tenAnh' });

  // ── Hộp thoại (Electron không có window.prompt) ───────────────────────────
  async function hoi({ tieuDe, html, ok = 'OK', huy = 'Huỷ', nguyHiem = false }) {
    if (U.dangNhapMo) await dongDangNhap();     // trình duyệt đăng nhập là lớp native, che mất hộp thoại
    $('#hopTieuDe').textContent = tieuDe;
    $('#hopNoiDung').innerHTML = html || '';
    veIcon($('#hopNoiDung'));
    const nOk = $('#hopOk'), nHuy = $('#hopHuy');
    nOk.textContent = ok; nOk.className = 'nut-gradient' + (nguyHiem ? ' dung' : '');
    nHuy.textContent = huy; nHuy.hidden = !huy;
    $('#phu').hidden = false;
    const dau = $('#hopNoiDung input, #hopNoiDung textarea');
    if (dau) setTimeout(() => dau.focus(), 30);
    return new Promise((r) => {
      const xong = (v) => { $('#phu').hidden = true; nOk.onclick = nHuy.onclick = null; document.removeEventListener('keydown', phim); r(v); };
      const lay = () => {
        const o = {};
        for (const el of $$('#hopNoiDung [name]')) o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        return o;
      };
      const phim = (e) => {
        if (e.key === 'Escape') xong(null);
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') xong(lay());
      };
      document.addEventListener('keydown', phim);
      nOk.onclick = () => xong(lay());
      nHuy.onclick = () => xong(null);
    });
  }
  const xacNhan = (tieuDe, chu, ok = 'Đồng ý', nguyHiem = false) =>
    hoi({ tieuDe, html: `<p>${chu}</p>`, ok, nguyHiem }).then((v) => !!v);

  // ── Điều hướng ──────────────────────────────────────────────────────────
  const TEN_TRANG = { anh: 'Tạo ảnh', video: 'Tạo video', nhac: 'Tạo nhạc', hengio: 'Hẹn giờ', nhanvat: 'Nhân vật', thuvien: 'Thư viện', taikhoan: 'Tài khoản', huongdan: 'Hướng dẫn', caidat: 'Cài đặt' };
  function diToi(trang) {
    if (U.trang === 'taikhoan' && trang !== 'taikhoan' && U.dangNhapMo) dongDangNhap();
    const cu = U.trang;
    U.trang = trang;
    for (const b of $$('#nav button')) b.classList.toggle('on', b.dataset.trang === trang);
    $('#tieuDeTrang').textContent = TEN_TRANG[trang];
    const tao = trang === 'anh' || trang === 'video' || trang === 'nhac';
    document.body.classList.toggle('trang-nhac', trang === 'nhac');
    $('#trang-tao').hidden = !tao;
    for (const t of ['hengio', 'nhanvat', 'thuvien', 'taikhoan', 'huongdan', 'caidat']) $(`#trang-${t}`).hidden = t !== trang;
    $('#khuDuAn').style.visibility = tao ? 'visible' : 'hidden';
    if (tao) {
      if (cu !== trang) { U.chon.clear(); U.chiTiet = null; }
      $('#tieuDeTao').textContent = TEN_TRANG[trang];
      $('#tieuDeHang').textContent = `Hàng đợi ${TEN_LOAI[trang]}`;
      $('#oPrompt').placeholder = {
        video: 'Mô tả video bạn muốn tạo (cảnh, chuyển động, âm thanh)…\nMỗi dòng là một prompt. Muse tạo clip khoảng 10 giây.',
        nhac: 'Mô tả phong cách bài nhạc (thể loại, nhạc cụ, tâm trạng, nhịp)…\nMỗi dòng là một prompt, vd: lofi chill piano, tiếng mưa nhẹ, 80 bpm',
        anh: 'Mô tả chi tiết ảnh bạn muốn tạo…\nMỗi dòng là một prompt. Gõ tên nhân vật (vd: Lan) để tự gửi kèm ảnh nhân vật.'
      }[trang];
      $('#oPrompt').value = U.nhap[loaiTrang()] || '';
      for (const b of $$('#tyLe button')) b.classList.toggle('on', b.dataset.v === U.tyLe[loaiTrang()]);
      $('#promptVideoChung').value = U.chuoi.prompt;
      $('#promptThuMuc').value = U.promptThuMuc;
      $('#tyLeVideoChuoi').value = U.chuoi.tyLe;
      $('#nenVideoChuoi').value = U.chuoi.nen || '';
    }
    if (trang === 'caidat') veCaiDat();
    if (trang === 'hengio') napHenGio();
    luuUi();
    ve();
  }
  window.__diToi = diToi;   // cho bài chụp giao diện

  // ── Vẽ ──────────────────────────────────────────────────────────────────
  function ve() {
    if (!S) return;
    apDuAn();
    veTopbar();
    if (U.trang === 'anh' || U.trang === 'video' || U.trang === 'nhac') { veTao(); veHang(); veChiTiet(); }
    if (U.trang === 'nhanvat') veNhanVat();
    if (U.trang === 'thuvien') veThuVien();
    if (U.trang === 'taikhoan') veTaiKhoan();
    if (U.trang === 'hengio') veHenGio();
  }

  function veTopbar() {
    const d = duAnHienTai();
    if (d && U.duAn !== d.id) U.duAn = d.id;
    const soViec = S.viec.filter((j) => j.duAn === (d && d.id) && j.loai === loaiTrang()).length;
    $('#tenDuAn').textContent = d ? `${d.ten} - ${soViec}` : '—';
    // Chip tài khoản theo nơi chạy đang chọn ở cột Tạo.
    const nen = nenTrang();
    const tkd = d ? tkCuaDuAn(d, nen) : [];
    const song = Math.min(soSong(d, nen), tkd.length || 1);
    $('#chuTkDuAn').textContent = tkd.length ? `${tkd.slice(0, song).map(tenTk).join(' + ')}${tkd.length > song ? ` +${tkd.length - song} dự phòng` : ''}` : `Chưa có tài khoản ${TEN_NEN[nen]}`;
    $('#nutTkDuAn').title = tkd.length ? `${TEN_NEN[nen]} — ${song > 1 ? `chạy cùng lúc: ${tkd.slice(0, song).map(tenTk).join(', ')}` : `chính: ${tenTk(tkd[0])}`}${tkd.length > song ? ` · dự phòng: ${tkd.slice(song).map(tenTk).join(', ')}` : ''} — bấm để đổi` : '';
    const dangChay = S.viec.filter((j) => j.trangThai === 'chay').length;
    const soDa = (S.duAnChay || []).length;
    const chip = $('#chipChay');
    chip.classList.toggle('chay', S.dangChay);
    chip.lastElementChild.textContent = S.dangChay ? `Đang chạy ${dangChay}${soDa > 1 ? ` · ${soDa} dự án` : ''}` : 'Đang nghỉ';
    chip.title = soDa ? `Dự án đang chạy: ${S.duAn.filter((x) => duAnDangChay(x.id)).map((x) => x.ten).join(', ')}` : '';
    const homNay = new Date().toDateString();
    const xongHN = S.viec.filter((j) => j.trangThai === 'xong' && new Date(j.xongLuc).toDateString() === homNay);
    $('#chipHomNay').lastElementChild.textContent =
      `Hôm nay ${['anh', 'video', 'nhac'].map((l) => `${xongHN.filter((j) => j.loai === l).length} ${TEN_LOAI[l]}`).join(' · ')}`;
    // 1.3.0: nút Chạy / Dừng của DỰ ÁN ĐANG MỞ — dự án khác chạy riêng, không bị dừng theo.
    veDongHo();
    const n = $('#nutChayTatCa'), chayDa = !!d && duAnDangChay(d.id);
    n.classList.toggle('dung', chayDa);
    n.innerHTML = chayDa ? `${ic('pause')}<span>Dừng dự án</span>` : `${ic('play')}<span>Chạy dự án</span>`;
    // 1.3.6: chip hẹn giờ — chức năng đang chạy theo hẹn, hoặc lần hẹn gần nhất sắp tới.
    const hg = S.henGio || {}, hc = S.henChay || {};
    const bat = ['anh', 'video', 'nhac'].filter((l) => hg[l] && hg[l].bat && hg[l].lanToi);
    const chH = $('#chipHen');
    chH.hidden = !bat.length && !Object.keys(hc).length;
    chH.classList.toggle('chay', !!Object.keys(hc).length);
    if (!chH.hidden) {
      chH.lastElementChild.textContent = Object.keys(hc).length
        ? `Đang chạy hẹn: ${Object.keys(hc).map((l) => TEN_LOAI[l]).join(', ')}`
        : bat.sort((a, b) => hg[a].lanToi - hg[b].lanToi).slice(0, 2).map((l) => `${TEN_LOAI[l]} ${gioHen(hg[l].lanToi)}`).join(' · ');
    }
    const cn = S.capNhat, c = $('#chipCapNhat');
    const coMoi = cn && ['co-ban-moi', 'dang-tai', 'da-tai'].includes(cn.trangThai) && cn.phienBanMoi;
    c.hidden = !coMoi;
    if (coMoi) c.lastElementChild.textContent = cn.trangThai === 'dang-tai'
      ? `Đang tải bản ${cn.phienBanMoi} · ${cn.tienDo}%` : `Có bản mới ${cn.phienBanMoi}`;
  }

  function veTao() {
    const ds = HD.tachPrompt($('#oPrompt').value, S.caiDat.tachPrompt);
    $('#demPrompt').textContent = `${ds.length} prompt · ${$('#oPrompt').value.length.toLocaleString('vi-VN')} ký tự`;
    // 1.3.0: ô "Chỉ chạy prompt số" (vd 98, 303, 305-350) — báo trước sẽ chạy những số nào.
    const chonSo = $('#chonSo').value, r = HD.docSoChay(chonSo, ds.length), k = HD.chonTheoSo(ds, chonSo);
    $('#ghiKhoang').textContent = ds.length && chonSo.trim()
      ? (k.length ? `Sẽ chạy ${k.length}/${ds.length} prompt: số ${HD.gonSo(r.so)}` : 'Không có số prompt nào hợp lệ') +
        (r.loi.length ? ` · bỏ qua "${r.loi.join(', ')}"` : '') + (r.ngoai.length ? ` · không có prompt số ${HD.gonSo(r.ngoai)}` : '') : '';
    const nen = nenTrang();
    for (const b of $$('#nenTao button')) b.classList.toggle('on', b.dataset.v === nen);
    $('#ghiNen').textContent = nen === 'suno'
      ? `Suno: prompt vào ô Styles (chế độ Advanced, không lời). Mỗi lần Create ra 4 bài — app tải MP3 của bài dài hơn trong 2 bài đầu; tài khoản hết lượt thì tạo lại ở tài khoản Suno dự phòng. ${S.taiKhoan.some((a) => nenTk(a) === 'suno') ? '' : 'Chưa có tài khoản Suno — thêm ở mục Tài khoản.'}`
      : nen === 'flow'
      ? `Google Flow nhận việc theo mẻ (tối đa ${S.caiDat.flow.meToiDa} prompt), chỉ có tỷ lệ 16:9 và 9:16. ${S.taiKhoan.some((a) => nenTk(a) === 'flow') ? '' : 'Chưa có tài khoản Flow — thêm ở mục Tài khoản.'}`
      : `Muse: mỗi prompt một chat mới, ${S.caiDat.luongMoiTK} luồng mỗi tài khoản. ${S.taiKhoan.some((a) => nenTk(a) === 'muse') ? '' : 'Chưa có tài khoản Muse — thêm ở mục Tài khoản.'}`;
    // Flow chỉ có 16:9 / 9:16 → ẩn các tỷ lệ khác (đang chọn tỷ lệ khác thì về 9:16).
    for (const b of $$('#tyLe button')) b.hidden = nen === 'flow' && !TY_LE_FLOW.includes(b.dataset.v);
    if (nen === 'flow' && !TY_LE_FLOW.includes(U.tyLe[loaiTrang()])) {
      U.tyLe[loaiTrang()] = '9:16';
      for (const b of $$('#tyLe button')) b.classList.toggle('on', b.dataset.v === '9:16');
    }
    $('#khuChuoi').hidden = loaiTrang() !== 'anh';
    $('#khuVideoThuMuc').hidden = loaiTrang() !== 'video';
    const tm = TC().thuMuc;
    $('#ghiVideoThuMuc').textContent = tm ? `${tm.anh.length} ảnh trong "${tm.thuMuc.split(/[\\/]/).pop()}" → ${tm.anh.length} video` : 'Chưa chọn';
    $('#batChuoi').checked = U.chuoi.bat;
    $('#khuPromptVideo').hidden = !U.chuoi.bat;
    // 1.2.9: thư mục lưu video nối từ ảnh RIÊNG của dự án đang mở (chưa chọn thì nói rõ đang theo Cài đặt chung).
    const dTm = duAnHienTai(), tmDa = (dTm && dTm.thuMucVideoAnh) || '';
    $('#ghiThuMucVideoDuAn').textContent = tmDa || (S.caiDat.videoCanhAnh !== false ? 'Chưa chọn — lưu cạnh ảnh nguồn, cùng tên (theo Cài đặt)'
      : S.caiDat.thuMucVideoAnh ? `Chưa chọn — theo Cài đặt: ${S.caiDat.thuMucVideoAnh}` : 'Chưa chọn — theo thư mục của trang Tạo video');
    $('#ghiThuMucVideoDuAn').title = tmDa;
    $('#boThuMucVideoDuAn').hidden = !tmDa;
    if (document.activeElement !== $('#luongNhanh')) $('#luongNhanh').value = S.caiDat.luongMoiTK;
    veTaiVe();
    $('#boQuaDaCo').checked = !!S.caiDat.boQuaDaCo;
    $('#quetGhiAnh').hidden = loaiTrang() !== 'anh' || !U.chuoi.bat;
    // 1.4.3: thư mục đã chọn để quét (của loại đang xem, dự án đang mở).
    const tmQuet = (dTm && dTm.thuMucQuet && dTm.thuMucQuet[loaiTrang()]) || '';
    $('#quetDang').textContent = tmQuet ? `Đang quét: ${tmQuet}` : 'Chưa chọn — quét thư mục lưu của dự án';
    $('#quetDang').title = tmQuet;
    $('#boQuet').hidden = !tmQuet;
    $('#tachPrompt').value = S.caiDat.tachPrompt;
    for (const b of $$('#cheDo button')) b.classList.toggle('on', b.dataset.v === U.cheDo);
    $('#khuNguoiMau').hidden = U.cheDo !== 'nguoimau';
    // 1.4.0: chỉ thay khi khác (trước: mỗi lần trạng thái đổi là dựng lại cả ảnh nhân vật / ảnh tham chiếu).
    datHtml($('#chonNhanVat'), S.nhanVat.length ? S.nhanVat.map((n) =>
      `<button class="chip-nv${U.nvChon.has(n.id) ? ' on' : ''}" data-nv="${esc(n.id)}">${n.anh[0] ? `<img src="${esc(fileUrl(n.anh[0]))}">` : ic('user-round')}${esc(n.ten)}</button>`).join('')
      : '<small>Chưa có nhân vật — thêm ở mục Nhân vật.</small>');
    let html = TC().ds.map((p, i) =>
      `<div class="anh-nho" title="${esc(p)}"><img src="${esc(fileUrl(p))}"><button data-bo="${i}">${ic('x')}</button></div>`).join('');
    if (TC().thuMuc) html += `<div class="ghi-thu-muc">${ic('folder-open')}<span>Thư mục: <b>${TC().thuMuc.anh.length} ảnh</b> → gán lần lượt cho từng prompt</span><button class="lien-ket" data-bo-thu-muc>Bỏ</button></div>`;
    if (datHtml($('#dsThamChieu'), html)) veIcon($('#dsThamChieu'));
  }

  const NHAN_BUOC = { 'mo-trang': 'Đang mở Muse', 'mo-lai': 'Mở lại chat cũ', gui: 'Đang gửi prompt', tai: 'Đang tải về' };
  function nhanTrangThai(j) {
    if (j.trangThai === 'xong') return ['xong', 'Hoàn tất', gio(j.xongLuc)];
    if (j.trangThai === 'dung') return ['dung', 'Đã dừng', j.thread ? 'Bấm Chạy để lấy tiếp kết quả' : 'Bấm Chạy để chạy tiếp'];
    if (j.trangThai === 'loi') return ['loi', 'Lỗi', j.loi];
    if (j.trangThai === 'chay') {
      // Muse ghi mã bước (tao, gui…); Flow ghi thẳng chữ bước của engine (Đang dán prompt, Flow đang tạo 40%…).
      const b = j.buoc === 'tao' ? `Muse đang tạo ${j.loai === 'video' ? 'video' : 'ảnh'}` : (NHAN_BUOC[j.buoc] || j.buoc || 'Đang chuẩn bị');
      return ['chay', 'Đang chạy', b];
    }
    return ['cho', 'Đang chờ', j.thread ? 'Sẽ lấy tiếp kết quả' : j.sunoBai && j.loi ? `Tải lại bài đã tạo: ${j.loi}` : (j.loi ? `Thử lại: ${j.loi}` :
      j.uuTienLuc || j.chayRieng ? 'Chạy ngay (lên đầu hàng)' : duAnDangChay(j.duAn) ? 'Trong hàng chờ' : theoHen(j) ? 'Trong hàng chờ — chạy theo hẹn giờ' : 'Trong hàng chờ — dự án chưa chạy')];
  }

  function locViec() {
    const d = duAnHienTai();
    const loai = loaiTrang();
    return S.viec.filter((j) => j.duAn === (d && d.id) && j.loai === loai && (loai === 'nhac' || !U.locNen || (j.nen || 'muse') === U.locNen));
  }

  function veHang() {
    const tatCa = locViec();
    const dem = { tat: tatCa.length, chay: 0, cho: 0, dung: 0, xong: 0, loi: 0 };
    for (const j of tatCa) dem[j.trangThai]++;
    const tabs = [['tat', 'Tất cả'], ['chay', 'Đang chạy'], ['cho', 'Đang chờ'], ['dung', 'Đã dừng'], ['xong', 'Hoàn tất'], ['loi', 'Lỗi']]
      .filter(([k]) => k === 'tat' || dem[k] > 0 || U.loc === k);
    datHtml($('#tabsLoc'), tabs.map(([k, t]) => `<button data-loc="${k}" class="${U.loc === k ? 'on' : ''}">${t} <b>${dem[k]}</b></button>`).join(''));
    $('#nutSapXep').lastElementChild.textContent = U.moiNhat ? 'Mới nhất' : 'Cũ nhất';
    $('#locNen').value = U.locNen || '';

    const tim = U.tim.trim().toLowerCase().replace(/^#/, '');
    let ds = tatCa.filter((j) => (U.loc === 'tat' || j.trangThai === U.loc) &&
      (!tim || String(j.so) === tim.replace(/^0+/, '') || j.prompt.toLowerCase().includes(tim)));
    ds.sort((a, b) => (U.moiNhat ? b.so - a.so : a.so - b.so));
    for (const id of [...U.chon]) if (!tatCa.some((j) => j.id === id)) U.chon.delete(id);
    $('#thanhChon').hidden = !U.chon.size;
    $('#soChon').textContent = `${U.chon.size} đã chọn`;
    // "Chọn tất cả" = mọi việc đang hiện theo bộ lọc / ô tìm.
    U.dsLoc = ds.map((j) => j.id);
    const soChonTrongLoc = U.dsLoc.filter((id) => U.chon.has(id)).length;
    $('#chonHet').checked = !!ds.length && soChonTrongLoc === ds.length;
    $('#chonHet').indeterminate = soChonTrongLoc > 0 && soChonTrongLoc < ds.length;

    const hop = $('#dsHang');
    if (!ds.length) {
      datHtmlHop(hop, `<div class="trong">${ic(ICON_LOAI[loaiTrang()])}<div>${tatCa.length
        ? 'Không có việc nào khớp bộ lọc.' : 'Hàng đợi trống — dán prompt bên trái rồi bấm <b>Tạo &amp; chạy</b>.'}</div></div>`);
      return;
    }
    const cuon = hop.scrollTop;
    const MAX = 600;   // vẽ tối đa 600 dòng; nhiều hơn thì dùng ô tìm
    if (veTheoDong(hop, ds.slice(0, MAX).map((j) => ({ khoa: j.id, html: dongViec(j) })),
      ds.length > MAX ? `<div class="trong" style="min-height:60px">Còn ${ds.length - MAX} việc nữa — dùng ô tìm để lọc.</div>` : '')) hop.scrollTop = cuon;
    capNhatTienDo();
  }

  function thumbHtml(j) {
    const f = j.files && j.files[0];
    if (f && j.loai === 'video') return `<div class="thumb">${ic('film')}${anhVideoHtml(f, `${f}|${j.xongLuc || ''}`)}</div>`;
    if (j.loai === 'nhac') return `<div class="thumb">${ic('music')}</div>`;
    if (f) return `<div class="thumb"><img loading="lazy" src="${esc(fileUrl(f))}"></div>`;
    if (j.thamChieu && j.thamChieu[0]) return `<div class="thumb"><img loading="lazy" style="opacity:.45" src="${esc(fileUrl(j.thamChieu[0]))}"></div>`;
    return `<div class="thumb">${ic(j.loai === 'video' ? 'film' : 'image')}</div>`;
  }

  function dongViec(j) {
    const [cls, nhan, phu] = nhanTrangThai(j);
    const chay = j.trangThai === 'chay';
    return `<div class="dong-viec${U.chiTiet === j.id ? ' chon' : ''}" data-id="${j.id}">
      <input type="checkbox" data-chon ${U.chon.has(j.id) ? 'checked' : ''}>
      <span class="so">#${so3(j.so)}</span>
      ${thumbHtml(j)}
      <div class="noi-dung">
        <div class="p" title="${esc(j.prompt)}">${j.so}. ${esc(j.prompt)}</div>
        <div class="the-nho"><span class="tag nen-${nenTk(j)}">${nenTk(j).toUpperCase()}</span><span class="tag">${{ video: 'VIDEO', nhac: 'NHẠC' }[j.loai] || 'ẢNH'}</span>${j.loai === 'nhac' ? '' : `<span class="tag">${esc(j.tyLe)}</span>`}${
          j.nhanVat && j.nhanVat.length ? `<span class="tag nv">${j.nhanVat.length} NV</span>` : ''}${
          j.tuAnh ? `<span class="tag nv" title="Video tạo từ ảnh">TỪ ẢNH</span>` : ''}${
          j.chuoi && !j.daNoiVideo ? `<span class="tag nv" title="Ảnh xong sẽ tự tạo video">→ VIDEO ${(j.chuoi.nen || j.nen) === 'flow' ? 'FLOW' : 'MUSE'}</span>` : ''}${
          chay ? `<div class="thanh-tien"><div style="width:0%"></div></div><span class="phan-tram">0%</span>` : ''}</div>
      </div>
      <div class="trang-thai"><span class="pill ${cls}">${nhan}</span><small title="${esc(phu)}">${esc(phu)}</small></div>
      <div class="nut-dong-viec">${nutDieuKhien(j)}<button class="ba-cham" data-menu title="Thêm">${ic('ellipsis-vertical')}</button></div>
    </div>`;
  }
  /** 1.3.0: nút Dừng (việc đang chạy / đang chờ) hoặc Chạy (việc đã dừng / lỗi / còn chờ khi dự án chưa chạy) của riêng một việc. */
  function nutDieuKhien(j) {
    if (j.trangThai === 'chay' || (j.trangThai === 'cho' && (duAnDangChay(j.duAn) || j.chayRieng || theoHen(j)))) {
      return `<button class="nut-dk dung" data-dk="dungViec" title="Dừng riêng việc này — việc khác vẫn chạy">${ic('square')}</button>`;
    }
    if (j.trangThai === 'cho' || j.trangThai === 'dung' || j.trangThai === 'loi') {
      return `<button class="nut-dk chay" data-dk="chayViec" title="${j.trangThai === 'loi' ? 'Tạo lại và chạy ngay việc này' : 'Chạy ngay việc này'}">${ic('play')}</button>`;
    }
    return '';
  }

  function capNhatTienDo() {
    if (!S) return;
    const now = Date.now();
    for (const el of $$('#dsHang .dong-viec')) {
      const j = viecTheoId(+el.dataset.id);
      if (!j || j.trangThai !== 'chay') continue;
      const p = HD.tienDoUoc(j, now, S.duKien[j.loai] || 40);
      const bar = $('.thanh-tien div', el), pt = $('.phan-tram', el);
      if (bar) bar.style.width = p + '%';
      if (pt) pt.textContent = p + '%';
    }
  }

  function veChiTiet() {
    const j = viecTheoId(U.chiTiet);
    const hop = $('#chiTiet');
    if (!j) {
      datHtml(hop, `<div class="xem-truoc trong"><div class="trong">${ic('sparkles')}<div>Chọn một dòng trong hàng đợi để xem kết quả.</div></div></div>`);
      return;
    }
    const f = j.files && j.files[0];
    const xem = f
      ? (j.loai === 'video' ? `<video src="${esc(fileUrl(f))}" controls loop></video>`
        : j.loai === 'nhac' ? `<div class="nhac">${ic('music')}<audio src="${esc(fileUrl(f))}" controls preload="metadata"></audio></div>` : `<img src="${esc(fileUrl(f))}">`)
      : `<div class="trong">${ic(ICON_LOAI[j.loai] || 'image')}<div>${j.trangThai === 'chay' ? `${TEN_NEN[nenTk(j)]} đang tạo…` : j.trangThai === 'loi' ? 'Chưa có kết quả' : j.trangThai === 'dung' ? 'Đã dừng — bấm Chạy ngay để chạy tiếp' : 'Đang chờ đến lượt'}</div></div>`;
    const [cls, nhan] = nhanTrangThai(j);
    datHtml(hop, `
      <div class="xem-truoc">${xem}</div>
      <div class="ct-prompt">${j.so}. ${esc(j.prompt)}</div>
      <div class="ct-meta">#${so3(j.so)} · ${TEN_NEN[nenTk(j)]}${j.taiKhoan ? ` (${esc(tenTk(j.taiKhoan))})` : ''} · ${esc(gio(j.xongLuc || j.taoLuc))}${f && j.files.length > 1 ? ` · ${j.files.length} file` : ''}${j.tam ? ' · không tải về (chỉ trong app)' : ''}</div>
      <span class="pill ${cls}">${nhan}</span>
      ${j.loi && j.trangThai !== 'xong' ? `<div class="ct-loi">${esc(j.loi)}</div>` : ''}
      <div class="ct-nut">
        <button class="nut-vien" data-ct="xem" ${f ? '' : 'disabled'}>${ic('maximize-2')}${j.loai === 'anh' ? 'Xem' : 'Phát'}</button>
        <button class="nut-vien" data-ct="thuMuc" ${f ? '' : 'disabled'}>${ic('folder')}Thư mục</button>
        <button class="nut-vien do" data-ct="xoa">${ic('x')}Xoá</button>
      </div>
      ${j.trangThai === 'chay' || j.trangThai === 'cho' || j.trangThai === 'dung' || j.trangThai === 'loi' ? `<div class="ct-nut" style="grid-template-columns:1fr 1fr">
        <button class="nut-vien" data-ct="chayViec" ${['cho', 'dung', 'loi'].includes(j.trangThai) ? '' : 'disabled'}>${ic('play')}Chạy ngay</button>
        <button class="nut-vien" data-ct="dungViec" ${j.trangThai === 'chay' || j.trangThai === 'cho' ? '' : 'disabled'}>${ic('square')}Dừng</button>
      </div>` : ''}
      <div class="ct-dau"><span>Prompt</span><button class="nut-icon" data-ct="chep" title="Sao chép prompt">${ic('copy')}</button></div>
      <div class="ct-text">${esc(j.prompt)}</div>
      ${j.thamChieu && j.thamChieu.length ? `<div class="ct-dau"><span>Ảnh đính kèm</span></div><div class="ds-tham-chieu">${j.thamChieu.map((p) => `<div class="anh-nho"><img src="${esc(fileUrl(p))}"></div>`).join('')}</div>` : ''}
      <div class="ct-nut">
        <button class="nut-vien" data-ct="tai" ${f ? '' : 'disabled'}>${ic('download')}Tải xuống</button>
        <button class="nut-vien" data-ct="taoLai" ${j.trangThai === 'chay' ? 'disabled' : ''}>${ic('rotate-ccw')}Tạo lại</button>
        <button class="nut-gradient" data-ct="sua" ${j.trangThai === 'chay' ? 'disabled' : ''}>${ic('wand-sparkles')}${j.loai === 'anh' ? 'Chỉnh sửa' : 'Sửa'}</button>
      </div>
      ${f && j.loai === 'anh' ? `<div class="ct-nut" style="grid-template-columns:1fr"><button class="nut-vien" data-ct="video">${ic('film')}Tạo video từ ảnh này</button></div>` : ''}
      ${j.loai !== 'nhac' ? `<div class="ct-nut" style="grid-template-columns:${f && j.trangThai === 'xong' ? '1fr 1fr' : '1fr'}"><button class="nut-vien" data-ct="doiNen">${ic('arrow-left-right')}Đổi sang ${nenTk(j) === 'flow' ? 'Muse' : 'Flow'} &amp; chạy ngay</button>${
        f && j.trangThai === 'xong' ? `<button class="nut-vien" data-ct="lenDrive" title="${esc(j.drive && j.drive[0] ? `Đã có trên Drive: ${j.drive[0]}` : j.driveLoi || 'Chép file lên thư mục Google Drive (Cài đặt → Google Drive)')}">${ic('cloud-upload')}${j.drive && j.drive.length ? 'Đưa lại lên Drive' : 'Lên Drive'}</button>` : ''}</div>` : ''}`);
  }

  // ── Hành động trên việc ──────────────────────────────────────────────────
  async function hanhDong(lenh, j) {
    const f = j.files && j.files[0];
    if (lenh === 'xem' && f) moXemLon(f, j.loai);
    else if (lenh === 'thuMuc' && f) api.call('hienTrongThuMuc', { file: f });
    else if (lenh === 'tai' && f) { const r = await api.call('luuBanSao', { file: f }); if (r && r.ok) toast('Đã lưu bản sao'); }
    else if (lenh === 'chep') { await navigator.clipboard.writeText(j.prompt); toast('Đã sao chép prompt'); }
    else if (lenh === 'taoLai') {
      if (j.trangThai === 'xong' && !(await xacNhan('Tạo lại?', `Việc #${so3(j.so)} sẽ chạy lại từ đầu (gửi prompt mới), kết quả mới ghi đè file cũ.`, 'Tạo lại'))) return;
      await api.call('taoLai', { ids: [j.id], chay: true });
      toast(`Đã tạo lại #${so3(j.so)} và chạy ngay`);
    } else if (lenh === 'dungViec' || lenh === 'chayViec') {
      dieuKhienViec(lenh, [j.id]);
    } else if (lenh === 'doiNen') {
      doiNen([j.id], nenTk(j) === 'flow' ? 'muse' : 'flow');
    } else if (lenh === 'lenDrive') {
      lenDrive([j.id]);
    } else if (lenh === 'xoa') {
      if (!(await xacNhan('Xoá việc?', `Xoá #${so3(j.so)} khỏi hàng đợi. File đã tải về vẫn giữ trong thư mục.`, 'Xoá', true))) return;
      await api.call('xoaViec', { ids: [j.id] });
      if (U.chiTiet === j.id) U.chiTiet = null;
    } else if (lenh === 'sua') {
      if (j.trangThai === 'xong' && j.loai === 'anh' && f) {
        const v = await hoi({ tieuDe: `Chỉnh sửa ảnh #${so3(j.so)}`, ok: 'Tạo & chạy',
          html: `<p>Muse sẽ nhận ảnh này làm tham chiếu và sửa theo yêu cầu (tạo thành việc mới).</p>
                 <label>Yêu cầu chỉnh sửa<textarea name="yc" rows="4" placeholder="vd: đổi nền thành bãi biển, giữ nguyên nhân vật"></textarea></label>` });
        if (!v || !v.yc.trim()) return;
        const r = await api.call('them', { duAn: j.duAn, nen: j.nen, loai: 'anh', prompts: [v.yc.trim()], tyLe: j.tyLe, thamChieu: [f], chay: true });
        if (r && r.ok) toast('Đã thêm việc chỉnh sửa'); else toast((r && r.loi) || 'Không thêm được', true);
      } else {
        const v = await hoi({ tieuDe: `Sửa prompt #${so3(j.so)}`, ok: 'Lưu',
          html: `<label>Prompt<textarea name="p" rows="6">${esc(j.prompt)}</textarea></label>` + (j.loai === 'nhac' ? ''
            : `<label>Tỷ lệ<select name="t">${HD.TY_LE.map((t) => `<option ${t === j.tyLe ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`) });
        if (!v) return;
        await api.call('suaViec', { id: j.id, thay: { prompt: v.p, tyLe: v.t || j.tyLe } });
        if (j.trangThai !== 'cho' && await xacNhan('Chạy lại?', 'Đưa việc này về hàng chờ để tạo lại với prompt mới?', 'Tạo lại')) {
          await api.call('taoLai', { ids: [j.id] });
        }
      }
    } else if (lenh === 'video' && f) {
      U.tc.video = { ds: [f], thuMuc: null };
      U.tyLe.video = j.tyLe;
      diToi('video');
      $('#oPrompt').focus();
      toast(`Đã gắn ảnh #${so3(j.so)} làm khung đầu — nhập mô tả chuyển động rồi bấm Tạo & chạy`);
    }
  }

  /** Dừng / chạy riêng các việc (nút ở dòng việc, thanh chọn, chi tiết, menu ⋯). */
  async function dieuKhienViec(lenh, ids) {
    if (!ids.length) return;
    const n = await api.call(lenh, { ids });
    if (lenh === 'dungViec') toast(n ? `Đã dừng ${n} việc — việc khác vẫn chạy` : 'Không có việc nào đang chạy / chờ để dừng', !n);
    else toast(n ? `Đang chạy ngay ${n} việc` : 'Không có việc nào chạy được (việc đã xong thì dùng Tạo lại)', !n);
  }

  /** 1.4.0: đổi ngay các việc sang Muse / Flow rồi chạy luôn (việc đang chạy dừng ở bên cũ, việc đã xong tạo lại). */
  async function doiNen(ids, nen) {
    const ds = ids.map(viecTheoId).filter((j) => j && j.loai !== 'nhac');
    const doi = ds.filter((j) => nenTk(j) !== nen);
    if (!doi.length) { toast(ds.length ? `Các việc đã chọn đều đang chạy ở ${TEN_NEN[nen]}` : 'Việc nhạc chỉ chạy ở Suno', true); return; }
    const xong = doi.filter((j) => j.trangThai === 'xong').length, chay = doi.filter((j) => j.trangThai === 'chay').length;
    const tyLeKhac = nen === 'flow' && doi.some((j) => !TY_LE_FLOW.includes(j.tyLe));
    if ((xong || chay || tyLeKhac || doi.length > 1) && !(await xacNhan(`Đổi ${doi.length} việc sang ${TEN_NEN[nen]}?`,
      `Các việc này chạy ngay ở <b>${TEN_NEN[nen]}</b> (gửi prompt mới từ đầu, ảnh tham chiếu giữ nguyên).` +
      (chay ? `<br>• ${chay} việc đang chạy sẽ dừng ở bên cũ.` : '') +
      (xong ? `<br>• ${xong} việc đã xong sẽ được tạo lại ở ${TEN_NEN[nen]} — file mới ghi đè file cũ của chính việc đó.` : '') +
      (tyLeKhac ? '<br>• Flow chỉ có 16:9 và 9:16 — tỷ lệ khác dùng tỷ lệ gần nhất.' : '') +
      (ds.length > doi.length ? `<br>• ${ds.length - doi.length} việc đã ở ${TEN_NEN[nen]} giữ nguyên.` : ''), `Đổi sang ${TEN_NEN[nen]}`))) return;
    const r = await api.call('doiNenViec', { ids: doi.map((j) => j.id), nen });
    if (r && r.khongTk && r.khongTk.length && !r.doi) { toast(`Dự án chưa có tài khoản ${TEN_NEN[nen]} dùng được — bấm nút tài khoản cạnh tên dự án`, true); return; }
    toast(r && r.doi ? `Đã đổi ${r.doi} việc sang ${TEN_NEN[nen]} và chạy ngay${r.khongTk && r.khongTk.length ? ` · dự án ${r.khongTk.join(', ')} chưa có tài khoản ${TEN_NEN[nen]}` : ''}` : 'Không đổi được việc nào', !(r && r.doi));
  }
  async function lenDrive(ids) {
    const r = await api.call('lenDriveViec', { ids });
    if (!r || !r.ok) { toast((r && r.loi) || 'Không đưa lên Drive được', true); return; }
    toast(r.so ? `Đang đưa ${r.so} việc lên Google Drive… (xem Nhật ký)${r.boQua ? ` · bỏ qua ${r.boQua} việc chưa xong / không có file` : ''}` : 'Không có việc ảnh / video nào đã xong để đưa lên Drive', !r.so);
  }
  /** 1.4.0: đổi prompt của mọi việc đã chọn (Chọn hết → Đổi prompt). */
  async function doiPromptNhieu(ids) {
    const ds = ids.map(viecTheoId).filter(Boolean);
    if (!ds.length) return;
    const coChuoi = ds.some((j) => j.loai === 'anh' && j.chuoi && !j.daNoiVideo);
    const giong = ds.every((j) => j.prompt === ds[0].prompt) ? ds[0].prompt : '';
    const dangChay = ds.filter((j) => j.trangThai === 'chay').length;
    const v = await hoi({ tieuDe: `Đổi prompt ${ds.length} việc đã chọn`, ok: 'Đổi prompt', html:
      (coChuoi ? `<label>Đổi prompt nào<select name="dich"><option value="viec">Prompt của việc (ảnh)</option><option value="chuoi">Prompt video sẽ tự tạo từ ảnh (ảnh chưa tạo video)</option></select></label>` : '') +
      `<label>Cách đổi<select name="cach" data-doi-cach><option value="thay">Thay cả prompt bằng prompt mới</option><option value="tim">Tìm và thay một đoạn chữ</option></select></label>
      <div data-cach="thay"><label>Prompt mới (mọi việc đã chọn dùng chung)<textarea name="moi" rows="5" spellcheck="false">${esc(giong)}</textarea></label></div>
      <div data-cach="tim" hidden><label>Tìm đoạn chữ<input name="tim" spellcheck="false"></label><label>Thay bằng<input name="thay" spellcheck="false" placeholder="trống = xoá đoạn chữ đó"></label><small>Phân biệt chữ hoa / thường.</small></div>
      <label class="hang-tk"><input type="checkbox" name="taoLai">Việc đã xong / lỗi / đã dừng: tạo lại và chạy ngay với prompt mới</label>
      <small>${dangChay ? `${dangChay} việc đang chạy giữ prompt cũ (bấm Dừng trước nếu muốn đổi). ` : ''}Việc đang chờ dùng prompt mới khi tới lượt.</small>` });
    if (!v) return;
    const r = await api.call('doiPrompt', { ids: ds.map((j) => j.id), cach: v.cach, dich: v.dich || 'viec', moi: v.moi, tim: v.tim, thay: v.thay, taoLai: v.taoLai });
    if (!r || !r.ok) { toast((r && r.loi) || 'Không đổi được prompt', true); return; }
    toast(r.doi ? `Đã đổi prompt ${r.doi} việc${r.taoLai ? `, tạo lại ${r.taoLai} việc` : ''}${r.dangChay ? ` · ${r.dangChay} việc đang chạy giữ nguyên` : ''}` : 'Không việc nào đổi (prompt giống cũ, hoặc không tìm thấy đoạn chữ)', !r.doi);
  }

  function moMenuDong(nut, j) {
    dongMenu();
    const f = j.files && j.files[0];
    const m = document.createElement('div');
    m.className = 'menu menu-dong';
    m.innerHTML = [
      f ? `<button data-l="xem">${ic('eye')}Xem</button><button data-l="thuMuc">${ic('folder-open')}Mở thư mục</button>` : '',
      j.trangThai === 'chay' || j.trangThai === 'cho' ? `<button data-l="dungViec">${ic('square')}Dừng việc này</button>` : '',
      ['cho', 'dung', 'loi'].includes(j.trangThai) ? `<button data-l="chayViec">${ic('play')}Chạy ngay việc này</button>` : '',
      j.trangThai !== 'chay' ? `<button data-l="taoLai">${ic('rotate-ccw')}Tạo lại</button><button data-l="sua">${ic('pencil')}${f && j.loai === 'anh' ? 'Chỉnh sửa ảnh' : 'Sửa prompt'}</button>` : '',
      f && j.loai === 'anh' ? `<button data-l="video">${ic('film')}Tạo video từ ảnh này</button>` : '',
      // 1.4.0: đổi ngay sang bên kia rồi chạy luôn; đưa kết quả lên Google Drive.
      j.loai !== 'nhac' ? `<button data-l="doiNen">${ic('arrow-left-right')}Đổi sang ${nenTk(j) === 'flow' ? 'Muse' : 'Flow'} &amp; chạy ngay</button>` : '',
      f && j.trangThai === 'xong' && j.loai !== 'nhac' ? `<button data-l="lenDrive">${ic('cloud-upload')}Đưa lên Google Drive</button>` : '',
      `<button data-l="chep">${ic('copy')}Sao chép prompt</button><div class="tach"></div><button data-l="xoa" class="do">${ic('trash-2')}Xoá</button>`
    ].join('');
    document.body.appendChild(m);
    const r = nut.getBoundingClientRect();
    const h = m.offsetHeight, w = m.offsetWidth;
    m.style.left = Math.max(8, r.right - w) + 'px';
    m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4) + 'px';
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]');
      if (!b) return;
      dongMenu();
      hanhDong(b.dataset.l, j);
    });
  }
  function dongMenu() {
    for (const m of $$('.menu-dong')) m.remove();
    for (const m of ['#menuDuAn', '#menuDuAnThem', '#menuTao', '#menuMau']) $(m).hidden = true;
  }

  function moXemLon(f, loai) {
    $('#xemLonNoiDung').innerHTML = loai === 'video' ? `<video src="${esc(fileUrl(f))}" controls autoplay loop></video>`
      : loai === 'nhac' ? `<audio src="${esc(fileUrl(f))}" controls autoplay></audio>` : `<img src="${esc(fileUrl(f))}">`;
    $('#xemLon').hidden = false;
  }

  // ── Tạo việc ─────────────────────────────────────────────────────────────
  /**
   * Mọi tuỳ chọn của cột Tạo (trừ danh sách prompt và dự án) — dùng chung cho "Tạo & chạy"
   * và "Nhập nhiều file .txt". hoiLech: hỏi khi số ảnh trong thư mục lệch số prompt.
   * Trả null nếu người dùng huỷ hoặc thiếu thông tin.
   */
  async function thamSoTao(prompts, hoiLech) {
    const loai = loaiTrang();
    let chuoi = null;
    if (loai === 'anh' && U.chuoi.bat) {
      if (!U.chuoi.prompt.trim()) { toast('Đang bật "Ảnh xong → tự tạo video" nhưng chưa nhập prompt video', true); $('#promptVideoChung').focus(); return null; }
      chuoi = { prompt: U.chuoi.prompt, tyLe: U.chuoi.tyLe, nen: U.chuoi.nen || nenTrang() };
    }
    let theoDong = null;
    if (TC().thuMuc) {
      const n = TC().thuMuc.anh.length;
      if (hoiLech && n !== prompts.length && !(await xacNhan('Số ảnh và số prompt lệch nhau',
        `Thư mục có <b>${n}</b> ảnh nhưng có <b>${prompts.length}</b> prompt. Ảnh được gán lần lượt theo thứ tự; ${n < prompts.length ? 'prompt thừa sẽ không có ảnh' : 'ảnh thừa bị bỏ qua'}.`, 'Vẫn tạo'))) return null;
      theoDong = prompts.map((_, i) => (TC().thuMuc.anh[i] ? [TC().thuMuc.anh[i]] : []));
    }
    const nen = nenTrang();
    if (!S.taiKhoan.some((a) => nenTk(a) === nen)) { toast(`Chưa có tài khoản ${TEN_NEN[nen]} — vào mục Tài khoản để thêm và đăng nhập`, true); return null; }
    // Nhạc Suno: chỉ prompt (ô Styles) — không ảnh, nhân vật, tỷ lệ hay chuỗi video.
    if (loai === 'nhac') return { nen, loai, soBan: $('#soBan').value, hauTo: $('#hauTo').value, chonSo: $('#chonSo').value, boQuaDaCo: $('#boQuaDaCo').checked };
    return {
      nen, loai, tyLe: U.tyLe[loai], thamChieu: TC().ds, thamChieuTheoDong: theoDong,
      nhanVatIds: U.cheDo === 'nguoimau' ? [...U.nvChon] : [], tuNhanVat: $('#tuNhanVat').checked,
      soBan: $('#soBan').value, hauTo: $('#hauTo').value, chonSo: $('#chonSo').value,
      chuoiVideo: chuoi, boQuaDaCo: $('#boQuaDaCo').checked
    };
  }

  /** Danh sách prompt của cột Tạo (video từ thư mục ảnh: mỗi ảnh một prompt chung). */
  function promptCotTao() {
    const loai = loaiTrang();
    let prompts = HD.tachPrompt($('#oPrompt').value, $('#tachPrompt').value);
    // Video từ thư mục ảnh: ô prompt dùng chung (hoặc ô Prompt có 0–1 prompt) → mỗi ảnh một video cùng prompt.
    const chung = U.promptThuMuc.trim();
    if (loai === 'video' && TC().thuMuc && (chung || prompts.length <= 1)) {
      const p0 = chung || prompts[0] || HD.PROMPT_VIDEO_MAC_DINH;
      prompts = TC().thuMuc.anh.map(() => p0);
    }
    return prompts;
  }

  /** 1.4.2: xem trước số nào đã có file trong thư mục lưu, số nào còn thiếu. */
  /** 1.4.3: bấm "Quét thư mục…" → chọn thư mục đang có file đánh số làm dở → quét đúng thư mục đó (file mới cũng lưu vào
   *  đó, công tắc "Bỏ qua số đã có file" tự bật). Có prompt thì nói luôn số nào sẽ làm; chưa có thì tóm tắt thư mục. */
  async function quetThuMuc() {
    const loai = loaiTrang(), ten = TEN_LOAI[loai];
    const ch = await api.call('chonThuMucQuet', { duAn: U.duAn, loai });
    if (!ch) return;
    const prompts = promptCotTao();
    const ts = prompts.length ? await thamSoTao(prompts, false) : { loai };
    if (!ts) return;
    $('#ghiQuet').textContent = 'Đang quét…';
    const q = await api.call('quetDaCo', { ...ts, loai: ts.loai || loai, duAn: U.duAn, prompts });
    if (!q || !q.ok) { $('#ghiQuet').textContent = (q && q.loi) || 'Không quét được'; return; }
    const xem = (a) => { const g = HD.gonSo(a).split(', '); return g.slice(0, 15).join(', ') + (g.length > 15 ? '…' : ''); };
    const cao = q.soCo.length ? q.soCo[q.soCo.length - 1] : 0;
    const dong = [q.soCo.length
      ? `Thư mục có ${q.soCo.length} ${ten} đánh số (số ${q.soCo[0]}–${cao})` + (q.lo.length ? `, bị sót ${q.lo.length} số: ${xem(q.lo)}.` : ', không sót số nào.')
      : `Thư mục chưa có ${ten} nào đánh số.`];
    if (prompts.length) {
      const sot = q.thieu.filter((n) => n < cao), moi = q.thieu.filter((n) => n > cao), v = q.chiVideo.map((x) => x.stt);
      const lam = q.thieu.length + v.length;
      dong.push(lam
        ? `Bấm Tạo sẽ làm ${lam} số` + (sot.length ? ` — bị sót ${sot.length} (${xem(sot)})` : '') + (moi.length ? `${sot.length ? ', rồi' : ' —'} làm tiếp ${moi.length} prompt chưa làm (${xem(moi)})` : '') +
          (v.length ? ` + ${v.length} video từ ảnh có sẵn (${xem(v)})` : '') + `; bỏ qua ${q.coSan.length + q.dangCho.length} số đã có${q.dangCho.length ? ' / đang chờ' : ''}.`
        : `Mọi prompt đã có ${ten} trong thư mục${q.dangCho.length ? ' hoặc đang chờ' : ''} — không còn số nào cần làm.`);
    } else dong.push(`Dán đủ prompt (cả số đã làm) rồi bấm Tạo: app chỉ làm số còn thiếu, rồi làm tiếp prompt chưa làm.`);
    dong.push(q.tai ? `File mới lưu: ${q.viDu}` : `"Tải ${ten} về" đang tắt: file mới không lưu vào thư mục này (bật lại ở Cài đặt nâng cao nếu cần).`);
    if (ch.doiMau) dong.push(ch.doiMau);
    $('#ghiQuet').textContent = dong.join(' ');
    $('#ghiQuet').title = `Thư mục: ${q.thuMuc}\nSố có file: ${HD.gonSo(q.soCo) || '—'}\nBị sót: ${HD.gonSo(q.lo) || '—'}` +
      (prompts.length ? `\nSẽ làm: ${HD.gonSo(q.thieu) || '—'}\nĐang chờ: ${HD.gonSo(q.dangCho) || '—'}` : '');
  }

  async function taoViec(chay) {
    const loai = loaiTrang();
    const prompts = promptCotTao();
    if (!prompts.length) { toast('Chưa có prompt nào', true); $('#oPrompt').focus(); return; }
    const ts = await thamSoTao(prompts, true);
    if (!ts) return;
    const r = await api.call('them', { ...ts, duAn: U.duAn, prompts, chay });
    if (!r || !r.ok) { toast((r && r.loi) || 'Không thêm được', true); return; }
    $('#oPrompt').value = ''; U.nhap[loai] = ''; luuUi();
    U.loc = 'tat';
    toast(`Đã thêm ${r.so} việc ${TEN_NEN[ts.nen]}${r.boQua ? ` (bỏ qua ${r.boQua} số đã có)` : ''}${chay ? ' và bắt đầu chạy' : ' vào hàng đợi'}${ts.chuoiVideo ? ` — ảnh xong sẽ tự tạo video ở ${TEN_NEN[ts.chuoiVideo.nen]}` : ''}`);
  }

  /** Đặt lại hàng đợi đang xem (dự án + ảnh/video) về Chờ như lúc mới thêm — dùng chung "Tạo lại". */
  async function datLaiHangDoi() {
    const loai = loaiTrang();
    const ds = S.viec.filter((j) => j.duAn === U.duAn && j.loai === loai);
    const ids = ds.filter((j) => j.trangThai !== 'chay').map((j) => j.id);
    const chay = ds.length - ids.length;
    if (!ids.length) { toast(chay ? 'Các việc đang chạy — bấm Dừng trước rồi đặt lại' : 'Hàng đợi trống', true); return; }
    const d = S.duAn.find((x) => x.id === U.duAn);
    if (!(await xacNhan('Đặt lại hàng đợi?',
      `Đưa <b>${ids.length}</b> việc ${TEN_LOAI[loai]} của dự án <b>${esc(d ? d.ten : '')}</b> về <b>Chờ</b> như lúc mới thêm. ` +
      'Bấm chạy là tạo lại từ đầu (gửi prompt mới); kết quả mới ghi đè file cũ cùng tên.' +
      (chay ? `<br><br>Bỏ qua ${chay} việc đang chạy.` : ''), 'Đặt lại'))) return;
    const n = await api.call('taoLai', { ids });
    U.loc = 'tat';
    toast(`Đã đặt lại ${n} việc về Chờ`);
  }

  /** Nhiều file .txt → mỗi file một dự án (tên theo tên file), cùng tuỳ chọn cột Tạo, rồi chạy. */
  async function nhapNhieuFile() {
    const ds = ((await api.call('nhapNhieuFile')) || [])
      .map((f) => ({ ...f, prompts: HD.tachPrompt(f.noiDung, $('#tachPrompt').value) }));
    if (!ds.length) return;
    const rong = ds.filter((f) => !f.prompts.length);
    const dung = ds.filter((f) => f.prompts.length);
    if (!dung.length) { toast('Các file chọn đều không có prompt nào', true); return; }
    const k = (f) => HD.chonTheoSo(f.prompts, $('#chonSo').value).length;
    const tong = dung.reduce((n, f) => n + k(f), 0);
    const ok = await xacNhan(`Tạo ${dung.length} dự án mới?`,
      `Mỗi file thành một dự án (tên theo tên file) với tuỳ chọn đang chọn ở cột ${TEN_TRANG[loaiTrang()]}, tổng <b>${tong}</b> ${TEN_LOAI[loaiTrang()]}:<br>` +
      dung.map((f) => `• <b>${esc(f.ten)}</b> — ${k(f)} prompt`).join('<br>') +
      (rong.length ? `<br><br>Bỏ qua (không có prompt): ${rong.map((f) => esc(f.ten)).join(', ')}` : ''), 'Tạo & chạy');
    if (!ok) return;
    const chung = await thamSoTao([], false);
    if (!chung) return;
    let dau = null, soViec = 0;
    const moi = [];
    const dh = duAnHienTai();   // dự án mới chạy trên đúng tài khoản đã chọn cho dự án đang mở (chưa chọn thì thôi)
    const tkMoi = dh && dh.taiKhoan && dh.taiKhoan.length ? dh.taiKhoan : undefined;
    for (const f of dung) {
      const d = await api.call('taoDuAn', { ten: f.ten, taiKhoan: tkMoi, chaySong: dh && dh.chaySong, tuDuAn: (dh && dh.id) || '', boLoai: dh && dh.boLoai });
      if (!d || !d.id) continue;
      dau = dau || d.id;
      moi.push(d.id);
      const theoDong = TC().thuMuc ? f.prompts.map((_, i) => (TC().thuMuc.anh[i] ? [TC().thuMuc.anh[i]] : [])) : null;
      const r = await api.call('them', { ...chung, thamChieuTheoDong: theoDong, duAn: d.id, prompts: f.prompts, chay: false });
      if (r && r.ok) soViec += r.so;
      else toast(`"${f.ten}": ${(r && r.loi) || 'không thêm được'}`, true);
    }
    if (!soViec) return;
    if (dau) { U.duAn = dau; U.chiTiet = null; U.chon.clear(); U.loc = 'tat'; luuUi(); }
    for (const id of moi) await api.call('chay', { duAn: id });   // chỉ chạy các dự án vừa tạo, dự án khác giữ nguyên
    toast(`Đã tạo ${dung.length} dự án, ${soViec} việc và bắt đầu chạy`);
  }

  function themThamChieu(ds) {
    const anh = ds.filter((p) => /\.(png|jpe?g|webp)$/i.test(p));
    if (!anh.length) { toast('Chỉ nhận ảnh png, jpg, webp', true); return; }
    for (const p of anh) if (!TC().ds.includes(p)) TC().ds.push(p);
    veTao();
  }

  // ── Nhân vật ─────────────────────────────────────────────────────────────
  function veNhanVat() {
    const hop = $('#dsNhanVat');
    if (!S.nhanVat.length) {
      hop.innerHTML = `<div class="trong" style="grid-column:1/-1">${ic('user-plus')}<div>Chưa có nhân vật. Bấm <b>Thêm nhân vật</b>, đặt tên (vd: Lan) và chọn 1–4 ảnh rõ mặt.</div></div>`;
      return;
    }
    datHtml(hop, S.nhanVat.map((n) => `<div class="the-nv">
      <div class="anhs">${n.anh.slice(0, 4).map((p) => `<img src="${esc(fileUrl(p))}">`).join('') || ''}</div>
      <h4>${esc(n.ten)}</h4><p>${esc(n.moTa || '')}</p>
      <div class="hang-nut"><button class="nut-vien nho" data-sua-nv="${esc(n.id)}">${ic('pencil')}Sửa</button><button class="nut-vien nho do" data-xoa-nv="${esc(n.id)}">${ic('trash-2')}Xoá</button></div>
    </div>`).join(''));
  }

  async function suaNhanVat(id) {
    const cu = S.nhanVat.find((n) => n.id === id) || { ten: '', moTa: '', anh: [] };
    let anh = [...cu.anh];
    const veAnh = () => {
      const h = $('#nvAnh');
      if (h) { h.innerHTML = anh.map((p, i) => `<div class="anh-nho"><img src="${esc(fileUrl(p))}"><button type="button" data-bo-anh="${i}">${ic('x')}</button></div>`).join(''); }
    };
    const p = hoi({ tieuDe: id ? 'Sửa nhân vật' : 'Thêm nhân vật', ok: 'Lưu', html: `
      <label>Tên (gõ đúng tên này trong prompt)<input name="ten" value="${esc(cu.ten)}" placeholder="vd: Lan"></label>
      <label>Mô tả ngắn (tuỳ chọn)<input name="moTa" value="${esc(cu.moTa)}" placeholder="vd: cô gái 20 tuổi, tóc ngắn"></label>
      <label>Ảnh (1–4 ảnh rõ mặt)</label><div class="ds-tham-chieu" id="nvAnh" style="margin-bottom:8px"></div>
      <button type="button" class="nut-vien nho" id="nvChonAnh">${ic('image-plus')}Chọn ảnh</button>` });
    veAnh();
    $('#nvChonAnh').onclick = async () => { const ds = await api.call('chonAnh'); anh = [...anh, ...ds].slice(0, 4); veAnh(); };
    $('#nvAnh').onclick = (e) => { const b = e.target.closest('[data-bo-anh]'); if (b) { anh.splice(+b.dataset.boAnh, 1); veAnh(); } };
    const v = await p;
    if (!v) return;
    if (!v.ten.trim()) { toast('Cần đặt tên nhân vật', true); return; }
    if (!anh.length) { toast('Cần ít nhất 1 ảnh', true); return; }
    await api.call('luuNhanVat', { id: id || '', ten: v.ten, moTa: v.moTa, anh });
    toast('Đã lưu nhân vật');
  }

  // ── Thư viện ─────────────────────────────────────────────────────────────
  function veThuVien() {
    const sel = $('#duAnThuVien');
    const opts = `<option value="">Tất cả dự án</option>` + S.duAn.map((d) => `<option value="${esc(d.id)}">${esc(d.ten)}</option>`).join('');
    if (sel.innerHTML !== opts) sel.innerHTML = opts;
    sel.value = U.tvDuAn;
    for (const b of $$('#locThuVien button')) b.classList.toggle('on', b.dataset.v === U.tvLoc);
    const ds = S.viec.filter((j) => j.trangThai === 'xong' && j.files && j.files.length &&
      (U.tvLoc === 'tat' || j.loai === U.tvLoc) && (!U.tvDuAn || j.duAn === U.tvDuAn))
      .sort((a, b) => b.xongLuc - a.xongLuc).slice(0, 500);
    const hop = $('#dsThuVien');
    if (!ds.length) { datHtmlHop(hop, `<div class="trong" style="grid-column:1/-1">${ic('layout-grid')}<div>Chưa có kết quả nào.</div></div>`); return; }
    veTheoDong(hop, ds.map((j) => ({ khoa: j.id, html: `<div class="o-tv" data-tv="${j.id}" title="${esc(j.prompt)}">${
      j.loai === 'video' ? `<div class="vtv">${ic('film')}${anhVideoHtml(j.files[0], `${j.files[0]}|${j.xongLuc || ''}`)}</div>`
        : j.loai === 'nhac' ? `<div class="nhac-tv">${ic('music')}</div>` : `<img loading="lazy" src="${esc(fileUrl(j.files[0]))}">`
    }<span>#${so3(j.so)} · ${{ video: 'VIDEO', nhac: 'NHẠC' }[j.loai] || 'ẢNH'}</span></div>` })), '');
  }

  // ── Tài khoản ────────────────────────────────────────────────────────────
  const NHAN_TK = { 'da-dang-nhap': ['xong', 'Đã đăng nhập'], 'can-dang-nhap': ['loi', 'Chưa đăng nhập'], 'chua-kiem': ['cho', 'Chưa kiểm'] };
  function veTaiKhoan() {
    $('#soLuongTK').textContent = S.caiDat.luongMoiTK;
    $('#soTabFlow').textContent = S.caiDat.flow.tabMoiTK;
    // Mỗi nơi chạy một thẻ riêng (Muse / Google Flow / Suno) cho khỏi lẫn tài khoản với nhau.
    if (!DS_NEN_TK.includes(U.nenTk)) U.nenTk = 'muse';
    for (const b of $$('#nenTk button')) b.classList.toggle('on', b.dataset.v === U.nenTk);
    for (const n of DS_NEN_TK) {
      const cua = S.taiKhoan.filter((a) => nenTk(a) === n), soLoi = cua.filter((a) => skTk(a.id).muc === 'loi').length;
      $(`#nenTk [data-dem="${n}"]`).textContent = cua.length + (soLoi ? ` · ${soLoi} lỗi` : '');
      $(`#nenTk [data-dem="${n}"]`).classList.toggle('co-loi', !!soLoi);
      for (const el of $$(`.chi-${n}`)) el.hidden = n !== U.nenTk;
    }
    const ds = S.taiKhoan.filter((a) => nenTk(a) === U.nenTk);
    datHtml($('#dsTaiKhoan'), ds.length ? ds.map((a) => {
      const [cls, nhan] = NHAN_TK[a.trangThai] || NHAN_TK['chua-kiem'];
      const dang = S.dangNhap && S.dangNhap.id === a.id;
      const nen = nenTk(a), flow = nen === 'flow', drive = nen === 'drive';
      const sk = skTk(a.id);
      return `<div class="the-tk tk-${nen} sk-${sk.muc}" title="${esc(sk.chu)}">
        <div class="av">${esc((a.ten || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="tt"><b>${esc(a.ten)}</b><span class="tag nen-${nen}">${TEN_NEN[nen].toUpperCase()}</span><span class="pill ${cls}">${nhan}</span>${drive ? '' : veSucKhoe(sk)}${drive
          ? '<div class="han-muc mo">Chỉ dùng để tải ảnh / video lên Google Drive — chọn tài khoản này ở Cài đặt → Google Drive → "Tải thẳng lên drive.google.com".</div>'
          : nen === 'suno' ? veHetLuot(a)
          : flow ? `<div class="han-muc mo du-an-flow" title="${esc(a.flowUrl || '')}">Dự án Flow: ${a.flowUrl ? esc(a.flowUrl.replace(/^https:\/\/labs\.google\/fx\/(\w+\/)?tools\/flow\//, '…/')) : 'chưa chọn — app tự mở dự án mới (hoặc Đăng nhập → mở một dự án → Xong)'}</div>`
          : veHanMuc(a.hanMuc) + veChanVideo(a)}
          <div class="hang-nut">
            <button class="nut-vien nho" data-tk="dangNhap" data-id="${esc(a.id)}" ${dang ? 'disabled' : ''}>${ic('log-in')}Đăng nhập</button>
            <button class="nut-vien nho" data-tk="kiem" data-id="${esc(a.id)}">${ic('refresh-cw')}Kiểm tra</button>
            ${!drive && sk.muc === 'loi' && a.trangThai !== 'can-dang-nhap' ? `<button class="nut-vien nho nut-chay-lai" data-tk="chayLai" data-id="${esc(a.id)}" title="Lỗi đã sửa xong (đăng nhập lại, đổi mạng…) — cho tài khoản nhận việc lại ngay, khỏi chờ hết giờ nghỉ">${ic('zap')}Chạy lại ngay</button>` : ''}
            ${nen === 'suno' || drive ? '' : flow ? `<button class="nut-vien nho" data-tk="duAnFlow" data-id="${esc(a.id)}" title="Đổi trang dự án Flow mà tài khoản này chạy">${ic('folder')}Dự án</button>`
              : `<button class="nut-vien nho" data-tk="xoaChat" data-id="${esc(a.id)}" title="Xoá toàn bộ đoạn chat của tài khoản này trên Muse">${ic('message-square-x')}Xoá chat</button>`}
            <button class="nut-vien nho" data-tk="doiTen" data-id="${esc(a.id)}">${ic('pencil')}</button>
            <button class="nut-vien nho" data-tk="dangXuat" data-id="${esc(a.id)}" title="Đăng xuất">${ic('log-out')}</button>
            <button class="nut-vien nho do" data-tk="xoa" data-id="${esc(a.id)}" title="Xoá">${ic('trash-2')}</button>
          </div></div>
      </div>`;
    }).join('') : `<div class="trong">Chưa có tài khoản ${TEN_NEN[U.nenTk]} — bấm <b>Thêm ${{ flow: 'Flow', drive: 'Drive' }[U.nenTk] || TEN_NEN[U.nenTk]}</b> ở trên.</div>`);
    const tk = S.dangNhap && S.taiKhoan.find((a) => a.id === S.dangNhap.id);
    $('#tieuDeDangNhap').textContent = tk ? `Đăng nhập ${TEN_NEN[nenTk(tk)]}: ${tk.ten}${nenTk(tk) === 'flow' ? ' — mở một dự án rồi bấm Xong' : ''}` : 'Đăng nhập';
    $('#nutXongDangNhap').hidden = !tk;
    U.dangNhapMo = !!tk;
  }
  /** 1.3.7: tình trạng chạy của tài khoản (điều phối tính): đỏ = đang lỗi / nghỉ, xanh = chạy được, xám = chưa kiểm. */
  const skTk = (id) => (S && S.sucKhoe && S.sucKhoe[id]) || { muc: 'cho', chu: 'Chưa kiểm', dang: 0 };
  function veSucKhoe(sk) {
    const g = (t) => { const d = new Date(t), hai = (n) => String(n).padStart(2, '0'); return `${hai(d.getHours())}:${hai(d.getMinutes())}`; };
    const them = [sk.den ? `tới ${g(sk.den)}` : '', sk.luc ? `lúc ${g(sk.luc)}` : '', sk.dang ? `đang chạy ${sk.dang} việc` : ''].filter(Boolean).join(' · ');
    return `<div class="suc-khoe sk-${sk.muc}"><i></i><span>${esc(sk.chu)}${them ? ` <small>(${esc(them)})</small>` : ''}</span></div>`;
  }
  /** Tài khoản Suno: còn đang nghỉ vì hết lượt tạo / tải không (nhớ qua cả lần tắt app). */
  function veHetLuot(a) {
    if (!a.hetLuotDen || a.hetLuotDen <= Date.now()) return '<div class="han-muc mo">Suno: chạy được. Hết lượt tạo / tải thì bài tự tạo lại ở tài khoản Suno dự phòng.</div>';
    const t = new Date(a.hetLuotDen), hai = (n) => String(n).padStart(2, '0');
    return `<div class="han-muc het-luot" title="${esc(a.lyDoHetLuot || '')}">Hết lượt — nghỉ đến ${hai(t.getHours())}:${hai(t.getMinutes())} ngày ${hai(t.getDate())}/${hai(t.getMonth() + 1)}${a.lyDoHetLuot ? ` (${esc(a.lyDoHetLuot)})` : ''}. Bấm Kiểm tra để cho chạy lại sớm.</div>`;
  }
  /** 1.2.9: Muse chặn tạo video theo khu vực ở tài khoản này — app tạm không giao video cho nó (vẫn tạo ảnh). */
  function veChanVideo(a) {
    if (!a.chanVideoDen || a.chanVideoDen <= Date.now()) return '';
    const t = new Date(a.chanVideoDen), hai = (n) => String(n).padStart(2, '0');
    return `<div class="han-muc het-luot" title="${esc(a.lyDoChanVideo || '')}">Muse chặn tạo video ở khu vực của tài khoản này — app chỉ dùng nó tạo ảnh tới ${hai(t.getHours())}:${hai(t.getMinutes())} ngày ${hai(t.getDate())}/${hai(t.getMonth() + 1)}; video chạy ở tài khoản khác hoặc Flow. Bấm Kiểm tra để thử lại sớm.</div>`;
  }
  /** Mức dùng token Muse (Cài đặt → Chung → Usage), chữ giữ nguyên như Muse hiện. */
  function veHanMuc(hm) {
    if (!hm || !hm.muc || !hm.muc.length) return '<div class="han-muc mo">Mức token: chưa đọc (bấm Kiểm tra khi đã đăng nhập)</div>';
    const t = new Date(hm.luc), hai = (n) => String(n).padStart(2, '0');
    return `<div class="han-muc">${hm.muc.map((m) => `<div class="hm">
        <div class="hm-dau"><span>${esc(m.ten)}</span><b>${esc(m.chu)}</b></div>
        <div class="hm-thanh ${m.phanTram >= 90 ? 'do' : m.phanTram >= 70 ? 'vang' : ''}"><i style="width:${Math.max(0, Math.min(100, +m.phanTram || 0))}%"></i></div>
        ${m.ghiChu ? `<small>${esc(m.ghiChu)}</small>` : ''}</div>`).join('')}
      <small class="mo">Cập nhật lúc ${hai(t.getHours())}:${hai(t.getMinutes())} ngày ${hai(t.getDate())}/${hai(t.getMonth() + 1)}</small></div>`;
  }
  const khungTrinhDuyet = () => { const r = $('#oTrinhDuyet').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
  async function dongDangNhap() { U.dangNhapMo = false; await api.call('dongDangNhap'); }

  async function lenhTaiKhoan(lenh, id) {
    const a = S.taiKhoan.find((x) => x.id === id);
    if (!a) return;
    if (lenh === 'dangNhap') { U.dangNhapMo = true; await api.call('moDangNhap', { id, khung: khungTrinhDuyet() }); }
    else if (lenh === 'chayLai') {
      const r = await api.call('chayLaiTaiKhoan', { id });
      toast(r && r.ok ? `"${a.ten}" nhận việc lại ngay${r.tiep ? ` · chạy tiếp ${r.tiep} dự án đã tạm dừng` : ''}` : (r && r.loi) || 'Không được', !(r && r.ok));
    } else if (lenh === 'kiem') { toast(`Đang kiểm "${a.ten}"…`); const r = await api.call('kiemTaiKhoan', { id }); toast(r === 'da-dang-nhap' ? `"${a.ten}" đã đăng nhập` : `"${a.ten}" chưa đăng nhập`, r !== 'da-dang-nhap'); }
    else if (lenh === 'duAnFlow') {
      const v = await hoi({ tieuDe: `Dự án Flow của "${a.ten}"`, ok: 'Lưu', html: `<p>Dán địa chỉ trang dự án Flow (dạng <code>https://flow.google.com/project/…</code>). Để trống: app tự bấm "Dự án mới" khi chạy.</p>
        <label>Địa chỉ dự án<input name="url" value="${esc(a.flowUrl || '')}" placeholder="https://flow.google.com/project/…"></label>` });
      if (!v) return;
      const url = v.url.trim();
      if (url && !/^https:\/\/(flow\.google\.com|labs\.google\/fx)\/.*project\/[^/?#\s]+/.test(url)) { toast('Địa chỉ phải là trang dự án Flow (flow.google.com/project/…)', true); return; }
      await api.call('suaTaiKhoan', { id, thay: { flowUrl: url } });
      toast(url ? 'Đã lưu dự án Flow' : 'Đã bỏ dự án — app sẽ tự mở dự án mới');
    } else if (lenh === 'xoaChat') {
      if (!await xacNhan('Xoá toàn bộ đoạn chat trên Muse?', `Xoá MỌI đoạn chat phụ của "${esc(a.ten)}" trên muse.ai (không khôi phục được; "Main chat" Muse không cho xoá). File ảnh/video đã tải về máy vẫn giữ. Muốn xoá một số chat: chọn việc ở hàng đợi → <b>Xoá chat Muse</b>.`, 'Xoá hết', true)) return;
      toast(`Đang xoá chat của "${a.ten}"… (xem Nhật ký)`);
      const r = await api.call('xoaChatTaiKhoan', { id });
      toast(r && r.ok ? `Đã xoá ${r.da} đoạn chat${r.hong ? ` · ${r.hong} không xoá được` : ''}` : (r && r.loi) || 'Không xoá được', !(r && r.ok) || !!r.hong);
    } else if (lenh === 'doiTen') {
      const v = await hoi({ tieuDe: 'Đổi tên tài khoản', html: `<label>Tên<input name="ten" value="${esc(a.ten)}"></label>`, ok: 'Lưu' });
      if (v && v.ten.trim()) api.call('suaTaiKhoan', { id, thay: { ten: v.ten } });
    } else if (lenh === 'dangXuat') {
      if (await xacNhan('Đăng xuất?', `Xoá phiên đăng nhập ${{ flow: 'Google', drive: 'Google', suno: 'Suno', muse: 'Muse' }[nenTk(a)]} của "${esc(a.ten)}" trong app.`, 'Đăng xuất', true)) api.call('dangXuat', { id });
    } else if (lenh === 'xoa') {
      if (await xacNhan('Xoá tài khoản?', `Xoá "${esc(a.ten)}" và phiên đăng nhập của nó khỏi app.`, 'Xoá', true)) {
        const r = await api.call('xoaTaiKhoan', { id });
        if (r && !r.ok) toast(r.loi, true);
      }
    }
  }

  // ── Cài đặt ──────────────────────────────────────────────────────────────
  // ── 1.3.6: Hẹn giờ chạy (riêng từng chức năng) ────────────────────────────
  const gioHen = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function ngayHen(t) {
    const d = new Date(t), hom = new Date(); hom.setHours(0, 0, 0, 0);
    const lech = Math.round((new Date(d).setHours(0, 0, 0, 0) - hom.getTime()) / 86400000);
    return `${gioHen(t)} ${lech === 0 ? 'hôm nay' : lech === 1 ? 'ngày mai' : d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`;
  }
  /** Điền ô của các thẻ hẹn giờ từ trạng thái (khi vào trang / sau khi lưu) — không điền lại lúc đang gõ. */
  function napHenGio(chiLoai) {
    if (!S) return;
    for (const the of $$('#trang-hengio .the-hen')) {
      const l = the.dataset.loai, h = (S.henGio || {})[l] || {};
      if (chiLoai && chiLoai !== l) continue;
      const o = (k) => $(`[data-hen="${k}"]`, the);
      o('bat').checked = !!h.bat;
      o('batDau').value = h.batDau || '22:00';
      o('ketThuc').value = h.ketThuc || '';
      o('lap').value = h.lap || 'ngay';
      o('duAn').innerHTML = `<option value="">Mọi dự án</option>` + S.duAn.map((d) => `<option value="${esc(d.id)}">Dự án "${esc(d.ten)}"</option>`).join('');
      o('duAn').value = S.duAn.some((d) => d.id === h.duAn) ? h.duAn : '';
    }
    veHenGio();
  }
  function veHenGio() {
    for (const the of $$('#trang-hengio .the-hen')) {
      const l = the.dataset.loai, h = (S.henGio || {})[l] || {}, chay = (S.henChay || {})[l];
      const o = (k) => $(`[data-hen="${k}"]`, the);
      const tr = o('trang');
      tr.className = `trang-hen${chay ? ' chay' : h.bat ? ' bat' : ''}`;
      tr.textContent = chay ? `Đang chạy theo hẹn${chay.den ? ` · dừng ${gioHen(chay.den)}` : ' · tới hết hàng chờ'}` : h.bat && h.lanToi ? `Lần tới: ${ngayHen(h.lanToi)}` : 'Đang tắt';
      the.classList.toggle('tat', !o('bat').checked);
      o('dung').hidden = !chay;
      const cho = S.viec.filter((j) => j.loai === l && j.trangThai === 'cho' && (!o('duAn').value || j.duAn === o('duAn').value)).length;
      o('ghi').textContent = `Hiện có ${cho} việc ${TEN_LOAI[l]} đang chờ${o('duAn').value ? ' trong dự án này' : ''}. ` +
        (l === 'nhac' ? 'Chạy trên các tài khoản Suno.' : 'Chạy trên Muse / Google Flow theo nơi đã chọn của từng việc.');
    }
  }

  /** 1.4.0: Cài đặt → Google Drive — hiện ô của cách đang chọn (thư mục trên máy / tài khoản Drive). */
  function veDriveCach() {
    const c = $('#cdDriveCach').value;
    for (const el of $$('[data-drive-cach]')) el.hidden = el.dataset.driveCach !== c;
  }
  function veCaiDat() {
    if (!S) return;
    const c = S.caiDat;
    // 1.4.2: thẻ "Lưu ảnh & video" — cột ảnh / cột video, cùng khoá với Cài đặt nâng cao của trang Tạo.
    for (const l of ['anh', 'video']) {
      const k = khoaTai(l);
      $(`#lvTai_${l}`).checked = !!c[k.tai];
      $(`#lvThuMuc_${l}`).value = S.thuMuc[l] || '';
      if (document.activeElement !== $(`#lvTen_${l}`)) $(`#lvTen_${l}`).value = c[k.ten] || '';
      viDuLuu(l);
    }
    $('#cdLuong').value = c.luongMoiTK; $('#cdNghi').value = c.nghiGiuaLanGui; $('#cdThuLai').value = c.tuThuLai; $('#cdChayLaiLoi').value = c.tuChayLaiLoi;
    $('#cdChoAnh').value = c.choAnhGiay; $('#cdChoVideo').value = c.choVideoGiay; $('#cdChoChu').value = c.choChuGiay; $('#cdChoNhac').value = c.choNhacGiay;
    $('#cdPng').checked = !!c.png;
    $('#cdDoiNen').checked = c.doiNenKhiLoi !== false;
    $('#cdTatMay').checked = !!(S.caiDatChung || c).tatMayKhiXong;   // chung cho mọi dự án
    const dCd = duAnHienTai();
    $('#cdTieuDe').textContent = dCd ? `Cài đặt — dự án "${dCd.ten}"` : 'Cài đặt';
    $('#cdVideoCanhAnh').checked = c.videoCanhAnh !== false;
    $('#cdThuMucVideoAnh').value = c.thuMucVideoAnh || '';
    $('#khoiThuMucVideoAnh').classList.toggle('mo-di', c.videoCanhAnh !== false);
    $('#cdXoaChat').checked = !!c.xoaChatKhiXong;
    $('#cdXoaDuAnFlow').checked = !!c.xoaDuAnFlowKhiXong;
    $('#cdDrive').checked = !!c.driveBat;
    $('#cdThuMucDrive').value = c.thuMucDrive || '';
    $('#cdDriveCach').value = c.driveCach === 'web' ? 'web' : 'may';
    { // 1.4.0: tài khoản Drive (nền 'drive') để tải thẳng lên drive.google.com
      const ds = S.taiKhoan.filter((a) => nenTk(a) === 'drive');
      datHtml($('#cdDriveTk'), ds.length ? `<option value="">— chọn tài khoản —</option>` + ds.map((a) => `<option value="${esc(a.id)}">${esc(a.ten)}${a.trangThai === 'can-dang-nhap' ? ' (chưa đăng nhập)' : ''}</option>`).join('')
        : '<option value="">Chưa có tài khoản Drive — bấm "Tài khoản Drive…"</option>');
      $('#cdDriveTk').value = ds.some((a) => a.id === c.driveTk) ? c.driveTk : (ds.length === 1 ? ds[0].id : '');
      veDriveCach();
    }
    $('#cdNheMay').checked = (S.caiDatChung || c).nheMay !== false;   // chung cả app
    $('#cdMauAnh').value = c.mau.anh; $('#cdMauVideo').value = c.mau.video;
    const f = c.flow;
    datChonModel('fModelAnh', f.modelAnh);
    for (const id of ['fModelChinh', 'fModelPhu', 'fModelDuPhong']) datChonModel(id, f.chonModel[O_FLOW_MODEL.find((x) => x[0] === id)[1]]);
    for (const [id, k] of O_FLOW) { const el = $('#' + id); if (el.type === 'checkbox') el.checked = !!f[k]; else el.value = f[k] == null ? '' : f[k]; }
    for (const [id, k] of O_FLOW_MODEL) $('#' + id).value = f.chonModel[k] == null ? '' : f.chonModel[k];
    for (const [id, k] of O_FLOW_AN_TOAN) { const el = $('#' + id); if (el.type === 'checkbox') el.checked = !!f.anToan[k]; else el.value = f.anToan[k]; }
    veCapNhat();
  }
  // Model Flow là <select> thật, KHÔNG phải <input list>: Chromium lọc gợi ý datalist theo chữ đang có trong ô,
  // ô đã có tên model thì không chọn được model khác (lỗi Flow 28/09/2026). Khớp MODEL_GOI_Y của src/flow/main/model.js.
  const DS_MODEL_VIDEO = ['Veo 3.1 - Lite', 'Veo 3.1 - Fast', 'Veo 3.1 - Quality', 'Omni 1.1 Flash'];
  const DS_MODEL = {
    fModelAnh: { ds: ['Nano Banana 2 Lite'], trong: '(giữ nguyên model đang chọn trên Flow)' },
    fModelChinh: { ds: DS_MODEL_VIDEO, trong: '(giữ nguyên model đang chọn trên Flow)' },
    fModelPhu: { ds: DS_MODEL_VIDEO, trong: '(không xen kẽ)' },
    fModelDuPhong: { ds: DS_MODEL_VIDEO, trong: '(không — cho tài khoản nghỉ)' }
  };
  /** Dựng lại hộp chọn model; tên đã lưu mà danh sách không có thì vẫn hiện (kèm ⚠), KHÔNG lặng lẽ đổi. */
  function datChonModel(id, giaTri) {
    const { ds, trong } = DS_MODEL[id];
    const v = String(giaTri || '');
    const la = v && !ds.includes(v);
    $('#' + id).innerHTML = `<option value="">${esc(trong)}</option>` + ds.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('') +
      (la ? `<option value="${esc(v)}">⚠ ${esc(v)} — không có trong danh sách gợi ý</option>` : '');
    $('#' + id).classList.toggle('canh-bao', la);
  }
  // Ô Cài đặt → Google Flow ↔ khoá trong caiDat.flow (src/flow/cai-dat-flow.js).
  const O_FLOW = [['fTab', 'tabMoiTK'], ['fMe', 'meToiDa'], ['fSoLuong', 'outputCount'], ['fChoMin', 'delayMin'], ['fChoMax', 'delayMax'],
    ['fThuLai', 'maxRetries'], ['fGian', 'multiTabStagger'], ['fChatAnh', 'chatLuongAnh'], ['fChatVideo', 'chatLuongVideo'], ['fMang', 'networkGuard'],
    ['fNgauNhien', 'randomDelay'], ['fSoThuTu', 'addIndex'], ['fCuon', 'randomScroll'], ['fGoAnh', 'goAnhThamChieu'], ['fDoiTen', 'doiTenTrenFlow'], ['fDongY', 'dongYQuyenAnh'],
    ['fModelAnh', 'modelAnh'], ['fNghiTT', 'nghiThaoTacBat'], ['fNghiTTMin', 'nghiThaoTacMin'], ['fNghiTTMax', 'nghiThaoTacMax']];
  const O_FLOW_MODEL = [['fModelChinh', 'chinh'], ['fModelPhu', 'phu'], ['fXenKe', 'xenKeMoi'], ['fModelDuPhong', 'duPhong'], ['fThuLaiPhut', 'thuLaiPhut']];
  // Nhận diện tài khoản lỗi (1.2.0, luôn bật) — khớp chuanHoaCaiDat của src/flow/main/an-toan.js.
  const O_FLOW_AN_TOAN = [['fNguong', 'nguong'], ['fNghi', 'nghiPhut']];
  function docCaiDatFlow() {
    const doc = (id) => { const el = $('#' + id); return el.type === 'checkbox' ? el.checked : el.value; };
    const f = { chonModel: {}, anToan: {} };
    for (const [id, k] of O_FLOW) f[k] = doc(id);
    for (const [id, k] of O_FLOW_MODEL) f.chonModel[k] = doc(id);
    for (const [id, k] of O_FLOW_AN_TOAN) f.anToan[k] = doc(id);
    return f;
  }
  /** Ví dụ tên file ngay dưới ô mẫu tên — thấy liền kết quả khi gõ. */
  function viDuTen() {
    const loai = loaiTrang();
    const d = duAnHienTai() || { ten: 'Mặc định' };
    const mau = { so: 83, stt: 5, prompt: 'Tranh truyện người que tối giản bố cục dọc', taoLuc: Date.now(), loai };
    $('#ncViDu').textContent = 'Ví dụ: ' + HD.tenFile(d, mau, { video: 'video/mp4', nhac: 'audio/mpeg' }[loai] || 'image/png', 0, $('#ncTen').value);
  }
  /** Ví dụ tên file ở thẻ "Lưu ảnh & video" (Cài đặt). */
  function viDuLuu(l) {
    const d = duAnHienTai() || { ten: 'Mặc định' };
    const mau = { so: 83, stt: 5, prompt: 'Tranh truyện người que tối giản bố cục dọc', taoLuc: Date.now(), loai: l };
    $(`#lvViDu_${l}`).textContent = 'Ví dụ: ' + HD.tenFile(d, mau, l === 'video' ? 'video/mp4' : 'image/png', 0, $(`#lvTen_${l}`).value);
  }
  /** Khối "Tải về & tên file" trong Cài đặt nâng cao: hiện đúng phần của trang đang mở (ảnh / video). */
  function veTaiVe() {
    const loai = loaiTrang(), v = loai === 'video', c = S.caiDat, ten = TEN_LOAI[loai];
    $('#ncNhanTai').textContent = `Tải ${ten} về`;
    $('#ncNhanThuMuc').textContent = `Thư mục lưu ${ten}`;
    $('#ncNhanTen').firstChild.textContent = `Tên file ${ten}`;
    $('#ncTai').checked = v ? c.taiVideo : c.taiAnh;   // nhạc luôn tải về (công tắc ẩn)
    // 1.4.2: nói rõ khối này áp dụng cho loại việc nào.
    datHtml($('#ncApDung'), v ? 'Áp dụng cho <span class="ap ap-video">Chỉ video</span> mọi việc <b>Tạo video</b> của dự án này. Ảnh chỉnh ở trang Tạo ảnh (hoặc Cài đặt → Lưu ảnh &amp; video).'
      : 'Áp dụng cho <span class="ap ap-anh">Chỉ ảnh</span> mọi việc <b>Tạo ảnh</b> của dự án này. Video chỉnh ở trang Tạo video (hoặc Cài đặt → Lưu ảnh &amp; video); video tự tạo từ ảnh lưu theo Cài đặt → Video tạo từ ảnh.');
    $('#ncThuMuc').value = S.thuMuc[loai];
    if (document.activeElement !== $('#ncTen')) $('#ncTen').value = c[khoaTai(loai).ten];
    $('#ncTen').placeholder = loai === 'nhac' ? '{stt}' : v ? HD.MAU_TEN_MAC_DINH : HD.MAU_TEN_ANH_MAC_DINH;
    viDuTen();
  }
  function veCapNhat() {
    const cn = S && S.capNhat;
    if (!cn) return;
    const t = {
      'chua-kiem': 'Chưa kiểm.', 'dang-kiem': 'Đang hỏi GitHub…', 'moi-nhat': `Đang dùng bản mới nhất (${cn.phienBanHienTai}).`,
      'co-ban-moi': `Có bản mới ${cn.phienBanMoi}.`, 'dang-tai': `Đang tải bản ${cn.phienBanMoi}: ${cn.tienDo}%`,
      'da-tai': `Bản ${cn.phienBanMoi} đã tải xong — bấm chip "Có bản mới" trên cùng để cài, hoặc app tự cài khi bạn thoát.`, loi: cn.loi || 'Lỗi'
    }[cn.trangThai] || '';
    $('#cdCapNhat').textContent = `Phiên bản ${S.phienBan}. ${t}${cn.lyDo && cn.kieu !== 'tu-dong' ? ' ' + cn.lyDo : ''}`;
  }

  // ── Nhật ký ──────────────────────────────────────────────────────────────
  const dongLogText = (d) => `${new Date(d.t).toLocaleTimeString('vi-VN')} ${d.chu}`;
  function themLog(d) {
    U.log.push(d);
    if (U.log.length > 600) U.log.splice(0, U.log.length - 600);
    $('#dongCuoi').textContent = d.chu;
    $('#dongCuoi').title = d.chu;
    // 1.4.0: nhật ký đang mở thì vẽ lại tối đa ~3 lần mỗi giây (trước: mỗi dòng mới dựng lại 400 dòng).
    if (!$('#nganLog').hidden) { if (!U.henVeLog) U.henVeLog = setTimeout(() => { U.henVeLog = null; veLog(); }, 300); }
    else if (d.muc === 'error') { U.loiChuaXem = (U.loiChuaXem || 0) + 1; veDemLoi(); }
  }
  /** Số lỗi mới từ lần mở nhật ký trước, hiện ngay trên nút Nhật ký. */
  function veDemLoi() {
    const b = $('#demLoiLog');
    b.hidden = !U.loiChuaXem;
    b.textContent = U.loiChuaXem > 99 ? '99+' : String(U.loiChuaXem || '');
  }
  function veLog() {
    const h = $('#dsLog');
    h.innerHTML = U.log.slice(-400).map((d) => `<div class="dong-log ${esc(d.muc)}"><span class="gio">${esc(new Date(d.t).toLocaleTimeString('vi-VN'))}</span> ${esc(d.chu)}</div>`).join('');
    h.scrollTop = h.scrollHeight;
  }

  // ── Dự án ────────────────────────────────────────────────────────────────
  function veMenuDuAn() {
    const m = $('#menuDuAn');
    m.innerHTML = S.duAn.map((d) => {
      const n = S.viec.filter((j) => j.duAn === d.id).length;
      const g = soDongHo(d.id);
      return `<button data-du-an="${esc(d.id)}" class="${d.id === U.duAn ? 'on' : ''}">${ic(duAnDangChay(d.id) ? 'play' : 'folder')}${esc(d.ten)} - ${n}${duAnDangChay(d.id) ? ` <small class="dang-chay">đang chạy${g && g.dangChay ? ` ${dongHoChu(g.daChay)}${g.soCon ? ` · còn ≈ ${khoangChu(g.conLai)}` : ''}` : ''}</small>` : ''}</button>`;
    }).join('') + `<div class="tach"></div><button data-du-an-moi>${ic('plus')}Dự án mới…</button>`;
  }
  async function duAnMoi() {
    const v = await hoi({ tieuDe: 'Dự án mới', html: '<label>Tên dự án (cũng là tên thư mục kết quả)<input name="ten" placeholder="vd: Truyện người que"></label>' +
      htmlChonTk(duAnHienTai()), ok: 'Tạo' });
    if (!v || !v.ten.trim()) return;
    const d = await api.call('taoDuAn', { ten: v.ten, taiKhoan: layTk(v), chaySong: laySong(v), tuDuAn: (duAnHienTai() || {}).id || '', boLoai: layBoLoai(v) });
    if (d && d.id) { U.duAn = d.id; U.chiTiet = null; U.chon.clear(); luuUi(); }
  }

  async function chonTkDuAn() {
    const d = duAnHienTai();
    if (!d) return;
    const v = await hoi({ tieuDe: `Tài khoản chạy "${d.ten}"`, html: htmlChonTk(d), ok: 'Lưu' });
    if (!v) return;
    const bo = layBoLoai(v);
    await api.call('datTaiKhoanDuAn', { id: d.id, taiKhoan: layTk(v), chaySong: laySong(v), boLoai: bo });
    // Loại việc nào của Muse / Flow không còn tài khoản Chạy / Dự phòng nào → nhắc (việc loại đó sẽ đứng chờ hoặc sang bên kia).
    const thieu = [];
    for (const nen of ['muse', 'flow']) {
      const ids = vaiTk(v, nen); const dung = [...ids.chay, ...ids.du];
      if (!dung.length) continue;
      for (const [l, t] of LOAI_TK) if (dung.every((id) => bo[l].includes(id))) thieu.push(`${t} ${TEN_NEN[nen]}`);
    }
    toast(thieu.length ? `Đã lưu — chưa có tài khoản nào cho: ${thieu.join(', ')}` : 'Đã lưu tài khoản của dự án', !!thieu.length);
  }

  // ── Gắn sự kiện ──────────────────────────────────────────────────────────
  function ganSuKien() {
    $('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-trang]'); if (b) diToi(b.dataset.trang); });

    // Thanh trên
    $('#nutChayTatCa').onclick = () => {
      const d = duAnHienTai();
      if (!d) return;
      api.call(duAnDangChay(d.id) ? 'dung' : 'chay', { duAn: d.id }).then((r) => {
        if (r === false) toast(S.viec.some((j) => j.duAn === d.id && j.trangThai === 'cho') ? 'Chưa bật tài khoản nào — xem mục Tài khoản'
          : S.viec.some((j) => j.duAn === d.id && j.trangThai === 'dung') ? 'Dự án không còn việc chờ — việc đã dừng thì bấm Chạy ở từng việc' : 'Dự án không còn việc nào đang chờ', true);
      });
    };
    $('#chipCapNhat').onclick = async () => {
      const cn = S.capNhat;
      if (cn.trangThai !== 'da-tai') { diToi('caidat'); return; }
      if (!(await xacNhan(`Cài bản ${cn.phienBanMoi}?`, 'App sẽ tắt, cài bản mới rồi tự mở lại. Việc đang chạy về hàng chờ và chạy tiếp được.', 'Cài & mở lại'))) return;
      let r = await api.call('caiCapNhat', { epBuoc: false });
      if (r && r.canXacNhan && await xacNhan('Đang có luồng chạy', r.lyDo, 'Vẫn cài', true)) r = await api.call('caiCapNhat', { epBuoc: true });
      if (r && !r.ok && r.lyDo && !r.canXacNhan) toast(r.lyDo, true);
    };
    $('#nutDuAn').onclick = (e) => { e.stopPropagation(); const m = $('#menuDuAn'); const an = m.hidden; dongMenu(); if (an) { veMenuDuAn(); m.hidden = false; } };
    $('#menuDuAn').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      dongMenu();
      if (b.hasAttribute('data-du-an-moi')) duAnMoi();
      else { U.duAn = b.dataset.duAn; U.chiTiet = null; U.chon.clear(); luuUi(); ve(); if (U.trang === 'caidat') veCaiDat(); }
    };
    $('#nutThemDuAn').onclick = duAnMoi;
    $('#nutTkDuAn').onclick = chonTkDuAn;
    // Hộp chọn tài khoản: tô màu theo vai vừa chọn (Chạy / Dự phòng / Không dùng).
    $('#hopNoiDung').addEventListener('change', (e) => {
      if (e.target.matches && e.target.matches('[data-vai-tk]')) e.target.closest('.hang-vai').dataset.vai = e.target.value;
      // Hộp Đổi prompt: hiện ô của cách đổi đang chọn.
      if (e.target.matches && e.target.matches('[data-doi-cach]')) for (const k of $$('#hopNoiDung [data-cach]')) k.hidden = k.dataset.cach !== e.target.value;
    });
    // 1.4.0: "Chạy lại ngay" ngay trong hộp chọn tài khoản của dự án (hàng đỏ).
    $('#hopNoiDung').addEventListener('click', async (e) => {
      const b = e.target.closest && e.target.closest('[data-chay-lai-tk]');
      if (!b) return;
      b.disabled = true;
      const r = await api.call('chayLaiTaiKhoan', { id: b.dataset.chayLaiTk });
      const o = b.closest('.ly-loi');
      if (o) o.textContent = r && r.ok ? 'Đã cho chạy lại — tài khoản nhận việc ngay' : (r && r.loi) || 'Không được';
      const cham = b.closest('.hang-vai') && $('.cham-sk', b.closest('.hang-vai'));
      if (cham && r && r.ok) cham.className = 'cham-sk sk-tot';
    });
    $('#nutMoThuMucDuAn').onclick = () => api.call('moThuMuc', { dir: S.thuMuc[loaiTrang()] });
    $('#nutNhapPrompt').onclick = async () => {
      const t = await api.call('nhapPrompt');
      if (t == null) return;
      const o = $('#oPrompt');
      o.value = (o.value.trim() ? o.value.replace(/\s*$/, '\n') : '') + t.trim();
      U.nhap[loaiTrang()] = o.value; luuUi(); veTao();
      toast(`Đã nhập ${HD.tachPrompt(t, $('#tachPrompt').value).length} prompt`);
    };
    $('#nutNhapNhieu').onclick = nhapNhieuFile;
    $('#nutMenuDuAn').onclick = (e) => { e.stopPropagation(); const m = $('#menuDuAnThem'); const an = m.hidden; dongMenu(); m.hidden = !an; };
    $('#menuDuAnThem').onclick = async (e) => {
      const b = e.target.closest('[data-lenh]');
      if (!b) return;
      dongMenu();
      const d = duAnHienTai();
      if (b.dataset.lenh === 'taiKhoan') chonTkDuAn();
      else if (b.dataset.lenh === 'chayHet') api.call('chay').then((r) => { if (r === false) toast('Không còn việc nào đang chờ', true); });
      else if (b.dataset.lenh === 'dungHet') api.call('dung');
      else if (b.dataset.lenh === 'doiTen') {
        const v = await hoi({ tieuDe: 'Đổi tên dự án', html: `<label>Tên<input name="ten" value="${esc(d.ten)}"></label><small>Kết quả mới sẽ lưu vào thư mục theo tên mới; file cũ giữ nguyên chỗ cũ.</small>`, ok: 'Lưu' });
        if (v && v.ten.trim()) api.call('doiTenDuAn', { id: d.id, ten: v.ten });
      } else if (b.dataset.lenh === 'xoaXong') {
        const ids = S.viec.filter((j) => j.duAn === d.id && j.loai === loaiTrang() && j.trangThai === 'xong').map((j) => j.id);
        if (ids.length && await xacNhan('Dọn danh sách?', `Bỏ ${ids.length} việc đã xong khỏi danh sách (file vẫn giữ trong thư mục).`, 'Dọn')) api.call('xoaViec', { ids });
      } else if (b.dataset.lenh === 'xoaDuAn') {
        if (await xacNhan('Xoá dự án?', `Xoá dự án "${esc(d.ten)}" và toàn bộ hàng đợi của nó. File đã tải về vẫn giữ.`, 'Xoá', true)) {
          const r = await api.call('xoaDuAn', { id: d.id });
          if (r && !r.ok) toast(r.loi, true); else { U.duAn = ''; luuUi(); }
        }
      }
    };
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu, #nutDuAn, #nutMenuDuAn, #nutTaoMenu, #nutMauPrompt, [data-menu]')) dongMenu(); });

    // Cột tạo
    $('#nenTao').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { U.nen[loaiTrang()] = b.dataset.v; luuUi(); ve(); } };
    $('#nenVideoChuoi').onchange = (e) => { U.chuoi.nen = e.target.value; luuUi(); };
    $('#locNen').onchange = (e) => { U.locNen = e.target.value; luuUi(); veHang(); };
    $('#cheDo').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { U.cheDo = b.dataset.v; luuUi(); veTao(); } };
    $('#chonNhanVat').onclick = (e) => { const b = e.target.closest('[data-nv]'); if (!b) return; const id = b.dataset.nv; U.nvChon.has(id) ? U.nvChon.delete(id) : U.nvChon.add(id); veTao(); };
    $('#oPrompt').addEventListener('input', () => { U.nhap[loaiTrang()] = $('#oPrompt').value; luuUi(); veTao(); });
    $('#chonSo').addEventListener('input', veTao);
    $('#batChuoi').onchange = (e) => { U.chuoi.bat = e.target.checked; luuUi(); veTao(); if (U.chuoi.bat) $('#promptVideoChung').focus(); };
    $('#promptVideoChung').addEventListener('input', (e) => { U.chuoi.prompt = e.target.value; luuUi(); });
    $('#nutThuMucVideoDuAn').onclick = async () => {
      const d = duAnHienTai();
      if (!d) return;
      const p = await api.call('chonThuMucVideoDuAn', { id: d.id });
      if (p) toast(`Video tạo từ ảnh của dự án "${d.ten}" sẽ lưu vào ${p}`);
    };
    $('#boThuMucVideoDuAn').onclick = async () => {
      const d = duAnHienTai();
      if (!d) return;
      await api.call('boThuMucVideoDuAn', { id: d.id });
      toast(`Dự án "${d.ten}" bỏ thư mục video riêng — theo Cài đặt chung`);
    };
    $('#promptThuMuc').addEventListener('input', (e) => { U.promptThuMuc = e.target.value; luuUi(); });
    $('#tyLeVideoChuoi').onchange = (e) => { U.chuoi.tyLe = e.target.value; luuUi(); };
    $('#luongNhanh').onchange = async (e) => {
      const n = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 3));
      await datCD({ luongMoiTK: n });
      toast(`Mỗi tài khoản chạy ${n} luồng${n > 6 ? ' — nhiều luồng dễ bị Muse giới hạn, theo dõi nhật ký' : ''}`);
    };
    $('#tachPrompt').onchange = () => { datCD({ tachPrompt: $('#tachPrompt').value }); };
    $('#tyLe').onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      U.tyLe[loaiTrang()] = b.dataset.v; luuUi();
      for (const x of $$('#tyLe button')) x.classList.toggle('on', x === b);
    };
    $('#nutChonAnh').onclick = async () => themThamChieu(await api.call('chonAnh'));
    $('#thaAnh').onclick = async (e) => { if (!e.target.closest('a')) themThamChieu(await api.call('chonAnh')); };
    const chonThuMucAnh = async (e) => {
      e.stopPropagation();
      const r = await api.call('chonThuMucAnh');
      if (!r) return;
      if (!r.anh.length) { toast('Thư mục không có ảnh nào', true); return; }
      TC().thuMuc = r;
      // Trang video: ảnh trong thư mục CHÍNH là khung đầu của từng video → bỏ ảnh tham chiếu lẻ
      // (vd ảnh còn lại từ "Tạo video từ ảnh này"), nếu không mỗi video bị gửi kèm 2 ảnh.
      const boLe = loaiTrang() === 'video' && TC().ds.length;
      if (boLe) TC().ds = [];
      veTao();
      toast(loaiTrang() === 'video'
        ? `Thư mục có ${r.anh.length} ảnh — mỗi ảnh một video, dùng prompt ở ô "Prompt dùng chung"${boLe ? '. Đã bỏ ảnh tham chiếu lẻ.' : ''}`
        : `Thư mục có ${r.anh.length} ảnh — gán lần lượt cho từng prompt`);
    };
    $('#nutChonThuMuc').onclick = chonThuMucAnh;
    $('#nutVideoThuMuc').onclick = chonThuMucAnh;
    $('#chonHet').onchange = (e) => {
      for (const id of U.dsLoc || []) e.target.checked ? U.chon.add(id) : U.chon.delete(id);
      veHang();
    };
    const tha = $('#thaAnh');
    tha.addEventListener('dragover', (e) => { e.preventDefault(); tha.classList.add('keo'); });
    tha.addEventListener('dragleave', () => tha.classList.remove('keo'));
    tha.addEventListener('drop', (e) => {
      e.preventDefault(); tha.classList.remove('keo');
      themThamChieu(Array.from(e.dataTransfer.files).map((f) => api.duongDan(f)).filter(Boolean));
    });
    $('#dsThamChieu').onclick = (e) => {
      const b = e.target.closest('[data-bo]');
      if (b) { TC().ds.splice(+b.dataset.bo, 1); veTao(); }
      if (e.target.closest('[data-bo-thu-muc]')) { TC().thuMuc = null; veTao(); }
    };
    $('#nutTaoChay').onclick = () => taoViec(true);
    $('#nutTaoMenu').onclick = (e) => { e.stopPropagation(); const m = $('#menuTao'); const an = m.hidden; dongMenu(); m.hidden = !an; };
    $('#nutChiThem').onclick = () => { dongMenu(); taoViec(false); };
    $('#oPrompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) taoViec(true); });

    // Mẫu prompt
    $('#nutMauPrompt').onclick = (e) => {
      e.stopPropagation();
      const m = $('#menuMau'); const an = m.hidden; dongMenu();
      if (!an) return;
      m.innerHTML = (S.mauPrompt.length ? S.mauPrompt.map((x, i) =>
        `<button data-mau="${i}" title="${esc(x.noiDung)}">${ic('file-text')}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.ten)}</span><span class="lien-ket" data-xoa-mau="${i}">${ic('x')}</span></button>`).join('')
        : '<div class="rong">Chưa có mẫu nào.</div>') + `<div class="tach"></div><button data-luu-mau>${ic('plus')}Lưu nội dung ô Prompt thành mẫu…</button>`;
      veIcon(m);
      m.hidden = false;
    };
    $('#menuMau').onclick = async (e) => {
      const x = e.target.closest('[data-xoa-mau]');
      if (x) { e.stopPropagation(); const ds = [...S.mauPrompt]; ds.splice(+x.dataset.xoaMau, 1); api.call('luuMauPrompt', { ds }); dongMenu(); return; }
      const b = e.target.closest('[data-mau]');
      if (b) {
        dongMenu();
        const o = $('#oPrompt');
        o.value = (o.value.trim() ? o.value.replace(/\s*$/, '\n') : '') + S.mauPrompt[+b.dataset.mau].noiDung;
        U.nhap[loaiTrang()] = o.value; luuUi(); veTao(); o.focus();
        return;
      }
      if (e.target.closest('[data-luu-mau]')) {
        dongMenu();
        const nd = $('#oPrompt').value.trim();
        if (!nd) { toast('Ô Prompt đang trống', true); return; }
        const v = await hoi({ tieuDe: 'Lưu mẫu prompt', html: '<label>Tên mẫu<input name="ten" placeholder="vd: Tranh truyện người que 9:16"></label>', ok: 'Lưu' });
        if (v && v.ten.trim()) { api.call('luuMauPrompt', { ds: [...S.mauPrompt, { ten: v.ten.trim(), noiDung: nd }] }); toast('Đã lưu mẫu'); }
      }
    };

    // Hàng đợi
    $('#oTim').addEventListener('input', (e) => { U.tim = e.target.value; veHang(); });
    $('#tabsLoc').onclick = (e) => { const b = e.target.closest('[data-loc]'); if (b) { U.loc = b.dataset.loc; luuUi(); veHang(); } };
    $('#nutSapXep').onclick = () => { U.moiNhat = !U.moiNhat; luuUi(); veHang(); };
    $('#nutDatLai').onclick = datLaiHangDoi;
    $('#dsHang').addEventListener('click', (e) => {
      const dong = e.target.closest('.dong-viec');
      if (!dong) return;
      const id = +dong.dataset.id;
      if (e.target.matches('[data-chon]')) { e.target.checked ? U.chon.add(id) : U.chon.delete(id); veHang(); return; }
      const m = e.target.closest('[data-menu]');
      if (m) { e.stopPropagation(); moMenuDong(m, viecTheoId(id)); return; }
      const dk = e.target.closest('[data-dk]');
      if (dk) { e.stopPropagation(); dieuKhienViec(dk.dataset.dk, [id]); return; }
      U.chiTiet = id;
      for (const d of $$('#dsHang .dong-viec')) d.classList.toggle('chon', +d.dataset.id === id);
      veChiTiet();
    });
    $('#dsHang').addEventListener('dblclick', (e) => {
      const dong = e.target.closest('.dong-viec');
      const j = dong && viecTheoId(+dong.dataset.id);
      if (j && j.files && j.files[0]) moXemLon(j.files[0], j.loai);
    });
    $('#chonBo').onclick = () => { U.chon.clear(); veHang(); };
    $('#chonXoa').onclick = async () => {
      const ids = [...U.chon];
      if (await xacNhan('Xoá các việc đã chọn?', `Xoá ${ids.length} việc khỏi hàng đợi (file đã tải vẫn giữ).`, 'Xoá', true)) {
        await api.call('xoaViec', { ids }); U.chon.clear();
      }
    };
    $('#chonXoaChat').onclick = async () => {
      const ids = [...U.chon];
      if (!await xacNhan('Xoá chat Muse của các việc đã chọn?', `Xoá đoạn chat trên muse.ai của ${ids.length} việc đã chọn (không khôi phục được). Việc và file đã tải vẫn giữ.`, 'Xoá chat', true)) return;
      toast('Đang xoá chat trên Muse… (xem Nhật ký)');
      const r = await api.call('xoaChatViec', { ids });
      U.chon.clear(); veHang();
      toast(r && r.ok ? `Đã xoá ${r.da} đoạn chat${r.hong ? ` · ${r.hong} không xoá được` : ''}${r.boQua ? ` · ${r.boQua} việc không có chat` : ''}` : (r && r.loi) || 'Không xoá được', !(r && r.ok) || !!r.hong);
    };
    $('#chonTai').onclick = async () => {
      const ids = [...U.chon];
      const v = await hoi({ tieuDe: `Tải về ${ids.length} việc đã chọn`, ok: 'Chọn thư mục…', html: `
        <label>Đặt tên file<input name="mau" value="${esc(U.mauTai || HD.MAU_TEN_ANH_MAC_DINH)}" placeholder="${HD.MAU_TEN_ANH_MAC_DINH}"></label>
        <small><code>{stt}</code> số thứ tự prompt (154 → <code>154.mp4</code>) · <code>{tenAnh}</code> tên ảnh nguồn · <code>{duAn}</code> · <code>{so}</code> · <code>{prompt}</code> · <code>{ngay}</code> · dấu <code>/</code> tạo thư mục con. Trùng tên thì thêm (2), không ghi đè.</small>
        <label class="hang-tk"><input type="checkbox" name="tuChat" checked>File trên máy không còn thì lấy lại từ chat Muse cũ (không gửi lại prompt, không tốn lượt)</label>` });
      if (!v) return;
      U.mauTai = v.mau.trim(); luuUi();
      toast('Đang tải về… (xem Nhật ký)');
      const r = await api.call('taiNhieu', { ids, mau: U.mauTai, tuChat: v.tuChat });
      if (r && r.ok) toast(`Đã tải ${r.da} file về ${r.thuMuc}${r.layLai ? ` · ${r.layLai} lấy lại từ chat Muse` : ''}${r.hong ? ` · ${r.hong} việc không tải được (xem Nhật ký)` : ''}`, !!r.hong);
      else if (r && r.loi) toast(r.loi, true);
    };
    $('#chonChayLai').onclick = async () => {
      const n = await api.call('taoLai', { ids: [...U.chon], chay: true });
      U.chon.clear();
      toast(`Đã tạo lại ${n} việc và chạy ngay`);
    };
    $('#chonChay').onclick = () => { dieuKhienViec('chayViec', [...U.chon]); U.chon.clear(); };
    // 1.4.0
    $('#chonDoiPrompt').onclick = () => doiPromptNhieu([...U.chon]);
    $('#chonSangMuse').onclick = () => doiNen([...U.chon], 'muse');
    $('#chonSangFlow').onclick = () => doiNen([...U.chon], 'flow');
    $('#chonDrive').onclick = () => lenDrive([...U.chon]);
    $('#chonDung').onclick = () => { dieuKhienViec('dungViec', [...U.chon]); U.chon.clear(); };

    // Chi tiết
    $('#chiTiet').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ct]');
      const j = viecTheoId(U.chiTiet);
      if (b && j && !b.disabled) hanhDong(b.dataset.ct, j);
    });
    $('#nutPhongTo').onclick = () => { const j = viecTheoId(U.chiTiet); if (j && j.files && j.files[0]) moXemLon(j.files[0], j.loai); };
    $('#dongXemLon').onclick = () => { $('#xemLon').hidden = true; $('#xemLonNoiDung').innerHTML = ''; };
    $('#xemLon').addEventListener('click', (e) => { if (e.target.id === 'xemLon') $('#dongXemLon').click(); });

    // Nhân vật
    $('#nutThemNV').onclick = () => suaNhanVat('');
    $('#dsNhanVat').onclick = async (e) => {
      const s = e.target.closest('[data-sua-nv]'), x = e.target.closest('[data-xoa-nv]');
      if (s) suaNhanVat(s.dataset.suaNv);
      if (x) {
        const n = S.nhanVat.find((v) => v.id === x.dataset.xoaNv);
        if (n && await xacNhan('Xoá nhân vật?', `Xoá "${esc(n.ten)}".`, 'Xoá', true)) api.call('xoaNhanVat', { id: n.id });
      }
    };

    // Thư viện
    $('#locThuVien').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { U.tvLoc = b.dataset.v; luuUi(); veThuVien(); } };
    $('#duAnThuVien').onchange = (e) => { U.tvDuAn = e.target.value; luuUi(); veThuVien(); };
    $('#dsThuVien').onclick = (e) => { const o = e.target.closest('[data-tv]'); const j = o && viecTheoId(+o.dataset.tv); if (j) moXemLon(j.files[0], j.loai); };

    // Tài khoản
    $('#nutChayLaiTk').onclick = async () => {
      const r = await api.call('chayLaiMoiTaiKhoan');
      toast(r && r.so ? `${r.so} tài khoản đang nghỉ / lỗi được cho nhận việc lại ngay` : 'Không có tài khoản nào đang nghỉ vì lỗi', !(r && r.so));
    };
    $('#nutCapNhatToken').onclick = async () => {
      const b = $('#nutCapNhatToken'); b.disabled = true;
      toast('Đang đọc mức token của các tài khoản đang bật…');
      try { await api.call('capNhatToken'); toast('Đã cập nhật mức token'); } finally { b.disabled = false; }
    };
    const themTk = async (nen) => {
      const v = await hoi({ tieuDe: `Thêm tài khoản ${TEN_NEN[nen]}`, html: `<label>Tên gợi nhớ<input name="ten" placeholder="vd: ${TEN_NEN[nen].split(' ').pop()} 2"></label>`, ok: 'Thêm' });
      if (!v) return;
      const a = await api.call('themTaiKhoan', { ten: v.ten, nen });
      if (a && a.id) { U.nenTk = nen; luuUi(); veTaiKhoan(); }
      if (a && a.id && await xacNhan('Đăng nhập luôn?', nen === 'flow'
        ? `Mở Google Flow để đăng nhập "${esc(a.ten)}"? Đăng nhập xong, mở (hoặc tạo) một dự án Flow rồi bấm <b>Xong</b>.`
        : `Mở ${{ suno: 'suno.com', drive: 'Google Drive' }[nen] || 'muse.ai'} để đăng nhập "${esc(a.ten)}"?`, 'Đăng nhập')) lenhTaiKhoan('dangNhap', a.id);
    };
    $('#nenTk').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { U.nenTk = b.dataset.v; luuUi(); veTaiKhoan(); } };
    $('#nutThemTK').onclick = () => themTk('muse');
    $('#nutThemTKFlow').onclick = () => themTk('flow');
    $('#nutThemTKSuno').onclick = () => themTk('suno');
    $('#nutThemTKDrive').onclick = () => themTk('drive');
    $('#dsTaiKhoan').addEventListener('click', (e) => { const b = e.target.closest('[data-tk]'); if (b) lenhTaiKhoan(b.dataset.tk, b.dataset.id); });
    $('#nutXongDangNhap').onclick = () => dongDangNhap();
    const baoKhung = () => { if (U.dangNhapMo && U.trang === 'taikhoan') api.call('khungDangNhap', { khung: khungTrinhDuyet() }); };
    new ResizeObserver(baoKhung).observe($('#oTrinhDuyet'));
    window.addEventListener('resize', baoKhung);

    // Cài đặt
    // Tải về & tên file (Cài đặt nâng cao của cột Tạo) — lưu ngay, theo trang ảnh / video.
    $('#ncTai').onchange = (e) => { if (khoaTai().tai) datCD({ [khoaTai().tai]: e.target.checked }); };
    $('#boQuaDaCo').onchange = (e) => datCD({ boQuaDaCo: e.target.checked });   // 1.4.2
    for (const l of ['anh', 'video']) {   // 1.4.2: thẻ "Lưu ảnh & video" ở Cài đặt — lưu ngay như Cài đặt nâng cao của trang Tạo
      $(`#lvTai_${l}`).onchange = (e) => { datCD({ [khoaTai(l).tai]: e.target.checked }); toast(`Đã ${e.target.checked ? 'bật' : 'tắt'} tải ${TEN_LOAI[l]} về máy`); };
      $(`#lvTen_${l}`).addEventListener('input', () => viDuLuu(l));
      $(`#lvTen_${l}`).onchange = (e) => { datCD({ [khoaTai(l).ten]: e.target.value }); toast(`Đã lưu mẫu tên file ${TEN_LOAI[l]}`); };
      $(`#lvChon_${l}`).onclick = async () => { const d = await api.call('chonThuMucRa', { loai: l, duAn: (duAnHienTai() || {}).id }); if (d) $(`#lvThuMuc_${l}`).value = d; };
      $(`#lvMo_${l}`).onclick = () => api.call('moThuMuc', { dir: S.thuMuc[l] });
    }
    $('#nutQuet').onclick = () => quetThuMuc();
    $('#boQuet').onclick = async () => { await api.call('boThuMucQuet', { duAn: U.duAn, loai: loaiTrang() }); $('#ghiQuet').textContent = 'Đã bỏ chọn — quét thư mục lưu của dự án.'; };
    $('#ncTen').addEventListener('input', viDuTen);
    $('#ncTen').onchange = (e) => { datCD({ [khoaTai().ten]: e.target.value }); toast('Đã lưu mẫu tên file'); };
    $('#ncChonThuMuc').onclick = async () => { const d = await api.call('chonThuMucRa', { loai: loaiTrang(), duAn: (duAnHienTai() || {}).id }); if (d) $('#ncThuMuc').value = d; };
    $('#ncMoThuMuc').onclick = () => api.call('moThuMuc', { dir: S.thuMuc[loaiTrang()] });
    $('#cdMoDuLieu').onclick = () => api.call('moThuMucDuLieu');
    // Thư mục video nối từ ảnh: chọn = lưu ngay + tắt "cạnh ảnh"; bật lại "cạnh ảnh" thì thư mục này nằm im.
    $('#cdChonThuMucVideoAnh').onclick = async () => {
      const d = await api.call('chonThuMucVideoAnh', { duAn: (duAnHienTai() || {}).id });
      if (d) { $('#cdVideoCanhAnh').checked = false; $('#cdThuMucVideoAnh').value = d; $('#khoiThuMucVideoAnh').classList.remove('mo-di'); toast('Video tạo từ ảnh sẽ lưu vào thư mục này'); }
    };
    $('#cdMoThuMucVideoAnh').onclick = () => { const d = $('#cdThuMucVideoAnh').value; if (d) api.call('moThuMuc', { dir: d }); };
    $('#cdBoThuMucVideoAnh').onclick = async () => { await datCD({ thuMucVideoAnh: '' }); $('#cdThuMucVideoAnh').value = ''; };
    $('#cdVideoCanhAnh').addEventListener('change', (e) => $('#khoiThuMucVideoAnh').classList.toggle('mo-di', e.target.checked));
    // 1.4.0: Google Drive — thư mục Drive trên máy của dự án đang mở (lưu ngay).
    const idDa = () => (duAnHienTai() || {}).id;
    $('#cdDriveCach').onchange = () => veDriveCach();
    $('#cdDriveTkMoi').onclick = () => { U.nenTk = 'drive'; luuUi(); diToi('taikhoan'); };
    $('#cdChonDrive').onclick = async () => { const d = await api.call('chonThuMucDrive', { duAn: idDa() }); if (d) { $('#cdThuMucDrive').value = d; toast(`Thư mục Google Drive: ${d}`); } };
    $('#cdMoDrive').onclick = () => { const d = $('#cdThuMucDrive').value; if (d) api.call('moThuMuc', { dir: d }); else toast('Chưa chọn thư mục Google Drive', true); };
    $('#cdTimDrive').onclick = async () => {
      const ds = (await api.call('timDrive')) || [];
      if (!ds.length) { toast('Không thấy thư mục Google Drive trên máy — cài Google Drive cho máy tính, đăng nhập rồi bấm lại (hoặc bấm Chọn…)', true); return; }
      let chon = ds[0];
      if (ds.length > 1) {
        const v = await hoi({ tieuDe: 'Chọn thư mục Google Drive', ok: 'Dùng thư mục này', html: `<label>Thấy ${ds.length} thư mục Drive trên máy<select name="d">${ds.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>` });
        if (!v) return;
        chon = v.d;
      }
      await api.call('datThuMucDrive', { duAn: idDa(), thuMuc: chon });
      $('#cdThuMucDrive').value = chon;
      toast(`Thư mục Google Drive: ${chon}`);
    };
    // Hẹn giờ
    $('#chipHen').onclick = () => diToi('hengio');
    for (const the of $$('#trang-hengio .the-hen')) {
      const l = the.dataset.loai, o = (k) => $(`[data-hen="${k}"]`, the);
      o('bat').onchange = () => veHenGio();
      o('duAn').onchange = () => veHenGio();
      o('boKetThuc').onclick = () => { o('ketThuc').value = ''; };
      o('luu').onclick = async () => {
        const hen = { bat: o('bat').checked, batDau: o('batDau').value, ketThuc: o('ketThuc').value, lap: o('lap').value, duAn: o('duAn').value };
        if (!hen.batDau) { toast('Chọn giờ bắt đầu', true); return; }
        const r = await api.call('datHenGio', { loai: l, hen });
        if (!r || !r.ok) { toast((r && r.loi) || 'Không lưu được hẹn giờ', true); return; }
        S.henGio = S.henGio || {};
        S.henGio[l] = { ...r.henGio, lanToi: (S.henGio[l] || {}).lanToi };
        napHenGio(l);
        toast(hen.bat ? `Đã hẹn ${TEN_TRANG[l]} lúc ${r.henGio.batDau}${r.henGio.ketThuc ? `, dừng ${r.henGio.ketThuc}` : ''}` : `Đã tắt hẹn giờ ${TEN_TRANG[l]}`);
      };
      o('dung').onclick = () => api.call('dungHen', { loai: l });
    }
    $('#cdKiemCapNhat').onclick = () => api.call('kiemCapNhat');
    $('#cdXemLuong').onchange = (e) => api.call('xemLuong', { bat: e.target.checked });
    $('#cdMauGoc').onclick = () => { $('#cdMauAnh').value = HD.MAU_MAC_DINH.anh; $('#cdMauVideo').value = HD.MAU_MAC_DINH.video; };
    $('#cdLuu').onclick = async () => {
      const batDrive = $('#cdDrive').checked && !S.caiDat.driveBat && (S.caiDat.taiAnh || S.caiDat.taiVideo);   // 1.4.1: vừa bật Drive → app tự tắt tải về máy
      await datCD({
        luongMoiTK: $('#cdLuong').value, nghiGiuaLanGui: $('#cdNghi').value, tuThuLai: $('#cdThuLai').value, tuChayLaiLoi: $('#cdChayLaiLoi').value,
        choAnhGiay: $('#cdChoAnh').value, choVideoGiay: $('#cdChoVideo').value, choChuGiay: $('#cdChoChu').value, choNhacGiay: $('#cdChoNhac').value,
        png: $('#cdPng').checked, doiNenKhiLoi: $('#cdDoiNen').checked, tatMayKhiXong: $('#cdTatMay').checked,
        videoCanhAnh: $('#cdVideoCanhAnh').checked, xoaChatKhiXong: $('#cdXoaChat').checked, xoaDuAnFlowKhiXong: $('#cdXoaDuAnFlow').checked,
        driveBat: $('#cdDrive').checked, driveCach: $('#cdDriveCach').value, driveTk: $('#cdDriveTk').value, nheMay: $('#cdNheMay').checked,
        mau: { anh: $('#cdMauAnh').value, video: $('#cdMauVideo').value },
        flow: docCaiDatFlow()
      });
      veCaiDat();
      if ($('#cdDrive').checked && $('#cdDriveCach').value === 'may' && !$('#cdThuMucDrive').value) { toast('Đã lưu — nhưng chưa chọn thư mục Google Drive (bấm Tự tìm hoặc Chọn…)', true); return; }
      if ($('#cdDrive').checked && $('#cdDriveCach').value === 'web' && !$('#cdDriveTk').value) { toast('Đã lưu — nhưng chưa chọn tài khoản Google Drive (Tài khoản → Drive)', true); return; }
      toast(batDrive ? 'Đã lưu — bật đưa lên Google Drive nên đã tự tắt "Tải ảnh về" và "Tải video về"'
        : `Đã lưu cài đặt của dự án "${(duAnHienTai() || {}).ten || ''}"`);
    };

    // Nhật ký
    $('#nutNhatKy').onclick = () => {
      const n = $('#nganLog'); n.hidden = !n.hidden;
      $('#nutNhatKy').classList.toggle('on', !n.hidden);
      if (!n.hidden) { veLog(); U.loiChuaXem = 0; veDemLoi(); }
    };
    $('#nutXuatLog').onclick = async () => {
      if (!U.log.length) { toast('Nhật ký đang trống', true); return; }
      const r = await api.call('xuatNhatKy', { chu: U.log.map(dongLogText).join('\n') });
      if (r && r.ok) toast(`Đã lưu nhật ký: ${r.file}`);
    };
    $('#nutSaoChepLog').onclick = async () => { await navigator.clipboard.writeText(U.log.map(dongLogText).join('\n')); toast('Đã sao chép nhật ký'); };
    $('#nutXoaLog').onclick = () => { U.log = []; api.call('xoaNhatKy'); $('#dongCuoi').textContent = ''; veLog(); };
  }

  // ── Khởi động ────────────────────────────────────────────────────────────
  veIcon(document);
  ganSuKien();
  api.onState((s) => {
    S = s;
    S.nhanLuc = s.luc || Date.now();
    apDuAn();
    ve();
    if (U.trang === 'caidat') veCapNhat();
  });
  api.onLog(themLog);
  api.call('trangThai').then((s) => {
    S = s;
    S.nhanLuc = s.luc || Date.now();
    apDuAn();
    for (const d of s.nhatKy || []) themLog(d);
    diToi(TEN_TRANG[U.trang] ? U.trang : 'anh');
  });
  setInterval(() => { capNhatTienDo(); if (S) veDongHo(); }, 1000);
})();
