import Enrollment from "../models/Enrollment.js";
import LectureProgress from "../models/LectureProgress.js";
import Course from "../models/Course.js";
import Lecture from "../models/Lecture.js";
import { sendNotification } from "./notificationController.js";

class EnrollmentController {
    // ===========================================================================
    // ENROLLMENT
    // ===========================================================================

    static async enrollCourse(req, res) {
        try {
            const { courseId } = req.body;
            const userId = req.user.id;

            // Check course existence
            const course = await Course.findById(courseId);
            if (!course) {
                return res.status(404).json({ error: "Course not found" });
            }

            if (!course.isPublished) {
                return res.status(400).json({ error: "Cannot enroll in unpublished course" });
            }

            // Check existing enrollment
            const existing = await Enrollment.findOne({ userId, courseId });
            if (existing) {
                return res.json({ message: "Already enrolled", enrollment: existing });
            }

            const enrollment = await Enrollment.create({
                userId,
                courseId,
                status: "active",
                progress: 0,
            });

            // Update course enrollment count
            await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } });

            // 🔔 Notify Instructor
            await sendNotification(
                course.instructor,
                "system", // or 'course_enrollment' if defined in enum
                `New student enrolled in your course: ${course.title}`,
                course._id,
                "Course"
            );

            res.status(201).json({ message: "Enrolled successfully", enrollment });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyCourses(req, res) {
        try {
            const userId = req.user.id;
            const enrollments = await Enrollment.find({ userId })
                .populate({
                    path: "courseId",
                    select: "title thumbnail instructor category duration level",
                    populate: { path: "instructor", select: "name" }
                })
                .sort({ lastAccessedAt: -1 });

            res.json(enrollments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async checkEnrollment(req, res) {
        try {
            const { courseId } = req.params;
            const userId = req.user.id;
            const enrollment = await Enrollment.findOne({ userId, courseId });

            res.json({ isEnrolled: !!enrollment, enrollment });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // ===========================================================================
    // PROGRESS TRACKING
    // ===========================================================================

    static async getCourseProgress(req, res) {
        try {
            const { courseId } = req.params;
            const userId = req.user.id;

            // 1. Get Enrollment
            const enrollment = await Enrollment.findOne({ userId, courseId });
            if (!enrollment) {
                return res.status(404).json({ error: "Not enrolled in this course" });
            }

            // 2. Get All Lecture Progress details
            const progressDetails = await LectureProgress.find({ userId, courseId });

            res.json({ enrollment, progressDetails });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateLectureProgress(req, res) {
        try {
            const { lectureId } = req.params;
            const { currentPosition, videoDuration, isCompleted: manualComplete } = req.body; // accept manual override
            const userId = req.user.id;

            // 1. Validate Lecture
            const lecture = await Lecture.findById(lectureId);
            if (!lecture) return res.status(404).json({ error: "Lecture not found" });

            const courseId = lecture.courseId;

            // 2. Ensure Enrolled
            const enrollment = await Enrollment.findOne({ userId, courseId });
            if (!enrollment) return res.status(403).json({ error: "Not enrolled" });

            // 3. Logic: Determine completion
            // If manually completed (e.g. PDF viewed) or > 90% watched
            let completionPercentage = 0;
            let isFinished = false;

            if (videoDuration > 0 && currentPosition !== undefined) {
                completionPercentage = Math.round((currentPosition / videoDuration) * 100);
            }

            if (manualComplete || completionPercentage >= 90) {
                isFinished = true;
                completionPercentage = 100; // Cap at 100 if finished
            }

            // 4. Update/Create Lecture Progress
            const updateData = {
                courseId,
                lastWatchedAt: new Date(),
                completionPercentage
            };

            if (currentPosition !== undefined) updateData.currentPosition = currentPosition;
            if (videoDuration !== undefined) updateData.videoDuration = videoDuration;

            // Only set completedAt if becoming completed for the first time
            // We check this atomically via findOneAndUpdate logic or pre-check.
            // Easiest is to set isCompleted true if currently true OR if new state is true
            if (isFinished) {
                updateData.isCompleted = true;
                // We set completedAt only if it wasn't set. 
                // Since we can't easily conditionally set inside one atomic update without pipeline, 
                // we'll do a two-step or use a pipeline if needed. 
                // For simplicity, we'll set it every time or check first.
                // Let's use $min (keep earliest date) - wait, $min keeps smallest. 
                // $setOnInsert is only for inserts.
                // We'll trust the client or just set it to now if not present.
            }

            // Basic upsert
            let progress = await LectureProgress.findOne({ userId, lectureId });
            if (!progress) {
                progress = new LectureProgress({
                    userId,
                    lectureId,
                    ...updateData,
                    completedAt: isFinished ? new Date() : undefined
                });
            } else {
                progress.set(updateData);
                if (isFinished && !progress.completedAt) {
                    progress.completedAt = new Date();
                }
            }
            await progress.save();


            // 5. Update Course Aggregated Progress
            if (progress.isCompleted) {
                // Add to completedLectures if not already there
                await Enrollment.findByIdAndUpdate(enrollment._id, {
                    $addToSet: { completedLectures: lectureId },
                    lastAccessedAt: new Date()
                });

                // Recalculate percent
                const totalLecturesCount = await Lecture.countDocuments({ courseId });
                const updatedEnrollment = await Enrollment.findById(enrollment._id);
                const completedCount = updatedEnrollment.completedLectures.length;

                const percent = Math.round((completedCount / totalLecturesCount) * 100);

                updatedEnrollment.progress = percent;
                if (percent === 100 && updatedEnrollment.status !== 'completed') {
                    updatedEnrollment.status = 'completed';
                    updatedEnrollment.completionDate = new Date();
                }
                await updatedEnrollment.save();
            } else {
                // Just update last accessed
                await Enrollment.findByIdAndUpdate(enrollment._id, { lastAccessedAt: new Date() });
            }

            res.json({ success: true, progress });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default EnrollmentController;
