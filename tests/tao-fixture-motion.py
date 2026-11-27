# Tạo tests/fixture-motion.xlsx giống file skill chia cảnh xuất (openpyxl): sheet HUONG DAN đứng ĐẦU
# (app phải tìm đúng sheet MOTION theo tên), đủ 5 mẫu, có dòng lỗi (địa danh lạ, mẫu lạ).
#   python3 tests/tao-fixture-motion.py
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
hd = wb.active
hd.title = 'HUONG DAN'
hd.append(['Cột', 'Ý nghĩa'])
hd.append(['mau', 'BAN_DO / DONG_THOI_GIAN / CAU_KINH / PHA_HE / SO_SANH'])
ws = wb.create_sheet('MOTION')
ws.append(['scene', 'mau', 'nhan', 'tieu_de', 'noi_dung', 'phu', 'goc', 'giay', 'ghi_chu'])
for c in ws[1]:
    c.font = Font(bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor='8B5CF6')
ws.append(['0003', 'BAN_DO', '2 Reyes 5', 'El viaje de Naamán', 'Damasco > Samaria > Río Jordán', 'c. 850 a.C.', '', '', 'cảnh có video AI cũ'])
ws.append([5, 'CAU_KINH', '', '', 'Ve y lávate *siete veces* en el Jordán', '2 Reyes 5:10', 'לָכֶת וְרָחַצְתָּ שֶׁבַע פְּעָמִים', 3, 'không có giọng đọc'])
ws.append([7, 'BAN_DO', '', '', 'Atlántida > Roma', '', '', '', 'địa danh lạ'])
ws.append([8, 'HOAT_HINH', '', '', 'x', '', '', '', 'mẫu lạ'])
ws.append([9, 'SO_SANH', '', 'Dos respuestas', 'Naamán | Giezi; Se humilló | Se aprovechó', 'La misma palabra', '', '', ''])
ws.append([11, 'timeline', '', '', '930 a.C. | Reino dividido; *850 a.C. | Eliseo', '', '', '', 'bí danh mẫu'])
ws.append([12, 'PHA_HE', '', '', 'Abraham > Isaac, Ismael; Isaac > *Jacob*', '', '', '', ''])
out = Path(__file__).with_name('fixture-motion.xlsx')
wb.save(out)
print(out)
