// Sequelize models mapped onto the tables in database/schema.sql.
// Generated columns (active_scope, open_loan) are left out because MySQL fills them.
const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/database');

const id = { type: T.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true };
const createdAt = () => ({ type: T.DATE, defaultValue: T.NOW });

const User = sequelize.define('users', {
  id,
  full_name: { type: T.STRING(120), allowNull: false },
  email: { type: T.STRING(190), allowNull: false },
  password_hash: { type: T.CHAR(60), allowNull: false },
  phone: T.STRING(15),
  role: { type: T.ENUM('ADMIN', 'LIBRARIAN', 'STUDENT'), allowNull: false },
  is_active: { type: T.BOOLEAN, defaultValue: true },
  last_login_at: T.DATE,
  created_at: createdAt(),
});

const Student = sequelize.define('students', {
  id,
  user_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  enrollment_no: { type: T.STRING(30), allowNull: false },
  department: { type: T.STRING(80), allowNull: false },
  course: { type: T.STRING(80), allowNull: false },
  semester: { type: T.TINYINT.UNSIGNED, allowNull: false },
  address: T.STRING(255),
  max_books: { type: T.TINYINT.UNSIGNED, defaultValue: 3 },
});

const Librarian = sequelize.define('librarians', {
  id,
  user_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  employee_code: { type: T.STRING(30), allowNull: false },
  designation: { type: T.STRING(80), defaultValue: 'Librarian' },
  joined_on: { type: T.DATEONLY, allowNull: false },
});

const Category = sequelize.define('categories', {
  id,
  name: { type: T.STRING(80), allowNull: false },
  description: T.STRING(255),
});

const Author = sequelize.define('authors', {
  id,
  name: { type: T.STRING(120), allowNull: false },
  biography: T.STRING(500),
});

const Book = sequelize.define('books', {
  id,
  isbn: { type: T.STRING(20), allowNull: false },
  title: { type: T.STRING(200), allowNull: false },
  publisher: T.STRING(120),
  publication_year: T.SMALLINT.UNSIGNED,
  category_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  total_copies: { type: T.SMALLINT.UNSIGNED, defaultValue: 1 },
  available_copies: { type: T.SMALLINT.UNSIGNED, defaultValue: 1 },
  shelf_location: T.STRING(30),
  is_active: { type: T.BOOLEAN, defaultValue: true },
});

const BookAuthor = sequelize.define('book_authors', {
  book_id: { type: T.INTEGER.UNSIGNED, primaryKey: true },
  author_id: { type: T.INTEGER.UNSIGNED, primaryKey: true },
});

const FineRule = sequelize.define('fine_rules', {
  id,
  name: { type: T.STRING(80), allowNull: false },
  category_id: T.INTEGER.UNSIGNED,
  loan_days: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  grace_days: { type: T.SMALLINT.UNSIGNED, defaultValue: 0 },
  daily_rate: { type: T.DECIMAL(8, 2), allowNull: false },
  max_fine: T.DECIMAL(10, 2),
  is_active: { type: T.BOOLEAN, defaultValue: true },
  effective_from: { type: T.DATEONLY, allowNull: false },
  created_by: { type: T.INTEGER.UNSIGNED, allowNull: false },
});

const BookIssue = sequelize.define('book_issues', {
  id,
  book_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  student_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  fine_rule_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  issued_by: { type: T.INTEGER.UNSIGNED, allowNull: false },
  issue_date: { type: T.DATEONLY, allowNull: false },
  due_date: { type: T.DATEONLY, allowNull: false },
  status: { type: T.ENUM('ISSUED', 'RETURNED'), defaultValue: 'ISSUED' },
});

const BookReturn = sequelize.define('book_returns', {
  id,
  issue_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  return_date: { type: T.DATEONLY, allowNull: false },
  received_by: { type: T.INTEGER.UNSIGNED, allowNull: false },
  remarks: T.STRING(255),
});

const Fine = sequelize.define('fines', {
  id,
  return_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  late_days: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  chargeable_days: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  daily_rate: { type: T.DECIMAL(8, 2), allowNull: false },
  amount: { type: T.DECIMAL(10, 2), allowNull: false },
  waived_amount: { type: T.DECIMAL(10, 2), defaultValue: 0 },
  waived_by: T.INTEGER.UNSIGNED,
  waiver_reason: T.STRING(255),
  status: { type: T.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED'), defaultValue: 'UNPAID' },
});

const Payment = sequelize.define('payments', {
  id,
  fine_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  amount: { type: T.DECIMAL(10, 2), allowNull: false },
  method: { type: T.ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING'), allowNull: false },
  transaction_ref: T.STRING(80),
  received_by: { type: T.INTEGER.UNSIGNED, allowNull: false },
  paid_at: createdAt(),
});

const Notification = sequelize.define('notifications', {
  id,
  user_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  type: { type: T.ENUM('DUE_REMINDER', 'OVERDUE', 'ISSUE', 'RETURN', 'FINE', 'PAYMENT', 'SYSTEM'), allowNull: false },
  title: { type: T.STRING(120), allowNull: false },
  message: { type: T.STRING(500), allowNull: false },
  issue_id: T.INTEGER.UNSIGNED,
  dedupe_key: T.STRING(100),
  is_read: { type: T.BOOLEAN, defaultValue: false },
  read_at: T.DATE,
  created_at: createdAt(),
});

const PredictionHistory = sequelize.define('prediction_history', {
  id,
  issue_id: { type: T.INTEGER.UNSIGNED, allowNull: false },
  requested_by: { type: T.INTEGER.UNSIGNED, allowNull: false },
  model_version: { type: T.STRING(40), allowNull: false },
  data_source: { type: T.ENUM('SYNTHETIC', 'REAL'), allowNull: false },
  predicted_on: { type: T.DATEONLY, allowNull: false },
  days_remaining: { type: T.INTEGER, allowNull: false },
  issue_duration_days: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  prior_late_count: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  avg_late_days: { type: T.DECIMAL(6, 2), allowNull: false },
  prior_overdue_ratio: { type: T.DECIMAL(5, 4), allowNull: false },
  category_name: { type: T.STRING(80), allowNull: false },
  borrowing_frequency: { type: T.SMALLINT.UNSIGNED, allowNull: false },
  predicted_fine: { type: T.DECIMAL(10, 2), allowNull: false },
});

User.hasOne(Student, { foreignKey: 'user_id', as: 'student' });
Student.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(Librarian, { foreignKey: 'user_id', as: 'librarian' });
Librarian.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Category.hasMany(Book, { foreignKey: 'category_id', as: 'books' });
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Book.belongsToMany(Author, { through: BookAuthor, foreignKey: 'book_id', otherKey: 'author_id', as: 'authors' });
Author.belongsToMany(Book, { through: BookAuthor, foreignKey: 'author_id', otherKey: 'book_id', as: 'books' });
FineRule.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
BookIssue.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
BookIssue.belongsTo(Student, { foreignKey: 'student_id', as: 'student' });
BookIssue.belongsTo(FineRule, { foreignKey: 'fine_rule_id', as: 'rule' });

module.exports = {
  sequelize, User, Student, Librarian, Category, Author, Book, BookAuthor, FineRule,
  BookIssue, BookReturn, Fine, Payment, Notification, PredictionHistory,
};
