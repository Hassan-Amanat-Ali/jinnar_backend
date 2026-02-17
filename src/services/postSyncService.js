import Post from "../models/Post.js";
import User from "../models/User.js";
import Draw from "../models/Draw.js";

// Reuse the Facebook engagement helper
import { getEngagement } from "./facebookEngagementService.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function syncDuePosts() {
  const cutoff = new Date(Date.now() - ONE_DAY_MS);
  // Find posts that are verified and haven't been synced for 24+ hours (or never synced)
  const posts = await Post.find({
    verified: true,
    $or: [{ lastSyncedAt: { $lt: cutoff } }, { lastSyncedAt: null }],
  }).limit(1000);

  let updatedCount = 0;
  for (const post of posts) {
    try {
      const draw = await Draw.findById(post.drawId).lean();
      if (!draw) {
        console.log(`Skipping post ${post._id}: draw not found`);
        continue;
      }
      // Only resync if draw is active
      if (draw.status !== "active") {
        console.log(`Skipping post ${post._id}: draw ${draw._id} not active (${draw.status})`);
        continue;
      }

      const user = await User.findById(post.userId).select("+socialAccounts.facebook.accessToken").lean();
      const token = user?.socialAccounts?.facebook?.accessToken;
      if (!token) {
        console.log(`Skipping post ${post._id}: no facebook token for user ${post.userId}`);
        continue;
      }

      const engagement = await getEngagement(post.postId, token);
      if (!engagement) {
        console.log(`No engagement data for post ${post._id} (${post.postId})`);
        // still update lastSyncedAt to avoid tight retry loops
        post.lastSyncedAt = new Date();
        await post.save();
        continue;
      }

      // Compare and update if changed
      const changed = (
        (engagement.likes || 0) !== (post.engagement.likes || 0) ||
        (engagement.comments || 0) !== (post.engagement.comments || 0) ||
        (engagement.shares || 0) !== (post.engagement.shares || 0)
      );

      post.engagement = engagement;
      post.lastSyncedAt = new Date();
      post.calculatePoints();
      await post.save();

      if (post.verified) {
        // Recalculate user's total points across verified posts
        const sum = await Post.aggregate([
          { $match: { userId: post.userId, verified: true } },
          { $group: { _id: null, total: { $sum: "$points" } } },
        ]);
        const totalPoints = sum[0]?.total ?? 0;
        await User.findByIdAndUpdate(post.userId, { totalPoints });
      }

      if (changed) updatedCount++;
      console.log(`Synced post ${post._id} (${post.postId}), changed=${changed}`);
    } catch (err) {
      console.error(`Error syncing post ${post._id}:`, err?.message || err);
    }
  }

  return { scanned: posts.length, updated: updatedCount };
}

export default { syncDuePosts };
