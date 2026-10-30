import { useState } from 'react';
import { Alert, Badge, DataTable, formatDate, PageHeader, Picker, rupees, SearchBox } from '../components/Common';
import { useList } from '../hooks/useFetch';
import api, { errorMessage } from '../services/api';

const studentOption = (s) => ({ id: s.id, title: s.user.full_name, subtitle: `${s.enrollment_no} · ${s.course}` });
const bookOption = (b) => ({ id: b.id, title: b.title, subtitle: `${b.category.name} · ${b.available_copies} available` });
const loanOption = (l) => ({ id: l.issue_id, title: l.book_title, subtitle: `${l.student_name} · due ${formatDate(l.due_date)}` });

export default function Circulation() {
  const list = useList('/issues', { state: 'OPEN' });
  const [student, setStudent] = useState(null);
  const [book, setBook] = useState(null);
  const [loan, setLoan] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function run(action) {
    setError('');
    setResult(null);
    try {
      await action();
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const issue = () => run(async () => {
    const { data } = await api.post('/issues', { bookId: book.id, studentId: student.id });
    setResult(`${book.title} issued to ${student.title}. Due on ${formatDate(data.data.dueDate)}.`);
    setBook(null);
    setStudent(null);
  });

  const accept = () => run(async () => {
    const { data } = await api.post('/returns', { issueId: loan.id, remarks: remarks || null });
    const { fineAmount, lateDays } = data.data;
    setResult(fineAmount > 0
      ? `Returned ${lateDays} day(s) late. Fine added: ${rupees(fineAmount)}.`
      : 'Returned. No fine is due.');
    setLoan(null);
    setRemarks('');
  });

  const columns = [
    { label: 'Student', render: (r) => <>{r.student_name}<small>{r.enrollment_no}</small></> },
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Issued', render: (r) => formatDate(r.issue_date) },
    { label: 'Due', render: (r) => formatDate(r.due_date) },
    { label: 'State', render: (r) => <Badge value={r.loan_state} /> },
    { label: 'Accrued fine', render: (r) => (r.accrued_fine ? rupees(r.accrued_fine) : '—') },
  ];

  return (
    <>
      <PageHeader title="Issue & Return" subtitle="Due dates and fines are calculated automatically from the fine rules" />
      <Alert>{error}</Alert>
      <Alert type="success">{result}</Alert>
      <div className="chart-grid">
        <div className="panel">
          <h2>Issue a book</h2>
          <Picker label="Student" path="/students" params={{ status: 'active' }} value={student} onChange={setStudent} toOption={studentOption} placeholder="Search name or enrollment" />
          <Picker label="Book" path="/books" params={{ availability: 'available', status: 'active' }} value={book} onChange={setBook} toOption={bookOption} placeholder="Search title or author" />
          <button type="button" className="btn btn-primary" disabled={!student || !book} onClick={issue}>Issue book</button>
        </div>
        <div className="panel">
          <h2>Accept a return</h2>
          <Picker label="Loan" path="/issues" params={{ state: 'OPEN' }} value={loan} onChange={setLoan} toOption={loanOption} placeholder="Search student or book" />
          <div className="mb-3">
            <label className="form-label" htmlFor="remarks">Remarks (optional)</label>
            <input id="remarks" className="form-control" maxLength={255} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" disabled={!loan} onClick={accept}>Accept return</button>
        </div>
      </div>
      <div className="filter-bar mt-2">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search loans" />
        <select className="form-select" aria-label="Loan state" value={list.filters.state} onChange={(e) => list.setFilter('state', e.target.value)}>
          <option value="OPEN">Books on loan</option>
          <option value="OVERDUE">Overdue</option>
          <option value="DUE_SOON">Due soon</option>
          <option value="RETURNED">Returned</option>
          <option value="">All loans</option>
        </select>
      </div>
      <DataTable columns={columns} list={list} rowKey="issue_id" />
    </>
  );
}
