import express from "express";
import {
  registerUser,
  verifyCode,
  signIn,
  verifySignIn,
} from "../controllers/authController.js";
// import { ussdHandler } from '../controllers/ussdController.js';
import { body, validationResult } from "express-validator";

const router = express.Router();

router.post(
  "/register",
  [
    body("mobileNumber")
      .isMobilePhone("any")
      .withMessage("Invalid mobile number")
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage("Mobile number must be in E.164 format"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    console.log("hello");
    next();
  },
  registerUser,
);

router.post("/verify", verifyCode);
router.post("/signin", signIn);
router.post("/verify-signin", verifySignIn);

// router.post('/ussd', ussdHandler);

export default router;
