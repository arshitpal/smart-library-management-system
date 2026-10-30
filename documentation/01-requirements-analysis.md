# 1. Requirement Analysis

**Project:** Smart Library Management System with Fine Prediction Using Machine Learning

## 1.1 Problem in one paragraph

Many college libraries track loans in registers or basic software. Students find out about a fine only when they return a book, staff chase overdue books by hand, and management cannot see borrowing patterns. This system automates the full loan cycle (issue, return, fine, payment) and adds something ordinary systems lack: an **early estimate** of the fine a student is likely to pay on a current loan, so they can act before the fine grows.

## 1.2 Actors and permissions

Admin has every librarian capability, plus user management, catalogue setup and fine rules.

| Capability | Admin | Librarian | Student |
|---|---|---|---|
| Log in, edit own profile | Yes | Yes | Yes |
| Manage librarians | Yes | No | No |
| Manage students | Yes | View only | No |
| Manage categories and authors | Yes | No | No |
| Manage books and copies | Yes | Yes | No |
| Search the catalogue | Yes | Yes | Yes |
| Issue and accept return of books | Yes | Yes | No |
| Track overdue books | Yes | Yes | Own loans |
| View borrowing history | All | All | Own |
| Configure fine rules | Yes | No | No |
| Record payments, view fines | Yes | Yes | Own fines (view) |
| Waive a fine | Yes | Yes | No |
| Full analytics, ML reports and metrics | Yes | No | No |
| ML fine estimate | All loans | All loans | Own loans |
| Export PDF / Excel | Yes | Yes | No |
| Receive notifications | Yes | Yes | Yes |

**Decision:** students do not self-register. An admin creates each account, because library membership follows college enrolment.

## 1.3 Functional requirements

| ID | Requirement | Phase |
|---|---|---|
| FR-01 | Login with JWT; access controlled by role | 2 |
| FR-02 | Admin creates, edits and deactivates students and librarians | 2-3 |
| FR-03 | CRUD for books, categories and authors; a book can have several authors | 4 |
| FR-04 | Search and filter books by title, author, category and availability | 4 |
| FR-05 | Issue a book only if a copy is available, the student is active, the student is under the borrowing limit, and the student does not already hold that title | 4 |
| FR-06 | Due date is calculated automatically from the fine rule that applies to the book's category | 4 |
| FR-07 | Return a book: restore the copy, calculate the actual fine, create the fine record | 4 |
| FR-08 | Actual fine = rule-based calculation only, never ML | 4 |
| FR-09 | Full or partial fine payment; fine waiver with a recorded reason | 4 |
| FR-10 | Overdue is derived from today's date and shown live | 4 |
| FR-11 | Train Random Forest and Linear Regression on a training dataset; evaluate on a separate test dataset with MAE, MSE, RMSE, R² | 5 |
| FR-12 | Estimate the fine for a current loan through the FastAPI service | 5 |
| FR-13 | Show estimates for different possible return delays | 5 |
| FR-14 | Save each prediction with the inputs used and the model version | 5 |
| FR-15 | Show actual and predicted fines separately, and compare them after return | 5-6 |
| FR-16 | Due-date reminders and overdue, fine and payment notifications | 6 |
| FR-17 | Separate dashboards with charts for each role | 3, 6 |
| FR-18 | Reports with PDF and Excel export | 6 |

## 1.4 Non-functional requirements

| Area | Requirement |
|---|---|
| Security | bcrypt password hashes, JWT, role checks on the server, parameterised SQL, input validation, secrets in `.env` |
| Integrity | Issue, return and payment each run in one database transaction; key rules are also enforced by the database |
| Availability | If the ML service is down, the library still works; only the estimate panel shows "unavailable" |
| Usability | Responsive from phone to desktop, consistent dashboard layout |
| Maintainability | Frontend, backend and ML run separately and talk only through REST |
| Honesty of data | Synthetic ML data and sample records are clearly labelled |

## 1.5 Business rules

1. **Due date:** `due_date = issue_date + loan_days` of the rule for the book's category, or of the default rule if the category has none.
2. **Rule at issue:** each loan records the rule in force on the issue date. Changing a rule later never changes the terms of an existing loan.
3. **Fine formula:**
   ```text
   late_days        = max(0, return_date - due_date)
   chargeable_days  = max(0, late_days - grace_days)
   fine             = min(chargeable_days x daily_rate, max_fine)
   ```
   Once a return falls outside the grace period, the fine is charged for days beyond the grace period only. Example with the sample default rule (1 grace day, Rs 5/day): 5 days late gives 4 chargeable days and a Rs 20 fine.
4. **Fine timing:** a fine record is created at return, and only if the amount is above zero. For an unreturned overdue book, the UI shows a live **accrued amount** calculated with the same formula.
5. **Actual vs predicted:** the actual fine is a rule calculation and the amount owed. A prediction is advice only. It never changes a fine record.
6. **Rules are versioned:** changing a rule deactivates the old row and inserts a new one. At most one rule is active per category, plus one default.

## 1.6 Scope boundaries

Left out of this version and listed as future scope:

- Real online payment gateways. Payments are recorded by staff with a method and reference.
- Lost or damaged book charges. `book_returns.remarks` records the condition as free text.
- Book reservations and loan renewals.
- Individual copy tracking with barcodes. Copies are counted per title.
- Email and SMS delivery. Notifications are in-app.

## 1.7 Changes to the brief

| Change | Reason |
|---|---|
| Added `fine_rules` table | The brief requires configured fine rules but its table list has nowhere to store them |
| Added `book_authors` table | A book can have several authors; storing them in one column would break 1NF |

Total: 14 tables (the 12 requested plus these 2), plus 3 read-only views.
