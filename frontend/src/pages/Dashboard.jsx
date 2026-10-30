import { Link } from 'react-router-dom';
import { BarChart, DoughnutChart, LineChart, Panel } from '../components/Charts';
import { Alert, Badge, DataTable, formatDate, PageHeader, rupees, Spinner, StatCard } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';

const monthLabel = (month) => new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

function MonthlyLoans({ months }) {
  return (
    <Panel title="Books issued per month" empty={!months.length}>
      <LineChart label="Issued" labels={months.map((m) => monthLabel(m.month))} values={months.map((m) => m.issued)} />
    </Panel>
  );
}

function AdminDashboard({ d }) {
  return (
    <>
      <div className="stat-grid">
        <StatCard icon="mortarboard" label="Active students" value={d.counts.students} />
        <StatCard icon="book" label={`Titles (${d.counts.copies} copies)`} value={d.counts.titles} />
        <StatCard icon="journal-arrow-up" label="Books on loan" value={d.loans.open_loans} tone="success" />
        <StatCard icon="alarm" label="Overdue" value={d.loans.overdue} tone="danger" />
        <StatCard icon="cash-coin" label="Fines collected" value={rupees(d.money.collected)} tone="success" />
        <StatCard icon="hourglass-split" label="Fines pending" value={rupees(d.money.pending)} tone="warning" />
      </div>
      <div className="chart-grid">
        <MonthlyLoans months={d.months} />
        <Panel title="Fine status" empty={!d.fineStatus.length}>
          <DoughnutChart labels={d.fineStatus.map((f) => f.status.replace('_', ' '))} values={d.fineStatus.map((f) => f.count)} />
        </Panel>
        <Panel title="Loans by category" empty={!d.categories.length}>
          <BarChart label="Loans" labels={d.categories.map((c) => c.name)} values={d.categories.map((c) => c.loans)} />
        </Panel>
        <Panel title="Most borrowed books" empty={!d.topBooks.length}>
          <BarChart horizontal label="Loans" labels={d.topBooks.map((b) => (b.title.length > 26 ? `${b.title.slice(0, 26)}…` : b.title))} values={d.topBooks.map((b) => b.loans)} />
        </Panel>
      </div>
    </>
  );
}

function LibrarianDashboard({ d }) {
  const columns = [
    { label: 'Student', render: (r) => r.student_name },
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Due', render: (r) => formatDate(r.due_date) },
    { label: 'Days late', render: (r) => r.days_late },
  ];
  return (
    <>
      <div className="stat-grid">
        <StatCard icon="journal-arrow-up" label="Issued today" value={d.activity.issued_today} />
        <StatCard icon="journal-arrow-down" label="Returned today" value={d.activity.returned_today} tone="success" />
        <StatCard icon="alarm" label="Overdue" value={d.loans.overdue} tone="danger" />
        <StatCard icon="hourglass-split" label="Due in 3 days" value={d.loans.due_soon} tone="warning" />
        <StatCard icon="cash-coin" label="Fines pending" value={rupees(d.pendingFines)} tone="warning" />
      </div>
      <div className="chart-grid">
        <MonthlyLoans months={d.months} />
        <div>
          <h2 className="fs-6 fw-semibold">Longest overdue</h2>
          <DataTable columns={columns} rows={d.overdue} rowKey="issue_id" empty="Nothing is overdue" />
        </div>
      </div>
    </>
  );
}

function StudentDashboard({ d }) {
  const columns = [
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Due', render: (r) => formatDate(r.due_date) },
    { label: 'Status', render: (r) => <Badge value={r.loan_state} /> },
  ];
  const onTime = d.totals.total ? Math.round(((d.totals.total - d.totals.late) / d.totals.total) * 100) : null;
  return (
    <>
      <div className="stat-grid">
        <StatCard icon="journal-bookmark" label={`Books held (limit ${d.maxBooks})`} value={d.loans.length} />
        <StatCard icon="cash-coin" label="Pending fines" value={rupees(d.pendingFines)} tone="warning" />
        <StatCard icon="clock-history" label="Books returned" value={d.totals.total} tone="success" />
        <StatCard icon="check2-circle" label="On-time returns" value={onTime === null ? '—' : `${onTime}%`} tone="success" />
      </div>
      <div className="chart-grid">
        <div>
          <div className="d-flex justify-content-between">
            <h2 className="fs-6 fw-semibold">Current loans</h2>
            <Link className="small" to="/my-loans">See fine estimates</Link>
          </div>
          <DataTable columns={columns} rows={d.loans} rowKey="issue_id" empty="You have no books on loan" />
        </div>
        <Panel title="What you borrow" empty={!d.categories.length}>
          <DoughnutChart labels={d.categories.map((c) => c.name)} values={d.categories.map((c) => c.loans)} />
        </Panel>
      </div>
    </>
  );
}

const VIEWS = {
  ADMIN: ['/dashboard/admin', AdminDashboard],
  LIBRARIAN: ['/dashboard/librarian', LibrarianDashboard],
  STUDENT: ['/dashboard/student', StudentDashboard],
};

export default function Dashboard() {
  const { user } = useAuth();
  const [path, View] = VIEWS[user.role];
  const { data, error, loading } = useFetch(path);
  return (
    <>
      <PageHeader title={`Welcome, ${user.fullName.split(' ')[0]}`} subtitle="Here is what is happening in the library" />
      <Alert>{error}</Alert>
      {loading && !data ? <Spinner /> : data && <View d={data} />}
    </>
  );
}
