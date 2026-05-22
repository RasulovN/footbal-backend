/**
 * Utility functions for data transformation
 */

/**
 * Convert camelCase to snake_case
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from camelCase to snake_case
 * @param {object} obj - Object with camelCase keys
 * @returns {object} - Object with snake_case keys
 */
function keysToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = camelToSnake(key);
    result[snakeKey] = obj[key];
  }
  return result;
}

/**
 * Convert snake_case to camelCase
 * @param {string} str - snake_case string
 * @returns {string} - camelCase string
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Convert object keys from snake_case to camelCase
 * @param {object} obj - Object with snake_case keys
 * @returns {object} - Object with camelCase keys
 */
function keysToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = {};
  for (const key of Object.keys(obj)) {
    const camelKey = snakeToCamel(key);
    result[camelKey] = obj[key];
  }
  return result;
}

/**
 * Map request body (camelCase) to database format (snake_case)
 * @param {object} body - Request body with camelCase keys
 * @param {string[]} fields - List of fields to map
 * @returns {object} - Object with snake_case keys
 */
function mapBodyToDb(body, fields) {
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      const snakeField = camelToSnake(field);
      result[snakeField] = body[field];
    }
  }
  return result;
}

module.exports = {
  camelToSnake,
  keysToSnake,
  snakeToCamel,
  keysToCamel,
  mapBodyToDb
};
