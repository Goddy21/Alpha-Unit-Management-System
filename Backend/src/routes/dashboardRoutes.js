const express = require('express');
const router = express.Router();
const { getStats, getActivity } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/v1/dashboard/stats    - stat cards
router.get('/stats', getStats);

// GET /api/v1/dashboard/activity - live activity feed
router.get('/activity', getActivity);

module.exports = router;
