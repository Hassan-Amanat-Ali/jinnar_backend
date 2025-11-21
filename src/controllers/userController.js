import User from "../models/User.js";
import Gig from "../models/Gig.js";
import cloudinary from "cloudinary";
import asyncHandler from "express-async-handler";
import { calculateDistance  } from "../utils/helpers.js";
import Order from "../models/Order.js";


/**
 * GET /api/workers/find
 * Find workers/sellers based on skills, location, radius, and optional sorting/pagination.
 * Optional debug logging: add `?debug=true` to see detailed logs.
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const toRad = angle => (angle * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
};

export const findWorkers = asyncHandler(async (req, res) => {
  const {
    skills,
    lat,
    lng,
    radius = 10, 
    sortBy = 'rating.average',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = req.query;

  const parsedLat = lat ? parseFloat(lat) : null;
  const parsedLng = lng ? parseFloat(lng) : null;
  const parsedRadius = parseFloat(radius);
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  // -------------------------
  // Build skills filter (optional)
  // -------------------------
  let query = { role: 'seller' };

  if (skills) {
    const skillArr = Array.isArray(skills)
      ? skills
      : skills.split(',').map(s => s.trim().toLowerCase());

    const regexArr = skillArr.map(skill => new RegExp(`^${skill}$`, 'i'));
    query.skills = { $in: regexArr };
  }

  // -------------------------
  // Fetch sellers
  // -------------------------
  let sellers = await User.find(query).select(`
    name profilePicture skills languages yearsOfExperience rating bio selectedAreas portfolioImages preferredAreas
  `);

  // -------------------------
  // Distance filtering (optional)
  // -------------------------
  if (parsedLat !== null && parsedLng !== null) {
    sellers = sellers
      .map(seller => {
        let minDistance = null;
        const areas = Array.isArray(seller.preferredAreas) ? seller.preferredAreas : [];

        areas.forEach(area => {
          if (!area?.coordinates || area.coordinates.length < 2) return;
          const [lng2, lat2] = area.coordinates;
          const distanceKm = haversineDistance(parsedLat, parsedLng, lat2, lng2);
          if (minDistance === null || distanceKm < minDistance) minDistance = distanceKm;
        });

        return { ...seller.toObject(), distance: minDistance };
      })
      .filter(seller =>
        seller.distance !== null && seller.distance <= parsedRadius
      );
  }

  // -------------------------
  // Sorting
  // -------------------------
  sellers.sort((a, b) => {
    let valA = a[sortBy] ?? 0;
    let valB = b[sortBy] ?? 0;
    return sortOrder === 'desc' ? valB - valA : valA - valB;
  });

  // -------------------------
  // Pagination
  // -------------------------
  const totalResults = sellers.length;
  const paginatedSellers = sellers.slice(
    (parsedPage - 1) * parsedLimit,
    parsedPage * parsedLimit
  );

  res.json({
    success: true,
    data: paginatedSellers,
    pagination: {
      currentPage: parsedPage,
      totalPages: Math.ceil(totalResults / parsedLimit),
      totalResults,
      limit: parsedLimit,
    },
  });
});




export const updateUser = async (req, res) => {
  try {
    const { id } = req.user; // From JWT middleware
    const {
      name,
      bio,
      email,
      skills,
      languages,
      yearsOfExperience,
      selectedAreas,
      preferredAreas,
      availability,
      gigs,
      profileImage, // JSON-based image links (buyers and sellers)
      portfolioImages, // JSON-based image links (sellers only)
      videos, // JSON-based video links (sellers only)
      certificates, // JSON-based certificate links (sellers only)
    } = req.body;

    // Log request body for debugging
    console.log("Request body:", req.body);

    // Parse arrays/objects if sent as JSON strings
    let parsedSkills = skills;
    let parsedLanguages = languages;
    let parsedSelectedAreas = selectedAreas;
    let parsedPreferredAreas = preferredAreas;
    let parsedGigs = gigs;
    let parsedAvailability = availability;
    let parsedPortfolioImages = portfolioImages;
    let parsedVideos = videos;
    let parsedCertificates = certificates;

    try {
      if (typeof skills === "string" && skills)
        parsedSkills = JSON.parse(skills);
      if (typeof languages === "string" && languages)
        parsedLanguages = JSON.parse(languages);
      if (typeof selectedAreas === "string" && selectedAreas)
        parsedSelectedAreas = JSON.parse(selectedAreas);
      if (typeof preferredAreas === "string" && preferredAreas)
        parsedPreferredAreas = JSON.parse(preferredAreas);
      if (typeof gigs === "string" && gigs) parsedGigs = JSON.parse(gigs);
      if (typeof availability === "string" && availability)
        parsedAvailability = JSON.parse(availability);
      if (typeof portfolioImages === "string" && portfolioImages)
        parsedPortfolioImages = JSON.parse(portfolioImages);
      if (typeof videos === "string" && videos)
        parsedVideos = JSON.parse(videos);
      if (typeof certificates === "string" && certificates)
        parsedCertificates = JSON.parse(certificates);
      // console.log("Parsed fields:", {
      //   parsedSkills,
      //   parsedLanguages,
      //   parsedSelectedAreas,
      //   parsedPreferredAreas,
      //   parsedGigs,
      //   parsedAvailability,
      //   parsedPortfolioImages,
      //   parsedVideos,
      //   parsedCertificates,
      // });
    } catch (parseErr) {
      console.error("JSON Parse Error:", parseErr.message);
      return res.status(400).json({
        error: "Invalid JSON format in body fields",
        details: parseErr.message,
      });
    }

    // Find user
    const user = await User.findById(id);
    if (!user) {
      console.log("User not found:", id);
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      console.log("User not verified:", id);
      return res.status(403).json({ error: "User not verified" });
    }

    

    // Restrict seller-specific fields for buyers
    if (user.role === "buyer") {
      if (
        bio ||
        skills ||
        languages ||
        yearsOfExperience ||
        selectedAreas ||
        availability ||
        gigs ||
        portfolioImages ||
        videos ||
        certificates
      ) {
        console.log(
          "Buyer attempted to update seller-specific fields:",
          req.body
        );
        return res.status(403).json({
          error:
            "Buyers cannot update seller-specific fields (bio, skills, languages, yearsOfExperience, selectedAreas, availability, gigs, portfolioImages, videos, certificates)",
        });
      }
    }

    // Update shared fields (buyers and sellers)
    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.length > 100
      ) {
        console.log("Invalid name:", name);
        return res.status(400).json({
          error: "Name must be a non-empty string with max 100 characters",
        });
      }
      user.name = name.trim();
    }

     if (email) {
      // Optional: basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if email is already used by another user
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({ error: "Email is already in use" });
      }

      user.email = email;
    }

    // Handle profileImage (JSON-based, buyers and sellers)
    if (profileImage) {
      if (
        !profileImage.url ||
        !profileImage.publicId ||
        typeof profileImage.url !== "string" ||
        typeof profileImage.publicId !== "string"
      ) {
        console.log("Invalid profileImage:", profileImage);
        return res.status(400).json({
          error: "profileImage must have valid url and publicId strings",
        });
      }
      user.profileImage = {
        url: profileImage.url,
        publicId: profileImage.publicId,
      };
      console.log("profileImage updated:", user.profileImage);
    }
    if (parsedPreferredAreas !== undefined) {
    if (!Array.isArray(parsedPreferredAreas)) {
      console.log("Invalid preferredAreas format:", parsedPreferredAreas);
      return res
        .status(400)
        .json({ error: "preferredAreas must be an array" });
    }
    // V-V-V- COPY VALIDATION FROM 'selectedAreas' V-V-V-
    for (let i = 0; i < parsedPreferredAreas.length; i++) {
      const area = parsedPreferredAreas[i];
      if (
        !area.type ||
        area.type !== "Point" ||
        !Array.isArray(area.coordinates) ||
        area.coordinates.length !== 2 ||
        typeof area.coordinates[0] !== "number" ||
        typeof area.coordinates[1] !== "number" ||
        area.coordinates[1] < -90 ||
        area.coordinates[1] > 90 ||
        area.coordinates[0] < -180 ||
        area.coordinates[0] > 180
      ) {
        return res.status(400).json({
          error: `preferredAreas at index ${i} must have valid GeoJSON coordinates [lng, lat]`,
        });
      }
    }
    // ^-^-^- END OF COPIED VALIDATION -^-^-^
    user.preferredAreas = parsedPreferredAreas; // This assignment is now correct
    console.log("preferredAreas updated:", parsedPreferredAreas);
  }

    // Update role-specific fields
    if (user.role === "seller") {
      // Seller-specific updates
      if (bio !== undefined) {
        if (bio && (typeof bio !== "string" || bio.length > 500)) {
          console.log("Invalid bio:", bio);
          return res
            .status(400)
            .json({ error: "Bio must be a string with max 500 characters" });
        }
        user.bio = bio || "";
      }
      if (parsedSkills !== undefined) {
        if (
          !Array.isArray(parsedSkills) ||
          parsedSkills.some((s) => typeof s !== "string")
        ) {
          console.log("Invalid skills:", parsedSkills);
          return res
            .status(400)
            .json({ error: "Skills must be an array of strings" });
        }
        user.skills = parsedSkills.map((s) => s.trim());
      }
      if (parsedLanguages !== undefined) {
        if (
          !Array.isArray(parsedLanguages) ||
          parsedLanguages.some((l) => typeof l !== "string")
        ) {
          console.log("Invalid languages:", parsedLanguages);
          return res
            .status(400)
            .json({ error: "Languages must be an array of strings" });
        }
        user.languages = parsedLanguages.map((l) => l.trim());
      }
      if (yearsOfExperience !== undefined) {
        if (!Number.isInteger(yearsOfExperience) || yearsOfExperience < 0) {
          console.log("Invalid yearsOfExperience:", yearsOfExperience);
          return res.status(400).json({
            error: "Years of experience must be a non-negative integer",
          });
        }
        user.yearsOfExperience = yearsOfExperience;
      }
      if (parsedSelectedAreas !== undefined) {
        if (!Array.isArray(parsedSelectedAreas)) {
          console.log("Invalid selectedAreas format:", parsedSelectedAreas);
          return res
            .status(400)
            .json({ error: "selectedAreas must be an array" });
        }
        for (let i = 0; i < parsedSelectedAreas.length; i++) {
          const area = parsedSelectedAreas[i];
         if (
  !area.type ||
  area.type !== "Point" ||
  !Array.isArray(area.coordinates) ||
  area.coordinates.length !== 2 ||
  typeof area.coordinates[0] !== "number" ||
  typeof area.coordinates[1] !== "number" ||
  area.coordinates[1] < -90 || area.coordinates[1] > 90 ||
  area.coordinates[0] < -180 || area.coordinates[0] > 180
) {
  return res.status(400).json({
    error: `selectedAreas at index ${i} must have valid GeoJSON coordinates [lng, lat]`
  });
}

        }
        user.selectedAreas = parsedSelectedAreas;
        console.log("selectedAreas updated:", parsedSelectedAreas);
      }
      if (parsedAvailability !== undefined) {
        if (!Array.isArray(parsedAvailability)) {
          console.log("Invalid availability format:", parsedAvailability);
          return res
            .status(400)
            .json({ error: "Availability must be an array" });
        }
        for (let i = 0; i < parsedAvailability.length; i++) {
          const slot = parsedAvailability[i];
          if (
            !slot.day ||
            ![
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].includes(slot.day)
          ) {
            console.log(`Invalid day at index ${i}:`, slot.day);
            return res.status(400).json({
              error: `Availability at index ${i} has invalid day; must be a valid weekday`,
            });
          }
          if (!Array.isArray(slot.timeSlots) || slot.timeSlots.length === 0) {
            console.log(`Invalid timeSlots at index ${i}:`, slot.timeSlots);
            return res.status(400).json({
              error: `Availability at index ${i} must have a non-empty timeSlots array`,
            });
          }
          for (let j = 0; j < slot.timeSlots.length; j++) {
            if (
              !["morning", "afternoon", "evening"].includes(slot.timeSlots[j])
            ) {
              console.log(
                `Invalid time slot at index ${i}, position ${j}:`,
                slot.timeSlots[j]
              );
              return res.status(400).json({
                error: `Availability at index ${i} has invalid time slot at position ${j}; must be morning, afternoon, or evening`,
              });
            }
          }
        }
        const days = parsedAvailability.map((slot) => slot.day);
        if (new Set(days).size !== days.length) {
          console.log("Duplicate days in availability:", days);
          return res
            .status(400)
            .json({ error: "Duplicate days in availability" });
        }
        user.availability = parsedAvailability;
        console.log("Availability updated:", parsedAvailability);
      }
      // Handle seller-specific image links
      if (parsedPortfolioImages !== undefined) {
        if (!Array.isArray(parsedPortfolioImages)) {
          console.log("Invalid portfolioImages format:", parsedPortfolioImages);
          return res
            .status(400)
            .json({ error: "portfolioImages must be an array" });
        }
        for (let i = 0; i < parsedPortfolioImages.length; i++) {
          const image = parsedPortfolioImages[i];
          if (
            !image.url ||
            !image.publicId ||
            typeof image.url !== "string" ||
            typeof image.publicId !== "string"
          ) {
            console.log(`Invalid portfolioImages at index ${i}:`, image);
            return res.status(400).json({
              error: `portfolioImages at index ${i} must have valid url and publicId strings`,
            });
          }
        }
        user.portfolioImages = parsedPortfolioImages;
        console.log("portfolioImages updated:", parsedPortfolioImages);
      }
      if (parsedVideos !== undefined) {
        if (!Array.isArray(parsedVideos)) {
          console.log("Invalid videos format:", parsedVideos);
          return res.status(400).json({ error: "videos must be an array" });
        }
        for (let i = 0; i < parsedVideos.length; i++) {
          const video = parsedVideos[i];
          if (
            !video.url ||
            !video.publicId ||
            typeof video.url !== "string" ||
            typeof video.publicId !== "string"
          ) {
            console.log(`Invalid videos at index ${i}:`, video);
            return res.status(400).json({
              error: `videos at index ${i} must have valid url and publicId strings`,
            });
          }
        }
        user.videos = parsedVideos;
        console.log("videos updated:", parsedVideos);
      }
      if (parsedCertificates !== undefined) {
        if (!Array.isArray(parsedCertificates)) {
          console.log("Invalid certificates format:", parsedCertificates);
          return res
            .status(400)
            .json({ error: "certificates must be an array" });
        }
        for (let i = 0; i < parsedCertificates.length; i++) {
          const certificate = parsedCertificates[i];
          if (
            !certificate.url ||
            !certificate.publicId ||
            typeof certificate.url !== "string" ||
            typeof certificate.publicId !== "string"
          ) {
            console.log(`Invalid certificates at index ${i}:`, certificate);
            return res.status(400).json({
              error: `certificates at index ${i} must have valid url and publicId strings`,
            });
          }
        }
        user.certificates = parsedCertificates;
        console.log("certificates updated:", parsedCertificates);
      }
      // Handle gigs (seller-only)
      if (parsedGigs && Array.isArray(parsedGigs)) {
        let updatedGigs = [];
        for (let i = 0; i < parsedGigs.length; i++) {
          const gigData = parsedGigs[i];
          console.log(`Processing gig at index ${i}:`, gigData);
          if (
            !gigData.title ||
            !gigData.description ||
            !gigData.pricingMethod
          ) {
            console.log(`Invalid gig data at index ${i}:`, gigData);
            return res.status(400).json({
              error: `Gig at index ${i} is missing required fields: title, description, and pricingMethod are required`,
            });
          }
          if (
            !["fixed", "hourly", "negotiable"].includes(gigData.pricingMethod)
          ) {
            console.log(
              `Invalid pricingMethod at index ${i}:`,
              gigData.pricingMethod
            );
            return res.status(400).json({
              error: `Gig at index ${i} has invalid pricing method. Must be fixed, hourly, or negotiable`,
            });
          }
          if (
            gigData.pricingMethod !== "negotiable" &&
            (!gigData.price || gigData.price < 0)
          ) {
            console.log(`Invalid price at index ${i}:`, gigData.price);
            return res.status(400).json({
              error: `Gig at index ${i} requires a valid price for fixed or hourly pricing`,
            });
          }
          const images = gigData.images || [];
          if (!Array.isArray(images)) {
            console.log(`Invalid images array at index ${i}:`, images);
            return res.status(400).json({
              error: `Gig at index ${i} has invalid images field; must be an array`,
            });
          }
          if (images.length > 3) {
            console.log(`Too many images at index ${i}:`, images.length);
            return res.status(400).json({
              error: `Gig at index ${i} cannot have more than 3 images`,
            });
          }
          for (let j = 0; j < images.length; j++) {
            if (
              !images[j].url ||
              !images[j].publicId ||
              typeof images[j].url !== "string" ||
              typeof images[j].publicId !== "string"
            ) {
              console.log(
                `Invalid image data at index ${i}, image ${j}:`,
                images[j]
              );
              return res.status(400).json({
                error: `Gig at index ${i} has invalid image data at position ${j}; url and publicId are required`,
              });
            }
          }
          try {
            if (gigData.gigId) {
              console.log(`Updating gig with ID ${gigData.gigId}`);
              const existingGig = await Gig.findById(gigData.gigId);
              if (!existingGig) {
                console.log(`Gig not found at index ${i}:`, gigData.gigId);
                return res
                  .status(404)
                  .json({ error: `Gig at index ${i} not found` });
              }
              if (existingGig.sellerId.toString() !== id) {
                console.log(
                  `Unauthorized update attempt for gig at index ${i}:`,
                  gigData.gigId
                );
                return res
                  .status(403)
                  .json({ error: `Unauthorized to update gig at index ${i}` });
              }
              existingGig.title = gigData.title;
              existingGig.description = gigData.description;
              existingGig.pricing.method = gigData.pricingMethod;
              existingGig.pricing.price =
                gigData.pricingMethod === "negotiable"
                  ? undefined
                  : gigData.price;
              existingGig.images = images;
              await existingGig.save();
              console.log(`Gig updated at index ${i}:`, existingGig);
              updatedGigs.push(existingGig);
            } else {
              console.log(`Creating new gig at index ${i}`);
              const newGig = new Gig({
                sellerId: id,
                title: gigData.title,
                description: gigData.description,
                pricing: {
                  method: gigData.pricingMethod,
                  price:
                    gigData.pricingMethod === "negotiable"
                      ? undefined
                      : gigData.price,
                },
                images: images,
              });
              await newGig.save();
              console.log(`Gig created at index ${i}:`, newGig);
              updatedGigs.push(newGig);
            }
          } catch (gigErr) {
            console.error(
              `Gig Processing Error at index ${i}:`,
              gigErr.message
            );
            return res.status(400).json({
              error: `Failed to process gig at index ${i}`,
              details: gigErr.message,
            });
          }
        }
        console.log("All gigs processed:", updatedGigs);
      }
    } else if (user.role === "buyer") {
      // Buyer-specific updates
      if (parsedPreferredAreas !== undefined) {
        if (!Array.isArray(parsedPreferredAreas)) {
          console.log("Invalid preferredAreas format:", parsedPreferredAreas);
          return res
            .status(400)
            .json({ error: "preferredAreas must be an array" });
        }
        for (let i = 0; i < parsedPreferredAreas.length; i++) {
          const area = parsedPreferredAreas[i];
          if (
            !area.lat ||
            !area.lng ||
            typeof area.lat !== "number" ||
            typeof area.lng !== "number" ||
            area.lat < -90 ||
            area.lat > 90 ||
            area.lng < -180 ||
            area.lng > 180
          ) {
            console.log(`Invalid preferredAreas at index ${i}:`, area);
            return res.status(400).json({
              error: `preferredAreas at index ${i} must have valid lat (-90 to 90) and lng (-180 to 180)`,
            });
          }
        }
        user.preferredAreas = parsedPreferredAreas;
        console.log("preferredAreas updated:", parsedPreferredAreas);
      }
    }

    // Prevent updates to read-only fields
    if (
      req.body.orderHistory ||
      req.body.rating ||
      req.body.lastLogin ||
      req.body.wallet ||
      req.body.notifications
    ) {
      console.log("Attempt to update read-only fields:", {
        orderHistory: req.body.orderHistory,
        rating: req.body.rating,
        lastLogin: req.body.lastLogin,
        wallet: req.body.wallet,
        notifications: req.body.notifications,
      });
      return res.status(403).json({
        error:
          "Cannot update orderHistory, rating, lastLogin, wallet, or notifications through this endpoint",
      });
    }

   
    await user.save({ validateBeforeSave: true });
    console.log("User saved successfully");

    // Re-fetch user to confirm updates
    const updatedUser = await User.findById(id).select(
      "-verificationCode -verificationCodeExpires"
    );
    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update User Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Configure Cloudinary (should be in a config file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.user;
    const {
      profilePicture,
      otherImages,
      portfolioImages,
      videos,
      certificates,
      gigImages,
    } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });

    // Update profile picture (all users)
    if (profilePicture) {
      user.profilePicture = profilePicture;
    }

    // Update other images (all users)
    if (otherImages && Array.isArray(otherImages)) {
      user.otherImages = [...(user.otherImages || []), ...otherImages];
    }

    // Update seller-specific fields
    if (user.role === "seller") {
      if (portfolioImages && Array.isArray(portfolioImages)) {
        user.portfolio.images = [
          ...(user.portfolio?.images || []),
          ...portfolioImages,
        ];
      }
      if (videos && Array.isArray(videos)) {
        user.portfolio.videos = [...(user.portfolio?.videos || []), ...videos];
      }
      if (certificates && Array.isArray(certificates)) {
        user.portfolio.certificates = [
          ...(user.portfolio?.certificates || []),
          ...certificates,
        ];
      }
      if (gigImages && Array.isArray(gigImages)) {
        user.portfolio.gigImages = [
          ...(user.portfolio?.gigImages || []),
          ...gigImages,
        ];
      }
    } else if (portfolioImages || videos || certificates || gigImages) {
      return res
        .status(403)
        .json({ error: "Only sellers can update portfolio fields" });
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        profilePicture: user.profilePicture,
        otherImages: user.otherImages,
        portfolio: user.portfolio,
      },
    });
  } catch (error) {
    console.error("Update User Profile Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch user
    const user = await User.findById(id).select(`
        name role bio profilePicture 
        skills languages yearsOfExperience 
        selectedAreas portfolioImages videos certificates
        rating wallet.balance availability createdAt
      `);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch active gigs
    const gigs = await Gig.find({
      sellerId: id,
      status: "active",
    }).select("title description images pricing status createdAt");

    // Count completed orders
    const completedOrdersCount = await Order.countDocuments({
      sellerId: id,
      status: "completed",
    });

    // Prepare recent reviews (most recent first)
    const recentReviewsRaw = (user.reviews || []).slice(-5).reverse();
    const reviewerIds = recentReviewsRaw.map(r => r.reviewer).filter(Boolean);
    const reviewers = await User.find({ _id: { $in: reviewerIds } }).select('name profilePicture');
    const reviewerMap = reviewers.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const recentReviews = recentReviewsRaw.map(r => ({
      orderId: r.orderId,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      reviewer: r.reviewer ? { id: r.reviewer, name: reviewerMap[r.reviewer]?._doc?.name || reviewerMap[r.reviewer]?.name, profilePicture: reviewerMap[r.reviewer]?._doc?.profilePicture || reviewerMap[r.reviewer]?.profilePicture } : null
    }));

    const publicProfile = {
      _id: user._id,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture,
      bio: user.bio || "No bio yet",
      skills: user.skills || [],
      languages: user.languages || [],
      yearsOfExperience: user.yearsOfExperience || 0,
      selectedAreas: user.selectedAreas || [],
      portfolioImages: user.portfolioImages || [],
      videos: user.videos || [],
      certificates: user.certificates || [],
      rating: user.rating || { average: 0, count: 0 },
      activeGigs: gigs || [],
      memberSince: user.createdAt,
      availability: user.availability || [],
      ordersCompleted: completedOrdersCount || 0,
      reviews: recentReviews,
    };

    res.json({ profile: publicProfile });
  } catch (error) {
    console.error("Get Public Profile Error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const { token, deviceInfo } = req.body;
    const userId = req.user.id; // from JWT middleware

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove any previous token entries that match this token
    user.fcmTokens = user.fcmTokens.filter((t) => t.token !== token);

    // Add the token at the end (latest)
    user.fcmTokens.push({ token, deviceInfo });

    await user.save();

    res.json({ message: "FCM token updated successfully" });
  } catch (err) {
    console.error("Error updating FCM token:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// controllers/userController.js

// GET MY PROFILE (Full Data for Profile Page)
export const getMyProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id).select(
      "-password -verificationCode -verificationCodeExpires"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // FETCH GIGS SEPARATELY (No populate needed)
    const gigs = await Gig.find({
      sellerId: id,
      //   status: "active",
    }).select("title description images pricing status createdAt");

    // Structure response
    const profile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      isVerified: user.isVerified,
      profilePicture: user.profilePicture,
      bio: user.bio || "",
      skills: user.skills || [],
      languages: user.languages || [],
      yearsOfExperience: user.yearsOfExperience || 0,
      selectedAreas: user.selectedAreas || [],
      preferredAreas: user.preferredAreas || [],
      availability: user.availability || [],
      portfolioImages: user.portfolioImages || [],
      videos: user.videos || [],
      certificates: user.certificates || [],
      rating: user.rating || { average: 0, count: 0 },
      wallet: {
        balance: user.wallet?.balance || 0,
        recentTransactions: user.wallet?.transactions?.slice(0, 10) || [],
      },
      gigs: gigs || [],
      notifications: user.notifications?.slice(0, 5) || [],
      createdAt: user.createdAt,
    };

    res.json({ profile });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// GET seller reviews (paginated)
export const getSellerReviews = async (req, res) => {
  try {
    const { id } = req.params; // seller id
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);

    const user = await User.findById(id).select('reviews');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reviews = (user.reviews || []).slice().reverse(); // most recent first
    const total = reviews.length;
    const start = (page - 1) * limit;
    const paged = reviews.slice(start, start + limit);

    // Fetch reviewer details
    const reviewerIds = paged.map(r => r.reviewer).filter(Boolean);
    const reviewers = await User.find({ _id: { $in: reviewerIds } }).select('name profilePicture');
    const reviewerMap = reviewers.reduce((acc, u) => { acc[u._id] = u; return acc; }, {});

    const results = paged.map(r => ({
      orderId: r.orderId,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      reviewer: r.reviewer ? { id: r.reviewer, name: reviewerMap[r.reviewer]?._doc?.name || reviewerMap[r.reviewer]?.name, profilePicture: reviewerMap[r.reviewer]?._doc?.profilePicture || reviewerMap[r.reviewer]?.profilePicture } : null
    }));

    return res.json({ total, page, limit, reviews: results });
  } catch (error) {
    console.error('Get seller reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};
