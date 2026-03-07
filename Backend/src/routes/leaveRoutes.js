// src/routes/leaveRoutes.js
const express = require('express');
const router  = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { ROLES, LEAVE_FIRST_APPROVERS, LEAVE_FINAL_APPROVERS } = require('../config/roles');

// All leave routes require authentication
router.use(authenticate);

// ── Stats (scoped by role inside controller) ──────────────────────────────────
router.get('/stats', leaveController.getLeaveStats);

// ── Submit leave (any authenticated user) ────────────────────────────────────
router.post('/', requirePermission('leave:apply'), leaveController.applyLeave);

// ── List leave requests (scope enforced inside controller) ───────────────────
router.get('/', leaveController.getLeaveRequests);

// ── Single leave request ─────────────────────────────────────────────────────
router.get('/:id', leaveController.getLeaveById);

// ── Comments ─────────────────────────────────────────────────────────────────
router.get('/:id/comments', leaveController.getComments);
router.post('/:id/comments', leaveController.addComment);

// ── First-level approval (Supervisor, Ops Manager, Director, HR, MD, Admin) ──
router.put(
  '/:id/first-approval',
  authorize(...LEAVE_FIRST_APPROVERS),
  leaveController.firstApproval
);

// ── Final approval (HR Manager, Managing Director, Admin) ────────────────────
router.put(
  '/:id/final-approval',
  authorize(...LEAVE_FINAL_APPROVERS),
  leaveController.finalApproval
);

// ── Cancel own leave ─────────────────────────────────────────────────────────
router.put('/:id/cancel', leaveController.cancelLeave);

module.exports = router;
