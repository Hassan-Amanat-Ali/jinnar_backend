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

    // 1. Sanitize folder and filename (Block directory traversal)
    // We use path.basename to ensure we only have the leaf name and no ".." or "/"
    const sanitizedFolder = path.basename(folder);
    const sanitizedFilename = path.basename(filename);

    if (folder !== sanitizedFolder || filename !== sanitizedFilename) {
      return res.status(400).json({ error: "Invalid folder or filename" });
    }

    // 2. Validate folder against known upload directories (Defense in depth)
    const allowedFolders = [
      "profilePictures",
      "otherImages",
      "portfolioImages",
      "gigImages",
      "videos",
      "certificates",
      "identity",
      "chat",
      "blogs",
      "courses",
      "viral"
    ];

    if (!allowedFolders.includes(sanitizedFolder)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 3. Build absolute path using process.cwd()
    const filePath = path.join(process.cwd(), "uploads", sanitizedFolder, sanitizedFilename);

    // Double-check it's really inside uploads (Additional path traversal protection)
    const resolvedPath = path.resolve(filePath);
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    if (!resolvedPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Access denied" });
    }

    // Logic for privateFolders
    if (privateFolders.includes(sanitizedFolder)) {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const adminRoles = ["support", "supervisor", "regional_manager", "super_admin"];

      if (!adminRoles.includes(userRole)) {
        let hasPermission = false;

        if (sanitizedFolder === "identity") {
          const user = await User.findOne({ _id: userId, "identityDocuments.url": { $regex: sanitizedFilename, $options: "i" } });
          if (user) hasPermission = true;
        } else if (sanitizedFolder === "chat") {
          const message = await Message.findOne({
            "attachment.url": { $regex: sanitizedFilename, $options: "i" },
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
    if (sanitizedFolder === 'chat') {
      console.log(`Serving public chat file: ${sanitizedFilename}`);
    }

    // Serve file if exists
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    } else {
      console.log("File not found:", sanitizedFilename); // Do not log full path
      return res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("File serving error:", error);
    res.status(500).json({ error: "Server error" });
  }
};