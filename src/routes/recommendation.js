import express from 'express';
import * as recommendationController from '../controllers/recommendationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, recommendationController.recommendWorkers);

export default router;
