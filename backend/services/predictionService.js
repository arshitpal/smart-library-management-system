// Builds features from MySQL, asks the ML service, and saves the estimate.
// History uses only loans returned on or before the prediction date (no leakage).
const axios = require('axios');
const { QueryTypes } = require('sequelize');
const { sequelize, Book, BookIssue, Category, FineRule, PredictionHistory } = require('../models');
const { calculateFine } = require('./fineService');
const { ml } = require('../config/env');
const ApiError = require('../utils/ApiError');
const { addDays, diffDays, today } = require('../utils/dates');

const SCENARIO_DELAYS = [0, 1, 3, 7, 14, 30];
const FREQUENCY_WINDOW_DAYS = 180;

const client = axios.create({
  baseURL: ml.url,
  timeout: ml.timeoutMs,
  headers: { 'X-Service-Key': ml.key },
});

async function buildFeatures(issue, asOf) {
  const [history] = await sequelize.query(
    `SELECT COUNT(*) AS returned,
            COALESCE(SUM(br.return_date > bi.due_date), 0) AS late,
            COALESCE(AVG(CASE WHEN br.return_date > bi.due_date
                              THEN DATEDIFF(br.return_date, bi.due_date) END), 0) AS avg_late
     FROM book_issues bi
     JOIN book_returns br ON br.issue_id = bi.id
     WHERE bi.student_id = ? AND bi.id <> ? AND br.return_date <= ?`,
    { replacements: [issue.student_id, issue.id, asOf], type: QueryTypes.SELECT },
  );
  const [frequency] = await sequelize.query(
    `SELECT COUNT(*) AS n FROM book_issues
     WHERE student_id = ? AND id <> ? AND issue_date >= ? AND issue_date <= ?`,
    { replacements: [issue.student_id, issue.id, addDays(asOf, -FREQUENCY_WINDOW_DAYS), asOf], type: QueryTypes.SELECT },
  );

  const returned = Number(history.returned);
  const late = Number(history.late);
  return {
    days_remaining: diffDays(issue.due_date, asOf),
    issue_duration_days: diffDays(issue.due_date, issue.issue_date),
    prior_late_count: late,
    avg_late_days: Number(Number(history.avg_late).toFixed(2)),
    prior_overdue_ratio: returned ? Number((late / returned).toFixed(4)) : 0,
    category_name: issue.book.category.name,
    borrowing_frequency: Number(frequency.n),
  };
}

async function callModel(instances) {
  try {
    const { data } = await client.post('/predict', { instances });
    return data;
  } catch (err) {
    const notReady = err.response && err.response.status === 503;
    throw new ApiError(503, notReady ? 'The ML model is not trained yet' : 'Fine estimate is unavailable right now');
  }
}

async function loadOpenIssue(issueId) {
  const issue = await BookIssue.findByPk(issueId, {
    include: [
      { model: FineRule, as: 'rule' },
      { model: Book, as: 'book', include: [{ model: Category, as: 'category' }] },
    ],
  });
  if (!issue) throw new ApiError(404, 'Loan not found');
  return issue;
}

async function predictForIssue({ issue, requestedBy }) {
  if (issue.status !== 'ISSUED') throw new ApiError(409, 'Estimates are only for books currently on loan');

  const asOf = today();
  const { rule } = issue;
  const cap = rule.max_fine === null ? null : Number(rule.max_fine);
  const features = await buildFeatures(issue, asOf);
  const accrued = calculateFine({ dueDate: issue.due_date, returnDate: asOf, rule }).amount;

  // A delay already in the past is not a possible future.
  const daysOverdue = Math.max(-features.days_remaining, 0);
  const delays = SCENARIO_DELAYS.filter((delay) => delay >= daysOverdue);
  const scenarios = delays.map((delay) => ({
    delay,
    returnDate: addDays(issue.due_date, delay),
    ruleFine: calculateFine({ dueDate: issue.due_date, returnDate: addDays(issue.due_date, delay), rule }).amount,
  }));

  const result = await callModel([
    { ...features, floor: accrued, cap },
    ...scenarios.map((s) => ({ ...features, days_remaining: -s.delay, floor: s.ruleFine, cap })),
  ]);
  const [predictedFine, ...scenarioEstimates] = result.predictions;

  const values = { requested_by: requestedBy, predicted_fine: predictedFine, ...features };
  const key = { issue_id: issue.id, predicted_on: asOf, model_version: result.model_version };
  const existing = await PredictionHistory.findOne({ where: key });
  if (existing) await existing.update(values);
  else await PredictionHistory.create({ ...key, ...values, data_source: result.data_source });

  return {
    issueId: issue.id,
    bookTitle: issue.book.title,
    dueDate: issue.due_date,
    accruedFine: accrued,
    predictedFine,
    features,
    scenarios: scenarios.map((s, i) => ({ ...s, mlEstimate: scenarioEstimates[i] })),
    modelVersion: result.model_version,
    dataSource: result.data_source,
  };
}

async function getModelMetrics() {
  try {
    const { data } = await client.get('/metrics');
    return data;
  } catch {
    throw new ApiError(503, 'Model metrics are unavailable right now');
  }
}

module.exports = { loadOpenIssue, predictForIssue, getModelMetrics };
