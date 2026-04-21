import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import Blog from "../src/models/Blog.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "blogs");

/**
 * Helper to upload base64 to server storage
 * Refined to force .jpg extension for Sharp JPEG output
 */
async function uploadBase64(base64Str) {
  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z-+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const buffer = Buffer.from(matches[2], "base64");
    // Force .jpg extension for consistency with the .jpeg() output
    const filename = `${uuidv4()}.jpg`;
    const targetPath = path.join(UPLOADS_DIR, filename);

    // Ensure directory exists
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Process and compress using Sharp
    await sharp(buffer)
      .resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(targetPath);

    // Return the URL matching the /api/files/blogs/:filename route
    return `/api/files/blogs/${filename}`;
  } catch (error) {
    console.error(`  [ERROR] Sharp processing failed: ${error.message}`);
    return null;
  }
}

async function migrateBlogImages() {
  try {
    console.log("🚀 Starting Blog Image Migration...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to database.");

    const cursor = Blog.find({}).cursor();
    let totalScanned = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (let blog = await cursor.next(); blog != null; blog = await cursor.next()) {
      totalScanned++;
      let hasChanges = false;

      // 1. Handle featuredImage
      if (blog.featuredImage && blog.featuredImage.startsWith("data:image")) {
        console.log(`  [INFO] Migrating featuredImage for blog: ${blog._id}`);
        const url = await uploadBase64(blog.featuredImage);
        if (url) {
          blog.featuredImage = url;
          hasChanges = true;
        } else {
          totalFailed++;
        }
      }

      // 2. Handle images array (Refined: Parallel processing inside each blog)
      if (Array.isArray(blog.images) && blog.images.length > 0) {
        const migrationPromises = blog.images.map(async (img) => {
          if (typeof img === "string" && img.startsWith("data:image")) {
            console.log(`  [INFO] Migrating image array item for blog: ${blog._id}`);
            const url = await uploadBase64(img);
            if (url) {
              hasChanges = true;
              return url;
            }
            totalFailed++;
            return img; // Keep original if it fails
          }
          return img;
        });

        blog.images = await Promise.all(migrationPromises);
      }

      // 3. Save if changes made
      if (hasChanges) {
        // Tell Mongoose the array has changed to ensure it's persisted
        blog.markModified("images");
        
        try {
          await blog.save();
          totalUpdated++;
          console.log(`  [SUCCESS] Migrated blog: ${blog._id}`);
        } catch (saveError) {
          console.error(`  [ERROR] Failed to save blog ${blog._id}: ${saveError.message}`);
          // Fallback: Bypass validation if save fails due to schema rules
          console.log(`  [INFO] Attempting fallback update for blog: ${blog._id}`);
          await Blog.updateOne(
            { _id: blog._id },
            { $set: { images: blog.images, featuredImage: blog.featuredImage } }
          );
          totalUpdated++;
        }
      }
    }

    console.log("\n-------------------------");
    console.log(`📊 Migration Summary:`);
    console.log(`  Total Blogs Scanned: ${totalScanned}`);
    console.log(`  Total Blogs Updated: ${totalUpdated}`);
    console.log(`  Total Upload Failures: ${totalFailed}`);
    console.log("-------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed critical error:", error);
    process.exit(1);
  }
}

migrateBlogImages();
