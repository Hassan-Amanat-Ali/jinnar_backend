import express from "express";
import {
    uploadCourseThumbnail,
    uploadCourseVideo,
    uploadCourseMaterial,
} from "../middleware/courseUpload.js";
import { handleCourseUpload } from "../controllers/courseUploadController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Define upload routes - All require admin authentication
router.post("/thumbnail", protect, authorize("super_admin", "supervisor"), uploadCourseThumbnail, handleCourseUpload);
router.post("/video", protect, authorize("super_admin", "supervisor"), uploadCourseVideo, handleCourseUpload);
router.post("/material", protect, authorize("super_admin", "supervisor"), uploadCourseMaterial, handleCourseUpload);

export default router;
