import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';

const MENUS = {
  ADMIN: [
    ['/', 'speedometer2', 'Dashboard'], ['/students', 'mortarboard', 'Students'], ['/librarians', 'person-badge', 'Librarians'],
    ['/books', 'book', 'Books'], ['/catalog', 'tags', 'Categories & Authors'], ['/circulation', 'arrow-left-right', 'Issue & Return'],
    ['/overdue', 'alarm', 'Overdue'], ['/fines', 'cash-coin', 'Fines & Payments'], ['/fine-rules', 'sliders', 'Fine Rules'],
    ['/ml-reports', 'graph-up-arrow', 'ML Reports'], ['/reports', 'file-earmark-text', 'Reports'],
  ],
  LIBRARIAN: [
    ['/', 'speedometer2', 'Dashboard'], ['/circulation', 'arrow-left-right', 'Issue & Return'], ['/books', 'book', 'Books'],
    ['/overdue', 'alarm', 'Overdue'], ['/students', 'mortarboard', 'Students'], ['/fines', 'cash-coin', 'Fines & Payments'],
    ['/reports', 'file-earmark-text', 'Reports'],
  ],
  STUDENT: [
    ['/', 'speedometer2', 'Dashboard'], ['/books', 'search', 'Search Books'], ['/my-loans', 'journal-bookmark', 'My Loans'],
    ['/history', 'clock-history', 'History'], ['/my-fines', 'cash-coin', 'My Fines'],
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: inbox } = useFetch('/notifications', { limit: 1 });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><i className="bi bi-book-half" /></span>Smart Library</div>
        <nav className="side-nav">
          {MENUS[user.role].map(([path, icon, label]) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)}>
              <i className={`bi bi-${icon}`} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="side-user"><strong>{user.fullName}</strong>{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</div>
      </aside>
      <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-toggle" aria-label="Open menu" onClick={() => setOpen(true)}><i className="bi bi-list" /></button>
          <span />
          <div className="d-flex align-items-center gap-1">
            <Link className="icon-btn" to="/notifications" aria-label="Notifications">
              <i className="bi bi-bell" />
              {inbox?.unread > 0 && <span className="count-dot">{inbox.unread}</span>}
            </Link>
            <Link className="icon-btn" to="/profile" aria-label="Profile"><i className="bi bi-person-circle" /></Link>
            <button type="button" className="icon-btn" aria-label="Log out" onClick={() => { logout(); navigate('/login'); }}><i className="bi bi-box-arrow-right" /></button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
