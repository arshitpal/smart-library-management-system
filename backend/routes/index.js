const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const auth = require('../controllers/authController');
const people = require('../controllers/peopleController');
const catalog = require('../controllers/catalogController');
const loans = require('../controllers/loanController');
const fines = require('../controllers/fineController');
const notifications = require('../controllers/notificationController');
const predictions = require('../controllers/predictionController');
const dashboard = require('../controllers/dashboardController');
const reports = require('../controllers/reportController');

const router = express.Router();
const staff = authorize('ADMIN', 'LIBRARIAN');
const adminOnly = authorize('ADMIN');
const studentOnly = authorize('STUDENT');

const idParam = [param('id').isInt({ min: 1 }).withMessage('Invalid ID'), validate];
const statusRule = [...idParam, body('isActive').isBoolean().withMessage('isActive must be true or false').toBoolean(), validate];
const nameRule = [body('name').trim().notEmpty().withMessage('Name is required'), validate];

const strongPassword = (field) => body(field).isStrongPassword({ minLength: 8, minSymbols: 0 })
  .withMessage('Password needs 8+ characters with upper case, lower case and a number');

// A required rule when creating; the same rule is optional when updating.
const field = (name, creating) => (creating ? body(name) : body(name).optional());

const personRules = (creating) => [
  field('fullName', creating).trim().notEmpty().withMessage('Name is required'),
  field('email', creating).trim().isEmail().withMessage('Enter a valid email'),
  body('phone').optional({ values: 'falsy' }).matches(/^[0-9+\- ]{7,15}$/).withMessage('Enter a valid phone number'),
  ...(creating ? [strongPassword('password')] : []),
];

const studentRules = (creating) => [
  ...personRules(creating),
  field('enrollmentNo', creating).trim().notEmpty().withMessage('Enrollment number is required'),
  field('department', creating).trim().notEmpty().withMessage('Department is required'),
  field('course', creating).trim().notEmpty().withMessage('Course is required'),
  field('semester', creating).isInt({ min: 1, max: 12 }).withMessage('Semester must be 1 to 12'),
  body('maxBooks').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be 1 to 20'),
  validate,
];

const librarianRules = (creating) => [
  ...personRules(creating),
  field('employeeCode', creating).trim().notEmpty().withMessage('Employee code is required'),
  field('joinedOn', creating).isISO8601().withMessage('Joining date is required'),
  validate,
];

const bookRules = [
  body('isbn').trim().isLength({ min: 10, max: 20 }).withMessage('ISBN must be 10 to 20 characters'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Choose a category').toInt(),
  body('totalCopies').isInt({ min: 0, max: 10000 }).withMessage('Enter the number of copies').toInt(),
  body('authorIds').isArray({ min: 1 }).withMessage('Choose at least one author'),
  body('authorIds.*').isInt({ min: 1 }).toInt(),
  body('publicationYear').optional({ values: 'falsy' }).isInt({ min: 1000, max: 2100 }).withMessage('Enter a valid year'),
  validate,
];

// Public
router.post('/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    message: { success: false, message: 'Too many attempts, try again later', details: [] },
  }),
  body('email').trim().isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate, auth.login);

// Everything below needs a valid token
router.use(authenticate);

router.get('/auth/me', auth.me);
router.put('/auth/profile', body('fullName').optional().trim().notEmpty().withMessage('Name cannot be empty'), validate, auth.updateProfile);
router.put('/auth/password', body('currentPassword').notEmpty().withMessage('Current password is required'), strongPassword('newPassword'), validate, auth.changePassword);

// People
router.get('/students', staff, people.students.list);
router.get('/students/:id', staff, idParam, people.students.get);
router.post('/students', adminOnly, studentRules(true), people.students.create);
router.put('/students/:id', adminOnly, idParam, studentRules(false), people.students.update);
router.patch('/students/:id/status', adminOnly, statusRule, people.students.setStatus);

router.get('/librarians', adminOnly, people.librarians.list);
router.get('/librarians/:id', adminOnly, idParam, people.librarians.get);
router.post('/librarians', adminOnly, librarianRules(true), people.librarians.create);
router.put('/librarians/:id', adminOnly, idParam, librarianRules(false), people.librarians.update);
router.patch('/librarians/:id/status', adminOnly, statusRule, people.librarians.setStatus);

// Catalogue
router.get('/books', catalog.listBooks);
router.get('/books/:id', idParam, catalog.getBook);
router.post('/books', staff, bookRules, catalog.createBook);
router.put('/books/:id', staff, idParam, bookRules, catalog.updateBook);
router.patch('/books/:id/status', staff, statusRule, catalog.setBookStatus);

for (const [path, crud] of [['categories', catalog.categories], ['authors', catalog.authors]]) {
  router.get(`/${path}`, crud.list);
  router.post(`/${path}`, adminOnly, nameRule, crud.create);
  router.put(`/${path}/:id`, adminOnly, idParam, nameRule, crud.update);
  router.delete(`/${path}/:id`, adminOnly, idParam, crud.remove);
}

// Loans
router.get('/issues/mine', studentOnly, loans.myIssues);
router.get('/issues/overdue', staff, loans.listOverdue);
router.get('/issues', staff, loans.listIssues);
router.post('/issues', staff,
  body('bookId').isInt({ min: 1 }).withMessage('Choose a book').toInt(),
  body('studentId').isInt({ min: 1 }).withMessage('Choose a student').toInt(),
  validate, loans.createIssue);
router.post('/returns', staff,
  body('issueId').isInt({ min: 1 }).withMessage('Choose a loan').toInt(),
  body('remarks').optional({ values: 'null' }).isLength({ max: 255 }).withMessage('Remarks are too long'),
  validate, loans.createReturn);

// Fine rules, fines, payments
router.get('/fine-rules', staff, fines.listRules);
router.post('/fine-rules', adminOnly,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('categoryId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  body('loanDays').isInt({ min: 1, max: 365 }).withMessage('Loan days must be 1 to 365').toInt(),
  body('graceDays').isInt({ min: 0, max: 60 }).withMessage('Grace days must be 0 to 60').toInt(),
  body('dailyRate').isFloat({ min: 0 }).withMessage('Enter a valid daily rate').toFloat(),
  body('maxFine').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Enter a valid maximum').toFloat(),
  validate, fines.createRule);
router.delete('/fine-rules/:id', adminOnly, idParam, fines.deactivateRule);

router.get('/fines/mine', studentOnly, fines.myFines);
router.get('/fines', staff, fines.listFines);
router.post('/fines/:id/waive', staff, idParam,
  body('reason').trim().notEmpty().withMessage('A reason is required'),
  body('amount').optional({ values: 'null' }).isFloat({ gt: 0 }).withMessage('Enter a valid amount').toFloat(),
  validate, fines.waive);

router.get('/payments', staff, fines.listPayments);
router.post('/payments', staff,
  body('fineId').isInt({ min: 1 }).withMessage('Choose a fine').toInt(),
  body('amount').isFloat({ gt: 0 }).withMessage('Enter a valid amount').toFloat(),
  body('method').isIn(['CASH', 'UPI', 'CARD', 'NET_BANKING']).withMessage('Choose a payment method'),
  validate, fines.createPayment);

// Notifications
router.get('/notifications', notifications.list);
router.patch('/notifications/read-all', notifications.markAllRead);
router.patch('/notifications/:id/read', idParam, notifications.markRead);

// Predictions
router.get('/predictions/history', adminOnly, predictions.history);
router.get('/predictions/comparison', adminOnly, predictions.comparison);
router.get('/predictions/metrics', adminOnly, predictions.metrics);
router.get('/predictions/issue/:issueId', param('issueId').isInt({ min: 1 }).withMessage('Invalid ID'), validate, predictions.forIssue);

// Dashboards and reports
router.get('/dashboard/admin', adminOnly, dashboard.admin);
router.get('/dashboard/librarian', authorize('LIBRARIAN'), dashboard.librarian);
router.get('/dashboard/student', studentOnly, dashboard.student);
router.get('/reports/:type', staff, reports.getReport);

module.exports = router;
