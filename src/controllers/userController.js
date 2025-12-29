import User from "../models/User.js";
import Gig from "../models/Gig.js";
import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import SupportTicket from "../models/SupportTicket.js";
import Wallet from "../models/Wallet.js";
import Report from "../models/Report.js";
import { getCoordinatesFromAddress } from "../utils/geocoding.js";

// Helper function to geocode an array of addresses to GeoJSON Points
const geocodeAddressArrayToGeoJsonPoints = async (addressArray) => {
  if (!Array.isArray(addressArray)) {
    throw new Error("Input must be an array of addresses.");
  }
  const geoJsonPoints = [];
  for (const address of addressArray) {
    if (typeof address !== "string" || address.trim().length === 0) {
      throw new Error("Each area must be a non-empty address string.");
    }
    const geocodedLocation = await getCoordinatesFromAddress(address);
    if (geocodedLocation) {
      geoJsonPoints.push({
        type: "Point",
        coordinates: [geocodedLocation.lng, geocodedLocation.lat],
      });
    } else {
      console.warn(`Geocoding returned no coordinates for address: ${address}`);
      // Decide how to handle un-geocodable addresses: skip, return error, or push null
      // For now, we'll skip it, but an error might be more appropriate for strict validation.
    }
  }
  return geoJsonPoints;
};

/**
 * GET /api/workers/find
 * Find workers/sellers based on skills, location, radius, and optional sorting/pagination.
 * Optional debug logging: add `?debug=true` to see detailed logs.
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const toRad = (angle) => (angle * Math.PI) / 180;
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
    address,
    radius = 10,
    sortBy = "rating.average",
    sortOrder = "desc",
    page = 1,
    limit = 10,
    search, // Add search parameter
  } = req.query;

  let parsedLat = null;
  let parsedLng = null;

  // -------------------------
  // Geocode address (optional)
  // -------------------------
  if (address) {
    try {
      const geocodedLocation = await getCoordinatesFromAddress(address);
      if (geocodedLocation) {
        parsedLat = geocodedLocation.lat;
        parsedLng = geocodedLocation.lng;
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to geocode address",
      });
    }
  }

  const parsedRadius = parseFloat(radius);
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  // -------------------------
  // Base query
  // -------------------------
  const query = {
    role: "seller",
    isSuspended: false,
  };

  // -------------------------
  // Search filter (optional)
  // -------------------------
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i"); // Case-insensitive search
    query.$or = [
      { name: searchRegex }, // Search by worker name
      { "categories.name": searchRegex }, // Search by category name (will need population)
    ];
  }

  // -------------------------
  // Skills filter (optional)
  // -------------------------
  if (skills) {
    const skillArr = Array.isArray(skills)
      ? skills
      : skills.split(",").map((s) => s.trim());

    const regexArr = skillArr.map((skill) => new RegExp(`^${skill}$`, "i"));
    query.skills = { $in: regexArr };
  }

  // -------------------------
  // Fetch sellers
  // -------------------------
  let sellers = await User.find(query).select(`
    name
    profilePicture
    bio
    skills
    languages
    yearsOfExperience
    rating
    availability
    portfolioImages
    verificationStatus
    averageResponseTime
    preferredAreas
    categories
  `)
  .populate("categories", "name");

  // -------------------------
  // Distance filtering (optional)
  // -------------------------
  if (parsedLat !== null && parsedLng !== null) {
    sellers = sellers
      .map((seller) => {
        let minDistance = null;

        const areas = Array.isArray(seller.preferredAreas)
          ? seller.preferredAreas
          : [];

        for (const area of areas) {
          if (!area?.coordinates || area.coordinates.length < 2) continue;

          const [lng2, lat2] = area.coordinates;
          const distanceKm = haversineDistance(
            parsedLat,
            parsedLng,
            lat2,
            lng2
          );

          if (minDistance === null || distanceKm < minDistance) {
            minDistance = distanceKm;
          }
        }

        return {
          ...seller.toObject(),
          distance: minDistance,
        };
      })
      .filter(
        (seller) =>
          seller.distance !== null && seller.distance <= parsedRadius
      );
  }

  // -------------------------
  // Safe nested sorting
  // -------------------------
  const getNestedValue = (obj, path) =>
    path.split(".").reduce((o, k) => o?.[k], obj) ?? 0;

  sellers.sort((a, b) => {
    const valA = getNestedValue(a, sortBy);
    const valB = getNestedValue(b, sortBy);
    return sortOrder === "desc" ? valB - valA : valA - valB;
  });

  // -------------------------
  // Map public worker profile
  // -------------------------
  const mapWorker = (seller) => ({
    id: seller._id,
    name: seller.name,
    profilePicture: seller.profilePicture,
    bio: seller.bio,
    skills: seller.skills,
    languages: seller.languages,
    categories: seller.categories,
    yearsOfExperience: seller.yearsOfExperience,

    rating: {
      average: seller.rating?.average ?? 0,
      count: seller.rating?.count ?? 0,
    },

    distance: seller.distance ?? null,
    availability: seller.availability,
    portfolioImages: seller.portfolioImages,
    responseTime: seller.averageResponseTime,
    verificationStatus: seller.verificationStatus,
  });

  const mappedSellers = sellers.map(mapWorker);

  // -------------------------
  // Pagination
  // -------------------------
  const totalResults = mappedSellers.length;

  const paginatedSellers = mappedSellers.slice(
    (parsedPage - 1) * parsedLimit,
    parsedPage * parsedLimit
  );

  // -------------------------
  // Response
  // -------------------------
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
      mobileNumber,
      skills,
      categories,
      subcategories,
      languages,
      yearsOfExperience,
      selectedAreas,
      preferredAreas,
      availability,
      gigs,
      profilePicture,
      portfolioImages,
      videos,
      certificates,
      address,
    } = req.body;


    // Parse arrays/objects if sent as JSON strings
    let parsedSkills = skills;
    let parsedCategories = categories;
    let parsedSubcategories = subcategories;
    let parsedLanguages = languages;
    let parsedGigs = gigs;
    let parsedAvailability = availability;
    let parsedPortfolioImages = portfolioImages;
    let parsedVideos = videos;
    let parsedCertificates = certificates;

    try {
      if (typeof skills === "string" && skills)
        parsedSkills = JSON.parse(skills);
      if (typeof categories === "string" && categories)
        parsedCategories = JSON.parse(categories);
      if (typeof subcategories === "string" && subcategories)
        parsedSubcategories = JSON.parse(subcategories);
      if (typeof languages === "string" && languages)
        parsedLanguages = JSON.parse(languages);
      // Removed parsing for selectedAreas and preferredAreas - now handled as arrays of strings
      if (typeof gigs === "string" && gigs) parsedGigs = JSON.parse(gigs);
      if (typeof availability === "string" && availability)
        parsedAvailability = JSON.parse(availability);
      if (typeof portfolioImages === "string" && portfolioImages)
        parsedPortfolioImages = JSON.parse(portfolioImages);
      if (typeof videos === "string" && videos)
        parsedVideos = JSON.parse(videos);
      if (typeof certificates === "string" && certificates)
        parsedCertificates = JSON.parse(certificates);
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
        categories ||
        subcategories ||
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
            "Buyers cannot update seller-specific fields (bio, skills, categories, subcategories, languages, yearsOfExperience, selectedAreas, availability, gigs, portfolioImages, videos, certificates)",
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

    if (mobileNumber !== undefined) {
      if (mobileNumber) {
        // Validate mobile number format (E.164 format)
        const mobileRegex = /^\+[1-9]\d{1,14}$/;
        if (!mobileRegex.test(mobileNumber)) {
          return res.status(400).json({
            error: "Mobile number must be in E.164 format (e.g., +1234567890)",
          });
        }
        user.mobileNumber = mobileNumber;
        console.log("mobileNumber updated:", user.mobileNumber);
      } else {
        // Allow clearing the mobile number
        user.mobileNumber = null;
      }
    }

    // ✅ Handle profilePicture (now a simple URL string)
    if (profilePicture) {
      if (typeof profilePicture !== "string") {
        return res
          .status(400)
          .json({ error: "profilePicture must be a URL string" });
      }
      user.profilePicture = profilePicture;
      console.log("profilePicture updated:", user.profilePicture);
    }
    // Handle address and geocoding
    if (address !== undefined) {
      if (typeof address !== "string" || address.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "Address must be a non-empty string" });
      }
      user.address = address.trim();
      try {
        const geocodedLocation = await getCoordinatesFromAddress(address);
        user.location = {
          type: "Point",
          coordinates: [geocodedLocation.lng, geocodedLocation.lat],
        };
        console.log("Address geocoded:", user.location);
      } catch (geocodeError) {
        console.error("Geocoding failed for address:", address, geocodeError);
        return res.status(500).json({ error: "Failed to geocode address" });
      }
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
      if (parsedCategories !== undefined) {
        if (!Array.isArray(parsedCategories)) {
          console.log("Invalid categories:", parsedCategories);
          return res
            .status(400)
            .json({ error: "Categories must be an array" });
        }
        user.categories = parsedCategories;
        console.log("Categories updated:", user.categories);
      }
      if (parsedSubcategories !== undefined) {
        if (!Array.isArray(parsedSubcategories)) {
          console.log("Invalid subcategories:", parsedSubcategories);
          return res
            .status(400)
            .json({ error: "Subcategories must be an array" });
        }
        user.subcategories = parsedSubcategories;
        console.log("Subcategories updated:", user.subcategories);
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
      if (selectedAreas !== undefined) {
        if (!Array.isArray(selectedAreas)) {
          return res.status(400).json({
            error: "selectedAreas must be an array.",
          });
        }

        // Check if the array contains address strings or GeoJSON points
        if (selectedAreas.length > 0 && typeof selectedAreas[0] === "string") {
          // It's an array of address strings, geocode them
          try {
            user.selectedAreas =
              await geocodeAddressArrayToGeoJsonPoints(selectedAreas);
            console.log(
              "selectedAreas updated from addresses:",
              user.selectedAreas
            );
          } catch (geocodeErr) {
            console.error(
              "Geocoding failed for selectedAreas:",
              geocodeErr.message
            );
            return res.status(400).json({
              error: `Failed to geocode one or more selectedAreas: ${geocodeErr.message}`,
            });
          }
        } else if (
          selectedAreas.length > 0 &&
          typeof selectedAreas[0] === "object"
        ) {
          // It's an array of GeoJSON points, validate and assign
          const isValidGeoJson = selectedAreas.every(
            (area) =>
              area.type === "Point" &&
              Array.isArray(area.coordinates) &&
              area.coordinates.length === 2 &&
              typeof area.coordinates[0] === "number" &&
              typeof area.coordinates[1] === "number"
          );

          if (!isValidGeoJson) {
            return res.status(400).json({
              error:
                "Invalid GeoJSON format in selectedAreas. Each element must be a Point with a coordinates array of two numbers.",
            });
          }
          user.selectedAreas = selectedAreas;
          console.log(
            "selectedAreas updated from GeoJSON:",
            user.selectedAreas
          );
        } else {
          // It's an empty array, which is valid
          user.selectedAreas = [];
          console.log("selectedAreas set to empty array.");
        }
      }
      if (parsedAvailability !== undefined) {
        if (!Array.isArray(parsedAvailability)) {
          console.log("Invalid availability format:", parsedAvailability);
          return res
            .status(400)
            .json({ error: "Availability must be an array" });
        }

        const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

        const overlaps = (arr) => {
          // arr: [{start,end}] times as HH:mm
          const toMinutes = (t) => {
            const [hh, mm] = t.split(":");
            return parseInt(hh, 10) * 60 + parseInt(mm, 10);
          };
          const sorted = arr
            .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
            .sort((a, b) => a.start - b.start);
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].start >= sorted[i].end) return true; // invalid single range
            if (i > 0 && sorted[i].start < sorted[i - 1].end) return true; // overlap
          }
          return false;
        };

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

          // timeSlots must be an array if provided (existing contract)
          if (!Array.isArray(slot.timeSlots) || slot.timeSlots.length === 0) {
            console.log(`Invalid timeSlots at index ${i}:`, slot.timeSlots);
            return res.status(400).json({
              error: `Availability at index ${i} must have a non-empty timeSlots array`,
            });
          }

          for (let j = 0; j < slot.timeSlots.length; j++) {
            if (!["morning", "afternoon", "evening"].includes(slot.timeSlots[j])) {
              console.log(
                `Invalid time slot at index ${i}, position ${j}:`,
                slot.timeSlots[j]
              );
              return res.status(400).json({
                error: `Availability at index ${i} has invalid time slot at position ${j}; must be morning, afternoon, or evening`,
              });
            }
          }

          // Optional detailed times
          if ((slot.start && !timeRe.test(slot.start)) || (slot.end && !timeRe.test(slot.end))) {
            return res.status(400).json({ error: `Invalid time format for start/end at availability index ${i}. Expected HH:mm` });
          }

          if (slot.start && slot.end) {
            const [sh, sm] = slot.start.split(":");
            const [eh, em] = slot.end.split(":");
            const sMinutes = parseInt(sh, 10) * 60 + parseInt(sm, 10);
            const eMinutes = parseInt(eh, 10) * 60 + parseInt(em, 10);
            if (sMinutes >= eMinutes) {
              return res.status(400).json({ error: `Start must be before end for availability at index ${i}` });
            }
          }

          // Validate breaks if provided
          if (slot.breaks !== undefined) {
            if (!Array.isArray(slot.breaks)) {
              return res.status(400).json({ error: `breaks for availability index ${i} must be an array` });
            }
            for (let b = 0; b < slot.breaks.length; b++) {
              const br = slot.breaks[b];
              if (!br.start || !br.end) {
                return res.status(400).json({ error: `break at index ${b} for availability ${i} must have start and end` });
              }
              if (!timeRe.test(br.start) || !timeRe.test(br.end)) {
                return res.status(400).json({ error: `Invalid time format in breaks at availability ${i}, break ${b}. Expected HH:mm` });
              }
            }
            // check overlaps and containment if main start/end provided
            if (overlaps(slot.breaks)) {
              return res.status(400).json({ error: `Overlapping or invalid break ranges in availability index ${i}` });
            }
            if (slot.start && slot.end) {
              const toMin = (t) => { const [h,m] = t.split(":"); return parseInt(h,10)*60+parseInt(m,10); };
              const s = toMin(slot.start);
              const e = toMin(slot.end);
              for (const br of slot.breaks) {
                const bs = toMin(br.start);
                const be = toMin(br.end);
                if (bs < s || be > e) {
                  return res.status(400).json({ error: `Breaks must be within the main availability range for availability index ${i}` });
                }
              }
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
          // ✅ Simplified validation for an array of URL strings
          if (typeof image !== "string") {
            console.log(`Invalid portfolioImages at index ${i}:`, image);
            return res.status(400).json({
              error: `portfolioImages at index ${i} must be a valid URL string`,
            });
          }
        }
        user.portfolioImages = parsedPortfolioImages.map((url) => ({ url }));
        console.log("portfolioImages updated:", user.portfolioImages);
      }
      if (parsedVideos !== undefined) {
        if (!Array.isArray(parsedVideos)) {
          console.log("Invalid videos format:", parsedVideos);
          return res.status(400).json({ error: "videos must be an array" });
        }
        for (let i = 0; i < parsedVideos.length; i++) {
          const video = parsedVideos[i];
          if (typeof video !== "string") {
            console.log(`Invalid videos at index ${i}:`, video);
            return res.status(400).json({
              error: `videos at index ${i} must be a valid URL string`,
            });
          }
        }
        user.videos = parsedVideos.map((url) => ({ url }));
        console.log("videos updated:", user.videos);
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
          if (typeof certificate !== "string") {
            console.log(`Invalid certificates at index ${i}:`, certificate);
            return res.status(400).json({
              error: `certificates at index ${i} must be a valid URL string`,
            });
          }
        }
        // ✅ Assign the arrays of strings directly
        user.certificates = parsedCertificates.map((url) => ({ url }));
        console.log("certificates updated:", user.certificates);
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
            // ✅ Simplified validation, only URL is needed now.
            if (!images[j].url || typeof images[j].url !== "string") {
              console.log(
                `Invalid image data at index ${i}, image ${j}:`,
                images[j]
              );
              return res.status(400).json({
                error: `Gig at index ${i} has invalid image data at position ${j}; a URL string is required`,
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
      if (preferredAreas !== undefined) {
        if (!Array.isArray(preferredAreas)) {
          return res.status(400).json({
            error: "preferredAreas must be an array.",
          });
        }
        // Check if the array contains address strings or GeoJSON points
        if (
          preferredAreas.length > 0 &&
          typeof preferredAreas[0] === "string"
        ) {
          // It's an array of address strings, geocode them
          try {
            user.preferredAreas =
              await geocodeAddressArrayToGeoJsonPoints(preferredAreas);
            console.log(
              "preferredAreas updated from addresses:",
              user.preferredAreas
            );
          } catch (geocodeErr) {
            console.error(
              "Geocoding failed for preferredAreas:",
              geocodeErr.message
            );
            return res.status(400).json({
              error: `Failed to geocode one or more preferredAreas: ${geocodeErr.message}`,
            });
          }
        } else if (
          preferredAreas.length > 0 &&
          typeof preferredAreas[0] === "object"
        ) {
          // It's an array of GeoJSON points, validate and assign
          const isValidGeoJson = preferredAreas.every(
            (area) =>
              area.type === "Point" &&
              Array.isArray(area.coordinates) &&
              area.coordinates.length === 2 &&
              typeof area.coordinates[0] === "number" &&
              typeof area.coordinates[1] === "number"
          );

          if (!isValidGeoJson) {
            return res.status(400).json({
              error:
                "Invalid GeoJSON format in preferredAreas. Each element must be a Point with a coordinates array of two numbers.",
            });
          }
          user.preferredAreas = preferredAreas;
          console.log(
            "preferredAreas updated from GeoJSON:",
            user.preferredAreas
          );
        } else {
          // It's an empty array, which is valid
          user.preferredAreas = [];
          console.log("preferredAreas set to empty array.");
        }
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
    console.log("Update User Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message, stack: error.stack });
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch user
    const user = await User.findById(id)
      .select(`
        name role bio profilePicture address location
        skills languages yearsOfExperience 
        selectedAreas portfolioImages videos certificates
        rating wallet.balance availability createdAt
        categories subcategories
      `)
      .populate("categories", "name")
      .populate("subcategories", "name");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch active gigs
    const gigs = await Gig.find({
      sellerId: id,
      status: "active",
    })
      .select("title description images pricing status createdAt category primarySubcategory")
      .populate("category", "name")
      .populate("primarySubcategory", "name");

    // Count completed orders
    const completedOrdersCount = await Order.countDocuments({
      sellerId: id,
      status: "completed",
    });

    // Prepare recent reviews (most recent first)
    const recentReviewsRaw = (user.reviews || []).slice(-5).reverse();
    const reviewerIds = recentReviewsRaw.map((r) => r.reviewer).filter(Boolean);
    const reviewers = await User.find({ _id: { $in: reviewerIds } }).select(
      "name profilePicture"
    );
    const reviewerMap = reviewers.reduce((acc, u) => {
      acc[u._id] = u;
      return acc;
    }, {});

    const recentReviews = recentReviewsRaw.map((r) => ({
      orderId: r.orderId,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      reviewer: r.reviewer
        ? {
            id: r.reviewer,
            name:
              reviewerMap[r.reviewer]?._doc?.name ||
              reviewerMap[r.reviewer]?.name,
            profilePicture:
              reviewerMap[r.reviewer]?._doc?.profilePicture ||
              reviewerMap[r.reviewer]?.profilePicture,
          }
        : null,
    }));

    const publicProfile = {
      _id: user._id,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture,
      bio: user.bio || "No bio yet",
      address: user.address, // Add address
      location: user.location, // Add location
      skills: user.skills || [],
      categories: user.categories || [],
      subcategories: user.subcategories || [],
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
    const { token, deviceInfo = null } = req.body;
    const userId = req.user.id; // from JWT middleware

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    // Perform an atomic update to prevent race conditions (VersionError)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        // 1. Atomically remove any existing entries with the same token.
        // This prevents duplicates if the token already exists for a different device.
        $pull: { fcmTokens: { token: token } },
      },
      { new: false } // We don't need the result of this query
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Atomically add the new token to the set.
    // `$addToSet` ensures no duplicates of the exact same token/deviceInfo object are added.
    await User.findByIdAndUpdate(userId, {
      $addToSet: { fcmTokens: { token, deviceInfo, createdAt: new Date() } },
    });

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

    // Calculate completed jobs count for workers
    let completedJobsCount = 0;
    if (user.role === "seller") {
      completedJobsCount = await Order.countDocuments({
        workerId: id,
        status: "completed",
      });
    }

    // Structure response
    const profile = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      address: user.address, // Add address
      location: user.location, // Add location
      role: user.role,
      isVerified: user.isVerified,
      verificationStatus: user.verificationStatus, // <-- ADDED
      profilePicture: user.profilePicture,
      bio: user.bio || "",
      skills: user.skills || [],
      categories: user.categories || [],
      subcategories: user.subcategories || [],
      languages: user.languages || [],
      yearsOfExperience: user.yearsOfExperience || 0,
      selectedAreas: user.selectedAreas || [],
      preferredAreas: user.preferredAreas || [],
      availability: user.availability || [],
      portfolioImages: user.portfolioImages || [],
      videos: user.videos || [],
      certificates: user.certificates || [],
      rating: user.rating || { average: 0, count: 0 },
      completedJobs: completedJobsCount, // <-- ADDED
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
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);

    const user = await User.findById(id).select("reviews");
    if (!user) return res.status(404).json({ error: "User not found" });

    const reviews = (user.reviews || []).slice().reverse(); // most recent first
    const total = reviews.length;
    const start = (page - 1) * limit;
    const paged = reviews.slice(start, start + limit);

    // Fetch reviewer details
    const reviewerIds = paged.map((r) => r.reviewer).filter(Boolean);
    const reviewers = await User.find({ _id: { $in: reviewerIds } }).select(
      "name profilePicture"
    );
    const reviewerMap = reviewers.reduce((acc, u) => {
      acc[u._id] = u;
      return acc;
    }, {});

    const results = paged.map((r) => ({
      orderId: r.orderId,
      rating: r.rating,
      review: r.review,
      createdAt: r.createdAt,
      reviewer: r.reviewer
        ? {
            id: r.reviewer,
            name:
              reviewerMap[r.reviewer]?._doc?.name ||
              reviewerMap[r.reviewer]?.name,
            profilePicture:
              reviewerMap[r.reviewer]?._doc?.profilePicture ||
              reviewerMap[r.reviewer]?.profilePicture,
          }
        : null,
    }));

    return res.json({ total, page, limit, reviews: results });
  } catch (error) {
    console.error("Get seller reviews error:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
};

// --- NEW: Internal helper for submitting verification ---
export const _submitUserForVerificationLogic = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    return { success: false, message: "User not found." };
  }

  // 1. Check current status
  if (user.verificationStatus === "approved") {
    return { success: false, message: "User is already verified." };
  }
  if (user.verificationStatus === "pending") {
    return { success: false, message: "Verification is already pending." };
  }

  // 2. Check if documents exist
  if (!user.identityDocuments || user.identityDocuments.length === 0) {
    return {
      success: false,
      message: "Please upload at least one identity document before submitting.",
    };
  }

  // 3. Update status and save
  user.verificationStatus = "pending";
  await user.save();

  return {
    success: true,
    message: "Your verification request has been submitted and is now pending review.",
  };
};

// --- NEW: Submit for Verification ---
export const submitForVerification = async (req, res) => {
  try {
    const { id } = req.user;
    const result = await _submitUserForVerificationLogic(id);

    if (!result.success) {
      // Map internal messages to appropriate HTTP status codes
      const statusCode = result.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({ error: result.message });
    }

    // 4. Respond
    res.status(200).json({
      message: result.message,
    });
  } catch (error) {
    console.error("Submit for Verification Error:", error);
    res.status(500).json({ error: "Failed to submit for verification." });
  }
};

// --- NEW: Get User Details for Admin ---
export const getUserDetailsForAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Fetch user details with populated suspension history
  const user = await User.findById(id)
    .select("-password")
    .populate("suspensionDetails.suspendedBy", "name role")
    .populate("suspensionHistory.suspendedBy", "name role")
    .populate("suspensionHistory.reinstatedBy", "name role");

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // 2. Fetch Orders (as buyer and seller)
  const ordersAsBuyer = await Order.find({ buyerId: id }).sort({
    createdAt: -1,
  });
  const ordersAsSeller = await Order.find({ sellerId: id }).sort({
    createdAt: -1,
  });

  // 3. Calculate Earnings (from completed seller orders)
  const totalEarnings = ordersAsSeller
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + (order.price || 0), 0);

  // 4. Fetch Support Tickets
  const supportTickets = await SupportTicket.find({ userId: id }).sort({
    createdAt: -1,
  });

  // 5. Fetch Complaints/Reports (made by and against the user)
  const reportsMade = await Report.find({ reporterId: id }).sort({
    createdAt: -1,
  });
  const reportsAgainst = await Report.find({ reportedUserId: id }).sort({
    createdAt: -1,
  });

  // Fetch Wallet details
  const wallet = await Wallet.findOne({ userId: id });

  // 6. Assemble the response
  const userDetails = {
    user: user.toObject(),
    orders: {
      asBuyer: ordersAsBuyer,
      asSeller: ordersAsSeller,
    },
    earnings: {
      total: totalEarnings,
      walletBalance: wallet?.balance || 0,
      onHoldBalance: wallet?.onHoldBalance || 0,
    },
    supportTickets,
    complaints: {
      made: reportsMade,
      against: reportsAgainst,
    },
  };

  res.status(200).json({
    success: true,
    data: userDetails,
  });
});
