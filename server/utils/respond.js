/**
 * Standardized JSON response helper.
 */
'use strict';

function respond(res, statusCode, data, error) {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    data: data || null,
    error: error || null,
  });
}

module.exports = respond;
