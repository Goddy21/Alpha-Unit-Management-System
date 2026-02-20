const express = require('express');
const router = express.Router();
const shiftsController = require('../controllers/shiftsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', shiftsController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', shiftsController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', shiftsController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), shiftsController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), shiftsController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), shiftsController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
