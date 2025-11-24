import FAQ from "../models/Faq.js";
import { botService } from "../services/BotService.js";

// ───────────────────────────────────────
// ADMIN APIs (Protected)
// ───────────────────────────────────────

/**
 * @description Create a new FAQ entry
 * @route POST /api/admin/help
 */
export const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, targetAudience, priority } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ error: "Question and Answer are required" });
    }

    const faq = await FAQ.create({
      question,
      answer,
      category,
      targetAudience,
      priority: priority || 0,
    });
    botService.train(); // <--- Retrain the bot with the new FAQ
    res.status(201).json({ message: "FAQ created successfully", faq });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create FAQ", details: error.message });
  }
};

/**
 * @description Update an existing FAQ
 * @route PATCH /api/admin/help/:id
 */
export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const faq = await FAQ.findByIdAndUpdate(id, updates, { new: true });

    if (!faq) return res.status(404).json({ error: "FAQ not found" });

    botService.train(); // <--- Retrain the bot after an update

    res.json({ message: "FAQ updated successfully", faq });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update FAQ", details: error.message });
  }
};

/**
 * @description Delete an FAQ
 * @route DELETE /api/admin/help/:id
 */
export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await FAQ.findByIdAndDelete(id);

    if (!faq) return res.status(404).json({ error: "FAQ not found" });

    botService.train(); // <--- Retrain the bot after a deletion

    res.json({ message: "FAQ deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to delete FAQ", details: error.message });
  }
};

/**
 * @description Get ALL FAQs (for Admin Dashboard table)
 * Includes inactive ones.
 * @route GET /api/admin/help
 */
export const getAllFAQsAdmin = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ createdAt: -1 });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ───────────────────────────────────────
// PUBLIC APIs (Mobile App/Frontend)
// ───────────────────────────────────────

/**
 * @description Fetch FAQs for the Help Center Screen
 * Filters by role (buyer/seller) and returns only active ones.
 * @route GET /api/help
 */
export const getPublicFAQs = async (req, res) => {
  try {
    const { role, category } = req.query; // e.g. ?role=seller&category=Payments

    const query = { isActive: true };

    // Filter by role (if I am a buyer, show 'all' + 'buyer')
    if (role) {
      query.targetAudience = { $in: ["all", role] };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    const faqs = await FAQ.find(query).sort({ priority: -1, createdAt: -1 }); // Show high priority first

    res.json(faqs);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch FAQs", details: error.message });
  }
};

/**
 * @description Bulk insert multiple FAQs
 * @route POST /api/admin/help/bulk
 */
export const bulkCreateFAQs = async (req, res) => {
  try {
    const { faqs } = req.body;

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return res.status(400).json({ error: "faqs must be a non-empty array" });
    }

    // Ensure each FAQ has required fields
    const cleanedFAQs = faqs.map((f) => ({
      question: f.question,
      answer: f.answer,
      category: f.category || null,
      targetAudience: f.targetAudience || "all",
      priority: f.priority || 0,
      isActive: f.isActive !== undefined ? f.isActive : true,
    }));

    const created = await FAQ.insertMany(cleanedFAQs);

    botService.train(); // <--- Retrain the bot after bulk creation

    res.status(201).json({
      message: `${created.length} FAQs created successfully`,
      faqs: created,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to bulk create FAQs", details: error.message });
  }
};
