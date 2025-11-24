import multer from "multer";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import { execSync } from "child_process";

// 🧩 Check FFmpeg installation
let ffmpegPath;
try {
  ffmpegPath = execSync("which ffmpeg", { encoding: "utf8" }).trim();
  console.log("✅ FFmpeg found via Homebrew:", ffmpegPath);
} catch (error) {
  ffmpegPath = "/usr/local/bin/ffmpeg";
  console.log("✅ Using default FFmpeg path:", ffmpegPath);
}
ffmpeg.setFfmpegPath(ffmpegPath);
console.log("✅ FFmpeg configured successfully!");

// 🗂️ Create temp directory
await fs.mkdir("temp", { recursive: true });
console.log("✅ Temp directory ready");

// 🧠 Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "temp/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

// 🔒 File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    profilePicture: ["image/jpeg", "image/png", "image/gif"],
    otherImages: ["image/jpeg", "image/png", "image/gif"],
    portfolioImages: ["image/jpeg", "image/png", "image/gif"],
    videos: ["video/mp4", "video/mpeg", "video/quicktime"],
    certificates: ["application/pdf"],
    gigImage: ["image/jpeg", "image/png", "image/gif"],
    identityDocument: ["image/jpeg", "image/png", "application/pdf"],
  };

  if (allowedTypes[file.fieldname]?.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}`), false);
  }
};

// ⚙️ Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 🧩 Compression helpers
const compressImage = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .resize({
      width: 1920,
      height: 1080,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);
  console.log(`✅ Image compressed: ${path.basename(inputPath)}`);
};

const compressVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .size("1280x720")
      .videoBitrate("1500k")
      .audioBitrate("128k")
      .format("mp4")
      .on("end", () => {
        console.log(`✅ Video compressed: ${path.basename(inputPath)}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("Video error details:", err.message);
        reject(new Error(`Failed to compress video: ${err.message}`));
      })
      .save(outputPath);
  });
};

const compressPDF = async (inputPath, outputPath) => {
  await fs.copyFile(inputPath, outputPath);
  console.log(`✅ PDF copied: ${path.basename(inputPath)}`);
};

// 🧩 Compression middleware
export const compressFiles = async (req, res, next) => {
  try {
    if (!req.files && !req.file) return next();

    const processFile = async (file, fieldName) => {
      const originalPath = file.path;
      const originalName = file.originalname;
      const timestamp = Date.now();
      const compressedPath = path.join(
        "temp",
        `${timestamp}-compressed-${originalName}`,
      );

      if (
        [
          "profilePicture",
          "otherImages",
          "portfolioImages",
          "gigImage",
        ].includes(fieldName)
      ) {
        await compressImage(originalPath, compressedPath);
      } else if (fieldName === "videos") {
        await compressVideo(originalPath, compressedPath);
      } else if (fieldName === "certificates") {
        await compressPDF(originalPath, compressedPath);
      } else if (fieldName === "identityDocument") {
        if (file.mimetype.startsWith("image/")) {
          await compressImage(originalPath, compressedPath);
        } else if (file.mimetype === "application/pdf") {
          await compressPDF(originalPath, compressedPath);
        }
      }

      file.path = compressedPath;
      file.filename = path.basename(compressedPath);
      file.size = (await fs.stat(compressedPath)).size;

      await fs.unlink(originalPath).catch(() => {});
    };

    // ✅ Handle single upload
    if (req.file) {
      await processFile(req.file, req.file.fieldname);
    }

    // ✅ Handle multiple (array-based) upload
    else if (Array.isArray(req.files)) {
      for (const file of req.files) {
        await processFile(file, file.fieldname);
      }
    }

    // ✅ Handle field-based (object) upload
    else if (typeof req.files === "object") {
      for (const [fieldName, files] of Object.entries(req.files)) {
        for (const file of files) {
          await processFile(file, fieldName);
        }
      }
    }

    console.log("✅ All files compressed successfully");
    next();
  } catch (error) {
    console.error("❌ Compression Error:", error.message);
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    if (req.files) {
      const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat();
      for (const file of files) await fs.unlink(file.path).catch(() => {});
    }
    return res
      .status(500)
      .json({ error: "File processing failed", details: error.message });
  }
};

// 🧩 Export renamed middleware functions
export const uploadProfilePictureMW = [
  upload.single("profilePicture"),
  compressFiles,
];
export const uploadOtherImagesMW = [
  upload.array("otherImages", 10),
  compressFiles,
];
export const uploadPortfolioImagesMW = [
  upload.array("portfolioImages", 5),
  compressFiles,
];
export const uploadVideosMW = [upload.array("videos", 2), compressFiles];
export const uploadCertificatesMW = [
  upload.array("certificates", 3),
  compressFiles,
];
export const uploadGigImageMW = [upload.single("gigImage"), compressFiles];
// Add this line with your other exports
export const uploadChatAttachmentMW = [
  upload.single("attachment"),
  compressFiles,
];
export const uploadIdentityDocumentMW = [
  upload.single("identityDocument"),
  compressFiles,
];
