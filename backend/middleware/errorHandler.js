const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => next(new ApiError(404, 'Route not found'));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'This record already exists', details: [] });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ success: false, message: 'This record is linked to other data', details: [] });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: 'Something went wrong', details: [] });
}

module.exports = { notFound, errorHandler };
