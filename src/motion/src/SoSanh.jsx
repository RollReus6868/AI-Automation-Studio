// Mẫu SO SÁNH: hai cột đối nhau (tiêu đề trái / phải), từng cặp dòng hiện xen kẽ trái → phải,
// dòng kết luận hiện cuối cùng ở dưới.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {Nen, TieuDe, usePhong, useGio, ngatDong, mauNhan, tien, khungDung, SERIF, SANS, TRANG, KEM, rgba} from './chung.jsx';

export const SoSanh = (p) => {
  const san = usePhong();
  const {t, L, w, h, k} = useGio();
  const mau = mauNhan(p);
  const trai = p.trai || {dong: []}, phai = p.phai || {dong: []};
  const n = Math.max(trai.dong.length, phai.dong.length);
  const rongCot = w * 0.37;
  const bo = useMemo(() => {
    if (!san) return null;
    const vung = h * 0.5;
    for (let fs = 46 * k; fs >= 24 * k; fs -= 2 * k) {
      const f = `600 ${fs}px "AS Serif"`;
      const L2 = trai.dong.map((d) => ngatDong(d, f, rongCot - 50 * k));
      const R2 = phai.dong.map((d) => ngatDong(d, f, rongCot - 50 * k));
      let cao = 0;
      for (let i = 0; i < n; i++) cao += Math.max((L2[i] || []).length, (R2[i] || []).length, 1) * fs * 1.2 + 34 * k;
      if (cao <= vung || fs <= 24 * k) return {fs, L2, R2, cao};
    }
    return null;
  }, [san, JSON.stringify(trai), JSON.stringify(phai), w, h]);
  if (!san || !bo) return <Nen anh={p.anh} />;

  const coTren = !!(p.tieuDe || p.nhan);
  // cả khối (tiêu đề cột + các dòng + kết luận) nằm giữa phần dưới tiêu đề
  const caoKhoi = 110 * k + bo.cao + (p.ketLuan ? 90 * k : 0);
  const tren = coTren ? h * 0.26 : h * 0.08;
  const yDau = Math.max(tren, tren + (h - tren - caoKhoi) / 2 - 20 * k);
  const t0 = 1.0;
  const t1 = t0 + khungDung(L - t0 - 0.8, 0.8 + n * 1.3);
  const buoc = (t1 - t0 - 0.6) / Math.max(1, n);
  const xT = w / 2 - 30 * k - rongCot, xP = w / 2 + 30 * k;
  const cot = (x, td, ds, ben, tre) => {
    const a = tien(t, t0 - 0.4 + tre, t0 + 0.2 + tre);
    let y = yDau + 96 * k;
    return (
      <div style={{position: 'absolute', left: x, top: yDau, width: rongCot, opacity: a}}>
        <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 34 * k, letterSpacing: 3 * k, color: mau, textAlign: 'center', textTransform: 'uppercase'}}>{td}</div>
        <div style={{height: 2 * k, width: `${100 * a}%`, background: rgba(mau, 0.8), margin: `${14 * k}px auto 0`}} />
        {ds.map((dong, i) => {
          const ti = t0 + 0.6 + i * buoc + (ben ? buoc * 0.45 : 0);
          const v = tien(t, ti, ti + 0.5);
          const caoDong = Math.max((bo.L2[i] || []).length, (bo.R2[i] || []).length, 1) * bo.fs * 1.2 + 34 * k;
          const top = y - yDau;
          y += caoDong;
          if (v <= 0) return null;
          return (
            <div key={i} style={{position: 'absolute', left: 0, right: 0, top, height: caoDong - 14 * k, display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: v, transform: `translateX(${(ben ? 1 : -1) * (1 - v) * 30 * k}px)`, background: 'rgba(16,13,10,0.62)',
              borderLeft: ben ? 'none' : `${4 * k}px solid ${rgba(mau, 0.8)}`, borderRight: ben ? `${4 * k}px solid ${rgba(mau, 0.8)}` : 'none'}}>
              <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: bo.fs, lineHeight: 1.2, color: TRANG, textAlign: 'center', padding: `0 ${22 * k}px`}}>
                {dong.map((d, j) => <div key={j}>{d}</div>)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const giua = tien(t, 0.6, 1.4);
  return (
    <AbsoluteFill>
      <Nen anh={p.anh} toi={0.66} />
      <TieuDe nhan={p.nhan} tieuDe={p.tieuDe} mau={mau} />
      {cot(xT, trai.tieuDe, bo.L2, false, 0)}
      {cot(xP, phai.tieuDe, bo.R2, true, 0.15)}
      <div style={{position: 'absolute', left: w / 2 - 1 * k, top: yDau, width: 2 * k, height: (bo.cao + 110 * k) * giua, background: rgba(mau, 0.45)}} />
      {p.ketLuan ? (
        <div style={{position: 'absolute', left: w * 0.12, right: w * 0.12, top: yDau + 110 * k + bo.cao + 20 * k, textAlign: 'center',
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 40 * k, color: KEM, opacity: tien(t, t1, t1 + 0.8),
          textShadow: `0 ${2 * k}px ${10 * k}px rgba(0,0,0,0.7)`}}>{p.ketLuan}</div>
      ) : null}
    </AbsoluteFill>
  );
};
