# Viva Questions and Answers

## Project overview

**1. What does your project do?**
It automates a library's loan cycle for admins, librarians and students, and uses machine learning to estimate the fine a student is likely to pay on a book still on loan.

**2. What is new compared with a normal library system?**
A normal system tells you the fine after it happens. Mine gives an estimate beforehand, based on the student's past behaviour.

**3. Why three separate applications?**
The frontend, backend and ML service each do one job. They can be changed or restarted separately, and an ML failure cannot stop the library.

**4. Which technologies did you use, and why?**
React for a component-based interface, Node and Express for REST APIs, MySQL because the data is relational, and Python because the ML libraries are there.

**5. Your stack is called MERN-style. Why not MongoDB?**
Loans, fines and payments are highly relational and need transactions and foreign keys, so a relational database fits better.

## Database

**6. How many tables are there?**
Fourteen, plus three views. The two additions to the brief are `fine_rules`, which stores configured rules, and `book_authors`, which handles many-to-many authors.

**7. What normal form is your database in?**
3NF, with a few documented exceptions such as `available_copies`, kept for search speed and updated only inside transactions.

**8. Why not store "overdue" as a status?**
It depends on today's date, so a stored value would go stale. It is calculated by the `v_loan_status` view.

**9. What is a foreign key?**
A column that must match a primary key in another table, which protects relationships between tables.

**10. Why soft delete users and books?**
Deleting them would destroy loan and fine history. An `is_active` flag hides them instead.

**11. How do you allow only one active fine rule per category?**
A generated column holds a value only for active rules, and a unique index on it allows any number of NULLs but no duplicate values.

**12. Why `DECIMAL` for money?**
`FLOAT` is approximate. `DECIMAL` is exact.

**13. What is a view?**
A saved query that behaves like a read-only table.

**14. What is a transaction?**
A group of database steps that all succeed or all fail. For example, a return updates the loan, the copy count and the fine together.

**15. What are ACID properties?**
Atomicity, consistency, isolation and durability: the guarantees that keep transactions reliable.

**16. What does an index do?**
It speeds up searches on a column, at a small cost to writes and storage.

## Backend and security

**17. What is REST?**
A way of designing APIs where URLs are resources and HTTP methods such as GET and POST are actions.

**18. How does login work?**
The server compares the password with the bcrypt hash and returns a signed JWT. The browser sends that token with each request.

**19. Why bcrypt and not encryption?**
Passwords should never be recoverable. bcrypt is a slow one-way hash with a salt, which makes stolen hashes hard to crack.

**20. What is inside a JWT?**
A header, a payload (user ID, role, expiry) and a signature. It is signed, not encrypted, so it holds no secrets.

**21. How is SQL injection prevented?**
All queries use bound parameters, so user input is treated as data and never as SQL. I tested this with `' OR 1=1 --`.

**22. Why check roles on the server when the menu is already hidden?**
Anyone can call the API directly, so the interface is not a security boundary.

**23. How do you stop a student seeing another student's loan?**
The prediction route checks that the loan belongs to the logged-in student, which is an ownership check on top of the role check.

**24. What happens if two librarians issue the last copy together?**
Both run an `UPDATE ... WHERE available_copies > 0`. The database applies them one at a time, so only one succeeds. An automated test confirms it.

**25. How does a deactivated user lose access if a JWT is stateless?**
Each request reloads the user from the database and checks `is_active`.

**26. What is middleware?**
A function that runs before the route handler, such as the JWT and role checks.

**27. Why status codes like 401, 403 and 409?**
401 means not logged in, 403 means not allowed, 409 means the action conflicts with current data, and 422 means invalid input.

## Fine logic

**28. How is the fine calculated?**
`min((days late - grace days) x daily rate, maximum fine)`, and never below zero.

**29. Give an example.**
With 1 grace day and ₹5 a day, a book 6 days late has 5 chargeable days, so the fine is ₹25.

**30. What if the admin changes the rule?**
A new rule version is created. Open loans keep the rule stored on them, so nobody's agreed terms change.

**31. Why does the fine formula exist in only one place?**
Two copies could disagree. Only `fineService` calculates fines, and the SQL views deliberately do not.

**32. When is a fine record created?**
At return, if the amount is above zero. Until then the screen shows a live accrued amount.

## Machine learning

**33. Why is this a regression problem?**
The output is an amount in rupees, a continuous number.

**34. Why ML, if the fine has a formula?**
The formula needs the return date, which is unknown while the book is out. ML estimates that uncertain future.

**35. How does a Random Forest work?**
It trains many decision trees on random samples of data and features, then averages their predictions, which reduces overfitting.

**36. Why compare with Linear Regression?**
It is a simple baseline. If a complex model cannot beat it, the complexity is not justified.

**37. What features did you use?**
Days remaining, issue duration, previous late count, average late days, share of past loans returned late, category and borrowing frequency.

**38. What is data leakage?**
Training with information that would not be available at prediction time. It gives high scores and a useless model.

**39. How did you avoid it?**
Return dates and fines are never inputs, history uses only earlier returned loans, the split is by time, and preprocessing is fitted on training data only.

**40. Why a time-based split, not a random one?**
A random split lets the model learn from later loans to predict earlier ones, which can never happen in real use.

**41. Explain MAE, MSE, RMSE and R².**
MAE is the average error in rupees. MSE averages squared errors. RMSE is its square root, back in rupees, and punishes large misses. R² is the share of variation explained.

**42. What were your results?**
Random Forest: MAE ₹15.15, RMSE ₹29.07, R² 0.537. Linear Regression: MAE ₹17.38, RMSE ₹32.78, R² 0.411. Guessing the average: MAE ₹25.03.

**43. An R² of 0.54 seems low. Why?**
When someone returns a book is partly random, so much of the variation cannot be predicted. A suspiciously high score would have suggested leakage.

**44. Why is your data synthetic?**
A college library rarely has enough clean history available. The data is labelled synthetic throughout, including on screen.

**45. So can you claim this accuracy in a real library?**
No. The results show the model recovers patterns in the generated data. The predicted-versus-actual report is there to measure real accuracy later.

**46. Which feature mattered most?**
Days remaining, at 0.787 importance. A book that is already very late is strongly linked to a higher final fine.

**47. What is one-hot encoding?**
Turning a category into separate 0 or 1 columns, so the model does not treat categories as ordered numbers.

**48. What are hyperparameters, and how did you tune them?**
Settings chosen before training, such as tree depth. I used grid search with time-ordered cross-validation on training data only.

**49. What is overfitting?**
A model memorising training data and doing poorly on new data. Limiting tree depth and leaf size helps prevent it.

**50. When must the model be retrained?**
After a fine-rate change, because it learned the old rates, and whenever enough real data is available.

**51. How do the different delays work?**
For each delay, the screen shows the exact fine from the rules, plus the ML estimate of the final fine if the book is still out that day.

**52. What is Joblib for?**
Saving the trained model to a file so the service can load it without retraining.

**53. Why FastAPI?**
It is a fast Python framework with built-in request validation.

## Testing and limits

**54. How did you test the project?**
Automated API tests, database integrity checks and constraint tests, and browser testing of every page for each role.

**55. Name a bug testing found.**
Database views depended on the collation of the client that loaded them, which crashed dashboards on one setup. I fixed the collation in the schema.

**56. What are the limitations?**
Synthetic training data, no online payments, no email or SMS, no reservations, and no individual copy tracking.

**57. What would you do next?**
Retrain on real data, then add a payment gateway and email reminders.
