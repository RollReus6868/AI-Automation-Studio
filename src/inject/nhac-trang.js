// ============================================================================
//  nhac-trang.js — trình trợ giúp tiêm vào trang Google Flow Music (flowmusic.app), window.__fmusic.
//  MỌI chỗ dò giao diện Flow Music nằm ở file này. Đo trên trang thật 17/11/2026 (tài khoản Free,
//  giao diện nửa Việt nửa Anh — nhãn aria tiếng Anh):
//   - trang chủ "/" và trang phiên "/session/<id>": ô chat textarea[aria-label="Chat message"]
//     (placeholder "Cùng sáng tác nào..." / "Ask Producer..."), nút gửi button[aria-label="Send message"]
//     (disabled khi ô trống; lúc Producer đang làm thì đổi thành nút ■ dừng);
//   - gửi xong trang chuyển sang /session/<id>, hiện "Thinking" → "Creating "<tên>"…" → mỗi bài một hàng
//     đang tạo: <span>27%</span> + h4[role=status] "Generating <tên>..." → xong thành thẻ bài
//     [role=button][aria-label="Open details for <tên>"] chứa a[href="/song/<id>"] và các nút
//     "Play/Pause <tên>", "Remix …", "Make a 15s Shorts video for …", "Share link for …", "Like …",
//     "Dislike …", "More options for <tên>". Một lần gửi ra 2 bài (A/B).
//   - Tải: "More options for <tên>" → menu Remix / Details / Download ▸ / Share… / Create video / Add to… /
//     Split stems / Report / Delete; Download ▸ → Download video / Get stems / M4A / MP3 / WAV.
//     Bấm MP3: trang gọi /__api/download/audio/<id>?format=mp3, tạo blob rồi bấm <a download="<tên>.mp3">
//     → Electron bắt bằng will-download. Toast "Success · Downloaded <tên>.mp3".
//   - Thời lượng bài không ghi trên thẻ: đọc metadata file nghe thử mà chính trang phát
//     (storage.googleapis.com/producer-app-public/clips/<id>.m4a).
//   - Đã đăng nhập: thanh bên có button[aria-label="Settings menu"] (menu ghi "<n> credits").
// ============================================================================
(function () {
  if (window.__fmusic && window.__fmusic.phienBan === 1) return;

  const $$ = (s, g) => Array.from((g || document).querySelectorAll(s));
  const nhinThay = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
  const chu = (e) => String((e && (e.innerText || e.textContent)) || '').replace(/\s+/g, ' ').trim();
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

  const NHAN = {
    oChat: 'textarea[aria-label="Chat message"]',
    nutGui: 'button[aria-label="Send message"]',
    the: '[role="button"][aria-label^="Open details for"]',
    nutThem: 'button[aria-label^="More options for"]',
    caiDatTk: 'button[aria-label="Settings menu"]',
    dangNhap: /^(sign in|log in|sign up|get started|đăng nhập|đăng ký|bắt đầu)$/i,
    dung: /^(stop|dừng)/i,
    dangTao: /^(generating|đang tạo)\b/i,
    taiVe: /^(download|tải xuống|tải về)$/i,
    mp3: /^mp3$/i,
    // Producer trả lời "hết credit / chạm giới hạn" thay vì tạo bài (chưa thấy câu thật — đoán rộng, VI/EN).
    hetLuot: /(out of|not enough|no more|insufficient|run out of|ran out of|used (up )?all( of)?( your)?)\s+(daily\s+)?credits?|credits? (left|remaining)\s*:?\s*0\b|(daily|generation|usage) limit|limit reached|reached (your|the) (daily )?(limit|quota)|upgrade (your plan )?to (keep|continue)|hết credit|không đủ credit|hết lượt|đã đạt giới hạn/i
  };

  /** Bấm như chuột thật (Radix mở menu ở pointerdown). */
  function bam(e) {
    const r = e.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    const p = { ...o, pointerId: 1, isPrimary: true, pointerType: 'mouse' };
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      e.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, p));
    }
    e.dispatchEvent(new PointerEvent('pointerdown', p));
    e.dispatchEvent(new MouseEvent('mousedown', o));
    e.dispatchEvent(new PointerEvent('pointerup', p));
    e.dispatchEvent(new MouseEvent('mouseup', o));
    e.dispatchEvent(new MouseEvent('click', o));
  }
  /** Gán giá trị cho ô nhập React (setter gốc + sự kiện input). */
  function dien(el, giaTri) {
    const goc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    el.focus();
    goc.set.call(el, giaTri);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const oChat = () => $$(NHAN.oChat).find(nhinThay) || $$(NHAN.oChat)[0] || null;
  const nutGui = () => $$(NHAN.nutGui).find(nhinThay) || null;
  const nutDung = () => $$('button').find((b) => nhinThay(b) && NHAN.dung.test(String(b.getAttribute('aria-label') || '').trim())) || null;

  /** Các thẻ bài đã xong trên trang: [{id, ten, el}] theo thứ tự trên trang. */
  function dsThe() {
    const ra = [];
    for (const el of $$(NHAN.the)) {
      const a = el.querySelector('a[href*="/song/"]');
      const m = a && String(a.getAttribute('href') || '').match(/\/song\/([^/?#]+)/);
      if (!m || ra.some((x) => x.id === m[1])) continue;
      ra.push({ id: m[1], ten: String(el.getAttribute('aria-label') || '').replace(/^Open details for\s*/i, '').trim() || chu(a), el });
    }
    return ra;
  }
  /** Các hàng đang tạo: [{ten, pt}] ("Generating <tên>..." + "27%"). */
  function dsDangTao() {
    return $$('[role="status"]').filter((e) => NHAN.dangTao.test(chu(e))).map((e) => {
      const hang = e.parentElement && e.parentElement.parentElement;
      const pt = hang ? (chu(hang).match(/(\d{1,3})\s*%/) || [])[1] : '';
      return { ten: chu(e).replace(NHAN.dangTao, '').replace(/\.{3}|…/g, '').trim(), pt: pt ? Number(pt) : null };
    });
  }
  /** Chữ thông báo nổi (toast) đang hiện. */
  function thongBao() {
    return $$('[data-sonner-toast], [role="alert"], li[role="status"], [data-radix-toast-announce-exclude]')
      .filter(nhinThay).map(chu).filter(Boolean).join(' · ').slice(0, 400);
  }

  window.__fmusic = {
    phienBan: 1,

    trangThai() {
      const o = oChat();
      const daDangNhap = !!$$(NHAN.caiDatTk)[0];
      const coNutDangNhap = $$('a, button').some((b) => nhinThay(b) && NHAN.dangNhap.test(chu(b)));
      return {
        coO: !!o, daDangNhap,
        canDangNhap: !daDangNhap && (coNutDangNhap || /accounts\.google\.com|\/login|\/sign-?in/i.test(location.href)),
        phien: (location.pathname.match(/\/session\/([^/?#]+)/) || [])[1] || ''
      };
    },

    /** Dán prompt vào ô chat rồi bấm Gửi. */
    async gui(prompt) {
      const o = oChat();
      if (!o) return { ok: false, loi: 'khong-thay-o-chat' };
      dien(o, String(prompt));
      let nut = null;
      for (let i = 0; i < 40; i++) {
        nut = nutGui();
        if (nut && !nut.disabled && o.value) break;
        await ngu(150);
      }
      if (o.value !== String(prompt)) return { ok: false, loi: 'khong-dien-duoc-prompt' };
      if (!nut || nut.disabled) return { ok: false, loi: 'nut-gui-khong-bam-duoc' };
      bam(nut);
      return { ok: true };
    },

    /** Tình hình phiên: bài xong, bài đang tạo, Producer còn đang làm không, chữ trên trang (để đọc câu báo lỗi). */
    tinhTrang(prompt) {
      const the = dsThe().map(({ id, ten }) => ({ id, ten }));
      const dangTao = dsDangTao();
      const main = document.querySelector('main') || document.body;
      let chuTrang = chu(main);
      if (prompt) chuTrang = chuTrang.split(String(prompt).replace(/\s+/g, ' ').trim()).join(' ');
      const dangNghi = /\bthinking\b|đang suy nghĩ/i.test(chuTrang.slice(-600)) || /creating\s*["“]/i.test(chuTrang);
      const g = nutGui();
      return {
        phien: (location.pathname.match(/\/session\/([^/?#]+)/) || [])[1] || '',
        the, dangTao,
        ban: !!nutDung() || (!g && !!oChat()),
        dangNghi,
        chuTrang: chuTrang.slice(-1500),
        thongBao: thongBao()
      };
    },

    /** Câu "hết credit / giới hạn" trong chữ (rỗng = không phải). */
    cauHetLuot(s) {
      const m = String(s || '').match(NHAN.hetLuot);
      if (!m) return '';
      const t = String(s);
      const i = Math.max(0, t.lastIndexOf('.', m.index) + 1);
      const doan = t.slice(i, i + 200);
      const het = doan.search(/[.!?](?=[^.!?]*$)/);   // cắt sau dấu câu cuối (bỏ chữ nút / thẻ dính sau câu)
      return (het >= 0 && het >= m.index - i ? doan.slice(0, het + 1) : doan).trim();
    },

    /** Thời lượng (giây) của các bài theo id — đọc metadata file nghe thử của trang. */
    async thoiLuong(ids, msToiDa) {
      const mot = (id) => new Promise((r) => {
        const a = new Audio();
        a.preload = 'metadata';
        a.muted = true;
        const xong = (v) => { try { a.removeAttribute('src'); a.load(); } catch (_) {} r(v); };
        a.onloadedmetadata = () => xong(Number.isFinite(a.duration) ? a.duration : 0);
        a.onerror = () => xong(0);
        setTimeout(() => xong(0), msToiDa || 15000);
        a.src = (window.__fmusicClip || 'https://storage.googleapis.com/producer-app-public/clips/') + encodeURIComponent(id) + '.m4a';
      });
      const ra = {};
      for (const id of ids || []) ra[id] = await mot(id);
      return ra;
    },

    /** Bấm More options của bài → Download ▸ → MP3. Tiến trình chính bắt file bằng will-download. */
    async taiMp3(id) {
      const t = dsThe().find((x) => x.id === id);
      if (!t) return { ok: false, loi: 'khong-thay-bai' };
      const nut = t.el.querySelector(NHAN.nutThem);
      if (!nut) return { ok: false, loi: 'khong-thay-nut-more-options' };
      t.el.scrollIntoView({ block: 'center' });
      const mucMenu = () => $$('[role="menuitem"]').filter(nhinThay);
      let dl = null;
      for (let lan = 0; lan < 3 && !dl; lan++) {
        bam(nut);
        for (let i = 0; i < 15 && !dl; i++) { await ngu(150); dl = mucMenu().find((m) => NHAN.taiVe.test(chu(m))); }
      }
      if (!dl) return { ok: false, loi: 'menu-khong-co-download', menu: mucMenu().map(chu).slice(0, 20) };
      let mp3 = null;
      for (let lan = 0; lan < 3 && !mp3; lan++) {
        dl.focus();
        dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true }));
        for (let i = 0; i < 10 && !mp3; i++) { await ngu(150); mp3 = mucMenu().find((m) => NHAN.mp3.test(chu(m))); }
        if (!mp3) { bam(dl); for (let i = 0; i < 10 && !mp3; i++) { await ngu(150); mp3 = mucMenu().find((m) => NHAN.mp3.test(chu(m))); } }
      }
      if (!mp3) return { ok: false, loi: 'menu-download-khong-co-mp3', menu: mucMenu().map(chu).slice(0, 20) };
      mp3.click();
      return { ok: true };
    },

    dongMenu() {
      for (let i = 0; i < 3; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return true;
    },

    /** Dừng nhạc trang tự phát sau khi tạo xong (cửa sổ ngầm đã tắt tiếng, đây chỉ để bớt tải). */
    dungPhat() {
      for (const a of $$('audio, video')) { try { a.pause(); } catch (_) {} }
      return true;
    }
  };
})();
undefined;
