// Các mẫu motion graphic của AI Automation Studio. Cỡ khung, fps và số khung hình do app truyền vào (props).
import React from 'react';
import {Composition} from 'remotion';
import {BanDo} from './BanDo.jsx';
import {DongThoiGian} from './DongThoiGian.jsx';
import {CauKinh} from './CauKinh.jsx';
import {PhaHe} from './PhaHe.jsx';
import {SoSanh} from './SoSanh.jsx';

const meta = ({props}) => ({
  width: props.width || 1920,
  height: props.height || 1080,
  fps: props.fps || 30,
  durationInFrames: Math.max(1, props.frames || 1),
});
const goc = {width: 1920, height: 1080, fps: 30, frames: 300, mau: '#C9A45C', anh: null};

const MAU = [
  ['BanDo', BanDo, {nhan: 'Hành trình', tieuDe: 'Từ Ur đến Ca-na-an', tuyen: true,
    diem: [{ten: 'Ur', lat: 30.96, lon: 46.1}, {ten: 'Haran', lat: 36.87, lon: 39.03}, {ten: 'Shechem', lat: 32.21, lon: 35.28}, {ten: 'Egypt', lat: 30.0, lon: 31.2}]}],
  ['DongThoiGian', DongThoiGian, {nhan: 'Dòng thời gian', tieuDe: 'Các vua của Israel',
    suKien: [{nam: '1050 BC', ten: 'Saul'}, {nam: '1010 BC', ten: 'David', hienTai: true}, {nam: '970 BC', ten: 'Solomon'}, {nam: '930 BC', ten: 'Kingdom divides'}]}],
  ['CauKinh', CauKinh, {cau: 'In the beginning *God created* the heavens and the earth.', tham: 'Genesis 1:1', goc: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'}],
  ['PhaHe', PhaHe, {nhan: 'Gia phả', tieuDe: 'Dòng dõi Áp-ra-ham',
    nut: [{id: 'a', ten: 'Abraham', cha: null}, {id: 'b', ten: 'Isaac', cha: 'a'}, {id: 'c', ten: 'Ishmael', cha: 'a'}, {id: 'd', ten: 'Jacob', cha: 'b', nhan: true}, {id: 'e', ten: 'Esau', cha: 'b'}]}],
  ['SoSanh', SoSanh, {tieuDe: 'Hai vị vua', trai: {tieuDe: 'Saul', dong: ['Chosen by the people', 'Disobeyed']}, phai: {tieuDe: 'David', dong: ['Chosen by God', 'Repented']}, ketLuan: 'The heart made the difference.'}],
];

export const Root = () => (
  <>
    {MAU.map(([id, C, props]) => (
      <Composition key={id} id={id} component={C} width={1920} height={1080} fps={30} durationInFrames={300}
        calculateMetadata={meta} defaultProps={{...goc, ...props}} />
    ))}
  </>
);
