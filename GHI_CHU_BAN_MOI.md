# AI Automation Studio 1.0.2

Cải tiến theo góp ý sau lần chạy thử đầu tiên:

- **Nhật ký có nút "Xuất .txt"** (thanh dưới cùng, cạnh "Sao chép") — lưu toàn bộ nhật ký đang hiện ra file `.txt`.
- **Video tạo từ ảnh tự tải về ngay cạnh ảnh, cùng tên** — ảnh Flow → video Muse hoặc ảnh Muse → video Flow: `325.jpg` thì video là `325.mp4` trong cùng thư mục. Trước đây video vào thư mục video mặc định (`Tài liệu/AI Automation Studio/Mac_dinh/…`) nên trông như chưa được tải về. Tắt được ở **Cài đặt → Tải về & dọn dẹp**.
- **Tải về hàng loạt**: tick nhiều việc trong hàng đợi → nút **Tải về** → chọn thư mục, app chép hết file kết quả vào đó.
- **Tên file ảnh mặc định là `{stt}`** (số thứ tự prompt: `001.png`, `002.png`…). Ai đã tự đặt mẫu tên khác thì giữ nguyên.
- **Lỗi → chuyển vòng qua mọi tài khoản**: tài khoản chính lỗi → lần lượt các tài khoản phụ → hết phụ thì quay về tài khoản chính thử lại, cứ thế theo vòng. Việc chỉ báo Lỗi khi đã hỏng ở mọi tài khoản đủ số vòng (Cài đặt → "Lỗi ở mọi tài khoản thì thử thêm (vòng)", mặc định 2). Tài khoản lỗi liên tiếp được nghỉ 15 phút; mọi tài khoản cùng lỗi liên tục thì hàng chờ tạm dừng.
- **Tuỳ chọn tự dọn khi chạy xong hàng chờ** (Cài đặt → Tải về & dọn dẹp, mặc định tắt): tự xoá chat Muse của các việc đã xong; tự xoá dự án Google Flow vừa dùng (lần sau app tự mở dự án mới).
- **Cài đặt: mọi công tắc nằm bên trái, trước dòng chữ**, căn lề trái.
- **Icon mới** cho app: vòng tự động bao quanh nút phát, nền tím → xanh (Windows, macOS và logo trong app).
- Sửa lỗi thấy trong nhật ký:
  - Flow không đổi được model ảnh ("không thấy hộp chọn model"): app nhận tên model có biểu tượng hoặc nhãn đứng trước (kiểu giao diện Flow mới) và cả kiểu model bày sẵn thành hàng nút. Nếu vẫn trượt 2 mẻ liền, tab đó thôi thử và chạy bằng model đang chọn trên Flow thay vì báo lặp mỗi mẻ; nhật ký ghi kèm danh sách nút trong bảng cài đặt để sửa tiếp.
  - Bỏ cảnh báo "Ô nhập vừa có thêm ảnh tham chiếu" khi ảnh chỉ hiện thoáng lúc mở menu tải về (chỉ báo nếu 5 giây sau ảnh vẫn còn).
  - Muse: chờ ảnh đính kèm tải lên xong hẳn rồi mới gửi (giảm trường hợp Muse trả lời "ảnh chưa tải lên được").
  - Dòng "Việc #… xong" trong nhật ký ghi đường dẫn đầy đủ của file.

Phần xoá dự án Flow và chọn model ảnh mới chỉ kiểm được trên trang Flow giả — lần đầu bật nên xem Nhật ký.
