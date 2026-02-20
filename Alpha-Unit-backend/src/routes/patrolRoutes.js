const express = require('express');
const router = express.Router();
const patrolController = require('../controllers/patrolController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', patrolController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', patrolController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', patrolController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), patrolController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), patrolController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), patrolController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
