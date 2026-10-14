# AI Automation Studio 1.0.0

Bản đầu tiên gộp **Muse Automation Studio 1.6.0** và **Flow Automation Studio 2.8.9** thành một app.

- **Một giao diện, hai nơi chạy**: giữ nguyên giao diện Muse. Ở trang Tạo ảnh / Tạo video chọn **Chạy trên: Muse** hoặc **Google Flow**. Hai nơi chạy độc lập, song song, chung một hàng đợi (lọc "Chỉ Muse / Chỉ Flow" trên hàng đợi; mỗi dòng có nhãn MUSE / FLOW).
- **Google Flow chạy theo hàng đợi**: mỗi tài khoản Flow mở một tab chạy ngầm; app gom việc cùng dự án, cùng loại, cùng tỷ lệ thành mẻ (tối đa 10 prompt, chỉnh được), giao cho engine Flow cũ (giữ nguyên engine, chế độ an toàn, chọn model, bấm nút Tạo, gỡ ảnh tham chiếu dính). Từng việc hiện tiến độ riêng, file tải về đặt tên theo mẫu tên chung của app.
- **Tự động qua lại Flow ⇄ Muse**: khi tạo ảnh, bật "Ảnh xong → tự tạo video" và chọn video chạy ở **Muse** hay **Google Flow**. Ảnh Muse sang Flow được tải lên kho Flow và gắn bằng @tên; ảnh Flow sang video Flow cùng tài khoản thì dùng luôn ảnh trên Flow, khỏi tải lên lại.
- **Nhiều tài khoản, lỗi là đổi ngay** — cho cả Muse lẫn Flow: mỗi dự án chọn tài khoản chính + dự phòng cho từng nơi chạy. Việc lỗi chuyển ngay sang tài khoản dự phòng cùng nơi chạy; Flow nhắc "hoạt động bất thường" thì tài khoản đó nghỉ, việc sang dự phòng.
- Cài đặt → **Google Flow**: số tab, cỡ mẻ, số kết quả mỗi prompt, thời gian chờ, chất lượng tải về, model ảnh / model video (chính, phụ xen kẽ, dự phòng), chế độ an toàn, nghỉ giữa thao tác. Cài đặt → **Tắt máy khi chạy hết hàng chờ**.
- Dữ liệu nằm ở thư mục mới `AIAutomationStudio` — không đụng tới dữ liệu và phiên đăng nhập của hai app cũ (cần đăng nhập lại Muse và Google Flow một lần trong app mới).
