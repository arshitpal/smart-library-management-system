const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const { User, Student, Librarian } = require('../models');
const ApiError = require('../utils/ApiError');

const publicUser = (user) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  student: user.student || null,
  librarian: user.librarian || null,
});

const profileIncludes = [{ model: Student, as: 'student' }, { model: Librarian, as: 'librarian' }];

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email }, include: profileIncludes });
  // Same message either way, so the API does not reveal which emails exist.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Incorrect email or password');
  }
  if (!user.is_active) throw new ApiError(403, 'This account has been deactivated');

  await user.update({ last_login_at: new Date() });
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  res.json({ success: true, data: { token, user: publicUser(user) } });
}

async function me(req, res) {
  const user = await User.findByPk(req.user.id, { include: profileIncludes });
  res.json({ success: true, data: publicUser(user) });
}

async function updateProfile(req, res) {
  const { fullName, phone, address } = req.body;
  await req.user.update({ full_name: fullName ?? req.user.full_name, phone: phone ?? req.user.phone });
  if (req.user.student && address !== undefined) await req.user.student.update({ address });
  return me(req, res);
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!(await bcrypt.compare(currentPassword, req.user.password_hash))) {
    throw new ApiError(422, 'Current password is incorrect');
  }
  await req.user.update({ password_hash: await bcrypt.hash(newPassword, 10) });
  res.json({ success: true, message: 'Password changed' });
}

module.exports = { login, me, updateProfile, changePassword };
