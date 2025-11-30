import Gig from "../models/Gig.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import Order from "../models/Order.js";
import { sendNotification } from "./notificationController.js";

export const searchGigs = async (req, res) => {
  try {
    const { 
      search, category, subcategory, minPrice, maxPrice, pricingMethod,
      minRating, minExperience, sortBy,
      latitude, longitude, radius
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { status: "active" };
    const orConditions = [];

    // TEXT SEARCH
    if (search) {
      orConditions.push(
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      );
    }

    // CATEGORY (by name or ID)
    if (category) {
      let categoryDoc;
      // Check if the provided category is a valid MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryDoc = await Category.findById(category);
      } else {
        // If not, assume it's a name and search by name
        categoryDoc = await Category.findOne({ name: { $regex: `^${category}$`, $options: 'i' } });
      }
      if (categoryDoc) query.category = categoryDoc._id;
    }

    // SUBCATEGORY (by name or ID)
    if (subcategory) {
      const subCategoryDoc = await SubCategory.findOne({
        $or: [
          { _id: subcategory },
          { name: { $regex: `^${subcategory}$`, $options: 'i' } }
        ]
      });
      if (subCategoryDoc) {
        orConditions.push(
          { primarySubcategory: subCategoryDoc._id },
          { extraSubcategories: subCategoryDoc._id }
        );
      }
    }

    // PRICE RANGE
    if (minPrice || maxPrice) {
      query["pricing.price"] = {};
      if (minPrice) query["pricing.price"].$gte = Number(minPrice);
      if (maxPrice) query["pricing.price"].$lte = Number(maxPrice);
    }

    // PRICING METHOD
    if (pricingMethod) query["pricing.method"] = pricingMethod;

    // LOCATION FILTER
    // if (latitude && longitude) {
    //   const sellers = await User.find({
    //     selectedAreas: {
    //       $near: {
    //         $geometry: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
    //         $maxDistance: (radius || 10) * 1000
    //       }
    //     }
    //   }).select("_id");

    //   query.sellerId = { $in: sellers.map(s => s._id) };
    // }

    if (orConditions.length > 0) query.$or = orConditions;

    // Get total count for pagination before applying skip/limit
    const totalGigs = await Gig.countDocuments(query);

    // FETCH GIGS with populated fields
    let gigs = await Gig.find(query)
      .populate("sellerId", "rating yearsOfExperience name bio skills")
      .populate("category", "name")
      .populate("primarySubcategory", "_id name")
      .populate("extraSubcategories", "_id name")
      .skip(skip)
      .limit(limit);

    // Replace subcategories array with objects containing name and id
    gigs = gigs.map(gig => {
      const primary = gig.primarySubcategory ? { _id: gig.primarySubcategory._id, name: gig.primarySubcategory.name } : null;
      const extras = gig.extraSubcategories ? gig.extraSubcategories.map(s => ({ _id: s._id, name: s.name })) : [];
      return {
        ...gig.toObject(),
        subcategories: primary ? [primary, ...extras] : extras
      };
    });

    // FILTER BY RATING (Post-query)
    if (minRating) {
      gigs = gigs.filter(g => (g.sellerId?.rating?.average || 0) >= Number(minRating));
    }

    // FILTER BY EXPERIENCE (Post-query)
    if (minExperience) {
      gigs = gigs.filter(g => (g.sellerId?.yearsOfExperience || 0) >= Number(minExperience));
    }

    // SORTING
    if (sortBy) {
      switch (sortBy) {
        case "rating":
          gigs.sort((a, b) => (b.sellerId?.rating?.average || 0) - (a.sellerId?.rating?.average || 0));
          break;
        case "experience":
          gigs.sort((a, b) => (b.sellerId?.yearsOfExperience || 0) - (a.sellerId?.yearsOfExperience || 0));
          break;
        case "price_low":
          gigs.sort((a, b) => (a.pricing?.price || 0) - (b.pricing?.price || 0));
          break;
        case "price_high":
          gigs.sort((a, b) => (b.pricing?.price || 0) - (a.pricing?.price || 0));
          break;
        case "newest":
          gigs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
      }
    }

    res.json({
      gigs,
      pagination: {
        page,
        limit,
        total: totalGigs,
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err.message });
  }
};


export const createGig = async (req, res, next) => {
  try {
    const { id, role } = req.user; // From JWT middleware
    const {
      title,
      description,
      pricingMethod,
      price,
      categoryId,
      primarySubcategory,
      extraSubcategories = [], // Default to empty array
    } = req.body;

    // ✅ Validate role
    if (role !== "seller") {
      return res.status(403).json({ error: "Only sellers can create gigs" });
    }

    // ✅ Find and verify user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: "User not verified" });
    }

    // ✅ Validate input
    if (!title || !description || !pricingMethod || !categoryId || !primarySubcategory) {
      return res
        .status(400)
        .json({ error: "Title, description, pricing method, category, and primary subcategory are required" });
    }

    // ✅ Validate Subcategories belong to the main Category
    const allSubcategoryIds = [primarySubcategory, ...extraSubcategories];
    const uniqueSubcategoryIds = [...new Set(allSubcategoryIds)];

    const subcategories = await SubCategory.find({
      _id: { $in: uniqueSubcategoryIds },
    }).select('categoryId');

    if (subcategories.length !== uniqueSubcategoryIds.length) {
      return res.status(400).json({ error: "One or more subcategories are invalid." });
    }

    const areSubcategoriesValid = subcategories.every(
      (sub) => sub.categoryId.toString() === categoryId
    );

    if (!areSubcategoriesValid) {
      return res.status(400).json({
        error: "All selected subcategories must belong to the chosen main category.",
      });
    }

    if (extraSubcategories.includes(primarySubcategory)) {
      return res.status(400).json({
        error: "Primary subcategory cannot also be in the extra subcategories list.",
      });
    }
    if (!["fixed", "hourly", "negotiable"].includes(pricingMethod)) {
      return res
        .status(400)
        .json({ error: "Pricing method must be fixed, hourly, or negotiable" });
    }
    if (pricingMethod !== "negotiable" && (price === undefined || price < 0)) {
      return res
        .status(400)
        .json({
          error:
            "Price is required for fixed or hourly pricing and cannot be negative",
        });
    }

    // ✅ Create gig
    const gig = new Gig({
      sellerId: id,
      title,
      description,
      pricing: {
        method: pricingMethod,
        price: pricingMethod === "negotiable" ? undefined : price,
      },
      // ✅ Use the URL from the uploaded file middleware
      images: req.files ? req.files.map(file => ({ url: file.url })) : [],
      category: categoryId,
      primarySubcategory: primarySubcategory,
      extraSubcategories: extraSubcategories,
    }); 

    await gig.save();
    await gig.populate("sellerId", "name bio skills");

    res.status(201).json({
      message: "Gig created successfully",
      gig,
    });
  } catch (error) {
    console.error("Create Gig Error:", error.message);
    next(error);
  }
};

export const getAllGigs = async (req, res, next) => {
  try {
    const { pricingMethod, minPrice, maxPrice, title } = req.query;

    // -------------------------
    // Build Query
    // -------------------------
    const query = {};

    if (pricingMethod) {
      query["pricing.method"] = pricingMethod;
    }

    if (minPrice || maxPrice) {
      query["pricing.price"] = {};
      if (minPrice) query["pricing.price"].$gte = Number(minPrice);
      if (maxPrice) query["pricing.price"].$lte = Number(maxPrice);
    }

    if (title) {
      query.title = { $regex: title, $options: "i" }; // Case-insensitive search
    }

    // -------------------------
    // Fetch Gigs & Seller Info
    // -------------------------
    const gigs = await Gig.find(query).populate(
      "sellerId",
      "name bio skills yearsOfExperience rating",
    );

    // -------------------------
    // Append Orders Completed per Seller
    // -------------------------
    const sellerIds = gigs.map((g) => g.sellerId?._id);

    // Count completed orders for all sellers at once
    const completedOrders = await Order.aggregate([
      { $match: { sellerId: { $in: sellerIds }, status: "completed" } },
      { $group: { _id: "$sellerId", count: { $sum: 1 } } },
    ]);

    // Convert to lookup map
    const orderCountMap = {};
    completedOrders.forEach((entry) => {
      orderCountMap[entry._id.toString()] = entry.count;
    });

    // Inject into gig objects
    const enrichedGigs = gigs.map((gig) => {
      const seller = gig.sellerId;
      const ordersCompleted = orderCountMap[seller._id.toString()] || 0;

      return {
        ...gig.toObject(),
        sellerId: {
          ...seller.toObject(),
          ordersCompleted, // 👈 added
          yearsOfExperience: seller.yearsOfExperience || 0, // already in schema
        },
      };
    });

    res.json({ gigs: enrichedGigs });
  } catch (error) {
    console.error("Get Gigs Error:", error.message);
    next(error);
  }
};

// ✅ NEW: GET MY GIGS (Add this)
export const getMyGigs = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role !== "seller") {
      return res
        .status(403)
        .json({ error: "Only sellers can view their gigs" });
    }

    const gigs = await Gig.find({ sellerId: id })
      .populate("sellerId", "name bio skills")
      .sort({ createdAt: -1 });

    res.json({ gigs });
  } catch (error) {
    console.error("Get My Gigs Error:", error.message);
    next(error);
  }
};

export const updateGig = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const {
      title,
      description,
      pricingMethod,
      price,
      primarySubcategory,
      extraSubcategories,
    } = req.body;

    if (role !== "seller") {
      return res.status(403).json({ error: "Only sellers can update gigs" });
    }

    const gig = await Gig.findOne({ _id: req.params.id, sellerId: id });
    if (!gig) {
      return res.status(404).json({ error: "Gig not found" });
    }

    // ✅ BASIC FIELDS
    if (title !== undefined) gig.title = title;
    if (description !== undefined) gig.description = description;

    // ✅ SUBCATEGORY VALIDATION (if they are being updated)
    if (primarySubcategory || extraSubcategories) {
      const newPrimary = primarySubcategory || gig.primarySubcategory;
      const newExtras = extraSubcategories || gig.extraSubcategories;

      if (newExtras.includes(newPrimary.toString())) {
        return res.status(400).json({
          error: "Primary subcategory cannot also be in the extra subcategories list.",
        });
      }

      const allSubcategoryIds = [...new Set([newPrimary, ...newExtras])];
      const subcategories = await SubCategory.find({
        _id: { $in: allSubcategoryIds },
      }).select('categoryId');

      if (subcategories.length !== allSubcategoryIds.length) {
        return res.status(400).json({ error: "One or more subcategories are invalid." });
      }

      const areSubcategoriesValid = subcategories.every(
        (sub) => sub.categoryId.toString() === gig.category.toString()
      );

      if (!areSubcategoriesValid) {
        return res.status(400).json({
          error: "All selected subcategories must belong to the gig's main category.",
        });
      }

      // If validation passes, update the fields
      if (primarySubcategory) gig.primarySubcategory = primarySubcategory;
      if (extraSubcategories) gig.extraSubcategories = extraSubcategories;
    }

    // ✅ PRICING
    if (pricingMethod !== undefined) {
      gig.pricing.method = pricingMethod;
      if (pricingMethod === "negotiable") {
        gig.pricing.price = undefined;
      } else if (price !== undefined) {
        if (price < 0) {
          return res.status(400).json({ error: "Price cannot be negative" });
        }
        gig.pricing.price = price;
      }
    }

    // ✅ IMAGES (raw JSON array of URLs)
    // ✅ Update image if a new one was uploaded
    if (req.files && req.files.length > 0) {
      // This will replace all existing images with the new ones.
      // For appending, use the dedicated /upload/gig-image/:gigId route.
      gig.images = req.files.map(file => ({ url: file.url }));
    }

    await gig.save();
    await gig.populate("sellerId", "name bio skills");

    res.json({
      message: "Gig updated successfully",
      gig,
    });
  } catch (error) {
    console.error("Update Gig Error:", error.message);
    next(error);
  }
};

export const getGigById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const gig = await Gig.findById(id).populate(
    "sellerId",
    "name profilePicture",
  );

  if (!gig) {
    return res.status(404).json({ success: false, message: "Gig not found" });
  }

  res.json({ success: true, gig });
});

// ✅ NEW: DELETE GIG (Add this)
export const deleteGig = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role !== "seller") {
      return res.status(403).json({ error: "Only sellers can delete gigs" });
    }

    // ✅ Check for active orders before deleting
    const activeOrders = await Order.find({
      gigId: req.params.id,
      sellerId: id,
      status: { $in: ["pending", "offer_pending", "accepted"] },
    });

    if (activeOrders.length > 0) {
      return res
        .status(400)
        .json({ error: "Cannot delete a gig with active orders. Please resolve or cancel them first." });
    }
    const gig = await Gig.findOneAndDelete({
      _id: req.params.id,
      sellerId: id,
    });
    if (!gig) {
      return res.status(404).json({ error: "Gig not found" });
    }

    res.json({ message: "Gig deleted successfully" });
  } catch (error) {
    console.error("Delete Gig Error:", error.message);
    next(error);
  }
};
