import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"], // e.g., "Electrician"
      unique: true,
      trim: true,
    },
    value: {
      type: String, // standardized-slug (e.g., "electrician")
      unique: true,
      lowercase: true,
    },
    icon: {
      type: String, 
      default: "https://via.placeholder.com/150", // Admin should upload this
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Auto-generate the 'value' before saving (useful for filtering)
categorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.value = this.name.split(" ").join("-").toLowerCase();
  }
  next();
});

export default mongoose.model("Category", categorySchema);