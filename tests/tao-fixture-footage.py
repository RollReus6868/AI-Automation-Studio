# Tạo tests/fixture-footage.xlsx giống file skill chia cảnh xuất (openpyxl): sheet HUONG DAN đứng ĐẦU
# (app phải tìm đúng sheet FOOTAGE theo tên), chữ dùng chung, số dạng số, có ô trống / dòng lỗi.
#   python3 tests/tao-fixture-footage.py
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
hd = wb.active
hd.title = 'HUONG DAN'
hd.append(['Cột', 'Ý nghĩa'])
hd.append(['scene', 'Số cảnh'])
ws = wb.create_sheet('FOOTAGE')
ws.append(['scene', 'che_do', 'nguon', 'tu_khoa', 'giay_can', 'tranh', 'ghi_chu'])
for c in ws[1]:
    c.font = Font(bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor='10B981')
ws.append(['0003', 'thay', 'auto', 'desert dunes aerial; sand dunes sunrise', 7, 'people, city', 'Sa mạc & tôi'])
ws.append(['0005', 'thay', 'pixabay', 'night sky stars timelapse', 6.5, '', ''])
ws.append(['0009', 'thay', '', 'ancient cave entrance', 8, 'person', ''])
ws.append(['x12', 'thay', 'auto', 'bad row', 5, '', ''])
ws.append(['0010', 'phu', 'auto', 'smoke overlay', 5, '', ''])
ws.append([11, 'thay', 'auto', 'olive tree wind', 6, '', 'số viết dạng số'])
out = Path(__file__).with_name('fixture-footage.xlsx')
wb.save(out)
print(out)
