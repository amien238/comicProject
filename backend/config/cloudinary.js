const cloudinary = require('cloudinary'); // Lấy thư viện gốc, không chấm .v2
const multer = require('multer');

// Khắc phục triệt để lỗi "not a constructor" do khác biệt phiên bản Node.js/Thư viện
const multerCloudinaryPkg = require('multer-storage-cloudinary');
const CloudinaryStorage = multerCloudinaryPkg.CloudinaryStorage 
                       || (multerCloudinaryPkg.default && multerCloudinaryPkg.default.CloudinaryStorage)
                       || multerCloudinaryPkg;

// Cấu hình thông tin từ biến môi trường .env (Sử dụng .v2.config)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Khởi tạo Storage của Cloudinary an toàn
let storage;
try {
  // Chuẩn mới (v4)
  storage = new CloudinaryStorage({
    cloudinary: cloudinary, // Truyền biến cloudinary gốc vào
    params: {
      folder: 'comic_nexus', 
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
  });
} catch (error) {
  // Fallback chuẩn cũ (v2)
  storage = CloudinaryStorage({
    cloudinary: cloudinary, // Truyền biến cloudinary gốc vào
    folder: 'comic_nexus',
    allowedFormats: ['jpg', 'png', 'jpeg', 'webp']
  });
}

// KHỞI TẠO BỘ LỌC MULTER GỐC
const originalUpload = multer({ storage: storage });

// VÁ LỖI (MONKEY-PATCH): Tự động trích xuất đúng URL cho các phiên bản thư viện cũ
// Chống lỗi Prisma "url: null" khi Route tìm req.file.path nhưng nó lại nằm ở req.file.secure_url
const upload = {
  single: (fieldName) => {
    const middleware = originalUpload.single(fieldName);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err) return next(err);
        // Nếu upload thành công, gán giá trị URL đúng vào path
        if (req.file && !req.file.path) {
          req.file.path = req.file.secure_url || req.file.url;
        }
        next();
      });
    };
  },
  array: (fieldName, maxCount) => {
    const middleware = originalUpload.array(fieldName, maxCount);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (err) return next(err);
        // Quét qua tất cả các file được gửi lên và sửa đường dẫn
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(file => {
            if (!file.path) {
              file.path = file.secure_url || file.url;
            }
          });
        }
        next();
      });
    };
  }
};

// Xuất ra upload để bên routes sử dụng
module.exports = { cloudinary, upload };