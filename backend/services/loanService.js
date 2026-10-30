// Issue and return. Each runs in a single transaction: all steps succeed or none do.
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, Book, BookIssue, BookReturn, Fine, FineRule, Notification, Student, User,
} = require('../models');
const { calculateFine } = require('./fineService');
const ApiError = require('../utils/ApiError');
const { addDays, today } = require('../utils/dates');

async function ruleForCategory(categoryId, transaction) {
  const rules = await FineRule.findAll({
    where: { is_active: true, category_id: { [Op.or]: [categoryId, null] } },
    transaction,
  });
  const rule = rules.find((r) => r.category_id === categoryId) || rules.find((r) => r.category_id === null);
  if (!rule) throw new ApiError(409, 'No active fine rule is configured');
  return rule;
}

function issueBook({ bookId, studentId, issuedBy }) {
  return sequelize.transaction(async (transaction) => {
    // Locking the student serialises concurrent issues, so the limit cannot be bypassed.
    const student = await Student.findByPk(studentId, {
      include: [{ model: User, as: 'user' }],
      transaction,
      lock: { level: transaction.LOCK.UPDATE, of: Student },
    });
    if (!student) throw new ApiError(404, 'Student not found');
    if (!student.user.is_active) throw new ApiError(409, 'This student account is inactive');

    const openLoans = await BookIssue.count({ where: { student_id: studentId, status: 'ISSUED' }, transaction });
    if (openLoans >= student.max_books) {
      throw new ApiError(409, `Borrowing limit of ${student.max_books} books reached`);
    }

    const book = await Book.findByPk(bookId, { transaction });
    if (!book || !book.is_active) throw new ApiError(404, 'Book not found');

    const held = await BookIssue.count({ where: { student_id: studentId, book_id: bookId, status: 'ISSUED' }, transaction });
    if (held) throw new ApiError(409, 'This student already holds this book');

    const rule = await ruleForCategory(book.category_id, transaction);

    // The WHERE clause makes this safe when two staff issue the last copy together.
    const [, updated] = await sequelize.query(
      'UPDATE books SET available_copies = available_copies - 1 WHERE id = ? AND available_copies > 0',
      { replacements: [bookId], type: QueryTypes.UPDATE, transaction },
    );
    if (!updated) throw new ApiError(409, 'No copy of this book is available');

    const issueDate = today();
    const issue = await BookIssue.create({
      book_id: bookId,
      student_id: studentId,
      fine_rule_id: rule.id,
      issued_by: issuedBy,
      issue_date: issueDate,
      due_date: addDays(issueDate, rule.loan_days),
    }, { transaction });

    await Notification.create({
      user_id: student.user_id,
      type: 'ISSUE',
      title: 'Book issued',
      message: `${book.title} was issued to you. Due date: ${issue.due_date}.`,
      issue_id: issue.id,
    }, { transaction });
    return issue;
  });
}

function returnBook({ issueId, remarks, receivedBy }) {
  return sequelize.transaction(async (transaction) => {
    const issue = await BookIssue.findByPk(issueId, {
      include: [
        { model: FineRule, as: 'rule' },
        { model: Book, as: 'book' },
        { model: Student, as: 'student' },
      ],
      transaction,
      lock: { level: transaction.LOCK.UPDATE, of: BookIssue },
    });
    if (!issue) throw new ApiError(404, 'Loan not found');
    if (issue.status === 'RETURNED') throw new ApiError(409, 'This book has already been returned');

    const returnDate = today();
    const record = await BookReturn.create(
      { issue_id: issueId, return_date: returnDate, received_by: receivedBy, remarks: remarks || null },
      { transaction },
    );
    await issue.update({ status: 'RETURNED' }, { transaction });
    await Book.increment('available_copies', { where: { id: issue.book_id }, transaction });

    const result = calculateFine({ dueDate: issue.due_date, returnDate, rule: issue.rule });
    let fine = null;
    if (result.amount > 0) {
      fine = await Fine.create({
        return_id: record.id,
        late_days: result.lateDays,
        chargeable_days: result.chargeableDays,
        daily_rate: issue.rule.daily_rate,
        amount: result.amount,
      }, { transaction });
    }

    await Notification.create({
      user_id: issue.student.user_id,
      type: fine ? 'FINE' : 'RETURN',
      title: fine ? 'Fine added' : 'Book returned',
      message: fine
        ? `${issue.book.title} was returned ${result.lateDays} day(s) late. Fine: Rs ${result.amount.toFixed(2)}.`
        : `${issue.book.title} was returned. No fine is due.`,
      issue_id: issueId,
    }, { transaction });

    return { returnId: record.id, returnDate, lateDays: result.lateDays, fineId: fine ? fine.id : null, fineAmount: result.amount };
  });
}

module.exports = { issueBook, returnBook };
