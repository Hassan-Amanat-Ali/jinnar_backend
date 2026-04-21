import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Category from "../src/models/Category.js";
import SubCategory from "../src/models/SubCategory.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATEGORIES_FILE = path.resolve(__dirname, "..", "JINNAR MISSING CATEGORIES.txt");
const MONGO_URI = process.env.MONGO_URI;

const normalizeValue = (name = "") => name.trim().replace(/\s+/g, "-").toLowerCase();

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseCategoriesFile = (content) => {
  const categories = [];
  const lines = content.split(/\r?\n/);
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^Subcategories:$/i.test(line)) continue;

    const categoryMatch = line.match(/^\d+\.\s*(.+)$/);
    if (categoryMatch) {
      current = { name: categoryMatch[1].trim(), subs: [] };
      categories.push(current);
      continue;
    }

    if (line.startsWith("•") || line.startsWith("-")) {
      if (!current) continue;
      const sub = line.replace(/^[•-]\s*/, "").trim();
      if (sub) current.subs.push(sub);
    }
  }

  return categories;
};

const findCategory = async (name) => {
  const value = normalizeValue(name);
  return Category.findOne({
    $or: [
      { value },
      { name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, "i") } },
    ],
  });
};

const findSubCategory = async (name) => {
  const value = normalizeValue(name);
  return SubCategory.findOne({
    $or: [
      { value },
      { name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, "i") } },
    ],
  });
};

async function seed() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI environment variable is not set.");
  }

  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(MONGO_URI);
  try {
    const fileContent = await fs.readFile(CATEGORIES_FILE, "utf8");
    const parsedCategories = parseCategoriesFile(fileContent);

    if (!parsedCategories.length) {
      throw new Error(`No categories were parsed from ${CATEGORIES_FILE}`);
    }

    const summary = {
      categoriesCreated: 0,
      categoriesUpdated: 0,
      categoriesSkipped: 0,
      subcategoriesCreated: 0,
      subcategoriesUpdated: 0,
      subcategoriesSkipped: 0,
      subcategoriesConflicted: 0,
    };

    const seenSubcategoryValues = new Set();

    for (const cat of parsedCategories) {
      const normalizedCategoryValue = normalizeValue(cat.name);
      let category = await findCategory(cat.name);

      if (!category) {
        if (!dryRun) {
          category = await Category.create({ name: cat.name });
        } else {
          category = { _id: new mongoose.Types.ObjectId(), name: cat.name, value: normalizedCategoryValue };
        }
        summary.categoriesCreated += 1;
      } else {
        if ((category.value || "") !== normalizedCategoryValue) {
          summary.categoriesUpdated += 1;
          if (!dryRun) {
            category.value = normalizedCategoryValue;
            await category.save();
          }
        } else {
          summary.categoriesSkipped += 1;
        }
      }

      for (const subName of cat.subs) {
        const normalizedSubValue = normalizeValue(subName);

        if (seenSubcategoryValues.has(normalizedSubValue)) {
          summary.subcategoriesSkipped += 1;
          continue;
        }

        const existingSub = await findSubCategory(subName);

        if (existingSub) {
          seenSubcategoryValues.add(existingSub.value || normalizedSubValue);

          if (!existingSub.value || existingSub.value !== normalizedSubValue) {
            summary.subcategoriesUpdated += 1;
            if (!dryRun) {
              existingSub.value = normalizedSubValue;
              await existingSub.save();
            }
          } else {
            summary.subcategoriesSkipped += 1;
          }

          if (existingSub.categoryId?.toString() !== category._id?.toString()) {
            summary.subcategoriesConflicted += 1;
            console.warn(
              `Skipping duplicate subcategory "${subName}" under "${cat.name}" because it already exists under another category.`,
            );
          }

          continue;
        }

        seenSubcategoryValues.add(normalizedSubValue);
        summary.subcategoriesCreated += 1;

        if (!dryRun) {
          await SubCategory.create({
            name: subName,
            categoryId: category._id,
          });
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? "dry-run" : "apply",
          file: CATEGORIES_FILE,
          ...summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error("Category import failed:", error);
  process.exitCode = 1;
});
