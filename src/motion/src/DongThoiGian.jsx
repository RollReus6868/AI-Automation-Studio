// Mẫu DÒNG THỜI GIAN LỚN: trục ngang vẽ dần, mỗi mốc bật lên khi trục chạy tới (năm + sự kiện, xen trên / dưới).
// Nhiều mốc hơn chiều rộng khung thì khung hình trôi theo đầu trục. Mốc đánh * là "đang kể tới": sáng và to hơn.
import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Nen, TieuDe, usePhong, useGio, ngatDong, mauNhan, tien, khungDung, SERIF, SANS, TRANG, KEM, rgba} from './chung.jsx';

export const DongThoiGian = (p) => {
  const san = usePhong();
  const {t, L, w, h, k} = useGio();
  const mau = mauNhan(p);
  const ds = (p.suKien || []).filter((x) => x && (x.nam || x.ten));
  const n = Math.max(1, ds.length);
  // nhãn xen trên / dưới nên mỗi nhãn được rộng gần 2 bước; tối đa 8 mốc vừa khung, nhiều hơn thì khung trôi
  const buoc = Math.max(230 * k, Math.min(560 * k, (w * 0.78) / Math.max(1, n - 1)));
  const tong = (n - 1) * buoc;
  const x0 = tong <= w * 0.8 ? (w - tong) / 2 : w * 0.12;
  const y = h * 0.57;
  const fsTen = 38 * k, fsNam = 34 * k;
  const rongNhan = Math.min(buoc * 1.8, 540 * k);
  const dong = useMemo(() => (san ? ds.map((x) => ngatDong(x.ten, `600 ${fsTen}px "AS Serif"`, Math.min(buoc * 1.75, 520 * k)).slice(0, 3)) : []), [san, JSON.stringify(ds), buoc]);
  if (!san) return <Nen anh={p.anh} />;

  const t0 = 1.0;
  const t1 = t0 + khungDung(L - t0, 1.2 + n * 1.25);
  const u = tien(t, t0, t1, (s) => s);
  const dauX = x0 + (tong + 80 * k) * u - 40 * k;
  const truot = tong > w * 0.8 ? Math.max(0, Math.min(tong - w * 0.76, dauX - x0 - w * 0.55)) : 0;
  const ve = tien(t, 0.4, 1.0);
  return (
    <AbsoluteFill>
      <Nen anh={p.anh} toi={0.66} />
      <TieuDe nhan={p.nhan} tieuDe={p.tieuDe} mau={mau} />
      <AbsoluteFill style={{transform: `translateX(${-truot}px)`, opacity: ve}}>
        <div style={{position: 'absolute', left: x0 - 60 * k, top: y - 1.5 * k, width: Math.max(0, dauX - x0 + 60 * k), height: 3 * k,
          background: `linear-gradient(90deg, ${rgba(mau, 0)}, ${mau} ${Math.min(30, (120 * k / Math.max(1, dauX - x0 + 60 * k)) * 100)}%, ${mau})`}} />
        {ds.map((x, i) => {
          const xi = x0 + i * buoc;
          const ti = t0 + ((xi - x0 + 40 * k) / (tong + 80 * k)) * (t1 - t0);
          const a = tien(t, ti - 0.05, ti + 0.55);
          if (a <= 0) return null;
          const tren = i % 2 === 0;
          const cur = !!x.hienTai;
          const nhip = cur ? 1 + 0.12 * Math.sin((t - ti) * 4) * tien(t, ti + 0.6, ti + 1.2) : 1;
          const r = (cur ? 17 : 12) * k;
          const dongs = dong[i] || [];
          const cao = dongs.length * fsTen * 1.12;
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: xi - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: '50%',
                background: cur ? mau : 'rgb(24,18,12)', border: `${4 * k}px solid ${mau}`, boxSizing: 'border-box',
                transform: `scale(${a * nhip})`, boxShadow: cur ? `0 0 ${30 * k}px ${rgba(mau, 0.8)}` : 'none'}} />
              <div style={{position: 'absolute', left: xi - 1 * k, top: tren ? y - 70 * k * a : y + 18 * k, width: 2 * k, height: 52 * k * a, background: rgba(mau, 0.7)}} />
              <div style={{position: 'absolute', left: xi - rongNhan / 2, width: rongNhan, textAlign: 'center', opacity: a,
                top: tren ? y - 84 * k - cao - fsNam * 1.3 : y + 82 * k,
                transform: `translateY(${(tren ? 1 : -1) * (1 - a) * 22 * k}px)`}}>
                {tren ? null : <div style={{fontFamily: SANS, fontWeight: 800, fontSize: fsNam * (cur ? 1.15 : 1), color: mau, letterSpacing: 2 * k}}>{x.nam}</div>}
                <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: fsTen * (cur ? 1.08 : 1), lineHeight: 1.12, color: cur ? TRANG : KEM,
                  textShadow: `0 ${2 * k}px ${10 * k}px rgba(0,0,0,0.7)`, marginTop: tren ? 0 : 6 * k, marginBottom: tren ? 6 * k : 0}}>
                  {dongs.map((d, j) => <div key={j}>{d}</div>)}
                </div>
                {tren ? <div style={{fontFamily: SANS, fontWeight: 800, fontSize: fsNam * (cur ? 1.15 : 1), color: mau, letterSpacing: 2 * k}}>{x.nam}</div> : null}
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
      {p.chuThich ? (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 70 * k, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
          fontSize: 36 * k, color: KEM, opacity: tien(t, t1, t1 + 0.8)}}>{p.chuThich}</div>
      ) : null}
    </AbsoluteFill>
  );
};
