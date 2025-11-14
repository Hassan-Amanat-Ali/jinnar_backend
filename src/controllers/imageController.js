import multer from 'multer';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

// Initialize Multer for image uploads
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
}).array('images', 3); // Allow up to 3 images per request

// Image upload controller
export const uploadImages = async (req, res) => {
  try {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer Error:', err.message);
        return res.status(400).json({ error: 'Image upload failed', details: err.message });
      } else if (err) {
        console.error('File Filter Error:', err.message);
        return res.status(400).json({ error: 'Invalid file type', details: err.message });
      }

      if (!req.files || req.files.length === 0) {
        console.log('No images provided for upload');
        return res.status(400).json({ error: 'No images provided' });
      }

      const imageData = req.files.map((file) => ({
        url: `/uploads/images/${file.filename}`,
        publicId: file.filename,
      }));

      console.log('Images uploaded:', imageData);
      return res.status(200).json({
        message: 'Images uploaded successfully',
        images: imageData,
      });
    });
  } catch (error) {
    console.error('Image Upload Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};