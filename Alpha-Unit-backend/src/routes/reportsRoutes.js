const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET    /api/v1/reports          - Get all reports
router.get('/', reportsController.getReports);

// POST   /api/v1/reports/generate - Generate a new report
router.post('/generate', reportsController.generateReport);

// GET    /api/v1/reports/:id      - Get a single report
router.get('/:id', reportsController.getReportById);

// GET    /api/v1/reports/:id/export - Export report as PDF/CSV
router.get('/:id/export', reportsController.exportReport);

// DELETE /api/v1/reports/:id      - Delete a report
router.delete('/:id', reportsController.deleteReport);

module.exports = router;
