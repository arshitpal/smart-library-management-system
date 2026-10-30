import { useState } from 'react';
import { Badge, DataTable, formatDate, FormModal, PageHeader, rupees, SearchBox } from '../components/Common';
import { useList } from '../hooks/useFetch';
import api from '../services/api';

const payFields = (balance) => [
  { name: 'amount', label: `Amount (balance ${rupees(balance)})`, type: 'number', step: '0.01', min: '0.01', required: true },
  {
    name: 'method',
    label: 'Method',
    type: 'select',
    required: true,
    options: [
      { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' },
      { value: 'CARD', label: 'Card' }, { value: 'NET_BANKING', label: 'Net banking' },
    ],
  },
  { name: 'transactionRef', label: 'Transaction reference (optional)' },
];

const waiveFields = (balance) => [
  { name: 'amount', label: `Amount (leave empty to waive all ${rupees(balance)})`, type: 'number', step: '0.01', min: '0.01' },
  { name: 'reason', label: 'Reason', type: 'textarea', required: true },
];

function PaymentList() {
  const list = useList('/payments');
  const columns = [
    { label: 'Date', render: (p) => formatDate(p.paid_at) },
    { label: 'Student', render: (p) => <>{p.student_name}<small>{p.enrollment_no}</small></> },
    { label: 'Book', render: (p) => p.book_title },
    { label: 'Amount', render: (p) => rupees(p.amount) },
    { label: 'Method', render: (p) => p.method.replace('_', ' ') },
    { label: 'Received by', render: (p) => p.received_by_name },
  ];
  return (
    <>
      <div className="filter-bar">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search student" />
      </div>
      <DataTable columns={columns} list={list} />
    </>
  );
}

export default function Fines() {
  const [tab, setTab] = useState('fines');
  const list = useList('/fines', { status: 'PENDING' });
  const [pay, setPay] = useState(null);
  const [waive, setWaive] = useState(null);

  async function submitPayment(values) {
    await api.post('/payments', { ...values, fineId: pay.fine_id });
    list.reload();
  }

  async function submitWaiver(values) {
    await api.post(`/fines/${waive.fine_id}/waive`, { reason: values.reason, amount: values.amount || null });
    list.reload();
  }

  const columns = [
    { label: 'Student', render: (f) => <>{f.student_name}<small>{f.enrollment_no}</small></> },
    { label: 'Book', render: (f) => <>{f.book_title}<small>{f.late_days} day(s) late</small></> },
    { label: 'Fine', render: (f) => rupees(f.amount) },
    { label: 'Paid', render: (f) => rupees(f.paid_amount) },
    { label: 'Balance', render: (f) => <strong>{rupees(f.balance)}</strong> },
    { label: 'Status', render: (f) => <Badge value={f.status} /> },
    {
      label: 'Actions',
      render: (f) => (f.balance > 0 ? (
        <div className="row-actions">
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setPay(f)}>Pay</button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => setWaive(f)}>Waive</button>
        </div>
      ) : '—'),
    },
  ];

  return (
    <>
      <PageHeader title="Fines & Payments" subtitle="Actual fines, calculated from the fine rules at return" />
      <ul className="nav nav-pills mb-3">
        {[['fines', 'Fines'], ['payments', 'Payments']].map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button type="button" className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          </li>
        ))}
      </ul>
      {tab === 'payments' ? <PaymentList /> : (
        <>
          <div className="filter-bar">
            <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search student or book" />
            <select className="form-select" aria-label="Status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="">All fines</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>
          <DataTable columns={columns} list={list} rowKey="fine_id" empty="No fines found" />
        </>
      )}
      {pay && <FormModal title="Record payment" submitLabel="Record payment" fields={payFields(pay.balance)} initial={{ amount: pay.balance }} onSubmit={submitPayment} onClose={() => setPay(null)} />}
      {waive && <FormModal title="Waive fine" submitLabel="Waive" fields={waiveFields(waive.balance)} onSubmit={submitWaiver} onClose={() => setWaive(null)} />}
    </>
  );
}
