import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const baseUploadDir = "uploads/viral";
const directories = {
  videos: path.join(baseUploadDir, "videos"),
  screenshots: path.join(baseUploadDir, "screenshots"),
};

Object.values(directories).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = directories.videos;
    if (file.fieldname === "screenshot") {
      uploadPath = directories.screenshots;
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname) || ""}`;
    cb(null, uniqueSuffix);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed for video upload"), false);
    }
  } else if (file.fieldname === "screenshot") {
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only image files (jpeg, png, gif, webp) allowed for screenshot"), false);
    }
  }
  cb(null, true);
};

const limits = { fileSize: 1024 * 1024 * 500 };

const upload = multer({ storage, fileFilter, limits });

export const uploadViralVideo = upload.single("video");
export const uploadPostProofScreenshot = upload.single("screenshot");
