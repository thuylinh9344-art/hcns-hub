# Bàn điều hành HCNS – Upharma

Web quản lý phòng Tổ chức Hành chính: nhật ký công việc chấm KPI, xếp hạng hiệu suất D1–D6, phân công nhà thuốc, công việc và nhắc deadline, OKR, nhân sự hệ thống (DSNS U), báo cáo tuần/tháng/quý và báo cáo nhân sự năm.

- **Địa chỉ web:** https://hcnsupharma.web.app (Firebase Hosting, site `hcnsupharma` trong dự án **LINH HR** `linh-hr`). Thay cho `linh-hr.web.app`.
- **Mã nguồn:** GitHub. Mỗi lần đẩy code lên nhánh `main`, GitHub Actions tự đăng bản mới lên hcnsupharma.web.app.
- **Dữ liệu:** Cloud Firestore của `linh-hr`, nhánh `hcns_hub/main`.
- **Đăng nhập:** tài khoản Google. Chỉ email có trong Firestore Rules mới đọc/ghi được dữ liệu.
- **Danh sách nhân sự:** đọc sheet DSNS U bằng Google Sheets API (chỉ đọc) khi bấm "Cập nhật từ Google Sheet".

Repo **không chứa dữ liệu nhân sự**. Dữ liệu ban đầu nằm trong file `HCNS-HUB_DU-LIEU-BAN-DAU_2026-10-20.json` được gửi riêng, nhập vào web sau khi đăng nhập.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `public/index.html` | Giao diện và logic tính KPI, hạng D, báo cáo |
| `public/hub-runtime.js` | Kết nối Firestore, đăng nhập Google, Google Sheets API, tải file, nhập/sao lưu |
| `public/firebase-config.js` | Cấu hình web của dự án `linh-hr` (đã điền sẵn) |
| `firebase.json`, `.firebaserc` | Khai báo đăng web lên site `hcnsupharma` của dự án `linh-hr` (tên đích trong cấu hình là `hru`) |
| `.github/workflows/deploy-hru.yml` | Tự đăng web khi đẩy code lên `main` |
| `firestore.rules` | Khối phân quyền cho Bàn điều hành |

## Cài đặt lần đầu (khoảng 20 phút)

### 1. Site Firebase Hosting
Đã tạo site `hcnsupharma` trong dự án `linh-hr` (Hosting → Advanced → Add another site). Muốn đổi sang site khác thì sửa tên trong `.firebaserc` (`"hru": ["<tên-site>"]`).

### 2. Tạo khóa cho GitHub Actions
1. [Google Cloud Console → IAM → Service accounts (linh-hr)](https://console.cloud.google.com/iam-admin/serviceaccounts?project=linh-hr) → **Create service account**, tên `github-deploy`.
2. Cấp 2 quyền: **Firebase Hosting Admin** và **API Keys Viewer** → **Done**.
3. Mở service account vừa tạo → **Keys → Add key → Create new key → JSON** → tải file về máy (không đưa file này lên GitHub).
4. Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**: tên `FIREBASE_SERVICE_ACCOUNT_LINH_HR`, giá trị là toàn bộ nội dung file JSON vừa tải. Lưu xong có thể xóa file JSON trên máy.

### 3. Đưa code lên GitHub
1. Tạo repo, ví dụ `hcns-hub` (để **Private** được; site chạy trên Firebase nên không cần repo Public).
2. Tải toàn bộ thư mục này lên nhánh `main` (giữ các file ẩn `.firebaserc`, `.gitignore` và thư mục `.github`).
3. Tab **Actions**: workflow "Đăng web lên hcnsupharma.web.app" chạy. Khi có dấu tích xanh, mở https://hcnsupharma.web.app.

### 4. Cho phép đăng nhập từ địa chỉ mới
[Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/linh-hr/authentication/settings) → **Add domain**: `hcnsupharma.web.app` (và `hcnsupharma.firebaseapp.com`). Kiểm tra **Sign-in method → Google** đang bật.

### 5. Phân quyền dữ liệu
[Firestore Database → Rules](https://console.firebase.google.com/project/linh-hr/firestore/rules): dán khối "Bàn điều hành HCNS" trong `firestore.rules` vào bên trong rules đang có, thêm email các thành viên vào `hubMember()`, bấm **Publish**.

### 6. Cho phép đọc Google Sheets (cập nhật DSNS U)
1. [Bật Google Sheets API cho linh-hr](https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=linh-hr).
2. [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=linh-hr): thêm scope `.../auth/spreadsheets.readonly`. Ở chế độ **Testing** thì thêm email từng thành viên vào **Test users**.
3. Người bấm cập nhật phải có quyền xem file "2026 - Data HCNS".

### 7. Nhập dữ liệu ban đầu
Đăng nhập hcnsupharma.web.app bằng `thuylinh9344@gmail.com` → **Nhân sự & danh mục → Sao lưu và nhập dữ liệu → Nhập từ file .json** → chọn `HCNS-HUB_DU-LIEU-BAN-DAU_2026-10-20.json`.

### 8. Gỡ địa chỉ cũ linh-hr.web.app (tùy chọn)
[Hosting → site linh-hr](https://console.firebase.google.com/project/linh-hr/hosting/sites) → menu ⋮ → **Disable site**. Chỉ gỡ trang web cũ; Firestore và đăng nhập vẫn chạy. Không xóa được site mặc định, chỉ tắt được.

## Vận hành
- Sửa giao diện: chỉnh file trong `public/`, đẩy lên `main`, hcnsupharma.web.app tự cập nhật sau khoảng 1 phút.
- Đăng thủ công (nếu cần): cài Firebase CLI, chạy `firebase deploy --only hosting:hru` (đích `hru` trỏ tới site hcnsupharma) trong thư mục này.
- Sao lưu dữ liệu: **Nhân sự & danh mục → Tải bản sao lưu**, lưu vào `TRỢ LÝ/02. KPI - HIỆU SUẤT` trên Drive.
- Thêm người dùng: thêm email vào Firestore Rules (bước 5) và Test users (bước 6).
