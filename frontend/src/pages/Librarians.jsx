import { useState } from 'react';
import { DataTable, formatDate, FormModal, PageHeader, SearchBox } from '../components/Common';
import { useList } from '../hooks/useFetch';
import api from '../services/api';

const baseFields = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'employeeCode', label: 'Employee code', required: true },
  { name: 'designation', label: 'Designation' },
  { name: 'joinedOn', label: 'Joined on', type: 'date', required: true },
];

export default function Librarians() {
  const list = useList('/librarians');
  const [form, setForm] = useState(null);

  async function save(values) {
    const body = { ...values, designation: values.designation || undefined };
    if (form.id) await api.put(`/librarians/${form.id}`, body);
    else await api.post('/librarians', body);
    list.reload();
  }

  async function toggle(person) {
    await api.patch(`/librarians/${person.id}/status`, { isActive: !person.user.is_active });
    list.reload();
  }

  const columns = [
    { label: 'Librarian', render: (l) => <>{l.user.full_name}<small>{l.user.email}</small></> },
    { label: 'Code', render: (l) => l.employee_code },
    { label: 'Designation', render: (l) => l.designation },
    { label: 'Joined', render: (l) => formatDate(l.joined_on) },
    { label: 'Status', render: (l) => <span className={`status-badge status-${l.user.is_active ? 'success' : 'secondary'}`}>{l.user.is_active ? 'Active' : 'Inactive'}</span> },
    {
      label: 'Actions',
      render: (l) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={() => setForm({
              id: l.id,
              fullName: l.user.full_name,
              email: l.user.email,
              phone: l.user.phone,
              employeeCode: l.employee_code,
              designation: l.designation,
              joinedOn: l.joined_on,
            })}
          >
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => toggle(l)}>{l.user.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      ),
    },
  ];

  const fields = form?.id ? baseFields : [
    ...baseFields,
    { name: 'password', label: 'Password', type: 'password', required: true, hint: '8+ characters with upper case, lower case and a number' },
  ];

  return (
    <>
      <PageHeader title="Librarians" subtitle="Library staff accounts">
        <button type="button" className="btn btn-primary" onClick={() => setForm({})}><i className="bi bi-plus-lg me-1" />Add librarian</button>
      </PageHeader>
      <div className="filter-bar">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search name, email or code" />
      </div>
      <DataTable columns={columns} list={list} />
      {form && <FormModal title={form.id ? 'Edit librarian' : 'Add librarian'} fields={fields} initial={form} onSubmit={save} onClose={() => setForm(null)} />}
    </>
  );
}
