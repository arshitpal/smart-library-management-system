-- =====================================================================
-- SAMPLE DATA FOR LOCAL DEVELOPMENT AND DEMONSTRATION ONLY.
-- People, emails, phone numbers and ISBNs are invented placeholders.
-- All logins use *.test addresses (a reserved, undeliverable domain).
--
-- Dates are relative to CURDATE(), so "due soon" and "overdue" loans stay
-- realistic whenever this file is loaded. Reload it to refresh the demo.
-- Load once, on an empty schema. A second load fails on duplicate keys.
--
-- prediction_history is intentionally empty: no model exists until Phase 5,
-- and invented predictions would corrupt the predicted-vs-actual report.
-- =====================================================================

USE smart_library;

START TRANSACTION;

-- Passwords: Admin@123 / Librarian@123 / Student@123 (bcrypt, cost 10)
INSERT INTO users (id, full_name, email, password_hash, phone, role) VALUES
  (1, 'Sample Admin',      'admin@library.test',      '$2b$10$Q7bU8ERullQCkN2izvpPAeItrUJ/nkQ96ID1kMt.BggDYKXR7sGR2', '9000000001', 'ADMIN'),
  (2, 'Priya Nair',        'librarian1@library.test', '$2b$10$wAVpX/MCey8w0jdN4tYjyevbzD.ZEo1vUxPfGE9/i4sViO5ENly4e', '9000000002', 'LIBRARIAN'),
  (3, 'Vikram Joshi',      'librarian2@library.test', '$2b$10$wAVpX/MCey8w0jdN4tYjyevbzD.ZEo1vUxPfGE9/i4sViO5ENly4e', '9000000003', 'LIBRARIAN'),
  (4, 'Aarav Sharma',      'student1@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000004', 'STUDENT'),
  (5, 'Diya Patel',        'student2@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000005', 'STUDENT'),
  (6, 'Rohan Verma',       'student3@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000006', 'STUDENT'),
  (7, 'Meera Iyer',        'student4@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000007', 'STUDENT'),
  (8, 'Kabir Khan',        'student5@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000008', 'STUDENT'),
  (9, 'Sneha Reddy',       'student6@library.test',   '$2b$10$iyTcUeDeY4kWaZVpqXkKOeQzDTxrucZe5I/ao8VYalMZiTbGrBEM6', '9000000009', 'STUDENT');

INSERT INTO librarians (id, user_id, employee_code, designation, joined_on) VALUES
  (1, 2, 'LIB-001', 'Senior Librarian',    CURDATE() - INTERVAL 1500 DAY),
  (2, 3, 'LIB-002', 'Assistant Librarian', CURDATE() - INTERVAL 600 DAY);

-- Borrowing profiles: Aarav punctual, Diya mostly punctual, Rohan habitually
-- late, Meera mixed, Kabir one long delay, Sneha new with no history.
INSERT INTO students (id, user_id, enrollment_no, department, course, semester, address) VALUES
  (1, 4, 'MCA2024001', 'Computer Applications', 'MCA',  3, 'Sample Address 1, Pune'),
  (2, 5, 'MCA2024002', 'Computer Applications', 'MCA',  3, 'Sample Address 2, Pune'),
  (3, 6, 'BCA2023011', 'Computer Applications', 'BCA',  5, 'Sample Address 3, Pune'),
  (4, 7, 'MBA2024005', 'Management',            'MBA',  2, 'Sample Address 4, Pune'),
  (5, 8, 'BTE2022034', 'Electronics',           'B.Tech', 7, 'Sample Address 5, Pune'),
  (6, 9, 'MCA2025009', 'Computer Applications', 'MCA',  1, 'Sample Address 6, Pune');

INSERT INTO categories (id, name, description) VALUES
  (1, 'Computer Science', 'Programming, algorithms, databases and AI'),
  (2, 'Mathematics',      'Engineering and discrete mathematics'),
  (3, 'Management',       'Business and management studies'),
  (4, 'Literature',       'Fiction and classics'),
  (5, 'Reference',        'High-demand reference works with a shorter loan period'),
  (6, 'Electronics',      'Electronic devices and digital design');

INSERT INTO authors (id, name) VALUES
  (1, 'Thomas H. Cormen'), (2, 'Charles E. Leiserson'), (3, 'Ronald L. Rivest'),
  (4, 'Clifford Stein'), (5, 'Robert C. Martin'), (6, 'Abraham Silberschatz'),
  (7, 'Henry F. Korth'), (8, 'S. Sudarshan'), (9, 'Andrew S. Tanenbaum'),
  (10, 'Stuart Russell'), (11, 'Peter Norvig'), (12, 'Christopher M. Bishop'),
  (13, 'B. S. Grewal'), (14, 'Kenneth H. Rosen'), (15, 'Philip Kotler'),
  (16, 'Daniel Kahneman'), (17, 'Jane Austen'), (18, 'Arundhati Roy'),
  (19, 'A. S. Hornby'), (20, 'Anthony Ralston'), (21, 'Robert L. Boylestad'),
  (22, 'M. Morris Mano');

-- ISBNs below are placeholders, not the real ISBNs of these titles.
-- available_copies = total_copies minus the open loans further down.
INSERT INTO books (id, isbn, title, publisher, publication_year, category_id, total_copies, available_copies, shelf_location) VALUES
  (1,  '9780000000010', 'Introduction to Algorithms',                  'MIT Press',          2022, 1, 4, 3, 'CS-A1'),
  (2,  '9780000000027', 'Clean Code',                                  'Prentice Hall',      2008, 1, 3, 2, 'CS-A2'),
  (3,  '9780000000034', 'Database System Concepts',                    'McGraw Hill',        2019, 1, 5, 4, 'CS-A3'),
  (4,  '9780000000041', 'Computer Networks',                           'Pearson',            2021, 1, 3, 3, 'CS-A4'),
  (5,  '9780000000058', 'Artificial Intelligence: A Modern Approach',  'Pearson',            2020, 1, 2, 2, 'CS-B1'),
  (6,  '9780000000065', 'Pattern Recognition and Machine Learning',    'Springer',           2006, 1, 2, 1, 'CS-B2'),
  (7,  '9780000000072', 'Higher Engineering Mathematics',              'Khanna Publishers',  2020, 2, 4, 4, 'MA-A1'),
  (8,  '9780000000089', 'Discrete Mathematics and Its Applications',   'McGraw Hill',        2018, 2, 3, 3, 'MA-A2'),
  (9,  '9780000000096', 'Principles of Marketing',                     'Pearson',            2020, 3, 3, 3, 'MG-A1'),
  (10, '9780000000102', 'Thinking, Fast and Slow',                     'Penguin',            2012, 3, 2, 2, 'MG-A2'),
  (11, '9780000000119', 'Pride and Prejudice',                         'Penguin Classics',   2003, 4, 2, 2, 'LT-A1'),
  (12, '9780000000126', 'The God of Small Things',                     'Penguin India',      2017, 4, 2, 1, 'LT-A2'),
  (13, '9780000000133', 'Oxford Advanced Learner''s Dictionary',       'Oxford',             2020, 5, 2, 2, 'RF-A1'),
  (14, '9780000000140', 'Encyclopedia of Computer Science',            'Wiley',              2003, 5, 1, 0, 'RF-A2'),
  (15, '9780000000157', 'Electronic Devices and Circuit Theory',       'Pearson',            2015, 6, 3, 3, 'EL-A1'),
  (16, '9780000000164', 'Digital Design',                              'Pearson',            2018, 6, 2, 1, 'EL-A2');

INSERT INTO book_authors (book_id, author_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (2, 5), (3, 6), (3, 7), (3, 8), (4, 9),
  (5, 10), (5, 11), (6, 12), (7, 13), (8, 14), (9, 15), (10, 16), (11, 17),
  (12, 18), (13, 19), (14, 20), (15, 21), (16, 22);

-- Rule 1 default: 14-day loan, 1 grace day, Rs 5/day, cap Rs 500.
-- Rule 2 Reference: 7-day loan, no grace, Rs 10/day, cap Rs 1000.
INSERT INTO fine_rules (id, name, category_id, loan_days, grace_days, daily_rate, max_fine, effective_from, created_by) VALUES
  (1, 'Standard loan',  NULL, 14, 1, 5.00,  500.00,  CURDATE() - INTERVAL 200 DAY, 1),
  (2, 'Reference loan', 5,    7,  0, 10.00, 1000.00, CURDATE() - INTERVAL 200 DAY, 1);

-- Loans 1-11 are closed; 12-18 are open.
INSERT INTO book_issues (id, book_id, student_id, fine_rule_id, issued_by, issue_date, due_date, status) VALUES
  (1,  2,  1, 1, 2, CURDATE() - INTERVAL 120 DAY, CURDATE() - INTERVAL 106 DAY, 'RETURNED'),
  (2,  3,  1, 1, 2, CURDATE() - INTERVAL 100 DAY, CURDATE() - INTERVAL 86 DAY,  'RETURNED'),
  (3,  7,  1, 1, 3, CURDATE() - INTERVAL 70 DAY,  CURDATE() - INTERVAL 56 DAY,  'RETURNED'),
  (4,  1,  2, 1, 2, CURDATE() - INTERVAL 110 DAY, CURDATE() - INTERVAL 96 DAY,  'RETURNED'),
  (5,  9,  2, 1, 3, CURDATE() - INTERVAL 85 DAY,  CURDATE() - INTERVAL 71 DAY,  'RETURNED'),
  (6,  4,  3, 1, 2, CURDATE() - INTERVAL 125 DAY, CURDATE() - INTERVAL 111 DAY, 'RETURNED'),
  (7,  5,  3, 1, 2, CURDATE() - INTERVAL 95 DAY,  CURDATE() - INTERVAL 81 DAY,  'RETURNED'),
  (8,  13, 3, 2, 3, CURDATE() - INTERVAL 60 DAY,  CURDATE() - INTERVAL 53 DAY,  'RETURNED'),
  (9,  15, 4, 1, 2, CURDATE() - INTERVAL 80 DAY,  CURDATE() - INTERVAL 66 DAY,  'RETURNED'),
  (10, 11, 4, 1, 3, CURDATE() - INTERVAL 50 DAY,  CURDATE() - INTERVAL 36 DAY,  'RETURNED'),
  (11, 8,  5, 1, 2, CURDATE() - INTERVAL 45 DAY,  CURDATE() - INTERVAL 31 DAY,  'RETURNED'),
  (12, 3,  2, 1, 2, CURDATE() - INTERVAL 5 DAY,   CURDATE() + INTERVAL 9 DAY,   'ISSUED'),
  (13, 1,  3, 1, 2, CURDATE() - INTERVAL 20 DAY,  CURDATE() - INTERVAL 6 DAY,   'ISSUED'),
  (14, 6,  3, 1, 3, CURDATE() - INTERVAL 16 DAY,  CURDATE() - INTERVAL 2 DAY,   'ISSUED'),
  (15, 16, 5, 1, 3, CURDATE() - INTERVAL 12 DAY,  CURDATE() + INTERVAL 2 DAY,   'ISSUED'),
  (16, 14, 1, 2, 2, CURDATE() - INTERVAL 5 DAY,   CURDATE() + INTERVAL 2 DAY,   'ISSUED'),
  (17, 2,  4, 1, 2, CURDATE() - INTERVAL 3 DAY,   CURDATE() + INTERVAL 11 DAY,  'ISSUED'),
  (18, 12, 1, 1, 3, CURDATE() - INTERVAL 2 DAY,   CURDATE() + INTERVAL 12 DAY,  'ISSUED');

INSERT INTO book_returns (id, issue_id, return_date, received_by, remarks) VALUES
  (1,  1,  CURDATE() - INTERVAL 110 DAY, 2, NULL),
  (2,  2,  CURDATE() - INTERVAL 88 DAY,  2, NULL),
  (3,  3,  CURDATE() - INTERVAL 56 DAY,  3, 'Returned on the due date'),
  (4,  4,  CURDATE() - INTERVAL 95 DAY,  2, 'One day late, inside the grace period'),
  (5,  5,  CURDATE() - INTERVAL 66 DAY,  3, NULL),
  (6,  6,  CURDATE() - INTERVAL 99 DAY,  2, NULL),
  (7,  7,  CURDATE() - INTERVAL 71 DAY,  2, NULL),
  (8,  8,  CURDATE() - INTERVAL 47 DAY,  3, NULL),
  (9,  9,  CURDATE() - INTERVAL 58 DAY,  2, NULL),
  (10, 10, CURDATE() - INTERVAL 38 DAY,  3, NULL),
  (11, 11, CURDATE() - INTERVAL 5 DAY,   2, NULL);

-- Each amount follows: (late_days - grace_days) x daily_rate, capped at max_fine.
INSERT INTO fines (id, return_id, late_days, chargeable_days, daily_rate, amount, waived_amount, waived_by, waiver_reason, status) VALUES
  (1, 5,  5,  4,  5.00,  20.00,  0.00,  NULL, NULL, 'PAID'),
  (2, 6,  12, 11, 5.00,  55.00,  0.00,  NULL, NULL, 'PAID'),
  (3, 7,  10, 9,  5.00,  45.00,  0.00,  NULL, NULL, 'PARTIALLY_PAID'),
  (4, 8,  6,  6,  10.00, 60.00,  0.00,  NULL, NULL, 'UNPAID'),
  (5, 9,  8,  7,  5.00,  35.00,  35.00, 1,    'Medical leave certificate submitted', 'WAIVED'),
  (6, 11, 26, 25, 5.00,  125.00, 0.00,  NULL, NULL, 'UNPAID');

INSERT INTO payments (id, fine_id, amount, method, transaction_ref, received_by, paid_at) VALUES
  (1, 1, 20.00, 'CASH', NULL,               3, NOW() - INTERVAL 65 DAY),
  (2, 2, 55.00, 'UPI',  'SAMPLE-UPI-00001', 2, NOW() - INTERVAL 98 DAY),
  (3, 3, 20.00, 'CASH', NULL,               2, NOW() - INTERVAL 70 DAY);

INSERT INTO notifications (user_id, type, title, message, issue_id, dedupe_key) VALUES
  (6, 'OVERDUE',      'Book overdue',  'Introduction to Algorithms was due 6 days ago. Please return it to avoid a higher fine.', 13, 'OVERDUE:issue:13'),
  (6, 'OVERDUE',      'Book overdue',  'Pattern Recognition and Machine Learning was due 2 days ago.', 14, 'OVERDUE:issue:14'),
  (8, 'DUE_REMINDER', 'Due in 2 days', 'Digital Design is due in 2 days.', 15, 'DUE_3D:issue:15'),
  (4, 'DUE_REMINDER', 'Due in 2 days', 'Encyclopedia of Computer Science is due in 2 days.', 16, 'DUE_3D:issue:16'),
  (8, 'FINE',         'Fine added',    'A fine of Rs 125.00 was added for Discrete Mathematics and Its Applications.', 11, NULL);

COMMIT;
