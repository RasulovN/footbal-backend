const pool = require('../lib/db');
const Joi = require('joi');
const { mapBodyToDb, keysToCamel } = require('../lib/utils');

// Get base URL from environment or use relative path
// This ensures URLs work in both development and production
function getBaseUrl(req) {
  // In production behind nginx/reverse proxy, use relative URLs
  // This avoids hardcoding the domain
  return '';
}

/**
 * Helper function to format article image URL
 * Returns relative URL for local/production compatibility
 * @param {string|null} coverImage - Image filename from DB
 * @param {object} req - Request object for protocol detection
 * @returns {string|null} - Formatted image URL or null
 */
function formatImageUrl(coverImage, req) {
  if (!coverImage) return null;
  
  // Return relative URL - Express static middleware serves it correctly
  // Frontend should prepend the base URL if needed
  return `${coverImage}`;
}

// Validation schemas (camelCase for API)
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

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(
        title_uz ILIKE $${paramIndex} OR
        title_ru ILIKE $${paramIndex + 1} OR
        content_uz ILIKE $${paramIndex + 2} OR
        content_ru ILIKE $${paramIndex + 3}
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
      conditions.push(`a.publish_date >= $${paramIndex}`);
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

    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const articlesQuery = `
      SELECT
        a.id, a.title_uz, a.title_ru, a.content_uz, a.content_ru,
        a.tags, a.cover_image, a.youtube_url, a.publish_date,
        a.created_at, a.updated_at,
        c.id as category_id, c.name_uz as category_name_uz, c.name_ru as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      ${whereClause}
      ORDER BY a.publish_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, skip);
    const articlesResult = await pool.query(articlesQuery, params);

    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';

    const formattedArticles = articlesResult.rows.map(article => ({
      id: article.id,
      title: lang === 'ru' ? article.title_ru : article.title_uz,
      content: lang === 'ru' ? article.content_ru : article.content_uz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: formatImageUrl(article.cover_image, req),
      youtubeUrl: article.youtube_url,
      publishDate: article.publish_date,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
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
    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';

    const articleQuery = `
      SELECT a.category_id, c.name_uz, c.name_ru, c.slug
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `;
    const articleResult = await pool.query(articleQuery, [id]);

    if (articleResult.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const categoryId = articleResult.rows[0].category_id;

    const relatedQuery = `
      SELECT
        a.id, a.title_uz, a.title_ru, a.content_uz, a.content_ru,
        a.tags, a.cover_image, a.youtube_url, a.publish_date,
        a.created_at, a.updated_at,
        c.id as category_id, c.name_uz as category_name_uz, c.name_ru as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      WHERE a.category_id = $1 AND a.id != $2
      ORDER BY a.publish_date DESC
      LIMIT 3
    `;
    const relatedResult = await pool.query(relatedQuery, [categoryId, id]);

    const formattedArticles = relatedResult.rows.map(related => ({
      id: related.id,
      title: lang === 'ru' ? related.title_ru : related.title_uz,
      content: lang === 'ru' ? related.content_ru : related.content_uz,
      category: {
        id: related.category_id,
        name: lang === 'ru' ? related.category_name_ru : related.category_name_uz,
        slug: related.category_slug,
      },
      tags: related.tags,
      coverImage: formatImageUrl(related.cover_image, req),
      youtubeUrl: related.youtube_url,
      publishDate: related.publish_date,
      createdAt: related.created_at,
      updatedAt: related.updated_at,
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
    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';

    const query = `
      SELECT
        a.id, a.title_uz, a.title_ru, a.content_uz, a.content_ru,
        a.tags, a.cover_image, a.youtube_url, a.publish_date,
        a.created_at, a.updated_at,
        c.id as category_id, c.name_uz as category_name_uz, c.name_ru as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const article = result.rows[0];
    const formattedArticle = {
      id: article.id,
      title: lang === 'ru' ? article.title_ru : article.title_uz,
      content: lang === 'ru' ? article.content_ru : article.content_uz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: formatImageUrl(article.cover_image, req),
      youtubeUrl: article.youtube_url,
      publishDate: article.publish_date,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
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
    if (req.body.tags && typeof req.body.tags === 'string') {
      try {
        req.body.tags = JSON.parse(req.body.tags);
      } catch (e) {
        req.body.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    const { error, value } = articleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (req.file) {
      value.coverImage = req.file.filename;
    }

    value.userId = req.user.id;

    const data = mapBodyToDb(value, ['titleUz', 'titleRu', 'contentUz', 'contentRu', 'categoryId', 'userId', 'tags', 'coverImage', 'youtubeUrl', 'publishDate']);
    
    const id = 'art-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    data.id = id;

    const insertQuery = `
      INSERT INTO articles (id, title_uz, title_ru, content_uz, content_ru, category_id, user_id, tags, cover_image, youtube_url, publish_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const params = [
      id, data.title_uz, data.title_ru, data.content_uz, data.content_ru,
      data.category_id, data.user_id, data.tags, data.cover_image,
      data.youtube_url, data.publish_date || new Date()
    ];
    const insertResult = await pool.query(insertQuery, params);

    const article = insertResult.rows[0];

    const categoryQuery = 'SELECT id, name_uz, name_ru, slug FROM categories WHERE id = $1';
    const categoryResult = await pool.query(categoryQuery, [data.category_id]);
    const category = keysToCamel(categoryResult.rows[0]);

    const formattedArticle = {
      id: article.id,
      titleUz: article.title_uz,
      titleRu: article.title_ru,
      contentUz: article.content_uz,
      contentRu: article.content_ru,
      category: category,
      tags: article.tags,
      coverImage: formatImageUrl(article.cover_image, req),
      youtubeUrl: article.youtube_url,
      publishDate: article.publish_date,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    };

    res.status(201).json(formattedArticle);
  } catch (error) {
    console.error('Create article error:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

// Update article
const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.tags && typeof req.body.tags === 'string') {
      try {
        req.body.tags = JSON.parse(req.body.tags);
      } catch (e) {
        req.body.tags = req.body.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    const { error, value } = articleSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (req.file) {
      value.coverImage = req.file.filename;
    }

    const data = mapBodyToDb(value, ['titleUz', 'titleRu', 'contentUz', 'contentRu', 'categoryId', 'tags', 'coverImage', 'youtubeUrl', 'publishDate']);

    const updateQuery = `
      UPDATE articles 
      SET title_uz = $1, title_ru = $2, content_uz = $3, content_ru = $4,
          category_id = $5, tags = $6, cover_image = $7, youtube_url = $8, publish_date = $9
      WHERE id = $10
      RETURNING *
    `;
    const params = [
      data.title_uz, data.title_ru, data.content_uz, data.content_ru,
      data.category_id, data.tags, data.cover_image, data.youtube_url,
      data.publish_date, id
    ];
    const updateResult = await pool.query(updateQuery, params);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = updateResult.rows[0];

    const categoryQuery = 'SELECT id, name_uz, name_ru, slug FROM categories WHERE id = $1';
    const categoryResult = await pool.query(categoryQuery, [data.category_id]);
    const category = keysToCamel(categoryResult.rows[0]);

    const formattedArticle = {
      id: article.id,
      titleUz: article.title_uz,
      titleRu: article.title_ru,
      contentUz: article.content_uz,
      contentRu: article.content_ru,
      category: category,
      tags: article.tags,
      coverImage: formatImageUrl(article.cover_image, req),
      youtubeUrl: article.youtube_url,
      publishDate: article.publish_date,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
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

// Get article for editing
const getArticleForEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT
        a.id, a.title_uz, a.title_ru, a.content_uz, a.content_ru,
        a.category_id, a.tags, a.cover_image, a.youtube_url, a.publish_date,
        a.created_at, a.updated_at
      FROM articles a
      WHERE a.id = $1 AND a.user_id = $2
    `;
    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });

    const article = keysToCamel(result.rows[0]);
    article.coverImage = formatImageUrl(article.coverImage, req);
    res.json(article);
  } catch (error) {
    console.error('Get article for edit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get articles by user
const getUserArticles = async (req, res) => {
  try {
    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';
    const userId = req.user.id;

    const query = `
      SELECT
        a.id, a.title_uz, a.title_ru, a.content_uz, a.content_ru,
        a.tags, a.cover_image, a.youtube_url, a.publish_date,
        a.created_at, a.updated_at,
        c.id as category_id, c.name_uz as category_name_uz, c.name_ru as category_name_ru, c.slug as category_slug
      FROM articles a
      JOIN categories c ON a.category_id = c.id
      WHERE a.user_id = $1
      ORDER BY a.publish_date DESC
    `;
    const result = await pool.query(query, [userId]);

    const formattedArticles = result.rows.map(article => ({
      id: article.id,
      title: lang === 'ru' ? article.title_ru : article.title_uz,
      content: lang === 'ru' ? article.content_ru : article.content_uz,
      category: {
        id: article.category_id,
        name: lang === 'ru' ? article.category_name_ru : article.category_name_uz,
        slug: article.category_slug,
      },
      tags: article.tags,
      coverImage: formatImageUrl(article.cover_image, req),
      youtubeUrl: article.youtube_url,
      publishDate: article.publish_date,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
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
