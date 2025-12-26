import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Jinnar Services API",
      version: "1.0.1",
      description: "API documentation for the Jinnar Services platform. Updated to support Email & Mobile Authentication.",
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
        // --- AUTH SCHEMAS ---
        RegisterRequest: {
          type: "object",
          required: ["identifier", "role", "password"],
          properties: {
            identifier: {
              type: "string",
              description: "Email address OR Mobile Number (E.164 format, e.g., +255712345678)",
              example: "user@example.com",
            },
            role: {
              type: "string",
              enum: ["buyer", "seller"],
              description: "User role",
            },
            name: {
              type: "string",
              description: "Full name (Required for sellers)",
              example: "John Doe",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "securePassword123",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["identifier", "password"],
          properties: {
            identifier: {
              type: "string",
              description: "Email or Mobile Number (E.164 format)",
              example: "+255712345678",
            },
            password: {
              type: "string",
              format: "password",
              example: "securePassword123",
            },
          },
        },
        VerifyRequest: {
          type: "object",
          required: ["identifier", "code"],
          properties: {
            identifier: { type: "string", description: "Email or Mobile Number" },
            code: { type: "string", description: "OTP Code", example: "123456" },
          },
        },
        ResendCodeRequest: {
          type: "object",
          required: ["identifier"],
          properties: {
            identifier: { type: "string", description: "Email or Mobile Number" },
          },
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["identifier"],
          properties: {
            identifier: { type: "string", description: "Email or Mobile Number" },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["identifier", "code", "newPassword"],
          properties: {
            identifier: { type: "string" },
            code: { type: "string" },
            newPassword: { type: "string", minLength: 6 },
          },
        },
        ChangeContactInitiateRequest: {
          type: "object",
          required: ["newIdentifier", "type"],
          properties: {
            newIdentifier: { type: "string", example: "new@example.com" },
            type: { type: "string", enum: ["email", "mobileNumber"] },
          },
        },
        ChangeContactVerifyRequest: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", example: "123456" },
          },
        },

        // --- USER SCHEMAS ---
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            mobileNumber: { type: "string" },
            role: { type: "string", enum: ["buyer", "seller", "support", "supervisor", "regional_manager", "super_admin"] },
            isVerified: { type: "boolean" },
            profilePicture: { type: "string", format: "uri" },
            wallet: {
              type: "object",
              properties: {
                balance: { type: "number" },
              },
            },
          },
        },

        // --- GIG SCHEMAS ---
        Gig: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            pricing: {
              type: "object",
              properties: {
                method: { type: "string", enum: ["fixed", "hourly", "negotiable"] },
                price: { type: "number" },
              },
            },
            images: {
              type: "array",
              items: { type: "object", properties: { url: { type: "string" } } },
            },
            status: { type: "string", enum: ["pending", "active", "rejected", "suspended"] },
            sellerId: { $ref: "#/components/schemas/User" },
          },
        },
        CreateGigRequest: {
          type: "object",
          required: ["title", "description", "pricingMethod", "categoryId", "primarySubcategory"],
          properties: {
            title: { type: "string", maxLength: 100 },
            description: { type: "string", maxLength: 1000 },
            pricingMethod: { type: "string", enum: ["fixed", "hourly", "negotiable"] },
            price: { type: "number", description: "Required if pricingMethod is not negotiable" },
            categoryId: { type: "string", description: "Category ID" },
            primarySubcategory: { type: "string", description: "SubCategory ID" },
            address: { type: "string", description: "Physical location of the gig" },
            images: { 
              type: "array", 
              items: { type: "string", format: "binary" },
              description: "Upload up to 3 images"
            }
          },
        },

        // --- ORDER SCHEMAS ---
        CreateOrderRequest: {
          type: "object",
          required: ["gigId", "date", "timeSlot", "jobDescription", "lat", "lng"],
          properties: {
            gigId: { type: "string" },
            date: { type: "string", format: "date", example: "2025-10-27" },
            timeSlot: { type: "string", example: "10:00 AM - 12:00 PM" },
            jobDescription: { type: "string" },
            lat: { type: "number" },
            lng: { type: "number" },
            emergency: { type: "boolean", default: false },
            image: { type: "string", description: "Optional image URL" }
          },
        },
        
        // --- CONFIG SCHEMAS ---
        SystemConfig: {
          type: "object",
          properties: {
            defaultCurrency: { type: "string" },
            defaultLanguage: { type: "string" },
            maintenanceMode: { type: "boolean" },
            serviceFeePercentage: { type: "number" },
            workerRegistrationEnabled: { type: "boolean" },
            clientRegistrationEnabled: { type: "boolean" },
            autoApprovalEnabled: { type: "boolean" },
          }
        },
        UpdateSystemConfigRequest: {
          type: "object",
          properties: {
            defaultCurrency: { type: "string" },
            defaultLanguage: { type: "string" },
            maintenanceMode: { type: "boolean" },
            serviceFeePercentage: { type: "number" },
            workerRegistrationEnabled: { type: "boolean" },
            clientRegistrationEnabled: { type: "boolean" },
            autoApprovalEnabled: { type: "boolean" },
          }
        },

        // --- ADMIN SCHEMAS ---
        AdminVerifyUserRequest: {
          type: "object",
          required: ["userId", "status"],
          properties: {
            userId: { type: "string" },
            status: { type: "string", enum: ["pending", "approved", "rejected"] },
            reason: { type: "string" }
          }
        },
        AdminSuspendUserRequest: {
          type: "object",
          required: ["userId", "suspend"],
          properties: {
            userId: { type: "string" },
            suspend: { type: "boolean" },
            reason: { type: "string" }
          }
        },
        CreateSubAdminRequest: {
          type: "object",
          required: ["name", "email", "password", "role"],
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            mobileNumber: { type: "string" },
            password: { type: "string" },
            role: { type: "string", enum: ["support", "supervisor", "regional_manager"] }
          }
        },
        CategoryRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            isActive: { type: "boolean" }
          }
        },
        SubCategoryRequest: {
          type: "object",
          required: ["name", "categoryId"],
          properties: {
            name: { type: "string" },
            categoryId: { type: "string" },
            isActive: { type: "boolean" }
          }
        },
        AdminUpdateGigStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pending", "active", "rejected", "suspended"] },
            reason: { type: "string" }
          }
        }
      },
    },
    paths: {
      // --- AUTH PATHS ---
      "/auth/register": {
        post: {
          summary: "Register a new user",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
          },
          responses: {
            201: { description: "User registered, verification code sent to Email/SMS" },
            400: { description: "Validation error" },
            409: { description: "User already exists" },
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Login user",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
          },
          responses: {
            200: { description: "Login successful", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
            401: { description: "Invalid credentials" },
          },
        },
      },
      "/auth/verify": {
        post: {
          summary: "Verify account with OTP",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyRequest" } } },
          },
          responses: {
            200: { description: "Account verified" },
            400: { description: "Invalid code" },
          },
        },
      },
      "/auth/resend-code": {
        post: {
          summary: "Resend verification code",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ResendCodeRequest" } } },
          },
          responses: {
            200: { description: "Code resent" },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request password reset code",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordRequest" } } },
          },
          responses: {
            200: { description: "Reset code sent" },
            404: { description: "User not found" },
          },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset password with code",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordRequest" } } },
          },
          responses: {
            200: { description: "Password reset successful" },
            400: { description: "Invalid code or password" },
          },
        },
      },
      "/auth/change-contact/initiate": {
        post: {
          summary: "Initiate email/phone change",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ChangeContactInitiateRequest" } } },
          },
          responses: {
            200: { description: "Verification code sent to new contact" },
          },
        },
      },
      "/auth/change-contact/verify": {
        post: {
          summary: "Verify and finalize email/phone change",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ChangeContactVerifyRequest" } } },
          },
          responses: {
            200: { description: "Contact info updated" },
          },
        },
      },
      "/auth/switch-role": {
        post: {
          summary: "Switch between Buyer and Seller roles",
          tags: ["Auth"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { newRole: { type: "string", enum: ["buyer", "seller"] } } } } },
          },
          responses: {
            200: { description: "Role switched", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
          },
        },
      },

      // --- USER PATHS ---
      "/user/profile": {
        get: {
          summary: "Get current user profile",
          tags: ["User"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Profile data", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/user/update": {
        post: {
          summary: "Update user profile",
          tags: ["User"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    bio: { type: "string" },
                    skills: { type: "array", items: { type: "string" } },
                    address: { type: "string" },
                    mobileNumber: { type: "string" },
                    email: { type: "string" }
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "User updated" },
          },
        },
      },

      // --- GIG PATHS ---
      "/gigs/search": {
        get: {
          summary: "Search gigs",
          tags: ["Gigs"],
          parameters: [
            { in: "query", name: "search", schema: { type: "string" }, description: "Text search" },
            { in: "query", name: "category", schema: { type: "string" }, description: "Category ID or Name" },
            { in: "query", name: "minPrice", schema: { type: "number" } },
            { in: "query", name: "maxPrice", schema: { type: "number" } },
            { in: "query", name: "lat", schema: { type: "number" }, description: "Latitude for geo-search" },
            { in: "query", name: "lng", schema: { type: "number" }, description: "Longitude for geo-search" },
            { in: "query", name: "radius", schema: { type: "number" }, description: "Radius in km" },
          ],
          responses: {
            200: { description: "List of gigs", content: { "application/json": { schema: { type: "object", properties: { gigs: { type: "array", items: { $ref: "#/components/schemas/Gig" } } } } } } },
          },
        },
      },
      "/gigs/create": {
        post: {
          summary: "Create a new gig",
          tags: ["Gigs"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/CreateGigRequest" } } },
          },
          responses: {
            201: { description: "Gig created" },
            403: { description: "Only sellers can create gigs" },
          },
        },
      },

      // --- ORDER PATHS ---
      "/orders/create": {
        post: {
          summary: "Create a job request (Order)",
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateOrderRequest" } } },
          },
          responses: {
            201: { description: "Order created" },
            400: { description: "Validation error or self-booking" },
            402: { description: "Insufficient funds" },
          },
        },
      },
      "/orders/my-orders": {
        get: {
          summary: "Get orders for current user",
          tags: ["Orders"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "List of orders" },
          },
        },
      },

      // --- WALLET PATHS ---
      "/wallet/balance": {
        get: {
          summary: "Get wallet balance and transactions",
          tags: ["Wallet"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Balance details" },
          },
        },
      },
      "/wallet/deposit": {
        post: {
          summary: "Initiate a deposit",
          tags: ["Wallet"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["amount", "phoneNumber", "provider", "currency", "country"],
                  properties: {
                    amount: { type: "number" },
                    phoneNumber: { type: "string" },
                    provider: { type: "string" },
                    currency: { type: "string" },
                    country: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Deposit initiated" },
          },
        },
      },

      // --- CONFIG PATHS ---
      "/config": {
        get: {
          summary: "Get system configuration",
          tags: ["System"],
          responses: {
            200: { description: "System config", content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } } },
          },
        },
        put: {
          summary: "Update system configuration",
          tags: ["System"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateSystemConfigRequest" } } },
          },
          responses: {
            200: { description: "Config updated", content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } } },
            403: { description: "Admin only" },
          },
        },
      },

      // --- ADMIN PATHS ---
      "/admin/dashboard/stats": {
        get: {
          summary: "Get admin dashboard statistics",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "Stats data" },
          },
        },
      },
      "/admin/users": {
        get: {
          summary: "Get all users (paginated)",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "page", schema: { type: "integer" } },
            { in: "query", name: "limit", schema: { type: "integer" } },
            { in: "query", name: "search", schema: { type: "string" } },
          ],
          responses: {
            200: { description: "List of users" },
          },
        },
      },
      "/admin/users/verify": {
        post: {
          summary: "Approve or Reject user verification",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/AdminVerifyUserRequest" } } },
          },
          responses: {
            200: { description: "User status updated" },
          },
        },
      },
      "/admin/users/suspend": {
        post: {
          summary: "Suspend or Reinstate user",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/AdminSuspendUserRequest" } } },
          },
          responses: {
            200: { description: "User suspension updated" },
          },
        },
      },
      "/admin/users/{id}": {
        delete: {
          summary: "Soft delete user",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "User deactivated" },
          },
        },
      },
      "/admin/create-sub-admin": {
        post: {
          summary: "Create a new admin user",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateSubAdminRequest" } } },
          },
          responses: {
            201: { description: "Admin created" },
          },
        },
      },
      "/admin/categories": {
        get: {
          summary: "Get all categories",
          tags: ["Admin"],
          responses: { 200: { description: "List of categories" } },
        },
        post: {
          summary: "Create category",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryRequest" } } },
          },
          responses: { 201: { description: "Category created" } },
        },
      },
      "/admin/categories/{id}": {
        put: {
          summary: "Update category",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryRequest" } } },
          },
          responses: { 200: { description: "Category updated" } },
        },
        delete: {
          summary: "Delete category",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Category deleted" } },
        },
      },
      "/admin/subcategories": {
        get: {
          summary: "Get subcategories",
          tags: ["Admin"],
          parameters: [{ in: "query", name: "categoryId", schema: { type: "string" } }],
          responses: { 200: { description: "List of subcategories" } },
        },
        post: {
          summary: "Create subcategory",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/SubCategoryRequest" } } },
          },
          responses: { 201: { description: "SubCategory created" } },
        },
      },
      "/admin/gigs": {
        get: {
          summary: "Get all gigs (Admin view)",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "page", schema: { type: "integer" } },
            { in: "query", name: "status", schema: { type: "string" } },
            { in: "query", name: "search", schema: { type: "string" } },
          ],
          responses: { 200: { description: "List of gigs" } },
        },
      },
      "/admin/gigs/{id}/status": {
        post: {
          summary: "Update gig status (Approve/Reject)",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            content: { "application/json": { schema: { $ref: "#/components/schemas/AdminUpdateGigStatusRequest" } } },
          },
          responses: { 200: { description: "Gig status updated" } },
        },
      },
      "/admin/financials/logs": {
        get: {
          summary: "View financial transaction logs",
          tags: ["Admin"],
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Transaction logs" } },
        },
      },

      // --- FILE PATHS ---
      "/files/{folder}/{filename}": {
        get: {
          summary: "Serve a file (Image/Document)",
          tags: ["Files"],
          parameters: [
            { in: "path", name: "folder", required: true, schema: { type: "string" } },
            { in: "path", name: "filename", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "File content" },
            403: { description: "Access denied (for private folders)" },
            404: { description: "File not found" },
          },
        },
      },

      // --- PAWAPAY CALLBACKS ---
      "/pawapay/callback/deposit": {
        post: {
          summary: "Webhook for deposit updates",
          tags: ["Webhooks"],
          responses: { 200: { description: "Received" } },
        },
      },
      "/pawapay/callback/payout": {
        post: {
          summary: "Webhook for payout updates",
          tags: ["Webhooks"],
          responses: { 200: { description: "Received" } },
        },
      },
      "/pawapay/callback/refund": {
        post: {
          summary: "Webhook for refund updates",
          tags: ["Webhooks"],
          responses: { 200: { description: "Received" } },
        },
      },
    },
  },
  apis: [], // Paths are defined inline
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;