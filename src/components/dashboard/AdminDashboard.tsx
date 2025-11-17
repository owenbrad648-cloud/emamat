import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Users, GraduationCap, School, FileText, AlertTriangle, Book } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { faIR } from 'date-fns/locale';
import TeachersManagement from './admin/TeachersManagement';
import ClassesManagement from './admin/ClassesManagement';
import StudentsManagement from './admin/StudentsManagement';
import AttendanceReports from './admin/AttendanceReports';
import DisciplineReports from './admin/DisciplineReports';
import EvaluationsReports from './admin/EvaluationsReports';
import SubjectsManagement from './admin/SubjectsManagement';
const toPersianDigits = (num: string) => num.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);


const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('teachers');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Define background and icon colors for tabs
  const tabStyles = {
    teachers: { bg: 'bg-orange-100 dark:bg-orange-900', iconColor: 'text-blue-600 dark:text-blue-300' },
    subjects: { bg: 'bg-purple-100 dark:bg-purple-900', iconColor: 'text-purple-600 dark:text-purple-300' },
    classes: { bg: 'bg-green-100 dark:bg-green-900', iconColor: 'text-green-600 dark:text-green-300' },
    students: { bg: 'bg-orange-100 dark:bg-orange-900', iconColor: 'text-orange-600 dark:text-orange-300' },
    attendance: { bg: 'bg-indigo-100 dark:bg-indigo-900', iconColor: 'text-indigo-600 dark:text-indigo-300' },
    discipline: { bg: 'bg-red-100 dark:bg-red-900', iconColor: 'text-red-600 dark:text-red-300' },
    evaluations: { bg: 'bg-emerald-100 dark:bg-emerald-900', iconColor: 'text-emerald-600 dark:text-emerald-300' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
           <div className="flex items-center gap-2">
              
              <Button onClick={signOut} variant="destructive" className="gap-2">
                <LogOut className="w-4 h-4" />
                خروج
              </Button>
            </div>
            <div>
              <h1 className="text-2xl font-bold">پنل مدیریت</h1>
              <p className="text-sm text-muted-foreground">هنرستان امامت</p>
            </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <School className="w-6 h-6 text-primary-foreground" />
            </div>
            
          </div>
           
            
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" dir="rtl">
          {/* --- MODIFICATION: Adjusted TabsList styling --- */}
<TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 h-auto p-1 bg-transparent shadow-none gap-2">
            {/* --- MODIFICATION: Wrapped content in styled div --- */}
            <TabsTrigger value="teachers" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring"> {/* Reset padding, add active styles */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.teachers.bg}`}>
                <Users className={`w-4 h-4 ${tabStyles.teachers.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">معلم‌ها</span> {/* Ensure text color contrasts */}
              </div>
            </TabsTrigger>
             <TabsTrigger value="subjects" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.subjects.bg}`}>
                <Book className={`w-4 h-4 ${tabStyles.subjects.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">درس‌ها</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="classes" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.classes.bg}`}>
                <School className={`w-4 h-4 ${tabStyles.classes.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">کلاس‌ها</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="students" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.students.bg}`}>
                <GraduationCap className={`w-4 h-4 ${tabStyles.students.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">دانش‌آموزان</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.attendance.bg}`}>
                <FileText className={`w-4 h-4 ${tabStyles.attendance.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">حضور و غیاب</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="discipline" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.discipline.bg}`}>
                <AlertTriangle className={`w-4 h-4 ${tabStyles.discipline.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">موارد انضباطی</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="evaluations" className="p-0 data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-primary rounded-lg focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring">
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-md shadow-md w-full h-full ${tabStyles.evaluations.bg}`}>
                <FileText className={`w-4 h-4 ${tabStyles.evaluations.iconColor}`} />
                <span className="text-foreground text-xs sm:text-sm">ارزشیابی</span>
              </div>
            </TabsTrigger>
            {/* --- END MODIFICATION --- */}
          </TabsList>

          <TabsContent value="teachers"><TeachersManagement /></TabsContent>
          <TabsContent value="subjects"><SubjectsManagement /></TabsContent>
          <TabsContent value="classes"><ClassesManagement /></TabsContent>
          <TabsContent value="students"><StudentsManagement /></TabsContent>
          <TabsContent value="attendance"><AttendanceReports /></TabsContent>
          <TabsContent value="discipline"><DisciplineReports /></TabsContent>
              <TabsContent value="evaluations"><EvaluationsReports /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;

