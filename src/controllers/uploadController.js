import User from "../models/User.js";
import Gig from "../models/Gig.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { _submitUserForVerificationLogic } from "./userController.js";

// ------------------------
//    STORAGE HELPERS
// ------------------------
const deleteFileFromStorage = async (url) => {
  if (!url) return;

  try {
    // 1. Extract the pathname from the URL
    // e.g., 'http://localhost:3000/api/files/identity/uuid.jpg' -> '/api/files/identity/uuid.jpg'
    const urlPath = new URL(url, "http://localhost").pathname; 

    //Our standard URLs are /api/files/:folder/:filename
    //However, we should be robust to other formats like /uploads/:folder/:filename
    const parts = urlPath.split("/").filter(Boolean);
    const filename = parts.pop();
    
    // The folder is the part immediately preceding the filename
    // If the path was just /uploads/file.jpg, parts.pop() would give 'uploads'
    const folder = parts.length > 0 ? parts.pop() : "misc";

    if (!filename) {
        console.warn(`[Delete] Could not extract filename from URL: ${url}`);
        return;
    }

    // 3. Sanitize inputs
    const sanitizedFilename = path.basename(filename);
    const sanitizedFolder = path.basename(folder);

    // 4. Construct absolute path
    // If folder is 'uploads', it means the file was likely in the root of uploads
    const filePath = sanitizedFolder === "uploads" 
        ? path.join(process.cwd(), "uploads", sanitizedFilename)
        : path.join(process.cwd(), "uploads", sanitizedFolder, sanitizedFilename);

    // 5. Security: Ensure the path is strictly inside the 'uploads' directory
    const resolvedPath = path.resolve(filePath);
    const uploadsDir = path.resolve(process.cwd(), "uploads");

    if (!resolvedPath.startsWith(uploadsDir)) {
      console.error(`🛑 Security Alert: Attempted path traversal in deletion for URL: ${url}`);
      return;
    }

    // Check if file exists before trying to delete
    try {
        await fs.access(resolvedPath);
        await fs.unlink(resolvedPath);
        console.log(`Successfully deleted file: ${sanitizedFilename} from ${sanitizedFolder}`);
    } catch (accessErr) {
        // File doesn't exist, which is fine (idempotent behavior)
        if (accessErr.code !== 'ENOENT') throw accessErr;
    }
  } catch (err) {
    console.error(`Error deleting file for URL ${url}:`, err.message);
  }
};
// ------------------------
//    HELPERS
// ------------------------
const ensureUserValid = async (req, res, requireSeller = false) => {
  const { id, role } = req.user;
  const user = await User.findById(id);

  if (!user) return { error: res.status(404).json({ error: "User not found" }) };
  if (!user.isVerified)
    return { error: res.status(403).json({ error: "User not verified" }) };

  if (requireSeller && role !== "seller") {
    return {
      error: res
        .status(403)
        .json({ error: "Only sellers can perform this action" }),
    };
  }

  return { user };
};

// ------------------------------------------------------------------
// ⭐ 1. Upload Profile Picture (single)
// ------------------------------------------------------------------
export const uploadProfilePicture = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res);
    if (error) return;

    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      await deleteFileFromStorage(user.profilePicture);
    }

    user.profilePicture = req.file.url;
    await user.save();

    return res.status(200).json({
      message: "Profile picture uploaded successfully",
      file: {
        url: req.file.url,
        size: req.file.size,
      },
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Profile Picture Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ NEW: Upload Gig Image (single — seller only)
// ------------------------------------------------------------------
export const uploadGigImages = async (req, res) => {
  try {
    const { error } = await ensureUserValid(req, res, true); // requireSeller = true
    if (error) return;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const { gigId } = req.params;
    if (!gigId) {
      return res.status(400).json({ error: "Gig ID is required in the URL." });
    }

    const gig = await Gig.findOne({ _id: gigId, sellerId: req.user.id });
    if (!gig) {
      return res.status(404).json({ error: "Gig not found or you are not the owner." });
    }

    // Validate image limit (e.g., max 3 images per gig from Gig model)
    const GIG_IMAGE_LIMIT = 3; // As defined in Gig model validator
    const currentImageCount = gig.images?.length || 0;
    if (currentImageCount + req.files.length > GIG_IMAGE_LIMIT) {
      return res.status(400).json({
        error: `You can upload a maximum of ${GIG_IMAGE_LIMIT} images for a gig. You currently have ${currentImageCount}.`,
      });
    }

    const newImages = req.files.map((file) => ({ url: file.url }));

    // Append new images to the existing array
    gig.images = [...(gig.images || []), ...newImages];

    await gig.save();
    await gig.populate("sellerId", "name");

    return res.status(200).json({
      message: "Gig images uploaded successfully",
      gig,
    });
  } catch (err) {
    console.error("Upload Gig Image Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 2. Upload Other Images (multiple)
// ------------------------------------------------------------------
export const uploadOtherImages = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res);
    if (error) return;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const OTHER_IMAGES_LIMIT = 10;
    const currentImageCount = user.otherImages?.length || 0;
    if (currentImageCount + req.files.length > OTHER_IMAGES_LIMIT) {
      return res.status(400).json({
        error: `You can upload a maximum of ${OTHER_IMAGES_LIMIT} other images.`,
      });
    }
    const results = req.files.map((f) => ({
      url: f.url,
      size: f.size,
    }));

    user.otherImages = [...(user.otherImages || []), ...results.map(r => ({ url: r.url }))];
    await user.save();

    return res.status(200).json({
      message: "Other images uploaded successfully",
      files: results,
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Other Images Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 3. Upload Portfolio Images (multiple — seller only)
// ------------------------------------------------------------------
export const uploadPortfolioImages = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res, true);
    if (error) return;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    // Example: Limit portfolio images to 20
    const PORTFOLIO_LIMIT = 20;
    const currentImageCount = user.portfolioImages?.length || 0;
    if (currentImageCount + req.files.length > PORTFOLIO_LIMIT) {
      return res.status(400).json({
        error: `You can upload a maximum of ${PORTFOLIO_LIMIT} portfolio images.`,
      });
    }
    const results = req.files.map((f) => ({
      url: f.url,
      size: f.size,
    }));

    user.portfolioImages = [...(user.portfolioImages || []), ...results.map(r => ({ url: r.url }))];
    await user.save();

    return res.status(200).json({
      message: "Portfolio images uploaded successfully",
      files: results,
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Portfolio Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 4. Upload Videos (multiple — seller only)
// ------------------------------------------------------------------
export const uploadVideos = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res, true);
    if (error) return;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    // Example: Limit videos to 5
    const VIDEO_LIMIT = 5;
    const currentVideoCount = user.videos?.length || 0;
    if (currentVideoCount + req.files.length > VIDEO_LIMIT) {
      return res
        .status(400)
        .json({ error: `You can upload a maximum of ${VIDEO_LIMIT} videos.` });
    }
    const results = req.files.map((f) => ({
      url: f.url,
      size: f.size,
    }));

    user.videos = [...(user.videos || []), ...results.map(r => ({ url: r.url }))];
    await user.save();

    return res.status(200).json({
      message: "Videos uploaded successfully",
      files: results,
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Videos Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 5. Upload Certificates (multiple — seller only)
// ------------------------------------------------------------------
export const uploadCertificates = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res, true);
    if (error) return;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    // Example: Limit certificates to 10
    const CERTIFICATE_LIMIT = 10;
    const currentCertificateCount = user.certificates?.length || 0;
    if (currentCertificateCount + req.files.length > CERTIFICATE_LIMIT) {
      return res.status(400).json({
        error: `You can upload a maximum of ${CERTIFICATE_LIMIT} certificates.`,
      });
    }
    const results = req.files.map((f) => ({
      url: f.url,
      size: f.size,
    }));

    user.certificates = [...(user.certificates || []), ...results.map(r => ({ url: r.url }))];
    await user.save();

    return res.status(200).json({
      message: "Certificates uploaded successfully",
      files: results,
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Certificates Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 8. Delete an Asset (Image, Video, Certificate)
// ------------------------------------------------------------------
export const deleteAsset = async (req, res) => {
  try {
    const { error, user } = await ensureUserValid(req, res);
    if (error) return;

    const { assetUrl, assetType } = req.body;

    if (!assetUrl || !assetType) {
      return res
        .status(400)
        .json({ error: "assetUrl and assetType are required." });
    }

    const validAssetTypes = [
      "otherImages",
      "portfolioImages",
      "videos",
      "certificates",
      "identityDocuments",
    ];

    if (!validAssetTypes.includes(assetType)) {
      return res.status(400).json({ error: "Invalid assetType." });
    }

    // Remove the asset from the user's document
    const initialCount = user[assetType]?.length || 0;
    user[assetType] = user[assetType]?.filter((asset) => asset.url !== assetUrl) || [];

    if (user[assetType].length === initialCount) {
      return res.status(404).json({ error: "Asset not found on user profile." });
    }

    await deleteFileFromStorage(assetUrl);
    await user.save();

    res.status(200).json({ message: "Asset deleted successfully." });
  } catch (err) {
    console.error("Delete Asset Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------------------------------------------------
// ⭐ 7. Upload Identity Document (single)
// ------------------------------------------------------------------
export const uploadIdentityDocument = async (req, res) => {
  try {
    const { id } = req.user;
    const { documentType } = req.body;

    // validate
    const allowed = ["passport", "national_id", "drivers_license", "other"];
    if (!allowed.includes(documentType))
      return res.status(400).json({ error: "Invalid documentType" });

    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    // find user
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (["approved", "pending"].includes(user.verificationStatus))
      return res.status(400).json({
        error: `Cannot upload documents while status is '${user.verificationStatus}'.`,
      });

    // If the user is re-submitting (e.g., after a 'rejected' status),
    // delete all old identity documents first.
    if (user.identityDocuments && user.identityDocuments.length > 0) {
      for (const oldDoc of user.identityDocuments) {
        await deleteFileFromStorage(oldDoc.url);
      }
    }
    // save
    const doc = {
      documentType,
      url: req.file.url, // publicId is removed from the model
      uploadedAt: new Date(),
    };

    // Replace old documents with the new one.
    user.identityDocuments = [doc];
    await user.save();

    // Automatically submit for verification after successful upload
    const verificationResult = await _submitUserForVerificationLogic(id);

    let responseMessage = "Identity document uploaded successfully.";
    if (verificationResult.success) {
      responseMessage += " Your verification request has been submitted for review.";
    } else {
      // We don't want to fail the whole upload if submission fails (e.g., already pending), so we just add a note.
      responseMessage += ` Note: ${verificationResult.message}`;
    }

    return res.status(200).json({
      message: responseMessage,
      file: doc,
      userId: user._id,
    });
  } catch (err) {
    console.error("Upload Identity Document Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
