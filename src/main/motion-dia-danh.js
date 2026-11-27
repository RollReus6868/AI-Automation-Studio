'use strict';
// ============================================================================
//  motion-dia-danh.js — 1.7.0: toạ độ (gần đúng) các địa danh Kinh Thánh cho mẫu Bản đồ hành trình.
//  Mỗi dòng: [vĩ độ, kinh độ, tên tiếng Anh, ...tên khác (Tây Ban Nha, Việt, Bồ Đào Nha…)].
//  Tra theo tên đã bỏ dấu, bỏ gạch / khoảng trắng, chữ thường: "Giê-ru-sa-lem" = "Jerusalén" = "jerusalem".
//  Không có trong danh sách → ghi trong file "Tên hiện @ vĩ độ, kinh độ" (vd "Mari @ 34.55, 40.89").
// ============================================================================

const DIA_DANH = [
  // ── Ga-li-lê, Giu-đê, Sa-ma-ri ──
  [31.778, 35.235, 'Jerusalem', 'Jerusalén', 'Giê-ru-sa-lem', 'Jerusalém', 'Zion', 'Sion', 'Si-ôn'],
  [31.705, 35.2, 'Bethlehem', 'Belén', 'Bết-lê-hem', 'Belém'],
  [32.7, 35.3, 'Nazareth', 'Nazaret', 'Na-xa-rét', 'Nazaré'],
  [32.881, 35.575, 'Capernaum', 'Capernaúm', 'Cafarnaúm', 'Ca-bê-na-um', 'Cafarnaum'],
  [31.871, 35.444, 'Jericho', 'Jericó', 'Giê-ri-cô'],
  [31.771, 35.262, 'Bethany', 'Betania', 'Bê-tha-ni', 'Betânia'],
  [32.75, 35.34, 'Cana', 'Ca-na', 'Caná'],
  [32.91, 35.63, 'Bethsaida', 'Betsaida', 'Bết-sai-đa'],
  [32.825, 35.517, 'Magdala', 'Ma-đơ-len'],
  [32.82, 35.59, 'Sea of Galilee', 'Mar de Galilea', 'Biển Ga-li-lê', 'Lake of Gennesaret', 'Mar da Galileia', 'Tiberias', 'Tiberíades'],
  [32.0, 35.55, 'Jordan River', 'Jordan', 'Río Jordán', 'Jordán', 'Sông Giô-đanh', 'Giô-đanh', 'Rio Jordão'],
  [31.5, 35.5, 'Dead Sea', 'Mar Muerto', 'Biển Chết', 'Salt Sea', 'Mar Morto'],
  [32.28, 35.2, 'Samaria', 'Sa-ma-ri', 'Sebaste'],
  [32.21, 35.28, 'Shechem', 'Siquem', 'Si-chem', 'Sychar', 'Sicar', 'Nablus'],
  [31.93, 35.22, 'Bethel', 'Betel', 'Bê-tên'],
  [31.53, 35.1, 'Hebron', 'Hebrón', 'Hếp-rôn'],
  [31.55, 35.1, 'Mamre', 'Mam-rê', 'Mambré'],
  [31.25, 34.79, 'Beersheba', 'Beerseba', 'Bê-e-Sê-ba', 'Berseba'],
  [31.5, 34.47, 'Gaza', 'Ga-xa'],
  [31.67, 34.57, 'Ashkelon', 'Ascalón', 'Ách-ca-lôn'],
  [31.8, 34.65, 'Ashdod', 'Asdod', 'Ách-đốt'],
  [31.7, 34.85, 'Gath', 'Gat', 'Gát'],
  [31.78, 34.85, 'Ekron', 'Ecrón', 'Éc-rôn'],
  [32.05, 34.75, 'Joppa', 'Jope', 'Gia-phô', 'Jaffa', 'Jopa'],
  [32.5, 34.89, 'Caesarea', 'Cesarea', 'Sê-sa-rê', 'Caesarea Maritima', 'Cesareia'],
  [33.25, 35.69, 'Caesarea Philippi', 'Cesarea de Filipo', 'Sê-sa-rê Phi-líp', 'Banias'],
  [32.585, 35.18, 'Megiddo', 'Meguido', 'Mê-ghi-đô', 'Armageddon', 'Armagedón'],
  [32.73, 35.05, 'Mount Carmel', 'Carmel', 'Monte Carmelo', 'Carmelo', 'Núi Cạt-mên'],
  [32.56, 35.33, 'Jezreel', 'Jezreel', 'Gít-rê-ên'],
  [32.055, 35.29, 'Shiloh', 'Silo', 'Si-lô'],
  [31.82, 35.23, 'Gibeah', 'Guibeá', 'Ghi-bê-a'],
  [31.85, 35.23, 'Ramah', 'Ramá', 'Ra-ma'],
  [31.88, 35.21, 'Mizpah', 'Mizpa', 'Mích-ba'],
  [31.86, 35.5, 'Gilgal', 'Ghinh-ganh'],
  [31.92, 35.26, 'Ai', 'Hai', 'A-hi'],
  [33.25, 35.65, 'Dan', 'Đan'],
  [31.84, 34.99, 'Emmaus', 'Emaús', 'Em-ma-út'],
  [31.95, 34.89, 'Lydda', 'Lida', 'Ly-đa'],
  [32.28, 35.89, 'Gerasa', 'Jerash', 'Gerasa', 'Ghê-ra-sa'],
  [32.65, 35.68, 'Gadara', 'Ga-đa-ra'],
  [32.4, 35.9, 'Decapolis', 'Decápolis', 'Mười Thành'],
  [32.69, 35.39, 'Mount Tabor', 'Tabor', 'Monte Tabor', 'Núi Tha-bô'],
  [32.45, 35.4, 'Mount Gilboa', 'Gilboa', 'Monte Gilboa', 'Núi Ghinh-bô-a'],
  [33.42, 35.86, 'Mount Hermon', 'Hermon', 'Monte Hermón', 'Hermón', 'Núi Hẹt-môn'],
  [31.778, 35.244, 'Mount of Olives', 'Monte de los Olivos', 'Núi Ô-li-ve', 'Olivet'],
  [31.778, 35.229, 'Golgotha', 'Gólgota', 'Calvary', 'Calvario', 'Gô-gô-tha', 'Đồi Sọ'],
  [31.39, 34.82, 'Ziklag', 'Siclag', 'Xiếc-lác'],
  [31.65, 34.96, 'Adullam', 'Adulam', 'A-đu-lam'],
  [31.46, 35.39, 'En Gedi', 'Engedi', 'En-gadi', 'Ên-Ghê-đi'],
  [31.31, 35.35, 'Masada', 'Ma-xa-đa'],
  [31.74, 35.46, 'Qumran', 'Cum-ran'],
  [31.64, 35.24, 'Tekoa', 'Tecoa', 'Thê-cô-a'],
  [31.81, 35.26, 'Anathoth', 'Anatot', 'A-na-tốt'],
  [32.6, 35.33, 'Shunem', 'Sunem', 'Su-nem'],
  [32.63, 35.35, 'Nain', 'Naín', 'Na-in'],
  [32.36, 35.69, 'Tishbe', 'Tisbe', 'Thi-sê-be'],
  [32.2, 35.8, 'Gilead', 'Galaad', 'Ga-la-át'],
  [32.8, 36.1, 'Bashan', 'Basán', 'Ba-san'],
  [32.33, 35.55, 'Abel-meholah', 'Abel-mehola', 'A-bên-Mê-hô-la'],
  [31.56, 34.85, 'Lachish', 'Laquis', 'La-ki'],
  [31.69, 34.96, 'Valley of Elah', 'Elah', 'Valle de Ela', 'Thung lũng Ê-la'],
  [32.1, 34.93, 'Aphek', 'Afec', 'A-phéc'],
  [32.18, 35.7, 'Penuel', 'Peniel', 'Pê-ni-ên'],
  [31.05, 35.4, 'Sodom', 'Sodoma', 'Sô-đôm'],
  [31.1, 35.45, 'Gomorrah', 'Gomorra', 'Gô-mô-rơ'],
  [31.38, 34.6, 'Gerar', 'Ghê-ra'],
  [32.4, 35.2, 'Israel', 'Ít-ra-en', 'Y-sơ-ra-ên'],
  [31.6, 35.1, 'Judah', 'Judea', 'Judá', 'Giu-đa', 'Giu-đê', 'Judeia'],
  [32.85, 35.35, 'Galilee', 'Galilea', 'Ga-li-lê', 'Galileia'],
  [31.5, 35.0, 'Canaan', 'Canaán', 'Ca-na-an', 'Promised Land', 'Tierra Prometida', 'Đất Hứa'],
  [31.4, 35.75, 'Moab', 'Mô-áp'],
  [30.5, 35.5, 'Edom', 'Ê-đôm'],
  [31.95, 35.93, 'Ammon', 'Amón', 'Am-môn', 'Rabbah', 'Rabá'],
  [31.77, 35.73, 'Mount Nebo', 'Nebo', 'Monte Nebo', 'Núi Nê-bô'],
  [30.33, 35.44, 'Petra'],
  [30.65, 34.42, 'Kadesh Barnea', 'Kadesh', 'Cades', 'Cades-barnea', 'Ca-đe'],
  [29.55, 34.95, 'Ezion-geber', 'Elath', 'Ezión-geber', 'Ê-xi-ôn-Ghê-be'],
  // ── Phê-ni-xi, A-ram ──
  [33.27, 35.2, 'Tyre', 'Tiro', 'Ty-rơ'],
  [33.56, 35.37, 'Sidon', 'Sidón', 'Si-đôn'],
  [33.46, 35.3, 'Zarephath', 'Sarepta', 'Sa-rép-ta'],
  [33.51, 36.29, 'Damascus', 'Damasco', 'Đa-mách'],
  [33.8, 36.5, 'Syria', 'Aram', 'Siria', 'Sy-ri', 'A-ram', 'Síria'],
  [35.13, 36.75, 'Hamath', 'Hamat', 'Ha-mát'],
  [34.45, 36.55, 'Riblah', 'Ribla', 'Ríp-la'],
  [35.8, 36.8, 'Ebla'],
  [36.83, 38.02, 'Carchemish', 'Carquemis', 'Cạt-kê-mít'],
  // ── Ai Cập, Si-na-i ──
  [30.0, 31.2, 'Egypt', 'Egipto', 'Ai Cập', 'Egito'],
  [30.8, 31.8, 'Goshen', 'Gosén', 'Gô-sen', 'Gósen'],
  [30.8, 31.83, 'Rameses', 'Ramesés', 'Ram-se', 'Pi-Ramesses'],
  [29.85, 31.25, 'Memphis', 'Menfis', 'Mem-phít', 'Noph'],
  [25.7, 32.64, 'Thebes', 'Tebas', 'Thê-be', 'No-Amon'],
  [31.2, 29.92, 'Alexandria', 'Alejandría', 'A-léc-xan-đri'],
  [30.13, 31.3, 'Heliopolis', 'On', 'Heliópolis'],
  [30.55, 32.1, 'Succoth', 'Sucot', 'Su-cốt'],
  [27.8, 34.2, 'Red Sea', 'Mar Rojo', 'Biển Đỏ', 'Mar Vermelho', 'Sea of Reeds'],
  [28.54, 33.98, 'Mount Sinai', 'Sinai', 'Monte Sinaí', 'Sinaí', 'Núi Si-na-i', 'Horeb', 'Horeb'],
  [28.3, 35.0, 'Midian', 'Madián', 'Ma-đi-an'],
  // ── Lưỡng Hà, Ba Tư ──
  [30.96, 46.1, 'Ur', 'Ur of the Chaldeans', 'Ur de los caldeos', 'U-rơ'],
  [36.87, 39.03, 'Haran', 'Harán', 'Cha-ran', 'Harã'],
  [32.54, 44.42, 'Babylon', 'Babilonia', 'Ba-by-lôn', 'Babel', 'Babilônia'],
  [36.36, 43.15, 'Nineveh', 'Nínive', 'Ni-ni-ve'],
  [36.0, 43.5, 'Assyria', 'Asiria', 'A-si-ri', 'Assíria'],
  [33.5, 43.5, 'Mesopotamia', 'Mesopotâmia', 'Lưỡng Hà'],
  [32.19, 48.25, 'Susa', 'Shushan', 'Su-sơ'],
  [29.93, 52.89, 'Persepolis', 'Persépolis', 'Persia', 'Ba Tư', 'Pérsia'],
  [32.13, 45.23, 'Nippur', 'Níp-pua'],
  [34.55, 40.89, 'Mari'],
  [39.7, 44.3, 'Mount Ararat', 'Ararat', 'Monte Ararat', 'Núi A-ra-rát'],
  [25.0, 42.0, 'Arabia', 'Ả Rập', 'Arábia'],
  [15.4, 45.3, 'Sheba', 'Sabá', 'Sê-ba'],
  // ── Hành trình của Phao-lô, bảy hội thánh ──
  [36.2, 36.16, 'Antioch', 'Antioquía', 'An-ti-ốt', 'Antioch of Syria', 'Antioquia'],
  [38.31, 31.19, 'Pisidian Antioch', 'Antioch of Pisidia', 'Antioquía de Pisidia', 'An-ti-ốt xứ Bi-si-đi'],
  [36.92, 34.9, 'Tarsus', 'Tarso', 'Tạt-sơ'],
  [37.87, 32.49, 'Iconium', 'Iconio', 'Y-cô-ni'],
  [37.58, 32.45, 'Lystra', 'Listra', 'Lít-trơ'],
  [37.35, 33.36, 'Derbe', 'Đẹt-bơ'],
  [36.96, 30.85, 'Perga', 'Perge', 'Bẹt-giê'],
  [36.12, 35.93, 'Seleucia', 'Selêu-xi', 'Selêucia'],
  [36.89, 30.71, 'Attalia', 'Atalia', 'Át-ta-li'],
  [37.94, 27.34, 'Ephesus', 'Éfeso', 'Ê-phê-sô', 'Éfeso'],
  [38.42, 27.14, 'Smyrna', 'Esmirna', 'Si-miếc-nơ'],
  [39.13, 27.18, 'Pergamum', 'Pérgamo', 'Bẹt-găm', 'Pergamon'],
  [38.92, 27.84, 'Thyatira', 'Tiatira', 'Thi-a-ti-rơ'],
  [38.49, 28.04, 'Sardis', 'Sạt-đe'],
  [38.35, 28.52, 'Philadelphia', 'Filadelfia', 'Phi-la-đen-phi'],
  [37.84, 29.11, 'Laodicea', 'Lao-đi-xê', 'Laodiceia'],
  [37.79, 29.26, 'Colossae', 'Colosas', 'Cô-lô-se'],
  [39.75, 26.16, 'Troas', 'Trô-ách', 'Trôade'],
  [37.53, 27.28, 'Miletus', 'Mileto', 'Mi-lê'],
  [37.32, 26.55, 'Patmos', 'Bát-mô'],
  [41.01, 24.29, 'Philippi', 'Filipos', 'Phi-líp', 'Filipos'],
  [40.64, 22.94, 'Thessalonica', 'Tesalónica', 'Tê-sa-lô-ni-ca', 'Tessalônica'],
  [40.52, 22.2, 'Berea', 'Bê-rê', 'Bereia'],
  [37.97, 23.73, 'Athens', 'Atenas', 'A-thên'],
  [37.91, 22.88, 'Corinth', 'Corinto', 'Cô-rinh-tô'],
  [37.88, 22.99, 'Cenchreae', 'Cencrea', 'Xen-cơ-rê'],
  [41.89, 12.49, 'Rome', 'Roma', 'Rô-ma'],
  [40.82, 14.12, 'Puteoli', 'Puzol', 'Bu-tô-li'],
  [35.9, 14.45, 'Malta', 'Melita', 'Man-tơ'],
  [35.24, 24.9, 'Crete', 'Creta', 'Cơ-rết'],
  [34.93, 24.8, 'Fair Havens', 'Buenos Puertos', 'Mỹ Cảng'],
  [35.0, 33.2, 'Cyprus', 'Chipre', 'Chíp-rơ', 'Síp'],
  [35.18, 33.9, 'Salamis', 'Salamina', 'Sa-la-min'],
  [34.76, 32.42, 'Paphos', 'Pafos', 'Ba-phô'],
  [36.44, 28.22, 'Rhodes', 'Rodas', 'Rô-đơ'],
  [36.89, 27.29, 'Cos', 'Kos', 'Cốt'],
  [37.07, 15.29, 'Syracuse', 'Siracusa', 'Sy-ra-cu-sơ'],
  [38.11, 15.65, 'Rhegium', 'Regio', 'Rê-ghi-um'],
  [37.2, -6.9, 'Tarshish', 'Tarsis', 'Ta-rê-si'],
  [39.5, 32.5, 'Galatia', 'Ga-la-ti', 'Galácia'],
  [40.8, 22.5, 'Macedonia', 'Ma-xê-đoan', 'Macedônia'],
  [37.8, 22.4, 'Achaia', 'Acaya', 'A-chai'],
  [38.5, 28.0, 'Asia Minor', 'Asia Menor', 'Tiểu Á', 'Ásia Menor'],
];

/** Chuẩn hoá tên để tra: bỏ dấu (cả đ), bỏ mọi ký tự không phải chữ / số, chữ thường. */
function khoaTen(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const BANG = new Map();
for (const [lat, lon, ...ten] of DIA_DANH) for (const t of ten) { const k = khoaTen(t); if (k && !BANG.has(k)) BANG.set(k, { lat, lon, ten: ten[0] }); }

/** Tên → { lat, lon, ten } hoặc null. */
function traDiaDanh(ten) { return BANG.get(khoaTen(ten)) || null; }

/**
 * Một mục địa danh trong file: "Damasco", "Siria @ Damascus", "Mari @ 34.55, 40.89".
 * → { ten (chữ hiện trên bản đồ), lat, lon } hoặc { ten, loi }.
 */
function docDiaDanh(chu) {
  const s = String(chu || '').trim();
  const m = /^(.*?)\s*@\s*(.+)$/.exec(s);
  const ten = (m ? m[1] : s).trim() || (m ? m[2].trim() : '');
  if (m) {
    const so = /^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/.exec(m[2].trim());
    if (so) {
      const lat = parseFloat(so[1].replace(',', '.')), lon = parseFloat(so[2].replace(',', '.'));
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { ten, lat, lon };
      return { ten, loi: `toạ độ "${m[2].trim()}" không hợp lệ` };
    }
    const x = traDiaDanh(m[2]);
    if (x) return { ten, lat: x.lat, lon: x.lon };
    return { ten, loi: `không biết địa danh "${m[2].trim()}"` };
  }
  const x = traDiaDanh(s);
  if (x) return { ten, lat: x.lat, lon: x.lon };
  return { ten, loi: `không biết toạ độ của "${s}" — ghi "${s} @ vĩ độ, kinh độ"` };
}

module.exports = { DIA_DANH, khoaTen, traDiaDanh, docDiaDanh };
