import multer from "multer";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import { execSync } from "child_process";

// 🧩 Check FFmpeg installation
let ffmpegPath;
try {
  ffmpegPath = execSync("which ffmpeg", { encoding: "utf8" }).trim();
  console.log("✅ FFmpeg found:", ffmpegPath);
} catch {
  ffmpegPath = "/usr/local/bin/ffmpeg";
  console.log("⚠️ Using default FFmpeg path:", ffmpegPath);
}
ffmpeg.setFfmpegPath(ffmpegPath);

// 🗂️ Create required directories
await fs.mkdir("temp", { recursive: true });
await fs.mkdir("uploads", { recursive: true });

// ----------------------
// 📁 Folder mapping
// ----------------------
const folderMap = {
  profilePicture: "profilePictures",
  otherImages: "otherImages",
  portfolioImages: "portfolioImages",
  gigImage: "gigImages",
  gig_images: "gigImages", // Add this for the new multi-upload
  videos: "videos",
  certificates: "certificates",
  identityDocument: "identity",
  attachment: "chat",
};

// ----------------------
// 🧠 Multer storage
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "temp/"),
  filename: (req, file, cb) => {
    // ✅ Use UUID for unique, sanitized filenames
    const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

// ----------------------
// 🔒 File filter
// ----------------------
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    profilePicture: ["image/jpeg", "image/png", "image/gif"],
    otherImages: ["image/jpeg", "image/png", "image/gif"],
    portfolioImages: ["image/jpeg", "image/png", "image/gif"],
    gigImage: ["image/jpeg", "image/png", "image/gif"],
    gig_images: ["image/jpeg", "image/png", "image/gif"], // And here
    videos: ["video/mp4", "video/mpeg", "video/quicktime"],
    certificates: ["application/pdf"],
    identityDocument: ["application/pdf", "image/jpeg", "image/png"],
    attachment: ["image/jpeg", "image/png", "application/pdf", "video/mp4"],
  };

  if (allowedTypes[file.fieldname]?.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}`), false);
  }
};

// ----------------------
// ⚙️ Multer instance
// ----------------------
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ----------------------
// 🧩 Compression helpers
// ----------------------
const compressImage = async (input, output) =>
  sharp(input)
    .resize({
      width: 1920,
      height: 1080,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toFile(output);

const compressVideo = (input, output) =>
  new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec("libx264")
      .audioCodec("aac")
      .size("1280x720")
      .videoBitrate("1500k")
      .audioBitrate("128k")
      .format("mp4")
      .on("end", resolve)
      .on("error", reject) // ✅ Pass the original error for better debugging
      .save(output);
  });

const compressPDF = async (input, output) => {
  await fs.copyFile(input, output);
};

// ----------------------
// 📦 Final move function
// ----------------------
async function moveToUploads(fieldName, filename) {
  const folder = folderMap[fieldName] || "misc";
  const targetDir = path.join("uploads", folder);

  await fs.mkdir(targetDir, { recursive: true });

  return path.join(targetDir, filename);
}

// ----------------------
// 🧩 Compression middleware
// ----------------------
export const compressFiles = async (req, res, next) => {
  try {
    const files = req.file
      ? [req.file]
      : Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();

    for (const file of files) {
      const original = file.path;
      const compressed = path.join("temp", `compressed-${file.filename}`);

      if (
        ["profilePicture", "otherImages", "portfolioImages", "gigImage"].includes(
          file.fieldname,
        ) || file.fieldname === "gig_images" // And here
      ) {
        await compressImage(original, compressed);
      } else if (file.fieldname === "videos") {
        await compressVideo(original, compressed);
      } else if (file.fieldname === "certificates") {
        await compressPDF(original, compressed);
      } else if (file.fieldname === "identityDocument") {
        if (file.mimetype.startsWith("image/")) {
          await compressImage(original, compressed);
        } else {
          await compressPDF(original, compressed);
        }
      } else if (file.fieldname === "attachment") {
        if (file.mimetype.startsWith("image/")) {
          await compressImage(original, compressed);
        } else if (file.mimetype.startsWith("video/")) {
          await compressVideo(original, compressed);
        } else {
          await compressPDF(original, compressed);
        }
      }

      // Move to uploads folder
      const finalPath = await moveToUploads(
        file.fieldname,
        path.basename(compressed),
      );
      await fs.rename(compressed, finalPath);

      // Update file info for controller
      file.finalPath = finalPath;
      // ✅ Generate URL matching the new /api/files/:folder/:filename route
      file.url = `/api/files/${folderMap[file.fieldname]}/${path.basename(compressed)}`;
      file.size = (await fs.stat(finalPath)).size;

      // Clean up temp
      await fs.unlink(original).catch((err) => {
        // ✅ Log cleanup errors instead of ignoring them
        console.error(`⚠️ Failed to delete temp file: ${original}`, err);
      });
    }

    next();
  } catch (err) {
    console.error("❌ Compression Error:", err);
    return res.status(500).json({
      error: "File processing failed",
      details: err.message,
    });
  }
};

// ----------------------
// 📤 Export upload middlewares
// ----------------------
export const uploadProfilePictureMW = [
  upload.single("profilePicture"),
  compressFiles,
];

export const uploadOtherImagesMW = [upload.array("otherImages", 10), compressFiles];

export const uploadPortfolioImagesMW = [
  upload.array("portfolioImages", 5),
  compressFiles,
];

// ⭐ NEW: Middleware for MULTIPLE gig images
export const uploadGigImagesMW = [
  upload.array("gig_images", 3), // Expects up to 3 files in a field named 'gig_images'
  compressFiles,
];

export const uploadVideosMW = [upload.array("videos", 2), compressFiles];

export const uploadCertificatesMW = [
  upload.array("certificates", 3),
  compressFiles,
];

export const uploadGigImageMW = [upload.single("gigImage"), compressFiles];

export const uploadChatAttachmentMW = [upload.single("attachment"), compressFiles];

export const uploadIdentityDocumentMW = [
  upload.single("identityDocument"),
  compressFiles,
];
