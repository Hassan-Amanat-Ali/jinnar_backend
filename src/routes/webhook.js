// routes/webhook.js (disabled)
import express from "express";

const router = express.Router();

// Webhook endpoints removed. Respond 410 (Gone) to any requests.
router.all("*", (req, res) =>
  res.status(410).send("Webhook endpoints removed"),
);

export default router;
