import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth'; // <-- Correctly uses the updated useAuth
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
// ... other imports ...
import { LogOut, School, CheckCircle, XCircle, Clock, AlertTriangle, Calendar as CalendarIcon, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from "date-fns-jalali";
import { cn } from "@/lib/utils";
import {faIR} from 'date-fns-jalali/locale/fa-IR';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from 'sonner';


// ... (interfaces remain the same) ...
interface ClassSubject {
  id: string;
  classes: {
    id: string;
    name: string;
    grade: string;
  };
  subjects: {
    name: string;
  };
}

interface Student {
  id: string;
  full_name: string;
}

interface DisciplineRecord {
  id: string;
  description: string;
  severity: string;
  created_at: string;
  recorded_by: string;
  students: {
    full_name: string;
  } | null;
  profiles?: {
    full_name: string;
  } | null;
}

// Evaluation record for per-student daily evaluations
interface EvaluationRecord {
  id?: string;
  student_id: string;
  class_id: string;
  date: string; // yyyy-MM-dd
  homework_done: boolean;
  class_score: number | null;
  notes: string | null;
  recorded_by?: string | null;
  students?: { full_name: string } | null;
}

// Represents the status selected in the UI
type AttendanceUiStatus = Record<string, 'present' | 'absent' | 'late'>;

const toPersianDigits = (num: string) => num.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const safeFormatDate = (dateString: string | null | undefined, formatString: string) => {
  if (!dateString) return '-';
  try {
    const dateObj = parseISO(dateString);
    const formatted = format(dateObj, formatString);
    return toPersianDigits(formatted);
  } catch (e) {
    console.error("Error parsing date:", dateString, e);
    return 'تاریخ نامعتبر';
  }
};
const TeacherDashboard = () => {
  // *** Use the profile from the updated useAuth ***
  const { signOut, user, profile, loading: authLoading } = useAuth();
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string | undefined>();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceUiStatus, setAttendanceUiStatus] = useState<AttendanceUiStatus>({});
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [lessonPeriod, setLessonPeriod] = useState<string | undefined>();

  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<DisciplineRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [disciplineDesc, setDisciplineDesc] = useState('');
  const [severity, setSeverity] = useState('low');

  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Evaluations state: map by student id for editing convenience
  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, EvaluationRecord>>({});
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  // Keep an original snapshot to detect changes
  const [originalEvaluationsMap, setOriginalEvaluationsMap] = useState<Record<string, EvaluationRecord>>({});

  // *** Get teacher's full name directly from profile ***
  const teacherName = profile?.full_name;

  useEffect(() => {
    // Fetch class subjects only when user data is loaded and user exists
    if (!authLoading && user) {
        fetchTeacherClassSubjects();
    }
  }, [user, authLoading]); // Depend on authLoading as well

  // NOTE: fetchEvaluations depends on selectedClass and is declared later; effect is attached after function definition below.


  const selectedClass = useMemo(() => {
    return classSubjects.find(cs => cs.id === selectedClassSubjectId)?.classes;
  }, [classSubjects, selectedClassSubjectId]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassStudents(selectedClass.id);
      fetchDisciplineRecords(selectedClass.id);
    } else {
      setStudents([]);
      setAttendanceUiStatus({});
      setDisciplineRecords([]);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClassSubjectId && date && lessonPeriod && students.length > 0) {
      fetchAttendanceAndSetDefault();
    } else {
       setAttendanceUiStatus({});
    }
  }, [selectedClassSubjectId, date, lessonPeriod, students]);


  const fetchTeacherClassSubjects = async () => {
    if (!user) return;
    setLoadingClassSubjects(true);
    try {
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (teacherError) throw teacherError;
        if (!teacherData) throw new Error("اطلاعات معلم یافت نشد.");


        const { data, error } = await supabase
          .from('class_subjects')
          .select('id, classes(id, name, grade), subjects(name)')
          .eq('teacher_id', teacherData.id);

        if (error) throw error;
        setClassSubjects((data as ClassSubject[]) || []);

    } catch (error: any) {
         console.error("Error fetching teacher class subjects:", error);
         toast.error(error.message || 'خطا در بارگذاری کلاس‌های معلم');
         setClassSubjects([]); // Clear on error
    } finally {
        setLoadingClassSubjects(false);
    }
  };

  const fetchClassStudents = async (classId: string) => {
    setLoadingStudents(true);
    setAttendanceUiStatus({}); // Reset status when fetching new students
    try {
        const { data, error } = await supabase.from('students').select('id, full_name').eq('class_id', classId);
        if (error) throw error;

        setStudents(data || []);
        // Initialize status to 'present' for newly fetched students
        const initialStatus: AttendanceUiStatus = {};
        (data || []).forEach(student => {
          initialStatus[student.id] = 'present';
        });
        setAttendanceUiStatus(initialStatus);
    } catch (error: any) {
        console.error("Error fetching class students:", error);
        toast.error(error.message || "خطا در بارگذاری دانش آموزان کلاس");
        setStudents([]);
    } finally {
        setLoadingStudents(false);
    }
  };


  const fetchAttendanceAndSetDefault = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod || students.length === 0) return;
    setLoadingAttendance(true);
    const formattedDate = format(date, 'yyyy-MM-dd');
    try {
        const { data: dbAttendance, error } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('class_subject_id', selectedClassSubjectId)
          .eq('date', formattedDate)
          .eq('lesson_period', lessonPeriod)
          .in('status', ['absent', 'late']);

        if(error) throw error;

        const dbStatusMap = dbAttendance?.reduce((acc, record) => {
            if (record.status === 'absent' || record.status === 'late') {
               acc[record.student_id] = record.status;
            }
            return acc;
        }, {} as Record<string, 'absent' | 'late'>) || {};

        const initialStatus: AttendanceUiStatus = {};
        students.forEach(student => {
          initialStatus[student.id] = dbStatusMap[student.id] || 'present';
        });

        setAttendanceUiStatus(initialStatus);
    } catch (error: any) {
         console.error("Error fetching attendance records:", error);
         toast.error(error.message || "خطا در بارگذاری سوابق حضورغیاب");
         // Don't reset to empty on error, keep the 'present' defaults from fetchClassStudents
    } finally {
        setLoadingAttendance(false);
    }
  };


  const fetchDisciplineRecords = async (classId: string) => {
    try {
        if (!user?.id) {
            console.error("No user ID available");
            return;
        }

        const { data, error } = await supabase
            .from('discipline_records')
            .select('id, description, severity, created_at, recorded_by, students(full_name), profiles(full_name)')
            .eq('class_id', classId)
            .eq('recorded_by', user.id)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        setDisciplineRecords(data as DisciplineRecord[] || []);
    } catch (error: any) {
        console.error("Error fetching discipline records:", error);
        toast.error(error.message || "خطا در بارگذاری موارد انضباطی");
        setDisciplineRecords([]);
    }
  };

  // Fetch evaluations for the selected class and date (only teacher's own evaluations)
  const fetchEvaluations = async (classId: string, dateStr: string) => {
    try {
      if (!user?.id) return;
      setLoadingEvaluations(true);
      const { data, error } = await supabase
        .from('evaluations')
        .select('id, student_id, class_id, date, homework_done, class_score, notes, recorded_by, students(full_name)')
        .eq('class_id', classId)
        .eq('date', dateStr)
        .eq('recorded_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const map: Record<string, EvaluationRecord> = {};
      (data || []).forEach((r: any) => {
        map[r.student_id] = {
          id: r.id,
          student_id: r.student_id,
          class_id: r.class_id,
          date: r.date,
          homework_done: Boolean(r.homework_done),
          class_score: r.class_score ?? null,
          notes: r.notes ?? null,
          recorded_by: r.recorded_by ?? null,
          students: r.students ?? null,
        };
      });
      setEvaluationsMap(map);
      // Also keep an original snapshot for change detection
      setOriginalEvaluationsMap(map);
    } catch (error: any) {
      console.error('Error fetching evaluations:', error);
      toast.error(error.message || 'خطا در بارگذاری ارزشیابی‌ها');
      setEvaluationsMap({});
    } finally {
      setLoadingEvaluations(false);
    }
  };

  // Load evaluations when selected class or date changes
  useEffect(() => {
    if (selectedClass && date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      fetchEvaluations(selectedClass.id, dateStr);
    } else {
      setEvaluationsMap({});
      setOriginalEvaluationsMap({});
    }
  }, [selectedClass, date]);

 const handleAttendanceSubmit = async () => {
     if (!selectedClassSubjectId || !date || !lessonPeriod || students.length === 0) {
      toast.error('لطفاً کلاس، تاریخ، ساعت درسی را انتخاب کنید و منتظر بارگذاری دانش‌آموزان بمانید.');
      return;
    }
    setIsSubmitting(true);
    const formattedDate = format(date, 'yyyy-MM-dd');

    try {
    const { error: deleteError } = await supabase.from('attendance')
      .delete()
      .eq('class_subject_id', selectedClassSubjectId)
      .eq('date', formattedDate)
      .eq('lesson_period', parseInt(lessonPeriod!));

        if (deleteError) {
            console.error("Error deleting previous attendance:", deleteError);
            throw new Error('خطا در پاک کردن سوابق قبلی: ' + deleteError.message);
        }

        const recordsToInsert = Object.entries(attendanceUiStatus)
            .filter(([_, status]) => status === 'absent' || status === 'late')
            .map(([studentId, status]) => ({
                student_id: studentId,
                class_subject_id: selectedClassSubjectId,
                status: status!,
                date: formattedDate,
                lesson_period: parseInt(lessonPeriod!),
                recorded_by: user?.id,
                is_justified: false,
                medical_note_url: null,
                justification: null,
            }));

    if (recordsToInsert.length > 0) {
      // Use upsert with onConflict to avoid duplicate key errors if a record already exists.
      const insertRes = await supabase.from('attendance').upsert(recordsToInsert, { onConflict: 'student_id,class_subject_id,date,lesson_period' });
      if (insertRes.error) {
        console.error("Error inserting/upserting attendance:", insertRes.error);
        throw new Error('خطا در ثبت حضور و غیاب: ' + insertRes.error.message);
      }
    }

        toast.success(`حضور و غیاب ثبت شد (${recordsToInsert.length} مورد غیبت/تاخیر).`);

    } catch (error: any) {
        console.error("Attendance submission error:", error);
        toast.error(error.message || 'خطا در ثبت حضور و غیاب.');
    } finally {
        setIsSubmitting(false);
         // No need to refetch, state should be accurate unless error occurred
    }
};

  // Combined save: attendance + evaluations (only changed)
  const handleSaveCombined = async () => {
    if (!selectedClassSubjectId || !date || !lessonPeriod || students.length === 0) {
      toast.error('لطفاً کلاس، تاریخ و ساعت درسی را انتخاب کنید و منتظر بارگذاری دانش‌آموزان بمانید.');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');

    // Prepare attendance changes (we delete previous and insert new absent/late)
    setIsSubmitting(true);
    setLoadingEvaluations(true);
    try {
      console.debug('handleSaveCombined start', { selectedClassSubjectId, dateStr, lessonPeriod, user: user?.id, studentsCount: students.length });
      // Delete previous attendance for this class_subject/date/lesson
      const delRes = await supabase.from('attendance')
        .delete()
        .eq('class_subject_id', selectedClassSubjectId)
        .eq('date', dateStr)
        .eq('lesson_period', parseInt(lessonPeriod));
      console.debug('attendance delete response', delRes);
      if (delRes.error) throw delRes.error;

      const attendanceInserts = Object.entries(attendanceUiStatus)
        .filter(([_, status]) => status === 'absent' || status === 'late')
        .map(([studentId, status]) => ({
          student_id: studentId,
          class_subject_id: selectedClassSubjectId,
          status,
          date: dateStr,
          lesson_period: parseInt(lessonPeriod),
          recorded_by: user?.id,
        }));

      if (attendanceInserts.length > 0) {
        console.debug('Upserting attendance rows', attendanceInserts);
        const insertRes = await supabase.from('attendance').upsert(attendanceInserts, { onConflict: 'student_id,class_subject_id,date,lesson_period' });
        console.debug('attendance upsert response', insertRes);
        if (insertRes.error) throw insertRes.error;
      }

      // Detect changed evaluations compared to originalEvaluationsMap
      const changed: EvaluationRecord[] = [];
      const isDifferent = (a?: EvaluationRecord, b?: EvaluationRecord) => {
        if (!a && !b) return false;
        const aa = a ?? ({ homework_done: false, class_score: null, notes: null } as EvaluationRecord);
        const bb = b ?? ({ homework_done: false, class_score: null, notes: null } as EvaluationRecord);
        if (Boolean(aa.homework_done) !== Boolean(bb.homework_done)) return true;
        const ascore = aa.class_score === null ? null : Number(aa.class_score);
        const bscore = bb.class_score === null ? null : Number(bb.class_score);
        if (ascore !== bscore) return true;
        const anotes = aa.notes ?? '';
        const bnotes = bb.notes ?? '';
        if (anotes !== bnotes) return true;
        return false;
      };

      students.forEach(s => {
        const current = evaluationsMap[s.id];
        const original = originalEvaluationsMap[s.id];
        if (isDifferent(current, original)) {
          const ev = current ?? { student_id: s.id, class_id: selectedClass!.id, date: dateStr, homework_done: false, class_score: null, notes: null } as EvaluationRecord;
            // Build row without forcing `id` when it's undefined/null. Sending `id: null` causes
            // a NOT NULL constraint violation if the DB expects to generate the id server-side.
            const row: any = {
              student_id: s.id,
              class_id: selectedClass!.id,
              date: dateStr,
              homework_done: !!ev.homework_done,
              class_score: ev.class_score ?? null,
              notes: ev.notes ?? null,
              recorded_by: user?.id ?? null,
            };
            if (ev.id) {
              // only include id when it's present (existing record)
              row.id = ev.id;
            }
            changed.push(row);
        }
      });

      if (changed.length > 0) {
        console.debug('Upserting evaluations', changed.slice(0, 10));
        const upsertRes = await supabase.from('evaluations').upsert(changed, { onConflict: 'student_id,date,class_id' });
        console.debug('evaluations upsert response', upsertRes);
        if (upsertRes.error) {
          // Provide richer error information
          const err = upsertRes.error;
          const detail = {
            message: err.message,
            details: (err as any).details,
            hint: (err as any).hint,
            code: (err as any).code,
          };
          console.error('Evaluations upsert failed', detail);
          throw upsertRes.error;
        }
      } else {
        console.debug('No evaluation changes to upsert');
      }

      toast.success('ثبت ترکیبی با موفقیت انجام شد');

      // Refresh data
      await Promise.all([
        fetchAttendanceAndSetDefault(),
        fetchEvaluations(selectedClass!.id, dateStr),
        fetchDisciplineRecords(selectedClass!.id),
      ]);

    } catch (err: any) {
      console.error('Error in combined save:', err);
      toast.error(err?.message || 'خطا در ثبت اطلاعات.');
    } finally {
      setLoadingEvaluations(false);
      setIsSubmitting(false);
    }
  };


  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedStudentId) {
        toast.error("لطفا دانش‌آموز را انتخاب کنید.");
        return;
    }
    setIsSubmitting(true);

    try {
        if (editingDiscipline) {
            const { error } = await supabase.from('discipline_records').update({
                description: disciplineDesc,
                severity,
            }).eq('id', editingDiscipline.id);
            if (error) throw error;
            toast.success("مورد انضباطی با موفقیت ویرایش شد.");
        } else {
            const { error } = await supabase.from('discipline_records').insert({
              student_id: selectedStudentId,
              class_id: selectedClass.id,
              description: disciplineDesc,
              severity,
              recorded_by: user?.id,
            });
            if (error) throw error;
            toast.success('مورد انضباطی ثبت شد');
        }

        setDisciplineOpen(false);
        resetDisciplineForm();
        if (selectedClass) fetchDisciplineRecords(selectedClass.id);
    } catch (error: any) {
        console.error("Discipline submission error:", error);
        toast.error(`خطا: ${error.message || 'عملیات ناموفق بود.'}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteDiscipline = async (recordId: string, recordedBy: string) => {
      try {
          // Check if the current user is the creator of the record
          if (recordedBy !== user?.id) {
              toast.error("شما اجازه حذف این مورد انضباطی را ندارید");
              return;
          }

          const { error } = await supabase.from('discipline_records').delete().eq('id', recordId);
          if (error) throw error;
          toast.success("مورد انضباطی حذف شد.");
          if (selectedClass) fetchDisciplineRecords(selectedClass.id);
      } catch(error: any) {
          console.error("Error deleting discipline record:", error);
          toast.error("خطا در حذف مورد انضباطی: " + error.message);
      }
  }

  const openDisciplineDialog = (record: DisciplineRecord | null) => {
    if (record) {
      // Check if the current user is the creator of the record
      if (record.recorded_by !== user?.id) {
        toast.error("شما اجازه ویرایش این مورد انضباطی را ندارید");
        return;
      }
      setEditingDiscipline(record);
      if (record.students) {
        const student = students.find(s => s.full_name === record.students!.full_name);
        setSelectedStudentId(student?.id);
        setDisciplineDesc(record.description);
        setSeverity(record.severity);
      }
    } else {
      resetDisciplineForm();
    }
    setDisciplineOpen(true);
  }

  const resetDisciplineForm = () => {
    setEditingDiscipline(null);
    setSelectedStudentId(undefined);
    setDisciplineDesc('');
    setSeverity('low');
  }

  const updateStudentStatus = (studentId: string, clickedStatus: 'present' | 'absent' | 'late') => {
       setAttendanceUiStatus(prev => {
          const currentStatus = prev[studentId];
          let nextStatus: 'present' | 'absent' | 'late';

          if (clickedStatus === 'present') {
              nextStatus = 'present';
          } else if (currentStatus === clickedStatus) {
              nextStatus = 'present';
          } else {
              nextStatus = clickedStatus;
          }

          return { ...prev, [studentId]: nextStatus };
      });
  };

  const safeFormatDate = (dateString: string | null | undefined, formatString: string) => {
    if (!dateString) return '-';
    try {
        // Ensure dateString is treated correctly (ISO 8601 or YYYY-MM-DD)
        const dateObj = parseISO(dateString);
        return format(dateObj, formatString, { locale: faIR });
    } catch (e) {
        // Fallback for potential simple YYYY/MM/DD if parseISO fails unexpectedly
        try {
            const simpleDate = new Date(dateString.replace(/-/g, '/'));
             return format(simpleDate, formatString, { locale: faIR });
        } catch (e2){
            console.error("Error parsing date:", dateString, e2);
            return 'تاریخ نامعتبر';
        }
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center"><School className="w-6 h-6 text-primary-foreground" /></div>
            <div>
              <h1 className="text-2xl font-bold">پنل معلم</h1>
              {teacherName && <p className="text-sm text-muted-foreground mt-1">{teacherName}</p>}
              {authLoading && <p className="text-sm text-muted-foreground animate-pulse mt-1">در حال بارگذاری...</p>}
            </div>
          </div>
          <Button onClick={signOut} variant="destructive" className="gap-2"><LogOut className="w-4 h-4" />خروج</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
        <Card>
          <CardHeader><CardTitle>انتخاب کلاس، تاریخ و ساعت</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedClassSubjectId} onValueChange={setSelectedClassSubjectId}>
              <SelectTrigger disabled={loadingClassSubjects}><SelectValue placeholder="انتخاب کلاس-درس..." /></SelectTrigger>
              <SelectContent>{classSubjects.map((cs) => (<SelectItem key={cs.id} value={cs.id}>{`${cs.classes.name} (${cs.classes.grade}) - ${cs.subjects.name}`}</SelectItem>))}</SelectContent>
            </Select>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        {date ? format(date, "PPP", { locale: faIR }) : <span className="mr-auto">انتخاب تاریخ</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent>
            </Popover>
            <Select value={lessonPeriod} onValueChange={setLessonPeriod}>
              <SelectTrigger><SelectValue placeholder="انتخاب ساعت درسی..." /></SelectTrigger>
              <SelectContent>
                {[...Array(4)].map((_, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{`ساعت ${i + 1}`}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClassSubjectId && date && lessonPeriod && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>دفتر کلاسی (یک‌جا)</CardTitle>
                  <CardDescription>نمایش و ویرایش حضور، تکلیف، نمره کلاسی و توضیحات برای هر دانش‌آموز</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveCombined} disabled={isSubmitting || loadingStudents || loadingAttendance || students.length === 0}>
                    {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? 'در حال ثبت...' : 'ذخیره همه'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStudents || loadingAttendance || loadingEvaluations ? (
                <div className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary"/></div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">دانش آموزی در این کلاس یافت نشد.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">دانش‌آموز</TableHead>
                      <TableHead className="text-right">حضور</TableHead>
                      <TableHead className="text-right">تکلیف</TableHead>
                      <TableHead className="text-right">نمره کلاسی</TableHead>
                      <TableHead className="text-right">توضیحات</TableHead>
                      <TableHead className="text-right">انضباط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const currentStatus = attendanceUiStatus[s.id] || 'present';
                      const ev = evaluationsMap[s.id] ?? { student_id: s.id, class_id: selectedClass!.id, date: format(date, 'yyyy-MM-dd'), homework_done: false, class_score: null, notes: null } as EvaluationRecord;
                      const disciplineCount = disciplineRecords.filter(d => d.students?.full_name === s.full_name).length;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.full_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant={currentStatus === 'present' ? 'secondary' : 'outline'} onClick={() => setAttendanceUiStatus(prev => ({ ...prev, [s.id]: 'present' }))}>حاضر</Button>
                              <Button size="sm" variant={currentStatus === 'absent' ? 'destructive' : 'outline'} onClick={() => setAttendanceUiStatus(prev => ({ ...prev, [s.id]: prev[s.id] === 'absent' ? 'present' : 'absent' }))}>غایب</Button>
                              <Button size="sm" variant={currentStatus === 'late' ? 'secondary' : 'outline'} onClick={() => setAttendanceUiStatus(prev => ({ ...prev, [s.id]: prev[s.id] === 'late' ? 'present' : 'late' }))}>تاخیر</Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <input type="checkbox" checked={!!ev.homework_done} onChange={(e) => setEvaluationsMap(prev => ({ ...prev, [s.id]: { ...ev, homework_done: e.target.checked } }))} />
                          </TableCell>
                          <TableCell>
                            <input type="number" min={0} max={100} value={ev.class_score ?? ''} onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              setEvaluationsMap(prev => ({ ...prev, [s.id]: { ...ev, class_score: val } }));
                            }} className="w-20 p-1 border rounded" />
                          </TableCell>
                          <TableCell>
                            <input type="text" value={ev.notes ?? ''} onChange={(e) => setEvaluationsMap(prev => ({ ...prev, [s.id]: { ...ev, notes: e.target.value } }))} className="w-full p-1 border rounded" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedStudentId(s.id); setEditingDiscipline(null); setDisciplineDesc(''); setSeverity('low'); setDisciplineOpen(true); }}>
                                {disciplineCount > 0 ? `${disciplineCount}` : '+'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {selectedClass && (
          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                    <div><CardTitle>موارد انضباطی</CardTitle><CardDescription>موارد انضباطی ثبت شده توسط شما برای کلاس {selectedClass.name}</CardDescription></div>
                    <Dialog open={disciplineOpen} onOpenChange={(isOpen) => { setDisciplineOpen(isOpen); if (!isOpen) resetDisciplineForm(); }}>
                      <DialogTrigger asChild><Button variant="outline" className="gap-2" disabled={students.length === 0}><Plus className="w-4 h-4" />ثبت مورد جدید</Button></DialogTrigger>
                      <DialogContent dir="rtl">
                        <DialogHeader>
                          <DialogTitle>{editingDiscipline ? 'ویرایش مورد انضباطی' : 'ثبت مورد انضباطی'}</DialogTitle>
                           <DialogDescription>اطلاعات مورد نیاز را وارد کنید.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleDisciplineSubmit} className="space-y-4 pt-4">
                          <div className="space-y-2"><Label>دانش‌آموز</Label><Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!!editingDiscipline}><SelectTrigger><SelectValue placeholder="انتخاب دانش‌آموز" /></SelectTrigger><SelectContent>{students.map((student) => (<SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>))}</SelectContent></Select></div>
                          <div className="space-y-2"><Label>شرح</Label><Textarea value={disciplineDesc} onChange={(e) => setDisciplineDesc(e.target.value)} required /></div>
                          <div className="space-y-2"><Label>شدت</Label><Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">کم</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="high">شدید</SelectItem></SelectContent></Select></div>
                           <DialogFooter className="pt-4">
                                <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>انصراف</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting || !selectedStudentId}> {/* Disable if no student selected for new entry */}
                                     {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                                     {editingDiscipline ? "ویرایش" : "ثبت"}
                                </Button>
                           </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader><TableRow><TableHead className="text-right">دانش‌آموز</TableHead><TableHead className="text-right">شرح</TableHead><TableHead className="text-right">شدت</TableHead><TableHead className="text-right">تاریخ</TableHead><TableHead className="text-right">عملیات</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {disciplineRecords.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">هیچ موردی ثبت نشده است.</TableCell></TableRow> :
                          disciplineRecords.map(rec => (
                              <TableRow key={rec.id}>
                                  <TableCell>{rec.students?.full_name || 'نامشخص'}</TableCell>
                                  <TableCell>{rec.description}</TableCell>
                                  <TableCell><Badge variant={rec.severity === 'high' ? 'destructive' : rec.severity === 'medium' ? 'secondary' : 'default'}>{rec.severity === "low" ? "کم" : rec.severity === "medium" ? "متوسط" : "شدید"}</Badge></TableCell>
                                  <TableCell>{format(parseISO(rec.created_at), 'yyyy/MM/dd')}</TableCell>
                                  <TableCell><div className="flex gap-2">
                                      {rec.recorded_by === user?.id && (
                                          <>
                                              <Button variant="outline" size="sm" onClick={() => openDisciplineDialog(rec)}><Pencil className="w-4 h-4"/></Button>
                                              <AlertDialog>
                                                  <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4"/></Button></AlertDialogTrigger>
                                                  <AlertDialogContent dir="rtl">
                                                      <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                                                      <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDiscipline(rec.id, rec.recorded_by)}>حذف</AlertDialogAction></AlertDialogFooter>
                                                  </AlertDialogContent>
                                              </AlertDialog>
                                          </>
                                      )}
                                  </div></TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
        )}
        
      </main>
    </div>
  );
};

export default TeacherDashboard;

