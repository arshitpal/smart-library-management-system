import { useState } from 'react';
import { DataTable, ExportButtons, PageHeader } from '../components/Common';
import { useFetch } from '../hooks/useFetch';

const TYPES = [
  ['issues', 'Book issues'], ['overdue', 'Overdue books'], ['fines', 'Fines'],
  ['payments', 'Payments'], ['inventory', 'Inventory'],
];

export default function Reports() {
  const [type, setType] = useState('issues');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = { ...(from && { from }), ...(to && { to }) };
  const { data, error, loading } = useFetch(`/reports/${type}`, params);

  const columns = (data?.columns || []).map((c) => ({
    label: c.label,
    render: (row) => (row[c.key] === null ? '—' : String(row[c.key])),
  }));
  const rows = (data?.rows || []).map((row, index) => ({ ...row, rowKey: index }));

  return (
    <>
      <PageHeader title="Reports" subtitle={data ? `${data.rows.length} record(s)` : ''}>
        <ExportButtons type={type} params={params} />
      </PageHeader>
      <div className="filter-bar">
        <select className="form-select" aria-label="Report" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {type !== 'inventory' && (
          <>
            <input type="date" className="form-control w-auto" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="form-control w-auto" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </div>
      <DataTable columns={columns} rows={rows} rowKey="rowKey" list={{ loading: loading && !data, error }} />
    </>
  );
}
