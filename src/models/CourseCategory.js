import mongoose from "mongoose";

const courseCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            unique: true,
            trim: true,
        },
        value: {
            type: String,
            unique: true,
            lowercase: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Auto-generate the 'value' before saving
courseCategorySchema.pre("save", function (next) {
    if (this.isModified("name")) {
        this.value = this.name.split(" ").join("-").toLowerCase();
    }
    next();
});

export default mongoose.model("CourseCategory", courseCategorySchema);
