const express = require('express');
const https = require('https');
const http = require('http');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, parseAIJson } = require('../services/openrouter');
const {
  KeywordResearch, ContentGeneration, MetaTag, SEOAudit,
  BacklinkAnalysis, ContentOptimizer, SERPAnalysis, CompetitorAnalysis,
  TitleGenerator, BlogPost, ProductDescription, FAQGenerator,
  SchemaMarkup, ContentCalendar, ReadabilityAnalysis, ContentVersion
} = require('../models');

const router = express.Router();

// ==================== HELPERS ====================

// Compute keyword density
function computeKeywordDensity(text, keyword) {
  if (!text || !keyword) return { count: 0, density: 0 };
  const words = text.toLowerCase().split(/\s+/);
  const kw = keyword.toLowerCase();
  const count = words.filter(w => w.includes(kw)).length;
  return { count, density: parseFloat(((count / words.length) * 100).toFixed(2)) };
}

// Deterministic readability computation
function computeReadability(text) {
  if (!text) return { fleschScore: 0, gradeLevel: 'N/A', avgSentenceLength: 0, avgWordLength: 0 };
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((acc, word) => {
    const s = word.toLowerCase().replace(/[^a-z]/g, '');
    const matches = s.match(/[aeiou]+/g);
    return acc + (matches ? matches.length : 1);
  }, 0);

  const avgSentenceLength = sentences.length > 0 ? parseFloat((words.length / sentences.length).toFixed(2)) : 0;
  const avgSyllablesPerWord = words.length > 0 ? syllables / words.length : 0;
  const avgWordLength = parseFloat((words.reduce((acc, w) => acc + w.length, 0) / (words.length || 1)).toFixed(2));

  // Flesch-Kincaid Reading Ease
  const fleschScore = parseFloat(Math.min(100, Math.max(0,
    206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
  )).toFixed(2));

  let gradeLevel = '12th Grade';
  if (fleschScore >= 90) gradeLevel = '5th Grade';
  else if (fleschScore >= 80) gradeLevel = '6th Grade';
  else if (fleschScore >= 70) gradeLevel = '7th Grade';
  else if (fleschScore >= 60) gradeLevel = '8th-9th Grade';
  else if (fleschScore >= 50) gradeLevel = '10th-12th Grade';
  else if (fleschScore >= 30) gradeLevel = 'College Level';
  else gradeLevel = 'Professional/Academic';

  return { fleschScore, gradeLevel, avgSentenceLength, avgWordLength };
}

// Fetch URL and extract page data
function fetchPageData(url) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const req = lib.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const metaDesc = (body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || '';
        const h1 = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '') || '';
        const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
        const imageCount = (body.match(/<img/gi) || []).length;
        resolve({ title: title.trim(), metaDesc: metaDesc.trim(), h1: h1.trim(), wordCount, imageCount });
      });
    });
    req.on('error', () => resolve({ title: '', metaDesc: '', h1: '', wordCount: 0, imageCount: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ title: '', metaDesc: '', h1: '', wordCount: 0, imageCount: 0 }); });
  });
}

// ==================== CRUD HELPERS ====================

function createCRUD(path, Model) {
  // List all with pagination
  router.get(`/${path}`, auth, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const { count, rows } = await Model.findAndCountAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      res.json({ data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get(`/${path}/:id`, auth, async (req, res) => {
    try {
      const item = await Model.findOne({ where: { id: req.params.id, userId: req.user.id } });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post(`/${path}`, auth, async (req, res) => {
    try {
      const item = await Model.create({ ...req.body, userId: req.user.id });
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put(`/${path}/:id`, auth, async (req, res) => {
    try {
      const item = await Model.findOne({ where: { id: req.params.id, userId: req.user.id } });
      if (!item) return res.status(404).json({ error: 'Not found' });

      // Create version before update (for content items)
      if (item.content || item.metaDescription || item.description) {
        const versionCount = await ContentVersion.count({ where: { contentId: item.id } }).catch(() => 0);
        await ContentVersion.create({
          contentId: item.id,
          versionNumber: versionCount + 1,
          contentText: item.content || item.metaDescription || item.description || '',
        }).catch(() => {});
      }

      await item.update(req.body);
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete(`/${path}/:id`, auth, async (req, res) => {
    try {
      const item = await Model.findOne({ where: { id: req.params.id, userId: req.user.id } });
      if (!item) return res.status(404).json({ error: 'Not found' });
      await item.destroy();
      res.json({ message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Register CRUD
createCRUD('keyword-research', KeywordResearch);
createCRUD('content-generation', ContentGeneration);
createCRUD('meta-tags', MetaTag);
createCRUD('seo-audits', SEOAudit);
createCRUD('backlink-analysis', BacklinkAnalysis);
createCRUD('content-optimizer', ContentOptimizer);
createCRUD('serp-analysis', SERPAnalysis);
createCRUD('competitor-analysis', CompetitorAnalysis);
createCRUD('title-generator', TitleGenerator);
createCRUD('blog-posts', BlogPost);
createCRUD('product-descriptions', ProductDescription);
createCRUD('faq-generator', FAQGenerator);
createCRUD('schema-markup', SchemaMarkup);
createCRUD('content-calendar', ContentCalendar);
createCRUD('readability-analysis', ReadabilityAnalysis);

// ==================== VERSION HISTORY ====================
router.get('/content-generation/:id/versions', auth, async (req, res) => {
  try {
    const versions = await ContentVersion.findAll({
      where: { contentId: req.params.id },
      order: [['versionNumber', 'DESC']],
    });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI ENDPOINTS ====================

// AI Keyword Research
router.post('/ai/keyword-research', auth, aiRateLimiter, async (req, res) => {
  try {
    const { keyword } = req.body;
    const result = await callOpenRouter(
      `Analyze the keyword "${keyword}" for SEO. Respond ONLY with valid JSON:
{
  "searchVolume": <integer monthly searches>,
  "difficulty": "easy|medium|hard",
  "cpc": <decimal USD>,
  "intent": "informational|navigational|transactional|commercial",
  "competition": "low|medium|high",
  "relatedKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "contentSuggestions": ["suggestion1", "suggestion2"],
  "narrative": "detailed analysis text"
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await KeywordResearch.create({
      keyword,
      searchVolume: parsed.searchVolume || 1000,
      difficulty: parsed.difficulty || 'medium',
      cpc: parsed.cpc || 1.00,
      intent: parsed.intent || 'informational',
      relatedKeywords: JSON.stringify(parsed.relatedKeywords || []),
      status: 'active',
      userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Content Generation with keyword density + readability
router.post('/ai/content-generation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { title, contentType, targetKeyword } = req.body;
    const result = await callOpenRouter(
      `Write a high-quality SEO-optimized ${contentType || 'blog post'} about "${title}". Target keyword: "${targetKeyword || title}". Also respond with a JSON metadata block at the END of your response in this format:
METADATA_JSON:{"seoScore": <integer 0-100>, "readabilityScore": <integer 0-100>, "keywordDensityTarget": <decimal percent>}`
    );
    const content = result.choices[0].message.content;
    const jsonPart = content.match(/METADATA_JSON:(\{[^}]+\})/);
    const meta = jsonPart ? (parseAIJson(jsonPart[1]) || {}) : {};
    const cleanContent = content.replace(/METADATA_JSON:[^\n]*/g, '').trim();

    const wordCount = cleanContent.split(/\s+/).length;
    const { fleschScore, gradeLevel, avgSentenceLength } = computeReadability(cleanContent);
    const { count: kwCount, density: kwDensity } = computeKeywordDensity(cleanContent, targetKeyword || title);

    const saved = await ContentGeneration.create({
      title, contentType: contentType || 'blog_post', targetKeyword: targetKeyword || title,
      content: cleanContent, wordCount,
      seoScore: meta.seoScore || 75,
      status: 'generated', userId: req.user.id,
    });
    res.json({
      item: saved,
      readability: { fleschScore, gradeLevel, avgSentenceLength },
      keywordDensity: { keyword: targetKeyword || title, count: kwCount, density: kwDensity },
      aiResponse: { content: cleanContent, model: result.model, usage: result.usage },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Meta Tag Generator
router.post('/ai/meta-tags', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pageUrl, pageDescription } = req.body;
    const result = await callOpenRouter(
      `Generate optimized meta tags for "${pageUrl}". Description: "${pageDescription || 'General web page'}". Respond ONLY with valid JSON:
{
  "metaTitle": "title max 60 chars",
  "metaDescription": "description max 160 chars",
  "ogTitle": "og title",
  "ogDescription": "og description",
  "keywords": "kw1, kw2, kw3",
  "twitterDescription": "twitter description"
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await MetaTag.create({
      pageUrl,
      metaTitle: parsed.metaTitle || `${pageUrl} - Optimized`,
      metaDescription: parsed.metaDescription || content.substring(0, 160),
      ogTitle: parsed.ogTitle || parsed.metaTitle || '',
      ogDescription: parsed.ogDescription || '',
      keywords: parsed.keywords || '',
      status: 'generated', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI SEO Audit with URL fetching
router.post('/ai/seo-audit', auth, aiRateLimiter, async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    let pageData = { title: '', metaDesc: '', h1: '', wordCount: 0, imageCount: 0 };

    // Fetch real page data
    if (websiteUrl && (websiteUrl.startsWith('http://') || websiteUrl.startsWith('https://'))) {
      pageData = await fetchPageData(websiteUrl);
    }

    const result = await callOpenRouter(
      `Perform a comprehensive SEO audit for "${websiteUrl}".
Real page data extracted:
- Title: "${pageData.title}"
- Meta Description: "${pageData.metaDesc}"
- H1: "${pageData.h1}"
- Word Count: ${pageData.wordCount}
- Image Count: ${pageData.imageCount}

Respond ONLY with valid JSON:
{
  "overallScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "contentScore": <integer 0-100>,
  "issuesFound": <integer>,
  "criticalIssues": ["issue1"],
  "recommendations": ["rec1", "rec2"],
  "prioritizedActions": [{"action": "text", "priority": "critical|high|medium|low"}]
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await SEOAudit.create({
      websiteUrl,
      overallScore: parsed.overallScore || 70,
      issuesFound: parsed.issuesFound || 5,
      recommendations: JSON.stringify(parsed.recommendations || [content]),
      technicalScore: parsed.technicalScore || 70,
      contentScore: parsed.contentScore || 70,
      status: 'completed', userId: req.user.id,
    });
    res.json({ item: saved, pageData, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Backlink Analysis
router.post('/ai/backlink-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const { targetUrl } = req.body;
    const result = await callOpenRouter(
      `Analyze the backlink profile for "${targetUrl}". Respond ONLY with valid JSON:
{
  "totalBacklinks": <integer estimate>,
  "domainAuthority": <integer 1-100>,
  "quality": "low|medium|high",
  "topReferrers": ["domain1.com", "domain2.com"],
  "anchorTexts": ["anchor1", "anchor2"],
  "linkBuildingStrategy": "strategy text",
  "toxicLinkIndicators": ["indicator1"]
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await BacklinkAnalysis.create({
      targetUrl,
      totalBacklinks: parsed.totalBacklinks || 500,
      domainAuthority: parsed.domainAuthority || 35,
      topReferrers: JSON.stringify(parsed.topReferrers || [content]),
      anchorTexts: JSON.stringify(parsed.anchorTexts || []),
      quality: parsed.quality || 'medium',
      status: 'analyzed', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Content Optimizer with readability + keyword density
router.post('/ai/content-optimizer', auth, aiRateLimiter, async (req, res) => {
  try {
    const { title, originalContent, targetKeyword } = req.body;
    const result = await callOpenRouter(
      `Optimize the following content for SEO. Target keyword: "${targetKeyword || title}".
Content: ${originalContent || 'No content provided.'}
Respond ONLY with valid JSON:
{
  "originalScore": <integer 0-100>,
  "optimizedScore": <integer 0-100>,
  "optimizedContent": "the optimized version of the content",
  "improvements": ["improvement1", "improvement2"],
  "headingStructure": ["H2: heading", "H3: subheading"]
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const { fleschScore, gradeLevel } = computeReadability(parsed.optimizedContent || originalContent || '');
    const { count: kwCount, density: kwDensity } = computeKeywordDensity(parsed.optimizedContent || '', targetKeyword || title);

    const saved = await ContentOptimizer.create({
      title, originalContent: originalContent || '',
      optimizedContent: parsed.optimizedContent || content,
      targetKeyword: targetKeyword || title,
      originalScore: parsed.originalScore || 50,
      optimizedScore: parsed.optimizedScore || 80,
      suggestions: JSON.stringify(parsed.improvements || [content]),
      status: 'optimized', userId: req.user.id,
    });
    res.json({
      item: saved,
      readability: { fleschScore, gradeLevel },
      keywordDensity: { keyword: targetKeyword, count: kwCount, density: kwDensity },
      aiResponse: { content, parsed, model: result.model, usage: result.usage },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI SERP Analysis
router.post('/ai/serp-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const { keyword } = req.body;
    const result = await callOpenRouter(
      `Analyze SERP for keyword "${keyword}". Respond ONLY with valid JSON:
{
  "featuredSnippet": <boolean>,
  "avgWordCount": <integer>,
  "avgDomainAuthority": <integer 0-100>,
  "serpFeatures": ["feature1", "feature2"],
  "contentType": "article|video|product|mixed",
  "rankingOpportunities": ["opportunity1"],
  "topResults": "analysis of top results"
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await SERPAnalysis.create({
      keyword, searchEngine: 'google',
      topResults: parsed.topResults || content,
      featuredSnippet: parsed.featuredSnippet || false,
      avgWordCount: parsed.avgWordCount || 1500,
      avgDomainAuthority: parsed.avgDomainAuthority || 50,
      status: 'analyzed', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Competitor Analysis
router.post('/ai/competitor-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const { competitorUrl, competitorName } = req.body;
    const result = await callOpenRouter(
      `Perform SEO competitor analysis for "${competitorName || competitorUrl}". Respond ONLY with valid JSON:
{
  "organicKeywords": <integer estimate>,
  "organicTraffic": <integer estimate monthly>,
  "domainAuthority": <integer 0-100>,
  "contentGaps": ["gap1", "gap2"],
  "topPages": ["page1", "page2"],
  "strengths": ["strength1"],
  "weaknesses": ["weakness1"],
  "recommendations": "recommendations to outperform"
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await CompetitorAnalysis.create({
      competitorUrl, competitorName: competitorName || competitorUrl,
      organicKeywords: parsed.organicKeywords || 5000,
      organicTraffic: parsed.organicTraffic || 10000,
      domainAuthority: parsed.domainAuthority || 40,
      topPages: JSON.stringify(parsed.topPages || []),
      contentGaps: JSON.stringify(parsed.contentGaps || [content]),
      status: 'analyzed', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Title Generator
router.post('/ai/title-generator', auth, aiRateLimiter, async (req, res) => {
  try {
    const { topic, targetKeyword } = req.body;
    const result = await callOpenRouter(
      `Generate 10 SEO-optimized blog titles for "${topic}" targeting "${targetKeyword || topic}". Respond ONLY with valid JSON:
{
  "titles": [
    {"title": "text", "estimatedCtr": <decimal 1-10>, "format": "how-to|listicle|question|guide|news"}
  ],
  "bestTitle": "the best title choice",
  "reasoning": "why this title is best"
}`
    );
    const content = result.choices[0].message.content;
    const parsed = parseAIJson(content) || {};

    const saved = await TitleGenerator.create({
      topic, targetKeyword: targetKeyword || topic,
      generatedTitles: JSON.stringify(parsed.titles || [{ title: content }]),
      selectedTitle: parsed.bestTitle || `Guide: ${topic}`,
      clickThroughRate: parsed.titles?.[0]?.estimatedCtr || 3.5,
      status: 'generated', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, parsed, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Blog Post Writer with readability + keyword density
router.post('/ai/blog-posts', auth, aiRateLimiter, async (req, res) => {
  try {
    const { title, topic, targetKeyword } = req.body;
    const result = await callOpenRouter(
      `Write a complete, SEO-optimized blog post. Title: "${title}". Target keyword: "${targetKeyword || title}". Include intro, H2/H3 headings, FAQ, meta description, CTA. Also append: METADATA_JSON:{"seoScore": <int 0-100>}`
    );
    const content = result.choices[0].message.content;
    const metaMatch = content.match(/METADATA_JSON:(\{[^}]+\})/);
    const meta = metaMatch ? (parseAIJson(metaMatch[1]) || {}) : {};
    const cleanContent = content.replace(/METADATA_JSON:[^\n]*/g, '').trim();

    const wordCount = cleanContent.split(/\s+/).length;
    const { fleschScore, gradeLevel, avgSentenceLength } = computeReadability(cleanContent);
    const { count: kwCount, density: kwDensity } = computeKeywordDensity(cleanContent, targetKeyword || title);

    const saved = await BlogPost.create({
      title, topic: topic || title, targetKeyword: targetKeyword || title,
      content: cleanContent, excerpt: cleanContent.substring(0, 200),
      wordCount, readingTime: Math.ceil(wordCount / 200),
      seoScore: meta.seoScore || 80,
      status: 'generated', userId: req.user.id,
    });
    res.json({
      item: saved,
      readability: { fleschScore, gradeLevel, avgSentenceLength },
      keywordDensity: { keyword: targetKeyword || title, count: kwCount, density: kwDensity },
      aiResponse: { content: cleanContent, model: result.model, usage: result.usage },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Product Description
router.post('/ai/product-descriptions', auth, aiRateLimiter, async (req, res) => {
  try {
    const { productName, category, features, targetAudience, tone } = req.body;
    const result = await callOpenRouter(
      `Write an SEO-optimized product description for "${productName}". Category: "${category}". Features: "${features}". Audience: "${targetAudience}". Tone: "${tone || 'professional'}".`
    );
    const content = result.choices[0].message.content;
    const saved = await ProductDescription.create({
      productName, category: category || 'General', features: features || '',
      description: content, seoDescription: content.substring(0, 300),
      targetAudience: targetAudience || 'General', tone: tone || 'professional',
      status: 'generated', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI FAQ Generator
router.post('/ai/faq-generator', auth, aiRateLimiter, async (req, res) => {
  try {
    const { topic, targetKeyword } = req.body;
    const result = await callOpenRouter(
      `Generate comprehensive FAQ for "${topic}" targeting "${targetKeyword || topic}". Include FAQ Schema JSON-LD.`
    );
    const content = result.choices[0].message.content;
    const saved = await FAQGenerator.create({
      topic, targetKeyword: targetKeyword || topic,
      questions: content, answers: content,
      faqCount: (content.match(/Q:/gi) || content.match(/\?/g) || []).length || 10,
      schemaGenerated: true,
      status: 'generated', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Schema Markup
router.post('/ai/schema-markup', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pageUrl, schemaType } = req.body;
    const result = await callOpenRouter(
      `Generate complete Schema.org JSON-LD for "${pageUrl}", type: "${schemaType || 'Article'}". Include all required/recommended properties and validation checklist.`
    );
    const content = result.choices[0].message.content;
    const saved = await SchemaMarkup.create({
      pageUrl, schemaType: schemaType || 'Article',
      schemaData: content, validationStatus: 'valid',
      implementationCode: content, status: 'generated', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Content Calendar
router.post('/ai/content-calendar', auth, aiRateLimiter, async (req, res) => {
  try {
    const { title, contentType, targetKeyword, scheduledDate, priority } = req.body;
    const result = await callOpenRouter(
      `Create a content plan for: "${title}", type: "${contentType}", keyword: "${targetKeyword}". Include brief, outline, KPIs.`
    );
    const content = result.choices[0].message.content;
    const saved = await ContentCalendar.create({
      title, contentType: contentType || 'blog_post',
      targetKeyword: targetKeyword || title,
      scheduledDate: scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      assignee: 'AI Generated', priority: priority || 'medium',
      notes: content, status: 'planned', userId: req.user.id,
    });
    res.json({ item: saved, aiResponse: { content, model: result.model, usage: result.usage } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Readability Analysis with deterministic computation
router.post('/ai/readability-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const { title, content } = req.body;

    // Deterministic readability score
    const readability = computeReadability(content || '');

    const result = await callOpenRouter(
      `Analyze readability for: "${title}". Content: "${(content || '').substring(0, 1000)}".
Computed metrics: Flesch Score: ${readability.fleschScore}, Grade: ${readability.gradeLevel}, Avg Sentence: ${readability.avgSentenceLength} words.
Provide improvement suggestions and rewritten paragraphs. Respond with specific, actionable advice.`
    );
    const aiContent = result.choices[0].message.content;

    const saved = await ReadabilityAnalysis.create({
      title, content: content || '',
      fleschScore: readability.fleschScore,
      gradeLevel: readability.gradeLevel,
      avgSentenceLength: readability.avgSentenceLength,
      passiveVoicePercent: 0,
      suggestions: aiContent, status: 'analyzed', userId: req.user.id,
    });
    res.json({
      item: saved,
      readability,
      aiResponse: { content: aiContent, model: result.model, usage: result.usage },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Content Outline (structure for an article)
router.post('/ai/content-outline', auth, aiRateLimiter, async (req, res) => {
  try {
    const { topic, primary_keyword, secondary_keywords, target_audience, word_count_target } = req.body || {};
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const result = await callOpenRouter(
      `Create a structured SEO content outline for an article. Respond ONLY in JSON.
Topic: ${topic}
Primary keyword: ${primary_keyword || ''}
Secondary keywords: ${(secondary_keywords || []).join(', ')}
Target audience: ${target_audience || 'general'}
Target word count: ${word_count_target || 1500}

Return JSON: {title_suggestions:[], meta_description, h1, sections:[{h2,intent,word_target,h3:[],bullets:[],keywords_to_include:[]}], internal_link_targets:[], external_authority_sources:[], faq_section:[{question,answer_outline}], cta_suggestion}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ outline: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Backlink Opportunity Finder
router.post('/ai/backlink-opportunity', auth, aiRateLimiter, async (req, res) => {
  try {
    const { domain, niche, target_pages, current_backlinks } = req.body || {};
    if (!domain && !niche) return res.status(400).json({ error: 'domain or niche is required' });
    const result = await callOpenRouter(
      `You are a backlink-strategy AI. Identify the highest-value link-building opportunities. Respond ONLY in JSON.
Domain: ${domain || ''}
Niche: ${niche || ''}
Target pages to build links to: ${JSON.stringify(target_pages || [])}
Current backlinks (sample): ${JSON.stringify(current_backlinks || [])}

Return JSON: {opportunities:[{type:"guest_post|resource_page|broken_link|hara|podcast|expert_roundup|directory|partnership",site_or_publication,target_url_suggestion,pitch_angle,outreach_template,expected_da_range,priority:"high|medium|low",effort:"low|medium|high"}], avoid:[{site,reason}], summary, suggested_pace_per_week}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ opportunities: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Search Intent Matcher
router.post('/ai/intent-matcher', auth, aiRateLimiter, async (req, res) => {
  try {
    const { keywords, existing_content_urls } = req.body || {};
    if (!keywords || !keywords.length) return res.status(400).json({ error: 'keywords array is required' });
    const result = await callOpenRouter(
      `You are a search-intent classification AI. Map each keyword to the dominant search intent and recommend the right content format. Respond ONLY in JSON.
Keywords: ${JSON.stringify(keywords)}
Existing content URLs (optional): ${JSON.stringify(existing_content_urls || [])}

Return JSON: {keyword_intents:[{keyword,intent:"informational|navigational|commercial|transactional",sub_intent,recommended_format:"blog|comparison|how_to|listicle|product_page|category_page|video|tool",funnel_stage:"TOFU|MOFU|BOFU",competing_serp_features:[],content_angle,word_count_estimate}], clusters:[{cluster_name,keywords:[],pillar_format,cluster_articles:[]}], cannibalization_risks:[{keyword,risk}], summary}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ intent_map: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Apply pass 4 (mechanical) — additional canonical AI endpoints
// 503 when OPENROUTER_API_KEY missing.
// ============================================================================

function ensureApiKeyOr503(res) {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k || k === 'your_openrouter_api_key_here') {
    res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
    return false;
  }
  return true;
}

// AI Pillar + Cluster Orchestration (pillar page + supporting articles + internal-link plan)
router.post('/ai/pillar-cluster-orchestration', auth, aiRateLimiter, async (req, res) => {
  if (!ensureApiKeyOr503(res)) return;
  try {
    const { topic, primary_keyword, num_articles = 6, audience } = req.body || {};
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const n = Math.min(Math.max(parseInt(num_articles) || 6, 3), 20);
    const result = await callOpenRouter(
      `As an SEO orchestration agent, build a pillar+cluster plan. Respond ONLY in JSON.
Topic: ${topic}
Primary keyword: ${primary_keyword || ''}
Audience: ${audience || 'general'}
Number of supporting articles: ${n}

Return JSON: {pillar:{title,target_keyword,outline:[{h2,bullets:[]}],meta_description,word_count_target,internal_link_targets:[]}, supporting_articles:[{title,target_keyword,intent,outline:[{h2,bullets:[]}],links_to_pillar:true,word_count_target}], internal_link_plan:[{from,to,anchor_text}], publishing_cadence, success_metrics:[], summary}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ orchestration: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    if (err.message && err.message.includes('OPENROUTER_API_KEY not configured')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// AI Content Gap Analyzer (vs competitor URLs / topics)
router.post('/ai/content-gap-analyzer', auth, aiRateLimiter, async (req, res) => {
  if (!ensureApiKeyOr503(res)) return;
  try {
    const { our_topics, competitor_topics, niche } = req.body || {};
    if (!our_topics && !competitor_topics) return res.status(400).json({ error: 'our_topics or competitor_topics is required' });
    const result = await callOpenRouter(
      `As a content-gap analyst, identify opportunities our content does not yet cover. Respond ONLY in JSON.
Our topics: ${JSON.stringify(our_topics || [])}
Competitor topics: ${JSON.stringify(competitor_topics || [])}
Niche: ${niche || ''}

Return JSON: {gaps:[{topic,priority:"high|medium|low",rationale,suggested_format:"blog|comparison|how_to|listicle|video",funnel_stage:"TOFU|MOFU|BOFU",estimated_search_volume:"low|medium|high",difficulty:"low|medium|high",first_draft_outline:[{h2,bullets:[]}]}], duplicate_topics:[], summary, top_3_quick_wins:[]}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ gaps: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    if (err.message && err.message.includes('OPENROUTER_API_KEY not configured')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// AI Internal Link Suggester
router.post('/ai/internal-link-suggester', auth, aiRateLimiter, async (req, res) => {
  if (!ensureApiKeyOr503(res)) return;
  try {
    const { content, page_url, candidate_pages } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content is required' });
    const result = await callOpenRouter(
      `As an internal-linking strategist, suggest internal links to insert into the supplied content from a list of candidate destination pages. Respond ONLY in JSON.
Source page URL: ${page_url || ''}
Source content (first 4000 chars): ${String(content).slice(0, 4000)}
Candidate destination pages: ${JSON.stringify(candidate_pages || [])}

Return JSON: {suggestions:[{anchor_text,target_url,rationale,placement_hint:"section heading or paragraph snippet"}], anchor_diversity_score:0, links_to_avoid:[{url,reason}], summary}.`
    );
    const aiContent = result.choices[0].message.content;
    const parsed = parseAIJson(aiContent) || { raw: aiContent };
    res.json({ links: parsed, model: result.model, usage: result.usage });
  } catch (err) {
    if (err.message && err.message.includes('OPENROUTER_API_KEY not configured')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get('/dashboard/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [keywords, contents, audits, blogPosts, products, faqs] = await Promise.all([
      KeywordResearch.count({ where: { userId } }),
      ContentGeneration.count({ where: { userId } }),
      SEOAudit.count({ where: { userId } }),
      BlogPost.count({ where: { userId } }),
      ProductDescription.count({ where: { userId } }),
      FAQGenerator.count({ where: { userId } }),
    ]);
    res.json({
      totalKeywords: keywords,
      totalContent: contents,
      totalAudits: audits,
      totalBlogPosts: blogPosts,
      totalProducts: products,
      totalFAQs: faqs,
      totalItems: keywords + contents + audits + blogPosts + products + faqs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
