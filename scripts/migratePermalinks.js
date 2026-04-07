import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Gig from "../src/models/Gig.js";
import Blog from "../src/models/Blog.js";
import User from "../src/models/User.js";
import {
  buildGigPermalink,
  toSlug,
  normalizeCountryFromAddress,
} from "../src/utils/permalink.js";
dotenv.config();
const isApplyMode = process.argv.includes("--apply");
const batchSize = 200;
const now = Date.now();
const reportPath = path.resolve(
  process.cwd(),
  `logs/permalink-migration-${now}${isApplyMode ? "" : "-dry-run"}.json`,
);
const migrateGigs = async () => {
  const sellerIds = await Gig.distinct("sellerId", { sellerId: { $ne: null } });
  const sellers = await User.find({ _id: { $in: sellerIds } }).select("country");
  const sellerMap = new Map(sellers.map((seller) => [seller._id.toString(), seller.country || ""]));
  const usedByCountry = new Map();
  const getUniqueServiceSlug = (countrySlug, baseSlug) => {
    const used = usedByCountry.get(countrySlug) || new Set();
    if (!usedByCountry.has(countrySlug)) usedByCountry.set(countrySlug, used);
    if (!used.has(baseSlug)) {
      used.add(baseSlug);
      return baseSlug;
    }
    let counter = 2;
    let candidate = `${baseSlug}-${counter}`;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }
    used.add(candidate);
    return candidate;
  };
  const gigs = await Gig.find({}).select("title address sellerId countrySlug serviceSlug permalinkAliases");
  const updates = [];
  const stats = { scanned: gigs.length, changed: 0, skipped: 0, examples: [] };
  for (const gig of gigs) {
    const sellerCountry = sellerMap.get(String(gig.sellerId)) || "";
    const nextCountrySlug = toSlug(
      sellerCountry || normalizeCountryFromAddress(gig.address) || "global",
      "global",
    );
    const nextServiceSlug = getUniqueServiceSlug(nextCountrySlug, toSlug(gig.title, "service"));
    const previousPermalink =
      gig.countrySlug && gig.serviceSlug
        ? buildGigPermalink({ countrySlug: gig.countrySlug, serviceSlug: gig.serviceSlug })
        : null;
    const nextPermalink = buildGigPermalink({ countrySlug: nextCountrySlug, serviceSlug: nextServiceSlug });
    const changed = gig.countrySlug !== nextCountrySlug || gig.serviceSlug !== nextServiceSlug;
    if (!changed) {
      stats.skipped += 1;
      continue;
    }
    const nextAliases = new Set(gig.permalinkAliases || []);
    if (previousPermalink && previousPermalink !== nextPermalink) nextAliases.add(previousPermalink);
    stats.changed += 1;
    if (stats.examples.length < 10) {
      stats.examples.push({ gigId: String(gig._id), from: previousPermalink, to: nextPermalink });
    }
    updates.push({
      updateOne: {
        filter: { _id: gig._id },
        update: {
          $set: {
            countrySlug: nextCountrySlug,
            serviceSlug: nextServiceSlug,
            permalinkAliases: [...nextAliases],
          },
        },
      },
    });
  }
  if (isApplyMode && updates.length) {
    for (let i = 0; i < updates.length; i += batchSize) {
      await Gig.bulkWrite(updates.slice(i, i + batchSize), { ordered: false });
    }
  }
  return stats;
};
const migrateBlogs = async () => {
  const blogs = await Blog.find({}).select("title slug slugAliases").sort({ _id: 1 });
  const used = new Set();
  const updates = [];
  const stats = { scanned: blogs.length, changed: 0, skipped: 0, examples: [] };
  for (const blog of blogs) {
    const baseSlug = toSlug(blog.slug || blog.title, "post");
    let nextSlug = baseSlug;
    let counter = 2;
    while (used.has(nextSlug)) {
      nextSlug = `${baseSlug}-${counter}`;
      counter += 1;
    }
    used.add(nextSlug);
    if (blog.slug === nextSlug) {
      stats.skipped += 1;
      continue;
    }
    const nextAliases = new Set((blog.slugAliases || []).map((alias) => toSlug(alias, "post")));
    if (blog.slug && blog.slug !== nextSlug) nextAliases.add(toSlug(blog.slug, "post"));
    stats.changed += 1;
    if (stats.examples.length < 10) {
      stats.examples.push({ blogId: String(blog._id), from: blog.slug, to: nextSlug });
    }
    updates.push({
      updateOne: {
        filter: { _id: blog._id },
        update: {
          $set: {
            slug: nextSlug,
            slugAliases: [...nextAliases],
          },
        },
      },
    });
  }
  if (isApplyMode && updates.length) {
    for (let i = 0; i < updates.length; i += batchSize) {
      await Blog.bulkWrite(updates.slice(i, i + batchSize), { ordered: false });
    }
  }
  return stats;
};
const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
  await mongoose.connect(process.env.MONGO_URI);
  const report = {
    mode: isApplyMode ? "apply" : "dry-run",
    startedAt: new Date().toISOString(),
    gigs: await migrateGigs(),
    blogs: await migrateBlogs(),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Permalink migration (${report.mode}) completed.`);
  console.log(`Report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
};
run().catch(async (error) => {
  console.error("Permalink migration failed:", error?.message || error);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
