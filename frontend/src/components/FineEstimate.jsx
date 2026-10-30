import { useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';
import { Alert, DataTable, formatDate, Modal, rupees, Spinner } from './Common';

// Shows the actual (rule-based) amount and the ML estimate separately.
export default function FineEstimate({ issueId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/predictions/issue/${issueId}`)
      .then((response) => setData(response.data.data))
      .catch((err) => setError(errorMessage(err)));
  }, [issueId]);

  const columns = [
    { label: 'Days after due date', render: (s) => (s.delay === 0 ? 'On due date' : `${s.delay} day(s)`) },
    { label: 'Fine if returned that day', render: (s) => rupees(s.ruleFine) },
    { label: 'Expected final fine if still out', render: (s) => rupees(s.mlEstimate) },
  ];

  return (
    <Modal title="Fine estimate" onClose={onClose}>
      <div className="modal-body">
        <Alert>{error}</Alert>
        {!data && !error && <Spinner />}
        {data && (
          <>
            <p className="mb-1 fw-semibold">{data.bookTitle}</p>
            <p className="text-muted small">Due {formatDate(data.dueDate)}</p>
            {data.dataSource === 'SYNTHETIC' && (
              <span className="sample-label"><i className="bi bi-info-circle" />Estimate from a model trained on sample data</span>
            )}
            <div className="fine-compare">
              <div><span>Fine so far (actual rule)</span><strong>{rupees(data.accruedFine)}</strong></div>
              <div><span>Predicted final fine (ML)</span><strong>{rupees(data.predictedFine)}</strong></div>
            </div>
            <p className="small text-muted">The prediction is advice only. You are charged by the library's rules when you return the book.</p>
            <DataTable columns={columns} rows={data.scenarios} rowKey="delay" />
          </>
        )}
      </div>
    </Modal>
  );
}
