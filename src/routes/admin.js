import express from 'express';
import AdminController from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

// All admin routes require authentication first.
router.use(protect);

// Route definitions with RBAC
router.post('/verify-user', authorize('supervisor'), AdminController.verifyUser);

router.post('/suspend-user', authorize('supervisor'), AdminController.suspendUser);

router.get('/user-activity/:userId', authorize('support'), AdminController.viewUserActivity);

router.post('/settings', authorize('super_admin'), AdminController.updatePlatformSettings);

router.get('/financial-logs', authorize('super_admin'), AdminController.viewFinancialLogs);

// Route to get all users for the admin panel
router.get('/users', authorize('support'), AdminController.getAllUsers);

export default router;