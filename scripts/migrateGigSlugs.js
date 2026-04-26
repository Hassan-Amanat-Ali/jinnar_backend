import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Gig from "../src/models/Gig.js";
import { toSlug } from "../src/utils/permalink.js";

dotenv.config();

const isApplyMode = process.argv.includes("--apply");
const batchSize = 100;
const now = Date.now();
const reportPath = path.resolve(
  process.cwd(),
  `logs/gig-slug-migration-${now}${isApplyMode ? "" : "-dry-run"}.json`,
);

const migrateGigs = async () => {
  const gigs = await Gig.find({ slug: { $exists: false } }).select("title _id");
  
  if (gigs.length === 0) {
    console.log("No gigs found without slugs. Migration skipped.");
    return { scanned: 0, changed: 0, skipped: 0, examples: [] };
  }

  const updates = [];
  const stats = { scanned: gigs.length, changed: 0, skipped: 0, examples: [] };
  const usedSlugs = new Set();

  // Also fetch existing slugs to avoid collisions
  const existingSlugs = await Gig.distinct("slug", { slug: { $ne: null } });
  existingSlugs.forEach(s => usedSlugs.add(s));

  for (const gig of gigs) {
    const baseSlug = toSlug(gig.title, "gig");
    let uniqueSlug = baseSlug;
    let counter = 2;

    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    usedSlugs.add(uniqueSlug);
    stats.changed += 1;

    if (stats.examples.length < 10) {
      stats.examples.push({ gigId: String(gig._id), title: gig.title, slug: uniqueSlug });
    }

    updates.push({
      updateOne: {
        filter: { _id: gig._id },
        update: { $set: { slug: uniqueSlug } },
      },
    });
  }

  if (isApplyMode && updates.length) {
    console.log(`Applying ${updates.length} updates...`);
    for (let i = 0; i < updates.length; i += batchSize) {
      await Gig.bulkWrite(updates.slice(i, i + batchSize), { ordered: false });
    }
  }

  return stats;
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB for ${isApplyMode ? "APPLY" : "DRY-RUN"} mode.`);

  const report = {
    mode: isApplyMode ? "apply" : "dry-run",
    startedAt: new Date().toISOString(),
    gigs: await migrateGigs(),
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`\nGig Slug Migration (${report.mode}) completed.`);
  console.log(`Report saved to: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migration failed:", error?.message || error);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
