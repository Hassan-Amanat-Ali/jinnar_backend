import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        title: {
            type: String,
            required: [true, "Lecture title is required"],
            trim: true,
        },
        videoUrl: {
            type: String,
            required: [true, "Video URL is required"],
        },
        duration: {
            type: Number, // In minutes
            default: 0,
        },
        order: {
            type: Number,
            required: true,
        },
        resources: [
            {
                title: { type: String, required: true },
                url: { type: String, required: true },
                type: { type: String, enum: ["pdf", "link", "file"], default: "link" },
            },
        ],
        isPreview: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

lectureSchema.index({ courseId: 1, order: 1 });

export default mongoose.model("Lecture", lectureSchema);
