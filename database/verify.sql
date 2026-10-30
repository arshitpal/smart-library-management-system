-- Integrity checks for schema.sql + seed.sql. Read-only.
-- Every row must show problems = 0.
-- setup.bat runs this file after loading the database.

USE smart_library;

SELECT 'available_copies = total_copies - open loans' AS check_name, COUNT(*) AS problems
FROM books b
LEFT JOIN (SELECT book_id, COUNT(*) AS n FROM book_issues WHERE status = 'ISSUED' GROUP BY book_id) o
  ON o.book_id = b.id
WHERE b.available_copies <> b.total_copies - COALESCE(o.n, 0)

UNION ALL
SELECT 'due_date = issue_date + rule loan_days', COUNT(*)
FROM book_issues bi JOIN fine_rules r ON r.id = bi.fine_rule_id
WHERE bi.due_date <> bi.issue_date + INTERVAL r.loan_days DAY

UNION ALL
SELECT 'loan uses the rule for its book category', COUNT(*)
FROM book_issues bi
JOIN books b ON b.id = bi.book_id
JOIN fine_rules r ON r.id = bi.fine_rule_id
WHERE r.category_id IS NOT NULL AND r.category_id <> b.category_id
   OR r.category_id IS NULL
      AND EXISTS (SELECT 1 FROM fine_rules x WHERE x.category_id = b.category_id AND x.is_active)

UNION ALL
SELECT 'RETURNED status <=> a return row exists', COUNT(*)
FROM book_issues bi LEFT JOIN book_returns br ON br.issue_id = bi.id
WHERE (bi.status = 'RETURNED') <> (br.id IS NOT NULL)

UNION ALL
SELECT 'return_date on or after issue_date', COUNT(*)
FROM book_returns br JOIN book_issues bi ON bi.id = br.issue_id
WHERE br.return_date < bi.issue_date

UNION ALL
SELECT 'every chargeable return has a correct fine', COUNT(*)
FROM (
  SELECT br.id AS return_id,
         LEAST(GREATEST(DATEDIFF(br.return_date, bi.due_date) - CAST(r.grace_days AS SIGNED), 0) * r.daily_rate,
               COALESCE(r.max_fine, 99999999.99)) AS expected
  FROM book_returns br
  JOIN book_issues bi ON bi.id = br.issue_id
  JOIN fine_rules r ON r.id = bi.fine_rule_id
) e
LEFT JOIN fines f ON f.return_id = e.return_id
WHERE COALESCE(f.amount, 0) <> e.expected

UNION ALL
SELECT 'fine status agrees with its balance', COUNT(*)
FROM v_fine_ledger
WHERE balance < 0
   OR (status = 'PAID' AND (balance <> 0 OR paid_amount = 0))
   OR (status = 'WAIVED' AND (balance <> 0 OR waived_amount = 0))
   OR (status = 'UNPAID' AND paid_amount <> 0)
   OR (status = 'PARTIALLY_PAID' AND (balance = 0 OR paid_amount = 0))

UNION ALL
SELECT 'open loans within the student borrowing limit', COUNT(*)
FROM (
  SELECT s.id FROM students s JOIN book_issues bi ON bi.student_id = s.id AND bi.status = 'ISSUED'
  GROUP BY s.id, s.max_books HAVING COUNT(*) > s.max_books
) x

UNION ALL
SELECT 'users match their role table', COUNT(*)
FROM users u
LEFT JOIN students s ON s.user_id = u.id
LEFT JOIN librarians l ON l.user_id = u.id
WHERE (u.role = 'STUDENT') <> (s.id IS NOT NULL)
   OR (u.role = 'LIBRARIAN') <> (l.id IS NOT NULL);
