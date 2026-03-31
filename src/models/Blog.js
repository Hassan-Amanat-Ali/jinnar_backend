import mongoose from "mongoose";

const { Schema } = mongoose;

const blogSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      lowercase: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    excerpt: {
      type: String,
      trim: true,
    },
    featuredImage: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Slug auto-generation logic from title if it doesn't exist
blogSchema.pre("save", async function (next) {
  if (this.isModified("title") && !this.slug) {
    let generatedSlug = this.title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w-]+/g, ""); // Remove all non-word chars

    // Ensure uniqueness
    const Blog = this.constructor;
    let finalSlug = generatedSlug;
    let counter = 1;

    while (await Blog.findOne({ slug: finalSlug })) {
      finalSlug = `${generatedSlug}-${counter}`;
      counter++;
    }
    this.slug = finalSlug;
  }
  next();
});

export default mongoose.model("Blog", blogSchema);
