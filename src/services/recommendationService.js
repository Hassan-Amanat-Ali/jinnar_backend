import User from '../models/User.js';
import Order from '../models/Order.js';
import Gig from '../models/Gig.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export const weights = {
  skillMatch: 0.3,
  distance: 0.25,       // Increased: In local services, proximity is king
  rating: 0.2,
  availability: 0.1,
  responseSpeed: 0.1,
  fairnessRotation: 0.05,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCORING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// A. SKILLS (0 to 1)
const STOP_WORDS = new Set(['i', 'a', 'an', 'the', 'in', 'on', 'for', 'with', 'is', 'am', 'are', 'want', 'need', 'looking', 'developer', 'expert', 'services']);

export const calculateSkillMatchScore = (gig, jobRequest) => {
  // Combine title and description for keyword matching
  const jobText = `${jobRequest.title || ''} ${jobRequest.description || ''}`.toLowerCase();
  const allKeywords = jobText.match(/\b(\w+)\b/g) || []; // Extract all words
  
  // Filter out common "stop words" to focus on meaningful terms
  const jobKeywords = allKeywords.filter(kw => !STOP_WORDS.has(kw));

  if (jobKeywords.length === 0) return 0;

  // Use the gig's title, description, and its own skills array for a comprehensive match
  const gigText = `${gig.title || ''} ${gig.description || ''}`.toLowerCase();
  const gigSkillsText = (gig.skills || []).join(' ').toLowerCase();
  
  let matchCount = 0;
  jobKeywords.forEach(keyword => {
    // Use a regular expression for a whole-word match to avoid partial matches (e.g., 'i' in 'plumbing')
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(gigText) || regex.test(gigSkillsText)) {
      matchCount++;
    }
  });

  // Normalize the score based on the number of keywords.
  // A higher number of matched keywords results in a better score.
  // Capped at 1.0.
  const score = matchCount / jobKeywords.length;
  
  return Math.min(score, 1.0);
};

// B. DISTANCE (0 to 1) - Haversine Formula
// Score = 1 if < 1km, 0 if > 20km, linear decay in between
export const calculateDistanceScore = (worker, jobRequest) => {
  if (!worker.selectedAreas || worker.selectedAreas.length === 0) return 0;
  if (!jobRequest.lat || !jobRequest.lng) return 1; // Default if no location

  // Helper: Get distance in KM
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  const deg2rad = (deg) => deg * (Math.PI / 180);

  // Find closest service area point to the job
  let minDist = Infinity;
  worker.selectedAreas.forEach(area => {
    // MongoDB GeoJSON stores as [lng, lat]
    const [wLng, wLat] = area.coordinates; 
    const dist = getDistanceFromLatLonInKm(jobRequest.lat, jobRequest.lng, wLat, wLng);
    if (dist < minDist) minDist = dist;
  });

  // Scoring Logic:
  // < 2km = 1.0 (Perfect)
  // > 20km = 0.0 (Too far)
  if (minDist <= 2) return 1.0;
  if (minDist >= 20) return 0.0;
  return 1 - (minDist / 20);
};

// C. AVAILABILITY (0 or 1)
export const calculateAvailabilityScore = (worker, jobRequest) => {
  if (!jobRequest.date) return 1; // Assume available if no date

  const jobDate = new Date(jobRequest.date);
  const dayName = jobDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Find the worker's schedule for this day
  const daySchedule = worker.availability.find(d => d.day === dayName && d.isActive);
  
  if (!daySchedule) return 0; // Not working that day

  // If specific hours are requested
  if (jobRequest.startTime) {
    const jobStart = parseInt(jobRequest.startTime.replace(":", ""));
    const workStart = parseInt(daySchedule.startTime.replace(":", ""));
    const workEnd = parseInt(daySchedule.endTime.replace(":", ""));

    // Check if job starts within working hours
    if (jobStart >= workStart && jobStart < workEnd) return 1;
    return 0;
  }

  return 1; // Available that day (general match)
};

// D. FAIRNESS (Boost new/unseen workers)
export const calculateFairnessRotationScore = (worker) => {
  if (!worker.lastRecommendedAt) return 1.0; // Max boost for newbies

  const now = new Date();
  const last = new Date(worker.lastRecommendedAt);
  const diffHours = (now - last) / 36e5;

  // If recommended recently (last 24h), give low score (0). 
  // If > 5 days ago, give high score (1).
  return Math.min(diffHours / 120, 1.0); 
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export const recommendGigs = async (jobRequest) => {
  console.log("🚀 Starting gig recommendation process for job request:", jobRequest);
  // 1. PRE-FILTERING (Database Level)
  // Fetch active gigs. Populate seller info needed for scoring.
  const query = { status: 'active' };
  
  // If user selected a Category ID, strictly filter by that
  if (jobRequest.categoryId) {
    query.category = jobRequest.categoryId;
  }

  const gigs = await Gig.find(query)
    .populate({
      path: 'sellerId',
      select: 'name email skills availability selectedAreas rating averageResponseTime lastRecommendedAt isVerified',
      match: { isSuspended: false, isVerified: true } // Only recommend gigs from verified, non-suspended sellers
    })
    .limit(100); // Safety cap

  // Filter out gigs where the seller was not found (due to the `match` condition in populate)
  const validGigs = gigs.filter(gig => gig.sellerId);
  console.log(`✅ Found ${validGigs.length} potential gigs from database.`);

  // 2. SCORING LOOP
  const scoredGigs = await Promise.all(validGigs.map(async (gig) => {
    const worker = gig.sellerId; // The populated seller document
    const scores = {
      skillMatch: calculateSkillMatchScore(gig, jobRequest),
      distance: calculateDistanceScore(worker, jobRequest),
      rating: (worker.rating?.average || 0) / 5,
      responseSpeed: worker.averageResponseTime ? (1 / (1 + worker.averageResponseTime / 60)) : 0.5,
      availability: calculateAvailabilityScore(worker, jobRequest),
      fairnessRotation: calculateFairnessRotationScore(worker),
    };
    // Calculate Weighted Average
    let finalScore = 0;
    for (const key in weights) {
      finalScore += (scores[key] || 0) * weights[key];
    }

    return { gig, scores, finalScore };
  }));

  // 3. RANKING
  scoredGigs.sort((a, b) => b.finalScore - a.finalScore);
  
  console.log("\n🏆 --- Top 10 Recommended Gigs --- 🏆");
  scoredGigs.slice(0, 10).forEach((g, index) => {
    console.log(`${index + 1}. ${g.gig.title} by ${g.gig.sellerId.name} (Score: ${g.finalScore.toFixed(3)}) | Details: Skill=${g.scores.skillMatch.toFixed(2)}, Dist=${g.scores.distance.toFixed(2)}, Rating=${g.scores.rating.toFixed(2)}`);
  });


  // 4. UPDATE FAIRNESS TRACKER
  const top10Gigs = scoredGigs.slice(0, 10);
  const sellerIdsToUpdate = top10Gigs.map(item => item.gig.sellerId._id);
  
  // Fire and forget update (don't await)
  User.updateMany({ _id: { $in: sellerIdsToUpdate } }, { $set: { lastRecommendedAt: new Date() } }).exec();

  // Return Clean Data
  const top2 = scoredGigs.slice(0, 2).map(item => ({
    ...item.gig.toObject(),
    isTopRecommended: true,
    matchScore: Math.round(item.finalScore * 100)
  }));

  const others = scoredGigs.slice(2, 10).map(item => ({
    ...item.gig.toObject(),
    isTopRecommended: false,
    matchScore: Math.round(item.finalScore * 100)
  }));

  return {
    topRecommended: top2,
    otherGigs: others
  };
};
