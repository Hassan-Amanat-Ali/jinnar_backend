import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Define storage paths
const baseUploadDir = "uploads/courses";
const directories = {
  thumbnails: path.join(baseUploadDir, "thumbnails"),
  materials: path.join(baseUploadDir, "materials"),
  videos: path.join(baseUploadDir, "videos"),
};

// Ensure directories exist
Object.values(directories).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = directories.materials; // Default
    if (file.fieldname === "thumbnail") {
      uploadPath = directories.thumbnails;
    } else if (file.fieldname === "video") {
      uploadPath = directories.videos;
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "thumbnail") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new Error("Only image files are allowed for thumbnails!"),
        false,
      );
    }
  } else if (file.fieldname === "video") {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed for videos!"), false);
    }
  } else if (file.fieldname === "material") {
    if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
      return cb(
        new Error("Only PDF files are allowed for course materials!"),
        false,
      );
    }
  }
  cb(null, true);
};

// Limits
const limits = {
  fileSize: 1024 * 1024 * 500, // 500MB limit (adjust as needed, especially for videos)
};

const upload = multer({ storage, fileFilter, limits });

// Export specific upload middlewares
export const uploadCourseThumbnail = upload.single("thumbnail");
export const uploadCourseVideo = upload.single("video");
export const uploadCourseMaterial = upload.single("material"); // Or .array() if multiple needed
