'use strict';
// ============================================================================
//  doc-xlsx.js — 1.6.0: đọc bảng trong file .xlsx (và .csv) không cần thư viện ngoài.
//  .xlsx là file zip chứa XML: đọc mục lục zip, giải nén (deflate) bằng zlib có sẵn của Node,
//  rồi lấy ô của MỘT sheet (theo tên, không có thì sheet đầu). Đủ cho file do openpyxl / Excel ghi:
//  chữ dùng chung (sharedStrings), chữ trong ô (inlineStr / str), số.
// ============================================================================

const zlib = require('zlib');

/** Đọc mục lục zip → Map(tên file → hàm lấy Buffer đã giải nén). */
function docZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Không phải file .xlsx (không đọc được mục lục zip)');
  const soMuc = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const muc = new Map();
  for (let n = 0; n < soMuc; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('File .xlsx hỏng (mục lục zip lệch)');
    const cach = buf.readUInt16LE(p + 10);
    const nen = buf.readUInt32LE(p + 20);
    const dai = buf.readUInt16LE(p + 28), them = buf.readUInt16LE(p + 30), chu = buf.readUInt16LE(p + 32);
    const dau = buf.readUInt32LE(p + 42);
    const ten = buf.toString('utf8', p + 46, p + 46 + dai);
    muc.set(ten, () => {
      const dTen = buf.readUInt16LE(dau + 26), dThem = buf.readUInt16LE(dau + 28);
      const du = buf.subarray(dau + 30 + dTen + dThem, dau + 30 + dTen + dThem + nen);
      if (cach === 0) return du;
      if (cach === 8) return zlib.inflateRawSync(du);
      throw new Error(`File .xlsx nén kiểu lạ (${cach})`);
    });
    p += 46 + dai + them + chu;
  }
  return muc;
}

const THUC_THE = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function giaiXml(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return THUC_THE[e] != null ? THUC_THE[e] : m;
  });
}
/** Ghép mọi <t>…</t> trong một khối (chữ nhiều đoạn định dạng). */
const chuTrong = (xml) => giaiXml((xml.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map((t) => t.replace(/^<t(?:\s[^>]*)?>|<\/t>$/g, '')).join(''));
const thuocTinh = (the, ten) => { const m = new RegExp(`\\s${ten}="([^"]*)"`).exec(the); return m ? giaiXml(m[1]) : null; };
/** "AB12" → chỉ số cột 0-based (A=0, Z=25, AA=26). */
function cotTu(ref) {
  const m = /^([A-Z]+)/i.exec(ref || '');
  if (!m) return -1;
  let n = 0;
  for (const c of m[1].toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Đọc một sheet thành mảng các hàng (mỗi hàng là mảng chuỗi, ô trống = '').
 * @param o.sheet  tên sheet muốn đọc (không phân biệt hoa thường); không có thì sheet đầu.
 * @returns {{ sheet: string, hang: string[][], dsSheet: string[] }}
 */
function docXlsx(buf, o = {}) {
  const zip = docZip(buf);
  const lay = (ten) => { const f = zip.get(ten); return f ? f().toString('utf8') : null; };
  const wb = lay('xl/workbook.xml');
  if (!wb) throw new Error('Không phải file .xlsx (thiếu xl/workbook.xml)');
  const sheets = (wb.match(/<sheet\s[^>]*\/?>/g) || []).map((t) => ({ ten: thuocTinh(t, 'name') || '', rid: thuocTinh(t, 'r:id') }));
  if (!sheets.length) throw new Error('File .xlsx không có sheet nào');
  const rels = lay('xl/_rels/workbook.xml.rels') || '';
  const dich = {};
  for (const t of rels.match(/<Relationship\s[^>]*\/?>/g) || []) dich[thuocTinh(t, 'Id')] = thuocTinh(t, 'Target');
  const muon = String(o.sheet || '').toLowerCase();
  const sh = (muon && sheets.find((s) => s.ten.toLowerCase() === muon)) || sheets[0];
  let duong = dich[sh.rid] || `worksheets/sheet${sheets.indexOf(sh) + 1}.xml`;
  duong = duong.startsWith('/') ? duong.slice(1) : `xl/${duong.replace(/^\.\//, '')}`;
  const xml = lay(duong);
  if (xml == null) throw new Error(`Không đọc được sheet "${sh.ten}"`);
  const chung = [];
  const ss = lay('xl/sharedStrings.xml');
  if (ss) for (const si of ss.match(/<si>[\s\S]*?<\/si>|<si\/>/g) || []) chung.push(chuTrong(si));
  const hang = [];
  for (const r of xml.match(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g) || []) {
    const so = parseInt(thuocTinh(r.slice(0, r.indexOf('>') + 1), 'r'), 10);
    const dong = [];
    for (const c of r.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const mo = c.slice(0, c.indexOf('>') + 1);
      const kieu = thuocTinh(mo, 't');
      let cot = cotTu(thuocTinh(mo, 'r'));
      if (cot < 0) cot = dong.length;
      let v = '';
      if (kieu === 'inlineStr') v = chuTrong(c);
      else {
        const m = /<v>([\s\S]*?)<\/v>/.exec(c);
        if (m) v = kieu === 's' ? (chung[parseInt(m[1], 10)] || '') : giaiXml(m[1]);
      }
      while (dong.length < cot) dong.push('');
      dong[cot] = v;
    }
    const chiSo = Number.isFinite(so) ? so - 1 : hang.length;
    while (hang.length < chiSo) hang.push([]);
    hang[chiSo] = dong;
  }
  return { sheet: sh.ten, hang, dsSheet: sheets.map((s) => s.ten) };
}

/** CSV (dấu phẩy hoặc chấm phẩy, có ngoặc kép) → mảng hàng. */
function docCsv(chu) {
  const s = String(chu).replace(/^﻿/, '');
  const dau = (s.split(/\r?\n/)[0].match(/;/g) || []).length > (s.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const hang = [];
  let dong = [], o = '', trongNgoac = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (trongNgoac) {
      if (c === '"' && s[i + 1] === '"') { o += '"'; i++; } else if (c === '"') trongNgoac = false; else o += c;
    } else if (c === '"') trongNgoac = true;
    else if (c === dau) { dong.push(o); o = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      dong.push(o); hang.push(dong); dong = []; o = '';
    } else o += c;
  }
  if (o !== '' || dong.length) { dong.push(o); hang.push(dong); }
  return hang;
}

module.exports = { docXlsx, docCsv, docZip, cotTu };
