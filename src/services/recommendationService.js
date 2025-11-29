// recommendationEngine.js
// DROP-IN REPLACEMENT — Just replace your old file with this one

import User from '../models/User.js';
import Order from '../models/Order.js';
import Gig from '../models/Gig.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION (Tuned for all service types)
// ─────────────────────────────────────────────────────────────────────────────
export const weights = {
  relevance: 0.60,        // TF-IDF text similarity — now the main driver
  distance: 0.15,         // Still important for local services
  rating: 0.10,
  availability: 0.08,
  responseSpeed: 0.05,
  fairnessRotation: 0.02,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. TF-IDF ENGINE (Self-contained, no external libs)
// ─────────────────────────────────────────────────────────────────────────────

// Simple tokenizer (supports English + Urdu + mixed text)
const tokenize = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, ' ')  // Keep letters & numbers only
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
};

// In-memory IDF cache (will be built on first request)
let IDF = null;
let TOTAL_GIGS = 0;

const buildIDF = async () => {
  const gigs = await Gig.find({ status: 'active' })
    .select('title description skills')
    .lean();

  TOTAL_GIGS = gigs.length;
  if (TOTAL_GIGS === 0) return;

  const docFrequency = {};

  gigs.forEach(gig => {
    const text = `${gig.title || ''} ${gig.description || ''} ${(gig.skills || []).join(' ')}`;
    const uniqueTerms = new Set(tokenize(text));
    uniqueTerms.forEach(term => {
      docFrequency[term] = (docFrequency[term] || 0) + 1;
    });
  });

  // IDF = log(total_docs / (1 + docs_containing_term))
  IDF = {};
  Object.keys(docFrequency).forEach(term => {
    IDF[term] = Math.log(TOTAL_GIGS / (1 + docFrequency[term]));
  });

  console.log(`TF-IDF index built: ${Object.keys(IDF).length} terms from ${TOTAL_GIGS} gigs`);
};

// Call this once on server startup (see note below)
export const initializeRecommendationEngine = async () => {
  await buildIDF();
  // Rebuild every 6 hours to catch new gigs
  setInterval(buildIDF, 6 * 60 * 60 * 1000);
};

// ── Relevance Score: TF-IDF Cosine Similarity (Universal & Accurate) ─────
const calculateRelevanceScore = (gig, jobText) => {
  if (!IDF || TOTAL_GIGS === 0) return 0.1; // fallback

  const queryTokens = tokenize(jobText);
  if (queryTokens.length === 0) return 0.1;

  const gigText = `${gig.title || ''} ${gig.description || ''} ${(gig.skills || []).join(' ')}`;
  const gigTokens = tokenize(gigText);

  // Build TF vectors
  const queryTF = {};
  queryTokens.forEach(t => queryTF[t] = (queryTF[t] || 0) + 1);
  const maxQuery = Math.max(...Object.values(queryTF));
  Object.keys(queryTF).forEach(k => queryTF[k] /= maxQuery);

  const gigTF = {};
  gigTokens.forEach(t => gigTF[t] = (gigTF[t] || 0) + 1);
  const maxGig = Math.max(...Object.values(gigTF) || [1]);
  Object.keys(gigTF).forEach(k => gigTF[k] /= maxGig);

  // Cosine similarity
  let dot = 0;
  let qMag = 0;
  let gMag = 0;

  queryTokens.forEach(term => {
    const q = (queryTF[term] || 0) * (IDF[term] || 1.0);
    const g = (gigTF[term] || 0) * (IDF[term] || 1.0);
    dot += q * g;
    qMag += q * q;
  });

  if (qMag === 0) return 0;

  queryTokens.forEach(term => {
    if (gigTF[term]) {
      const g = (gigTF[term] || 0) * (IDF[term] || 1.0);
      gMag += g * g;
    }
  });

  if (gMag === 0) return 0;
  return dot / (Math.sqrt(qMag) * Math.sqrt(gMag));
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SCORING FUNCTIONS (Only distance/availability/fairness changed slightly)
// ─────────────────────────────────────────────────────────────────────────────

// Distance: Same logic, just more forgiving for remote jobs
export const calculateDistanceScore = (worker, jobRequest) => {
  if (!jobRequest.lat || !jobRequest.lng) return 0.7; // neutral
  if (!worker.selectedAreas || worker.selectedAreas.length === 0) return 0.5;

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  let minDist = Infinity;
  worker.selectedAreas.forEach(area => {
    const [lng, lat] = area.coordinates;
    const dist = getDistanceFromLatLonInKm(jobRequest.lat, jobRequest.lng, lat, lng);
    if (dist < minDist) minDist = dist;
  });

  if (minDist <= 3) return 1.0;
  if (minDist >= 50) return 0.3;   // not zero → still show remote experts
  return Math.max(0.3, 1 - (minDist - 3) / 47);
};

export const calculateAvailabilityScore = (worker, jobRequest) => {
  if (!jobRequest.date) return 1;
  const jobDate = new Date(jobRequest.date);
  const dayName = jobDate.toLocaleString('en-US', { weekday: 'long' });
  return worker.availability?.some(d => d.day === dayName && d.isActive) ? 1 : 0.3;
};

export const calculateFairnessRotationScore = (worker) => {
  if (!worker.lastRecommendedAt) return 1.0;
  const hoursSince = (Date.now() - new Date(worker.lastRecommendedAt)) / 36e5;
  return Math.min(hoursSince / 96, 1.0); // full boost after 4 days
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN ENGINE (Drop-in replacement)
// ─────────────────────────────────────────────────────────────────────────────
export const recommendGigs = async (jobRequest) => {
  console.log("Starting recommendation for:", jobRequest.title || jobRequest.description);

  const jobText = `${jobRequest.title || ''} ${jobRequest.description || ''}`.trim();

  const query = { 
    status: 'active',
  };

  if (jobRequest.categoryId) {
    query.category = jobRequest.categoryId;
  }

  // NEW: Filter by subcategory if provided
  if (jobRequest.subcategoryId) {
    query.$or = [
      { primarySubcategory: jobRequest.subcategoryId },
      { extraSubcategories: jobRequest.subcategoryId }
    ];
  }

  const gigs = await Gig.find(query)
    .populate({
      path: 'sellerId',
      select: 'name rating averageResponseTime availability selectedAreas lastRecommendedAt isVerified',
      match: { isSuspended: false, isVerified: true }
    })
    .populate({
      path: 'category', select: 'isActive'
    })
    .limit(150)
    .lean();

  const validGigs = gigs.filter(g => g.sellerId);

  const scoredGigs = validGigs.map(gig => {
    // NEW: Exclude gigs from inactive categories
    if (gig.category && gig.category.isActive === false) {
      return null;
    }

    const worker = gig.sellerId;

    const scores = {
      relevance: calculateRelevanceScore(gig, jobText),
      distance: calculateDistanceScore(worker, jobRequest),
      rating: (worker.rating?.average || 0) / 5,
      responseSpeed: worker.averageResponseTime ? Math.max(0.3, 1 - worker.averageResponseTime / 300) : 0.7,
      availability: calculateAvailabilityScore(worker, jobRequest),
      fairnessRotation: calculateFairnessRotationScore(worker),
    };

    const finalScore = Object.keys(weights).reduce((sum, key) => {
      return sum + scores[key] * weights[key];
    }, 0);

    return { gig, worker, scores, finalScore };
  }).filter(Boolean); // Filter out null (inactive category) entries

  scoredGigs.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  // Log top 10 for debugging
  console.log("\nTop 10 Recommendations:");
  scoredGigs.slice(0, 10).forEach((s, i) => {
    console.log(`${i+1}. ${s.gig.title} → Score: ${s.finalScore.toFixed(3)} (Rel: ${s.scores.relevance.toFixed(3)})`);
  });

  // Update fairness rotation
  const top10Ids = scoredGigs.slice(0, 10).map(s => s.worker._id);
  if (top10Ids.length > 0) {
    User.updateMany({ _id: { $in: top10Ids } }, { lastRecommendedAt: new Date() }).exec();
  }

  const format = (item, isTop) => ({
    ...item.gig,
    sellerId: {
      _id: item.worker._id,
      name: item.worker.name,
      rating: item.worker.rating,
    },
    isTopRecommended: isTop,
    matchScore: Math.round(item.finalScore * 100),
  });

  return {
    topRecommended: scoredGigs.slice(0, 2).map(s => format(s, true)),
    otherGigs: scoredGigs.slice(2, 20).map(s => format(s, false)),
  };
};