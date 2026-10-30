import { useState } from 'react';
import { Alert, PageHeader } from '../components/Common';
import { useAuth } from '../context/AuthContext';
import api, { errorMessage } from '../services/api';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [details, setDetails] = useState({ fullName: user.fullName, phone: user.phone || '', address: user.student?.address || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function run(action, success) {
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const saveDetails = (event) => {
    event.preventDefault();
    run(async () => {
      const { data } = await api.put('/auth/profile', details);
      setUser(data.data);
    }, 'Profile saved');
  };

  const savePassword = (event) => {
    event.preventDefault();
    run(async () => {
      await api.put('/auth/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
    }, 'Password changed');
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle={user.email} />
      <Alert>{error}</Alert>
      <Alert type="success">{message}</Alert>
      <div className="chart-grid">
        <form className="panel" onSubmit={saveDetails}>
          <h2>Details</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="fullName">Full name</label>
            <input id="fullName" className="form-control" required value={details.fullName} onChange={(e) => setDetails({ ...details, fullName: e.target.value })} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" className="form-control" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
          </div>
          {user.student && (
            <>
              <div className="mb-3">
                <label className="form-label" htmlFor="address">Address</label>
                <input id="address" className="form-control" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
              </div>
              <p className="small text-muted">{user.student.enrollment_no} · {user.student.course} · Semester {user.student.semester}</p>
            </>
          )}
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
        <form className="panel" onSubmit={savePassword}>
          <h2>Change password</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="currentPassword">Current password</label>
            <input id="currentPassword" type="password" className="form-control" autoComplete="current-password" required value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="newPassword">New password</label>
            <input id="newPassword" type="password" className="form-control" autoComplete="new-password" required value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
            <div className="form-text">8+ characters with upper case, lower case and a number</div>
          </div>
          <button type="submit" className="btn btn-primary">Change password</button>
        </form>
      </div>
    </>
  );
}
