const pool = require('../lib/db');
const Joi = require('joi');

const BASE_URL = 'https://legioners.uz';

// Get language from query
const getLanguage = (req) => {
  return req.query.lang === 'ru' ? 'ru' : 'uz';
};

// Validation schemas
const articleSchema = Joi.object({
  titleUz: Joi.string().required(),
  titleRu: Joi.string().required(),
  contentUz: Joi.string().required(),
  contentRu: Joi.string().required(),
  categoryId: Joi.string().required(),
  tags: Joi.array().items(Joi.string()).default([]),
  coverImage: Joi.string().optional(),
  youtubeUrl: Joi.string().optional(),
  publishDate: Joi.date().optional(),
});

const searchSchema = Joi.object({
  q: Joi.string().optional(),
  category: Joi.string().optional(),
  date: Joi.date().optional(),
  club: Joi.string().optional(),
  player: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  lang: Joi.string().valid('uz', 'ru').optional(),
});

// Get all articles with filters
const getArticles = async (req, res) => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { q, category, date, club, player, page, limit } = value;
    const skip = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(
        "titleUz" ILIKE $${paramIndex} OR
        "titleRu" ILIKE $${paramIndex + 1} OR
        "contentUz" ILIKE $${paramIndex + 2} OR
        "contentRu" ILIKE $${paramIndex + 3}
      )`);
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      paramIndex += 4;
    }

    if (category) {
      conditions.push(`c.slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (date) {
      conditions.push(`a."publishDate" >= $${paramIndex}`);
      params.push(new Date(date));
      paramIndex++;
    }

    if (club || player) {
      const tags = [club, player].filter(Boolean);
      conditions.push(`a.tags && $${paramIndex}`);
      params.push(tags);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Articles query
    const articlesQuery = `
      SELECT
        a.id, a."titleUz", a."titleRu", a."contentUz", a."contentRu",
        a.tags, a."coverImage", a."youtubeUrl", a."publishDate",
        a."createdAt", a."updatedAt",
        c.id as category_id, c."nameUz" as category_name_uz, c."nameRu" as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      ${whereClause}
      ORDER BY a."publishDate" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, skip);
    const articlesResult = await pool.query(articlesQuery, params);

    const lang = getLanguage(req);

    // Format articles based on language
    const formattedArticles = articlesResult.rows.map(article => ({
      id: article.id,
      title: lang === 'ru' ? article.titleRu : article.titleUz,
      content: lang === 'ru' ? article.contentRu : article.contentUz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }));

    res.json({
      articles: formattedArticles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get related articles
const getRelatedArticles = async (req, res) => {
  try {
    const { id } = req.params;
    const lang = getLanguage(req);

    // Get the article to find its category
    const articleQuery = `
      SELECT a."categoryId", c."nameUz", c."nameRu", c.slug
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      WHERE a.id = $1
    `;
    const articleResult = await pool.query(articleQuery, [id]);

    if (articleResult.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const categoryId = articleResult.rows[0].categoryId;

    // Get related articles from same category, excluding the current one
    const relatedQuery = `
      SELECT
        a.id, a."titleUz", a."titleRu", a."contentUz", a."contentRu",
        a.tags, a."coverImage", a."youtubeUrl", a."publishDate",
        a."createdAt", a."updatedAt",
        c.id as category_id, c."nameUz" as category_name_uz, c."nameRu" as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      WHERE a."categoryId" = $1 AND a.id != $2
      ORDER BY a."publishDate" DESC
      LIMIT 3
    `;
    const relatedResult = await pool.query(relatedQuery, [categoryId, id]);

    // Format related articles
    const formattedArticles = relatedResult.rows.map(related => ({
      id: related.id,
      title: lang === 'ru' ? related.titleRu : related.titleUz,
      content: lang === 'ru' ? related.contentRu : related.contentUz,
      category: {
        id: related.category_id,
        name: lang === 'ru' ? related.category_name_ru : related.category_name_uz,
        slug: related.category_slug,
      },
      tags: related.tags,
      coverImage: related.coverImage ? `${BASE_URL}${related.coverImage}` : null,
      youtubeUrl: related.youtubeUrl,
      publishDate: related.publishDate,
      createdAt: related.createdAt,
      updatedAt: related.updatedAt,
    }));

    res.json(formattedArticles);
  } catch (error) {
    console.error('Get related articles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single article
const getArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const lang = getLanguage(req);

    const query = `
      SELECT
        a.id, a."titleUz", a."titleRu", a."contentUz", a."contentRu",
        a.tags, a."coverImage", a."youtubeUrl", a."publishDate",
        a."createdAt", a."updatedAt",
        c.id as category_id, c."nameUz" as category_name_uz, c."nameRu" as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      WHERE a.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const article = result.rows[0];

    // Format article based on language
    const formattedArticle = {
      id: article.id,
      title: lang === 'ru' ? article.titleRu : article.titleUz,
      content: lang === 'ru' ? article.contentRu : article.contentUz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };

    res.json(formattedArticle);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create article
const createArticle = async (req, res) => {
  try {
    // Parse tags if it's a string (from FormData)
    if (req.body.tags && typeof req.body.tags === 'string') {
      try {
        req.body.tags = JSON.parse(req.body.tags);
      } catch (e) {
        // If not JSON, treat as comma-separated string
        req.body.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    const { error, value } = articleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Handle file upload
    if (req.file) {
      value.coverImage = `/uploads/${req.file.filename}`;
    }

    // Set userId from authenticated user
    value.userId = req.userId;

    const insertQuery = `
      INSERT INTO articles ("titleUz", "titleRu", "contentUz", "contentRu", "categoryId", "userId", tags, "coverImage", "youtubeUrl", "publishDate")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, "titleUz", "titleRu", "contentUz", "contentRu", tags, "coverImage", "youtubeUrl", "publishDate", "createdAt", "updatedAt"
    `;
    const params = [
      value.titleUz, value.titleRu, value.contentUz, value.contentRu,
      value.categoryId, value.userId, value.tags, value.coverImage,
      value.youtubeUrl, value.publishDate || new Date()
    ];
    const insertResult = await pool.query(insertQuery, params);

    const article = insertResult.rows[0];

    // Get category info
    const categoryQuery = 'SELECT id, "nameUz", "nameRu", slug FROM categories WHERE id = $1';
    const categoryResult = await pool.query(categoryQuery, [value.categoryId]);
    const category = categoryResult.rows[0];

    // Format the response with full image URL
    const formattedArticle = {
      id: article.id,
      titleUz: article.titleUz,
      titleRu: article.titleRu,
      contentUz: article.contentUz,
      contentRu: article.contentRu,
      category: category,
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };

    res.status(201).json(formattedArticle);
  } catch (error) {
    console.error('Create article error:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update article
const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;

    // Parse tags if it's a string (from FormData)
    if (req.body.tags && typeof req.body.tags === 'string') {
      try {
        req.body.tags = JSON.parse(req.body.tags);
      } catch (e) {
        // If not JSON, treat as comma-separated string
        req.body.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    const { error, value } = articleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Handle file upload
    if (req.file) {
      value.coverImage = `/uploads/${req.file.filename}`;
    }

    const updateQuery = `
      UPDATE articles
      SET "titleUz" = $1, "titleRu" = $2, "contentUz" = $3, "contentRu" = $4,
          "categoryId" = $5, tags = $6, "coverImage" = $7, "youtubeUrl" = $8, "publishDate" = $9, "updatedAt" = NOW()
      WHERE id = $10
      RETURNING id, "titleUz", "titleRu", "contentUz", "contentRu", tags, "coverImage", "youtubeUrl", "publishDate", "createdAt", "updatedAt"
    `;
    const params = [
      value.titleUz, value.titleRu, value.contentUz, value.contentRu,
      value.categoryId, value.tags, value.coverImage, value.youtubeUrl,
      value.publishDate, id
    ];
    const updateResult = await pool.query(updateQuery, params);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = updateResult.rows[0];

    // Get category info
    const categoryQuery = 'SELECT id, "nameUz", "nameRu", slug FROM categories WHERE id = $1';
    const categoryResult = await pool.query(categoryQuery, [value.categoryId]);
    const category = categoryResult.rows[0];

    // Format the response with full image URL
    const formattedArticle = {
      id: article.id,
      titleUz: article.titleUz,
      titleRu: article.titleRu,
      contentUz: article.contentUz,
      contentRu: article.contentRu,
      category: category,
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };

    res.json(formattedArticle);
  } catch (error) {
    console.error('Update article error:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get article for editing (raw data)
const getArticleForEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const query = `
      SELECT
        a.id, a."titleUz", a."titleRu", a."contentUz", a."contentRu",
        a."categoryId", a.tags, a."coverImage", a."youtubeUrl", a."publishDate",
        a."createdAt", a."updatedAt"
      FROM articles a
      WHERE a.id = $1 AND a."userId" = $2
    `;
    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const article = result.rows[0];

    res.json({
      id: article.id,
      titleUz: article.titleUz,
      titleRu: article.titleRu,
      contentUz: article.contentUz,
      contentRu: article.contentRu,
      categoryId: article.categoryId,
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    });
  } catch (error) {
    console.error('Get article for edit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get articles by user
const getUserArticles = async (req, res) => {
  try {
    const lang = getLanguage(req);
    const userId = req.userId;

    const query = `
      SELECT
        a.id, a."titleUz", a."titleRu", a."contentUz", a."contentRu",
        a.tags, a."coverImage", a."youtubeUrl", a."publishDate",
        a."createdAt", a."updatedAt",
        c.id as category_id, c."nameUz" as category_name_uz, c."nameRu" as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a."categoryId" = c.id
      WHERE a."userId" = $1
      ORDER BY a."publishDate" DESC
    `;
    const result = await pool.query(query, [userId]);

    // Format articles based on language
    const formattedArticles = result.rows.map(article => ({
      id: article.id,
      title: lang === 'ru' ? article.titleRu : article.titleUz,
      content: lang === 'ru' ? article.contentRu : article.contentUz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: article.coverImage ? `${BASE_URL}${article.coverImage}` : null,
      youtubeUrl: article.youtubeUrl,
      publishDate: article.publishDate,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }));

    res.json(formattedArticles);
  } catch (error) {
    console.error('Get user articles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete article
const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteQuery = 'DELETE FROM articles WHERE id = $1';
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getArticles,
  getArticle,
  getRelatedArticles,
  getUserArticles,
  getArticleForEdit,
  createArticle,
  updateArticle,
  deleteArticle,
};
