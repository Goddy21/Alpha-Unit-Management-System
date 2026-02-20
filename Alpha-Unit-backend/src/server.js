const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet());

// CORS configuration - allows multiple frontend origins
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8080')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Static files
app.use('/uploads', express.static('public/uploads'));

// ==================== ROUTES ====================

const API_VERSION = process.env.API_VERSION || 'v1';

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Import routes
const authRoutes          = require('./routes/authRoutes');
const clientsRoutes       = require('./routes/clientsRoutes');
const personnelRoutes     = require('./routes/personnelRoutes');
const incidentsRoutes     = require('./routes/incidentsRoutes');
const shiftsRoutes        = require('./routes/shiftsRoutes');
//const sitesRoutes         = require('./routes/sitesRoutes');        
const patrolRoutes        = require('./routes/patrolRoutes');
const cctvRoutes          = require('./routes/cctvRoutes');
const dronesRoutes        = require('./routes/dronesRoutes');
const inventoryRoutes     = require('./routes/inventoryRoutes');
const billingRoutes       = require('./routes/billingRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const portalRoutes        = require('./routes/portalRoutes');
const usersRoutes         = require('./routes/usersRoutes');
const dashboardRoutes     = require('./routes/dashboardRoutes');
const reportsRoutes       = require('./routes/reportsRoutes');

// Mount routes
app.use(`/api/${API_VERSION}/auth`,          authRoutes);
app.use(`/api/${API_VERSION}/clients`,       clientsRoutes);
app.use(`/api/${API_VERSION}/personnel`,     personnelRoutes);
app.use(`/api/${API_VERSION}/incidents`,     incidentsRoutes);
app.use(`/api/${API_VERSION}/shifts`,        shiftsRoutes);
//app.use(`/api/${API_VERSION}/sites`,         sitesRoutes);           
app.use(`/api/${API_VERSION}/patrol`,        patrolRoutes);
app.use(`/api/${API_VERSION}/cctv`,          cctvRoutes);
app.use(`/api/${API_VERSION}/drones`,        dronesRoutes);
app.use(`/api/${API_VERSION}/inventory`,     inventoryRoutes);
app.use(`/api/${API_VERSION}/billing`,       billingRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationsRoutes);
app.use(`/api/${API_VERSION}/portal`,        portalRoutes);
app.use(`/api/${API_VERSION}/users`,         usersRoutes);
app.use(`/api/${API_VERSION}/dashboard`,     dashboardRoutes);
app.use(`/api/${API_VERSION}/reports`,       reportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.stack }),
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🔒 ISMS Backend Server                         ║
║   Integrated Security Management System          ║
║                                                  ║
║   🌍 Server running on port: ${PORT}               ║
║   📍 Environment: ${process.env.NODE_ENV || 'development'}                 ║
║   🔗 API Base: http://localhost:${PORT}/api/${API_VERSION}   ║
║   📚 Health Check: http://localhost:${PORT}/health    ║
║   ✅ Allowed origins: ${allowedOrigins.join(', ')}
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;