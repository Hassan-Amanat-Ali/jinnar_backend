import { jest } from '@jest/globals';

// Mock Mongoose Model
const mockLectureProgress = {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
};

jest.unstable_mockModule("../src/models/LectureProgress.js", () => ({
    default: mockLectureProgress
}));

// Dynamic import for service
const LectureProgressService = (await import("../src/services/lectureProgressService.js")).default;

describe("LectureProgressService", () => {
    const userId = "user123";
    const courseId = "course123";
    const lectureId = "lecture123";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("updateLectureProgress", () => {
        it("should update lecture progress", async () => {
            const progressData = { currentPosition: 100 };
            mockLectureProgress.findOneAndUpdate.mockResolvedValue({ ...progressData, userId, lectureId });

            const result = await LectureProgressService.updateLectureProgress(userId, courseId, lectureId, progressData);

            expect(mockLectureProgress.findOneAndUpdate).toHaveBeenCalledWith(
                { userId, lectureId },
                { $set: expect.objectContaining(progressData) },
                expect.objectContaining({ upsert: true, new: true })
            );
            expect(result.success).toBe(true);
        });

        it("should handle errors", async () => {
            mockLectureProgress.findOneAndUpdate.mockRejectedValue(new Error("DB Error"));
            const result = await LectureProgressService.updateLectureProgress(userId, courseId, lectureId, {});
            expect(result.success).toBe(false);
        });
    });

    describe("getLectureProgress", () => {
        it("should return progress", async () => {
            const expectedProgress = { userId, lectureId, currentPosition: 50 };
            mockLectureProgress.findOne.mockResolvedValue(expectedProgress);

            const result = await LectureProgressService.getLectureProgress(userId, courseId, lectureId);
            expect(result).toEqual(expectedProgress);
        });
    });

    describe("markLectureCompleted", () => {
        it("should mark lecture as completed", async () => {
            const videoDuration = 500;
            mockLectureProgress.findOneAndUpdate.mockResolvedValue({});

            await LectureProgressService.markLectureCompleted(userId, courseId, lectureId, videoDuration);

            expect(mockLectureProgress.findOneAndUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    $set: expect.objectContaining({
                        isCompleted: true,
                        completionPercentage: 100,
                        watchTime: videoDuration
                    })
                },
                expect.any(Object)
            );
        });
    });

    describe("updateVideoProgress", () => {
        it("should calculate completion percentage", async () => {
            const videoDuration = 100;
            const currentPosition = 50;
            mockLectureProgress.findOneAndUpdate.mockResolvedValue({});

            await LectureProgressService.updateVideoProgress(userId, courseId, lectureId, currentPosition, videoDuration);

            expect(mockLectureProgress.findOneAndUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    $set: expect.objectContaining({
                        completionPercentage: 50,
                        isCompleted: false
                    })
                },
                expect.any(Object)
            );
        });

        it("should mark as completed if > 90%", async () => {
            const videoDuration = 100;
            const currentPosition = 95;
            mockLectureProgress.findOneAndUpdate.mockResolvedValue({});
            mockLectureProgress.findOne.mockResolvedValue({ isCompleted: false });

            await LectureProgressService.updateVideoProgress(userId, courseId, lectureId, currentPosition, videoDuration);

            expect(mockLectureProgress.findOneAndUpdate).toHaveBeenCalledWith(
                expect.any(Object),
                {
                    $set: expect.objectContaining({
                        isCompleted: true,
                        completedAt: expect.any(Date)
                    })
                },
                expect.any(Object)
            );
        });
    });

    describe("calculateCourseProgress", () => {
        it("should calculate overall progress", async () => {
            const mockProgress = [
                { lectureId: "l1", isCompleted: true, lastWatchedAt: new Date('2023-01-01') },
                { lectureId: "l2", isCompleted: false, lastWatchedAt: new Date('2023-01-02') }
            ];
            mockLectureProgress.find.mockResolvedValue(mockProgress);

            const result = await LectureProgressService.calculateCourseProgress(userId, courseId, 2);

            expect(result.overallProgress).toBe(50);
            expect(result.completedLectures).toBe(1);
            expect(result.lastWatchedLecture).toBe("l2");
        });

        it("should handle empty progress", async () => {
            mockLectureProgress.find.mockResolvedValue([]);
            const result = await LectureProgressService.calculateCourseProgress(userId, courseId, 5);
            expect(result.overallProgress).toBe(0);
        });
    });

    describe("getCourseAnalytics", () => {
        it("should aggregate analytics", async () => {
            const mockProgress = [
                { userId: "u1", lectureId: "l1", isCompleted: true, currentPosition: 100 },
                { userId: "u2", lectureId: "l1", isCompleted: false, currentPosition: 50 }
            ];
            mockLectureProgress.find.mockResolvedValue(mockProgress);

            const result = await LectureProgressService.getCourseAnalytics(courseId);

            expect(result.success).toBe(true);
            expect(result.data.totalEnrollments).toBe(2);
            expect(result.data.lectureStats["l1"].totalViews).toBe(2);
            expect(result.data.lectureStats["l1"].completions).toBe(1);
        });
    });
});
