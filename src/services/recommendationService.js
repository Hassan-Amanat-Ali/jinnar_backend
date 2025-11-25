import User from '../models/User.js';
import Order from '../models/Order.js';

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
export const calculateSkillMatchScore = (worker, jobRequest) => {
  // Combine title and description for keyword matching
  const jobText = `${jobRequest.title || ''} ${jobRequest.description || ''}`.toLowerCase();
  const jobKeywords = jobText.match(/\b(\w+)\b/g) || []; // Extract words
  
  if (jobKeywords.length === 0) return 0;

  // Workers store skills as categories (e.g., "Plumbing")
  // We check if the worker's skills appear in the job description
  const workerSkills = worker.skills || []; // Assuming array of strings or objects
  
  let matchCount = 0;
  workerSkills.forEach(skill => {
    // If skill is object, extract name, else use string
    const skillName = (typeof skill === 'object' ? skill.name : skill).toLowerCase();
    if (jobText.includes(skillName)) matchCount++;
  });

  // Cap at 1.0 (if they match 1 relevant skill, that's usually good enough)
  return matchCount > 0 ? 1.0 : 0.0; 
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

export const recommendWorkers = async (jobRequest) => {
  console.log("🚀 Starting worker recommendation process for job request:", jobRequest);
  // 1. PRE-FILTERING (Database Level)
  // Only fetch sellers who are somewhat relevant to save memory
  // (e.g. match category or within broad radius)
  const query = { role: 'seller', isSuspended: false, isVerified: true };
  
  // If user selected a Category ID, strictly filter by that
  if (jobRequest.categoryId) {
    // Assuming you link Gigs or Users to Categories
    // For now, we fetch all valid sellers
  }

  const workers = await User.find(query)
    .select('name email skills availability selectedAreas rating averageResponseTime lastRecommendedAt')
    .limit(100); // Safety cap
  console.log(`✅ Found ${workers.length} potential workers from database.`);

  // 2. SCORING LOOP
  const scoredWorkers = await Promise.all(workers.map(async (worker) => {
    const scores = {
      skillMatch: calculateSkillMatchScore(worker, jobRequest),
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
    
    // console.log(`\n🤖 Scoring worker: ${worker.name} (${worker._id})`);
    // console.log('------------------------------------');
    // console.log(`- Skill Match:    ${scores.skillMatch.toFixed(2)} (Weight: ${weights.skillMatch}) -> Contribution: ${(scores.skillMatch * weights.skillMatch).toFixed(3)}`);
    // console.log(`- Distance:       ${scores.distance.toFixed(2)} (Weight: ${weights.distance}) -> Contribution: ${(scores.distance * weights.distance).toFixed(3)}`);
    // console.log(`- Rating:         ${scores.rating.toFixed(2)} (Weight: ${weights.rating}) -> Contribution: ${(scores.rating * weights.rating).toFixed(3)}`);
    // console.log(`- Response Speed: ${scores.responseSpeed.toFixed(2)} (Weight: ${weights.responseSpeed}) -> Contribution: ${(scores.responseSpeed * weights.responseSpeed).toFixed(3)}`);
    // console.log(`- Availability:   ${scores.availability.toFixed(2)} (Weight: ${weights.availability}) -> Contribution: ${(scores.availability * weights.availability).toFixed(3)}`);
    // console.log(`- Fairness:       ${scores.fairnessRotation.toFixed(2)} (Weight: ${weights.fairnessRotation}) -> Contribution: ${(scores.fairnessRotation * weights.fairnessRotation).toFixed(3)}`);
    // console.log('------------------------------------');
    // console.log(`=> Final Score: ${finalScore.toFixed(3)}`);


    return { worker, scores, finalScore };
  }));

  // 3. RANKING
  scoredWorkers.sort((a, b) => b.finalScore - a.finalScore);
  
  console.log("\n🏆 --- Top 10 Recommended Workers --- 🏆");
  scoredWorkers.slice(0, 10).forEach((w, index) => {
    console.log(`${index + 1}. ${w.worker.name} (Score: ${w.finalScore.toFixed(3)}) | Details: Skill=${w.scores.skillMatch.toFixed(2)}, Dist=${w.scores.distance.toFixed(2)}, Rating=${w.scores.rating.toFixed(2)}`);
  });


  // 4. UPDATE FAIRNESS TRACKER
  const top10 = scoredWorkers.slice(0, 10);
  const idsToUpdate = top10.map(i => i.worker._id);
  
  // Fire and forget update (don't await)
  User.updateMany({ _id: { $in: idsToUpdate } }, { $set: { lastRecommendedAt: new Date() } }).exec();

  // Return Clean Data
  return top10.map(item => ({
    ...item.worker.toObject(),
    matchScore: Math.round(item.finalScore * 100) // Return percentage for UI
  }));
};
