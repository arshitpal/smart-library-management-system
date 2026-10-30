const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { sendExcel, sendPdf } = require('../utils/exporters');

// Report SQL comes only from this fixed list, and dates are bound parameters.
const REPORTS = {
  issues: {
    title: 'Book Issue Report',
    dated: 'issue_date',
    sql: `SELECT issue_id, student_name, enrollment_no, book_title, issue_date, due_date, return_date, loan_state
          FROM v_loan_status`,
    order: 'issue_date DESC',
    columns: [['issue_id', 'Loan'], ['student_name', 'Student'], ['enrollment_no', 'Enrollment'], ['book_title', 'Book'],
      ['issue_date', 'Issued'], ['due_date', 'Due'], ['return_date', 'Returned'], ['loan_state', 'State']],
  },
  overdue: {
    title: 'Overdue Books Report',
    dated: 'due_date',
    sql: `SELECT issue_id, student_name, enrollment_no, book_title, due_date, days_late
          FROM v_loan_status WHERE loan_state = 'OVERDUE'`,
    order: 'due_date',
    columns: [['issue_id', 'Loan'], ['student_name', 'Student'], ['enrollment_no', 'Enrollment'], ['book_title', 'Book'],
      ['due_date', 'Due'], ['days_late', 'Days late']],
  },
  fines: {
    title: 'Fine Report',
    dated: 'return_date',
    sql: `SELECT fine_id, student_name, enrollment_no, book_title, return_date, late_days, amount, waived_amount, paid_amount, balance, status
          FROM v_fine_ledger`,
    order: 'return_date DESC',
    columns: [['fine_id', 'Fine'], ['student_name', 'Student'], ['enrollment_no', 'Enrollment'], ['book_title', 'Book'],
      ['return_date', 'Returned'], ['late_days', 'Days late'], ['amount', 'Fine (Rs)'], ['waived_amount', 'Waived'],
      ['paid_amount', 'Paid'], ['balance', 'Balance'], ['status', 'Status']],
  },
  payments: {
    title: 'Payment Report',
    dated: 'paid_on',
    sql: `SELECT p.id, DATE(p.paid_at) AS paid_on, l.student_name, l.enrollment_no, l.book_title, p.amount, p.method, p.transaction_ref
          FROM payments p JOIN v_fine_ledger l ON l.fine_id = p.fine_id`,
    order: 'paid_on DESC',
    columns: [['id', 'Receipt'], ['paid_on', 'Date'], ['student_name', 'Student'], ['enrollment_no', 'Enrollment'],
      ['book_title', 'Book'], ['amount', 'Amount (Rs)'], ['method', 'Method'], ['transaction_ref', 'Reference']],
  },
  inventory: {
    title: 'Book Inventory Report',
    sql: `SELECT b.isbn, b.title, c.name AS category, b.total_copies, b.available_copies,
                 b.total_copies - b.available_copies AS on_loan, b.shelf_location
          FROM books b JOIN categories c ON c.id = b.category_id WHERE b.is_active`,
    order: 'title',
    columns: [['isbn', 'ISBN'], ['title', 'Title'], ['category', 'Category'], ['total_copies', 'Total'],
      ['available_copies', 'Available'], ['on_loan', 'On loan'], ['shelf_location', 'Shelf']],
  },
};

async function getReport(req, res) {
  const report = REPORTS[req.params.type];
  if (!report) throw new ApiError(404, 'Unknown report');
  const { from, to, format = 'json' } = req.query;

  const params = [];
  const conditions = [];
  if (report.dated && from) { conditions.push(`${report.dated} >= ?`); params.push(from); }
  if (report.dated && to) { conditions.push(`${report.dated} <= ?`); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await sequelize.query(
    `SELECT * FROM (${report.sql}) report ${where} ORDER BY ${report.order} LIMIT 5000`,
    { replacements: params, type: QueryTypes.SELECT },
  );

  const columns = report.columns.map(([key, label]) => ({ key, label }));
  const output = { title: report.title, columns, rows };
  if (format === 'pdf') return sendPdf(res, output);
  if (format === 'xlsx') return sendExcel(res, output);
  return res.json({ success: true, data: output });
}

module.exports = { getReport };
