import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { GraduationCap } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!username || !password) {
        toast.error('لطفاً نام کاربری و رمز عبور را وارد کنید');
        return;
      }

      // First check if user exists in profiles
      console.debug('Login: fetching profile for username', username);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .maybeSingle();

      console.debug('Login: profile response', { profile, profileError });

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast.error('خطا در بررسی اطلاعات کاربری: ' + (profileError.message ?? profileError.toString()));
        return;
      }

      if (!profile?.email) {
        toast.error('کاربری با این نام کاربری یافت نشد');
        return;
      }

      // Then try to sign in
      console.debug('Login: attempting signInWithPassword for', profile.email);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });

      console.debug('Login: sign-in response', { data, signInError });

      if (signInError) {
        console.error('Sign in error:', signInError);
        const msg = signInError?.message ?? JSON.stringify(signInError);
        if (typeof msg === 'string' && msg.includes('Invalid login credentials')) {
          toast.error('رمز عبور اشتباه است');
        } else {
          toast.error('خطا در ورود: ' + msg);
        }
        return;
      }

      if (!data?.user) {
        console.error('Sign in succeeded but no user object returned', data);
        toast.error('خطا در دریافت اطلاعات کاربری پس از ورود');
        return;
      }

      toast.success('ورود موفقیت‌آمیز بود');
      navigate('/dashboard');
    } catch (error) {
      console.error('Unexpected error during login:', error);
      toast.error('خطای غیرمنتظره در ورود');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username,
            // The role will be set to 'parent' by default in the trigger if not specified
          },
        },
      });

      if (signUpError) {
        toast.error(`خطا در ثبت‌نام: ${signUpError.message}`);
      } else {
        toast.success('ثبت‌نام موفقیت‌آمیز بود. لطفاً ایمیل خود را برای فعال‌سازی حساب کاربری چک کنید.');
      }
    } catch (error: any) {
      toast.error(`خطا در ثبت‌نام: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 via-red-50 to-red-200 p-4">
  <Card className="w-full max-w-md shadow-xl border border-red-200">
    <CardHeader className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-600 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
        <GraduationCap className="w-9 h-9 text-white" />
      </div>
      <CardTitle className="text-3xl font-bold text-red-700">
       سیستم مدیریت <p>هنرستان امامت </p> 
      </CardTitle>
      <CardDescription className="text-red-500">
        برای ورود به پنل خود، اطلاعات را وارد کنید
      </CardDescription>
    </CardHeader>

    <CardContent>
      <Tabs defaultValue="login" className="w-full" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 bg-red-100 text-red-700 rounded-xl">
          <TabsTrigger
            value="login"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-lg"
          >
            ورود
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-lg"
          >
            ثبت‌نام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-red-700">نام کاربری</Label>
              <Input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                dir="rtl"
                className="text-right border-red-300 focus-visible:ring-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-red-700">رمز عبور</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="rtl"
                className="text-right border-red-300 focus-visible:ring-red-600"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'در حال ورود...' : 'ورود'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSignup} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="signup-fullname" className="text-red-700">نام کامل</Label>
              <Input
                id="signup-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                dir="rtl"
                className="text-right border-red-300 focus-visible:ring-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-red-700">ایمیل</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="text-left border-red-300 focus-visible:ring-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-username" className="text-red-700">نام کاربری</Label>
              <Input
                id="signup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                dir="rtl"
                className="text-right border-red-300 focus-visible:ring-red-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-red-700">رمز عبور</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-right border-red-300 focus-visible:ring-red-600"
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</div>

  );
};

export default Login;

