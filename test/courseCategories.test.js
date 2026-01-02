import { jest } from '@jest/globals';

// Mock dependencies
const mockCourseCategory = {
    create: jest.fn(),
    find: jest.fn().mockReturnThis(),
    sort: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
};

const mockCourse = {
    countDocuments: jest.fn(),
};

jest.unstable_mockModule('../src/models/CourseCategory.js', () => ({
    default: mockCourseCategory,
}));

jest.unstable_mockModule('../src/models/Course.js', () => ({
    default: mockCourse,
}));

// Mock other dependencies if needed (Lecture is imported in controller but not used in category methods)
jest.unstable_mockModule('../src/models/Lecture.js', () => ({
    default: {},
}));

// Re-import controller to pick up mocks
const { default: Controller } = await import('../src/controllers/adminCourseController.js');

describe("Admin Course Category Controller", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            user: { id: "admin123" }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    describe("createCourseCategory", () => {
        it("should create a category", async () => {
            req.body.name = "Web Dev";
            mockCourseCategory.create.mockResolvedValue({ name: "Web Dev", _id: "c1" });

            await Controller.createCourseCategory(req, res);

            expect(mockCourseCategory.create).toHaveBeenCalledWith({ name: "Web Dev" });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ category: { name: "Web Dev", _id: "c1" } }));
        });

        it("should validate name requirement", async () => {
            await Controller.createCourseCategory(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("deleteCourseCategory", () => {
        it("should prevent deletion if used by courses", async () => {
            req.params.id = "c1";
            mockCourse.countDocuments.mockResolvedValue(5); // Used in 5 courses

            await Controller.deleteCourseCategory(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(mockCourseCategory.findByIdAndDelete).not.toHaveBeenCalled();
        });

        it("should delete unused category", async () => {
            req.params.id = "c1";
            mockCourse.countDocuments.mockResolvedValue(0);
            mockCourseCategory.findByIdAndDelete.mockResolvedValue({ _id: "c1" });

            await Controller.deleteCourseCategory(req, res);

            expect(mockCourseCategory.findByIdAndDelete).toHaveBeenCalledWith("c1");
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Category deleted" }));
        });
    });
});
