const { Op, QueryTypes } = require('sequelize');
const { sequelize, Category, FineRule } = require('../models');
const { recordPayment, waiveFine } = require('../services/fineService');
const ApiError = require('../utils/ApiError');
const { today } = require('../utils/dates');
const { getPagination, paged } = require('../utils/pagination');

async function queryLedger({ studentId, status, search }, pagination) {
  const conditions = [];
  const params = [];
  if (studentId) { conditions.push('student_id = ?'); params.push(studentId); }
  if (status === 'PENDING') conditions.push('balance > 0');
  else if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) {
    const like = `%${search}%`;
    conditions.push('(student_name LIKE ? OR enrollment_no LIKE ? OR book_title LIKE ?)');
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [{ total }] = await sequelize.query(`SELECT COUNT(*) AS total FROM v_fine_ledger ${where}`, {
    replacements: params, type: QueryTypes.SELECT,
  });
  const rows = await sequelize.query(
    `SELECT * FROM v_fine_ledger ${where} ORDER BY fine_id DESC LIMIT ? OFFSET ?`,
    { replacements: [...params, pagination.limit, pagination.offset], type: QueryTypes.SELECT },
  );
  return paged(rows, Number(total), pagination);
}

async function listFines(req, res) {
  res.json({ success: true, data: await queryLedger(req.query, getPagination(req.query)) });
}

async function myFines(req, res) {
  const filters = { studentId: req.user.student.id, status: req.query.status };
  res.json({ success: true, data: await queryLedger(filters, getPagination(req.query)) });
}

async function waive(req, res) {
  const data = await waiveFine({
    fineId: Number(req.params.id),
    amount: req.body.amount ?? undefined,
    reason: req.body.reason,
    waivedBy: req.user.id,
  });
  res.json({ success: true, data });
}

async function createPayment(req, res) {
  const data = await recordPayment({ ...req.body, receivedBy: req.user.id });
  res.status(201).json({ success: true, data: { id: data.payment.id, status: data.status } });
}

async function listPayments(req, res) {
  const pagination = getPagination(req.query);
  const like = `%${req.query.search || ''}%`;
  const condition = 'WHERE l.student_name LIKE ? OR l.enrollment_no LIKE ?';
  const [{ total }] = await sequelize.query(
    `SELECT COUNT(*) AS total FROM payments p JOIN v_fine_ledger l ON l.fine_id = p.fine_id ${condition}`,
    { replacements: [like, like], type: QueryTypes.SELECT },
  );
  const rows = await sequelize.query(
    `SELECT p.id, p.fine_id, p.amount, p.method, p.transaction_ref, p.paid_at,
            l.student_name, l.enrollment_no, l.book_title, u.full_name AS received_by_name
     FROM payments p
     JOIN v_fine_ledger l ON l.fine_id = p.fine_id
     JOIN users u ON u.id = p.received_by
     ${condition} ORDER BY p.paid_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    { replacements: [like, like, pagination.limit, pagination.offset], type: QueryTypes.SELECT },
  );
  res.json({ success: true, data: paged(rows, Number(total), pagination) });
}

async function listRules(req, res) {
  const where = req.query.includeInactive === 'true' ? {} : { is_active: true };
  const data = await FineRule.findAll({
    where,
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    order: [['is_active', 'DESC'], ['id', 'DESC']],
  });
  res.json({ success: true, data });
}

// Rules are versioned: the old one is retired so past loans keep their own terms.
async function createRule(req, res) {
  const b = req.body;
  const categoryId = b.categoryId || null;
  const rule = await sequelize.transaction(async (transaction) => {
    const scope = categoryId === null ? { [Op.is]: null } : categoryId;
    await FineRule.update({ is_active: false }, { where: { category_id: scope, is_active: true }, transaction });
    return FineRule.create({
      name: b.name,
      category_id: categoryId,
      loan_days: b.loanDays,
      grace_days: b.graceDays,
      daily_rate: b.dailyRate,
      max_fine: b.maxFine ?? null,
      effective_from: today(),
      created_by: req.user.id,
    }, { transaction });
  });
  res.status(201).json({ success: true, data: rule });
}

async function deactivateRule(req, res) {
  const rule = await FineRule.findByPk(req.params.id);
  if (!rule) throw new ApiError(404, 'Fine rule not found');
  if (rule.category_id === null) throw new ApiError(409, 'The default rule can be replaced but not removed');
  await rule.update({ is_active: false });
  res.json({ success: true, message: 'Rule deactivated; the default rule now applies to this category' });
}

module.exports = { listFines, myFines, waive, createPayment, listPayments, listRules, createRule, deactivateRule };
