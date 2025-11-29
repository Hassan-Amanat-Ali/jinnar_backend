import fs from "fs";
import path from "path";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Report from "../models/Report.js";

const privateFolders = ["identity", "chat"];

export const serveFile = async (req, res) => {
  try {
    const { folder, filename } = req.params;

    // 1. Prevent Directory Traversal
    if (filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join("uploads", folder, filename);

    // 2. Check if the folder is private
    if (privateFolders.includes(folder)) {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Authentication required to access this file." });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const adminRoles = ["support", "supervisor", "regional_manager", "super_admin"];

      // ✅ Grant access if the user is an admin
      if (adminRoles.includes(userRole)) {
        // Admin has permission, proceed to serve the file.
      } else {
        // If not an admin, perform ownership checks.
        let hasPermission = false;

        if (folder === "identity") {
          // User can only access their own identity documents.
          const user = await User.findOne({ _id: userId, "identityDocuments.url": { $regex: filename } });
          if (user) hasPermission = true;
        } else if (folder === "chat") {
          // User can access a chat attachment if they are the sender or receiver.
          const message = await Message.findOne({ 
            "attachment.url": { $regex: filename },
            $or: [{ sender: userId }, { receiver: userId }]
          });
          if (message) hasPermission = true;
        }
        // Add more private folder checks here (e.g., for reports)

        if (!hasPermission) {
          return res.status(403).json({ error: "You do not have permission to access this file." });
        }
      }
    }

    // 3. For public files, check if the file exists and serve it
    if (fs.existsSync(filePath)) {
      return res.sendFile(path.resolve(filePath));
    } else {
      return res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("File serving error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};