import { jest } from '@jest/globals';

// Mock Auth Middleware
jest.unstable_mockModule("../src/middleware/auth.js", () => ({
    protect: (req, res, next) => {
        req.user = {
            id: "507f1f77bcf86cd799439011",
            role: "student",
            name: "Test Student",
        };
        next();
    },
    authorize: () => (req, res, next) => next(),
}));

// Mock Models
const mockCourse = {
    _id: "course123",
    title: "Test Course",
    isPublished: true,
    enrollmentCount: 0
};

jest.unstable_mockModule("../src/models/Course.js", () => ({
    default: {
        findById: jest.fn().mockResolvedValue(mockCourse),
        findByIdAndUpdate: jest.fn().mockResolvedValue({}),
        countDocuments: jest.fn().mockResolvedValue(10)
    }
}));

const mockEnrollmentInstance = {
    _id: "enroll123",
    status: "active",
    completedLectures: [],
    progress: 0,
    save: jest.fn().mockResolvedValue(true)
};

jest.unstable_mockModule("../src/models/Enrollment.js", () => ({
    default: {
        findOne: jest.fn().mockResolvedValue(mockEnrollmentInstance),
        findById: jest.fn().mockResolvedValue(mockEnrollmentInstance),
        create: jest.fn().mockImplementation((data) => Promise.resolve({ ...mockEnrollmentInstance, ...data })),
        find: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnValue([])
            })
        }),
        findByIdAndUpdate: jest.fn().mockResolvedValue({})
    }
}));

jest.unstable_mockModule("../src/models/Lecture.js", () => ({
    default: {
        findById: jest.fn().mockResolvedValue({ _id: "lec1", courseId: "course123" }),
        getAllLectures: jest.fn().mockReturnValue([]),
        countDocuments: jest.fn().mockResolvedValue(10)
    }
}));


const mockLectureProgressInstance = {
    set: jest.fn(),
    save: jest.fn().mockResolvedValue({
        _id: "lp123",
        isCompleted: true,
        completionPercentage: 100,
        completedAt: new Date()
    }),
    isCompleted: true,
    completionPercentage: 100,
    completedAt: new Date()
};

const mockLectureProgress = jest.fn().mockImplementation(() => mockLectureProgressInstance);
mockLectureProgress.findOne = jest.fn().mockResolvedValue(null);
mockLectureProgress.findOneAndUpdate = jest.fn().mockResolvedValue(mockLectureProgressInstance);

jest.unstable_mockModule("../src/models/LectureProgress.js", () => ({
    default: mockLectureProgress
}));


// Dynamic imports
const request = (await import("supertest")).default;
const express = (await import("express")).default;
const bodyParser = (await import("body-parser")).default;
const enrollmentRoutes = (await import("../src/routes/enrollmentRoutes.js")).default;

const app = express();
app.use(bodyParser.json());
app.use("/api/enrollments", enrollmentRoutes);

describe("LMS Enrollment API", () => {
    it("should enroll in a course", async () => {
        const { default: Enrollment } = await import("../src/models/Enrollment.js");
        Enrollment.findOne.mockResolvedValueOnce(null);

        const res = await request(app)
            .post("/api/enrollments/enroll")
            .send({ courseId: "course123" });

        expect(res.status).toBe(201);
    });

    it("should update lecture progress", async () => {
        const { default: Enrollment } = await import("../src/models/Enrollment.js");
        // Ensure findById returns the instance with .save()
        Enrollment.findById.mockResolvedValue(mockEnrollmentInstance);
        Enrollment.findOne.mockResolvedValue(mockEnrollmentInstance); // for the check at start of controller

        const res = await request(app)
            .post("/api/enrollments/lectures/lec1/progress")
            .send({
                currentPosition: 95,
                videoDuration: 100
            });

        expect(res.status).toBe(200);
    });
});
