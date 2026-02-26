const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================

app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:8080')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ==================== RATE LIMITING ====================
// In development, be very permissive.
// In production, use tighter limits from env vars.

const isDev = process.env.NODE_ENV !== 'production';

// General API limiter — applies to all /api/ routes
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: isDev
    ? 2000                                                   // dev: 2000 req / 15 min
    : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // prod: 500 req / 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => isDev && process.env.DISABLE_RATE_LIMIT === 'true', // opt-out via env
});

// Strict limiter only for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 min
  max: isDev ? 200 : 20,              // dev: 200, prod: 20
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

app.use('/api/', generalLimiter);

// Static files
app.use('/uploads', express.static('public/uploads'));

// ==================== ROUTES ====================

const API_VERSION = process.env.API_VERSION || 'v1';

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    rateLimitMax: isDev ? 2000 : 500,
  });
});

// Import routes
const authRoutes          = require('./routes/authRoutes');
const clientsRoutes       = require('./routes/clientsRoutes');
const personnelRoutes     = require('./routes/personnelRoutes');
const incidentsRoutes     = require('./routes/incidentsRoutes');
const shiftsRoutes        = require('./routes/shiftsRoutes');
const sitesRoutes = require('./routes/sitesRoutes');
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
const settingsRoutes      = require('./routes/settingsRoutes');
const schedulingRoutes = require('./routes/schedulingRoutes');

// Apply strict limiter to auth only
app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);

// All other routes use the general limiter (already applied above)
app.use(`/api/${API_VERSION}/clients`,       clientsRoutes);
app.use(`/api/${API_VERSION}/personnel`,     personnelRoutes);
app.use(`/api/${API_VERSION}/incidents`,     incidentsRoutes);
app.use(`/api/${API_VERSION}/shifts`,        shiftsRoutes);
app.use(`/api/${API_VERSION}/sites`,         sitesRoutes);
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
app.use(`/api/${API_VERSION}/settings`,      settingsRoutes); 
app.use(`/api/${API_VERSION}/scheduling`, schedulingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDev && { error: err.stack }),
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
║   🌍 Port:        ${PORT}                           ║
║   📍 Environment: ${process.env.NODE_ENV || 'development'}               ║
║   🔗 API Base:    /api/${API_VERSION}                   ║
║   🚦 Rate limit:  ${isDev ? '2000' : '500'} req / 15 min              ║
║   ✅ Origins:     ${allowedOrigins.join(', ')}
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
});

module.exports = app;