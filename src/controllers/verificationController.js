import User from "../models/User.js";
import diditService from "../services/diditService.js";

export const startVerification = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming auth middleware populates req.user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check existing verification status
    // Pass { force: true } in body to restart even if pending
    if (
      !req.body.force &&
      user.verification?.status === "pending" &&
      user.verification?.url
    ) {
      // Return existing session if pending
      return res.status(200).json({
        message: "Verification already in progress",
        verificationUrl: user.verification.url,
      });
    }

    if (user.verification?.status === "verified") {
      return res.status(200).json({
        message: "User is already verified",
        status: "verified",
      });
    }

    // Create new session if none, rejected, expired, or failed
    const { sessionId, url } = await diditService.createSession(
      userId.toString(),
    );

    // Update User
    user.verification = {
      sessionId,
      url,
      status: "pending",
      lastError: null,
    };

    // Also update legacy field if necessary for other parts of the app,
    // but the new object is the source of truth.
    // user.verificationStatus = 'pending';

    await user.save();

    res.status(200).json({
      message: "Verification session started",
      verificationUrl: url,
    });
  } catch (error) {
    console.error("Start Verification Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const syncSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    console.log(`🔄 [Manual Sync] Fetching decision for session: ${sessionId}`);
    const decision = await diditService.getSessionDecision(sessionId);

    // Find user by session ID
    const user = await User.findOne({ "verification.sessionId": sessionId });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found for this session ID", decision });
    }

    const newStatus = diditService.parseVerificationStatus(decision);

    user.verification.status = newStatus;
    user.verificationStatus = newStatus === "verified" ? "approved" : newStatus;

    if (decision.id_verifications) {
      const docs = decision.id_verifications
        .map((dv) => ({
          documentType: (dv.document_type || "other")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_"),
          url: dv.front_image || dv.portrait_image || dv.full_front_image,
          uploadedAt: new Date(),
        }))
        .filter((d) => d.url);

      if (docs.length > 0) {
        user.identityDocuments = docs;
        if (newStatus === "verified") {
          user.isVerified = true;
        }
      }
    }

    if (newStatus === "rejected" && decision.details) {
      user.verification.lastError =
        decision.details.reason || "Verification rejected";
      user.isVerified = false;
    }

    await user.save();

    res.status(200).json({
      message: "Sync completed",
      status: newStatus,
      documentsFound: user.identityDocuments?.length || 0,
      user: {
        id: user._id,
        isVerified: user.isVerified,
        identityDocuments: user.identityDocuments,
      },
      rawDecision: decision,
    });
  } catch (error) {
    console.error("Sync Session Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
