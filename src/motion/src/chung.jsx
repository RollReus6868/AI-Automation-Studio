// Phần dùng chung của các mẫu motion graphic: phông, nền ảnh của cảnh, màu, đo chữ, hàm chuyển động.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';

const FACES = [
  ['AS Serif', 600, 'normal', 'EBGaramond-SemiBold.ttf'],
  ['AS Serif', 400, 'italic', 'EBGaramond-Italic.ttf'],
  ['AS Sans', 700, 'normal', 'Montserrat-Bold.ttf'],
  ['AS Sans', 800, 'normal', 'Montserrat-ExtraBold.ttf'],
  ['AS Hebrew', 500, 'normal', 'NotoSerifHebrew.ttf'],
];
export const SERIF = '"AS Serif", serif';
export const SANS = '"AS Sans", sans-serif';
export const HEBREW = '"AS Hebrew", "AS Serif", serif';

/** Nạp phông xong mới vẽ (đo chữ cần phông thật). Trả true khi sẵn sàng. */
export const usePhong = () => {
  const [handle] = useState(() => delayRender('Đang nạp phông'));
  const [san, datSan] = useState(false);
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = FACES.map(([f, w, s, file]) =>
      `@font-face{font-family:'${f}';font-weight:${w};font-style:${s};src:url(${staticFile('fonts/' + file)}) format('truetype');}`).join('\n');
    document.head.appendChild(el);
    Promise.all([
      document.fonts.load('600 60px "AS Serif"', 'Abc ạ ñ λόγος'),
      document.fonts.load('italic 400 60px "AS Serif"', 'Abc'),
      document.fonts.load('700 30px "AS Sans"', 'ABC'),
      document.fonts.load('800 30px "AS Sans"', 'ABC'),
      document.fonts.load('500 60px "AS Hebrew"', 'שָׁלוֹם'),
    ]).then((sets) => {
      const thieu = sets.findIndex((s) => s.length === 0);
      if (thieu >= 0) { cancelRender(new Error('Thiếu phông số ' + thieu)); return; }
      datSan(true);
      continueRender(handle);
    }).catch((e) => cancelRender(e));
  }, [handle]);
  return san;
};

let canvas = null;
/** Bề rộng chữ (px) theo phông thật — dùng để xếp nhãn không đè nhau. */
export const doRong = (chu, font) => {
  if (!canvas) canvas = document.createElement('canvas');
  const c = canvas.getContext('2d');
  c.font = font;
  return c.measureText(String(chu || '')).width;
};

/** Ngắt dòng theo bề rộng tối đa. */
export const ngatDong = (chu, font, rongToiDa) => {
  const tu = String(chu || '').split(/\s+/).filter(Boolean);
  const dong = [];
  let cur = '';
  for (const w of tu) {
    const thu = cur ? cur + ' ' + w : w;
    if (cur && doRong(thu.replace(/\*/g, ''), font) > rongToiDa) { dong.push(cur); cur = w; } else cur = thu;
  }
  if (cur) dong.push(cur);
  return dong;
};

export const rgba = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const v = m ? parseInt(m[1], 16) : 0xc9a45c;
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};
export const TRANG = 'rgb(246,241,232)';
export const KEM = 'rgb(226,214,190)';
export const mauNhan = (p) => (/^#?[0-9a-f]{6}$/i.test(String(p.mau || '')) ? (p.mau[0] === '#' ? p.mau : '#' + p.mau) : '#C9A45C');

export const ra = Easing.bezier(0.22, 1, 0.36, 1);   // chậm dần (easeOutQuint gần đúng)
/** 0→1 trong [a, b] giây, có làm mềm. */
export const tien = (t, a, b, ease = ra) => interpolate(t, [a, Math.max(a + 0.001, b)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

/** Giây hiện tại + tổng số giây của clip. */
export const useGio = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  return {t: f / fps, L: durationInFrames / fps, fps, w: width, h: height, k: width / 1920};
};

/**
 * Nền = ảnh AI của chính cảnh (props.anh: địa chỉ http do app phục vụ). 0,4 s đầu ảnh còn sáng như cảnh trước
 * cho liền mạch, rồi tối + mờ dần để chữ / đồ họa nổi lên; ảnh trôi chậm suốt clip.
 */
export const Nen = ({anh, toi = 0.62, mo = 6, tint = null}) => {
  const {t, L} = useGio();
  const vao = tien(t, 0.15, 1.1);
  const scale = interpolate(t, [0, L], [1.04, 1.12]);
  const x = interpolate(t, [0, L], [0, -1.5]);
  return (
    <AbsoluteFill style={{backgroundColor: '#0b0a09', overflow: 'hidden'}}>
      {anh ? (
        <Img src={anh} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${scale}) translateX(${x}%)`, filter: `blur(${(mo * vao).toFixed(2)}px) saturate(${1 - 0.25 * vao})`}} />
      ) : (
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #2a241c 0%, #0b0a09 75%)'}} />
      )}
      {tint ? <AbsoluteFill style={{background: tint, opacity: vao}} /> : null}
      <AbsoluteFill style={{background: `rgba(8,7,6,${(toi * vao).toFixed(3)})`}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)', opacity: vao}} />
    </AbsoluteFill>
  );
};

/** Tiêu đề nhỏ ở trên: nhãn chữ hoa màu nhấn + tiêu đề serif. */
export const TieuDe = ({nhan, tieuDe, mau, t0 = 0.5, y = 0.085}) => {
  const {t, w, h, k} = useGio();
  if (!nhan && !tieuDe) return null;
  const a = tien(t, t0, t0 + 0.7);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: h * y, textAlign: 'center', opacity: a, transform: `translateY(${(1 - a) * 18 * k}px)`}}>
      {nhan ? <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 26 * k, letterSpacing: 6 * k, color: mau, textTransform: 'uppercase'}}>{nhan}</div> : null}
      {tieuDe ? <div style={{fontFamily: SERIF, fontWeight: 600, fontSize: 64 * k, color: TRANG, marginTop: 6 * k, textShadow: `0 ${3 * k}px ${14 * k}px rgba(0,0,0,0.6)`}}>{tieuDe}</div> : null}
      <div style={{width: 160 * k * tien(t, t0 + 0.3, t0 + 1.1), height: 2 * k, background: mau, margin: `${14 * k}px auto 0`}} />
    </div>
  );
};

/** Chuỗi có *nhấn* → mảng {chu, nhan}. */
export const tachNhan = (s) => {
  const ra2 = [];
  let nhan = false;
  for (const p of String(s || '').split('*')) { if (p) ra2.push({chu: p, nhan}); nhan = !nhan; }
  return ra2;
};

/** Thời lượng dựng: phần chuyển động chiếm tối đa 75% clip, phần còn lại đứng yên để người xem đọc. */
export const khungDung = (L, mongMuon) => Math.max(1, Math.min(mongMuon, L * 0.75));

export const KhungMau = ({children}) => <AbsoluteFill style={{fontFamily: SERIF, color: TRANG}}>{children}</AbsoluteFill>;
