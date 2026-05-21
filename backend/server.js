// ============================================================
// PESO-Link MisOr - Main Server (Node.js + Express + MySQL)
// IT323 Applications Development and Emerging Technology Final Project
// ============================================================
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const jobSeekerRoutes = require('./routes/jobSeeker');
const nsrpRoutes = require('./routes/nsrp');
const jobsRoutes = require('./routes/jobs');
const applicationsRoutes = require('./routes/applications');
const employerRoutes = require('./routes/employer');
const adminRoutes = require('./routes/admin');
const miscRoutes = require('./routes/misc');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8001;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PESO-Link MisOr Backend',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes (all /api prefixed)
app.use('/api/auth', authRoutes);
app.use('/api/job-seeker', jobSeekerRoutes);
app.use('/api/nsrp', nsrpRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/employer', employerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] PESO-Link MisOr backend running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Health: http://localhost:${PORT}/api/health`);
});
