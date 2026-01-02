import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Jinnar LMS & Notifications API",
            version: "1.0.0",
            description: "Dedicated API documentation for Course Management (LMS) and Notification System.",
            contact: {
                name: "API Support",
                email: "support@jinnar.com",
            },
        },
        servers: [
            {
                url: "/api",
                description: "Main API Server",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // --- COURSE SCHEMAS ---
                Course: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        category: { type: "string", description: "Category ID" },
                        instructor: { type: "string", description: "Instructor ID" },
                        price: { type: "number" },
                        level: { type: "string", enum: ["beginner", "intermediate", "advanced", "all_levels"] },
                        thumbnail: { type: "string" },
                        isPublished: { type: "boolean" },
                        duration: { type: "number", description: "Total duration in minutes" },
                        rating: { type: "number" },
                        enrollmentCount: { type: "number" },
                    },
                },
                CourseDetail: {
                    allOf: [
                        { $ref: "#/components/schemas/Course" },
                        {
                            type: "object",
                            properties: {
                                detailedDescription: { type: "string" },
                                syllabus: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            title: { type: "string" },
                                            description: { type: "string" },
                                            order: { type: "number" },
                                        },
                                    },
                                },
                                requirements: { type: "array", items: { type: "string" } },
                                learningOutcomes: { type: "array", items: { type: "string" } },
                                tags: { type: "array", items: { type: "string" } },
                            },
                        },
                    ],
                },
                CreateCourseRequest: {
                    type: "object",
                    required: ["title", "description", "category", "price"],
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        detailedDescription: { type: "string" },
                        category: { type: "string" },
                        price: { type: "number" },
                        level: { type: "string", enum: ["beginner", "intermediate", "advanced", "all_levels"] },
                        thumbnail: { type: "string" },
                        tags: { type: "array", items: { type: "string" } },
                        requirements: { type: "array", items: { type: "string" } },
                        learningOutcomes: { type: "array", items: { type: "string" } },
                    },
                },

                // --- LECTURE SCHEMAS ---
                Lecture: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        title: { type: "string" },
                        videoUrl: { type: "string" },
                        duration: { type: "number" },
                        order: { type: "number" },
                        isPreview: { type: "boolean" },
                        resources: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    url: { type: "string" }
                                }
                            }
                        }
                    }
                },
                AddLectureRequest: {
                    type: "object",
                    required: ["title", "videoUrl"],
                    properties: {
                        title: { type: "string" },
                        videoUrl: { type: "string" },
                        duration: { type: "number" },
                        order: { type: "number" },
                        isPreview: { type: "boolean" },
                        resources: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    url: { type: "string" }
                                }
                            }
                        }
                    }
                },

                // --- ENROLLMENT SCHEMAS ---
                Enrollment: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        userId: { type: "string" },
                        courseId: { type: "string" },
                        status: { type: "string", enum: ["active", "completed", "dropped"] },
                        progress: { type: "number", description: "Percentage 0-100" },
                        completedLectures: { type: "array", items: { type: "string" } },
                        lastAccessedAt: { type: "string", format: "date-time" }
                    }
                },
                UpdateProgressRequest: {
                    type: "object",
                    required: ["currentPosition"],
                    properties: {
                        currentPosition: { type: "number", description: "Current timestamp in video seconds" },
                        videoDuration: { type: "number", description: "Total video duration seconds" },
                        isCompleted: { type: "boolean", description: "Force completion (e.g. for PDFs)" }
                    }
                },

                // --- NOTIFICATION SCHEMAS ---
                Notification: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        recipientId: { type: "string" },
                        type: { type: "string" },
                        content: { type: "string" },
                        isRead: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                        relatedId: { type: "string" },
                        relatedModel: { type: "string" }
                    }
                }
            },
        },
        paths: {
            // ============================
            // COURSE MANAGEMENT (ADMIN)
            // ============================
            "/admin/courses": {
                get: {
                    summary: "Get all courses (Admin)",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "query", name: "page", schema: { type: "integer" } },
                        { in: "query", name: "limit", schema: { type: "integer" } },
                        { in: "query", name: "search", schema: { type: "string" } },
                    ],
                    responses: { 200: { description: "List of courses" } }
                },
                post: {
                    summary: "Create a new course",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCourseRequest" } } }
                    },
                    responses: { 201: { description: "Course created" } }
                }
            },
            "/admin/courses/{id}": {
                get: {
                    summary: "Get course details by ID",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: { 200: { description: "Course details", content: { "application/json": { schema: { $ref: "#/components/schemas/CourseDetail" } } } } }
                },
                put: {
                    summary: "Update course",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCourseRequest" } } }
                    },
                    responses: { 200: { description: "Course updated" } }
                },
                delete: {
                    summary: "Delete course",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: { 200: { description: "Course deleted" } }
                }
            },
            "/admin/courses/{id}/lectures": {
                post: {
                    summary: "Add lecture to course",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" }, description: "Course ID" }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/AddLectureRequest" } } }
                    },
                    responses: { 201: { description: "Lecture added" } }
                }
            },
            "/admin/lectures/{id}": {
                put: {
                    summary: "Update lecture",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/AddLectureRequest" } } }
                    },
                    responses: { 200: { description: "Lecture updated" } }
                },
                delete: {
                    summary: "Delete lecture",
                    tags: ["Admin - Courses"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: { 200: { description: "Lecture deleted" } }
                }
            },

            // ============================
            // COURSE UPLOADS
            // ============================
            "/courses/upload/thumbnail": {
                post: {
                    summary: "Upload course thumbnail",
                    tags: ["Course Uploads"],
                    requestBody: {
                        content: { "multipart/form-data": { schema: { type: "object", properties: { thumbnail: { type: "string", format: "binary" } } } } }
                    },
                    responses: { 200: { description: "Upload successful" } }
                }
            },
            "/courses/upload/video": {
                post: {
                    summary: "Upload lecture video",
                    tags: ["Course Uploads"],
                    requestBody: {
                        content: { "multipart/form-data": { schema: { type: "object", properties: { video: { type: "string", format: "binary" } } } } }
                    },
                    responses: { 200: { description: "Upload successful" } }
                }
            },
            "/courses/upload/material": {
                post: {
                    summary: "Upload course material/resource",
                    tags: ["Course Uploads"],
                    requestBody: {
                        content: { "multipart/form-data": { schema: { type: "object", properties: { material: { type: "string", format: "binary" } } } } }
                    },
                    responses: { 200: { description: "Upload successful" } }
                }
            },

            // ============================
            // ENROLLMENT (STUDENT)
            // ============================
            "/enrollments/enroll": {
                post: {
                    summary: "Enroll in a course",
                    tags: ["Enrollment"],
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { type: "object", required: ["courseId"], properties: { courseId: { type: "string" } } } } }
                    },
                    responses: { 201: { description: "Enrolled" } }
                }
            },
            "/enrollments/my-courses": {
                get: {
                    summary: "Get my enrolled courses",
                    tags: ["Enrollment"],
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: "List of enrolled courses", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Enrollment" } } } } } }
                }
            },
            "/enrollments/{courseId}/progress": {
                get: {
                    summary: "Get detailed progress for a course",
                    tags: ["Enrollment"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "courseId", required: true, schema: { type: "string" } }],
                    responses: { 200: { description: "Progress details" } }
                }
            },
            "/enrollments/lectures/{lectureId}/progress": {
                post: {
                    summary: "Update lecture progress",
                    tags: ["Enrollment"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "lectureId", required: true, schema: { type: "string" } }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateProgressRequest" } } }
                    },
                    responses: { 200: { description: "Progress updated" } }
                }
            },

            // ============================
            // NOTIFICATIONS
            // ============================
            "/notifications": {
                get: {
                    summary: "Get user notifications",
                    tags: ["Notifications"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: {
                            description: "List of notifications",
                            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Notification" } } } }
                        }
                    }
                }
            },
            "/notifications/{id}/read": {
                put: {
                    summary: "Mark notification as read",
                    tags: ["Notifications"],
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: { 200: { description: "Marked as read" } }
                }
            },
            "/notifications/read": {
                patch: {
                    summary: "Mark ALL notifications as read",
                    tags: ["Notifications"],
                    security: [{ bearerAuth: [] }],
                    responses: { 200: { description: "All marked as read" } }
                }
            }
        }
    },
    apis: [], // Paths are defined inline
};

const swaggerCourseSpec = swaggerJsdoc(options);
export default swaggerCourseSpec;
