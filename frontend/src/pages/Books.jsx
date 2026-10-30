import { useState } from 'react';
import { Alert, DataTable, FormModal, PageHeader, SearchBox } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useFetch, useList } from '../hooks/useFetch';
import api, { errorMessage } from '../services/api';

export default function Books() {
  const { user } = useAuth();
  const canManage = user.role !== 'STUDENT';
  const list = useList('/books', { categoryId: '', availability: '' });
  const { data: categories } = useFetch('/categories');
  const { data: authors } = useFetch('/authors');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const fields = [
    { name: 'title', label: 'Title', required: true },
    { name: 'isbn', label: 'ISBN', required: true },
    { name: 'categoryId', label: 'Category', type: 'select', required: true, options: (categories || []).map((c) => ({ value: c.id, label: c.name })) },
    { name: 'authorIds', label: 'Authors', type: 'multiselect', required: true, hint: 'Hold Ctrl to choose more than one', options: (authors || []).map((a) => ({ value: a.id, label: a.name })) },
    { name: 'totalCopies', label: 'Total copies', type: 'number', min: 0, required: true },
    { name: 'publisher', label: 'Publisher' },
    { name: 'publicationYear', label: 'Publication year', type: 'number' },
    { name: 'shelfLocation', label: 'Shelf location' },
  ];

  async function save(values) {
    if (form.id) await api.put(`/books/${form.id}`, values);
    else await api.post('/books', values);
    list.reload();
  }

  async function toggle(book) {
    setError('');
    try {
      await api.patch(`/books/${book.id}/status`, { isActive: !book.is_active });
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns = [
    { label: 'Title', render: (b) => <>{b.title}<small>{b.authors.map((a) => a.name).join(', ')}</small></> },
    { label: 'Category', render: (b) => b.category.name },
    { label: 'Available', render: (b) => <span className={`status-badge status-${b.available_copies ? 'success' : 'danger'}`}>{b.available_copies} of {b.total_copies}</span> },
    { label: 'Shelf', render: (b) => b.shelf_location || '—' },
  ];
  if (canManage) {
    columns.splice(1, 0, { label: 'ISBN', render: (b) => b.isbn });
    columns.push({
      label: 'Actions',
      render: (b) => (
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={() => setForm({
              id: b.id,
              title: b.title,
              isbn: b.isbn,
              categoryId: b.category_id,
              authorIds: b.authors.map((a) => a.id),
              totalCopies: b.total_copies,
              publisher: b.publisher,
              publicationYear: b.publication_year,
              shelfLocation: b.shelf_location,
            })}
          >
            Edit
          </button>
          <button type="button" className="btn btn-sm btn-light" onClick={() => toggle(b)}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
        </div>
      ),
    });
  }

  return (
    <>
      <PageHeader title={canManage ? 'Books' : 'Search Books'} subtitle="Find titles by name, author or ISBN">
        {canManage && <button type="button" className="btn btn-primary" onClick={() => setForm({ authorIds: [] })}><i className="bi bi-plus-lg me-1" />Add book</button>}
      </PageHeader>
      <Alert>{error}</Alert>
      <div className="filter-bar">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search title, author or ISBN" />
        <select className="form-select" aria-label="Category" value={list.filters.categoryId} onChange={(e) => list.setFilter('categoryId', e.target.value)}>
          <option value="">All categories</option>
          {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" aria-label="Availability" value={list.filters.availability} onChange={(e) => list.setFilter('availability', e.target.value)}>
          <option value="">Any availability</option>
          <option value="available">Available now</option>
          <option value="unavailable">All copies out</option>
        </select>
      </div>
      <DataTable columns={columns} list={list} />
      {form && <FormModal title={form.id ? 'Edit book' : 'Add book'} fields={fields} initial={form} onSubmit={save} onClose={() => setForm(null)} />}
    </>
  );
}
