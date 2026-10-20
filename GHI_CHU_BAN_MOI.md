# AI Automation Studio 1.4.0

- **Đưa ảnh / video lên Google Drive.** Ảnh xong vào thư mục `<Tên dự án>/images`, video vào `<Tên dự án>/Videos` trên Drive. App tự tạo thư mục, file vẫn giữ ở máy như cũ. Có hai cách, chọn ở *Cài đặt → Google Drive → Cách đưa lên*:
  - **Chép vào thư mục Google Drive trên máy.** Cần cài *Google Drive cho máy tính* và đăng nhập sẵn. Bấm *Tự tìm* (thường là `G:\My Drive`) hoặc *Chọn…*. Drive tự tải lên, mất mạng thì tự tải tiếp.
  - **Tải thẳng lên drive.google.com bằng trình duyệt trong app.** Vào *Tài khoản → thẻ Drive → Thêm Drive → Đăng nhập* (đăng nhập Google một lần; app không giữ mật khẩu). Rồi chọn tài khoản đó ở *Cài đặt → Google Drive*. App mở Drive ở cửa sổ ẩn, bấm *Mới → Thư mục mới* / *Tải tệp lên* như người dùng. Tạo lại một việc thì file trên Drive được **thay thế**; file trùng tên của việc khác thì **giữ cả hai**.
  - Bật *Ảnh / video xong thì tự đưa lên Google Drive* để tự đưa sau mỗi việc. Việc đã xong từ trước: chọn việc → **Lên Drive**. Đưa lên hỏng thì việc vẫn *Xong*; nhật ký ghi dòng ☁ kèm lý do. Với cách 2, app lưu trang Drive vào `Tài liệu/AI Automation Studio/chan-doan-drive`.
- **Đổi prompt hàng loạt.** Tick *Chọn hết* (hoặc chọn vài dòng) → **Đổi prompt**. Có thể thay hẳn bằng prompt mới, hoặc tìm và thay một đoạn chữ. Ở trang Tạo ảnh còn đổi được prompt của video sẽ tự tạo từ ảnh. Việc đang chạy giữ prompt cũ. Việc đã xong / lỗi chỉ tạo lại khi bạn tick ô *tạo lại và chạy ngay*.
- **Đổi ngay sang Muse / Flow.** Nút ⋮ ở mỗi việc (hoặc cột chi tiết) → *Đổi sang Flow / Muse & chạy ngay*. Chọn nhiều việc thì dùng nút **Sang Muse** / **Sang Flow**. Việc đang chạy dừng ở bên cũ rồi chạy ở bên mới; việc đã xong được tạo lại ở bên mới. Bên mới phải có tài khoản đã đăng nhập trong dự án.
- **Đồng hồ dự án.** Cạnh tên dự án có thời gian dự án đã chạy và dự đoán còn bao lâu. Lượt mới chạy thì dự đoán theo thời gian trung bình mỗi việc; chạy được hơn 1 phút thì theo tốc độ thật của lượt đó. Rê chuột lên đồng hồ để xem tổng thời gian, số việc còn lại và giờ dự kiến xong.
- **Chạy lại tài khoản đang nghỉ vì lỗi.** Thẻ tài khoản đỏ có nút **Chạy lại ngay**; đầu mục Tài khoản có **Chạy lại TK đang nghỉ** cho mọi tài khoản đỏ. Dùng khi lỗi đã sửa được (đăng nhập lại, đổi mạng…): tài khoản nhận việc lại luôn, không chờ hết giờ nghỉ. Dự án đã tự tạm dừng vì hết tài khoản thì chạy tiếp.
- **Nhẹ máy hơn.** Các trang Muse / Flow / Suno chạy ngầm được hạ ưu tiên CPU, nên máy còn mượt khi bạn làm việc khác (tắt ở *Cài đặt*, công tắc *Máy mượt*). Nhật ký ghi ra đĩa theo nhịp thay vì từng dòng. Hàng đợi dài thì giao diện cập nhật thưa hơn; cửa sổ thu nhỏ thì thôi vẽ lại. Khung nhật ký gom vẽ lại.
- Mọi quy trình chạy cũ giữ nguyên. Các tính năng mới đều tắt sẵn hoặc chỉ chạy khi bạn bấm (riêng *Máy mượt* bật sẵn).

Lưu ý: đã kiểm bằng bài kiểm tự động và trên các trang Muse / Flow / Suno / Google Drive giả, chưa chạy trên các trang thật. Với cách tải thẳng lên Drive, nhật ký nên có dòng *"☁ #… đã đưa lên Google Drive: Drive: <Tên dự án>/images/…"*. Nếu hỏng, gửi tệp trong `chan-doan-drive` kèm nhật ký.

## Bản 1.3.8

- **Tài khoản lỗi ghi rõ lỗi gì.** Thẻ tài khoản màu đỏ (mục *Tài khoản*) và hộp chọn tài khoản của dự án giờ ghi nguyên câu mà Muse / Flow báo, không còn ghi chung chung. Ví dụ theo nhật ký 19/10/2026 của bạn:
  - Muse 1: *"Đang nghỉ: lỗi 8 việc liên tiếp, lần gần nhất: Muse trả lời chữ, không có video: "Lượt tạo video hôm nay đã hết…""*. Trước đây chỉ ghi *"lỗi 8 việc liên tiếp"*.
  - Flow 3: *"Đang nghỉ: Flow lỗi: Trang Flow đang hiện thông báo hoạt động bất thường / hết lượt — Flow ghi: "Chúng tôi nhận thấy có hoạt động bất thường nào đó…""*.
  - Dòng ⚠ / 🛑 trong nhật ký và dòng ⏸ (khi hàng chờ tạm dừng vì hết tài khoản) cũng ghi đúng câu đó cho từng tài khoản.
  - Trong hộp chọn tài khoản của dự án, tài khoản đỏ có dòng lý do ngay dưới tên, không phải rê chuột mới thấy. Lỗi dài được cắt còn một dòng khoảng 200 ký tự.

Lưu ý: đã kiểm bằng bài kiểm với đúng các câu trong nhật ký của bạn và trên trang giả, chưa chạy trên Muse / Flow thật.

## Bản 1.3.7

- **Ảnh Flow tạo xong mà không tải về được ("Chờ 120s mà Google chưa xuất file").** Nguyên nhân (nhật ký 19/10/2026 02:04–02:21 và file chẩn đoán): app tải ảnh Flow ở chất lượng **2K**. 2K không phải file gốc, mà là Flow **tăng độ phân giải**, việc này tốn tín dụng AI của tài khoản. Khi Flow không tăng được (thường do hết tín dụng), nó hiện thông báo đỏ *"Không tăng được độ phân giải!"* và không xuất file nào. Engine vẫn chờ đủ 120 giây, rồi thử lại đúng mục 2K đó, nên sau 5 phút việc bị tính lỗi và tài khoản bị tính lỗi oan. Giờ:
  - Ảnh Flow tải mặc định **1K (Kích thước gốc)**: file có ngay, không tốn tín dụng. Ai đang để 2K mặc định được chuyển sang 1K. Muốn 2K / 4K vẫn chọn được ở *Cài đặt → Google Flow → Chất lượng ảnh tải về*.
  - Nếu vẫn chọn 2K / 4K (hoặc video 1080p / 4K) mà Flow báo *"Không tăng được độ phân giải!"*, app tự tải lại bản **Kích thước gốc** (1K cho ảnh, 720p cho video) ngay, không chờ 120 giây. Trong 30 phút sau đó, tab đó tải thẳng Kích thước gốc. Nhật ký ghi dòng 🔁.
  - Việc bị bỏ vì quá 5 phút chưa tải về: app **nạp lại trang Flow** của tab đó, để mẻ sau không phải đứng chờ thêm 2 phút sau lần chờ cũ của engine (nhật ký ghi dòng 🔄).
- **Tài khoản đỏ / xanh.** Ở mục *Tài khoản*, thẻ tài khoản có viền và chấm màu:
  - **Xanh**: chạy được (việc gần nhất xong, đang chạy, hoặc đã đăng nhập mà chưa lỗi).
  - **Đỏ**: việc gần nhất lỗi, đang nghỉ (ghi lý do và giờ chạy lại, vd *"Đang nghỉ: Google báo hoạt động bất thường · chạy lại lúc 03:15"*), hết lượt, bị Muse chặn video, hoặc chưa đăng nhập.
  - **Xám**: chưa kiểm.
  - Thẻ Muse / Flow / Suno ở đầu mục ghi thêm số tài khoản đang lỗi. Hộp chọn tài khoản của dự án cũng có chấm màu cạnh từng tài khoản.
- **Tài khoản riêng cho ảnh và video.** Bấm nút tài khoản cạnh tên dự án: mỗi tài khoản Muse / Flow có thêm hai ô **Ảnh** và **Video** (bật sẵn). Bỏ dấu ô nào thì tài khoản đó không chạy loại việc đó. Ví dụ để Flow 1 chỉ tạo ảnh: bỏ dấu ô *Video* ở Flow 1. Video nối từ ảnh khi đó chạy ở tài khoản khác: app tự tải ảnh lên tài khoản đó. Vai *Chạy / Dự phòng / Không dùng* vẫn như cũ; số tài khoản chạy cùng lúc tính theo từng loại. Nếu bỏ hết mọi tài khoản của một loại, app nhắc ngay khi lưu.

Không sửa được trong app, và app sẽ không lách:
- Google báo *"hoạt động bất thường"* ở một số tài khoản Flow: tài khoản đó tự nghỉ rồi chạy lại.
- Flow từ chối prompt có người nổi tiếng.
- Muse hết lượt video trong ngày.

Lưu ý: đã kiểm trên trang Flow giả, có thông báo *"Không tăng được độ phân giải!"* chép đúng cấu trúc từ file chẩn đoán của bạn. Chưa chạy trên Flow thật. Sau khi cài, nhật ký nên có dòng *"⬇️ Đã tải"* cho ảnh, hoặc dòng 🔁 nếu bạn vẫn để 2K.

## Bản 1.3.6

- **Hẹn giờ chạy, riêng cho từng chức năng.** Mục mới **Hẹn giờ** ở thanh bên trái có ba thẻ: **Tạo ảnh**, **Tạo video**, **Tạo nhạc**. Mỗi thẻ đặt riêng:
  - **Giờ bắt đầu**: tới giờ, app tự chạy mọi việc **đang chờ** của chức năng đó (giống bấm Chạy, nhưng chỉ chạy loại việc đó). Ví dụ hẹn Tạo ảnh 22:00 thì chỉ ảnh chạy; video và nhạc vẫn chờ hẹn của chúng.
  - **Giờ dừng** (tuỳ chọn): tới giờ thì app dừng, việc đang dở về hàng chờ. Để trống thì chạy tới hết hàng chờ. Khung giờ qua đêm được (vd 22:00 → 06:00).
  - **Lặp lại**: mỗi ngày, hoặc chỉ một lần (chạy xong thì hẹn tự tắt).
  - **Chạy việc của**: mọi dự án, hoặc một dự án.
  - Ảnh có bật *Ảnh xong → tự tạo video* thì video nối từ ảnh chạy tiếp ngay trong lượt hẹn của Tạo ảnh.
  - Thẻ hiện *Lần tới: 22:00 hôm nay* hoặc *Đang chạy theo hẹn · dừng 06:00*, có nút **Dừng lượt đang chạy**. Thanh trên cùng có chip ⏰ cho biết hẹn sắp tới; bấm vào để mở mục Hẹn giờ.
  - Nhật ký ghi lúc bắt đầu / dừng / chạy hết theo hẹn (dòng ⏰).
- Cách dùng: thêm việc bằng **Tạo & chạy → Chỉ thêm vào hàng đợi (chưa chạy)**, rồi đặt hẹn ở mục Hẹn giờ. App phải **đang mở** (thu nhỏ được) và máy **đang bật**. Khi có hẹn đang bật, app giữ máy không tự ngủ (màn hình vẫn tắt bình thường). Nếu máy ngủ / app mở lại trễ quá 10 phút sau giờ hẹn mà không đặt giờ dừng, lần đó được bỏ qua để app không tự chạy bất ngờ; có giờ dừng thì app mở lại trong khung giờ vẫn chạy.
- Các phần khác giữ nguyên: nút Chạy / Dừng dự án, chạy từng việc, cài đặt từng dự án vẫn như cũ. Bấm *Dừng dự án* trong lúc đang chạy theo hẹn thì dự án đó thôi chạy ở lượt hẹn này.

Lưu ý: đã kiểm bằng đồng hồ giả (ảnh / video / nhạc, Muse / Flow / Suno giả, hai dự án, giờ dừng, qua nửa đêm), chưa chạy hẹn giờ trên máy Windows thật.

## Bản 1.3.5

- **Tải video Flow chỉ tải đúng video của việc đó** (nhật ký 18/10/2026 18:09–18:11: *"[flow7] [1] 🔗 Đã bốc 11 thẻ từ bộ lọc Search"* rồi tải lần lượt `v964_1` … `v964_8`, mỗi file khoảng 10 giây). Công tắc *Thêm số thứ tự vào đầu câu lệnh gửi Flow* vẫn chạy, nhưng số đó là số thứ tự trong **mẻ**. App giao Flow mỗi mẻ 1 prompt, nên mọi prompt đều mang số **"1."**. Video làm từ ảnh lại dùng chung một prompt, nên khi tải, ô Tìm kiếm của Flow với chữ *"1. Animate this cartoon image…"* bắt cả mọi video cũ trong dự án. Giờ app gắn **số của việc** vào đầu prompt, ví dụ *"#964. Animate this cartoon image…"*, và khi tải, Flow chỉ tìm đúng *"#964. …"*, nên ra đúng thẻ của việc đó. Dấu **#** để số không lẫn nhau (*"#64."* không nằm trong *"#964."*). Số này cũng là số trong tên trên Flow (`…_v964`) và cột **#** trong hàng đợi của app.
  - Công tắc nằm ở *Cài đặt → Google Flow → Thêm số thứ tự vào đầu câu lệnh gửi Flow* (bật sẵn). Tắt thì app không gắn số.
  - Video cũ đã có trong dự án Flow vẫn mang *"1."*, nên không bị bốc nữa. Việc mới mang số riêng.

Lưu ý: đã kiểm bằng hàm tìm thẻ thật của engine trên trang Flow giả: 9 video cũ cùng prompt + 1 video mới → chỉ bốc 1 thẻ, còn cách đánh số cũ bốc cả 10. Chưa chạy trên Flow thật.

## Bản 1.3.4

- **App hết phình RAM và giật khi hàng đợi có nhiều video** (ảnh Task Manager 18/10/2026: app 7,7 GB, một tiến trình 2,1 GB). Ở trang Tạo video và Thư viện, mỗi video đã xong là một trình phát video sống (200 video = 200 trình phát, mỗi cái giữ bộ giải mã và khung hình). Mỗi lần một việc đổi trạng thái (khi đang chạy là vài lần mỗi giây), cả danh sách bị vẽ lại và mọi trình phát bị tạo lại. Đo trên máy kiểm với 200 video: riêng giao diện tăng từ 1,8 GB lên 3,4 GB sau 10 giây đang chạy. Giờ:
  - Mỗi video chỉ được mở **một lần** để chụp một ảnh nhỏ, rồi đóng ngay. Danh sách và Thư viện hiện ảnh nhỏ đó. App chỉ chụp video đang hiện trên màn hình, lần lượt từng cái. Bấm đúp hoặc mở Chi tiết vẫn xem được video như cũ.
  - Việc đổi trạng thái thì chỉ dòng của việc đó được vẽ lại, các dòng khác giữ nguyên.
  - Cùng 200 video, giao diện giờ chiếm khoảng 0,35–0,4 GB và không tăng khi đang chạy.
- Nhật ký ghi **RAM của app theo từng phần** mỗi 10 phút khi đang chạy, ví dụ *"🧠 RAM app: 4,1 GB — Muse 1 · L1 1,2 · Muse 1 · L2 1,1 · giao diện 0,4 · …"*. Mỗi luồng Muse / tab Flow là một trang web thật, thường chiếm 1–1,5 GB. Nếu tổng quá 6 GB, nhật ký nhắc giảm số luồng / tab mỗi tài khoản khi máy chậm.
- Khi lấy xong video, luồng Muse dừng video trên trang (trước đây video kết quả cứ phát lặp trong cửa sổ ẩn lúc luồng chờ việc kế tiếp).
- File dữ liệu (`du-lieu.json`, khoảng 2 MB với vài trăm việc) được ghi gom 1,5 giây một lần thay vì 0,25 giây, nên app bớt khựng và bớt ghi đĩa. Tắt app vẫn ghi nốt.
- `nhat-ky.txt` quá 20 MB thì được đổi tên thành `nhat-ky-cu.txt` và app ghi file mới.

Lưu ý: đã đo trên máy kiểm (Linux, video mẫu), chưa đo trên máy Windows của bạn. Sau khi cài, chạy như thường 20–30 phút rồi gửi nhật ký, dòng 🧠 sẽ cho biết phần nào còn chiếm RAM.

## Bản 1.3.3

- **Tải video Flow nhanh hơn: chỉ tải đúng video vừa tạo** (nhật ký 18/10/2026 10:31–11:24). Mỗi video càng về sau càng lâu: #355 tải 3 file, #357 tải 5 file, từ #362 tải 11 file cho một prompt, mỗi việc mất khoảng 4,5 phút trong khi Flow tạo chỉ khoảng 1 phút. Video làm từ ảnh dùng chung một prompt, nên khi engine lọc bằng ô Tìm kiếm của Flow để tìm video vừa tạo, Flow trả về cả mọi video cũ cùng prompt trong dự án, và engine tải lại hết từng cái rồi app mới bỏ file thừa. Giờ app nhớ thẻ của lần tạo này và ẩn các thẻ cũ trong lúc engine lọc, nên engine chỉ tải 1 file. Nhật ký ghi *"🎯 Ô Tìm kiếm của Flow bắt N thẻ cùng prompt — chỉ để lại 1 thẻ của lần tạo này, ẩn … thẻ cũ"*. Nếu app không nhận ra thẻ mới, nó không ẩn gì và vẫn bỏ file thừa như bản cũ.
- **Sửa lỗi tự xoá dự án Flow** (nhật ký 10:29, cả 5 tài khoản: *"không thấy nút tuỳ chọn trong thẻ dự án"*). Thẻ dự án trên trang chủ Flow giờ không còn nút ⋮ mà có sẵn hai nút **edit** (đổi tên) và **delete** (xoá). App bấm thẳng nút xoá rồi xác nhận, không bao giờ bấm nút đổi tên.

Lưu ý: đã kiểm trên trang Flow giả, chạy đúng hàm lọc thẻ của engine thật, chưa chạy trên Flow thật.

## Bản 1.3.2

- **Sửa lỗi Flow không nhận ảnh tải lên ở một số tài khoản** (nhật ký 17/10/2026 21:49: *"Không đưa được ảnh lên kho Flow"* ở Flow 2, 3, 4, 5). Bốn tệp chẩn đoán bạn gửi cho thấy: ở tài khoản chưa từng tải ảnh lên, Flow mở hộp **"Quyền sử dụng hình ảnh này"** (Huỷ / Tôi đồng ý), và ảnh chỉ vào kho khi bấm **Tôi đồng ý**. App không bấm nên ảnh không bao giờ vào kho. Theo lựa chọn của bạn, giờ app tự bấm **Tôi đồng ý** và nhật ký ghi lại mỗi lần bấm. Công tắc nằm ở *Cài đặt → Google Flow → Tự bấm "Tôi đồng ý"…* (bật sẵn). Nếu tắt công tắc, app báo ngay tài khoản nào cần bạn tự bấm một lần, không chờ 60 giây vô ích.
- **Muse ⇄ Flow: luôn đủ số tài khoản chạy cùng lúc** (lần chạy 18/10/2026 00:17–00:42). Dự án chạy 5 tài khoản Flow cùng lúc, 3 dự phòng. 7 tài khoản Flow lần lượt hết credit hoặc bị *"hoạt động bất thường"*, nên suốt 7 phút chỉ còn đúng 1 tài khoản Flow chạy, Muse ngồi không. Bản cũ chỉ chuyển sang Muse khi **mọi** tài khoản Flow đều nghỉ, và lúc đó chuyển **cả hàng chờ** (321 video) sang Muse, Flow nghỉ xong cũng không lấy lại. Giờ:
  - Tài khoản lỗi thì tài khoản **Dự phòng** cùng bên vào thay trước. Hết dự phòng mà còn thiếu (vd chạy 5 Flow, chỉ còn 1 Flow chạy được) thì Muse **chạy thêm 4 tài khoản** cho đủ 5 và chỉ nhận vừa đủ việc cho 4 tài khoản đó (4 × số luồng mỗi tài khoản), không nhận cả hàng chờ. Nhật ký ghi *"🔀 Flow → Muse: … chỉ còn 1 tài khoản chạy được video — Muse chạy thêm 4 tài khoản, nhận … video"*.
  - Flow hết giờ nghỉ, có lại tài khoản: video đã chuyển mà **chưa chạy** quay về Flow (*"🔀 Flow đã có lại tài khoản chạy được … quay về Flow"*). Video đang chạy ở Muse thì chạy tiếp.
  - Chiều ngược lại cũng vậy: Muse thiếu tài khoản (vd bị chặn video theo khu vực) thì Flow chạy thêm cho đủ.
- **Sửa lỗi Flow vẫn không nhận ảnh sau khi app bấm "Tôi đồng ý"** (lần thử 17/10/2026 23:26–23:29). Cả 4 lần app bấm *Tôi đồng ý* (Flow 2, 3, 4, 5), ảnh đều không vào kho. Lần tải sau ở cùng tài khoản thì Flow không hỏi nữa và ảnh vào ngay. Nghĩa là khi hỏi quyền, Flow bỏ luôn ảnh đang chờ. Giờ bấm *Tôi đồng ý* xong, app kiểm kho và tải lại ảnh còn thiếu (nhật ký ghi *"Bấm "Tôi đồng ý" xong Flow chưa giữ ảnh — tải lại…"*), không mất 60 giây rồi chuyển tài khoản nữa.
- **Tài khoản Flow hết credit giờ được nhận ra ngay** (Flow 1, nhật ký 23:27–23:29: *"Create button not found"* 3 lần). Tệp chẩn đoán cho thấy chỗ nút Tạo, Flow đặt nút **"Cảnh báo về việc không đủ tín dụng"**, tức là tài khoản không đủ credit cho model đang chọn (Veo 3.1 - Lite, 10 credit mỗi lần). Giờ app nhận ra nút đó, ghi *"💳 … không đủ credit"*, cho tài khoản nghỉ 3 giờ và chuyển việc sang tài khoản khác ngay, không thử lại 3 lần nữa. Bấm **Chạy** lại thì mọi tài khoản được thử lại từ đầu.
- **Sửa lỗi bấm Tạo mà Flow không nhận khi làm video từ ảnh** (nhật ký 21:48: *"Đã thử cả bốn kiểu bấm … mà Flow không nhận"*). Ngay sau khi gắn ảnh vào ô nhập, engine bỏ qua bước dán prompt mà không báo gì, rồi bấm Tạo với ô nhập trống. Giờ app nhận ra trường hợp này, chờ ô nhập gõ được, dán đúng prompt rồi mới bấm Tạo (nhật ký ghi *"🩹 Engine bỏ qua bước dán prompt … app tự dán"*).
- **Sửa lỗi Flow kẹt ở trang 404 khi dự án Flow cũ đã bị xoá** (nhật ký 18/10/2026 01:34, Flow OCHO: *"Chưa vào được dự án Flow — tab đang ở flow.google.com/404?reason=project"*, rồi tài khoản bị cho nghỉ 15 phút). Mỗi dự án của tool nhớ một dự án Flow riêng trên từng tài khoản. Dự án Flow đó đã bị xoá bên Flow, nên Flow mở trang 404, và app cứ chờ ở đó 120 giây. Giờ gặp trang 404, app quên dự án Flow cũ (ảnh đã tải lên dự án đó cũng được tải lại khi cần), về trang chủ Flow và tự bấm **"+ Dự án mới"**. Nhật ký ghi *"🗑 … Dự án Flow đã lưu không còn nữa (Flow báo 404)"*. Bạn không cần tự mở dự án trong khung Đăng nhập: app luôn tự tạo dự án Flow mới cho mỗi dự án của tool.
- **Sửa lỗi xoá chat Muse báo "xoa-xong-nhung-danh-sach-khong-doi"** (tệp chẩn đoán 18/10/2026 01:00). HTML bạn gửi cho thấy danh sách chat phụ của Muse nạp dần: xoá một chat thì chat kế tiếp được nạp bù, nên số hàng vẫn là 26. Hàng chat thật cũng không có đường dẫn hay mã chat, nên bản cũ (đếm số hàng) luôn tưởng chưa xoá được. Giờ app nhận ra từng hàng bằng mã của nút ⋯, nên biết chính xác chat đó đã mất khỏi danh sách hay chưa. Nếu Muse không nhận cú bấm tự động (chat vẫn còn sau khi bấm Delete và xác nhận), app tự chuyển sang **bấm chuột thật**: rê chuột vào hàng cho nút ⋯ hiện ra, bấm ⋯ → Delete → xác nhận. Nhật ký ghi *"🖱 … chuyển sang bấm chuột thật"*. Nếu vẫn không xoá được, tệp chẩn đoán giờ lưu thêm hộp xác nhận lúc bấm và thông báo Muse hiện ra.
- Sau khi gắn ảnh, nếu bảng ảnh của Flow còn để lại lớp nền tối che nút Tạo, app đóng nó trước khi bấm.
- Nếu ô tìm kiếm của bảng [+] chưa tìm ra ảnh vừa tải nhưng ảnh đã hiện trong lưới dự án Flow, app vẫn giao việc thay vì báo thiếu ảnh. Nếu Flow hiện hộp thoại lạ ngay sau khi nhận ảnh, nhật ký ghi lại chữ và các nút của hộp đó.

Lưu ý: đã kiểm trên trang Flow giả dựng theo HTML thật bạn gửi (hộp "Quyền sử dụng hình ảnh này", bảng ảnh [+], nút cảnh báo hết credit) và trang Muse giả dựng theo HTML danh sách chat thật, chưa chạy trên Flow / Muse thật. Thẻ *"hoạt động bất thường"* (Flow 4, 6, 7 lần thử 23:27) là Google tự chặn. App chỉ cho các tài khoản đó nghỉ.

## Bản 1.3.1

- **Sửa lỗi Flow không tạo được dự án mới** (nhật ký 17/10/2026 18:00: cả 7 tài khoản Flow báo *"Không vào được trang dự án Flow sau 120 giây"*, tab nằm ở trang chủ Flow, rồi mọi ảnh chuyển sang Muse). Từ bản 1.3.0, mỗi dự án của tool chạy trên một dự án Flow mới, nên app phải tự bấm nút **"+ Dự án mới"** ở trang chủ Flow. Nút này nổi giữa đáy trang, mà cách app kiểm "nút có đang hiện không" lại bỏ qua mọi phần tử nổi kiểu đó, nên app không bao giờ thấy nút. Giờ app kiểm theo kích thước thật trên màn hình và bấm được nút.
- Nếu Flow tự mở lại một dự án cũ khi tab vào trang chủ, app tự về trang chủ (như bấm nút ngôi nhà) rồi bấm **"+ Dự án mới"**, không dùng dự án cũ.
- Nếu vẫn không vào được dự án, nhật ký ghi tới 30 nút đang thấy trên trang (trước đây chỉ 12) để dễ tìm lỗi.

Lưu ý: đã kiểm trên trang Flow giả dựng theo ảnh trang chủ Flow thật của bạn (nút nổi giữa đáy), chưa chạy trên Flow thật.

## Bản 1.3.0

Bản này chỉ phát hành cho **Windows**. Máy Mac giữ bản cũ (app báo *"chưa có file cho máy này"*) cho tới khi có bản macOS.

- **Nhiều dự án chạy song song, mỗi dự án một bộ cài đặt.** Trước đây dự án 1 đang chạy thì dự án 2 nằm trong hàng chờ, kể cả khi dùng tài khoản khác. Giờ mỗi dự án có luồng riêng: bấm **Chạy dự án** ở dự án 1, chuyển sang dự án 2 bấm **Chạy dự án** nữa, hai dự án chạy cùng lúc (dùng chung tài khoản cũng được). Nút **Dừng dự án** chỉ dừng dự án đang mở. Menu dự án (nút ⋮) có *Chạy tất cả dự án* / *Dừng tất cả dự án*.
  - Trang **Cài đặt** giờ là cài đặt của **dự án đang mở** (tiêu đề ghi tên dự án). Dự án mới chép cài đặt của dự án đang mở lúc tạo, và lưu kết quả vào thư mục con mang tên dự án trong `Tài liệu/AI Automation Studio/`, để file của các dự án chạy song song không lẫn nhau. *Tắt máy khi chạy hết hàng chờ* vẫn là cài đặt chung: chỉ tắt khi mọi dự án đang chạy đều xong.
- **Số thứ tự ảnh và video đếm riêng.** Tạo 350 ảnh thì video nối từ ảnh cũng đánh số 1–350 (video mang đúng số của ảnh nguồn), không cộng dồn sau số ảnh nữa. Việc đã có giữ nguyên số cũ.
- **Chọn đích danh tài khoản chạy.** Hộp tài khoản của dự án (nút cạnh tên dự án) giờ cho mỗi tài khoản chọn một trong ba: **Chạy** (các tài khoản chạy cùng lúc, chọn bao nhiêu cũng được), **Dự phòng** (vào thay khi tài khoản đang chạy lỗi / nghỉ) hoặc **Không dùng**.
- **Dừng / chạy từng ảnh, từng video.** Mỗi dòng đang chạy trong hàng đợi có nút **Dừng** riêng: dừng ảnh số 3 thì 9 ảnh kia vẫn chạy. Việc đã dừng có nút **Chạy** (chạy ngay, kể cả khi dự án đang dừng). Chọn nhiều dòng rồi bấm *Chạy* / *Dừng* / *Tạo lại* ở thanh chọn. *Tạo lại* giờ chạy ngay việc đó.
- **Chạy prompt theo số cụ thể.** *Cài đặt nâng cao → Chỉ chạy prompt số*: ghi ví dụ `98, 303, 305-350` (để trống = chạy hết). `305-` = từ 305 tới cuối. App báo trước sẽ chạy bao nhiêu prompt, số nào không có.
- **Xoá chat Muse ở mục Tài khoản.** Đã dựng lại cách xoá theo ảnh chụp menu *Side chats* của bạn (⋯ → Pin / Rename / Archive / **Delete** → xác nhận). App rê chuột vào từng chat để hiện nút ⋯, tìm mục *Delete* theo chữ, rồi bấm nút xác nhận. Nếu vẫn không xoá được, app lưu tệp chẩn đoán vào `Tài liệu/AI Automation Studio/chan-doan-muse` và nhật ký ghi đường dẫn tệp. Gửi tệp đó cho mình là sửa được đúng chỗ.
- **Mỗi dự án của tool chạy trên một dự án Flow MỚI.** Lần đầu một dự án của tool chạy trên một tài khoản Flow, app mở dự án Flow mới cho riêng nó (nhật ký ghi *"Dự án … chạy trên dự án Flow riêng"*), không dùng dự án Flow cũ của tài khoản. Hai dự án của tool chạy cùng tài khoản Flow thì mỗi dự án một tab, một dự án Flow. Video Flow mang tên `<dự án>_v001` trên Flow để không trùng tên ảnh.

Lưu ý: đã kiểm trên trang Muse / Flow / Suno giả, chưa chạy trên trang thật. Phần xoá chat Muse dựng theo ảnh chụp, chưa thử trên Muse thật.

## Bản 1.2.10

- **Sửa lỗi video Flow bị tải về thừa, thành nhiều file trùng tên `_2`, `_3`…** (lần chạy 17/10/2026, từ video `280` trở đi: `280_2.mp4`, `280_3.mp4`, `298_6.mp4`, `304_9.mp4`…). App **không nhập sai số prompt**, tên `280.mp4` vẫn là video tạo từ ảnh `280.png`. Lỗi nằm ở bước tải về của Flow: để tìm video vừa tạo, Flow lọc bằng ô *Tìm kiếm* theo đầu câu prompt. Mọi video tạo từ ảnh dùng chung một câu prompt, nên ô tìm kiếm trả về cả các video cũ đã tạo trước đó trong cùng dự án Flow của tài khoản, và app tải hết về, đặt tên `_2`, `_3`… Càng về sau dự án Flow càng có nhiều video cũ nên số file thừa tăng dần. Lỗi chỉ xảy ra với video **chạy ở Flow** (từ khoảng 280, khi Muse lỗi và video chuyển sang Flow); video chạy ở Muse không bị.
  - Giờ khi Flow tải về nhiều file hơn số bản mỗi prompt, app bỏ các file trùng hệt kết quả đã có, chỉ giữ video mới (video mới nhất luôn được tải về đầu tiên), xoá file thừa và ghi vào nhật ký *"bỏ N file thừa"*. Nếu chỉ tải được video cũ, việc báo lỗi và chạy lại chứ không nhận nhầm.
  - Các file `_2`, `_3`… đã có trong thư mục Videos là bản sao của video khác, app không tự xoá.

Lưu ý: đã kiểm bằng bài kiểm mô phỏng đúng thứ tự file trong nhật ký của bạn và trang Flow giả, chưa chạy trên Flow thật. Lần chạy tới hãy để ý nhật ký có dòng *"bỏ … file thừa"* và thư mục Videos không còn file `_2`.

## Bản 1.2.9

- **Mỗi dự án có thư mục lưu video riêng.** Ở trang **Tạo ảnh**, bật *Ảnh xong → tự tạo video*, mục mới **Lưu video của dự án này vào** → *Chọn thư mục*. Video tạo từ ảnh của dự án đó lưu vào đúng thư mục này (vẫn cùng tên ảnh, `049.jpg` → `049.mp4`). Mỗi dự án chọn riêng, không ảnh hưởng dự án khác. Bấm *Bỏ* thì dự án về theo Cài đặt chung (mặc định: lưu cạnh ảnh nguồn).
- **Muse chặn tạo video theo khu vực**: tài khoản Muse nào báo *chặn khu vực / lỗi 403* khi tạo video thì app **nhớ 24 giờ** (kể cả khi tắt app, bấm Chạy lại), không gửi video vào tài khoản đó nữa mà chỉ dùng nó tạo **ảnh**. Video chuyển sang tài khoản Muse khác còn tạo được, hết tài khoản Muse thì sang Flow (khi bật *Muse ⇄ Flow* trong Cài đặt → Chạy). Thẻ tài khoản ở mục Tài khoản hiện dòng đỏ *"Muse chặn tạo video ở khu vực của tài khoản này"*. Bấm **Kiểm tra** ở tài khoản để thử tạo video lại sớm. Trước đây mỗi lần bấm Chạy app lại gửi thử video vào từng tài khoản bị chặn, phí thời gian.

## Bản 1.2.8

- **Sửa lỗi Flow bị báo lỗi và cho nghỉ oan trong khi Flow vẫn tạo bình thường** (nhật ký 17/10/2026 12:03). Có hai chỗ hỏng:
  - **Đổi Video ⇄ Hình ảnh bấm nhầm thanh bên của Flow.** Khi dự án Flow đã có cả ảnh lẫn video, thanh bên trái của Flow hiện hai mục lọc *Hình ảnh* và *Video*. App tưởng đó là bảng chọn chế độ nên bấm vào mục lọc, không mở bảng cài đặt thật. Flow vẫn ở chế độ Video, app báo *"Đã bấm nút image 3 lần nhưng giao diện Flow không đổi"* rồi cho tài khoản nghỉ 15 phút (Flow 1, Flow 6 ULTRA, Flow 7 Ultra). Lưới dự án còn bị lọc theo loại. Giờ app không bao giờ bấm thanh bên hay bảng kho [+] khi đổi chế độ, chỉ bấm trong bảng cài đặt cạnh ô nhập.
  - **Nút Tạo bị một menu còn mở che.** Nhật ký ghi *"Tâm nút Tạo đang bị lớp khác che"* rồi *"Flow không nhận"*, sau 60 giây thì báo *"Google Flow không đẻ ra thẻ nào"* và cho tài khoản nghỉ (Flow 2, 3, 5). Giờ nếu một menu / bảng nổi của Flow còn mở đè lên nút Tạo, app đóng nó trước rồi mới bấm. Nhật ký ghi tên lớp đã che để dễ kiểm tra tiếp.
- Hai lỗi trên làm mọi tài khoản Flow lần lượt bị cho nghỉ, nên app chuyển các ảnh còn lại sang Muse (*"Flow → Muse: mọi tài khoản Flow của dự án đều đang lỗi / nghỉ"*). Những ảnh đã chuyển sang Muse trong lần chạy đó vẫn ở Muse.
- Lưu ý: thẻ lỗi *"Chúng tôi nhận thấy có hoạt động bất thường…"* trên Flow 4 là cảnh báo của chính Google, không phải lỗi app. App vẫn cho tài khoản đó nghỉ như cũ.

Lưu ý: đã kiểm trên trang Flow giả dựng lại thanh bên theo HTML trang thật của bạn, chưa chạy trên Flow thật. Lần đầu hãy chạy vài ảnh và vài video lẫn nhau rồi gửi lại Nhật ký.

## Bản 1.2.7

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
