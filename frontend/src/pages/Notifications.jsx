import { DataTable, formatDate, PageHeader } from '../components/Common';
import { useList } from '../hooks/useFetch';
import api from '../services/api';

export default function Notifications() {
  const list = useList('/notifications');

  async function markRead(note) {
    await api.patch(`/notifications/${note.id}/read`);
    list.reload();
  }

  async function markAll() {
    await api.patch('/notifications/read-all');
    list.reload();
  }

  const columns = [
    { label: 'Message', render: (n) => <span className={n.is_read ? 'text-muted' : ''}><strong>{n.title}</strong><small>{n.message}</small></span> },
    { label: 'Date', render: (n) => formatDate(n.created_at) },
    { label: 'Status', render: (n) => (n.is_read ? 'Read' : <button type="button" className="btn btn-sm btn-light" onClick={() => markRead(n)}>Mark read</button>) },
  ];

  return (
    <>
      <PageHeader title="Notifications" subtitle={list.data ? `${list.data.unread} unread` : ''}>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={markAll}>Mark all as read</button>
      </PageHeader>
      <DataTable columns={columns} list={list} empty="No notifications" />
    </>
  );
}
