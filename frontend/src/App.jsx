import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/Common';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Books from './pages/Books';
import Catalog from './pages/Catalog';
import Circulation from './pages/Circulation';
import Dashboard from './pages/Dashboard';
import FineRules from './pages/FineRules';
import Fines from './pages/Fines';
import Librarians from './pages/Librarians';
import Login from './pages/Login';
import MlReports from './pages/MlReports';
import MyFines from './pages/MyFines';
import MyLoans from './pages/MyLoans';
import Notifications from './pages/Notifications';
import Overdue from './pages/Overdue';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Students from './pages/Students';

function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="books" element={<Books />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />

          <Route element={<ProtectedRoute roles={['ADMIN', 'LIBRARIAN']} />}>
            <Route path="students" element={<Students />} />
            <Route path="circulation" element={<Circulation />} />
            <Route path="overdue" element={<Overdue />} />
            <Route path="fines" element={<Fines />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="librarians" element={<Librarians />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="fine-rules" element={<FineRules />} />
            <Route path="ml-reports" element={<MlReports />} />
          </Route>

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route path="my-loans" element={<MyLoans view="current" />} />
            <Route path="history" element={<MyLoans view="history" />} />
            <Route path="my-fines" element={<MyFines />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
