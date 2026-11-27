// Mẫu BẢN ĐỒ HÀNH TRÌNH: bản đồ cổ (đất liền Natural Earth + sông hồ vẽ tay) trên nền ảnh của cảnh,
// đường đi vẽ dần qua các địa danh theo thứ tự, mỗi địa danh hiện khi đường đi tới.
import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Nen, TieuDe, usePhong, useGio, doRong, mauNhan, tien, khungDung, SERIF, SANS, TRANG, rgba} from './chung.jsx';
import DAT from './dat-lien.json';
import {SONG, HO} from './song-ho.js';

/** Khung nhìn ôm mọi địa danh (độ), có lề; tối thiểu ~3,4° để còn thấy bờ biển, sông hồ quanh đó. */
function khungNhin(diem, w, h) {
  const lat = diem.map((d) => d.lat), lon = diem.map((d) => d.lon);
  let la0 = Math.min(...lat), la1 = Math.max(...lat), lo0 = Math.min(...lon), lo1 = Math.max(...lon);
  const phi = ((la0 + la1) / 2) * Math.PI / 180;
  const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
  let sLa = Math.max(3.4, (la1 - la0) * 1.5), sLo = Math.max(3.4 / Math.cos(phi), (lo1 - lo0) * 1.45);
  // vùng vẽ chừa phần tiêu đề phía trên
  const vw = w * 0.9, vh = h * 0.7;
  const pxDo = Math.min(vw / (sLo * Math.cos(phi)), vh / sLa);
  const oy = h * 0.58;
  return {
    pxDo, phi,
    p: (la, lo) => [w / 2 + (lo - cx) * Math.cos(phi) * pxDo, oy - (la - cy) * pxDo],
  };
}

const duongDat = (chieu) => DAT.rings.map((r) => {
  const pts = r[0] === 'h' ? r[1] : r;
  let s = '';
  for (let i = 0; i < pts.length; i += 2) { const [x, y] = chieu(pts[i + 1], pts[i]); s += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  return s + 'Z';
}).join(' ');

/** Đường đi cong nhẹ giữa hai điểm → mảng điểm mẫu. */
function cung(a, b, cong, n = 40) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const cx = mx - dy * cong, cy = my + dx * cong;
  const out = [];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    out.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * cx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * cy + u * u * b[1]]);
  }
  return out;
}

/** Chọn chỗ đặt nhãn không đè nhãn / chấm khác. */
function xepNhan(pts, ten, font, fs, w, h) {
  const hop = [];
  const cham = pts.map(([x, y]) => [x - fs * 0.4, y - fs * 0.4, x + fs * 0.4, y + fs * 0.4]);
  const de = (b, c) => !(b[2] < c[0] || b[0] > c[2] || b[3] < c[1] || b[1] > c[3]);
  return pts.map(([x, y], i) => {
    const tw = doRong(ten[i], font), th = fs * 1.15, g = fs * 0.55;
    const thu = [
      [x + g, y - th / 2], [x - g - tw, y - th / 2], [x - tw / 2, y - g - th], [x - tw / 2, y + g],
      [x + g, y - th - g * 0.3], [x - g - tw, y + g * 0.3], [x + g, y + g * 0.3], [x - g - tw, y - th - g * 0.3],
    ];
    let chon = null;
    for (const [lx, ly] of thu) {
      const b = [lx - 6, ly - 4, lx + tw + 6, ly + th + 4];
      if (b[0] < 20 || b[2] > w - 20 || b[1] < h * 0.22 || b[3] > h - 20) continue;
      if (hop.some((c) => de(b, c)) || cham.some((c, j) => j !== i && de(b, c))) continue;
      chon = [lx, ly, b]; break;
    }
    if (!chon) { const [lx, ly] = thu[0]; chon = [lx, ly, [lx, ly, lx + tw, ly + th]]; }
    hop.push(chon[2]);
    return {x: chon[0], y: chon[1], tw, th};
  });
}

export const BanDo = (p) => {
  const san = usePhong();
  const {t, L, w, h, k} = useGio();
  const mau = mauNhan(p);
  const diem = (p.diem || []).filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lon));
  const tuyen = p.tuyen !== false && diem.length > 1;
  const v = useMemo(() => (diem.length ? khungNhin(diem, w, h) : null), [JSON.stringify(diem), w, h]);
  const dat = useMemo(() => (v ? duongDat(v.p) : ''), [v]);
  const fs = 38 * k;
  const pts = useMemo(() => (v ? diem.map((d) => v.p(d.lat, d.lon)) : []), [v]);
  // địa danh lặp lại (đi rồi quay về) chỉ vẽ chấm + nhãn ở lần đầu
  const dau1 = diem.map((d, i) => diem.findIndex((e) => Math.abs(e.lat - d.lat) < 1e-6 && Math.abs(e.lon - d.lon) < 1e-6) === i);
  const nhan = useMemo(() => {
    if (!san || !v) return [];
    const chi = pts.map((_, i) => i).filter((i) => dau1[i]);
    const xep = xepNhan(chi.map((i) => pts[i]), chi.map((i) => diem[i].ten), `600 ${fs}px "AS Serif"`, fs, w, h);
    const ra = pts.map(() => null);
    chi.forEach((i, j) => { ra[i] = xep[j]; });
    return ra;
  }, [san, v]);
  // đường đi: mẫu điểm + độ dài cộng dồn
  const duong = useMemo(() => {
    if (!tuyen) return null;
    const mau2 = [pts[0]];
    const moc = [0];
    // quãng đi lại (A→B rồi B→A) cong về phía bên kia cho khỏi đè lên nhau
    const daDi = new Map();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const k1 = `${a[0].toFixed(1)},${a[1].toFixed(1)}`, k2 = `${b[0].toFixed(1)},${b[1].toFixed(1)}`;
      const cu = daDi.get(`${k2}|${k1}`), cu2 = daDi.get(`${k1}|${k2}`);
      const c = cu != null ? cu : cu2 != null ? -cu2 : i % 2 ? 0.12 : -0.12;
      daDi.set(`${k1}|${k2}`, c);
      mau2.push(...cung(a, b, c));
      moc.push(mau2.length - 1);
    }
    const dai = [0];
    for (let i = 1; i < mau2.length; i++) dai.push(dai[i - 1] + Math.hypot(mau2[i][0] - mau2[i - 1][0], mau2[i][1] - mau2[i - 1][1]));
    return {mau2, moc, dai, tong: dai[dai.length - 1] || 1};
  }, [pts, tuyen]);
  if (!san || !v) return <Nen anh={p.anh} />;

  const t0 = 1.3;
  const t1 = t0 + khungDung(L - t0, 1.4 + diem.length * 1.5);
  const u = tien(t, t0, t1, (x) => x);   // đường đi đều tốc độ
  const banDo = tien(t, 0.3, 1.2);
  const zoom = interpolate(t, [0, L], [1.07, 1.0]);
  // thời điểm đường đi chạm mỗi điểm
  const tToi = diem.map((_, i) => (tuyen ? t0 + (duong.dai[duong.moc[i]] / duong.tong) * (t1 - t0) : t0 + i * Math.min(0.9, (t1 - t0) / Math.max(1, diem.length))));
  let dau = null, ve = '';
  if (tuyen) {
    const can = u * duong.tong;
    let i = 1;
    ve = `M${duong.mau2[0][0].toFixed(1)} ${duong.mau2[0][1].toFixed(1)}`;
    for (; i < duong.mau2.length && duong.dai[i] <= can; i++) ve += `L${duong.mau2[i][0].toFixed(1)} ${duong.mau2[i][1].toFixed(1)}`;
    if (i < duong.mau2.length) {
      const a = duong.mau2[i - 1], b = duong.mau2[i];
      const f = (can - duong.dai[i - 1]) / Math.max(0.001, duong.dai[i] - duong.dai[i - 1]);
      dau = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      ve += `L${dau[0].toFixed(1)} ${dau[1].toFixed(1)}`;
    } else dau = duong.mau2[duong.mau2.length - 1];
  }
  const luoi = [];
  const buoc = v.pxDo > 120 ? 1 : v.pxDo > 40 ? 2 : 5;
  for (let lo = Math.floor(-15 / buoc) * buoc; lo <= 70; lo += buoc) { const [x] = v.p(30, lo); if (x > -50 && x < w + 50) luoi.push(<line key={'x' + lo} x1={x} y1={0} x2={x} y2={h} />); }
  for (let la = 0; la <= 55; la += buoc) { const [, y] = v.p(la, 30); if (y > -50 && y < h + 50) luoi.push(<line key={'y' + la} x1={0} y1={y} x2={w} y2={y} />); }
  const chieu = (pt) => pt.map(([la, lo]) => v.p(la, lo).map((n) => n.toFixed(1)).join(' ')).join(' L');

  return (
    <AbsoluteFill>
      <Nen anh={p.anh} toi={0.5} mo={4} tint="rgba(14,34,48,0.55)" />
      <AbsoluteFill style={{opacity: banDo, transform: `scale(${zoom})`}}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <defs>
            <filter id="giay" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="4" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.21  0 0 0 0 0.10  0 0 0 1.1 -0.38" result="m" />
              <feComposite in="m" in2="SourceGraphic" operator="in" result="c" />
              <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="c" /></feMerge>
            </filter>
            <filter id="bong" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={6 * k} /></filter>
          </defs>
          <g stroke="rgba(226,214,190,0.10)" strokeWidth={1}>{luoi}</g>
          <path d={dat} fill="rgba(0,0,0,0.35)" transform={`translate(${5 * k} ${7 * k})`} filter="url(#bong)" fillRule="evenodd" />
          <path d={dat} fill="rgba(206,186,146,0.92)" stroke="rgba(92,70,40,0.75)" strokeWidth={1.6 * k} fillRule="evenodd" filter="url(#giay)" />
          <g fill="none" stroke="rgba(62,104,132,0.85)" strokeWidth={2.4 * k} strokeLinecap="round" strokeLinejoin="round">
            {SONG.map((s, i) => <path key={i} d={'M' + chieu(s)} />)}
          </g>
          <g fill="rgba(62,104,132,0.9)" stroke="rgba(40,70,90,0.9)" strokeWidth={1 * k}>
            {HO.map((s, i) => <path key={i} d={'M' + chieu(s) + 'Z'} />)}
          </g>
          {tuyen ? (
            <>
              <path d={ve} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={9 * k} strokeLinecap="round" strokeLinejoin="round" />
              <path d={ve} fill="none" stroke={mau} strokeWidth={5 * k} strokeDasharray={`${16 * k} ${11 * k}`} strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : null}
          {pts.map(([x, y], i) => {
            if (!dau1[i]) return null;
            const a = tien(t, tToi[i] - 0.05, tToi[i] + 0.45);
            if (a <= 0) return null;
            const pop = 1 + 0.6 * Math.sin(Math.min(1, a) * Math.PI) * (1 - a * 0.3);
            const vong = tien(t, tToi[i], tToi[i] + 1.1);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={(10 + 34 * vong) * k} fill="none" stroke={mau} strokeWidth={3 * k} opacity={(1 - vong) * 0.9} />
                <circle cx={x} cy={y} r={11 * k * pop * a} fill="rgb(30,22,14)" stroke={mau} strokeWidth={4 * k} />
                <circle cx={x} cy={y} r={4.5 * k * a} fill={mau} />
              </g>
            );
          })}
          {tuyen && dau && u > 0 && u < 1 ? <circle cx={dau[0]} cy={dau[1]} r={9 * k} fill={TRANG} stroke={mau} strokeWidth={3 * k} /> : null}
        </svg>
        {nhan.map((n, i) => {
          if (!n) return null;
          const a = tien(t, tToi[i] + 0.1, tToi[i] + 0.7);
          if (a <= 0) return null;
          return (
            <div key={i} style={{position: 'absolute', left: n.x, top: n.y, height: n.th, lineHeight: `${n.th}px`, whiteSpace: 'nowrap',
              fontFamily: SERIF, fontWeight: 600, fontSize: fs, color: 'rgb(36,26,14)', opacity: a,
              transform: `translateY(${(1 - a) * 10 * k}px)`,
              textShadow: `0 0 ${6 * k}px rgba(236,222,190,0.95), 0 0 ${12 * k}px rgba(236,222,190,0.8)`}}>{diem[i].ten}</div>
          );
        })}
      </AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h * 0.3, background: 'linear-gradient(rgba(8,7,6,0.75), rgba(8,7,6,0))', opacity: banDo}} />
      <TieuDe nhan={p.nhan} tieuDe={p.tieuDe} mau={mau} />
      {p.chuThich ? (
        <div style={{position: 'absolute', right: 50 * k, bottom: 40 * k, fontFamily: SANS, fontWeight: 700, fontSize: 22 * k, letterSpacing: 2 * k,
          color: rgba('#E2D6BE', 0.75 * tien(t, 1, 2))}}>{p.chuThich}</div>
      ) : null}
    </AbsoluteFill>
  );
};
