import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "SubCategory name is required"],
      trim: true,
    },
    value: {
      type: String, // standardized-slug (e.g., "house-wiring")
      unique: true,
      lowercase: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Parent category ID is required"],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

subCategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.value = this.name.split(" ").join("-").toLowerCase();
  }
  next();
});

export default mongoose.model("SubCategory", subCategorySchema);