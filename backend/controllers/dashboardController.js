const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const many = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const one = async (sql, replacements = []) => (await many(sql, replacements))[0];

const loanCounts = () => one(
  `SELECT COALESCE(SUM(status = 'ISSUED'), 0) AS open_loans,
          COALESCE(SUM(loan_state = 'OVERDUE'), 0) AS overdue,
          COALESCE(SUM(loan_state = 'DUE_SOON'), 0) AS due_soon
   FROM v_loan_status`,
);

const monthlyLoans = () => many(
  `SELECT DATE_FORMAT(issue_date, '%Y-%m') AS month, COUNT(*) AS issued
   FROM book_issues WHERE issue_date >= CURDATE() - INTERVAL 6 MONTH
   GROUP BY month ORDER BY month`,
);

const popularCategories = () => many(
  `SELECT c.name, COUNT(*) AS loans FROM book_issues bi
   JOIN books b ON b.id = bi.book_id JOIN categories c ON c.id = b.category_id
   GROUP BY c.id, c.name ORDER BY loans DESC`,
);

async function admin(req, res) {
  const [counts, loans, money, fineStatus, months, categories, topBooks, monthlyRevenue] = await Promise.all([
    one(`SELECT (SELECT COUNT(*) FROM students s JOIN users u ON u.id = s.user_id WHERE u.is_active) AS students,
                (SELECT COUNT(*) FROM librarians l JOIN users u ON u.id = l.user_id WHERE u.is_active) AS librarians,
                (SELECT COUNT(*) FROM books WHERE is_active) AS titles,
                (SELECT COALESCE(SUM(total_copies), 0) FROM books WHERE is_active) AS copies`),
    loanCounts(),
    one(`SELECT COALESCE(SUM(amount), 0) AS fined, COALESCE(SUM(paid_amount), 0) AS collected,
                COALESCE(SUM(balance), 0) AS pending, COALESCE(SUM(waived_amount), 0) AS waived FROM v_fine_ledger`),
    many('SELECT status, COUNT(*) AS count FROM fines GROUP BY status'),
    monthlyLoans(),
    popularCategories(),
    many(`SELECT b.title, COUNT(*) AS loans FROM book_issues bi JOIN books b ON b.id = bi.book_id
          GROUP BY b.id, b.title ORDER BY loans DESC, b.title LIMIT 5`),
    many(`SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount) AS amount FROM payments
          WHERE paid_at >= CURDATE() - INTERVAL 6 MONTH GROUP BY month ORDER BY month`),
  ]);
  res.json({ success: true, data: { counts, loans, money, fineStatus, months, categories, topBooks, monthlyRevenue } });
}

async function librarian(req, res) {
  const [loans, activity, overdue, months, pending] = await Promise.all([
    loanCounts(),
    one(`SELECT (SELECT COUNT(*) FROM book_issues WHERE issue_date = CURDATE()) AS issued_today,
                (SELECT COUNT(*) FROM book_returns WHERE return_date = CURDATE()) AS returned_today`),
    many(`SELECT issue_id, student_name, book_title, due_date, days_late
          FROM v_loan_status WHERE loan_state = 'OVERDUE' ORDER BY due_date LIMIT 8`),
    monthlyLoans(),
    one('SELECT COALESCE(SUM(balance), 0) AS pending FROM v_fine_ledger'),
  ]);
  res.json({ success: true, data: { loans, activity, overdue, months, pendingFines: pending.pending } });
}

async function student(req, res) {
  const studentId = req.user.student.id;
  const [loans, fines, categories, totals] = await Promise.all([
    many(`SELECT issue_id, book_title, due_date, loan_state, days_until_due
          FROM v_loan_status WHERE student_id = ? AND status = 'ISSUED' ORDER BY due_date`, [studentId]),
    one('SELECT COALESCE(SUM(balance), 0) AS pending FROM v_fine_ledger WHERE student_id = ?', [studentId]),
    many(`SELECT category_name AS name, COUNT(*) AS loans FROM v_loan_status
          WHERE student_id = ? GROUP BY category_name ORDER BY loans DESC`, [studentId]),
    one(`SELECT COUNT(*) AS total, COALESCE(SUM(return_date > due_date), 0) AS late
         FROM v_loan_status WHERE student_id = ? AND status = 'RETURNED'`, [studentId]),
  ]);
  res.json({
    success: true,
    data: { loans, pendingFines: fines.pending, totals, categories, maxBooks: req.user.student.max_books },
  });
}

module.exports = { admin, librarian, student };
