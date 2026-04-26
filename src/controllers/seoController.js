import Gig from "../models/Gig.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";

/**
 * Generates a dynamic sitemap XML.
 */
export const getSitemap = async (req, res) => {
  try {
    const DOMAIN = "https://jinnar.com";
    const currentDate = new Date().toISOString().split("T")[0];

    // 1. Define Static Routes
    const staticRoutes = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/landing-services", priority: "0.9", changefreq: "weekly" },
      { path: "/landing-workers", priority: "0.9", changefreq: "daily" },
      { path: "/about-us", priority: "0.8", changefreq: "monthly" },
      { path: "/help", priority: "0.8", changefreq: "weekly" },
      { path: "/privacy-policy", priority: "0.5", changefreq: "monthly" },
      { path: "/terms-condition", priority: "0.5", changefreq: "monthly" },
    ];

    // 2. Fetch Dynamic Data
    const [gigs, sellers, categories] = await Promise.all([
      Gig.find({ status: "active" })
        .populate("category", "value")
        .populate("primarySubcategory", "value")
        .select("slug serviceSlug updatedAt category primarySubcategory"),
      User.find({ role: "seller", isActive: true }).select("slug id updatedAt"),
      Category.find({ isActive: true }).select("value updatedAt"),
    ]);

    // 3. Start XML construction
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Helper to add a URL with XML escaping
    const addUrl = (path, priority, changefreq, lastmod) => {
      // Escape special XML characters in the URL
      const fullUrl = `${DOMAIN}${path.startsWith('/') ? '' : '/'}${path}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      xml += "  <url>\n";
      xml += `    <loc>${fullUrl}</loc>\n`;
      xml += `    <lastmod>${lastmod || currentDate}</lastmod>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += "  </url>\n";
    };

    // Add Static Routes
    staticRoutes.forEach(r => addUrl(r.path, r.priority, r.changefreq));

    // Add Categories
    categories.forEach(c => {
      addUrl(`/services/${c.value}`, "0.7", "weekly", c.updatedAt?.toISOString().split("T")[0]);
    });

    // Add Gigs
    gigs.forEach(g => {
      const cat = g.category?.value || "service";
      const sub = g.primarySubcategory?.value || "general";
      const slug = g.slug || g.serviceSlug;
      const gigPath = `/${cat}/${sub}/${slug}`;
      addUrl(gigPath, "0.9", "weekly", g.updatedAt?.toISOString().split("T")[0]);
    });

    // Add Sellers
    sellers.forEach(s => {
      const path = s.slug ? `/worker/${s.slug}` : `/worker-profile/${s.id}`;
      addUrl(path, "0.8", "weekly", s.updatedAt?.toISOString().split("T")[0]);
    });

    xml += "</urlset>";

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
};
