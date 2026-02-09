import express from "express";
import {
  listDraws,
  getDraw,
  listAdminDraws,
  createDraw,
  updateDraw,
  archiveDraw,
  unarchiveDraw,
  getLatestDrawWithParticipants,
  createSubmission,
  listMySubmissions,
  getMySubmission,
  createPost,
  getLeaderboard,
  getMyRank,
  getMyPoints,
  getWinners,
  getMyRewards,
  createRewards,
  closeDraw,
  listAdminSubmissions,
  updateSubmission,
  updatePost,
} from "../controllers/viralController.js";
import { protect, authorize } from "../middleware/auth.js";
import { uploadViralVideo, uploadPostProofScreenshot } from "../middleware/viralUpload.js";

const router = express.Router();

// ==================== PUBLIC ====================
router.get("/draws", listDraws);
router.get("/draws/:drawId/winners", getWinners);
router.get("/draws/:id", getDraw);
router.get("/draws/latest/participants", getLatestDrawWithParticipants);
router.get("/leaderboard", getLeaderboard);
// : Archive / Unarchive draw
router.post(
  "/draws/:drawId/archive",
  protect,
  archiveDraw,
);
router.post(
  "/draws/:drawId/unarchive",
  protect,
  unarchiveDraw,
);
router.get("/points/me", protect, getMyPoints);

// ==================== PARTICIPANT (protect) ====================
router.post("/submissions", protect, uploadViralVideo, createSubmission);
router.get("/submissions/me", protect, listMySubmissions);
router.get("/submissions/me/:id", protect, getMySubmission);

router.post("/posts", protect, uploadPostProofScreenshot, createPost);

router.get("/leaderboard/me", protect, getMyRank);
router.get("/rewards/me", protect, getMyRewards);

// ==================== ADMIN ====================
router.get("/admin/draws", protect, authorize("super_admin"), listAdminDraws);
router.post("/admin/draws", protect, authorize("super_admin"), createDraw);
router.put("/admin/draws/:id", protect, authorize("super_admin"), updateDraw);
router.post("/admin/draws/:drawId/rewards", protect, authorize("super_admin"), createRewards);
router.post("/admin/draws/:drawId/close", protect, authorize("super_admin"), closeDraw);




router.get("/admin/submissions", protect, authorize("super_admin"), listAdminSubmissions);
router.put("/admin/submissions/:id", protect, authorize("super_admin"), updateSubmission);

router.put("/admin/posts/:id", protect, authorize("super_admin"), updatePost);

export default router;
