import express from "express";
import {
    uploadCourseThumbnail,
    uploadCourseVideo,
} from "../middleware/courseUpload.js";
import { handleCourseUpload } from "../controllers/courseUploadController.js";

const router = express.Router();

// Define upload routes
router.post("/thumbnail", uploadCourseThumbnail, handleCourseUpload);
router.post("/video", uploadCourseVideo, handleCourseUpload);

export default router;
