const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── Specific named routes FIRST (before /:id) ────────────────────────────────
router.get('/incident-trends',   reportsController.getIncidentTrends);
router.get('/guard-performance', reportsController.getGuardPerformance);
router.get('/site-coverage',     reportsController.getSiteCoverage);
router.post('/generate',         reportsController.generateReport);

// ── Generic routes AFTER ─────────────────────────────────────────────────────
router.get('/',    reportsController.getReports);
router.get('/:id', reportsController.getReportById);
router.get('/:id/export', reportsController.exportReport);
router.delete('/:id', reportsController.deleteReport);

module.exports = router;