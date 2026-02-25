const express = require('express');
const router = express.Router();
const dronesController = require('../controllers/dronesController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Stats
router.get('/stats', dronesController.getStats);

// Flight logs (sub-resource)
router.get('/flights',      dronesController.getFlights);
router.post('/flights',     authorize('Admin', 'Operations Manager'), dronesController.createFlight);
router.put('/flights/:id',  authorize('Admin', 'Operations Manager'), dronesController.updateFlight);
router.delete('/flights/:id', authorize('Admin'), dronesController.deleteFlight);

// Drone CRUD
router.get('/',    dronesController.getAll);
router.get('/:id', dronesController.getById);
router.post('/',   authorize('Admin', 'Operations Manager'), dronesController.create);
router.put('/:id', authorize('Admin', 'Operations Manager'), dronesController.update);
router.delete('/:id', authorize('Admin'), dronesController.deleteItem);

module.exports = router;