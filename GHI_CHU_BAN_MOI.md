# AI Automation Studio 1.1.2

- **Nhận đúng hộp "Out of Downloads" của Suno** (theo ảnh bạn gửi): tài khoản hết lượt tải thì bấm Download hiện hộp này → app nhận ra ngay, cho tài khoản đó nghỉ 6 giờ và **tạo lại + tải bài ở tài khoản Suno dự phòng**. Nhật ký ghi: *Suno hết lượt tải về: "Out of Downloads — You don't have any downloads left…"*.

## Bản 1.1.1

- **Tải nhạc Suno theo đúng menu thật** (theo ảnh bạn gửi): ⋯ → **Download** → hộp "Download '<tên bài>'" → app tự chọn **MP3** (kể cả khi Suno đang chọn sẵn M4A / WAV) → bấm nút **Download**.
- Hộp Download báo hết lượt tải (nút Download bị khoá, có chữ "limit / upgrade…") → bài được tạo lại ở tài khoản Suno dự phòng; nhật ký chỉ ghi đúng câu Suno báo.

## Bản 1.1.0

- **Mục mới: Tạo nhạc (Suno).** Nút **Tạo nhạc** ở thanh trái, chạy song song với Tạo ảnh / Tạo video trong cùng hàng đợi.
  - Mỗi dòng một prompt mô tả phong cách (vd `lofi chill piano, tiếng mưa nhẹ, 80 bpm`). App mở trang Create của Suno ở chế độ **Advanced**, điền prompt vào ô **Styles**, để trống lời (nhạc không lời), bấm Create.
  - Suno free ra 4 bài mỗi lần: app chỉ xét **2 bài đầu** và tải bản **MP3** của bài **dài hơn**, bằng nút Download của chính Suno.
  - File lưu vào thư mục bạn chọn: trang Tạo nhạc → **Cài đặt nâng cao** → **Thư mục lưu nhạc**. Tên mặc định `{stt}` → `001.mp3`, trùng tên thì thêm (2), không ghi đè.
- **Nhiều tài khoản Suno.** Tài khoản → **Thêm Suno** → **Đăng nhập** (bạn tự đăng nhập suno.com trong app; app không hỏi, không lưu mật khẩu). Có sẵn "Suno 1".
  - Tài khoản báo **hết lượt tải** (hoặc hết credit tạo bài) → bài đó được **tạo lại và tải ở tài khoản Suno dự phòng**. Tài khoản hết lượt nghỉ 6 giờ (nhớ cả khi tắt app); bấm **Kiểm tra** ở tài khoản đó để cho chạy lại sớm.
  - Hết mọi tài khoản Suno còn lượt → hàng chờ tạm dừng, việc về Chờ.
  - Suno hỏi captcha → cửa sổ Suno hiện lên để bạn tự giải (app không giải hộ).
- Cài đặt → Chạy: thêm ô **Chờ tối đa 1 lần tạo nhạc Suno** (mặc định 600 giây).

Lưu ý: phần Suno được kiểm trên trang Suno giả chép theo trang Create và menu Download bạn gửi. Lần đầu hãy chạy 1–2 prompt và xem Nhật ký.
