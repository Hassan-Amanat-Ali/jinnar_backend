import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";
import fs from "fs/promises";

const uploadToCloudinary = async (
  file,
  userId,
  folder,
  resourceType = "auto",
) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `users/${userId}/${folder}`,
      resource_type: resourceType,
    });
    await fs.unlink(file.path).catch(() => {}); // Clean up compressed file
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error(`Error uploading to Cloudinary (${folder}):`, error);
    await fs.unlink(file.path).catch(() => {}); // Clean up on error
    throw error;
  }
};

// Upload Profile Picture (single file, all users)
export const uploadProfilePicture = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await uploadToCloudinary(
      req.file,
      id,
      "profile_pictures",
      "image",
    );

    // Save URL and publicId to user document
    user.profilePicture = result.url;
    console.log(result);

    await user.save(); // Save the user document

    return res.status(200).json({
      message: "Profile picture uploaded successfully",
      file: result,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Profile Picture Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Upload Other Images (multiple, all users)
export const uploadOtherImages = async (req, res) => {
  try {
    const { id } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file, id, "other_images", "image"),
    );
    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      message: "Other images uploaded successfully",
      files: results,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Other Images Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Upload Portfolio Images (multiple, sellers only)
export const uploadPortfolioImages = async (req, res) => {
  try {
    const { id, role } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });
    if (role !== "seller")
      return res
        .status(403)
        .json({ error: "Only sellers can upload portfolio images" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file, id, "portfolio_images", "image"),
    );
    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      message: "Portfolio images uploaded successfully",
      files: results,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Portfolio Images Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Upload Videos (multiple, sellers only)
export const uploadVideos = async (req, res) => {
  try {
    const { id, role } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });
    if (role !== "seller")
      return res.status(403).json({ error: "Only sellers can upload videos" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file, id, "videos", "video"),
    );
    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      message: "Videos uploaded successfully",
      files: results,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Videos Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Upload Certificates (multiple, sellers only)
export const uploadCertificates = async (req, res) => {
  try {
    const { id, role } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });
    if (role !== "seller")
      return res
        .status(403)
        .json({ error: "Only sellers can upload certificates" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "No files uploaded" });

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file, id, "certificates", "raw"),
    );
    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      message: "Certificates uploaded successfully",
      files: results,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Certificates Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// Upload Gig Image (single, sellers only)
export const uploadGigImage = async (req, res) => {
  try {
    const { id, role } = req.user;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "User not verified" });
    if (role !== "seller")
      return res
        .status(403)
        .json({ error: "Only sellers can upload gig images" });

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const result = await uploadToCloudinary(
      req.file,
      id,
      "gig_images",
      "image",
    );
    return res.status(200).json({
      message: "Gig image uploaded successfully",
      file: result,
      userId: id,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

// --- NEW: Upload Identity Document ---
export const uploadIdentityDocument = async (req, res) => {
  try {
    const { id } = req.user;
    const { documentType } = req.body;

    // 1. Validate input
    const allowedTypes = ["passport", "national_id", "drivers_license", "other"];
    if (!documentType || !allowedTypes.includes(documentType)) {
      return res.status(400).json({ error: "A valid documentType is required." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // 2. Find user and check status
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (user.verificationStatus === 'approved' || user.verificationStatus === 'pending') {
        return res.status(400).json({ error: `Cannot upload new documents while status is '${user.verificationStatus}'.` });
    }


    // 3. Upload to Cloudinary
    const resourceType = req.file.mimetype === "application/pdf" ? "raw" : "image";
    const result = await uploadToCloudinary(
      req.file,
      id,
      "identity_documents",
      resourceType
    );

    // 4. Create and save document reference
    const newDocument = {
      documentType,
      url: result.url,
      publicId: result.publicId,
    };

    user.identityDocuments.push(newDocument);
    await user.save();

    // 5. Respond
    return res.status(200).json({
      message: "Identity document uploaded successfully.",
      file: newDocument,
      userId: id,
    });
  } catch (error) {
    console.error("Upload Identity Document Error:", error.message, error.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};
