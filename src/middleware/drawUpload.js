import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const baseUploadDir = "uploads/viral/draw-banners";

if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, baseUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype)) {
    return cb(new Error("Only image files (jpeg, png, gif, webp) allowed"), false);
  }
  cb(null, true);
};

const limits = { fileSize: 1024 * 1024 * 10 }; // 10MB

const upload = multer({ storage, fileFilter, limits });

export const uploadDrawBannerImage = upload.single("image");
