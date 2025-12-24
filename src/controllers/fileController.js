import fs from "fs";
import path from "path";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Report from "../models/Report.js";

// Keep truly private folders protected (identity). Chat files are served publicly so
// image URLs returned in messages can be loaded directly by browsers via <img src="...">.
const privateFolders = ["identity"];

export const serveFile = async (req, res) => {
  try {
    const { folder, filename } = req.params;

    // Block directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    // Build absolute path using process.cwd() → works everywhere
    const filePath = path.join(process.cwd(), "uploads", folder, filename);

    // Double-check it's really inside uploads (defense in depth)
    const resolvedPath = path.resolve(filePath);
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    if (!resolvedPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Access denied" });
    }

    // Your existing private folder + permission logic (keep unchanged)
    if (privateFolders.includes(folder)) {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const adminRoles = ["support", "supervisor", "regional_manager", "super_admin"];

      if (!adminRoles.includes(userRole)) {
        let hasPermission = false;

        if (folder === "identity") {
          const user = await User.findOne({ _id: userId, "identityDocuments.url": { $regex: filename, $options: "i" } });
          if (user) hasPermission = true;
        } else if (folder === "chat") {
          const message = await Message.findOne({
            "attachment.url": { $regex: filename, $options: "i" },
            $or: [{ sender: userId }, { receiver: userId }]
          });
          if (message) hasPermission = true;
        }

        if (!hasPermission) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
    }

    // If folder is 'chat' we intentionally allow public access so images can load in browsers
    if (folder === 'chat') {
      console.log(`Serving public chat file: ${filename}`);
    }

    // Serve file if exists
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      console.log("File not found:", filePath); // Helps debugging
      return res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("File serving error:", error);
    res.status(500).json({ error: "Server error" });
  }
};