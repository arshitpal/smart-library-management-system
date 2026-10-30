// Students and librarians: each is a users row plus a role-specific row.
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, Student, Librarian } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, paged } = require('../utils/pagination');

const USER_FIELDS = ['id', 'full_name', 'email', 'phone', 'is_active', 'last_login_at'];

const makeList = (Model, codeColumn, extraWhere) => async (req, res) => {
  const pagination = getPagination(req.query);
  const { search, status } = req.query;
  const userWhere = {};
  if (status === 'active') userWhere.is_active = true;
  if (status === 'inactive') userWhere.is_active = false;

  const where = extraWhere ? extraWhere(req.query) : {};
  if (search) {
    const like = { [Op.like]: `%${search}%` };
    where[Op.or] = [
      { [codeColumn]: like },
      { '$user.full_name$': like },
      { '$user.email$': like },
    ];
  }
  const { rows, count } = await Model.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: USER_FIELDS, where: userWhere }],
    order: [['id', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
    subQuery: false,
  });
  res.json({ success: true, data: paged(rows, count, pagination) });
};

const makeGet = (Model, label) => async (req, res) => {
  const record = await Model.findByPk(req.params.id, {
    include: [{ model: User, as: 'user', attributes: USER_FIELDS }],
  });
  if (!record) throw new ApiError(404, `${label} not found`);
  res.json({ success: true, data: record });
};

const makeCreate = (Model, role, details) => async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const record = await sequelize.transaction(async (transaction) => {
    const user = await User.create(
      { full_name: fullName, email, password_hash: passwordHash, phone: phone || null, role },
      { transaction },
    );
    return Model.create({ user_id: user.id, ...details(req.body) }, { transaction });
  });
  res.status(201).json({ success: true, data: { id: record.id } });
};

const makeUpdate = (Model, label, details) => async (req, res) => {
  const record = await Model.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
  if (!record) throw new ApiError(404, `${label} not found`);
  const { fullName, email, phone } = req.body;
  await sequelize.transaction(async (transaction) => {
    await record.user.update({
      full_name: fullName ?? record.user.full_name,
      email: email ?? record.user.email,
      phone: phone ?? record.user.phone,
    }, { transaction });
    await record.update(details(req.body), { transaction });
  });
  res.json({ success: true, message: `${label} updated` });
};

const makeStatus = (Model, label) => async (req, res) => {
  const record = await Model.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
  if (!record) throw new ApiError(404, `${label} not found`);
  await record.user.update({ is_active: req.body.isActive });
  res.json({ success: true, message: `${label} ${req.body.isActive ? 'activated' : 'deactivated'}` });
};

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));

const studentDetails = (b) => defined({
  enrollment_no: b.enrollmentNo,
  department: b.department,
  course: b.course,
  semester: b.semester,
  address: b.address,
  max_books: b.maxBooks,
});

const librarianDetails = (b) => defined({
  employee_code: b.employeeCode,
  designation: b.designation,
  joined_on: b.joinedOn,
});

module.exports = {
  students: {
    list: makeList(Student, 'enrollment_no', (q) => (q.department ? { department: q.department } : {})),
    get: makeGet(Student, 'Student'),
    create: makeCreate(Student, 'STUDENT', studentDetails),
    update: makeUpdate(Student, 'Student', studentDetails),
    setStatus: makeStatus(Student, 'Student'),
  },
  librarians: {
    list: makeList(Librarian, 'employee_code'),
    get: makeGet(Librarian, 'Librarian'),
    create: makeCreate(Librarian, 'LIBRARIAN', librarianDetails),
    update: makeUpdate(Librarian, 'Librarian', librarianDetails),
    setStatus: makeStatus(Librarian, 'Librarian'),
  },
};
