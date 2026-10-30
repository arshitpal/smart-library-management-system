import { Badge, DataTable, formatDate, PageHeader, rupees } from '../components/Common';
import { useList } from '../hooks/useFetch';

export default function MyFines() {
  const list = useList('/fines/mine', { status: '' });
  const columns = [
    { label: 'Book', render: (f) => f.book_title },
    { label: 'Returned', render: (f) => formatDate(f.return_date) },
    { label: 'Days late', render: (f) => f.late_days },
    { label: 'Fine', render: (f) => rupees(f.amount) },
    { label: 'Paid', render: (f) => rupees(f.paid_amount) },
    { label: 'Waived', render: (f) => rupees(f.waived_amount) },
    { label: 'Balance', render: (f) => <strong>{rupees(f.balance)}</strong> },
    { label: 'Status', render: (f) => <Badge value={f.status} /> },
  ];
  return (
    <>
      <PageHeader title="My Fines" subtitle="Pay pending fines at the library counter" />
      <DataTable columns={columns} list={list} rowKey="fine_id" empty="You have no fines" />
    </>
  );
}
