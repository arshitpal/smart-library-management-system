import { useState } from 'react';
import { Badge, DataTable, formatDate, PageHeader, rupees } from '../components/Common';
import FineEstimate from '../components/FineEstimate';
import { useList } from '../hooks/useFetch';

export default function MyLoans({ view }) {
  const current = view === 'current';
  const list = useList('/issues/mine', { state: current ? 'OPEN' : '' });
  const [estimate, setEstimate] = useState(null);

  const columns = current
    ? [
      { label: 'Book', render: (r) => r.book_title },
      { label: 'Issued', render: (r) => formatDate(r.issue_date) },
      { label: 'Due', render: (r) => formatDate(r.due_date) },
      { label: 'Status', render: (r) => <Badge value={r.loan_state} /> },
      { label: 'Fine so far', render: (r) => rupees(r.accrued_fine) },
      { label: 'Estimate', render: (r) => <button type="button" className="btn btn-sm btn-primary" onClick={() => setEstimate(r.issue_id)}>Estimate fine</button> },
    ]
    : [
      { label: 'Book', render: (r) => r.book_title },
      { label: 'Issued', render: (r) => formatDate(r.issue_date) },
      { label: 'Due', render: (r) => formatDate(r.due_date) },
      { label: 'Returned', render: (r) => formatDate(r.return_date) },
      { label: 'Status', render: (r) => <Badge value={r.loan_state} /> },
    ];

  return (
    <>
      <PageHeader
        title={current ? 'My Loans' : 'Borrowing History'}
        subtitle={current ? 'Check due dates and see the likely fine before it grows' : 'Every book you have borrowed'}
      />
      <DataTable columns={columns} list={list} rowKey="issue_id" empty={current ? 'You have no books on loan' : 'No borrowing history yet'} />
      {estimate && <FineEstimate issueId={estimate} onClose={() => setEstimate(null)} />}
    </>
  );
}
