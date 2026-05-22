/**
 * URL Helper Functions
 * 
 * Provides consistent URL handling for images across environments.
 * No hardcoded domains - uses relative URLs that work with reverse proxies.
 */

/**
 * Format image URL for API response
 * Returns relative URL for production/local compatibility
 * 
 * @param {string|null} filename - Image filename or path from database
 * @returns {string|null} - Relative URL or null
 */
function formatImageUrl(filename) {
  if (!filename) return null;
  
  // If already starts with /uploads/, just return it
  if (filename.startsWith('/uploads/')) {
    return filename;
  }
  
  // If contains /uploads/, extract the filename part
  if (filename.includes('/uploads/')) {
    const parts = filename.split('/uploads/');
    return '/uploads/' + parts[parts.length - 1];
  }
  
  // Otherwise, just prepend /uploads/
  return `/uploads/${filename}`;
}

/**
 * Get full image URL based on environment
 * Use this for frontend when full URLs are needed
 * 
 * @param {string} filename - Image filename
 * @param {object} options - Configuration options
 * @returns {string} - Full or relative URL
 */
function getImageUrl(filename, options = {}) {
  if (!filename) return null;
  
  const { 
    baseUrl = '',
    folder = 'uploads'
  } = options;
  
  const path = formatImageUrl(filename);
  
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }
  
  return path;
}

/**
 * Parse image URL to extract filename
 * @param {string} url - Full or relative URL
 * @returns {string|null} - Filename or null
 */
function parseImageFilename(url) {
  if (!url) return null;
  
  const matches = url.match(/uploads\/([^/]+)$/i);
  return matches ? matches[1] : null;
}

module.exports = {
  formatImageUrl,
  getImageUrl,
  parseImageFilename
};
