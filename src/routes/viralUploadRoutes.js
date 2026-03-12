import express from "express";
import {
    uploadCourseThumbnail,
    uploadCourseVideo,
    uploadCourseMaterial,
} from "../middleware/courseUpload.js";
import { handleCourseUpload } from "../controllers/courseUploadController.js";

const router = express.Router();

// Define upload routes for viral uploads (thumbnail & video)
router.post("/thumbnail", uploadCourseThumbnail, handleCourseUpload);
router.post("/video", uploadCourseVideo, handleCourseUpload);

export default router;
