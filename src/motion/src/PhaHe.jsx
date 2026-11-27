// Mẫu CÂY PHẢ HỆ: các thế hệ hiện lần lượt từ trên xuống, đường nối vẽ từ cha xuống con rồi tên con bật lên.
// Tên đánh * được tô màu nhấn (nhân vật đang kể tới).
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {Nen, TieuDe, usePhong, useGio, doRong, mauNhan, tien, khungDung, SERIF, TRANG, rgba} from './chung.jsx';

/** nut: [{id, ten, nhan, cha}] → vị trí theo ô (lá xếp liền, cha ở giữa các con). */
function xep(nut) {
  const con = new Map(nut.map((x) => [x.id, []]));
  for (const x of nut) if (x.cha != null && con.has(x.cha)) con.get(x.cha).push(x.id);
  const goc = nut.filter((x) => x.cha == null || !con.has(x.cha)).map((x) => x.id);
  const vt = new Map();
  let la = 0, sau = 0;
  const di = (id, d, seen) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    sau = Math.max(sau, d);
    const cs = con.get(id) || [];
    if (!cs.length) { vt.set(id, {o: la++, d}); return vt.get(id).o; }
    const xs = cs.map((c) => di(c, d + 1, seen));
    const o = (Math.min(...xs) + Math.max(...xs)) / 2;
    vt.set(id, {o, d});
    return o;
  };
  const seen = new Set();
  for (const g of goc) di(g, 0, seen);
  return {vt, soLa: Math.max(1, la), soDoi: sau + 1, con};
}

export const PhaHe = (p) => {
  const san = usePhong();
  const {t, L, w, h, k} = useGio();
  const mau = mauNhan(p);
  const nut = p.nut || [];
  const bo = useMemo(() => {
    if (!san || !nut.length) return null;
    const {vt, soLa, soDoi, con} = xep(nut);
    let fs = 36 * k;
    const rongTen = Math.max(...nut.map((x) => doRong(x.ten, `600 ${fs}px "AS Serif"`))) + 44 * k;
    let o = rongTen + 22 * k;
    const vua = (w * 0.9) / soLa;
    if (o > vua) { fs = Math.max(20 * k, fs * (vua / o)); o = vua; }
    const caoDoi = Math.min(190 * k, (h * 0.62) / Math.max(1, soDoi - 1 || 1));
    const tren = p.tieuDe || p.nhan ? h * 0.3 : h * 0.14;
    const top = Math.max(tren, tren + (h * 0.92 - tren - (soDoi - 1) * caoDoi) / 2 - 30 * k);
    const x0 = w / 2 - ((soLa - 1) * o) / 2;
    const toaDo = new Map();
    for (const x of nut) { const v = vt.get(x.id); if (v) toaDo.set(x.id, {x: x0 + v.o * o, y: top + v.d * caoDoi, d: v.d}); }
    return {toaDo, soDoi, fs, con, caoDoi};
  }, [san, JSON.stringify(nut), w, h]);
  if (!san || !bo) return <Nen anh={p.anh} />;

  const t0 = 1.0;
  const buoc = khungDung(L - t0, 1.3 * bo.soDoi) / Math.max(1, bo.soDoi);
  const tDoi = (d) => t0 + d * buoc;
  const cao = bo.fs * 1.75;
  return (
    <AbsoluteFill>
      <Nen anh={p.anh} toi={0.68} />
      <TieuDe nhan={p.nhan} tieuDe={p.tieuDe} mau={mau} />
      <svg width={w} height={h} style={{position: 'absolute', inset: 0}}>
        {nut.map((x) => {
          const a = bo.toaDo.get(x.id);
          const cs = (bo.con.get(x.id) || []).map((c) => bo.toaDo.get(c)).filter(Boolean);
          if (!a || !cs.length) return null;
          const td = tDoi(a.d + 1) - buoc * 0.55;
          const u = tien(t, td, td + buoc * 0.5, (s) => s);
          if (u <= 0) return null;
          const yGiua = a.y + bo.caoDoi / 2;
          const xMin = Math.min(...cs.map((c) => c.x)), xMax = Math.max(...cs.map((c) => c.x));
          const u1 = Math.min(1, u * 3), u2 = Math.max(0, Math.min(1, u * 3 - 1)), u3 = Math.max(0, Math.min(1, u * 3 - 2));
          return (
            <g key={x.id} stroke={rgba(mau, 0.85)} strokeWidth={3 * k} fill="none" strokeLinecap="round">
              <line x1={a.x} y1={a.y + cao / 2} x2={a.x} y2={a.y + cao / 2 + (yGiua - a.y - cao / 2) * u1} />
              {u2 > 0 ? <line x1={a.x - (a.x - xMin) * u2} y1={yGiua} x2={a.x + (xMax - a.x) * u2} y2={yGiua} /> : null}
              {u3 > 0 ? cs.map((c, i) => <line key={i} x1={c.x} y1={yGiua} x2={c.x} y2={yGiua + (c.y - cao / 2 - yGiua) * u3} />) : null}
            </g>
          );
        })}
      </svg>
      {nut.map((x) => {
        const a = bo.toaDo.get(x.id);
        if (!a) return null;
        const ti = tDoi(a.d);
        const v = tien(t, ti, ti + 0.5);
        if (v <= 0) return null;
        const nh = !!x.nhan;
        return (
          <div key={x.id} style={{position: 'absolute', left: a.x, top: a.y, transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * v})`, opacity: v,
            padding: `0 ${20 * k}px`, height: cao, lineHeight: `${cao}px`, whiteSpace: 'nowrap', borderRadius: cao / 2,
            background: nh ? mau : 'rgba(20,16,12,0.86)', border: `${2.5 * k}px solid ${nh ? mau : rgba(mau, 0.75)}`,
            boxShadow: nh ? `0 0 ${26 * k}px ${rgba(mau, 0.65)}` : `0 ${4 * k}px ${14 * k}px rgba(0,0,0,0.5)`,
            fontFamily: SERIF, fontWeight: 600, fontSize: bo.fs, color: nh ? 'rgb(28,20,10)' : TRANG}}>{x.ten}</div>
        );
      })}
    </AbsoluteFill>
  );
};
