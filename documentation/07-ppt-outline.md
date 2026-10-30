# Presentation Outline

For a 12 to 15 minute final-year presentation. Replace the placeholders in brackets.

| # | Slide | Content | Visual |
|---|---|---|---|
| 1 | Title | Project title, [your name], [enrolment number], [guide], [college], [year] | College logo |
| 2 | The problem | Students learn about a fine only at return; staff track overdue books by hand | Simple before picture |
| 3 | Objectives | Automate the loan cycle; rule-based fines; early ML estimate; analytics | Four short points |
| 4 | Existing vs proposed | Manual, late, no insight vs automatic, early, data-driven | Two-column table |
| 5 | Technology | React, Node and Express, MySQL, Python and FastAPI | Logos |
| 6 | Architecture | Three separate applications and one database | Architecture diagram |
| 7 | User roles | What Admin, Librarian and Student can do | Three columns |
| 8 | Database | 14 tables, 3NF, and rules protected by the database | ER diagram |
| 9 | Fine logic | Formula, with the example of 6 days late giving ₹25 | Worked example |
| 10 | ML approach | Question, seven features, target, Random Forest | Pipeline diagram |
| 11 | Avoiding data leakage | Time-based split; only past history is used | Timeline of train and test periods |
| 12 | Results | RF MAE ₹15.15, R² 0.537; LR MAE ₹17.38, R² 0.411 | Comparison chart |
| 13 | Live demo | See the script below | Running app |
| 14 | Testing | 17 of 17 API test groups, 29 pages, concurrency and security tests | Results table |
| 15 | Limitations and future scope | Synthetic data; real data, payments, email next | Two short lists |
| 16 | Conclusion | Exact fines from rules, early estimates from ML | One sentence |
| 17 | Thank you | Questions | None |

## Demo script (3 to 4 minutes)

1. **Admin:** log in and show the dashboard charts.
2. **Fine rules:** show the default and Reference rules.
3. **Librarian:** issue a book and point out the automatic due date.
4. **Return:** return an overdue book and show the rule-based fine.
5. **Payment:** record a partial payment and show the new balance.
6. **Student:** open My Loans, click Estimate fine, and explain actual vs predicted.
7. **Admin:** open ML Reports, show the model comparison and the sample-data notice.

Reload the sample data the day before, so the demo has fresh overdue loans. Keep screenshots ready in case something fails on the day.

## Speaking tips

- Say plainly that the results use synthetic data, before anyone asks.
- Explain why ML never decides a real fine.
- Do not read the slides. Keep each slide to a few words and one visual.
