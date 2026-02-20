const express = require('express');
const router = express.Router();
const cctvController = require('../controllers/cctvController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET routes (accessible by authenticated users)
router.get('/', cctvController.getAll || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/stats', cctvController.getStats || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.get('/:id', cctvController.getById || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

// POST/PUT/DELETE routes (Admin or Operations Manager only)
router.post('/', authorize('Admin', 'Operations Manager'), cctvController.create || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.put('/:id', authorize('Admin', 'Operations Manager'), cctvController.update || ((req, res) => res.status(501).json({ message: 'Not implemented' })));
router.delete('/:id', authorize('Admin'), cctvController.deleteItem || ((req, res) => res.status(501).json({ message: 'Not implemented' })));

module.exports = router;
