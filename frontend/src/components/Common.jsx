import { useEffect, useState } from 'react';
import api, { downloadFile, errorMessage } from '../services/api';

export const rupees = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (value) => (value
  ? new Date(String(value).slice(0, 10)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

const BADGES = {
  ACTIVE: 'success', RETURNED: 'secondary', DUE_SOON: 'warning', OVERDUE: 'danger',
  UNPAID: 'danger', PARTIALLY_PAID: 'warning', PAID: 'success', WAIVED: 'secondary',
};

export function Badge({ value }) {
  return <span className={`status-badge status-${BADGES[value] || 'secondary'}`}>{String(value).replace('_', ' ')}</span>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

export function Alert({ type = 'danger', children }) {
  return children ? <div className={`alert alert-${type} py-2`} role="alert">{children}</div> : null;
}

export function Spinner() {
  return <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>;
}

export function StatCard({ icon, label, value, tone = 'primary' }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon tone-${tone}`}><i className={`bi bi-${icon}`} /></span>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search' }) {
  return (
    <div className="search-box">
      <i className="bi bi-search" />
      <input className="form-control" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// columns: [{ label, render(row) }]; pass a useList result as list, or plain rows.
export function DataTable({ columns, list, rows, rowKey = 'id', empty = 'No records found' }) {
  const items = rows || list?.data?.items || [];
  if (list?.loading && !list.data) return <Spinner />;
  return (
    <>
      <Alert>{list?.error}</Alert>
      <div className="table-card">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row[rowKey]}>{columns.map((c) => <td key={c.label}>{c.render(row)}</td>)}</tr>
              ))}
              {!items.length && <tr><td colSpan={columns.length} className="empty-row">{empty}</td></tr>}
            </tbody>
          </table>
        </div>
        {list?.data?.pages > 1 && (
          <div className="table-footer">
            <span>Page {list.data.page} of {list.data.pages} · {list.data.total} records</span>
            <div className="btn-group">
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>Previous</button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={list.page >= list.data.pages} onClick={() => list.setPage(list.page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

// fields: [{ name, label, type, required, options:[{value,label}], hint }]
export function FormModal({ title, fields, initial = {}, submitLabel = 'Save', onSubmit, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(
    fields.map((f) => [f.name, initial[f.name] ?? (f.type === 'multiselect' ? [] : '')]),
  ));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <Alert>{error}</Alert>
          {fields.map((f) => (
            <div className="mb-3" key={f.name}>
              <label className="form-label" htmlFor={f.name}>{f.label}</label>
              {f.type === 'select' && (
                <select id={f.name} className="form-select" required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">{f.placeholder || 'Select'}</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {f.type === 'multiselect' && (
                <select id={f.name} className="form-select" multiple size={6} required={f.required} value={values[f.name].map(String)} onChange={(e) => set(f.name, [...e.target.selectedOptions].map((o) => Number(o.value)))}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {f.type === 'textarea' && (
                <textarea id={f.name} className="form-control" rows={3} required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              )}
              {!['select', 'multiselect', 'textarea'].includes(f.type) && (
                <input id={f.name} className="form-control" type={f.type || 'text'} step={f.step} min={f.min} required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
              )}
              {f.hint && <div className="form-text">{f.hint}</div>}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

// Type-to-search picker for choosing a student, book or loan.
export function Picker({ label, path, params, value, onChange, toOption, placeholder }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (value) return undefined;
    const timer = setTimeout(() => {
      api.get(path, { params: { ...JSON.parse(key), search, limit: 8 } })
        .then(({ data }) => setOptions(data.data.items.map(toOption)))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, path, key, value]);

  return (
    <div className="mb-3 picker">
      <label className="form-label">{label}</label>
      {value ? (
        <div className="picked">
          <div><strong>{value.title}</strong><small>{value.subtitle}</small></div>
          <button type="button" className="btn btn-sm btn-light" onClick={() => { onChange(null); setSearch(''); }}>Change</button>
        </div>
      ) : (
        <>
          <input className="form-control" value={search} placeholder={placeholder} aria-label={label} onChange={(e) => setSearch(e.target.value)} />
          <div className="picker-list">
            {options.map((o) => (
              <button type="button" key={o.id} onClick={() => onChange(o)}>
                <strong>{o.title}</strong><small>{o.subtitle}</small>
              </button>
            ))}
            {!options.length && <div className="picker-empty">No matches</div>}
          </div>
        </>
      )}
    </div>
  );
}

export function ExportButtons({ type, params }) {
  const [failed, setFailed] = useState(false);
  const download = (format) => {
    setFailed(false);
    downloadFile(`/reports/${type}`, { ...params, format }, `${type}-report.${format}`).catch(() => setFailed(true));
  };
  return (
    <>
      {failed && <span className="text-danger small me-2">Export failed</span>}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => download('pdf')}><i className="bi bi-file-earmark-pdf me-1" />PDF</button>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => download('xlsx')}><i className="bi bi-file-earmark-excel me-1" />Excel</button>
    </>
  );
}
