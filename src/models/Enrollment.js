import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "completed", "cancelled"],
            default: "active",
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        completedLectures: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Lecture",
            },
        ],
        lastAccessedAt: {
            type: Date,
            default: Date.now,
        },
        completionDate: {
            type: Date,
        },
    },
    { timestamps: true }
);

// Compound index to prevent double enrollment
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export default mongoose.model("Enrollment", enrollmentSchema);
