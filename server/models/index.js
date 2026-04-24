const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// User Model
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'user' }
}, { tableName: 'users', timestamps: true });

// Keyword Research
const KeywordResearch = sequelize.define('KeywordResearch', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  keyword: { type: DataTypes.STRING, allowNull: false },
  searchVolume: { type: DataTypes.INTEGER, defaultValue: 0 },
  difficulty: { type: DataTypes.STRING, defaultValue: 'medium' },
  cpc: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  intent: { type: DataTypes.STRING, defaultValue: 'informational' },
  relatedKeywords: { type: DataTypes.TEXT, defaultValue: '[]' },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'keyword_research', timestamps: true });

// Content Generation
const ContentGeneration = sequelize.define('ContentGeneration', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  contentType: { type: DataTypes.STRING, defaultValue: 'blog_post' },
  targetKeyword: { type: DataTypes.STRING },
  content: { type: DataTypes.TEXT },
  wordCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  seoScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'content_generation', timestamps: true });

// Meta Tag Generator
const MetaTag = sequelize.define('MetaTag', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pageUrl: { type: DataTypes.STRING, allowNull: false },
  metaTitle: { type: DataTypes.STRING },
  metaDescription: { type: DataTypes.TEXT },
  ogTitle: { type: DataTypes.STRING },
  ogDescription: { type: DataTypes.TEXT },
  keywords: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'meta_tags', timestamps: true });

// SEO Audit
const SEOAudit = sequelize.define('SEOAudit', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  websiteUrl: { type: DataTypes.STRING, allowNull: false },
  overallScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  issuesFound: { type: DataTypes.INTEGER, defaultValue: 0 },
  recommendations: { type: DataTypes.TEXT },
  technicalScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  contentScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'completed' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'seo_audits', timestamps: true });

// Backlink Analyzer
const BacklinkAnalysis = sequelize.define('BacklinkAnalysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  targetUrl: { type: DataTypes.STRING, allowNull: false },
  totalBacklinks: { type: DataTypes.INTEGER, defaultValue: 0 },
  domainAuthority: { type: DataTypes.INTEGER, defaultValue: 0 },
  topReferrers: { type: DataTypes.TEXT },
  anchorTexts: { type: DataTypes.TEXT },
  quality: { type: DataTypes.STRING, defaultValue: 'medium' },
  status: { type: DataTypes.STRING, defaultValue: 'analyzed' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'backlink_analysis', timestamps: true });

// Content Optimizer
const ContentOptimizer = sequelize.define('ContentOptimizer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  originalContent: { type: DataTypes.TEXT },
  optimizedContent: { type: DataTypes.TEXT },
  targetKeyword: { type: DataTypes.STRING },
  originalScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  optimizedScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  suggestions: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'optimized' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'content_optimizer', timestamps: true });

// SERP Analyzer
const SERPAnalysis = sequelize.define('SERPAnalysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  keyword: { type: DataTypes.STRING, allowNull: false },
  searchEngine: { type: DataTypes.STRING, defaultValue: 'google' },
  topResults: { type: DataTypes.TEXT },
  featuredSnippet: { type: DataTypes.BOOLEAN, defaultValue: false },
  avgWordCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  avgDomainAuthority: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'analyzed' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'serp_analysis', timestamps: true });

// Competitor Analysis
const CompetitorAnalysis = sequelize.define('CompetitorAnalysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  competitorUrl: { type: DataTypes.STRING, allowNull: false },
  competitorName: { type: DataTypes.STRING },
  organicKeywords: { type: DataTypes.INTEGER, defaultValue: 0 },
  organicTraffic: { type: DataTypes.INTEGER, defaultValue: 0 },
  domainAuthority: { type: DataTypes.INTEGER, defaultValue: 0 },
  topPages: { type: DataTypes.TEXT },
  contentGaps: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'analyzed' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'competitor_analysis', timestamps: true });

// Title Generator
const TitleGenerator = sequelize.define('TitleGenerator', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  topic: { type: DataTypes.STRING, allowNull: false },
  targetKeyword: { type: DataTypes.STRING },
  generatedTitles: { type: DataTypes.TEXT },
  selectedTitle: { type: DataTypes.STRING },
  clickThroughRate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'generated' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'title_generator', timestamps: true });

// Blog Post Writer
const BlogPost = sequelize.define('BlogPost', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  topic: { type: DataTypes.STRING },
  targetKeyword: { type: DataTypes.STRING },
  content: { type: DataTypes.TEXT },
  excerpt: { type: DataTypes.TEXT },
  wordCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  readingTime: { type: DataTypes.INTEGER, defaultValue: 0 },
  seoScore: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'blog_posts', timestamps: true });

// Product Description Writer
const ProductDescription = sequelize.define('ProductDescription', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productName: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING },
  features: { type: DataTypes.TEXT },
  description: { type: DataTypes.TEXT },
  seoDescription: { type: DataTypes.TEXT },
  targetAudience: { type: DataTypes.STRING },
  tone: { type: DataTypes.STRING, defaultValue: 'professional' },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'product_descriptions', timestamps: true });

// FAQ Generator
const FAQGenerator = sequelize.define('FAQGenerator', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  topic: { type: DataTypes.STRING, allowNull: false },
  targetKeyword: { type: DataTypes.STRING },
  questions: { type: DataTypes.TEXT },
  answers: { type: DataTypes.TEXT },
  faqCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  schemaGenerated: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.STRING, defaultValue: 'generated' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'faq_generator', timestamps: true });

// Schema Markup Generator
const SchemaMarkup = sequelize.define('SchemaMarkup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pageUrl: { type: DataTypes.STRING, allowNull: false },
  schemaType: { type: DataTypes.STRING, allowNull: false },
  schemaData: { type: DataTypes.TEXT },
  validationStatus: { type: DataTypes.STRING, defaultValue: 'valid' },
  implementationCode: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'generated' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'schema_markup', timestamps: true });

// Content Calendar
const ContentCalendar = sequelize.define('ContentCalendar', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  contentType: { type: DataTypes.STRING },
  targetKeyword: { type: DataTypes.STRING },
  scheduledDate: { type: DataTypes.DATE },
  assignee: { type: DataTypes.STRING },
  priority: { type: DataTypes.STRING, defaultValue: 'medium' },
  notes: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'planned' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'content_calendar', timestamps: true });

// Readability Analyzer
const ReadabilityAnalysis = sequelize.define('ReadabilityAnalysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT },
  fleschScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  gradeLevel: { type: DataTypes.STRING },
  avgSentenceLength: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  passiveVoicePercent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  suggestions: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'analyzed' },
  userId: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'readability_analysis', timestamps: true });

module.exports = {
  sequelize,
  User,
  KeywordResearch,
  ContentGeneration,
  MetaTag,
  SEOAudit,
  BacklinkAnalysis,
  ContentOptimizer,
  SERPAnalysis,
  CompetitorAnalysis,
  TitleGenerator,
  BlogPost,
  ProductDescription,
  FAQGenerator,
  SchemaMarkup,
  ContentCalendar,
  ReadabilityAnalysis
};
