// DashboardLayout.jsx — Fixed: all hooks declared before any early return
import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getMe, getHrMe, getMyFeedback } from '../api/api';
import { FiLoader } from 'react-icons/fi';

export default function DashboardLayout() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const role = location.pathname.startsWith('/recruiter') ? 'recruiter' : 'candidate';

  // HOOK 1: Fetch user data on mount / role change
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        let data;
        if (role === 'candidate') {
          if (!localStorage.getItem('token')) {
            navigate('/candidate/login', { replace: true });
            return;
          }
          data = await getMe();
        } else if (role === 'recruiter') {
          if (!localStorage.getItem('hr_token')) {
            navigate('/recruiter/login', { replace: true });
            return;
          }
          data = await getHrMe();
        }
        setUserData(data);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        if (role === 'candidate') {
          localStorage.removeItem('token');
          navigate('/candidate/login', { replace: true });
        } else if (role === 'recruiter') {
          localStorage.removeItem('hr_token');
          navigate('/recruiter/login', { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [role, navigate]);

  // HOOK 2: Poll unread feedback count (candidates only)
  useEffect(() => {
    if (role !== 'candidate') return;
    const STORAGE_KEY = 'xcalibr_last_read_feedback';
    const checkFeedback = async () => {
      try {
        const feedbackList = await getMyFeedback();
        const lastRead = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
        const unread = feedbackList.filter(f => f.feedbackid > lastRead).length;
        setUnreadFeedbackCount(unread);
      } catch { /* silent */ }
    };
    checkFeedback();
    const interval = setInterval(checkFeedback, 30000);
    return () => clearInterval(interval);
  }, [role]);

  // HOOK 3: Clear badge when visiting /candidate/feedback
  useEffect(() => {
    if (location.pathname === '/candidate/feedback' && unreadFeedbackCount > 0) {
      getMyFeedback()
        .then(list => {
          if (list.length > 0) {
            const maxId = Math.max(...list.map(f => f.feedbackid));
            localStorage.setItem('xcalibr_last_read_feedback', String(maxId));
          }
          setUnreadFeedbackCount(0);
        })
        .catch(() => {});
    }
  }, [location.pathname]); // eslint-disable-line

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <FiLoader className="animate-spin text-3xl text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={role} userData={userData} unreadFeedbackCount={unreadFeedbackCount} />
      <main className="flex-grow p-4 md:p-8 overflow-y-auto">
        <Outlet context={{ role, user: userData }} />
      </main>
    </div>
  );
}
