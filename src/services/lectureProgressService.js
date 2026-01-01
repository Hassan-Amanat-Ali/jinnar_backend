import LectureProgress from "../models/LectureProgress.js";

/**
 * LectureProgressService - Mongoose-based lecture progress tracking
 *
 * This service tracks:
 * - Individual lecture progress (watch time, completion status)
 * - Video watch positions for resume functionality
 * - Completion timestamps for certificates
 * - Detailed analytics for course creators
 */
export class LectureProgressService {
    /**
     * Create or update lecture progress
     * @param {string} userId - User ID
     * @param {string} courseId - Course ID
     * @param {string} lectureId - Lecture ID
     * @param {Object} progressData - Progress data
     */
    static async updateLectureProgress(
        userId,
        courseId,
        lectureId,
        progressData
    ) {
        try {
            const updateData = {
                userId,
                courseId,
                lectureId,
                ...progressData,
                lastWatchedAt: new Date(),
            };

            // Upsert: update if exists, insert if not
            const result = await LectureProgress.findOneAndUpdate(
                { userId, lectureId }, // Unique compound key
                { $set: updateData },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            return { success: true, data: result };
        } catch (error) {
            console.error("Error updating lecture progress:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get lecture progress for a specific user and lecture
     */
    static async getLectureProgress(userId, courseId, lectureId) {
        try {
            const progress = await LectureProgress.findOne({
                userId,
                lectureId,
            });
            return progress;
        } catch (error) {
            console.error("Error getting lecture progress:", error);
            return null;
        }
    }

    /**
     * Get all lecture progress for a course
     */
    static async getCourseProgress(userId, courseId) {
        try {
            const progressList = await LectureProgress.find({
                userId,
                courseId,
            });
            return progressList;
        } catch (error) {
            console.error("Error getting course progress:", error);
            return [];
        }
    }

    /**
     * Mark lecture as completed
     */
    static async markLectureCompleted(
        userId,
        courseId,
        lectureId,
        videoDuration
    ) {
        const progressData = {
            isCompleted: true,
            completedAt: new Date(),
            watchTime: videoDuration, // Full duration watched
            currentPosition: videoDuration, // At the end
            completionPercentage: 100,
        };

        return await this.updateLectureProgress(
            userId,
            courseId,
            lectureId,
            progressData
        );
    }

    /**
     * Update video watch progress (for resume functionality)
     */
    static async updateVideoProgress(
        userId,
        courseId,
        lectureId,
        currentPosition,
        videoDuration
    ) {
        const completionPercentage =
            videoDuration > 0
                ? Math.round((currentPosition / videoDuration) * 100)
                : 0;
        const isCompleted = completionPercentage >= 90; // Consider 90% as completed

        const progressData = {
            currentPosition,
            videoDuration,
            completionPercentage,
            isCompleted, // Note: Model uses isCompleted, not completed
            lastWatchedAt: new Date(),
        };

        // If marking as completed for the first time, set completion timestamp
        if (isCompleted) {
            const existingProgress = await this.getLectureProgress(
                userId,
                courseId,
                lectureId
            );
            if (!existingProgress?.isCompleted) {
                progressData.completedAt = new Date();
            }
        }

        return await this.updateLectureProgress(
            userId,
            courseId,
            lectureId,
            progressData
        );
    }

    /**
     * Calculate overall course progress
     */
    static async calculateCourseProgress(userId, courseId, totalLectures) {
        try {
            const progressData = await this.getCourseProgress(userId, courseId);

            if (!progressData || progressData.length === 0) {
                return {
                    overallProgress: 0,
                    completedLectures: 0,
                    totalLectures: totalLectures || 0,
                    completedLectureIds: [],
                    lastWatchedLecture: null,
                };
            }

            const completedLectures = progressData.filter((p) => p.isCompleted);
            const overallProgress =
                totalLectures > 0
                    ? Math.round((completedLectures.length / totalLectures) * 100)
                    : 0;

            // Find last watched lecture
            const lastWatched = progressData
                .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)[0];

            return {
                overallProgress,
                completedLectures: completedLectures.length,
                totalLectures: totalLectures || 0,
                completedLectureIds: completedLectures.map((p) => p.lectureId),
                lastWatchedLecture: lastWatched?.lectureId || null,
                detailedProgress: progressData,
            };
        } catch (error) {
            console.error("Error calculating course progress:", error);
            return {
                overallProgress: 0,
                completedLectures: 0,
                totalLectures: totalLectures || 0,
                completedLectureIds: [],
                lastWatchedLecture: null,
            };
        }
    }

    /**
     * Get resume position for a lecture
     */
    static async getResumePosition(userId, courseId, lectureId) {
        try {
            const progress = await this.getLectureProgress(
                userId,
                courseId,
                lectureId
            );
            return progress?.currentPosition || 0;
        } catch (error) {
            console.error("Error getting resume position:", error);
            return 0;
        }
    }

    /**
     * Reset lecture progress (for retaking)
     */
    static async resetLectureProgress(userId, courseId, lectureId) {
        const progressData = {
            isCompleted: false,
            currentPosition: 0,
            completionPercentage: 0,
            completedAt: null,
            lastWatchedAt: new Date(),
        };

        return await this.updateLectureProgress(
            userId,
            courseId,
            lectureId,
            progressData
        );
    }

    /**
     * Get analytics data for course creators
     */
    static async getCourseAnalytics(courseId) {
        try {
            const progressData = await LectureProgress.find({ courseId });

            if (!progressData) {
                return { success: false, error: "No data found" };
            }

            const uniqueUsers = [...new Set(progressData.map((p) => p.userId.toString()))];
            const totalEnrollments = uniqueUsers.length;

            // Calculate completion rates per lecture
            const lectureStats = {};
            progressData.forEach((progress) => {
                const lectureIdStr = progress.lectureId.toString();
                if (!lectureStats[lectureIdStr]) {
                    lectureStats[lectureIdStr] = {
                        totalViews: 0,
                        completions: 0,
                        totalWatchTime: 0,
                    };
                }

                lectureStats[lectureIdStr].totalViews++;
                if (progress.isCompleted) {
                    lectureStats[lectureIdStr].completions++;
                }
                if (progress.currentPosition) {
                    lectureStats[lectureIdStr].totalWatchTime += progress.currentPosition;
                }
            });

            return {
                success: true,
                data: {
                    totalEnrollments,
                    lectureStats,
                    overallCompletionRate:
                        totalEnrollments > 0
                            ? Math.round(
                                (Object.values(lectureStats).reduce(
                                    (sum, stat) => sum + stat.completions,
                                    0
                                ) /
                                    (Object.keys(lectureStats).length * totalEnrollments)) *
                                100
                            )
                            : 0,
                },
            };
        } catch (error) {
            console.error("Error getting course analytics:", error);
            return { success: false, error: error.message };
        }
    }
}

export default LectureProgressService;
