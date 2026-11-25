# AI Automation Studio

App máy tính (Windows + macOS) tự động tạo ảnh và video hàng loạt trên **Muse** (muse.ai của Meta) và **Google Flow** (labs.google/fx — Veo / Nano Banana), và tạo nhạc trên **Google Flow Music** (flowmusic.app), trong **một hàng đợi chung**. Gộp từ hai tool Muse Automation Studio và Flow Automation Studio.

## Cài đặt

Tải bản mới nhất ở trang **Releases** của repo này:

| Máy | File |
|---|---|
| Windows | `AIAutomationStudio-<phiên bản>-setup.exe` |
| Mac chip Apple (M1–M4) | `AIAutomationStudio-<phiên bản>-mac-arm64.zip` |
| Mac chip Intel | `AIAutomationStudio-<phiên bản>-mac-x64.zip` |

- **Windows**: Windows SmartScreen báo "Unknown publisher" (app chưa ký số) → bấm **More info → Run anyway**.
- **macOS**: giải nén, kéo app vào **Applications**, mở lần đầu bị chặn → **System Settings → Privacy & Security → Open Anyway**. Vẫn không mở được: `xattr -dr com.apple.quarantine "/Applications/AI Automation Studio.app"`.
- App tự kiểm tra bản mới trên GitHub; có bản mới thì hiện chip **Có bản mới** ở trên cùng.

Chạy thẳng từ mã nguồn (Windows): bấm đúp `CHAY_TU_NGUON.bat` (tự cài Node.js nếu thiếu).

## Dùng lần đầu

1. **Tài khoản** → **Thêm Muse** / **Thêm Flow** → **Đăng nhập**. Trang Muse hoặc Google Flow mở ngay trong app, bạn tự đăng nhập. **App không bao giờ hỏi, nhập hay lưu mật khẩu** — mỗi tài khoản giữ phiên đăng nhập riêng.
2. Tài khoản Flow: sau khi đăng nhập Google, mở (hoặc tạo) một **dự án Flow** rồi bấm **Xong** — app nhớ dự án đó để chạy.
3. **Tạo ảnh** / **Tạo video** → chọn **Chạy trên: Muse** hoặc **Google Flow** → gõ prompt (mỗi dòng một prompt) → **Tạo & chạy**.
4. **Tạo nhạc** → gõ prompt phong cách nhạc (mỗi dòng một bài) → **Tạo & chạy**. Thư mục lưu và tên file ở **Cài đặt nâng cao** của trang này.

## Tính năng chính

- **Hàng đợi chung** cho Muse và Flow, chạy song song; lọc theo nơi chạy; mỗi việc hiện tiến độ, kết quả, tên file.
- **Muse**: mỗi prompt một chat mới, nhiều luồng mỗi tài khoản, ảnh tham chiếu, nhân vật, chế độ Người mẫu, xoá chat, xem mức token.
- **Google Flow**: mỗi tài khoản một (đến 4) tab chạy ngầm; app gom việc thành mẻ và giao cho engine Flow (dán prompt, bấm Tạo, thử lại, tải về). Ảnh tham chiếu tự tải lên kho Flow (Flow mới: [+] → *Tải nội dung nghe nhìn lên*; app nắn bảng kho mới cho engine dò và gắn ảnh @tên), tự chuyển mục *Hình ảnh* / *Video* (+ *Thành phần* khi gắn ảnh), tải về chất lượng bị khoá (1080p / 4K *Nâng cấp*) thì tự hạ 720p / cỡ gốc, lỗi tải ảnh thì lưu tệp chẩn đoán ở `Tài liệu/AI Automation Studio/chan-doan-flow`. Nhận diện tài khoản lỗi (luôn bật), chọn model ảnh/video, model dự phòng, nghỉ giữa thao tác, gỡ ảnh tham chiếu dính.
- **Tự động qua lại**: ảnh xong → tự tạo video ở **Muse hoặc Google Flow** (chọn ở ô "Video chạy ở"). Mặc định app tạo xong hết ảnh rồi mới tạo video (tắt ở Cài đặt → Cả app để ảnh và video chạy song song). Ví dụ: Flow tạo ảnh → Muse tạo video, hoặc Muse tạo ảnh → Flow tạo video. Ảnh nằm sẵn trong thư mục kết quả trên máy.
- **Nhiều tài khoản, lỗi là đổi ngay**: mỗi dự án chọn đích danh tài khoản **Chạy** (chạy cùng lúc), **Dự phòng** hay **Không dùng** cho từng nơi chạy (nút tài khoản cạnh tên dự án). Mỗi dự án có **cài đặt riêng, luồng riêng** và chạy **song song** với dự án khác; số thứ tự ảnh / video đếm riêng; dừng / chạy / tạo lại **từng việc**; chọn prompt theo số (`98, 303, 305-350`); mỗi dự án chạy trên **dự án Flow mới** riêng. **Muse ⇄ Flow**: Muse từ chối tạo video từ một ảnh → riêng ảnh đó sang Flow; hết tài khoản dự phòng mà một bên còn ít tài khoản chạy được hơn số tài khoản **Chạy** → bên kia chạy thêm cho đủ, bên cũ có lại tài khoản thì việc chưa chạy quay về (tắt ở Cài đặt → Chung). Việc lỗi chuyển lần lượt sang các tài khoản dự phòng, hết dự phòng thì quay về tài khoản chính, cứ thế theo vòng tới khi xong; tài khoản lỗi liên tiếp hoặc bị nhắc thì tạm nghỉ, mọi tài khoản cùng lỗi thì hàng chờ tạm dừng. Flow bị báo "hoạt động bất thường": tài khoản đó nghỉ 3 giờ trở lên; 2 tài khoản bị báo trong 30 phút thì **cả máy nghỉ Flow** (công tắc và số phút ở Cài đặt → Flow → *Tài khoản lỗi*; tắt thì chỉ tài khoản bị báo nghỉ). Tài khoản hay bị báo hiện **cảnh báo vàng** "nghi đã bị Google đánh dấu — không nên dùng" (chỉ cảnh báo, không tự bỏ). Mỗi tài khoản của dự án bật / tắt riêng cho **Ảnh** và **Video** (vd Flow 1 chỉ tạo ảnh); mục Tài khoản tô **xanh** tài khoản chạy được, **đỏ** tài khoản đang lỗi / nghỉ kèm lý do.
- **Video từ ảnh nằm cạnh ảnh, cùng tên** (`325.jpg` → `325.mp4`). Tên ảnh mặc định `{stt}`.
- **Tải về hàng loạt** (tick nhiều việc → Tải về: đặt tên mới, chọn thư mục, file đã mất thì lấy lại từ chat Muse cũ không tốn lượt), **xuất Nhật ký ra .txt**, tuỳ chọn **tự xoá chat Muse / dự án Flow** khi chạy xong hàng chờ.
- **Tạo nhạc (Flow Music)**: mỗi tài khoản Google Flow có sẵn một tài khoản Flow Music dùng chung đăng nhập. Mỗi dòng (hoặc file .txt) một prompt, gửi **nguyên văn** vào ô chat của Producer trên flowmusic.app (muốn không lời thì ghi `instrumental`); mỗi prompt một phiên mới, Flow Music ra 2 bài, app tải MP3 của bài **dài hơn** (More options → Download → MP3) và đặt tên theo số prompt (`001.mp3`…). Gửi theo thứ tự prompt, mỗi tài khoản 2 bài cùng lúc. Producer chỉ hỏi lại → app nhắn thêm một lần "tạo bài luôn"; tải hỏng → tải lại đúng bài, không gửi lại prompt; hết credit → bài tạo lại ở tài khoản dự phòng, tài khoản đó nghỉ 6 giờ (bấm Kiểm tra để dùng lại sớm).
- **Google Drive (1.4.0)**: ảnh / video xong tự đưa lên Drive vào `Tên dự án/images` và `Tên dự án/Videos`, theo một trong hai cách: chép vào thư mục Google Drive trên máy (Google Drive cho máy tính tự tải lên), hoặc tải thẳng lên drive.google.com bằng trình duyệt trong app (tài khoản ở thẻ **Drive** của mục Tài khoản). Việc xong từ trước: chọn → *Lên Drive*.
- **1.4.0**: chọn hết → **Đổi prompt** (thay hẳn / tìm và thay chữ); **đổi ngay sang Muse / Flow** ở từng việc hoặc nhiều việc; **đồng hồ dự án** (đã chạy + dự đoán còn bao lâu); **Chạy lại ngay** tài khoản đang nghỉ vì lỗi; chế độ **nhẹ máy** (trang chạy ngầm ưu tiên CPU thấp, giao diện báo thưa hơn khi nhiều việc).
- **Footage cho cảnh (1.6.0)**: mục **Footage** mở file `<tên>_footage.xlsx` (skill chia cảnh xuất khi được yêu cầu tìm footage), tìm stock video qua **API chính thức của Pexels và Pixabay** (miễn phí, khoá API của bạn), chọn clip ngang, đủ dài, không chứa chữ cần tránh, không trùng giữa các cảnh, tải bản gần 1080p thành `0047.mp4`… vào thư mục `Videos` của project CapCut Draft Studio (cảnh đó dùng footage thay ảnh AI). *Đổi clip*, *Bỏ* (file sang `_bo`), *Chép số* cảnh dùng footage, `nguon-footage.txt` để ghi công. Không tự tải Storyblocks / trang trả phí (điều khoản cấm tải bằng máy) — clip Storyblocks đặt tên `0047.mp4` vào cùng thư mục thì app bỏ qua cảnh đó.
- **1.5.5**: ảnh Muse đủ cỡ 2048×1152 — trình xem của Muse có ảnh nền mờ (bản xem trước) hiện to hơn ảnh thật; chọn ảnh nhiều điểm ảnh nhất (đo trên Muse thật).
- **1.5.4**: ảnh Muse đủ cỡ thật sự — bấm chuột thật vào ảnh (Muse bỏ qua cú bấm tự động) để mở trình xem, vẫn nhỏ thì bấm nút tải ↓; không được thì lưu tệp chẩn đoán.
- **1.5.3**: ảnh Muse tải về đủ cỡ (lấy ảnh ở trình xem / cỡ lớn nhất, không lấy bản xem trước thu nhỏ trong chat); nhật ký ghi cỡ ảnh, cảnh báo ảnh nhỏ; nhạc có công tắc "Tải nhạc về" — bật Google Drive thì tự tắt (nhạc chỉ lên Drive `<dự án>/BGM`, không lưu 2 nơi).
- **1.5.2**: nhạc lên Google Drive vào `<dự án>/BGM`; cột chi tiết có "Tab của việc này" — hiện tab đang chạy, mở chat Muse cũ, tải video từ chat đó (không gửi lại).
- **1.5.1**: Muse hết giờ chờ mà vẫn đang tạo → giữ chat, kiểm lại sau (không gửi lại, không tính lỗi tài khoản); nhớ chat khi Muse đổi địa chỉ chậm; ghi đúng "hết lượt video" (không phải chặn khu vực).
- **1.5.0**: **tạo nhạc chuyển sang Google Flow Music** (flowmusic.app), bỏ hẳn Suno — dùng chung tài khoản Google Flow, gửi prompt nguyên văn theo thứ tự, tải MP3 bài dài hơn, tên theo số prompt, 2 bài cùng lúc mỗi tài khoản.
- **1.4.14**: **xoá dự án tự dọn dữ liệu tạm** của dự án; **hẹn giờ nhiều hẹn, mỗi hẹn tick nhiều dự án**; **chọn việc theo số** (`1, 3, 10-50`); giao diện nhẹ hơn khi hàng đợi dài (gửi trạng thái theo phần đổi, bỏ hiệu ứng thanh tiến độ).
- **1.4.13**: **bớt RAM khi chạy Muse** — tự **làm mới luồng** Muse (đóng hẳn trang, mở trang mới) sau 10 việc / khi trang quá 900 MB; **RAM tối đa cho app** (mặc định 75% RAM máy) — chạm thì chờ luồng xong mới giao việc mới.
- **1.4.12**: tắt app giữa chừng không tạo trùng — mở lại app tự **kiểm chat Muse cũ**, xong rồi thì tải về (nút **Kiểm tra việc dở**); Muse **hết lượt video 24 giờ** → sang tài khoản kế tiếp ngay; **Dọn dữ liệu thừa** (Cài đặt → Cả app) — cache, file tạm, dữ liệu tài khoản đã xoá… không đăng xuất tài khoản.
- **1.4.11**: ô **lọc theo tài khoản** trên danh sách việc — chọn vd *Muse 3* để chỉ xem ảnh / video Muse 3 đã tạo (kèm số việc; tab trạng thái và *Chọn hết* theo tài khoản đã chọn).
- **1.4.10**: **Tạo video từ thư mục ảnh** đánh số theo **tên ảnh**: ảnh `016.jpg` → video #016, prompt dòng 16, file `016.mp4` (thư mục thiếu số không còn lệch); áp cho cả Theo dõi thư mục.
- **1.4.9**: sửa lỗi việc **treo ở 99%** mà không đổi tài khoản (Muse: mọi bước có hạn, quá *Chờ tối đa* thì sang tài khoản kế tiếp; Flow: ô **Treo quá … phút thì đổi tài khoản**, mặc định 5); nút **Đổi tài khoản** ở dòng việc / thanh chọn để tự đổi sang tài khoản kế tiếp (Muse 1 → Muse 2…); **Tạo video từ thư mục ảnh** có công tắc **Theo dõi thư mục** — ảnh mới thêm dần vào thư mục tự thành video và chạy luôn.
- **1.4.8**: công tắc **Tạo ảnh xong hết rồi mới tạo video** (Cài đặt → Cả app, mặc định bật): còn ảnh đang tạo thì video chờ, hết ảnh mới tạo video, ít trang chạy cùng lúc nên bớt ngốn CPU (nhạc Suno và video bấm *Chạy ngay* không bị giữ; tắt thì ảnh và video chạy song song như trước); *Máy mượt* trên trang Muse còn cho hoạt hình chạy chậm lại (khoảng 5 khung hình/giây) và dừng video / nhạc tự phát.
- **1.4.7**: công tắc **Cả máy nghỉ Flow** + số phút nghỉ (Cài đặt → Flow → Tài khoản lỗi); thẻ đỏ ghi rõ "Cả máy nghỉ Flow (tài khoản này không bị báo)"; **cảnh báo vàng** tài khoản nghi bị Google đánh dấu (bị báo "hoạt động bất thường" nhiều lần trong 3 ngày), nút *Bỏ cảnh báo*.
- **1.4.6**: nhập file .txt **prompt video riêng từng ảnh** (Ảnh xong → tự tạo video, Tạo video từ thư mục ảnh: ảnh N ↔ dòng N); trang Cài đặt chia thẻ **Chung / Muse / Google Flow / Suno / Cả app**, số thử lại và tự chạy lại việc lỗi riêng cho Muse, Flow, Suno.
- **1.4.4**: bớt ngốn CPU: bật *Máy mượt* thì tắt hiệu ứng động trên các trang chạy ngầm, giao diện cập nhật thưa hơn khi bạn không dùng app, nhật ký có dòng **⚙ CPU app** cho biết phần nào tốn CPU.
- **1.4.3**: nút **Quét thư mục…** cho chọn thư mục đang có file đánh số làm dở, đọc số ngay trong tên file (`253.jpg`, `anh_253.jpg`), file mới lưu vào cùng thư mục.
- **1.4.2**: trang Tạo ảnh / video / nhạc có công tắc **Bỏ qua số đã có file trong thư mục** và nút **Quét thư mục**: số đã có file (vd `253.jpg`) hoặc đang chờ thì bỏ qua, làm số bị sót trước rồi làm tiếp prompt chưa làm; ảnh có rồi mà thiếu video thì chỉ tạo video. Mỗi mục Cài đặt có nhãn áp dụng cho ảnh / video / nhạc; thẻ mới **Lưu ảnh & video** chia hai cột.
- **1.4.1**: nhiều dự án cùng lúc không còn sai tên file trên Drive (thư mục tạm riêng từng dự án, tên Drive theo mẫu tên); bật Drive thì tự tắt *Tải ảnh về* / *Tải video về*.
- Mẫu tên file, thư mục riêng cho ảnh/video/nhạc, nhập nhiều file .txt (mỗi file một dự án), tạo video từ thư mục ảnh có sẵn, tự thử lại, tắt máy khi chạy xong.

## Giới hạn cần biết

- Google Flow chỉ có tỷ lệ **16:9** và **9:16** (tỷ lệ khác tự đổi về gần nhất).
- Nhận diện tài khoản lỗi **không qua mặt** được kiểm tra của Google: nó chỉ đổi sang tài khoản khác / cho tài khoản nghỉ khi bị nhắc. App không có proxy / VPN / giả vân tay trình duyệt; cảnh báo tài khoản nghi bị đánh dấu chỉ giúp bạn chọn tài khoản.
- Flow Music: chỉ tải bằng menu Download của chính trang, không giải captcha hộ; cửa sổ chạy ngầm tắt tiếng.
- Footage: chỉ Pexels / Pixabay qua API (Pexels mặc định 200 lượt tìm mỗi giờ — hết lượt thì app sang Pixabay). Độ hợp của clip với cảnh do từ khoá quyết định — xem lại trước khi dựng.
- Các bài kiểm thử tự động chạy trên **trang Muse giả, trang Google Flow giả, trang Flow Music giả và trang Google Drive giả**; giao diện thật của hai trang có thể đổi bất cứ lúc nào. Lần đầu nên chạy thử vài prompt và xem **Nhật ký**.

## Nhật ký và dữ liệu

- Nút **Nhật ký** góc dưới trái (số đỏ = lỗi chưa xem); **Xuất .txt** để lưu ra file gửi cho người phát triển.
- Dữ liệu app: Windows `%APPDATA%\AIAutomationStudio`, macOS `~/Library/Application Support/AIAutomationStudio`.

## Dành cho người phát triển

```bash
npm install
npm test                                   # logic + bộ cập nhật
node tests/flow/run.js                     # logic Flow (engine, model, an toàn, tải về…)
xvfb-run -a node tests/e2e.js              # đầu-cuối Muse (trang Muse giả)
xvfb-run -a node tests/e2e.js flow         # đầu-cuối Flow + nối Flow ⇄ Muse (trang + engine Flow giả)
xvfb-run -a node tests/e2e.js nhac         # đầu-cuối Tạo nhạc (trang Flow Music giả)
xvfb-run -a node tests/e2e.js drive        # đầu-cuối Google Drive tải thẳng lên (trang Drive giả)
xvfb-run -a node tests/e2e.js footage      # đầu-cuối Footage (API Pexels / Pixabay giả)
xvfb-run -a npx electron --no-sandbox tests/flow/<bài>-main.js   # bài DOM Flow: paste, mode, model, bam-tao, bam-tao-that, kiem-truoc, tham-chieu
```

Cấu trúc: `main.js` (cửa sổ, luồng, IPC) · `src/main/` (hàng đợi, điều phối, tài khoản, luồng Muse, cập nhật) · `src/flow/` (tab Flow, máy Flow, luồng Flow, engine + trình tiêm của Flow Automation Studio) · `src/inject/muse-trang.js` (mọi selector Muse) · `src/main/luong-nhac.js` + `src/inject/nhac-trang.js` (luồng và mọi selector Flow Music) · `src/main/footage.js` + `src/main/doc-xlsx.js` (Footage Pexels / Pixabay, đọc .xlsx) · `src/ui/`.
