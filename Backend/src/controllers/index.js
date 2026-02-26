// Export all controllers from a single entry point
module.exports = {
  auth: require('./authController'),
  clients: require('./clientsController'),
  personnel: require('./personnelController'),
  incidents: require('./incidentsController'),
  shifts: require('./shiftsController'),
  patrol: require('./patrolController'),
  cctv: require('./cctvController'),
  drones: require('./dronesController'),
  inventory: require('./inventoryController'),
  billing: require('./billingController'),
  notifications: require('./notificationsController'),
  portal: require('./portalController'),
  users: require('./usersController'),
  dashboard: require('./dashboardController'),
  reports: require('./reportsController'),
  sites: require('./schedulingController'),
};
