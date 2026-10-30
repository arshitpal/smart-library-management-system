const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { loadOpenIssue, predictForIssue, getModelMetrics } = require('../services/predictionService');
const ApiError = require('../utils/ApiError');
const { getPagination, paged } = require('../utils/pagination');

async function forIssue(req, res) {
  const issue = await loadOpenIssue(req.params.issueId);
  // Stops a student reading another student's loan by changing the ID in the URL.
  if (req.user.role === 'STUDENT' && issue.student_id !== req.user.student.id) {
    throw new ApiError(403, 'You do not have access to this loan');
  }
  res.json({ success: true, data: await predictForIssue({ issue, requestedBy: req.user.id }) });
}

async function history(req, res) {
  const pagination = getPagination(req.query);
  const [{ total }] = await sequelize.query('SELECT COUNT(*) AS total FROM prediction_history', { type: QueryTypes.SELECT });
  const rows = await sequelize.query(
    `SELECT ph.*, v.student_name, v.book_title, v.loan_state
     FROM prediction_history ph JOIN v_loan_status v ON v.issue_id = ph.issue_id
     ORDER BY ph.id DESC LIMIT ? OFFSET ?`,
    { replacements: [pagination.limit, pagination.offset], type: QueryTypes.SELECT },
  );
  res.json({ success: true, data: paged(rows, Number(total), pagination) });
}

async function comparison(req, res) {
  const rows = await sequelize.query(
    `SELECT c.*, v.student_name, v.book_title
     FROM v_prediction_vs_actual c JOIN v_loan_status v ON v.issue_id = c.issue_id
     ORDER BY c.return_date DESC LIMIT 200`,
    { type: QueryTypes.SELECT },
  );
  const count = rows.length;
  const mae = count ? rows.reduce((sum, r) => sum + Number(r.absolute_error), 0) / count : null;
  res.json({ success: true, data: { rows, summary: { count, mae } } });
}

async function metrics(req, res) {
  res.json({ success: true, data: await getModelMetrics() });
}

module.exports = { forIssue, history, comparison, metrics };
