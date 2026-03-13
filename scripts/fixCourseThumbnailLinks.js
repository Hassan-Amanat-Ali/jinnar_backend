import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Course from "../src/models/Course.js";

dotenv.config();

const TARGET_PREFIX = "thumbnails/";
const isDryRun = !process.argv.includes("--apply");

function normalizeThumbnailUrl(rawValue) {
  if (typeof rawValue !== "string") return null;

  const original = rawValue.trim();
  if (!original) return null;
  if (original === "default-course.jpg") return original;

  let value = original.replace(/\\/g, "/");

  // Strip host when the field contains an absolute URL.
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      value = parsed.pathname;
    } catch {
      value = value.replace(/^https?:\/\/[^/]+/i, "");
    }
  }

  value = value.split("?")[0].split("#")[0].replace(/\/{2,}/g, "/");

  // Already in desired format.
  if (value.startsWith(TARGET_PREFIX) && path.basename(value)) {
    return `${TARGET_PREFIX}${path.basename(value)}`;
  }

  const filename = path.basename(value);
  if (!filename || filename === "/" || filename === ".") return null;

  return `${TARGET_PREFIX}${filename}`;
}

async function run() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in environment variables.");
  }

  await mongoose.connect(mongoUri);

  const courses = await Course.find({
    thumbnail: { $exists: true, $type: "string", $ne: "" },
  })
    .select("_id title thumbnail")
    .lean();

  const updates = [];
  const changes = [];

  for (const course of courses) {
    const normalized = normalizeThumbnailUrl(course.thumbnail);
    if (!normalized || normalized === course.thumbnail) continue;

    updates.push({
      updateOne: {
        filter: { _id: course._id },
        update: { $set: { thumbnail: normalized } },
      },
    });

    changes.push({
      id: String(course._id),
      title: course.title,
      before: course.thumbnail,
      after: normalized,
    });
  }

  const reportDir = path.resolve(process.cwd(), "logs");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(
    reportDir,
    `thumbnail-path-fix-${Date.now()}${isDryRun ? "-dry-run" : ""}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(changes, null, 2));

  if (isDryRun) {
    console.log(`Dry run complete. ${changes.length} course thumbnails need updates.`);
    console.log(`Report: ${reportPath}`);
  } else if (updates.length > 0) {
    const result = await Course.bulkWrite(updates, { ordered: false });
    console.log(`Updated ${result.modifiedCount} course thumbnails.`);
    console.log(`Report: ${reportPath}`);
  } else {
    console.log("No thumbnail URLs needed changes.");
    console.log(`Report: ${reportPath}`);
  }

  await mongoose.disconnect();
}

run()
  .catch(async (error) => {
    console.error("Failed to fix course thumbnail links:", error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore disconnect errors on failure paths
    }
    process.exitCode = 1;
  });
