import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import child_process from 'child_process';
import { execSync } from 'child_process';

// ✅ FIXED: Check FFmpeg installation
let ffmpegPath;
try {
  // Try Homebrew path (macOS)
  ffmpegPath = execSync('which ffmpeg', { encoding: 'utf8' }).trim();
  console.log('✅ FFmpeg found via Homebrew:', ffmpegPath);
} catch (error) {
  // Fallback to system path
  ffmpegPath = '/usr/local/bin/ffmpeg';
  console.log('✅ Using default FFmpeg path:', ffmpegPath);
}

ffmpeg.setFfmpegPath(ffmpegPath);
console.log('✅ FFmpeg configured successfully!');

// ✅ FIXED: Auto-create ALL directories
await fs.mkdir('temp', { recursive: true });
await fs.mkdir('uploads/images', { recursive: true });
await fs.mkdir('uploads/videos', { recursive: true });
await fs.mkdir('uploads/certificates', { recursive: true });
console.log('✅ All directories ready');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'portfolioImages' && !file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed for portfolio'), false);
  } else if (file.fieldname === 'videos' && !file.mimetype.startsWith('video/')) {
    return cb(new Error('Only video files are allowed'), false);
  } else if (file.fieldname === 'certificates' && file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed for certificates'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const compressImage = async (inputPath, outputPath) => {
  await sharp(inputPath)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);
  console.log(`✅ Image compressed: ${path.basename(inputPath)}`);
};

const compressVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264').audioCodec('aac')
      .size('1280x720').videoBitrate('1500k').audioBitrate('128k')
      .format('mp4')
      .on('end', () => { 
        console.log(`✅ Video compressed: ${path.basename(inputPath)}`); 
        resolve(); 
      })
      .on('error', (err) => { 
        console.error('Video error details:', err.message);
        reject(new Error(`Failed to compress video: ${err.message}`)); 
      })
      .save(outputPath);
  });
};

const compressPDF = async (inputPath, outputPath) => {
  await fs.copyFile(inputPath, outputPath);
  console.log(`✅ PDF copied: ${path.basename(inputPath)}`);
};

export const compressAndMoveFiles = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) return next();

    for (const [fieldName, files] of Object.entries(req.files)) {
      for (let i = 0; i < files.length; i++) {
        const originalPath = files[i].path;
        const originalName = files[i].originalname;
        const timestamp = Date.now() + i;
        let finalPath, finalFilename;

        if (fieldName === 'portfolioImages') {
          finalFilename = `${timestamp}-${path.basename(originalName, path.extname(originalName))}.jpg`;
          finalPath = path.join('uploads/images', finalFilename);
          await compressImage(originalPath, finalPath);
        } else if (fieldName === 'videos') {
          finalFilename = `${timestamp}-${path.basename(originalName, path.extname(originalName))}.mp4`;
          finalPath = path.join('uploads/videos', finalFilename);
          await compressVideo(originalPath, finalPath);
        } else if (fieldName === 'certificates') {
          finalFilename = `${timestamp}-${originalName}`;
          finalPath = path.join('uploads/certificates', finalFilename);
          await compressPDF(originalPath, finalPath);
        }

        files[i].filename = finalFilename;
        files[i].path = finalPath;
        files[i].size = (await fs.stat(finalPath)).size;
        await fs.unlink(originalPath).catch(() => {});
      }
    }

    console.log('✅ All files processed successfully');
    next();
  } catch (error) {
    console.error('❌ Compression Error:', error.message);
    if (req.files) {
      for (const files of Object.values(req.files)) {
        for (const file of files) await fs.unlink(file.path).catch(() => {});
      }
    }
    return res.status(500).json({ error: 'File processing failed', details: error.message });
  }
};

export const uploadFiles = [
  upload.fields([
    { name: 'portfolioImages', maxCount: 5 },
    { name: 'videos', maxCount: 2 },
    { name: 'certificates', maxCount: 3 },
  ]),
  compressAndMoveFiles
];

export const uploadGigImage = upload.single('gigImage');