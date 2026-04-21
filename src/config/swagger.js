import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Jinnar Platform API",
            version: "1.1.0",
            description: "Comprehensive API documentation for the Jinnar platform. This documents all major modules including Auth, Users, Gigs, Orders, Chat, Payments, Support, LMS, and Admin functions.",
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
                // --- GENERAL ---
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        details: { type: "string" }
                    }
                },
                SuccessMessage: {
                    type: "object",
                    properties: {
                        message: { type: "string" }
                    }
                },
                // --- AUTH ---
                RegisterRequest: {
                    type: "object",
                    required: ["identifier", "role", "password"],
                    properties: {
                        identifier: { type: "string", description: "User's email or phone number in E.164 format." },
                        role: { type: "string", enum: ["buyer", "seller"] },
                        name: { type: "string", description: "Required if role is 'seller'." },
                        password: { type: "string", format: "password" }
                    }
                },
                LoginRequest: {
                    type: "object",
                    required: ["identifier", "password"],
                    properties: {
                        identifier: { type: "string", description: "User's email or phone number." },
                        password: { type: "string", format: "password" }
                    }
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                        token: { type: "string", description: "JWT authentication token." }
                    }
                },
                VerifyRequest: {
                    type: "object",
                    required: ["identifier", "code"],
                    properties: {
                        identifier: { type: "string", description: "User's email or phone number." },
                        code: { type: "string", description: "The OTP code sent to the user." }
                    }
                },
                // --- USER ---
                UserPublicProfile: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        role: { type: "string" },
                        profilePicture: { type: "string", format: "uri" },
                        bio: { type: "string" },
                        skills: { type: "array", items: { type: "string" } },
                        rating: { 
                            type: "object",
                            properties: {
                                average: { type: "number" },
                                count: { type: "integer" }
                            }
                        },
                        memberSince: { type: "string", format: "date-time" },
                        ordersCompleted: { type: "integer" },
                    }
                },
                UserPrivateProfile: {
                    allOf: [
                        { $ref: "#/components/schemas/UserPublicProfile" },
                        {
                            type: "object",
                            properties: {
                                email: { type: "string", format: "email" },
                                mobileNumber: { type: "string" },
                                isVerified: { type: "boolean" },
                                verificationStatus: { type: "string" },
                                wallet: {
                                    type: "object",
                                    properties: {
                                        balance: { type: "number" },
                                    }
                                }
                            }
                        }
                    ]
                },
                // --- GIG ---
                Gig: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                        status: { type: "string", enum: ["active", "pending", "rejected", "suspended"] },
                        pricing: { type: "object" },
                        images: { type: "array", items: { type: "object", properties: { url: { type: "string" } } } },
                        sellerId: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                name: { type: "string" },
                                rating: { type: "object" }
                            }
                        }
                    }
                },
                Pagination: {
                    type: "object",
                    properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        pages: { type: "integer" }
                    }
                },
                GigListResponse: {
                    type: "object",
                    properties: {
                        gigs: { type: "array", items: { $ref: "#/components/schemas/Gig" } },
                        pagination: { $ref: "#/components/schemas/Pagination" }
                    }
                },
                // --- ORDER ---
                Order: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        status: { type: "string", enum: ["pending", "accepted", "completed", "cancelled", "rejected", "offer_pending"] },
                        price: { type: "number" },
                        date: { type: "string", format: "date" },
                        jobDescription: { type: "string" },
                        buyerId: { type: "string" },
                        sellerId: { type: "string" },
                        gigId: { type: "string" }
                    }
                },
                // --- CHAT ---
                ChatMessage: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        sender: { type: "string" },
                        receiver: { type: "string" },
                        message: { type: "string" },
                        attachment: {
                            type: "object",
                            properties: {
                                url: { type: "string" },
                                type: { type: "string", enum: ["image", "video"] }
                            }
                        },
                        isRead: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" }
                    }
                },
                // --- SUPPORT TICKETS ---
                SupportTicket: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        ticketId: { type: "string" },
                        subject: { type: "string" },
                        status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"] },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                        user: { type: "string" },
                        assignedTo: { type: "string" },
                        createdAt: { type: "string", format: "date-time" }
                    }
                },
                CreateTicketRequest: {
                    type: "object",
                    required: ["subject", "message"],
                    properties: {
                        subject: { type: "string" },
                        message: { type: "string" },
                        attachments: { type: "array", items: { type: "object", properties: { url: { type: "string" } } } }
                    }
                },
                // --- WALLET & PAYMENTS ---
                Wallet: {
                    type: "object",
                    properties: {
                        balance: { type: "number" },
                        onHoldBalance: { type: "number" },
                        transactions: { type: "array", items: { type: "object" } }
                    }
                },
                DepositRequest: {
                    type: "object",
                    required: ["phoneNumber", "amount", "provider", "currency", "country"],
                    properties: {
                        phoneNumber: { type: "string" },
                        amount: { type: "number" },
                        provider: { type: "string" },
                        currency: { type: "string" },
                        country: { type: "string" }
                    }
                },
                // --- ADMIN ---
                Report: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        reporterId: { type: "string" },
                        reportedUserId: { type: "string" },
                        reason: { type: "string" },
                        description: { type: "string" },
                        status: { type: "string", enum: ["pending", "reviewed", "resolved", "dismissed"] },
                        createdAt: { type: "string", format: "date-time" }
                    }
                },
                AdminLoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string", format: "password" }
                    }
                },
                AdminProfile: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string", format: "email" },
                        mobileNumber: { type: "string" },
                        role: { type: "string", enum: ["support", "supervisor", "super_admin"] },
                        isVerified: { type: "boolean" },
                        isSuspended: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                    }
                },
                AdminAuthResponse: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                        token: { type: "string" },
                        user: { $ref: "#/components/schemas/AdminProfile" }
                    }
                },
                // --- SYSTEM ---
                SystemConfig: {
                    type: "object",
                    properties: {
                        maintenanceMode: {
                            type: "object",
                            properties: {
                                enabled: { type: "boolean" },
                                message: { type: "string" }
                            }
                        },
                        version: { type: "number" },
                        lastUpdatedBy: { type: "string" }
                    }
                },
                // --- BLOGS ---
                Blog: {
                    type: "object",
                    properties: {
                        _id: { type: "string", description: "Unique identifier for the blog post." },
                        title: { type: "string", description: "Title of the blog post." },
                        content: { type: "string", description: "Full content of the blog post (HTML/Markdown)." },
                        excerpt: { type: "string", description: "Short summary of the blog post." },
                        featuredImage: { type: "string", format: "uri", description: "URL of the featured image." },
                        tags: { type: "array", items: { type: "string" }, description: "List of tags associated with the blog post." },
                        author: {
                            type: "object",
                            properties: {
                                _id: { type: "string" },
                                name: { type: "string" },
                                email: { type: "string", format: "email" }
                            },
                            description: "Author details, populated from User model."
                        },
                        metaTitle: { type: "string", description: "SEO meta title." },
                        metaDescription: { type: "string", description: "SEO meta description." },
                        status: { type: "string", enum: ["draft", "published"], description: "Publication status of the blog post." },
                        slug: { type: "string", description: "URL-friendly slug for the blog post." },
                        createdAt: { type: "string", format: "date-time", description: "Date and time the blog post was created." },
                        updatedAt: { type: "string", format: "date-time", description: "Date and time the blog post was last updated." }
                    }
                },
                BlogListResponse: {
                    type: "object",
                    properties: {
                        blogs: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Blog" },
                            description: "Array of blog posts."
                        },
                        page: { type: "integer", description: "Current page number." },
                        pages: { type: "integer", description: "Total number of pages." },
                        total: { type: "integer", description: "Total number of blog posts." }
                    }
                },
                CreateBlogRequest: {
                    type: "object",
                    required: ["title", "content", "status"],
                    properties: {
                        title: { type: "string", description: "Title of the blog post." },
                        content: { type: "string", description: "Full content of the blog post (HTML/Markdown)." },
                        excerpt: { type: "string", description: "Short summary of the blog post (optional)." },
                        featuredImage: { type: "string", format: "uri", description: "URL of the featured image (optional)." },
                        tags: { type: "array", items: { type: "string" }, description: "List of tags (optional)." },
                        metaTitle: { type: "string", description: "SEO meta title (optional)." },
                        metaDescription: { type: "string", description: "SEO meta description (optional)." },
                        status: { type: "string", enum: ["draft", "published"], description: "Publication status ('draft' or 'published')." },
                        slug: { type: "string", description: "URL-friendly slug (optional, auto-generated if not provided)." }
                    }
                }
            }
        },
        paths: {
            // --- AUTH PATHS ---
            "/auth/register": {
                post: {
                    tags: ["Auth"],
                    summary: "Register a new user",
                    description: "Creates a new buyer or seller account and sends a verification OTP.",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } }
                    },
                    responses: {
                        "201": { description: "Verification code sent.", content: { "application/json": { schema: { properties: { message: { type: "string" }, userId: { type: "string" } } } } } },
                        "400": { description: "Bad Request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "409": { description: "Conflict - Email/Phone already registered", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/auth/login": {
                post: {
                    tags: ["Auth"],
                    summary: "Login a user",
                    description: "Authenticates a user and returns a JWT token.",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } }
                    },
                    responses: {
                        "200": { description: "Login successful", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
                        "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Account not verified or suspended", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/auth/verify": {
                post: {
                    tags: ["Auth"],
                    summary: "Verify account with OTP",
                    description: "Verifies a user's account using the OTP sent during registration.",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyRequest" } } }
                    },
                    responses: {
                        "200": { description: "Account verified successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessage" } } } },
                        "400": { description: "Invalid or expired code", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/auth/resend-verification": {
                post: {
                    tags: ["Auth"],
                    summary: "Resend verification OTP",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { properties: { identifier: { type: "string" } } } } }
                    },
                    responses: {
                        "200": { description: "New verification code sent", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessage" } } } }
                    }
                }
            },
            "/auth/forgot-password": {
                post: {
                    tags: ["Auth"],
                    summary: "Initiate password reset",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { properties: { identifier: { type: "string" } } } } }
                    },
                    responses: {
                        "200": { description: "Password reset code sent", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessage" } } } }
                    }
                }
            },
            "/auth/reset-password": {
                post: {
                    tags: ["Auth"],
                    summary: "Reset password with OTP",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: {
                            type: "object",
                            properties: {
                                identifier: { type: "string" },
                                code: { type: "string" },
                                newPassword: { type: "string" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "Password reset successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } }
                    }
                }
            },
            // --- USER PATHS ---
            "/user/profile": {
                get: {
                    tags: ["User"],
                    summary: "Get my private profile",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "User profile data", content: { "application/json": { schema: { properties: { profile: { $ref: "#/components/schemas/UserPrivateProfile" } } } } } }
                    }
                }
            },
            "/user/update": {
                post: {
                    tags: ["User"],
                    summary: "Update my profile",
                    description: "Update user profile fields. Many fields can be sent as JSON strings.",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                bio: { type: "string" },
                                skills: { type: "array", items: { type: "string" } },
                                address: { type: "string" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "User updated successfully" }
                    }
                }
            },
            "/user/public/{id}": {
                get: {
                    tags: ["User"],
                    summary: "Get a user's public profile",
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: {
                        "200": { description: "Public profile data", content: { "application/json": { schema: { properties: { profile: { $ref: "#/components/schemas/UserPublicProfile" } } } } } }
                    }
                }
            },
            // --- WORKER PATHS ---
            "/workers/find": {
                get: {
                    tags: ["Workers"],
                    summary: "Find workers/sellers",
                    description: "Find workers based on skills, location, and other criteria.",
                    parameters: [
                        { in: "query", name: "skills", schema: { type: "string" }, description: "Comma-separated list of skills." },
                        { in: "query", name: "address", schema: { type: "string" }, description: "User's address for location-based search." },
                        { in: "query", name: "radius", schema: { type: "integer" }, description: "Search radius in kilometers." },
                        { in: "query", name: "page", schema: { type: "integer" } },
                        { in: "query", name: "limit", schema: { type: "integer" } }
                    ],
                    responses: {
                        "200": { description: "A list of workers." }
                    }
                }
            },
            // --- GIG PATHS ---
            "/gigs/search": {
                get: {
                    tags: ["Gigs"],
                    summary: "Search for gigs",
                    parameters: [
                        { in: "query", name: "search", schema: { type: "string" }, description: "Search term for title/description." },
                        { in: "query", name: "category", schema: { type: "string" }, description: "Category ID or name." },
                        { in: "query", name: "minPrice", schema: { type: "number" } },
                        { in: "query", name: "maxPrice", schema: { type: "number" } },
                        { in: "query", name: "lat", schema: { type: "number" } },
                        { in: "query", name: "lng", schema: { type: "number" } },
                        { in: "query", name: "radius", schema: { type: "number" }, description: "Radius in KM." },
                        { in: "query", name: "page", schema: { type: "integer", default: 1 } },
                        { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
                    ],
                    responses: {
                        "200": { 
                            description: "A paginated list of gigs.",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/GigListResponse" } } }
                        }
                    }
                }
            },
            "/gigs": {
                get: {
                    tags: ["Gigs"],
                    summary: "Get all active gigs",
                    parameters: [
                        { in: "query", name: "page", schema: { type: "integer", default: 1 } },
                        { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
                    ],
                    responses: {
                        "200": { 
                            description: "A paginated list of all active gigs.", 
                            content: { "application/json": { schema: { $ref: "#/components/schemas/GigListResponse" } } } 
                        }
                    }
                }
            },
            "/gigs/my-gigs": {
                get: {
                    tags: ["Gigs"],
                    summary: "Get my gigs (Sellers only)",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "query", name: "page", schema: { type: "integer", default: 1 } },
                        { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
                    ],
                    responses: {
                        "200": { 
                            description: "A paginated list of the user's gigs.",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/GigListResponse" } } }
                        }
                    }
                }
            },
            "/gigs/{id}": {
                get: {
                    tags: ["Gigs"],
                    summary: "Get a single gig by ID",
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: {
                        "200": { description: "Gig details", content: { "application/json": { schema: { $ref: "#/components/schemas/Gig" } } } }
                    }
                }
            },
            // --- ORDER PATHS ---
            "/orders/create": {
                post: {
                    tags: ["Orders"],
                    summary: "Create a job request (Order)",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: {
                            type: "object",
                            properties: {
                                gigId: { type: "string" },
                                date: { type: "string", format: "date" },
                                timeSlot: { type: "string" },
                                jobDescription: { type: "string" },
                                lat: { type: "number" },
                                lng: { type: "number" },
                                selectedPricingMethod: { type: "string", enum: ["fixed", "hourly", "inspection"] }
                            }
                        } } }
                    },
                    responses: {
                        "201": { description: "Job request created", content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } } }
                    }
                }
            },
            "/orders/my-orders": {
                get: {
                    tags: ["Orders"],
                    summary: "Get my orders (as buyer or seller)",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "List of user's orders", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Order" } } } } }
                    }
                }
            },
            // --- CHAT PATHS ---
            "/chat/send": {
                post: {
                    tags: ["Chat"],
                    summary: "Send a chat message or attachment",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        receiverId: { type: "string", required: true },
                                        message: { type: "string" },
                                        attachment: { type: "string", format: "binary", description: "Image or video file" }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": { description: "Message sent", content: { "application/json": { schema: { $ref: "#/components/schemas/ChatMessage" } } } }
                    }
                }
            },
            "/chat/with/{otherUserId}": {
                get: {
                    tags: ["Chat"],
                    summary: "Get conversation with another user",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "otherUserId", required: true, schema: { type: "string" } }],
                    responses: {
                        "200": { description: "List of messages", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ChatMessage" } } } } }
                    }
                }
            },
            "/chat/list": {
                get: {
                    tags: ["Chat"],
                    summary: "Get user's chat list/inbox",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "List of conversations" }
                    }
                }
            },
            // --- SUPPORT TICKET PATHS ---
            "/support/tickets": {
                post: {
                    tags: ["Support Tickets"],
                    summary: "Create a support ticket",
                    description: "Can be used by authenticated users (bearer token) or guests (no token, but must provide guestInfo in body).",
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateTicketRequest" } } }
                    },
                    responses: {
                        "201": { description: "Ticket created", content: { "application/json": { schema: { $ref: "#/components/schemas/SupportTicket" } } } }
                    }
                },
                get: {
                    tags: ["Support Tickets"],
                    summary: "Get my support tickets",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "List of my tickets", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SupportTicket" } } } } }
                    }
                }
            },
            "/support/tickets/{id}": {
                get: {
                    tags: ["Support Tickets"],
                    summary: "Get a single support ticket by ID",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: {
                        "200": { description: "Ticket details" }
                    }
                }
            },
            // --- WALLET & PAYMENT PATHS ---
            "/wallet/balance": {
                get: {
                    tags: ["Wallet & Payments"],
                    summary: "Get my wallet balance and recent transactions",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "Wallet details", content: { "application/json": { schema: { $ref: "#/components/schemas/Wallet" } } } }
                    }
                }
            },
            "/wallet/deposit": {
                post: {
                    tags: ["Wallet & Payments"],
                    summary: "Initiate a deposit into the wallet",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/DepositRequest" } } }
                    },
                    responses: {
                        "200": { description: "Deposit initiated" }
                    }
                }
            },
            "/wallet/withdraw": {
                post: {
                    tags: ["Wallet & Payments"],
                    summary: "Initiate a withdrawal from the wallet",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/DepositRequest" } } }
                    },
                    responses: {
                        "201": { description: "Withdrawal initiated" }
                    }
                }
            },
            // --- LMS PATHS ---
            "/courses": {
                get: {
                    tags: ["LMS - Courses"],
                    summary: "Get all published courses",
                    responses: {
                        "200": { description: "List of public courses" }
                    }
                }
            },
            "/enrollments/enroll": {
                post: {
                    tags: ["LMS - Enrollment"],
                    summary: "Enroll in a course",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { properties: { courseId: { type: "string" } } } } }
                    },
                    responses: {
                        "201": { description: "Successfully enrolled" }
                    }
                }
            },
            "/enrollments/my-courses": {
                get: {
                    tags: ["LMS - Enrollment"],
                    summary: "Get my enrolled courses",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "List of enrolled courses" }
                    }
                }
            },
            // --- SYSTEM CONFIG ---
            "/config": {
                get: {
                    tags: ["System Configuration"],
                    summary: "Get system-wide configuration",
                    description: "Public endpoint for frontend to check for things like maintenance mode.",
                    responses: {
                        "200": { description: "System config object", content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } } }
                    }
                },
                put: {
                    tags: ["System Configuration"],
                    summary: "Update system-wide configuration",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } }
                    },
                    responses: {
                        "200": { description: "Configuration updated" }
                    }
                }
            },
            // --- ADMIN PATHS ---
            "/admin/login": {
                post: {
                    tags: ["Admin - Auth"],
                    summary: "Login for Admin users",
                    description: "Authenticates a support, supervisor, or super_admin user and returns a JWT token.",
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/AdminLoginRequest" } } }
                    },
                    responses: {
                        "200": { description: "Admin login successful", content: { "application/json": { schema: { $ref: "#/components/schemas/AdminAuthResponse" } } } },
                        "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Access denied: Insufficient privileges", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/admin/me": {
                get: {
                    tags: ["Admin - Auth"],
                    summary: "Get current admin's profile",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "Admin profile data", content: { "application/json": { schema: { 
                            properties: {
                                message: { type: "string" },
                                user: { $ref: "#/components/schemas/AdminProfile" }
                            }
                        } } } }
                    }
                }
            },
            "/admin/me/profile": {
                put: {
                    tags: ["Admin - Auth"],
                    summary: "Update current admin's name",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { 
                            type: "object",
                            properties: {
                                name: { type: "string" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "Profile updated" }
                    }
                }
            },
            "/admin/me/password": {
                put: {
                    tags: ["Admin - Auth"],
                    summary: "Change current admin's password",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { 
                            type: "object",
                            properties: {
                                currentPassword: { type: "string", format: "password" },
                                newPassword: { type: "string", format: "password" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "Password changed" }
                    }
                }
            },
            "/admin/me/email/initiate": {
                post: {
                    tags: ["Admin - Auth"],
                    summary: "Initiate email change for admin",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { 
                            type: "object",
                            properties: {
                                newEmail: { type: "string", format: "email" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "Verification code sent" }
                    }
                }
            },
            "/admin/me/email/verify": {
                post: {
                    tags: ["Admin - Auth"],
                    summary: "Verify new email for admin",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: { 
                            type: "object",
                            properties: {
                                code: { type: "string" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "Email updated" }
                    }
                }
            },
            "/admin/users": {
                get: {
                    tags: ["Admin - User Management"],
                    summary: "Get all platform users",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "query", name: "page", schema: { type: "integer" } },
                        { in: "query", name: "limit", schema: { type: "integer" } },
                        { in: "query", name: "search", schema: { type: "string" } },
                    ],
                    responses: {
                        "200": { description: "A paginated list of users." }
                    }
                }
            },
            "/admin/suspend-user": {
                patch: {
                    tags: ["Admin - User Management"],
                    summary: "Suspend or reinstate a user",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        content: { "application/json": { schema: {
                            type: "object",
                            properties: {
                                userId: { type: "string" },
                                suspend: { type: "boolean" },
                                reason: { type: "string" }
                            }
                        } } }
                    },
                    responses: {
                        "200": { description: "User status updated." }
                    }
                }
            },
            "/admin/users/test-delete/{id}": {
                delete: {
                    tags: ["Admin - User Management"],
                    summary: "Delete a user for testing purposes",
                    description: "WARNING: This permanently deletes a user and all their associated data. Only available in test/development environments.",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    responses: {
                        "200": { description: "User deleted successfully." },
                        "403": { description: "Endpoint not available in production." }
                    }
                }
            },
            "/admin/reports": {
                get: {
                    tags: ["Admin - Reports"],
                    summary: "Get all user reports",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "query", name: "status", schema: { type: "string" } },
                        { in: "query", name: "page", schema: { type: "integer" } }
                    ],
                    responses: {
                        "200": { description: "List of reports", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Report" } } } } }
                    }
                }
            },
            "/admin/reports/{id}": {
                patch: {
                    tags: ["Admin - Reports"],
                    summary: "Update a report's status (e.g., resolve, dismiss)",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    requestBody: {
                        content: { "application/json": { schema: { properties: { status: { type: "string" }, adminNote: { type: "string" } } } } }
                    },
                    responses: {
                        "200": { description: "Report updated" }
                    }
                }
            },
            "/admin/tickets": {
                get: {
                    tags: ["Admin - Support Tickets"],
                    summary: "Get all support tickets",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": { description: "List of all tickets" }
                    }
                }
            },
            "/admin/tickets/{id}/status": {
                put: {
                    tags: ["Admin - Support Tickets"],
                    summary: "Update ticket status",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
                    requestBody: {
                        content: { "application/json": { schema: { properties: { status: { type: "string" } } } } }
                    },
                    responses: {
                        "200": { description: "Status updated" }
                    }
                }
            },
            // --- BLOGS PATHS (Public) ---
            "/blogs": {
                get: {
                    tags: ["Blogs (Public)"],
                    summary: "Get all published blog posts",
                    parameters: [
                        { in: "query", name: "limit", schema: { type: "integer", default: 10 }, description: "Number of blogs per page." },
                        { in: "query", name: "page", schema: { type: "integer", default: 1 }, description: "Page number for pagination." },
                        { in: "query", name: "search", schema: { type: "string" }, description: "Search term for blog titles or tags." },
                        { in: "query", name: "tag", schema: { type: "string" }, description: "Filter blogs by a specific tag." }
                    ],
                    responses: {
                        "200": {
                            description: "A paginated list of published blog posts.",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/BlogListResponse" } } }
                        },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/blogs/{slug}": {
                get: {
                    tags: ["Blogs (Public)"],
                    summary: "Get a single published blog post by slug",
                    parameters: [
                        { in: "path", name: "slug", required: true, schema: { type: "string" }, description: "Unique URL-friendly slug of the blog post." }
                    ],
                    responses: {
                        "200": {
                            description: "Details of the requested blog post.",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/Blog" } } }
                        },
                        "404": { description: "Blog not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            // --- BLOGS PATHS (Admin) ---
            "/admin/blogs": {
                get: {
                    tags: ["Admin - Blog Management"],
                    summary: "Get all blog posts (including drafts) for admin",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "query", name: "limit", schema: { type: "integer", default: 10 }, description: "Number of blogs per page." },
                        { in: "query", name: "page", schema: { type: "integer", default: 1 }, description: "Page number for pagination." },
                        { in: "query", name: "search", schema: { type: "string" }, description: "Search term for blog titles or tags." },
                        { in: "query", name: "status", schema: { type: "string", enum: ["draft", "published"] }, description: "Filter by publication status." }
                    ],
                    responses: {
                        "200": {
                            description: "A paginated list of all blog posts (including drafts).",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/BlogListResponse" } } }
                        },
                        "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Forbidden - Insufficient privileges", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                },
                post: {
                    tags: ["Admin - Blog Management"],
                    summary: "Create a new blog post",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBlogRequest" } } }
                    },
                    responses: {
                        "201": { description: "Blog post created successfully.", content: { "application/json": { schema: { $ref: "#/components/schemas/Blog" } } } },
                        "400": { description: "Bad Request - Validation errors (e.g., missing fields, slug already exists)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Forbidden - Insufficient privileges", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            },
            "/admin/blogs/{id}": {
                put: {
                    tags: ["Admin - Blog Management"],
                    summary: "Update an existing blog post",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "path", name: "id", required: true, schema: { type: "string" }, description: "ID of the blog post to update." }
                    ],
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/CreateBlogRequest" } } }
                    },
                    responses: {
                        "200": { description: "Blog post updated successfully.", content: { "application/json": { schema: { $ref: "#/components/schemas/Blog" } } } },
                        "400": { description: "Bad Request - Validation errors (e.g., slug already exists)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Forbidden - Insufficient privileges", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "404": { description: "Blog not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                },
                delete: {
                    tags: ["Admin - Blog Management"],
                    summary: "Delete a blog post",
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { in: "path", name: "id", required: true, schema: { type: "string" }, description: "ID of the blog post to delete." }
                    ],
                    responses: {
                        "200": { description: "Blog post deleted successfully.", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessMessage" } } } },
                        "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "403": { description: "Forbidden - Insufficient privileges", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "404": { description: "Blog not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                        "500": { description: "Internal Server Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
                    }
                }
            }
        }
    },
    apis: [], // All paths are defined inline
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;