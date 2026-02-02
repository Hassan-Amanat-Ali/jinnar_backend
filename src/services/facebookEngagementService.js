/**
 * Parse platform post ID from URL (Facebook, TikTok, Instagram, YouTube).
 * Facebook: e.g. https://www.facebook.com/username/posts/123456 or ?v=123456
 */
export function getPostIdFromUrl(platform, postUrl) {
  if (!postUrl || typeof postUrl !== "string") return null;
  const url = postUrl.trim();
  try {
    if (platform === "facebook") {
      const u = new URL(url);
      const pathParts = u.pathname.split("/").filter(Boolean);
      const postsIdx = pathParts.indexOf("posts");
      if (postsIdx >= 0 && pathParts[postsIdx + 1]) return pathParts[postsIdx + 1];
      const v = u.searchParams.get("v");
      if (v) return v;
      const last = pathParts[pathParts.length - 1];
      if (last && /^\d+$/.test(last)) return last;
      return last || null;
    }
    if (platform === "instagram") {
      const match = url.match(/\/p\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    }
    if (platform === "youtube") {
      const match = url.match(/(?:shorts\/|v=)([A-Za-z0-9_-]{11})/);
      return match ? match[1] : null;
    }
    if (platform === "tiktok") {
      const match = url.match(/\/video\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch Facebook post engagement via Graph API.
 * Returns { likes, comments, shares, saves, views } or null on error.
 */
export async function getEngagement(postId, accessToken) {
  if (!postId || !accessToken) return null;
  const fields = "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares";
  const url = `https://graph.facebook.com/v21.0/${postId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.warn("Facebook Graph API error:", data.error);
      return null;
    }
    const likes = data.reactions?.summary?.total_count ?? 0;
    const comments = data.comments?.summary?.total_count ?? 0;
    const shares = data.shares?.count ?? 0;
    return {
      likes,
      comments,
      shares,
      saves: 0,
      views: 0,
    };
  } catch (err) {
    console.warn("Facebook getEngagement fetch error:", err.message);
    return null;
  }
}
