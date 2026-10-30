-- =====================================================================
-- Smart Library Management System with Fine Prediction Using ML
-- MySQL schema (MySQL 8.0.16+ required; tested on MySQL 8.4 LTS)
--
-- Safe to re-run: nothing here drops data. To rebuild from scratch run
--   DROP DATABASE smart_library;
-- and then load this file followed by seed.sql.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS smart_library
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_library;

-- Fixes the collation of text inside views, whichever client loads this file.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 1. users: login identity for all three roles.
--    Role-specific details live in students / librarians (no NULL-heavy
--    "one big table"). Admins need no extra table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(120) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  password_hash  CHAR(60)     NOT NULL,            -- bcrypt output is always 60 chars
  phone          VARCHAR(15)  NULL,
  role           ENUM('ADMIN','LIBRARIAN','STUDENT') NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE, -- soft delete: keeps loan history intact
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. students: 1:1 extension of users.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  enrollment_no  VARCHAR(30)  NOT NULL,
  department     VARCHAR(80)  NOT NULL,
  course         VARCHAR(80)  NOT NULL,
  semester       TINYINT UNSIGNED NOT NULL,
  address        VARCHAR(255) NULL,
  max_books      TINYINT UNSIGNED NOT NULL DEFAULT 3, -- borrowing limit
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user (user_id),
  UNIQUE KEY uq_students_enrollment (enrollment_no),
  KEY idx_students_department (department),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_students_semester CHECK (semester BETWEEN 1 AND 12),
  CONSTRAINT chk_students_max_books CHECK (max_books > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. librarians: 1:1 extension of users.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS librarians (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  employee_code  VARCHAR(30)  NOT NULL,
  designation    VARCHAR(80)  NOT NULL DEFAULT 'Librarian',
  joined_on      DATE         NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_librarians_user (user_id),
  UNIQUE KEY uq_librarians_employee (employee_code),
  CONSTRAINT fk_librarians_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(80)  NOT NULL,
  description  VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. authors: names are not unique (two authors can share a name).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS authors (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  biography   VARCHAR(500) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_authors_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. books
--    available_copies is a deliberate, controlled denormalisation: it could
--    be derived from open loans, but every search would then need a join and
--    an aggregate. It changes only inside the issue/return transactions.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  isbn              VARCHAR(20)  NOT NULL,
  title             VARCHAR(200) NOT NULL,
  publisher         VARCHAR(120) NULL,
  publication_year  SMALLINT UNSIGNED NULL,
  category_id       INT UNSIGNED NOT NULL,
  total_copies      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  available_copies  SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  shelf_location    VARCHAR(30)  NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_books_isbn (isbn),
  KEY idx_books_category (category_id),
  KEY idx_books_available (is_active, available_copies),
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_books_copies CHECK (available_copies <= total_copies)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. book_authors: junction table; a book can have several authors and an
--    author several books. (Addition to the brief, required for 1NF.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_authors (
  book_id    INT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (book_id, author_id),
  KEY idx_book_authors_author (author_id),
  CONSTRAINT fk_book_authors_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_book_authors_author FOREIGN KEY (author_id) REFERENCES authors (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. fine_rules: the library's configured rules. (Addition to the brief:
--    "actual fine must be calculated using configured fine rules".)
--    category_id NULL = library-wide default; otherwise a category override.
--    Rules are versioned, never edited in place: a change deactivates the old
--    row and inserts a new one, so past loans still point at their own terms.
--    active_scope makes "one active rule per scope" a database guarantee:
--    inactive rows are NULL, and a UNIQUE index allows many NULLs.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fine_rules (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(80)  NOT NULL,
  category_id     INT UNSIGNED NULL,
  loan_days       SMALLINT UNSIGNED NOT NULL,          -- drives automatic due-date calculation
  grace_days      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  daily_rate      DECIMAL(8,2) NOT NULL,               -- rupees per chargeable day
  max_fine        DECIMAL(10,2) NULL,                  -- NULL = no cap
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_from  DATE         NOT NULL,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active_scope    INT UNSIGNED GENERATED ALWAYS AS
                    (IF(is_active, COALESCE(category_id, 0), NULL)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fine_rules_active_scope (active_scope),
  KEY idx_fine_rules_category (category_id),
  CONSTRAINT fk_fine_rules_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_fine_rules_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT chk_fine_rules_loan_days CHECK (loan_days > 0),
  CONSTRAINT chk_fine_rules_daily_rate CHECK (daily_rate >= 0),
  CONSTRAINT chk_fine_rules_max_fine CHECK (max_fine IS NULL OR max_fine >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. book_issues: one row per loan.
--    "Overdue" is NOT stored. It depends on today's date, so it is derived
--    (see v_loan_status) and can never go stale.
--    fine_rule_id fixes the terms at issue time.
--    open_loan is 1 while the loan is open and NULL afterwards, so the UNIQUE
--    key stops one student holding two copies of a title at the same time
--    while still allowing them to borrow it again later.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_issues (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  book_id       INT UNSIGNED NOT NULL,
  student_id    INT UNSIGNED NOT NULL,
  fine_rule_id  INT UNSIGNED NOT NULL,
  issued_by     INT UNSIGNED NOT NULL,                 -- a user: admins may issue too
  issue_date    DATE         NOT NULL,
  due_date      DATE         NOT NULL,
  status        ENUM('ISSUED','RETURNED') NOT NULL DEFAULT 'ISSUED',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  open_loan     TINYINT GENERATED ALWAYS AS (IF(status = 'ISSUED', 1, NULL)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_book_issues_open_loan (student_id, book_id, open_loan),
  KEY idx_book_issues_book (book_id),
  KEY idx_book_issues_status_due (status, due_date),
  KEY idx_book_issues_student_status (student_id, status),
  KEY idx_book_issues_issue_date (issue_date),
  CONSTRAINT fk_book_issues_book FOREIGN KEY (book_id) REFERENCES books (id),
  CONSTRAINT fk_book_issues_student FOREIGN KEY (student_id) REFERENCES students (id),
  CONSTRAINT fk_book_issues_rule FOREIGN KEY (fine_rule_id) REFERENCES fine_rules (id),
  CONSTRAINT fk_book_issues_issued_by FOREIGN KEY (issued_by) REFERENCES users (id),
  CONSTRAINT chk_book_issues_dates CHECK (due_date >= issue_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. book_returns: at most one per loan.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_returns (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  issue_id     INT UNSIGNED NOT NULL,
  return_date  DATE         NOT NULL,
  received_by  INT UNSIGNED NOT NULL,
  remarks      VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_book_returns_issue (issue_id),
  KEY idx_book_returns_date (return_date),
  CONSTRAINT fk_book_returns_issue FOREIGN KEY (issue_id) REFERENCES book_issues (id),
  CONSTRAINT fk_book_returns_received_by FOREIGN KEY (received_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. fines: the ACTUAL fine, created at return only when amount > 0.
--     Linked to the return (not directly to the student) to avoid a
--     transitive dependency; a fine cannot exist without a return.
--     late_days, chargeable_days and daily_rate are an audit snapshot of the
--     calculation. Amount paid is not stored: it is the sum of payments.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fines (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  return_id        INT UNSIGNED NOT NULL,
  late_days        SMALLINT UNSIGNED NOT NULL,
  chargeable_days  SMALLINT UNSIGNED NOT NULL,
  daily_rate       DECIMAL(8,2)  NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  waived_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  waived_by        INT UNSIGNED  NULL,
  waiver_reason    VARCHAR(255)  NULL,
  status           ENUM('UNPAID','PARTIALLY_PAID','PAID','WAIVED') NOT NULL DEFAULT 'UNPAID',
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fines_return (return_id),
  KEY idx_fines_status (status),
  CONSTRAINT fk_fines_return FOREIGN KEY (return_id) REFERENCES book_returns (id),
  CONSTRAINT fk_fines_waived_by FOREIGN KEY (waived_by) REFERENCES users (id),
  CONSTRAINT chk_fines_amount CHECK (amount > 0),
  CONSTRAINT chk_fines_waived CHECK (waived_amount >= 0 AND waived_amount <= amount)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. payments: one fine can be settled in several instalments.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fine_id          INT UNSIGNED NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  method           ENUM('CASH','UPI','CARD','NET_BANKING') NOT NULL,
  transaction_ref  VARCHAR(80)  NULL,
  received_by      INT UNSIGNED NOT NULL,
  paid_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_transaction_ref (transaction_ref),
  KEY idx_payments_fine (fine_id),
  KEY idx_payments_paid_at (paid_at),
  CONSTRAINT fk_payments_fine FOREIGN KEY (fine_id) REFERENCES fines (id),
  CONSTRAINT fk_payments_received_by FOREIGN KEY (received_by) REFERENCES users (id),
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. notifications
--     dedupe_key stops the daily reminder job sending the same reminder twice
--     (for example 'DUE_3D:issue:42'). UNIQUE allows many NULLs.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  type        ENUM('DUE_REMINDER','OVERDUE','ISSUE','RETURN','FINE','PAYMENT','SYSTEM') NOT NULL,
  title       VARCHAR(120) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  issue_id    INT UNSIGNED NULL,
  dedupe_key  VARCHAR(100) NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at     DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_dedupe (dedupe_key),
  KEY idx_notifications_inbox (user_id, is_read, created_at),
  KEY idx_notifications_issue (issue_id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_issue FOREIGN KEY (issue_id) REFERENCES book_issues (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. prediction_history: every ML estimate, with the exact inputs used.
--     The feature columns are a point-in-time snapshot and must not be
--     normalised away: recomputing them later would use newer data.
--     data_source keeps estimates from a synthetic-data model identifiable.
--     What-if delay scenarios are recomputed on demand and are not stored.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prediction_history (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  issue_id              INT UNSIGNED NOT NULL,
  requested_by          INT UNSIGNED NOT NULL,
  model_version         VARCHAR(40)  NOT NULL,
  data_source           ENUM('SYNTHETIC','REAL') NOT NULL,
  predicted_on          DATE         NOT NULL,
  days_remaining        INT          NOT NULL,   -- negative once past the due date
  issue_duration_days   SMALLINT UNSIGNED NOT NULL,
  prior_late_count      SMALLINT UNSIGNED NOT NULL,
  avg_late_days         DECIMAL(6,2) NOT NULL,
  prior_overdue_ratio   DECIMAL(5,4) NOT NULL,
  category_name         VARCHAR(80)  NOT NULL,
  borrowing_frequency   SMALLINT UNSIGNED NOT NULL,
  predicted_fine        DECIMAL(10,2) NOT NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prediction_daily (issue_id, predicted_on, model_version),
  KEY idx_prediction_predicted_on (predicted_on),
  KEY idx_prediction_model (model_version),
  CONSTRAINT fk_prediction_issue FOREIGN KEY (issue_id) REFERENCES book_issues (id),
  CONSTRAINT fk_prediction_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
  CONSTRAINT chk_prediction_fine CHECK (predicted_fine >= 0),
  CONSTRAINT chk_prediction_ratio CHECK (prior_overdue_ratio BETWEEN 0 AND 1)
) ENGINE=InnoDB;

-- =====================================================================
-- Views: read-only values that are derived, never stored.
-- The fine FORMULA is deliberately absent from SQL. It lives in one place,
-- the backend fine service, so there is a single source of truth.
-- =====================================================================

-- Live state of every loan. loan_state is what the UI displays.
CREATE OR REPLACE VIEW v_loan_status AS
SELECT
  bi.id AS issue_id,
  bi.student_id,
  u.full_name AS student_name,
  s.enrollment_no,
  bi.book_id,
  b.title AS book_title,
  c.name AS category_name,
  bi.fine_rule_id,
  bi.issue_date,
  bi.due_date,
  br.return_date,
  bi.status,
  CASE
    WHEN bi.status = 'RETURNED' THEN 'RETURNED'
    WHEN bi.due_date < CURDATE() THEN 'OVERDUE'
    WHEN bi.due_date <= CURDATE() + INTERVAL 3 DAY THEN 'DUE_SOON'
    ELSE 'ACTIVE'
  END AS loan_state,
  DATEDIFF(bi.due_date, CURDATE()) AS days_until_due,
  GREATEST(DATEDIFF(COALESCE(br.return_date, CURDATE()), bi.due_date), 0) AS days_late
FROM book_issues bi
JOIN students s ON s.id = bi.student_id
JOIN users u ON u.id = s.user_id
JOIN books b ON b.id = bi.book_id
JOIN categories c ON c.id = b.category_id
LEFT JOIN book_returns br ON br.issue_id = bi.id;

-- Every fine with its paid total and outstanding balance.
CREATE OR REPLACE VIEW v_fine_ledger AS
SELECT
  f.id AS fine_id,
  bi.id AS issue_id,
  bi.student_id,
  u.full_name AS student_name,
  s.enrollment_no,
  b.title AS book_title,
  bi.due_date,
  br.return_date,
  f.late_days,
  f.chargeable_days,
  f.daily_rate,
  f.amount,
  f.waived_amount,
  COALESCE(p.paid_amount, 0.00) AS paid_amount,
  f.amount - f.waived_amount - COALESCE(p.paid_amount, 0.00) AS balance,
  f.status,
  f.created_at
FROM fines f
JOIN book_returns br ON br.id = f.return_id
JOIN book_issues bi ON bi.id = br.issue_id
JOIN students s ON s.id = bi.student_id
JOIN users u ON u.id = s.user_id
JOIN books b ON b.id = bi.book_id
LEFT JOIN (
  SELECT fine_id, SUM(amount) AS paid_amount FROM payments GROUP BY fine_id
) p ON p.fine_id = f.id;

-- Predicted vs actual for returned loans. Only the EARLIEST prediction of each
-- loan counts, so a loan viewed daily is not over-weighted and a prediction
-- made close to the return cannot flatter the accuracy figures.
-- A return with no fine row has an actual fine of 0.
CREATE OR REPLACE VIEW v_prediction_vs_actual AS
SELECT
  p.id AS prediction_id,
  p.issue_id,
  bi.student_id,
  p.model_version,
  p.data_source,
  p.predicted_on,
  br.return_date,
  p.predicted_fine,
  COALESCE(f.amount, 0.00) AS actual_fine,
  ABS(p.predicted_fine - COALESCE(f.amount, 0.00)) AS absolute_error
FROM (
  SELECT ph.*, ROW_NUMBER() OVER (PARTITION BY ph.issue_id ORDER BY ph.predicted_on, ph.id) AS rn
  FROM prediction_history ph
) p
JOIN book_issues bi ON bi.id = p.issue_id
JOIN book_returns br ON br.issue_id = bi.id
LEFT JOIN fines f ON f.return_id = br.id
WHERE p.rn = 1;
