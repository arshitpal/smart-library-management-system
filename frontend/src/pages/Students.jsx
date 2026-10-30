import { useState } from 'react';
import { Badge, DataTable, formatDate, FormModal, Modal, PageHeader, rupees, SearchBox } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useFetch, useList } from '../hooks/useFetch';
import api from '../services/api';

const academicFields = [
  { name: 'enrollmentNo', label: 'Enrollment number', required: true },
  { name: 'department', label: 'Department', required: true },
  { name: 'course', label: 'Course', required: true },
  { name: 'semester', label: 'Semester', type: 'number', min: 1, required: true },
  { name: 'maxBooks', label: 'Borrowing limit', type: 'number', min: 1 },
  { name: 'address', label: 'Address' },
];

const personFields = [
  { name: 'fullName', label: 'Full name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
];

function History({ student, onClose }) {
  const { data, loading } = useFetch('/issues', { studentId: student.id, limit: 50 });
  const columns = [
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Issued', render: (r) => formatDate(r.issue_date) },
    { label: 'Due', render: (r) => formatDate(r.due_date) },
    { label: 'Returned', render: (r) => formatDate(r.return_date) },
    { label: 'State', render: (r) => <Badge value={r.loan_state} /> },
    { label: 'Accrued', render: (r) => (r.accrued_fine ? rupees(r.accrued_fine) : '—') },
  ];
  return (
    <Modal title={`Borrowing history: ${student.user.full_name}`} onClose={onClose}>
      <div className="modal-body">
        {!loading && <DataTable columns={columns} rows={data?.items || []} rowKey="issue_id" empty="No loans yet" />}
      </div>
    </Modal>
  );
}

export default function Students() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const list = useList('/students', { status: '' });
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState(null);

  async function save(values) {
    if (form.id) await api.put(`/students/${form.id}`, values);
    else await api.post('/students', values);
    list.reload();
  }

  async function toggle(student) {
    await api.patch(`/students/${student.id}/status`, { isActive: !student.user.is_active });
    list.reload();
  }

  const columns = [
    { label: 'Student', render: (s) => <>{s.user.full_name}<small>{s.user.email}</small></> },
    { label: 'Enrollment', render: (s) => s.enrollment_no },
    { label: 'Course', render: (s) => <>{s.course} · Sem {s.semester}<small>{s.department}</small></> },
    { label: 'Status', render: (s) => <span className={`status-badge status-${s.user.is_active ? 'success' : 'secondary'}`}>{s.user.is_active ? 'Active' : 'Inactive'}</span> },
    {
      label: 'Actions',
      render: (s) => (
        <div className="row-actions">
          <button type="button" className="btn btn-sm btn-light" onClick={() => setHistory(s)}>History</button>
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => setForm({
                  id: s.id,
                  fullName: s.user.full_name,
                  email: s.user.email,
                  phone: s.user.phone,
                  enrollmentNo: s.enrollment_no,
                  department: s.department,
                  course: s.course,
                  semester: s.semester,
                  maxBooks: s.max_books,
                  address: s.address,
                })}
              >
                Edit
              </button>
              <button type="button" className="btn btn-sm btn-light" onClick={() => toggle(s)}>{s.user.is_active ? 'Deactivate' : 'Activate'}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  const fields = form?.id
    ? [...personFields, ...academicFields]
    : [...personFields, { name: 'password', label: 'Password', type: 'password', required: true, hint: '8+ characters with upper case, lower case and a number' }, ...academicFields];

  return (
    <>
      <PageHeader title="Students" subtitle="Library members and their borrowing history">
        {isAdmin && <button type="button" className="btn btn-primary" onClick={() => setForm({})}><i className="bi bi-plus-lg me-1" />Add student</button>}
      </PageHeader>
      <div className="filter-bar">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search name, email or enrollment" />
        <select className="form-select" aria-label="Status" value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <DataTable columns={columns} list={list} />
      {form && <FormModal title={form.id ? 'Edit student' : 'Add student'} fields={fields} initial={form} onSubmit={save} onClose={() => setForm(null)} />}
      {history && <History student={history} onClose={() => setHistory(null)} />}
    </>
  );
}
