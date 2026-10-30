// End-to-end API tests. They change data, so run them only on a freshly seeded
// TEST database: DB_NAME/DB_PORT in .env decide which one is used.
// Point at a closed port so the test proves the app survives the ML service being down.
process.env.ML_SERVICE_URL = 'http://127.0.0.1:9';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { QueryTypes } = require('sequelize');
const app = require('../app');
const { sequelize } = require('../models');
const { calculateFine } = require('../services/fineService');
const { sendReminders } = require('../services/reminderService');

let server;
let base;
const tokens = {};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, type, json: type.includes('json') ? await res.json() : null };
}

const scalar = async (sql, replacements = []) => {
  const [row] = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  return Object.values(row)[0];
};

before(async () => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const logins = { admin: 'admin', librarian: 'librarian1', student: 'student1', rohan: 'student3' };
  const passwords = { admin: 'Admin@123', librarian: 'Librarian@123', student: 'Student@123', rohan: 'Student@123' };
  for (const [key, name] of Object.entries(logins)) {
    const res = await api('POST', '/auth/login', { body: { email: `${name}@library.test`, password: passwords[key] } });
    assert.equal(res.status, 200, `login ${name}`);
    tokens[key] = res.json.data.token;
  }
});

after(async () => {
  server.close();
  await sequelize.close();
});

test('fine formula: grace, rate and cap', () => {
  const rule = { grace_days: 1, daily_rate: 5, max_fine: 500 };
  const fine = (returnDate) => calculateFine({ dueDate: '2026-01-10', returnDate, rule }).amount;
  assert.equal(fine('2026-01-05'), 0);
  assert.equal(fine('2026-01-10'), 0);
  assert.equal(fine('2026-01-11'), 0);
  assert.equal(fine('2026-01-12'), 5);
  assert.equal(fine('2026-01-15'), 20);
  assert.equal(fine('2027-01-10'), 500);
  assert.equal(calculateFine({ dueDate: '2026-01-10', returnDate: '2027-01-10', rule: { ...rule, max_fine: null } }).amount, 1820);
});

test('auth: bad login, no token, bad token', async () => {
  assert.equal((await api('POST', '/auth/login', { body: { email: 'admin@library.test', password: 'wrong' } })).status, 401);
  assert.equal((await api('POST', '/auth/login', { body: { email: 'nope', password: 'x' } })).status, 422);
  assert.equal((await api('GET', '/auth/me')).status, 401);
  assert.equal((await api('GET', '/auth/me', { token: 'garbage' })).status, 401);
  const me = await api('GET', '/auth/me', { token: tokens.student });
  assert.equal(me.json.data.role, 'STUDENT');
  assert.equal(me.json.data.password_hash, undefined);
});

test('roles: forbidden routes return 403', async () => {
  const cases = [
    ['student', 'GET', '/students'], ['student', 'GET', '/issues'], ['student', 'GET', '/fines'],
    ['student', 'GET', '/reports/fines'], ['student', 'GET', '/dashboard/admin'],
    ['librarian', 'GET', '/librarians'], ['librarian', 'GET', '/predictions/history'],
    ['librarian', 'POST', '/fine-rules'], ['admin', 'GET', '/fines/mine'],
  ];
  for (const [who, method, path] of cases) {
    assert.equal((await api(method, path, { token: tokens[who], body: method === 'POST' ? {} : undefined })).status, 403, path);
  }
});

test('SQL injection in search is treated as text', async () => {
  const res = await api('GET', `/books?search=${encodeURIComponent("' OR 1=1 -- ")}`, { token: tokens.admin });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.total, 0);
  const loans = await api('GET', `/issues?search=${encodeURIComponent("' OR '1'='1")}`, { token: tokens.admin });
  assert.equal(loans.json.data.total, 0);
});

test('books: search, filter and CRUD', async () => {
  const byTitle = await api('GET', '/books?search=clean', { token: tokens.student });
  assert.equal(byTitle.json.data.items[0].title, 'Clean Code');
  const byAuthor = await api('GET', '/books?search=Cormen', { token: tokens.student });
  assert.equal(byAuthor.json.data.total, 1);
  assert.equal(byAuthor.json.data.items[0].authors.length, 4);
  const none = await api('GET', '/books?availability=unavailable', { token: tokens.student });
  assert.equal(none.json.data.total, 1);

  const body = { isbn: '9780000009999', title: 'Test Book', categoryId: 1, totalCopies: 2, authorIds: [1, 2] };
  const created = await api('POST', '/books', { token: tokens.librarian, body });
  assert.equal(created.status, 201);
  assert.equal((await api('POST', '/books', { token: tokens.librarian, body })).status, 409);
  const { id } = created.json.data;
  assert.equal((await api('PUT', `/books/${id}`, { token: tokens.librarian, body: { ...body, totalCopies: 5, authorIds: [3] } })).status, 200);
  const book = await api('GET', `/books/${id}`, { token: tokens.student });
  assert.equal(book.json.data.available_copies, 5);
  assert.equal(book.json.data.authors.length, 1);
  assert.equal((await api('POST', '/books', { token: tokens.student, body })).status, 403);
  assert.equal((await api('PUT', '/books/14', { token: tokens.admin, body: { isbn: '9780000000140', title: 'x', categoryId: 5, totalCopies: 0, authorIds: [20] } })).status, 409);
  assert.equal((await api('PATCH', '/books/14/status', { token: tokens.admin, body: { isActive: false } })).status, 409);
});

test('categories in use cannot be deleted', async () => {
  assert.equal((await api('DELETE', '/categories/1', { token: tokens.admin })).status, 409);
  const made = await api('POST', '/categories', { token: tokens.admin, body: { name: 'Temp' } });
  assert.equal((await api('DELETE', `/categories/${made.json.data.id}`, { token: tokens.admin })).status, 200);
});

test('students: create, duplicate, weak password, deactivate', async () => {
  const body = {
    fullName: 'New Student', email: 'new@library.test', password: 'Strong123', enrollmentNo: 'NEW001',
    department: 'CS', course: 'MCA', semester: 1,
  };
  assert.equal((await api('POST', '/students', { token: tokens.admin, body: { ...body, password: 'weak' } })).status, 422);
  const made = await api('POST', '/students', { token: tokens.admin, body });
  assert.equal(made.status, 201);
  assert.equal((await api('POST', '/students', { token: tokens.admin, body })).status, 409);
  assert.equal(await scalar('SELECT COUNT(*) FROM users WHERE email = ?', ['new@library.test']), 1);

  const { id } = made.json.data;
  const login = await api('POST', '/auth/login', { body: { email: body.email, password: body.password } });
  assert.equal(login.status, 200);
  assert.equal((await api('PATCH', `/students/${id}/status`, { token: tokens.admin, body: { isActive: false } })).status, 200);
  // The old token stops working at once.
  assert.equal((await api('GET', '/auth/me', { token: login.json.data.token })).status, 401);
  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 4, studentId: id } })).status, 409);
});

test('issue: due date, copy count, notification and all refusal rules', async () => {
  const before = await scalar('SELECT available_copies FROM books WHERE id = 4');
  const ok = await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 4, studentId: 6 } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.data.dueDate, await scalar("SELECT DATE_FORMAT(CURDATE() + INTERVAL 14 DAY, '%Y-%m-%d')"));
  assert.equal(await scalar('SELECT available_copies FROM books WHERE id = 4'), before - 1);

  // Reference category uses its own 7-day rule.
  const reference = await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 13, studentId: 6 } });
  assert.equal(reference.json.data.dueDate, await scalar("SELECT DATE_FORMAT(CURDATE() + INTERVAL 7 DAY, '%Y-%m-%d')"));

  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 4, studentId: 6 } })).status, 409);
  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 14, studentId: 2 } })).status, 409);
  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 999, studentId: 2 } })).status, 404);
  // Student 1 has 2 open loans: the third is allowed and the fourth is refused.
  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 8, studentId: 1 } })).status, 201);
  assert.equal((await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 9, studentId: 1 } })).status, 409);
  assert.equal((await api('POST', '/issues', { token: tokens.student, body: { bookId: 8, studentId: 1 } })).status, 403);
});

test('concurrency: only one of many issues gets the last copy', async () => {
  const made = await api('POST', '/books', { token: tokens.admin, body: { isbn: '9780000008888', title: 'Last Copy', categoryId: 2, totalCopies: 1, authorIds: [1] } });
  const { id } = made.json.data;
  const results = await Promise.all([2, 4, 5].map((studentId) => api('POST', '/issues', { token: tokens.librarian, body: { bookId: id, studentId } })));
  const ok = results.filter((r) => r.status === 201);
  assert.equal(ok.length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.equal(await scalar('SELECT available_copies FROM books WHERE id = ?', [id]), 0);
});

test('return: on time has no fine; late creates the rule-based fine', async () => {
  const onTime = await api('POST', '/returns', { token: tokens.librarian, body: { issueId: 12 } });
  assert.equal(onTime.status, 201);
  assert.equal(onTime.json.data.fineId, null);
  assert.equal((await api('POST', '/returns', { token: tokens.librarian, body: { issueId: 12 } })).status, 409);

  const copies = await scalar('SELECT available_copies FROM books WHERE id = 1');
  const late = await api('POST', '/returns', { token: tokens.librarian, body: { issueId: 13 } });
  assert.equal(late.json.data.lateDays, 6);
  assert.equal(late.json.data.fineAmount, 25);
  assert.equal(await scalar('SELECT available_copies FROM books WHERE id = 1'), copies + 1);
  assert.equal(await scalar('SELECT status FROM book_issues WHERE id = 13'), 'RETURNED');
  assert.equal(await scalar("SELECT COUNT(*) FROM notifications WHERE issue_id = 13 AND type = 'FINE'"), 1);
});

test('payments: partial, overpay, settle; waiver', async () => {
  const pay = (fineId, amount) => api('POST', '/payments', { token: tokens.librarian, body: { fineId, amount, method: 'CASH' } });
  assert.equal((await pay(6, 1000)).status, 422);
  assert.equal((await pay(6, 25)).json.data.status, 'PARTIALLY_PAID');
  assert.equal((await pay(6, 100)).json.data.status, 'PAID');
  assert.equal((await pay(6, 1)).status, 409);

  const waive = (id, body) => api('POST', `/fines/${id}/waive`, { token: tokens.admin, body });
  assert.equal((await waive(4, {})).status, 422);
  assert.equal((await waive(4, { reason: 'x', amount: 999 })).status, 422);
  assert.equal((await waive(4, { reason: 'Partial', amount: 10 })).json.data.status, 'UNPAID');
  assert.equal((await waive(4, { reason: 'Rest' })).json.data.status, 'WAIVED');
  // Part paid and part waived ends as PAID.
  assert.equal((await waive(3, { reason: 'Rest' })).json.data.status, 'PAID');
});

test('fine rules: new rule replaces old; existing loans keep their terms', async () => {
  const body = { name: 'New standard', loanDays: 10, graceDays: 0, dailyRate: 7 };
  assert.equal((await api('POST', '/fine-rules', { token: tokens.admin, body })).status, 201);
  assert.equal(await scalar('SELECT COUNT(*) FROM fine_rules WHERE category_id IS NULL AND is_active'), 1);
  assert.equal(await scalar('SELECT fine_rule_id FROM book_issues WHERE id = 14'), 1);
  const late = await api('POST', '/returns', { token: tokens.librarian, body: { issueId: 14 } });
  assert.equal(late.json.data.fineAmount, 5); // 2 late, 1 grace, Rs 5 from the old rule
  const issued = await api('POST', '/issues', { token: tokens.librarian, body: { bookId: 8, studentId: 2 } });
  assert.equal(issued.json.data.dueDate, await scalar("SELECT DATE_FORMAT(CURDATE() + INTERVAL 10 DAY, '%Y-%m-%d')"));
});

test('student sees only own data', async () => {
  const mine = await api('GET', '/issues/mine', { token: tokens.student });
  assert.ok(mine.json.data.items.every((l) => l.student_name === 'Aarav Sharma'));
  const fines = await api('GET', '/fines/mine', { token: tokens.rohan });
  assert.ok(fines.json.data.items.every((f) => f.student_name === 'Rohan Verma'));
  assert.equal((await api('GET', '/predictions/issue/15', { token: tokens.student })).status, 403);
});

test('notifications: reminders do not duplicate; users cannot touch others', async () => {
  await sendReminders();
  const count = await scalar('SELECT COUNT(*) FROM notifications');
  await sendReminders();
  assert.equal(await scalar('SELECT COUNT(*) FROM notifications'), count);

  const inbox = await api('GET', '/notifications', { token: tokens.rohan });
  assert.ok(inbox.json.data.unread > 0);
  const noteId = inbox.json.data.items[0].id;
  assert.equal((await api('PATCH', `/notifications/${noteId}/read`, { token: tokens.student })).status, 404);
  assert.equal((await api('PATCH', `/notifications/${noteId}/read`, { token: tokens.rohan })).status, 200);
  await api('PATCH', '/notifications/read-all', { token: tokens.rohan });
  assert.equal((await api('GET', '/notifications', { token: tokens.rohan })).json.data.unread, 0);
});

test('dashboards and reports', async () => {
  const dash = await api('GET', '/dashboard/admin', { token: tokens.admin });
  assert.equal(dash.status, 200);
  assert.ok(dash.json.data.counts.titles >= 16);
  assert.equal((await api('GET', '/dashboard/librarian', { token: tokens.librarian })).status, 200);
  const student = await api('GET', '/dashboard/student', { token: tokens.student });
  assert.equal(student.json.data.totals.total, 3);

  for (const type of ['issues', 'overdue', 'fines', 'payments', 'inventory']) {
    assert.equal((await api('GET', `/reports/${type}`, { token: tokens.admin })).status, 200, type);
    assert.match((await api('GET', `/reports/${type}?format=pdf`, { token: tokens.admin })).type, /pdf/);
    assert.match((await api('GET', `/reports/${type}?format=xlsx`, { token: tokens.admin })).type, /spreadsheet/);
  }
  const dated = await api('GET', '/reports/issues?from=2000-01-01&to=2000-12-31', { token: tokens.admin });
  assert.equal(dated.json.data.rows.length, 0);
  assert.equal((await api('GET', '/reports/nope', { token: tokens.admin })).status, 404);
});

test('prediction answers 503 while the ML service is down, and the app still works', async () => {
  const res = await api('GET', '/predictions/issue/15', { token: tokens.admin });
  assert.equal(res.status, 503);
  assert.equal((await api('GET', '/books', { token: tokens.student })).status, 200);
});

test('database integrity after all of the above', async () => {
  const bad = await scalar(`SELECT COUNT(*) FROM books b
    LEFT JOIN (SELECT book_id, COUNT(*) n FROM book_issues WHERE status = 'ISSUED' GROUP BY book_id) o ON o.book_id = b.id
    WHERE b.available_copies <> b.total_copies - COALESCE(o.n, 0)`);
  assert.equal(bad, 0);
});
