import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import TeacherDashboard from '@/components/dashboard/TeacherDashboard';
import ParentDashboard from '@/components/dashboard/ParentDashboard';

const Dashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">در حال بارگذاری...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Handle case where user has no role assigned
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">نقش کاربری تعیین نشده</h2>
          <p className="text-muted-foreground">لطفاً با مدیر سیستم تماس بگیرید تا نقش شما مشخص شود.</p>
          <p className="text-sm text-muted-foreground">شناسه کاربری: {user.id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {userRole === 'admin' && <AdminDashboard />}
      {userRole === 'teacher' && <TeacherDashboard />}
      {userRole === 'parent' && <ParentDashboard />}
      {userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'parent' && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">نقش نامعتبر</h2>
            <p className="text-muted-foreground">نقش "{userRole}" شناسایی نشد.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
