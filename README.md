# AI Automation Studio

App máy tính (Windows + macOS) tự động tạo ảnh và video hàng loạt trên **Muse** (muse.ai của Meta) và **Google Flow** (labs.google/fx — Veo / Nano Banana), và tạo nhạc trên **Suno** (suno.com), trong **một hàng đợi chung**. Gộp từ hai tool Muse Automation Studio và Flow Automation Studio.

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

1. **Tài khoản** → **Thêm Muse** / **Thêm Flow** / **Thêm Suno** → **Đăng nhập**. Trang Muse, Google Flow hoặc Suno mở ngay trong app, bạn tự đăng nhập. **App không bao giờ hỏi, nhập hay lưu mật khẩu** — mỗi tài khoản giữ phiên đăng nhập riêng.
2. Tài khoản Flow: sau khi đăng nhập Google, mở (hoặc tạo) một **dự án Flow** rồi bấm **Xong** — app nhớ dự án đó để chạy.
3. **Tạo ảnh** / **Tạo video** → chọn **Chạy trên: Muse** hoặc **Google Flow** → gõ prompt (mỗi dòng một prompt) → **Tạo & chạy**.
4. **Tạo nhạc** → gõ prompt phong cách nhạc (mỗi dòng một bài) → **Tạo & chạy**. Thư mục lưu và tên file ở **Cài đặt nâng cao** của trang này.

## Tính năng chính

- **Hàng đợi chung** cho Muse và Flow, chạy song song; lọc theo nơi chạy; mỗi việc hiện tiến độ, kết quả, tên file.
- **Muse**: mỗi prompt một chat mới, nhiều luồng mỗi tài khoản, ảnh tham chiếu, nhân vật, chế độ Người mẫu, xoá chat, xem mức token.
- **Google Flow**: mỗi tài khoản một (đến 4) tab chạy ngầm; app gom việc thành mẻ và giao cho engine Flow (dán prompt, bấm Tạo, thử lại, tải về). Giữ đủ chế độ an toàn, chọn model ảnh/video, model dự phòng, nghỉ giữa thao tác, gỡ ảnh tham chiếu dính.
- **Tự động qua lại**: ảnh xong → tự tạo video ở **Muse hoặc Google Flow** (chọn ở ô "Video chạy ở"). Ví dụ: Flow tạo ảnh → Muse tạo video, hoặc Muse tạo ảnh → Flow tạo video. Ảnh nằm sẵn trong thư mục kết quả trên máy.
- **Nhiều tài khoản, lỗi là đổi ngay**: mỗi dự án chọn tài khoản **chính** và **dự phòng** cho từng nơi chạy (nút tài khoản cạnh tên dự án). Việc lỗi chuyển lần lượt sang các tài khoản dự phòng, hết dự phòng thì quay về tài khoản chính, cứ thế theo vòng tới khi xong; tài khoản lỗi liên tiếp hoặc bị nhắc thì tạm nghỉ, mọi tài khoản cùng lỗi thì hàng chờ tạm dừng.
- **Video từ ảnh nằm cạnh ảnh, cùng tên** (`325.jpg` → `325.mp4`). Tên ảnh mặc định `{stt}`.
- **Tải về hàng loạt** (tick nhiều việc → Tải về: đặt tên mới, chọn thư mục, file đã mất thì lấy lại từ chat Muse cũ không tốn lượt), **xuất Nhật ký ra .txt**, tuỳ chọn **tự xoá chat Muse / dự án Flow** khi chạy xong hàng chờ.
- **Tạo nhạc (Suno)**: prompt vào ô Styles (Advanced, không lời); mỗi lần Create Suno ra 4 bài, app tải MP3 của bài **dài hơn** trong 2 bài đầu. Tài khoản Suno hết lượt tải / hết credit → bài tạo lại ở tài khoản Suno dự phòng; tài khoản đó nghỉ 6 giờ (bấm Kiểm tra để dùng lại sớm). Captcha: cửa sổ Suno hiện lên để bạn tự giải.
- Mẫu tên file, thư mục riêng cho ảnh/video/nhạc, nhập nhiều file .txt (mỗi file một dự án), tạo video từ thư mục ảnh có sẵn, tự thử lại, tắt máy khi chạy xong.

## Giới hạn cần biết

- Google Flow chỉ có tỷ lệ **16:9** và **9:16** (tỷ lệ khác tự đổi về gần nhất).
- Chế độ an toàn **không qua mặt** được kiểm tra của Google: nó chỉ làm app gõ cửa thưa hơn và nghỉ khi bị nhắc.
- Suno: chỉ tải bằng nút Download của chính Suno (không lách giới hạn tải), không giải captcha hộ.
- Các bài kiểm thử tự động chạy trên **trang Muse giả, trang Google Flow giả và trang Suno giả**; giao diện thật của hai trang có thể đổi bất cứ lúc nào. Lần đầu nên chạy thử vài prompt và xem **Nhật ký**.

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
xvfb-run -a node tests/e2e.js suno         # đầu-cuối Tạo nhạc (trang Suno Create giả)
xvfb-run -a npx electron --no-sandbox tests/flow/<bài>-main.js   # bài DOM Flow: paste, mode, model, bam-tao, bam-tao-that, kiem-truoc, tham-chieu
```

Cấu trúc: `main.js` (cửa sổ, luồng, IPC) · `src/main/` (hàng đợi, điều phối, tài khoản, luồng Muse, cập nhật) · `src/flow/` (tab Flow, máy Flow, luồng Flow, engine + trình tiêm của Flow Automation Studio) · `src/inject/muse-trang.js` (mọi selector Muse) · `src/main/luong-suno.js` + `src/inject/suno-trang.js` (luồng và mọi selector Suno) · `src/ui/`.
