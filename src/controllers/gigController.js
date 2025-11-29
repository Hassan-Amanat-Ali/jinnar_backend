import Gig from "../models/Gig.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import SubCategory from "../models/SubCategory.js";
import Order from "../models/Order.js";
import { sendNotification } from "./notificationController.js";

export const searchGigs = async (req, res) => {
  try {
    const { 
      search,       
      category,
      subcategory, // New filter
      minPrice, 
      maxPrice, 
      pricingMethod,
      // NEW: Location Parameters
      latitude,
      longitude,
      radius // in Kilometers
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1. Build Base Query
    const query = { status: "active" }; 
    const orConditions = [];
    // ---------------------------------------------------------
    // 2. LOCATION FILTER (The Logic Change)
    // ---------------------------------------------------------
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const dist = parseFloat(radius) || 10; // Default to 10km if not sent

      // We must find SELLERS who are within the range first.
      // We query the 'User' collection because that is where 'selectedAreas' lives.
      const sellersInArea = await User.find({
        selectedAreas: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat] // MongoDB expects [Longitude, Latitude]
            },
            $maxDistance: dist * 1000 // Convert km to meters
          }
        }
      }).select('_id'); // We only need their IDs

      // Extract IDs into a simple array
      const sellerIds = sellersInArea.map(user => user._id);

      // Add to Gig Query: "Only show gigs where the seller is in this list"
      query.sellerId = { $in: sellerIds };
    }
    // ---------------------------------------------------------

    // 3. Text Search
    if (search) {
      orConditions.push(
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      );
    }

    // 4. Category Filter 
    if (category) {
      query.category = category;
    }

    // New: Subcategory Filter
    if (subcategory) {
      orConditions.push(
        { primarySubcategory: subcategory },
        { extraSubcategories: subcategory }
      );
    }

    // Combine OR conditions if any exist
    if (orConditions.length > 0) query.$or = orConditions;

    // 5. Price Filter
    if (minPrice || maxPrice) {
      query["pricing.price"] = {};
      if (minPrice) query["pricing.price"].$gte = Number(minPrice);
      if (maxPrice) query["pricing.price"].$lte = Number(maxPrice);
    }
    
    // 6. Pricing Method Filter
    if (pricingMethod) {
      query["pricing.method"] = pricingMethod;
    }

    // Execute Query
    const gigs = await Gig.find(query)
      .populate("sellerId", "name profilePicture rating") 
      .populate("category", "name icon") 
      .populate("primarySubcategory", "name")
      .populate("extraSubcategories", "name")
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit);

    const total = await Gig.countDocuments(query);

    res.json({
      gigs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    res.status(500).json({ error: "Search failed", details: error.message });
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
      images,
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
      images: Array.isArray(images)
        ? images.map((url) => ({ url, publicId: null }))
        : [],
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
      images,
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
    if (Array.isArray(images)) {
      gig.images = images.map((url) => ({ url, publicId: null }));
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
