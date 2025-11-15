// routes/userRoutes.js
import express from 'express';
import { findWorkers } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js'; // Assuming you have authentication

const router = express.Router();

router.get('/find', protect, findWorkers);

export default router;