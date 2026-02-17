import Draw from "../models/Draw.js";
import Submission from "../models/Submission.js";
import Post from "../models/Post.js";
import Reward from "../models/Reward.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// ==================== DRAWS (Public) ====================

export const listDraws = async (req, res, next) => {
  try {
    const status = req.query.status; // active | upcoming | closed | archived
    const filter = {};
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: ["active", "upcoming"] };
    }
    const draws = await Draw.find(filter)
      .sort({ startDate: 1 })
      .select("title theme hashtags startDate endDate prizePool status")
      .lean();
    res.json({ success: true, data: draws });
  } catch (err) {
    next(err);
  }
};

export const getDraw = async (req, res, next) => {
  try {
    const draw = await Draw.findById(req.params.id).lean();
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }
    res.json({ success: true, data: draw });
  } catch (err) {
    next(err);
  }
};

// ==================== DRAWS (Admin) ====================

export const listAdminDraws = async (req, res, next) => {
  try {
    const draws = await Draw.find({}).sort({ startDate: -1 }).lean();
    res.json({ success: true, data: draws });
  } catch (err) {
    next(err);
  }
};

export const createDraw = async (req, res, next) => {
  try {
    const { title, theme, hashtags, startDate, endDate, prizePool, status } = req.body;
    const draw = await Draw.create({
      title,
      theme,
      hashtags: hashtags || [],
      startDate,
      endDate,
      prizePool: prizePool ?? 0,
      status: status || "upcoming",
    });
    res.status(201).json({ success: true, data: draw });
  } catch (err) {
    next(err);
  }
};

export const updateDraw = async (req, res, next) => {
  try {
    const draw = await Draw.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }
    res.json({ success: true, data: draw });
  } catch (err) {
    next(err);
  }
};

// ==================== SUBMISSIONS (Participant) ====================

export const createSubmission = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { drawId, title } = req.body;
    if (!drawId) {
      return res.status(400).json({ success: false, error: "drawId is required" });
    }
    const videoUrl = req.file ? `/${req.file.path.replace(/\\/g, "/")}` : null;
    if (!videoUrl) {
      return res.status(400).json({ success: false, error: "Video file is required" });
    }

    const draw = await Draw.findById(drawId);
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }
    if (draw.status !== "active") {
      return res.status(400).json({ success: false, error: "Draw is not active" });
    }

    const existing = await Submission.findOne({ userId, drawId });
    if (existing) {
      return res.status(409).json({ success: false, error: "One submission per user per draw" });
    }

    const submission = await Submission.create({
      userId,
      drawId,
      videoUrl,
      title: title || null,
      status: "pending",
    });
    await submission.populate("drawId", "title theme status");
    res.status(201).json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
};

// Variant that accepts both video and a thumbnail/screenshot in one multipart request
export const createSubmissionWithThumbnail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { drawId, title } = req.body;
    if (!drawId) {
      return res.status(400).json({ success: false, error: "drawId is required" });
    }

    const videoFile = req.files && req.files.video && req.files.video[0];
    const screenshotFile = req.files && req.files.screenshot && req.files.screenshot[0];

    const videoUrl = videoFile ? `/${videoFile.path.replace(/\\/g, "/")}` : null;
    if (!videoUrl) {
      return res.status(400).json({ success: false, error: "Video file is required" });
    }

    const thumbnailUrl = screenshotFile ? `/${screenshotFile.path.replace(/\\/g, "/")}` : null;

    const draw = await Draw.findById(drawId);
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }
    if (draw.status !== "active") {
      return res.status(400).json({ success: false, error: "Draw is not active" });
    }

    const existing = await Submission.findOne({ userId, drawId });
    if (existing) {
      return res.status(409).json({ success: false, error: "One submission per user per draw" });
    }

    const submission = await Submission.create({
      userId,
      drawId,
      videoUrl,
      thumbnailUrl: thumbnailUrl || null,
      title: title || null,
      status: "pending",
    });
    await submission.populate("drawId", "title theme status");
    res.status(201).json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
};

export const listMySubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ userId: req.user._id })
      .populate("drawId", "title theme startDate endDate status")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};

export const getMySubmission = async (req, res, next) => {
  try {
    const submission = await Submission.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .populate("drawId", "title theme startDate endDate status hashtags")
      .lean();
    if (!submission) {
      return res.status(404).json({ success: false, error: "Submission not found" });
    }
    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
};

// ==================== POST PROOF ====================

export const createPost = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { submissionId, drawId, platform, postId } = req.body;
    const screenshotUrl = req.file ? `/${req.file.path.replace(/\\/g, "/")}` : null;

    if (!submissionId || !drawId || !platform || !postId) {
      return res.status(400).json({
        success: false,
        error: "submissionId, drawId, platform, and postId are required",
      });
    }

    // Ensure the draw exists and is active
    const draw = await Draw.findById(drawId).lean();
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }
    if (draw.status !== "active") {
      return res.status(400).json({ success: false, error: "Draw is not active" });
    }

    // Ensure the submission exists, belongs to user, is for this draw, and is approved
    const submission = await Submission.findOne({
      _id: submissionId,
      userId,
      drawId,
      status: "approved",
    });
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: "Approved submission not found for this user and draw",
      });
    }

    const platformLower = platform.toLowerCase();
    if (!["tiktok", "facebook", "instagram", "youtube"].includes(platformLower)) {
      return res.status(400).json({ success: false, error: "Invalid platform" });
    }

    const { getEngagement } = await import("../services/facebookEngagementService.js");

    // If parsing failed for Facebook permalinks/share links, try the Graph lookup fallback using the user's token
    let fbToken = null;
    if (!postId && platformLower === 'facebook') {
      const userWithToken = await User.findById(userId).select("+socialAccounts.facebook.accessToken").lean();
      fbToken = userWithToken?.socialAccounts?.facebook?.accessToken;
      if (fbToken) {
        try {
          const lookupUrl = `https://graph.facebook.com/v24.0/?id=${encodeURIComponent(postId)}&access_token=${encodeURIComponent(fbToken)}`;
          const lookupRes = await fetch(lookupUrl);
          console.log('Facebook Graph lookup for permalink:', lookupUrl, 'Response status:', lookupRes);
          const lookupData = await lookupRes.json();
          // Graph may return an 'id' or an 'og_object.id'
          if (lookupData && (lookupData.id || (lookupData.og_object && lookupData.og_object.id))) {
            postId = lookupData.id || lookupData.og_object.id;
          }
        } catch (e) {
          console.warn('Facebook Graph lookup failed for permalink:', e?.message || e);
        }
      }
    }

    if (!postId) {
      return res.status(400).json({ success: false, error: "Could not parse post ID from URL" });
    }

    const existingPost = await Post.findOne({ platform: platformLower, postId });
    if (existingPost) {
      return res.status(409).json({ success: false, error: "This post has already been submitted" });
    }

    let engagement = { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 };
    let verified = false;

    if (platformLower === "facebook") {
      // Use token we may have already fetched during lookup fallback, otherwise fetch now
      const userWithToken = fbToken ? null : await User.findById(userId).select("+socialAccounts.facebook.accessToken").lean();
      const token = fbToken || userWithToken?.socialAccounts?.facebook?.accessToken;
      if (token) {
        try {
          let apiEngagement = await getEngagement(postId, token);
          // If engagement fetch failed with the numeric-only postId, try resolving canonical id via Graph lookup
          if (!apiEngagement) {
            try {
              const lookupUrl = `https://graph.facebook.com/v24.0/?id=${encodeURIComponent(postId)}&access_token=${encodeURIComponent(token)}`;
              const lookupRes = await fetch(lookupUrl);
              const lookupData = await lookupRes.json();
              const resolvedId = lookupData?.id || lookupData?.og_object?.id || null;
              if (resolvedId && resolvedId !== postId) {
                // retry engagement with resolved id
                const retryEngagement = await getEngagement(resolvedId, token);
                if (retryEngagement) {
                  apiEngagement = retryEngagement;
                  // update postId to canonical
                  postId = resolvedId;
                }
              }
            } catch (lookupErr) {
              console.warn('Facebook Graph lookup retry failed:', lookupErr?.message || lookupErr);
            }
          }

          if (apiEngagement) {
            engagement = apiEngagement;
            verified = true;
          }
        } catch (e) {
          console.warn("Facebook API engagement fetch failed:", e.message);
        }
      }
    }

    const post = new Post({
      userId,
      drawId,
      submissionId,
      platform: platformLower,
      postId,
      postId,
      engagement,
      screenshotUrl: screenshotUrl || undefined,
      verified,
    });
    post.calculatePoints();
    await post.save();

    if (verified) {
      await updateUserTotalPoints(userId);
    }

    const populated = await Post.findById(post._id)
      .populate("drawId", "title")
      .populate("submissionId", "title")
      .lean();
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

async function updateUserTotalPoints(userId) {
  const sum = await Post.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), verified: true } },
    { $group: { _id: null, total: { $sum: "$points" } } },
  ]);
  const totalPoints = sum[0]?.total ?? 0;
  await User.findByIdAndUpdate(userId, { totalPoints });
}

// ==================== LEADERBOARD ====================

export const getLeaderboard = async (req, res, next) => {
  try {
    const { drawId, scope = "global", country, city, limit = 50, offset = 0 } = req.query;
    if (!drawId) {
      return res.status(400).json({ success: false, error: "drawId is required" });
    }

    const match = { drawId: new mongoose.Types.ObjectId(drawId), verified: true };
    const pipeline = [
      { $match: match },
      { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ];

    if (scope === "country" && country) {
      pipeline.push({ $match: { "user.country": country } });
    } else if (scope === "city" && city) {
      pipeline.push({ $match: { "user.city": city } });
    }

    pipeline.push(
      { $sort: { totalPoints: -1 } },
      { $skip: parseInt(offset, 10) || 0 },
      { $limit: Math.min(parseInt(limit, 10) || 50, 100) }
    );

    const results = await Post.aggregate(pipeline);
    const withRank = results.map((r, i) => ({
      rank: (parseInt(offset, 10) || 0) + i + 1,
      userId: r._id,
      name: r.user?.name,
      profilePicture: r.user?.profilePicture,
      country: r.user?.country,
      city: r.user?.city,
      totalPoints: r.totalPoints,
    }));

    res.json({ success: true, data: withRank });
  } catch (err) {
    next(err);
  }
};

export const getMyRank = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { drawId } = req.query;
    if (!drawId) {
      return res.status(400).json({ success: false, error: "drawId is required" });
    }

    const myPoints = await Post.aggregate([
      { $match: { drawId: new mongoose.Types.ObjectId(drawId), userId: new mongoose.Types.ObjectId(userId), verified: true } },
      { $group: { _id: null, totalPoints: { $sum: "$points" } } },
    ]);
    const totalPoints = myPoints[0]?.totalPoints ?? 0;

    const rankPipeline = [
      { $match: { drawId: new mongoose.Types.ObjectId(drawId), verified: true } },
      { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
      { $sort: { totalPoints: -1 } },
      { $group: { _id: null, ids: { $push: "$_id" } } },
    ];
    const [rankResult] = await Post.aggregate(rankPipeline);
    const ids = rankResult?.ids || [];
    const globalRank = ids.findIndex((id) => id.toString() === userId.toString()) + 1 || null;

    const user = await User.findById(userId).select("country city").lean();
    let countryRank = null;
    let cityRank = null;
    if (user?.country) {
      const countryUserIds = await User.find({ country: user.country }).distinct("_id");
      const countryLeaders = await Post.aggregate([
        { $match: { drawId: new mongoose.Types.ObjectId(drawId), verified: true, userId: { $in: countryUserIds } } },
        { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
        { $sort: { totalPoints: -1 } },
      ]);
      countryRank = countryLeaders.findIndex((r) => r._id.toString() === userId.toString()) + 1 || null;
    }
    if (user?.city) {
      const cityUserIds = await User.find({ city: user.city }).distinct("_id");
      const cityLeaders = await Post.aggregate([
        { $match: { drawId: new mongoose.Types.ObjectId(drawId), verified: true, userId: { $in: cityUserIds } } },
        { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
        { $sort: { totalPoints: -1 } },
      ]);
      cityRank = cityLeaders.findIndex((r) => r._id.toString() === userId.toString()) + 1 || null;
    }

    res.json({
      success: true,
      data: { drawId, totalPoints, globalRank, countryRank, cityRank },
    });
  } catch (err) {
    next(err);
  }
};

// ==================== POINTS ====================

export const getMyPoints = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { drawId } = req.query;

    const match = { userId: new mongoose.Types.ObjectId(userId), verified: true };
    if (drawId) match.drawId = new mongoose.Types.ObjectId(drawId);

    const [totalResult, posts] = await Promise.all([
      Post.aggregate([{ $match: match }, { $group: { _id: null, totalPoints: { $sum: "$points" } } }]),
      Post.find(match).sort({ createdAt: -1 }).limit(50).populate("drawId", "title").lean(),
    ]);

    const totalPoints = totalResult[0]?.totalPoints ?? 0;
    res.json({ success: true, data: { totalPoints, posts } });
  } catch (err) {
    next(err);
  }
};

// ==================== REWARDS & WINNERS ====================

export const getWinners = async (req, res, next) => {
  try {
    const rewards = await Reward.find({ drawId: req.params.drawId })
      .populate("winnerUserId", "name profilePicture country")
      .sort({ rank: 1 })
      .lean();
    res.json({ success: true, data: rewards });
  } catch (err) {
    next(err);
  }
};

export const getMyRewards = async (req, res, next) => {
  try {
    const rewards = await Reward.find({ winnerUserId: req.user._id })
      .populate("drawId", "title endDate")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: rewards });
  } catch (err) {
    next(err);
  }
};

// ==================== PUBLIC: Latest Draw + Participants ====================
/**
 * GET /api/viral/draws/latest/participants
 * Returns the most relevant draw (active -> upcoming -> most recent closed) and the list of participants
 * Query params: ?limit=50&offset=0
 */
export const getLatestDrawWithParticipants = async (req, res, next) => {
  try {
    // 1) Try to find an active draw (nearest endDate)
    let draw = await Draw.findOne({ status: "active" }).sort({ endDate: 1 }).lean();

    // 2) If none active, pick the next upcoming draw (nearest startDate)
    if (!draw) {
      draw = await Draw.findOne({ status: "upcoming" }).sort({ startDate: 1 }).lean();
    }

    // 3) If still none, pick the most recently closed draw
    if (!draw) {
      draw = await Draw.findOne({ status: "closed" }).sort({ endDate: -1 }).lean();
    }

    if (!draw) {
      return res.status(404).json({ success: false, error: "No draws found" });
    }

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const offset = parseInt(req.query.offset || "0", 10) || 0;

    // Aggregate participants from Submissions
    const pipeline = [
      { $match: { drawId: new mongoose.Types.ObjectId(draw._id) } },
      {
        $group: {
          _id: "$userId",
          submissionsCount: { $sum: 1 },
          lastSubmittedAt: { $max: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$user._id",
          name: "$user.name",
          profilePicture: "$user.profilePicture",
          country: "$user.country",
          city: "$user.city",
          submissionsCount: 1,
          lastSubmittedAt: 1,
        },
      },
      { $sort: { submissionsCount: -1, lastSubmittedAt: 1 } },
      { $skip: offset },
      { $limit: limit },
    ];

    const participants = await Submission.aggregate(pipeline);

    return res.json({ success: true, data: { draw, participants, count: participants.length } });
  } catch (err) {
    next(err);
  }
};

// ==================== ADMIN: REWARDS & CLOSE DRAW ====================

export const createRewards = async (req, res, next) => {
  try {
    const { drawId } = req.params;
    const rewards = req.body; // array of { rank, rewardType, amount }
    if (!Array.isArray(rewards) || rewards.length === 0) {
      return res.status(400).json({ success: false, error: "Body must be an array of { rank, rewardType, amount }" });
    }
    const created = await Reward.insertMany(
      rewards.map((r) => ({ drawId, rank: r.rank, rewardType: r.rewardType, amount: r.amount }))
    );
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
};

export const closeDraw = async (req, res, next) => {
  try {
    const { drawId } = req.params;
    const draw = await Draw.findById(drawId);
    if (!draw) {
      return res.status(404).json({ success: false, error: "Draw not found" });
    }

    const leaderboard = await Post.aggregate([
      { $match: { drawId: new mongoose.Types.ObjectId(drawId), verified: true } },
      { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
      { $sort: { totalPoints: -1 } },
    ]);

    const rewards = await Reward.find({ drawId }).sort({ rank: 1 });
    for (const reward of rewards) {
      const winner = leaderboard[reward.rank - 1];
      if (winner) {
        reward.winnerUserId = winner._id;
        reward.status = "pending";
        await reward.save();
      }
    }

    draw.status = "closed";
    await draw.save();

    res.json({ success: true, data: draw, message: "Draw closed and winners assigned" });
  } catch (err) {
    next(err);
  }
};

// ==================== ADMIN: SUBMISSIONS ====================

export const listAdminSubmissions = async (req, res, next) => {
  try {
    const { status = "pending", drawId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (drawId) filter.drawId = drawId;
    const submissions = await Submission.find(filter)
      .populate("userId", "name profilePicture email")
      .populate("drawId", "title theme status")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};

export const updateSubmission = async (req, res, next) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "status must be approved or rejected" });
    }
    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNotes: reviewNotes || null,
        reviewerId: req.user._id,
      },
      { new: true }
    ).populate("drawId", "title");
    if (!submission) {
      return res.status(404).json({ success: false, error: "Submission not found" });
    }
    res.json({ success: true, data: submission });
  } catch (err) {
    next(err);
  }
};

// ==================== ADMIN: POSTS ====================

export const updatePost = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.verified !== undefined) updates.verified = req.body.verified;
    if (req.body.fraudFlag !== undefined) updates.fraudFlag = req.body.fraudFlag;
    if (req.body.engagement) updates.engagement = req.body.engagement;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    if (updates.engagement) {
      Object.assign(post.engagement, updates.engagement);
      post.calculatePoints();
    }
    Object.assign(post, updates);
    await post.save();

    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

// Sync a single post's engagement from platform and recalculate points
export const syncPostEngagement = async (req, res, next) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    // Authorization: owner or super_admin
    const isOwner = post.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: 'Not authorized' });

    const platform = post.platform;
    let engagement = null;

    if (platform === 'facebook') {
      const user = await User.findById(post.userId).select('+socialAccounts.facebook.accessToken').lean();
      const token = user?.socialAccounts?.facebook?.accessToken;
      if (!token) return res.status(400).json({ success: false, error: 'No Facebook access token available for this user' });
      const { getEngagement } = await import('../services/facebookEngagementService.js');
      console.log("lkjsdkhks >>>",post,token);
      engagement = await getEngagement(post.postId, token);
    } else {
      // For other platforms you'd implement similar services
      return res.status(400).json({ success: false, error: 'Sync not implemented for this platform' });
    }

    if (!engagement) {
      return res.status(502).json({ success: false, error: 'Failed to fetch engagement from platform' });
    }

    // Apply engagement and recalc points
    post.engagement = engagement;
    post.lastSyncedAt = new Date();
    post.calculatePoints();
    await post.save();

    // Update user's total points (only counts verified posts)
    if (post.verified) await updateUserTotalPoints(post.userId);

    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

// Fetch Facebook posts for the authenticated user using their stored access token
export const getFacebookPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('+socialAccounts.facebook.accessToken').lean();
    const token = user?.socialAccounts?.facebook?.accessToken;
    if (!token) return res.status(400).json({ success: false, error: 'No Facebook access token available for this user' });

    // Build Graph API URL
    const fields = encodeURIComponent('id,permalink_url,created_time,message');
    const url = `https://graph.facebook.com/v24.0/me/posts?fields=${fields}&access_token=${encodeURIComponent(token)}`;

    const resp = await fetch(url);
    const data = await resp.json();
    if (data.error) {
      console.warn('Facebook API error fetching posts:', data.error);
      return res.status(502).json({ success: false, error: 'Facebook API error', details: data.error });
    }

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Get engagement for a specific Facebook post id and compute points using Post formula
export const getFacebookPostEngagement = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params; // expects Graph post id like '121281..._911761...'
    if (!postId) return res.status(400).json({ success: false, error: 'postId is required' });

    const user = await User.findById(userId).select('+socialAccounts.facebook.accessToken').lean();
    const token = user?.socialAccounts?.facebook?.accessToken;
    if (!token) return res.status(400).json({ success: false, error: 'No Facebook access token available for this user' });

    const { getEngagement } = await import('../services/facebookEngagementService.js');
    console.log('Fetching engagement for postId:', postId);
    const engagement = await getEngagement(postId, token);
    if (!engagement) return res.status(502).json({ success: false, error: 'Failed to fetch engagement from Facebook' });

    // Compute points using same formula as Post.calculatePoints
    const likes = engagement.likes || 0;
    const comments = engagement.comments || 0;
    const shares = engagement.shares || 0;
    const saves = engagement.saves || 0;
    const views = engagement.views || 0;

    const calculated = likes * 1 + comments * 2 + shares * 3 + saves * 2 + views * 0.1;
    const points = Math.floor(calculated);

    return res.json({ success: true, data: { engagement, points } });
  } catch (err) {
    next(err);
  }
};

// ==================== ADMIN: ARCHIVE / UNARCHIVE ====================
export const archiveDraw = async (req, res, next) => {
  try {
    const { drawId } = req.params;
    const draw = await Draw.findById(drawId);
    if (!draw) return res.status(404).json({ success: false, error: 'Draw not found' });
    if (draw.status === 'archived') return res.status(400).json({ success: false, error: 'Draw is already archived' });
    draw.status = 'archived';
    await draw.save();
    res.json({ success: true, data: draw, message: 'Draw archived' });
  } catch (err) {
    next(err);
  }
};

export const unarchiveDraw = async (req, res, next) => {
  try {
    const { drawId } = req.params;
    const draw = await Draw.findById(drawId);
    if (!draw) return res.status(404).json({ success: false, error: 'Draw not found' });
    if (draw.status !== 'archived') return res.status(400).json({ success: false, error: 'Draw is not archived' });
    // Default unarchive target is 'closed' (past draw). If caller wants 'upcoming' they can update via PUT.
    draw.status = 'closed';
    await draw.save();
    res.json({ success: true, data: draw, message: 'Draw unarchived and set to closed' });
  } catch (err) {
    next(err);
  }
};
