// src/routes/personnelRoutes.js
const express = require('express');
const router  = express.Router();
const personnelController = require('../controllers/personnelController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

router.use(authenticate);

// ── Read (anyone with personnel:view permission) ─────────────────────────────
router.get('/stats',              requirePermission('personnel:view'), personnelController.getStats);
router.get('/',                   requirePermission('personnel:view'), personnelController.getAll);
router.get('/:id',                requirePermission('personnel:view'), personnelController.getById);
router.get('/:id/certifications', requirePermission('personnel:view'), personnelController.getCertifications);

// ── Write (HR Manager, Ops Manager, Director Logistics, MD, Admin) ───────────
const PERSONNEL_WRITERS = [
  ROLES.ADMIN,
  ROLES.MANAGING_DIRECTOR,
  ROLES.DIRECTOR_LOGISTICS,
  ROLES.HR_MANAGER,
  ROLES.OPERATIONS_MANAGER,
];

router.post('/',                   authorize(...PERSONNEL_WRITERS), personnelController.create);
router.post('/:id/certifications', authorize(...PERSONNEL_WRITERS), personnelController.addCertification);
router.put('/:id',                 authorize(...PERSONNEL_WRITERS), personnelController.update);

// ── Delete (HR Manager, Director Logistics, MD, Admin only) ─────────────────
router.delete('/:id', authorize(
  ROLES.ADMIN, ROLES.MANAGING_DIRECTOR,
  ROLES.DIRECTOR_LOGISTICS, ROLES.HR_MANAGER
), personnelController.deleteItem);

module.exports = router;