/* Cấu hình web của dự án Firebase LINH HR (project id: linh-hr).
   Web được đăng tại hru.web.app (Firebase Hosting, site "hru" trong dự án linh-hr), mã nguồn quản lý trên GitHub.
   Đây là cấu hình công khai của ứng dụng web, không phải mật khẩu; quyền truy cập dữ liệu do Firestore Rules quyết định.
   Đối chiếu tại: Firebase Console → Project settings → General → Your apps → Web app → Config. */
window.HUB_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBUeqD8Qb9lKjltNLI5QSOjQojZwhjMeck",
  authDomain: "linh-hr.firebaseapp.com",
  projectId: "linh-hr",
  storageBucket: "linh-hr.firebasestorage.app",
  messagingSenderId: "383982804660",
  appId: "1:383982804660:web:bd1c34e9edd076202381e1"
};

/* Toàn bộ dữ liệu của Bàn điều hành nằm dưới nhánh này trong Firestore,
   tách riêng khỏi dữ liệu cũ của web quản trị trên cùng dự án. */
window.HUB_DATA_ROOT = "hcns_hub/main";
