import express from "express";
import { protect } from "../middleware/auth.js";
import EnrollmentController from "../controllers/enrollmentController.js";

const router = express.Router();

router.use(protect); // All routes require login

// Enroll
router.post("/enroll", EnrollmentController.enrollCourse); // Expects { courseId } in body

// My Courses
router.get("/my-courses", EnrollmentController.getMyCourses);

// Check Specific Enrollment
router.get("/:courseId/check", EnrollmentController.checkEnrollment);

// Course Progress Map
router.get("/:courseId/progress", EnrollmentController.getCourseProgress);

// Update Lecture Progress
router.post("/lectures/:lectureId/progress", EnrollmentController.updateLectureProgress);

export default router;
