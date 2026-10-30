import { ActualPredictedChart, BarChart, GroupedBarChart, Panel } from '../components/Charts';
import { Alert, Badge, DataTable, formatDate, PageHeader, rupees, Spinner, StatCard } from '../components/Common';
import { useFetch, useList } from '../hooks/useFetch';

export default function MlReports() {
  const metrics = useFetch('/predictions/metrics');
  const comparison = useFetch('/predictions/comparison');
  const history = useList('/predictions/history');
  const m = metrics.data;

  const models = m && [['Random Forest', m.random_forest], ['Linear Regression', m.linear_regression], ['Always guess average', m.baseline_predict_mean]];

  const metricColumns = [
    { label: 'Model', render: (r) => r[0] },
    { label: 'MAE (₹)', render: (r) => r[1].mae },
    { label: 'MSE', render: (r) => r[1].mse },
    { label: 'RMSE (₹)', render: (r) => r[1].rmse },
    { label: 'R²', render: (r) => r[1].r2 },
  ];
  const compareColumns = [
    { label: 'Student', render: (r) => r.student_name },
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Predicted', render: (r) => rupees(r.predicted_fine) },
    { label: 'Actual', render: (r) => rupees(r.actual_fine) },
    { label: 'Difference', render: (r) => rupees(r.absolute_error) },
    { label: 'Data', render: (r) => r.data_source },
  ];
  const historyColumns = [
    { label: 'Date', render: (r) => formatDate(r.predicted_on) },
    { label: 'Student', render: (r) => r.student_name },
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Days left', render: (r) => r.days_remaining },
    { label: 'Past late', render: (r) => r.prior_late_count },
    { label: 'Predicted', render: (r) => rupees(r.predicted_fine) },
    { label: 'Loan', render: (r) => <Badge value={r.loan_state} /> },
    { label: 'Model', render: (r) => r.model_version },
  ];

  return (
    <>
      <PageHeader title="ML Reports" subtitle="How the fine prediction model performs on loans it has never seen" />
      <Alert>{metrics.error}</Alert>
      {metrics.loading && !m && <Spinner />}
      {m && (
        <>
          {m.data_source === 'SYNTHETIC' && (
            <Alert type="warning">
              These results use <strong>synthetic sample data</strong>. They show how well the model recovers patterns built into that data, not accuracy for a real library.
            </Alert>
          )}
          <div className="stat-grid">
            <StatCard icon="bullseye" label="MAE, Random Forest" value={rupees(m.random_forest.mae)} />
            <StatCard icon="graph-up" label="R², Random Forest" value={m.random_forest.r2} tone="success" />
            <StatCard icon="database" label="Training loans" value={m.train_rows.toLocaleString('en-IN')} />
            <StatCard icon="clipboard-check" label="Test loans" value={m.test_rows.toLocaleString('en-IN')} />
          </div>
          <div className="mb-3"><DataTable columns={metricColumns} rows={models} rowKey="0" /></div>
          <div className="chart-grid">
            <Panel title="Error by model (lower is better)">
              <GroupedBarChart
                labels={models.map((r) => r[0])}
                series={[{ label: 'MAE', data: models.map((r) => r[1].mae) }, { label: 'RMSE', data: models.map((r) => r[1].rmse) }]}
              />
            </Panel>
            <Panel title="Predicted vs actual, test set sample">
              <ActualPredictedChart points={m.sample_points} />
            </Panel>
            <Panel title="What drives the prediction">
              <BarChart
                horizontal
                fractional
                label="Importance"
                labels={m.feature_importance.slice(0, 7).map((f) => f.feature)}
                values={m.feature_importance.slice(0, 7).map((f) => f.importance)}
              />
            </Panel>
          </div>
        </>
      )}
      <h2 className="fs-6 fw-semibold mt-3">Predicted vs actual, returned library loans</h2>
      <p className="small text-muted">{comparison.data?.summary.count ? `Average difference ${rupees(comparison.data.summary.mae)} across ${comparison.data.summary.count} loan(s)` : 'Loans appear here after they are predicted and then returned.'}</p>
      <div className="mb-3"><DataTable columns={compareColumns} rows={comparison.data?.rows || []} rowKey="prediction_id" empty="No returned loans with predictions yet" /></div>
      <h2 className="fs-6 fw-semibold">Prediction history</h2>
      <DataTable columns={historyColumns} list={history} empty="No predictions yet" />
    </>
  );
}
