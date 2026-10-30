const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const { User, Student } = require('../models');
const ApiError = require('../utils/ApiError');

// Verifies the token and reloads the user, so a deactivated account loses access at once.
async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Please log in');

  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.secret);
  } catch {
    throw new ApiError(401, 'Session expired, please log in again');
  }

  const user = await User.findByPk(payload.sub, { include: [{ model: Student, as: 'student' }] });
  if (!user || !user.is_active) throw new ApiError(401, 'Account is not active');

  req.user = user;
  next();
}

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new ApiError(403, 'You do not have access to this action');
  next();
};

module.exports = { authenticate, authorize };
