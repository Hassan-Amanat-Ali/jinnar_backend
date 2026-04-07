import mongoose from "mongoose";
import { toSlug } from "../utils/permalink.js";

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
      trim: true,
    },
    slugAliases: {
      type: [String],
      default: [],
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

// Slug auto-generation logic from title when needed.
blogSchema.pre("save", async function (next) {
  const Blog = this.constructor;

  const slugRelevantChange =
    this.isModified("title") || this.isModified("slug") || this.isModified("slugAliases");

  if (!slugRelevantChange) {
    return next();
  }

  if (!this.slug || (this.isModified("title") && !this.isModified("slug"))) {
    this.slug = toSlug(this.title, "post");
  } else {
    this.slug = toSlug(this.slug, "post");
  }

  if (Array.isArray(this.slugAliases)) {
    this.slugAliases = [
      ...new Set(
        this.slugAliases.filter(Boolean).map((alias) => toSlug(alias, "post"))
      ),
    ];
  }

  const originalSlug = this.slug;
  let finalSlug = originalSlug;
  let counter = 2;

  while (await Blog.findOne({ slug: finalSlug, _id: { $ne: this._id } })) {
    finalSlug = `${originalSlug}-${counter}`;
    counter += 1;
  }

  this.slug = finalSlug;
  next();
});

blogSchema.index({ slugAliases: 1 });

export default mongoose.model("Blog", blogSchema);
