require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || `http://localhost:${process.env.CLIENT_PORT || 3000}`,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    // Use alter: false to prevent destructive schema changes
    await sequelize.sync({ alter: false });
    console.log('Database synced.');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

start();

// AI feature mount: content-writer
app.use('/api/ai/content-writer', require('./routes/ai-content-writer'));
// === Batch 07 Gaps & Frontend Mounts ===
app.use('/api/gap-no-generatecontent-ai-article-writer', require('./routes/gap-no-generatecontent-ai-article-writer'));
app.use('/api/gap-no-keywordresearch-volume-difficulty', require('./routes/gap-no-keywordresearch-volume-difficulty'));
app.use('/api/gap-no-contentoutline-article-structure', require('./routes/gap-no-contentoutline-article-structure'));
app.use('/api/gap-no-seooptimization-rewriteimprove', require('./routes/gap-no-seooptimization-rewriteimprove'));
app.use('/api/gap-no-competitoranalysis-ripandreplace', require('./routes/gap-no-competitoranalysis-ripandreplace'));
app.use('/api/gap-no-backlinkopportunity-finder', require('./routes/gap-no-backlinkopportunity-finder'));
app.use('/api/gap-no-projectarticle-crud', require('./routes/gap-no-projectarticle-crud'));
app.use('/api/gap-no-keyword-tracking', require('./routes/gap-no-keyword-tracking'));
app.use('/api/gap-no-competitor-url-management', require('./routes/gap-no-competitor-url-management'));
app.use('/api/gap-no-publishing-workflow-cms-export', require('./routes/gap-no-publishing-workflow-cms-export'));
app.use('/api/gap-no-google-analytics-search-console-integrati', require('./routes/gap-no-google-analytics-search-console-integrati'));
app.use('/api/gap-no-notifications-rbac-audit-log', require('./routes/gap-no-notifications-rbac-audit-log'));
app.use('/api/gap-no-template-library', require('./routes/gap-no-template-library'));
// === End Batch 07 ===
