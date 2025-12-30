import { getCoordinatesFromAddress } from "../utils/geocoding.js";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

export const findWorkersNearYou = asyncHandler(async (req, res) => {
  const {
    address,
    radius = 50, // bigger default so user ALWAYS sees something
    page = 1,
    limit = 10,
  } = req.query;

  let userLat = null;
  let userLng = null;

  // -------------------------
  // Resolve user location
  // -------------------------
  if (address) {
    const location = await getCoordinatesFromAddress(address);
    if (!location) {
      return res.status(400).json({
        success: false,
        message: "Unable to determine your location",
      });
    }
    userLat = location.lat;
    userLng = location.lng;
  } else {
    return res.status(400).json({
      success: false,
      message: "Address is required to find nearby workers",
    });
  }

  const parsedRadius = parseFloat(radius);
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  // -------------------------
  // Fetch all active sellers
  // -------------------------
  const sellers = await User.find({
    role: "seller",
    isSuspended: false,
  })
    .select(`
      name
      profilePicture
      bio
      skills
      rating
      preferredAreas
      availability
      averageResponseTime
      verificationStatus
      categories
    `)
    .populate("categories", "name");

  // -------------------------
  // Calculate distance
  // -------------------------
  const sellersWithDistance = sellers
    .map((seller) => {
      let closestDistance = null;

      const areas = Array.isArray(seller.preferredAreas)
        ? seller.preferredAreas
        : [];

      for (const area of areas) {
        if (!area?.coordinates || area.coordinates.length < 2) continue;

        const [lng, lat] = area.coordinates;

        const distance = haversineDistance(
          userLat,
          userLng,
          lat,
          lng
        );

        if (closestDistance === null || distance < closestDistance) {
          closestDistance = distance;
        }
      }

      if (closestDistance === null) return null;

      return {
        ...seller.toObject(),
        distance: closestDistance,
      };
    })
    .filter(
      (seller) =>
        seller && seller.distance <= parsedRadius
    );

  // -------------------------
  // Sort by nearest first
  // -------------------------
  sellersWithDistance.sort((a, b) => a.distance - b.distance);

  // -------------------------
  // Pagination
  // -------------------------
  const totalResults = sellersWithDistance.length;

  const paginated = sellersWithDistance.slice(
    (parsedPage - 1) * parsedLimit,
    parsedPage * parsedLimit
  );

  // -------------------------
  // Response mapping
  // -------------------------
  const response = paginated.map((seller) => ({
    id: seller._id,
    name: seller.name,
    profilePicture: seller.profilePicture,
    bio: seller.bio,
    skills: seller.skills,
    categories: seller.categories,
    availability: seller.availability,
    responseTime: seller.averageResponseTime,
    verificationStatus: seller.verificationStatus,

    rating: {
      average: seller.rating?.average ?? 0,
      count: seller.rating?.count ?? 0,
    },

    distance: Number(seller.distance.toFixed(2)),
  }));

  res.json({
    success: true,
    data: response,
    pagination: {
      currentPage: parsedPage,
      totalPages: Math.ceil(totalResults / parsedLimit),
      totalResults,
      limit: parsedLimit,
    },
  });
});


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