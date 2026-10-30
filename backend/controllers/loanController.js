const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { issueBook, returnBook } = require('../services/loanService');
const { accruedFine } = require('../services/fineService');
const { getPagination, paged } = require('../utils/pagination');

const LOAN_SELECT = `SELECT v.*, r.grace_days, r.daily_rate, r.max_fine
  FROM v_loan_status v JOIN fine_rules r ON r.id = v.fine_rule_id`;

// Adds the live accrued fine for open loans, then hides the rule columns.
function presentLoan({ grace_days, daily_rate, max_fine, ...loan }) {
  const open = loan.status === 'ISSUED';
  return { ...loan, accrued_fine: open ? accruedFine(loan.due_date, { grace_days, daily_rate, max_fine }) : 0 };
}

async function queryLoans(filters, pagination) {
  const conditions = [];
  const params = [];
  if (filters.studentId) { conditions.push('v.student_id = ?'); params.push(filters.studentId); }
  if (filters.state === 'OPEN') conditions.push("v.status = 'ISSUED'");
  else if (filters.state) { conditions.push('v.loan_state = ?'); params.push(filters.state); }
  if (filters.search) {
    const like = `%${filters.search}%`;
    conditions.push('(v.student_name LIKE ? OR v.enrollment_no LIKE ? OR v.book_title LIKE ?)');
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [{ total }] = await sequelize.query(`SELECT COUNT(*) AS total FROM v_loan_status v ${where}`, {
    replacements: params, type: QueryTypes.SELECT,
  });
  const rows = await sequelize.query(
    `${LOAN_SELECT} ${where} ORDER BY v.issue_date DESC, v.issue_id DESC LIMIT ? OFFSET ?`,
    { replacements: [...params, pagination.limit, pagination.offset], type: QueryTypes.SELECT },
  );
  return paged(rows.map(presentLoan), Number(total), pagination);
}

async function listIssues(req, res) {
  const { studentId, state, search } = req.query;
  const data = await queryLoans({ studentId, state, search }, getPagination(req.query));
  res.json({ success: true, data });
}

async function listOverdue(req, res) {
  const data = await queryLoans({ state: 'OVERDUE', search: req.query.search }, getPagination(req.query));
  res.json({ success: true, data });
}

async function myIssues(req, res) {
  const data = await queryLoans(
    { studentId: req.user.student.id, state: req.query.state },
    getPagination(req.query),
  );
  res.json({ success: true, data });
}

async function createIssue(req, res) {
  const issue = await issueBook({ ...req.body, issuedBy: req.user.id });
  res.status(201).json({ success: true, data: { id: issue.id, dueDate: issue.due_date } });
}

async function createReturn(req, res) {
  const data = await returnBook({ ...req.body, receivedBy: req.user.id });
  res.status(201).json({ success: true, data });
}

module.exports = { listIssues, listOverdue, myIssues, createIssue, createReturn };
