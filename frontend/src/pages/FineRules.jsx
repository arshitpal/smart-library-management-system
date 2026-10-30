import { useState } from 'react';
import { Alert, DataTable, formatDate, FormModal, PageHeader, rupees } from '../components/Common';
import { useFetch } from '../hooks/useFetch';
import api, { errorMessage } from '../services/api';

export default function FineRules() {
  const { data, error, reload } = useFetch('/fine-rules', { includeInactive: true });
  const { data: categories } = useFetch('/categories');
  const [form, setForm] = useState(null);
  const [actionError, setActionError] = useState('');

  const fields = [
    { name: 'name', label: 'Rule name', required: true },
    {
      name: 'categoryId',
      label: 'Applies to',
      type: 'select',
      placeholder: 'All books (default rule)',
      options: (categories || []).map((c) => ({ value: c.id, label: c.name })),
      hint: 'Saving replaces the active rule for this choice. Existing loans keep their terms.',
    },
    { name: 'loanDays', label: 'Loan period (days)', type: 'number', min: 1, required: true },
    { name: 'graceDays', label: 'Grace period (days)', type: 'number', min: 0, required: true },
    { name: 'dailyRate', label: 'Fine per day (₹)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'maxFine', label: 'Maximum fine (₹, empty for no limit)', type: 'number', step: '0.01', min: 0 },
  ];

  async function save(values) {
    await api.post('/fine-rules', { ...values, categoryId: values.categoryId || null, maxFine: values.maxFine === '' ? null : values.maxFine });
    reload();
  }

  async function deactivate(rule) {
    setActionError('');
    try {
      await api.delete(`/fine-rules/${rule.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const columns = [
    { label: 'Rule', render: (r) => <>{r.name}<small>{r.category ? r.category.name : 'All books (default)'}</small></> },
    { label: 'Loan', render: (r) => `${r.loan_days} days` },
    { label: 'Grace', render: (r) => `${r.grace_days} days` },
    { label: 'Per day', render: (r) => rupees(r.daily_rate) },
    { label: 'Maximum', render: (r) => (r.max_fine === null ? 'No limit' : rupees(r.max_fine)) },
    { label: 'From', render: (r) => formatDate(r.effective_from) },
    { label: 'Status', render: (r) => <span className={`status-badge status-${r.is_active ? 'success' : 'secondary'}`}>{r.is_active ? 'Active' : 'Retired'}</span> },
    {
      label: 'Actions',
      render: (r) => (r.is_active && r.category_id
        ? <button type="button" className="btn btn-sm btn-light" onClick={() => deactivate(r)}>Remove</button>
        : '—'),
    },
  ];

  return (
    <>
      <PageHeader title="Fine Rules" subtitle="Rules set each loan's due date and its actual fine">
        <button type="button" className="btn btn-primary" onClick={() => setForm({})}><i className="bi bi-plus-lg me-1" />New rule</button>
      </PageHeader>
      <Alert>{error || actionError}</Alert>
      <Alert type="warning">After changing a rate, retrain the ML model, because it learned the old rates.</Alert>
      <DataTable columns={columns} rows={data || []} />
      {form && <FormModal title="New fine rule" fields={fields} initial={form} onSubmit={save} onClose={() => setForm(null)} />}
    </>
  );
}
