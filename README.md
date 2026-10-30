# Smart Library Management System with Fine Prediction Using Machine Learning

MCA final-year project: a library system built with React, Express, MySQL and a Python FastAPI machine-learning service.

## Run the project on Windows 11

MySQL must already be installed and running.

1. Double-click **setup.bat** and enter your MySQL root password. This happens once. It creates the database, loads sample data and writes the settings files. Each row of the table it prints should show `problems` = 0.
2. Double-click **start.bat**. Three windows open, one per service, and then the app opens at <http://localhost:5180>.

To stop the project, close the three windows.

## Sample logins (local testing only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@library.test | Admin@123 |
| Librarian | librarian1@library.test, librarian2@library.test | Librarian@123 |
| Student | student1@library.test to student6@library.test | Student@123 |

`student3@library.test` has the most useful demo data: overdue books and pending fines. Never load `seed.sql` on a real deployment, because these passwords are public.

## Reset the sample data

Sample dates are relative to the day they load, so reset before a demo. In MySQL Workbench or the MySQL command line, run:

```sql
DROP DATABASE smart_library;
```

Then run **setup.bat** again. This deletes everything in that database.

## Ports

| Service | Address |
|---|---|
| Web app | http://localhost:5180 |
| Backend API | http://localhost:5000 |
| ML service | http://127.0.0.1:8001 (private) |
| MySQL | 3306 |

## Manual commands

Only needed for development. Run each from its own folder:

```powershell
cd backend;    npm install;  npm run dev
cd frontend;   npm install;  npm run dev
cd ml-service; py -m venv .venv; .venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Retrain the model, for example after a fine-rate change:

```powershell
cd ml-service
.venv\Scripts\python training\generate_data.py
.venv\Scripts\python training\train.py
```

Then restart the ML service.

**Run the API tests only on a throwaway database.** They change data, and they use whichever database `backend/.env` points to:

```powershell
cd backend; npm test
```

## Free deployment

Uses Aiven (MySQL), Render (backend and ML service) and Vercel (frontend).

1. **Aiven:** create a free MySQL service. Download its CA certificate as `ca.pem`, then run **deploy-db.bat** and enter the host, port, user, password and `ca.pem` path. Save the new login passwords it prints, because they are shown only once.
2. **Render:** choose New > Blueprint and select this repository. It reads `render.yaml`. Enter the Aiven values, and paste the contents of `ca.pem` into `DB_SSL_CA`. Set `CLIENT_ORIGIN` to `https://placeholder.vercel.app` for now.
3. **Render:** copy the ML service's URL into the backend's `ML_SERVICE_URL`.
4. **Vercel:** import this repository, set Root Directory to `frontend`, and add `VITE_API_URL` with the backend's Render URL, without a trailing slash.
5. **Render:** change `CLIENT_ORIGIN` to the Vercel URL, without a trailing slash.

Free Render services sleep after 15 minutes without traffic and take about a minute to wake, so open the site before a demo.

## Smart App Control

Windows Smart App Control is on for this PC, and it blocks some new Python package builds. `ml-service/requirements.txt` pins versions it allows. Do not upgrade pandas, pydantic or scikit-learn without testing that they still load.

## Documents

1. [Requirement analysis](documentation/01-requirements-analysis.md)
2. [System architecture and API plan](documentation/02-system-architecture.md)
3. [Database design](documentation/03-database-design.md)
4. [Machine learning design](documentation/04-ml-design.md)
5. [MCA project report](documentation/05-mca-project-report.md)
6. [Viva questions and answers](documentation/06-viva-questions.md)
7. [Presentation outline](documentation/07-ppt-outline.md)

The diagrams use Mermaid. To see them in VS Code, install the "Markdown Preview Mermaid Support" extension.
