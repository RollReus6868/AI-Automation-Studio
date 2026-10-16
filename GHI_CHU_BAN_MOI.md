# AI Automation Studio 1.2.0

- **Mỗi dự án chạy được nhiều tài khoản cùng lúc** (Muse, Google Flow, Suno). Bấm nút tài khoản cạnh tên dự án → ô **Chạy cùng lúc** → chọn 2, 3… tài khoản. Tài khoản chính + các tài khoản đầu danh sách dự phòng chạy **song song**, việc chia đều cho nhau (mẻ Flow cũng chia đôi, chia ba). Tài khoản nào lỗi thì nghỉ, tài khoản dự phòng kế tiếp vào thay. Để 1 = như cũ (chỉ tài khoản chính chạy, lỗi mới đổi).
- **Flow hỏng hết tài khoản khi tạo ảnh → tự chuyển sang Muse.** Mọi tài khoản Flow của dự án đều lỗi → dừng Flow cho dự án đó, các ảnh còn lại tự tạo tiếp ở tài khoản Muse của dự án; nhật ký ghi dòng *🔀 Flow: … chuyển … sang Muse*. Tắt được ở Cài đặt → Google Flow → *Flow hỏng hết tài khoản thì tạo ảnh tiếp ở Muse*.
- **Nhận ra tài khoản Flow lỗi nhanh hơn** (thay cho "Chế độ an toàn", giờ luôn bật):
  - Flow báo "hoạt động bất thường" / "quá nhiều yêu cầu" / hết tín dụng (đọc cả chữ trên thẻ lỗi) → đổi tài khoản **ngay từ lỗi đầu tiên**.
  - Không thấy câu đó: **2 prompt khác nhau hỏng liền nhau** → đổi tài khoản (trước đây phải đủ 3 lỗi trong 5 phút, và khi tắt chế độ an toàn thì phải đợi 2 việc hỏng hết lượt thử lại). Một prompt bị thử lại nhiều lần vẫn tính là một, nên prompt vi phạm chính sách không làm "oan" tài khoản.
  - Tài khoản lỗi nghỉ 15 phút (bị lại thì gấp đôi, tối đa 60 phút), việc của nó chuyển ngay sang tài khoản khác.
  - *Thử lại cùng tài khoản* mặc định còn 1 lần (trước 2) — lỗi là sang tài khoản khác thay vì gõ mãi một tài khoản. Nếu bạn đã tự đặt số khác, app giữ nguyên số của bạn.
- **Bỏ khỏi Cài đặt → Google Flow** (không còn hợp kiểu chạy mới): công tắc *Bật chế độ an toàn* (giờ luôn bật), *trong (phút)*, *Nghỉ tối đa*, *Bị chặn lại thì nghỉ gấp đôi* (giờ tự động), *Giải lao sau mỗi … prompt* và *Giải lao (phút)* (nghỉ giải lao giữ việc đứng chờ trong khi tài khoản khác chạy được).

- **Mục Tài khoản tách riêng Muse / Flow / Suno**: ba thẻ ở đầu danh sách (kèm số tài khoản mỗi nơi), mỗi thẻ chỉ hiện tài khoản và nút *Thêm* của nơi đó; app nhớ thẻ bạn mở lần trước.
- **Sửa theo nhật ký 16/10/2026:**
  - Flow tạo xong mà **tải về bị kẹt** ("Chờ 120s mà Google chưa xuất file" lặp ~16 phút ở cùng một tài khoản): giờ quá **5 phút** chưa tải được là app bỏ, việc chạy lại ở tài khoản khác, và tính là một lỗi của tài khoản đó.
  - Thẻ lỗi Flow ghi "hoạt động bất thường" (Flow 4 trong nhật ký) → đổi tài khoản ngay, không thử lại 3 lần như trước.
  - Muse trả lời **"lỗi 403 / tạo video không khả dụng tại khu vực này"** (Muse 3 trong nhật ký): app nhận ra ngay (không chờ 2 phút), tài khoản đó thôi nhận **video** 60 phút (ảnh vẫn chạy), video chuyển ngay sang tài khoản Muse khác.

Lưu ý: phần mới được kiểm trên trang Muse / Flow giả. Lần đầu hãy chạy vài prompt với 2 tài khoản cùng lúc và xem Nhật ký.

## Bản 1.1.3

- **Sửa lỗi đăng nhập Suno bằng Google** ("Couldn't sign you in — This browser or app may not be secure"): khung đăng nhập Suno giờ dùng cùng kiểu trình duyệt với khung đăng nhập Google Flow (vốn đăng nhập Google được trong app). Nếu Google vẫn từ chối, gửi lại ảnh chụp cho người phát triển.
- **Sửa lỗi khung đăng nhập "treo" đè lên các mục khác**: bấm *Xong, đóng lại*, chuyển sang mục khác hoặc xoá tài khoản thì khung đăng nhập đóng **ngay**; bước kiểm tài khoản chạy ngầm sau đó (trước đây khung nằm đè lên màn hình tới khi kiểm xong, có khi ~25 giây).

## Bản 1.1.2

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
