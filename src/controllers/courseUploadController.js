import path from "path";

export const handleCourseUpload = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    // Construct the URL path - Assuming static serving is set up for 'uploads'
    // The path stored in req.file.path is relative, e.g., uploads/courses/thumbnails/filename.ext
    // We want to return a URL like /uploads/courses/thumbnails/filename.ext

    // Normalizing path separators for URL
    const relativePath = req.file.path.replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;

    res.status(200).json({
        message: "File uploaded successfully",
        file: {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: fileUrl,
            size: req.file.size,
            mimetype: req.file.mimetype,
        },
    });
};
