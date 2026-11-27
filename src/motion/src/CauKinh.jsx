// Mẫu CÂU KINH THÁNH TOÀN MÀN HÌNH: câu hiện dần từng chữ giữa khung, chữ *nhấn* màu nhấn,
// dòng nguyên ngữ (Hê-bơ-rơ / Hy Lạp) mờ phía trên nếu có, tham chiếu hiện cuối cùng.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {Nen, usePhong, useGio, ngatDong, mauNhan, tien, khungDung, SERIF, SANS, HEBREW, TRANG, KEM, rgba} from './chung.jsx';

const RTL = /[֐-׿]/;

export const CauKinh = (p) => {
  const san = usePhong();
  const {t, L, w, h, k} = useGio();
  const mau = mauNhan(p);
  const cau = String(p.cau || '').trim();
  const bo = useMemo(() => {
    if (!san) return null;
    const rong = w * 0.74, cao = h * (p.goc ? 0.46 : 0.54);
    for (let fs = 76 * k; fs >= 36 * k; fs -= 2 * k) {
      const dong = ngatDong(cau, `600 ${fs}px "AS Serif"`, rong);
      if (dong.length * fs * 1.25 <= cao) return {fs, dong};
    }
    const fs = 36 * k;
    return {fs, dong: ngatDong(cau, `600 ${fs}px "AS Serif"`, rong)};
  }, [san, cau, w, h, p.goc]);
  if (!san || !bo) return <Nen anh={p.anh} />;

  // đánh dấu *nhấn* theo từ (dấu * có thể nằm giữa các từ)
  let nhan = false;
  const dong = bo.dong.map((d) => d.split(' ').map((tu) => {
    const dau = nhan || tu.startsWith('*');
    let chu = tu;
    const soSao = (tu.match(/\*/g) || []).length;
    if (soSao % 2 === 1) nhan = !nhan;
    chu = chu.replace(/\*/g, '');
    return {chu, nhan: dau && chu.length > 0};
  }));
  const tong = dong.reduce((s, d) => s + d.length, 0);
  const t0 = p.goc ? 1.4 : 0.9;
  const t1 = t0 + khungDung(L - t0 - 1, 0.6 + tong * 0.2);
  const lh = bo.fs * 1.25;
  const caoKhoi = dong.length * lh;
  const y0 = h * 0.5 - caoKhoi / 2 + (p.goc ? 40 * k : 0) - (p.tham ? 30 * k : 0);
  let chiSo = 0;
  const thamA = tien(t, t1 + 0.1, t1 + 0.9);
  const gocA = tien(t, 0.7, 1.6);
  const gocRtl = RTL.test(p.goc || '');
  return (
    <AbsoluteFill>
      <Nen anh={p.anh} toi={0.7} mo={9} />
      <div style={{position: 'absolute', left: w / 2 - 90 * k, top: y0 - (p.goc ? 300 : 190) * k, width: 180 * k, textAlign: 'center', fontFamily: SERIF,
        fontSize: 260 * k, lineHeight: 1, color: rgba(mau, 0.22 * tien(t, 0.4, 1.2))}}>“</div>
      {p.nhan ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: h * 0.1, textAlign: 'center', fontFamily: SANS, fontWeight: 700,
          fontSize: 26 * k, letterSpacing: 6 * k, color: mau, textTransform: 'uppercase', opacity: tien(t, 0.4, 1.1)}}>{p.nhan}</div>
      ) : null}
      {p.goc ? (
        <div style={{position: 'absolute', left: w * 0.1, right: w * 0.1, top: y0 - 110 * k, textAlign: 'center', direction: gocRtl ? 'rtl' : 'ltr',
          fontFamily: gocRtl ? HEBREW : SERIF, fontWeight: gocRtl ? 500 : 600, fontSize: (gocRtl ? 50 : 46) * k, color: rgba('#E2D6BE', 0.8 * gocA),
          transform: `translateY(${(1 - gocA) * 14 * k}px)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.goc}</div>
      ) : null}
      {dong.map((d, i) => (
        <div key={i} style={{position: 'absolute', left: 0, right: 0, top: y0 + i * lh, height: lh, textAlign: 'center', whiteSpace: 'nowrap'}}>
          {d.map((tu, j) => {
            const ti = t0 + (chiSo++ / Math.max(1, tong)) * (t1 - t0);
            const a = tien(t, ti, ti + 0.55);
            return (
              <span key={j} style={{display: 'inline-block', fontFamily: SERIF, fontWeight: 600, fontSize: bo.fs, lineHeight: `${lh}px`,
                color: tu.nhan ? mau : TRANG, opacity: a, transform: `translateY(${(1 - a) * 16 * k}px)`, marginRight: j < d.length - 1 ? bo.fs * 0.26 : 0,
                textShadow: `0 ${3 * k}px ${16 * k}px rgba(0,0,0,0.65)`}}>{tu.chu}</span>
            );
          })}
        </div>
      ))}
      {p.tham ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: y0 + caoKhoi + 34 * k, textAlign: 'center', opacity: thamA}}>
          <div style={{width: 120 * k * thamA, height: 2 * k, background: mau, margin: `0 auto ${16 * k}px`}} />
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 30 * k, letterSpacing: 4 * k, color: KEM, textTransform: 'uppercase'}}>{p.tham}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

