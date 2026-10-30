import { DataTable, ExportButtons, formatDate, PageHeader, rupees, SearchBox } from '../components/Common';
import { useList } from '../hooks/useFetch';

export default function Overdue() {
  const list = useList('/issues/overdue');
  const columns = [
    { label: 'Student', render: (r) => <>{r.student_name}<small>{r.enrollment_no}</small></> },
    { label: 'Book', render: (r) => r.book_title },
    { label: 'Due', render: (r) => formatDate(r.due_date) },
    { label: 'Days late', render: (r) => r.days_late },
    { label: 'Accrued fine', render: (r) => rupees(r.accrued_fine) },
  ];
  return (
    <>
      <PageHeader title="Overdue Books" subtitle="The accrued amount becomes the actual fine when the book is returned">
        <ExportButtons type="overdue" />
      </PageHeader>
      <div className="filter-bar">
        <SearchBox value={list.filters.search} onChange={(v) => list.setFilter('search', v)} placeholder="Search student or book" />
      </div>
      <DataTable columns={columns} list={list} rowKey="issue_id" empty="Nothing is overdue" />
    </>
  );
}
