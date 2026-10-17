# AI Automation Studio 1.2.7

- **Sửa lỗi Flow tạo ảnh xong mà không tải về được** (nhật ký 17/10/2026: *"Media 1/1 lỗi: Không chọn được chất lượng tải xuống"* ở mọi lần thử, cả Flow 1, 2, 3). Lỗi do bản **1.2.3** gây ra: để bỏ qua mục 1080p / 4K bị khoá, bản đó ẩn **mọi mục đang mờ** trong menu *Tải xuống* và không bao giờ hiện lại. Menu tải ảnh của Flow lúc mới mở có các mục còn mờ một lúc (Flow đang chuẩn bị file), nên cả **1K, 2K, 4K đều bị ẩn**, app không còn mục nào để bấm. Giờ:
  - Mục chỉ bị coi là khoá khi có chữ / nút **Nâng cấp**, hoặc còn mờ trong lúc mục khác đã sáng. Mờ hết = Flow đang chuẩn bị, app không ẩn gì.
  - Mục **Kích thước gốc** không bao giờ bị ẩn, và app không bao giờ ẩn hết mọi mục. Mục hết mờ thì hiện lại.
  - Nếu app lỡ bấm trúng mục bị khoá (vì lúc đọc menu nó chưa hiện chữ *Nâng cấp*), app bấm ngay mục cao nhất còn mở (ảnh: 1K, video: 720p). Nhật ký ghi *Mục 2K bị khoá (cần nâng cấp) — tải 1K thay.*
  - Nhật ký ghi mục nào bị bỏ qua: *🔒 Menu Tải xuống: bỏ qua mục bị khoá (cần nâng cấp) 2K, 4K — chọn trong: 1K*.
  - Nếu vẫn gặp *"Không chọn được chất lượng tải xuống"*, app tự lưu tệp chẩn đoán (kèm menu *Tải xuống*) vào `Tài liệu/AI Automation Studio/chan-doan-flow`. Gửi tệp đó cho mình là sửa được đúng chỗ.
- **Muse**: đã rà lại quy trình Muse và nối *ảnh Flow → video Muse*, chạy lại toàn bộ bài kiểm tra Muse, không thấy lỗi. Trong nhật ký 17/10 các tài khoản Muse đều đăng nhập bình thường; video Muse chưa chạy vì ảnh Flow chưa tải về được.

Lưu ý: đã kiểm trên trang Flow giả (menu ảnh 1K / 2K / 4K, mục mờ lúc mở, chạy đúng đoạn chọn chất lượng của engine Flow), chưa chạy trên Flow thật. Lần đầu hãy chạy 2–3 ảnh và gửi lại Nhật ký.

## Bản 1.2.6

- **Hộp "Tài khoản chạy dự án" gọn hơn và cuộn được.** Trước đây hộp dài quá màn hình khi có nhiều tài khoản, phần Suno và nút *Lưu* bị che mà không cuộn xuống được. Giờ *Tài khoản chính* và *Chạy cùng lúc* nằm cùng một hàng, các tài khoản dự phòng xếp thành nhiều cột, và hộp tự cuộn khi vẫn dài; nút *Huỷ* / *Lưu* luôn hiện ở dưới cùng. Các hộp thoại khác của app cũng cuộn được như vậy.

## Bản 1.2.5

- **Sửa lỗi Suno vẫn không tải được** (nhật ký 16/10/2026 tối: *"Không bấm được Download của Suno (nut-download-bi-tat …)"* ở mọi bài). Theo video bạn quay:
  - Hộp *Download* vừa mở thì nút **Unlock & Download** còn **mờ** vài giây (Suno đang nạp số lượt tải, ô *Downloads* chưa có số). Bản 1.2.4 bấm ngay lúc nút còn mờ nên báo lỗi. Giờ app **chờ nút sáng** (tối đa 30 giây) rồi mới bấm.
  - Bấm xong, nút đổi thành **"Preparing..."** khoảng 40 giây rồi Suno mới tự tải file MP3 và đóng hộp. Giờ app chờ tới **4 phút** cho file về (trước 1 phút). Nhật ký ghi *Suno đang chuẩn bị file (Preparing…), chờ tải về*.
- **Suno hết credit trong ngày**: nút Create đổi thành *"Create again in 9:44:35"* (nhật ký cũ: *"Bấm Create nhưng Suno không tạo bài nào"* ×3). Giờ app nhận ra ngay, **không bấm Create**, cho tài khoản đó nghỉ **đúng tới giờ Suno ghi** rồi tạo bài ở tài khoản Suno dự phòng; hết tài khoản thì tạm dừng hàng chờ. Bài đã tạo xong mà chưa tải vẫn tải tiếp được ở tài khoản đó.

Lưu ý: đã kiểm trên trang Suno giả dựng lại theo video của bạn, chưa chạy trên suno.com thật. Mỗi lần *Unlock* vẫn trừ 1 lượt tải của tài khoản.

## Bản 1.2.4

- **Sửa lỗi Suno gửi nhiều prompt một lúc mà không tải được bài nào** (nhật ký 16/10/2026: *"Không bấm được Download của Suno (hop-khong-co-nut-download … Unlock & Download …)"* rồi *"Suno đang tạo 14 bài"*). Có ba chỗ hỏng:
  - Hộp *Download* của Suno đã đổi nút to thành **"Unlock & Download"** (kèm chân hộp *Plan Free · Downloads 7*). Bản 1.2.3 chỉ nhận nút tên đúng "Download" nên báo không có nút. Giờ app bấm được **Unlock & Download**; nếu Suno mở khoá xong lại hiện nút *Download "<tên bài>"* thì app bấm tiếp nút đó. Lưu ý: mỗi lần Unlock trừ **1 lượt tải** của tài khoản Suno (tài khoản free trong ảnh còn 7).
  - Tải hỏng thì bản cũ **chạy lại cả việc** — tức là bấm Create gửi lại prompt, Suno đẻ thêm bài mới. Đó là lý do bạn thấy như gửi nhiều prompt cùng lúc. Giờ tải hỏng thì app **tải lại đúng bài vừa tạo** (tối đa 3 lần, nhật ký ghi *tải lại bài này (lần 2/3), không gửi lại prompt*). Hỏng cả 3 lần mà việc được thử lại ở cùng tài khoản thì app vẫn dùng lại bài đã tạo, không bấm Create nữa. Bấm **Tạo lại** ở việc thì mới tạo bài mới.
  - Danh sách bài của Suno nạp chậm hơn ô nhập, nên app tưởng các bài cũ là bài mới (*"đang tạo 14 bài"*). Giờ app chờ danh sách bài nạp xong mới bấm Create, và chỉ lấy đúng 2 bài vừa tạo.
- Mỗi tài khoản Suno vẫn làm **từng prompt một**: gửi prompt → chờ bài tạo xong → ⋯ → *Download* → MP3 → *Unlock & Download* → tải xong mới gửi prompt kế tiếp. Nhiều tài khoản Suno chỉ chạy cùng lúc khi bạn đặt *Chạy cùng lúc* của dự án lớn hơn 1.

Lưu ý: đã kiểm trên trang Suno giả dựng theo ảnh menu, ảnh hộp Download và file HTML bạn gửi, chưa chạy trên suno.com thật. Lần đầu hãy chạy 2–3 prompt và gửi lại Nhật ký (*Xuất .txt*).

## Bản 1.2.3

- **Sửa lỗi Flow tạo video xong mà không tải về được** (nhật ký 16/10/2026: *"Chờ 120s mà Google chưa xuất file"* lặp 3 lần rồi *"5 phút chưa tải về được"*). Đúng như bạn đoán: menu *Tải xuống* của Flow vẫn hiện **1080p** và **4K** nhưng tài khoản thường bị khoá (mờ, kèm nút *Nâng cấp*). App thấy chữ "1080p" là bấm, mục khoá nên bấm không ra gì. Giờ app bỏ qua mục bị khoá và **tự hạ xuống 720p** (Kích thước gốc); nhật ký ghi *Không có 1080p, dùng "720p" thay thế.* Tài khoản được tải 1080p thì vẫn tải 1080p như cũ. Ảnh cũng vậy: 2K / 4K bị khoá thì tải cỡ gốc.
- **Sửa lỗi "Không lưu được tệp chẩn đoán Flow: Script failed to execute"**: trang Flow chặn một cách ghi HTML mà bản 1.2.2 dùng khi chụp. Giờ tệp chẩn đoán lưu được. Khi tải về quá hạn, tệp này còn kèm menu *Tải xuống* gần nhất.

Lưu ý: đã kiểm trên trang Flow giả dựng theo ảnh menu bạn gửi (chạy đúng đoạn chọn chất lượng của engine Flow), chưa chạy trên Flow thật. Lần đầu hãy chạy 2–3 video và gửi lại Nhật ký.

## Bản 1.2.2

- **Sửa lỗi Flow vẫn không tải ảnh lên được** (nhật ký 16/10/2026: *"Không đưa được ảnh lên kho Flow (371_68b883)"* ở mọi tài khoản). Dựa trên file HTML trang dự án và ảnh chụp bạn gửi, có ba chỗ hỏng:
  - Trong bảng [+] mới, bản 1.2.1 bấm nhầm mục lọc **"Tệp tải lên"** (danh sách bên trái) thay vì nút **"Tải nội dung nghe nhìn lên"** ở dưới cùng → không có hộp chọn file nào mở ra, app phải kéo-thả và Flow không nhận. Giờ app chỉ bấm nút có chữ bắt đầu bằng *Tải … lên* / *Upload*, bỏ qua các mục lọc.
  - Ảnh đã lên kho mà engine vẫn báo thiếu: bảng kho mới không còn đúng các dấu mà engine Flow (giống tool Flow cũ) dùng để tìm ảnh theo tên → app thêm một lớp "nắn" bảng kho để engine thấy đúng ảnh *371_68b883.png*, rồi gắn được ảnh vào prompt bằng nút **Thêm vào câu lệnh**.
  - Nếu Flow lại đổi giao diện mà vẫn hỏng, app lưu HTML của bảng ảnh (đã bỏ hình, không có mật khẩu) vào **Tài liệu/AI Automation Studio/chan-doan-flow** và ghi đường dẫn vào nhật ký — gửi tệp đó để sửa tiếp nhanh.
- **Tự chuyển mục Hình ảnh / Video trên Flow.** Việc tạo ảnh → app tự mở bảng cài đặt (nút *🍌 Nano Banana… x1*) và chọn **Hình ảnh**; việc tạo video → chọn **Video**; video từ ảnh (ảnh gắn @tên) → chọn thêm **Thành phần** (ảnh khung đầu/cuối → **Khung hình**). Nhật ký ghi *🎛 Đã tự đổi Flow sang mục Video* / *Đã chọn "Thành phần" trong mục Video*.

Lưu ý: đã kiểm trên trang Flow giả dựng lại từ HTML và ảnh chụp bạn gửi (chạy đúng engine Flow thật của app), chưa chạy trên Flow thật. Lần đầu hãy chạy 2–3 video từ ảnh và 2–3 ảnh ở Flow, gửi lại Nhật ký (*Xuất .txt*); nếu vẫn lỗi, gửi kèm tệp trong thư mục *chan-doan-flow*.

## Bản 1.2.1

- **Muse từ chối tạo video từ ảnh → riêng ảnh đó tự sang Google Flow.** Muse trả lời kiểu *"Mình không thể tạo video từ ảnh này."* → app nhận ra ngay (không chờ hết giờ), chuyển **chỉ việc đó** sang tài khoản Flow của bạn để tạo video từ đúng ảnh đó; các ảnh khác vẫn tạo ở Muse như thường. Tài khoản Muse không bị tính lỗi. Nhật ký ghi *🔀 Muse → Flow: #… Muse từ chối tạo video: "…"*.
- **Muse ⇄ Flow: bên nào lỗi thì tự đổi sang bên kia.** Mọi tài khoản Muse của dự án đều lỗi / nghỉ → việc Muse còn lại sang Flow; mọi tài khoản Flow đều lỗi → việc Flow (ảnh **và** video) sang Muse; một việc hỏng ở mọi tài khoản một bên → thử ở bên kia trước khi báo Lỗi. Mỗi việc chỉ đổi bên **một lần** (hỏng cả hai bên thì báo Lỗi, không đẩy qua lại mãi). Bên kia cần có tài khoản đã đăng nhập (hoặc được chọn trong dự án) — "Flow 1" có sẵn mà bạn chưa đăng nhập thì không nhận việc. Công tắc chung ở **Cài đặt → Chạy → Muse ⇄ Flow** (thay công tắc *Flow hỏng hết → Muse* cũ ở mục Google Flow; nếu bạn đã tắt công tắc cũ thì công tắc mới cũng tắt).
- **Sửa lỗi "Tải ảnh lên Flow hỏng: Không tìm thấy ô tải ảnh lên của Flow"** (nhật ký 16/10/2026). Nguyên nhân: cách tải ảnh lên của engine Flow (giống hệt tool Flow cũ 2.8.9) là bấm [+] rồi chờ một ô chọn file nằm sẵn trong trang — giao diện Flow mới không còn ô đó, nên tool cũ cũng sẽ hỏng y như vậy. Giờ engine hỏng thì app tự làm như người: bấm [+] / *Thêm* → tab *Hình ảnh* → *Tải lên*, đưa đúng file ảnh vào hộp chọn file (hộp này không hiện lên màn hình); không có nút đó thì kéo-thả ảnh vào ô nhập prompt. Sau đó app kiểm lại kho Flow; vẫn hỏng thì nhật ký ghi danh sách nút quanh ô nhập (*🔎 Quanh ô nhập Flow: …*) để sửa tiếp, và việc chuyển tài khoản / sang Muse như thường.

Lưu ý: phần mới được kiểm trên trang Muse / Flow giả (dựng theo ảnh bạn gửi), chưa chạy trên muse.ai / Flow thật. Lần đầu hãy chạy 2–3 video từ ảnh ở Flow và gửi lại Nhật ký (*Xuất .txt*); nếu vẫn lỗi tải ảnh, chụp giúp menu [+] của Flow.

## Bản 1.2.0

- **Mỗi dự án chạy được nhiều tài khoản cùng lúc** (Muse, Google Flow, Suno). Bấm nút tài khoản cạnh tên dự án → ô **Chạy cùng lúc** → chọn 2, 3… tài khoản. Tài khoản chính + các tài khoản đầu danh sách dự phòng chạy **song song**, việc chia đều cho nhau (mẻ Flow cũng chia đôi, chia ba). Tài khoản nào lỗi thì nghỉ, tài khoản dự phòng kế tiếp vào thay. Để 1 = như cũ (chỉ tài khoản chính chạy, lỗi mới đổi).
- **Flow hỏng hết tài khoản khi tạo ảnh → tự chuyển sang Muse.** Mọi tài khoản Flow của dự án đều lỗi → dừng Flow cho dự án đó, các ảnh còn lại tự tạo tiếp ở tài khoản Muse của dự án; nhật ký ghi dòng *🔀 Flow: … chuyển … sang Muse*. (Từ 1.2.1 thành công tắc chung *Muse ⇄ Flow* ở Cài đặt → Chạy.)
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
