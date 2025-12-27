import Gig from "../models/Gig.js";
import User from "../models/User.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";
import Order from "../models/Order.js";
import { sendNotification } from "./notificationController.js";
import { getCoordinatesFromAddress } from "../utils/geocoding.js";

export const searchGigs = async (req, res) => {
  try {
    const { 
      search, category, subcategory, minPrice, maxPrice, pricingMethod,
      minRating, minExperience, sortBy,
      lat, lng, radius 
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [];

    // --- STAGE 1: GEO-SPATIAL SEARCH ---
    // MUST be the very first stage if lat/lng are present
    if (lat && lng) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "distance", // Output field for distance (in meters)
          maxDistance: (parseFloat(radius) || 10000000) * 1000, // Convert km to meters
          key: "location", // The index key
          spherical: true,
          // Optimization: Apply status check inside geoNear to reduce initial set
          query: { status: "active" } 
        },
      });
    } else {
      // If no Geo search, we must manually filter for active gigs first
      pipeline.push({ $match: { status: "active" } });
    }

    // --- STAGE 2: BUILD MAIN MATCH CONDITIONS ---
    const matchConditions = {};
    const orConditions = [];

    // Text Search
    if (search) {
      orConditions.push(
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      );
    }

    // Category (Handle ID or Name)
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        matchConditions.category = new mongoose.Types.ObjectId(category);
      } else {
        const catDoc = await Category.findOne({ name: { $regex: `^${category}$`, $options: 'i' } });
        if (catDoc) matchConditions.category = catDoc._id;
      }
    }

    // Subcategory (Handle ID or Name)
    if (subcategory) {
      let subCatId = null;
      if (mongoose.Types.ObjectId.isValid(subcategory)) {
        subCatId = new mongoose.Types.ObjectId(subcategory);
      } else {
        const subDoc = await SubCategory.findOne({ name: { $regex: `^${subcategory}$`, $options: 'i' } });
        if (subDoc) subCatId = subDoc._id;
      }

      if (subCatId) {
        orConditions.push(
          { primarySubcategory: subCatId },
          { extraSubcategories: subCatId }
        );
      }
    }

    // Price Filter
    if (minPrice || maxPrice) {
      matchConditions["pricing.price"] = {};
      if (minPrice) matchConditions["pricing.price"].$gte = Number(minPrice);
      if (maxPrice) matchConditions["pricing.price"].$lte = Number(maxPrice);
    }

    // Pricing Method
    if (pricingMethod) {
      matchConditions["pricing.method"] = pricingMethod;
    }

    // Attach $or conditions if they exist
    if (orConditions.length > 0) {
      matchConditions.$or = orConditions;
    }

    // Apply the Match Stage (Only if we have conditions)
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // --- STAGE 3: JOIN SELLER (USERS) ---
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "sellerId",
          foreignField: "_id",
          as: "sellerInfo",
        },
      },
{
  $unwind: {
    path: "$sellerInfo",
    preserveNullAndEmptyArrays: true
  }
}
    );

    // --- STAGE 4: FILTER BY SELLER STATS ---
    const sellerMatch = {};
    if (minRating) {
      sellerMatch["sellerInfo.rating.average"] = { $gte: Number(minRating) };
    }
    if (minExperience) {
      sellerMatch["sellerInfo.yearsOfExperience"] = { $gte: Number(minExperience) };
    }
    
    if (Object.keys(sellerMatch).length > 0) {
      pipeline.push({ $match: sellerMatch });
    }

    // --- STAGE 5: LOOKUP CATEGORY NAMES (For Display) ---
    pipeline.push(
      { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "categoryData" } },
      { $unwind: { path: "$categoryData", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "subcategories", localField: "primarySubcategory", foreignField: "_id", as: "primarySubData" } },
      { $unwind: { path: "$primarySubData", preserveNullAndEmptyArrays: true } }
    );

    // --- STAGE 6: SORTING ---
    // Note: $geoNear automatically sorts by distance. 
    // This stage OVERRIDES distance sort if a user selects something else.
    let sortStage = {};
    
    // Default sort
    sortStage = { createdAt: -1 }; 

    if (sortBy) {
      switch (sortBy) {
        case "rating":
          sortStage = { "sellerInfo.rating.average": -1 };
          break;
        case "experience":
          sortStage = { "sellerInfo.yearsOfExperience": -1 };
          break;
        case "price_low":
          sortStage = { "pricing.price": 1 };
          break;
        case "price_high":
          sortStage = { "pricing.price": -1 };
          break;
        case "newest":
          sortStage = { createdAt: -1 };
          break;
        case "distance":
          // If sorting by distance, we rely on $geoNear's inherent sort order.
          // However, if we need to force it (and geoNear was used), we use the distance field.
          if (lat && lng) sortStage = { distance: 1 };
          break;
      }
    }
    
    pipeline.push({ $sort: sortStage });

    // --- STAGE 7: PAGINATION & PROJECTION ---
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              title: 1,
              description: 1,
              pricing: 1,
              images: 1,
              status: 1,
              createdAt: 1,
              distance: 1, // Will be null if geo search wasn't used
              "sellerId._id": "$sellerInfo._id",
              "sellerId.name": "$sellerInfo.name",
              "sellerId.rating": "$sellerInfo.rating",
              "sellerId.yearsOfExperience": "$sellerInfo.yearsOfExperience",
              "sellerId.bio": "$sellerInfo.bio",
              "category": { _id: "$categoryData._id", name: "$categoryData.name" },
              "primarySubcategory": { _id: "$primarySubData._id", name: "$primarySubData.name" }
            }
          }
        ],
      },
    });

    // --- EXECUTE ---
    const result = await Gig.aggregate(pipeline);

    // Format output
    const gigs = result[0].data;
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

    res.json({
      gigs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("Search Gigs Error:", err);
    res.status(500).json({ error: "Search failed", details: err.message });
  }
};

export const createGig = async (req, res, next) => {
  try {
    const { id, role } = req.user; // From JWT middleware
    const {
      title,
      description,
      // New pricing structure
      fixedEnabled,
      fixedPrice,
      hourlyEnabled,
      hourlyRate,
      minHours,
      inspectionEnabled,
      categoryId,
      primarySubcategory,
      extraSubcategories = [], // Default to empty array
      address, // Add address here
    } = req.body;

    // ... existing validation ...

    // Handle address and geocoding
    let location = null;
    if (address) {
        try {
            const geocodedLocation = await getCoordinatesFromAddress(address);
            location = {
                type: "Point",
                coordinates: [geocodedLocation.lng, geocodedLocation.lat],
            };
            console.log("Address geocoded for gig:", location);
        } catch (geocodeError) {
            console.error("Geocoding failed for gig address:", address, geocodeError);
            return res.status(500).json({ error: "Failed to geocode gig address" });
        }
    }

    // ✅ Create gig with new pricing structure
    const gig = new Gig({
      sellerId: id,
      title,
      description,
      pricing: {
        fixed: {
          enabled: fixedEnabled || false,
          price: fixedEnabled ? fixedPrice : undefined,
        },
        hourly: {
          enabled: hourlyEnabled || false,
          rate: hourlyEnabled ? hourlyRate : undefined,
          minHours: hourlyEnabled && minHours ? minHours : undefined,
        },
        inspection: {
          enabled: inspectionEnabled !== undefined ? inspectionEnabled : true,
        },
      },
      address, // Add address
      location, // Add location
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
      // New pricing structure
      fixedEnabled,
      fixedPrice,
      hourlyEnabled,
      hourlyRate,
      minHours,
      inspectionEnabled,
      primarySubcategory,
      extraSubcategories,
      address,
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

    // ✅ ADDRESS & GEOCODING
    if (address !== undefined) {
        if (typeof address !== "string" || address.trim().length === 0) {
            return res.status(400).json({ error: "Address must be a non-empty string" });
        }
        gig.address = address.trim();
        try {
            const geocodedLocation = await getCoordinatesFromAddress(address);
            if (geocodedLocation) {
                gig.location = {
                    type: "Point",
                    coordinates: [geocodedLocation.lng, geocodedLocation.lat],
                };
                console.log("Address geocoded for gig update:", gig.location);
            } else {
                gig.location = null; // Clear location if geocoding fails
                console.warn("Geocoding returned no coordinates for updated address:", address);
            }
        } catch (geocodeError) {
            console.error("Geocoding failed for updated gig address:", address, geocodeError);
            return res.status(500).json({ error: "Failed to geocode gig address" });
        }
    }

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

    // ✅ PRICING - New multi-option structure
    // Update fixed pricing
    if (fixedEnabled !== undefined) {
      gig.pricing.fixed.enabled = fixedEnabled;
      if (fixedEnabled && fixedPrice !== undefined) {
        gig.pricing.fixed.price = fixedPrice;
      }
    } else if (fixedPrice !== undefined && gig.pricing.fixed.enabled) {
      gig.pricing.fixed.price = fixedPrice;
    }

    // Update hourly pricing
    if (hourlyEnabled !== undefined) {
      gig.pricing.hourly.enabled = hourlyEnabled;
      if (hourlyEnabled) {
        if (hourlyRate !== undefined) gig.pricing.hourly.rate = hourlyRate;
        if (minHours !== undefined) gig.pricing.hourly.minHours = minHours;
      }
    } else if (gig.pricing.hourly.enabled) {
      if (hourlyRate !== undefined) gig.pricing.hourly.rate = hourlyRate;
      if (minHours !== undefined) gig.pricing.hourly.minHours = minHours;
    }

    // Update inspection pricing
    if (inspectionEnabled !== undefined) {
      gig.pricing.inspection.enabled = inspectionEnabled;
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
    "name profilePicture availability",
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
