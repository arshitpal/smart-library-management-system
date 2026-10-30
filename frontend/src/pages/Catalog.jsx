import { useState } from 'react';
import { Alert, DataTable, FormModal, PageHeader } from '../components/Common';
import { useFetch } from '../hooks/useFetch';
import api, { errorMessage } from '../services/api';

function Section({ title, path, descriptionField, descriptionLabel }) {
  const { data, error, reload } = useFetch(path);
  const [form, setForm] = useState(null);
  const [actionError, setActionError] = useState('');

  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: descriptionField, label: descriptionLabel, type: 'textarea' },
  ];

  async function save(values) {
    if (form.id) await api.put(`${path}/${form.id}`, values);
    else await api.post(path, values);
    reload();
  }

  async function remove(record) {
    setActionError('');
    try {
      await api.delete(`${path}/${record.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const columns = [
    { label: 'Name', render: (r) => r.name },
    { label: descriptionLabel, render: (r) => r[descriptionField] || '—' },
    {
      label: 'Actions',
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="btn btn-sm btn-light" onClick={() => setForm(r)}>Edit</button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => remove(r)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <section className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="fs-6 fw-semibold mb-0">{title}</h2>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setForm({})}>Add</button>
      </div>
      <Alert>{error || actionError}</Alert>
      <DataTable columns={columns} rows={data || []} />
      {form && <FormModal title={form.id ? `Edit ${title}` : `Add to ${title}`} fields={fields} initial={form} onSubmit={save} onClose={() => setForm(null)} />}
    </section>
  );
}

export default function Catalog() {
  return (
    <>
      <PageHeader title="Categories & Authors" subtitle="Records used by books cannot be deleted" />
      <Section title="Categories" path="/categories" descriptionField="description" descriptionLabel="Description" />
      <Section title="Authors" path="/authors" descriptionField="biography" descriptionLabel="Biography" />
    </>
  );
}
