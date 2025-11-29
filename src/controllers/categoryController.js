import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";

/**
 * @description Get all active categories
 * @route GET /api/categories
 * @access Public
 */
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories", details: error.message });
  }
};

/**
 * @description Get all active subcategories, optionally filtered by categoryId
 * @route GET /api/categories/subcategories
 * @access Public
 */
export const getAllSubcategories = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.categoryId) {
      filter.categoryId = req.query.categoryId;
    }
    const subCategories = await SubCategory.find(filter).sort({ name: 1 });
    res.json(subCategories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subcategories", details: error.message });
  }
};