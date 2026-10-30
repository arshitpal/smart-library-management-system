const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Placed after express-validator rules on a route.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  throw new ApiError(422, details[0].message, details);
}

module.exports = validate;
