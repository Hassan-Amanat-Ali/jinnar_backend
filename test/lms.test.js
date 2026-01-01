import { jest } from '@jest/globals';

// Mock Auth Middleware
jest.unstable_mockModule("../src/middleware/auth.js", () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: "507f1f77bcf86cd799439011",
            role: "super_admin",
            name: "Test Admin",
        };
        next();
    },
    authorize: () => (req, res, next) => next(),
}));

// Mock Models
jest.unstable_mockModule("../src/models/Course.js", () => ({
    default: {
        create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: "course123", ...data })),
        findById: jest.fn().mockResolvedValue({ _id: "course123", title: "Test Course" }),
        findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: "course123", title: "Updated Course" }),
        findByIdAndDelete: jest.fn().mockResolvedValue({ _id: "course123" }),
        find: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockReturnValue({
                        skip: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue([])
                        })
                    })
                })
            })
        }),
        countDocuments: jest.fn().mockResolvedValue(0),
    }
}));

jest.unstable_mockModule("../src/models/Lecture.js", () => ({
    default: {
        create: jest.fn().mockResolvedValue({ _id: "lecture123", title: "Test Lecture" }),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(null) }),
        deleteMany: jest.fn().mockResolvedValue({}),
    }
}));

// Dynamic imports after mocks
const request = (await import("supertest")).default;
const express = (await import("express")).default;
const bodyParser = (await import("body-parser")).default;
const adminRoutes = (await import("../src/routes/admin.js")).default;

const app = express();
app.use(bodyParser.json());
app.use("/api/admin", adminRoutes);

describe("LMS Admin API", () => {
    it("should create a course", async () => {
        const res = await request(app)
            .post("/api/admin/courses")
            .send({
                title: "Test Course",
                description: "Test Description",
                category: "507f1f77bcf86cd799439012"
            });

        expect(res.status).toBe(201);
        expect(res.body.course.title).toBe("Test Course");
    });

    it("should get courses", async () => {
        const res = await request(app).get("/api/admin/courses");
        expect(res.status).toBe(200);
    });
});
