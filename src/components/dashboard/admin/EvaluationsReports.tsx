import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useSortableData } from '@/hooks/use-sortable-data';
import { SortableHeader } from './SortableHeader';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale/fa-IR';
import { toPersianDigits } from '@/utils/dateUtils';
import { toast } from 'sonner';

interface EvalRow {
  id: string;
  student_full_name: string | null;
  date: string;
  homework_done: boolean;
  class_score: number | null;
  notes: string | null;
  class_name: string | null;
  teacher_name?: string | null;
  subject_name?: string | null;
}

const EvaluationsReports = () => {
  const [classId, setClassId] = useState<string | undefined>();
  const [classes, setClasses] = useState<any[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const exportToExcel = () => {
    if (!sortedItems.length) {
      toast.error('موردی برای دریافت گزارش وجود ندارد');
      return;
    }
    try {
      // Convert data for Excel
      const excelData = sortedItems.map(r => ({
        'دانش‌آموز': r.student_full_name || '',
        'کلاس': r.class_name || '',
        'درس': r.subject_name || '',
        'معلم': r.teacher_name || '',
        'تاریخ': r.date,
        'تکلیف': r.homework_done ? 'بله' : 'خیر',
        'نمره': r.class_score || '',
        'توضیحات': r.notes || ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData, { header: ['دانش‌آموز', 'کلاس', 'درس', 'معلم', 'تاریخ', 'تکلیف', 'نمره', 'توضیحات'] });
      
      // Set RTL and column widths
      ws['!dir'] = 'rtl';
      ws['!cols'] = [
        { wch: 20 }, // دانش‌آموز
        { wch: 15 }, // کلاس
        { wch: 15 }, // درس
        { wch: 20 }, // معلم
        { wch: 12 }, // تاریخ
        { wch: 8 },  // تکلیف
        { wch: 8 },  // نمره
        { wch: 30 }  // توضیحات
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'ارزشیابی‌ها');
      
      // Generate filename based on date range or selected date
      const filename = date 
        ? `ارزشیابی_${format(date, 'yyyy-MM-dd')}.xlsx`
        : `ارزشیابی_۷روز_اخیر.xlsx`;
        
      XLSX.writeFile(wb, filename);
      toast.success('گزارش اکسل با موفقیت دانلود شد');
    } catch (err: any) {
      console.error('Error exporting to Excel:', err);
      toast.error('خطا در ایجاد فایل اکسل: ' + (err.message || ''));
    }
  };

  // Filter and sorting
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    const q = searchTerm.trim().toLowerCase();
    return rows.filter(r => {
      if (classId && r.class_name !== null && r.class_name !== undefined && r.class_name !== classes.find(c => c.id === classId)?.name) {
        // if classId filter is set, ensure class_name matches selected class
        // note: using class_name string comparison since rows contain class_name
        const selected = classes.find(c => c.id === classId)?.name;
        if (!selected) return false;
      }
      if (!q) return true;
      const combined = `${r.student_full_name || ''} ${r.class_name || ''} ${r.subject_name || ''} ${r.teacher_name || ''} ${r.notes || ''}`.toLowerCase();
      return combined.includes(q);
    });
  }, [rows, searchTerm, classId, classes]);

  const { items: sortedItems, requestSort, sortConfig } = useSortableData<EvalRow>(filteredRows, { key: 'date', direction: 'descending' });

  useEffect(() => {
    // load classes for filter
    supabase.from('classes').select('id, name').then(({ data }) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (!date) return;
    const d = format(date, 'yyyy-MM-dd');
    fetchRows(d);
  }, [date, classId]);

  // Manual recent fetch helper (last 7 days)
  const fetchRecentSevenDays = async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      // Query the same fields as fetchRows so we can resolve teacher and subject names
      let recentQ = supabase.from('evaluations').select('id, date, homework_done, class_score, notes, recorded_by, class_id, students(full_name), classes(id,name), profiles(full_name)')
        .gte('date', format(sevenDaysAgo, 'yyyy-MM-dd'));
      if (classId) recentQ = recentQ.eq('class_id', classId);
      const { data, error } = await recentQ.order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching recent evaluations:', error);
        toast.error('خطا در دریافت ارزشیابی‌های اخیر: ' + (error.message || ''));
        return;
      }

      // Map rows and include recorded_by and class_id for subject resolution
      const mappedRecent = (data || []).map((r: any) => ({ id: r.id, student_full_name: r.students?.full_name ?? null, date: r.date, homework_done: !!r.homework_done, class_score: r.class_score ?? null, notes: r.notes ?? null, class_name: r.classes?.name ?? null, teacher_name: r.profiles?.full_name ?? null, subject_name: null as string | null, class_id: r.class_id, recorded_by: r.recorded_by } as any));

      // Batch-resolve recorded_by (profile id) -> teacher.id and profile full_name
      const profileIdsRecent = Array.from(new Set(mappedRecent.map(m => m.recorded_by).filter(Boolean)));
      const profileToTeacherIdRecent: Record<string, string> = {};
      const profileIdToNameRecent: Record<string, string> = {};
      if (profileIdsRecent.length > 0) {
        const [{ data: teachers }, { data: profiles }] = await Promise.all([
          supabase.from('teachers').select('id, profile_id').in('profile_id', profileIdsRecent as string[]),
          supabase.from('profiles').select('id, full_name').in('id', profileIdsRecent as string[]),
        ]);
        (teachers || []).forEach((t: any) => { profileToTeacherIdRecent[t.profile_id] = t.id; });
        (profiles || []).forEach((p: any) => { profileIdToNameRecent[p.id] = p.full_name; });
      }

      // Batch-fetch class_subjects for relevant class_id/teacher_id combinations
      const classIdsRecent = Array.from(new Set(mappedRecent.map(m => m.class_id).filter(Boolean)));
      const teacherIdsRecent = Array.from(new Set(Object.values(profileToTeacherIdRecent).filter(Boolean)));
      const classSubjectMapRecent: Record<string, string> = {};
      if (classIdsRecent.length > 0 && teacherIdsRecent.length > 0) {
        const { data: css } = await supabase.from('class_subjects').select('class_id, teacher_id, subjects(name)').in('class_id', classIdsRecent as string[]).in('teacher_id', teacherIdsRecent as string[]);
        (css || []).forEach((row: any) => {
          classSubjectMapRecent[`${row.class_id}||${row.teacher_id}`] = row.subjects?.name ?? null;
        });
      }

      // Apply resolved names
      const finalRecent = mappedRecent.map(m => {
        const teacherId = profileToTeacherIdRecent[m.recorded_by];
        return {
          ...m,
          subject_name: teacherId ? classSubjectMapRecent[`${m.class_id}||${teacherId}`] ?? null : null,
          teacher_name: m.teacher_name ?? profileIdToNameRecent[m.recorded_by] ?? null,
        };
      });

      setRows(finalRecent.map(({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name }) => ({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name })));
    } catch (err: any) {
      console.error('Unexpected error fetching recent evaluations:', err);
      toast.error(err?.message || 'خطا در دریافت ارزشیابی‌های اخیر');
    } finally {
      setLoading(false);
    }
  };

  const fetchRows = async (dateStr: string) => {
    setLoading(true);
    try {
      // Try primary query with related selects
  let q = supabase.from('evaluations').select('id, date, homework_done, class_score, notes, recorded_by, class_id, students(full_name), classes(id,name), profiles(full_name)');
      q = q.eq('date', dateStr);
      if (classId) q = q.eq('class_id', classId);
      const { data, error } = await q.order('created_at', { ascending: false });
      console.debug('Evaluations primary query', { date: dateStr, classId, rows: (data || []).length, error });
      if (error) {
        console.warn('Primary evaluations query failed, trying fallback without relations', error);
          // Try a fallback query without relational selects (some schemas may not expose relations)
          const { data: data2, error: error2 } = await supabase.from('evaluations').select('id, date, homework_done, class_score, notes, student_id, class_id, recorded_by').eq('date', dateStr).order('created_at', { ascending: false });
        if (error2) {
          console.error('Fallback minimal query failed', error2);
          const msg = error2.message || '';
          if (msg.includes('Could not find the table')) {
            toast.error('جدول "evaluations" در پایگاه داده یافت نشد. لطفاً مایگریشن مربوطه را اجرا کنید.');
            setRows([]);
            return;
          }
          throw error2;
        }
        // Map minimal response; we'll attempt to resolve student and class names separately
        const minimal = (data2 || []) as any[];
        // Fetch student names and class names in bulk
        const studentIds = Array.from(new Set(minimal.map(r => r.student_id).filter(Boolean)));
  const classIdsMinimal = Array.from(new Set(minimal.map(r => r.class_id).filter(Boolean)));
        const studentsMap: Record<string, string> = {};
        const classesMap: Record<string, string> = {};
        if (studentIds.length > 0) {
          const { data: studs } = await supabase.from('students').select('id, full_name').in('id', studentIds as string[]);
          (studs || []).forEach(s => { studentsMap[s.id] = s.full_name; });
        }
        if (classIdsMinimal.length > 0) {
          const { data: cls } = await supabase.from('classes').select('id, name').in('id', classIdsMinimal as string[]);
          (cls || []).forEach(c => { classesMap[c.id] = c.name; });
        }
        let mappedMinimal = minimal.map(r => ({ id: r.id, student_full_name: studentsMap[r.student_id] ?? null, date: r.date, homework_done: !!r.homework_done, class_score: r.class_score ?? null, notes: r.notes ?? null, class_name: classesMap[r.class_id] ?? null, teacher_name: null as string | null, subject_name: null as string | null, class_id: r.class_id, recorded_by: r.recorded_by } as any));
        // Batch-resolve recorded_by (profile id) -> teacher.id and profile full_name
        const profileIds = Array.from(new Set(mappedMinimal.map(m => m.recorded_by).filter(Boolean)));
        const profileToTeacherId: Record<string, string> = {};
        const profileIdToName: Record<string, string> = {};
        if (profileIds.length > 0) {
          const [{ data: teachers }, { data: profiles }] = await Promise.all([
            supabase.from('teachers').select('id, profile_id').in('profile_id', profileIds as string[]),
            supabase.from('profiles').select('id, full_name').in('id', profileIds as string[]),
          ]);
          (teachers || []).forEach((t: any) => { profileToTeacherId[t.profile_id] = t.id; });
          (profiles || []).forEach((p: any) => { profileIdToName[p.id] = p.full_name; });
        }
        // Batch-fetch class_subjects for relevant class_id/teacher_id combinations
        const classIdsForSubjects = Array.from(new Set(mappedMinimal.map(m => m.class_id).filter(Boolean)));
        const teacherIds = Array.from(new Set(Object.values(profileToTeacherId).filter(Boolean)));
        const classSubjectMap: Record<string, string> = {};
        if (classIdsForSubjects.length > 0 && teacherIds.length > 0) {
          const { data: css } = await supabase.from('class_subjects').select('class_id, teacher_id, subjects(name)').in('class_id', classIdsForSubjects as string[]).in('teacher_id', teacherIds as string[]);
          (css || []).forEach((row: any) => {
            classSubjectMap[`${row.class_id}||${row.teacher_id}`] = row.subjects?.name ?? null;
          });
        }
        // Apply resolved names
        mappedMinimal = mappedMinimal.map(m => {
          const teacherId = profileToTeacherId[m.recorded_by];
          return {
            ...m,
            subject_name: teacherId ? classSubjectMap[`${m.class_id}||${teacherId}`] ?? null : null,
            teacher_name: profileIdToName[m.recorded_by] ?? null,
          };
        });
        setRows(mappedMinimal.map(({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name }) => ({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name })));
        if ((minimal || []).length === 0) {
          toast.info('برای تاریخ انتخاب‌شده موردی یافت نشد. می‌توانید «۷ روز اخیر» را امتحان کنید.');
        }
        return;
      }

      // Map rows and include recorded_by and class_id for subject resolution
      const mapped = (data || []).map((r: any) => ({ id: r.id, student_full_name: r.students?.full_name ?? null, date: r.date, homework_done: !!r.homework_done, class_score: r.class_score ?? null, notes: r.notes ?? null, class_name: r.classes?.name ?? null, teacher_name: r.profiles?.full_name ?? null, subject_name: null as string | null, class_id: r.class_id, recorded_by: r.recorded_by } as any));
      // Batch-resolve recorded_by (profile id) -> teacher.id and profile full_name
      const profileIdsMain = Array.from(new Set(mapped.map(m => m.recorded_by).filter(Boolean)));
      const profileToTeacherIdMain: Record<string, string> = {};
      const profileIdToNameMain: Record<string, string> = {};
      if (profileIdsMain.length > 0) {
        const [{ data: teachers }, { data: profiles }] = await Promise.all([
          supabase.from('teachers').select('id, profile_id').in('profile_id', profileIdsMain as string[]),
          supabase.from('profiles').select('id, full_name').in('id', profileIdsMain as string[]),
        ]);
        (teachers || []).forEach((t: any) => { profileToTeacherIdMain[t.profile_id] = t.id; });
        (profiles || []).forEach((p: any) => { profileIdToNameMain[p.id] = p.full_name; });
      }
      // Batch-fetch class_subjects for relevant class_id/teacher_id combinations
      const classIdsMain = Array.from(new Set(mapped.map(m => m.class_id).filter(Boolean)));
      const teacherIdsMain = Array.from(new Set(Object.values(profileToTeacherIdMain).filter(Boolean)));
      const classSubjectMapMain: Record<string, string> = {};
      if (classIdsMain.length > 0 && teacherIdsMain.length > 0) {
        const { data: css } = await supabase.from('class_subjects').select('class_id, teacher_id, subjects(name)').in('class_id', classIdsMain as string[]).in('teacher_id', teacherIdsMain as string[]);
        (css || []).forEach((row: any) => {
          classSubjectMapMain[`${row.class_id}||${row.teacher_id}`] = row.subjects?.name ?? null;
        });
      }
      // Apply resolved names
      const finalRows = mapped.map(m => {
        const teacherId = profileToTeacherIdMain[m.recorded_by];
        return {
          ...m,
          subject_name: teacherId ? classSubjectMapMain[`${m.class_id}||${teacherId}`] ?? null : null,
          teacher_name: m.teacher_name ?? profileIdToNameMain[m.recorded_by] ?? null,
        };
      });
      setRows(finalRows.map(({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name }) => ({ id, student_full_name, date, homework_done, class_score, notes, class_name, teacher_name, subject_name })));
      if (mapped.length === 0) {
        toast.info('برای تاریخ انتخاب‌شده موردی یافت نشد. می‌توانید «۷ روز اخیر» را امتحان کنید.');
      }
    } catch (err: any) {
      console.error('Error loading evaluations:', err);
      toast.error(err.message || 'خطا در بارگذاری ارزشیابی‌ها');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش ارزشیابی‌ها</CardTitle>
        <CardDescription>مشاهده ارزشیابی‌های روزانه</CardDescription>
        <div className="flex gap-2 pt-4">
          <Input placeholder="جستجو (نام دانش‌آموز، کلاس، درس، معلم، توضیحات)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-[320px]" />
          <Select value={classId} onValueChange={setClassId}><SelectTrigger className="w-[180px]"><SelectValue placeholder="فیلتر کلاس"/></SelectTrigger><SelectContent><SelectItem value={undefined as any}>همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline">{date ? format(date, 'PPP', { locale: faIR }) : 'انتخاب تاریخ'}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent>
          </Popover>
          <Button variant="ghost" onClick={fetchRecentSevenDays}>نمایش ۷ روز اخیر</Button>
          <Button variant="outline" onClick={exportToExcel} disabled={loading || !sortedItems.length}>
            دریافت گزارش اکسل
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-6 text-center">در حال بارگذاری...</div> : (
          <Table>
            <TableHeader>
            <TableRow>
              <TableHead className="text-right"><SortableHeader sortKey="student_full_name" sortConfig={sortConfig} requestSort={requestSort}>دانش‌آموز</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="class_name" sortConfig={sortConfig} requestSort={requestSort}>کلاس</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="subject_name" sortConfig={sortConfig} requestSort={requestSort}>درس</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="teacher_name" sortConfig={sortConfig} requestSort={requestSort}>معلم</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="date" sortConfig={sortConfig} requestSort={requestSort}>تاریخ</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="homework_done" sortConfig={sortConfig} requestSort={requestSort}>تکلیف</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="class_score" sortConfig={sortConfig} requestSort={requestSort}>نمره</SortableHeader></TableHead>
              <TableHead className="text-right"><SortableHeader sortKey="notes" sortConfig={sortConfig} requestSort={requestSort}>توضیحات</SortableHeader></TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">هیچ موردی یافت نشد</TableCell></TableRow> : sortedItems.map(r => (
                <TableRow key={r.id}><TableCell>{r.student_full_name}</TableCell><TableCell>{r.class_name}</TableCell><TableCell>{r.subject_name ?? '-'}</TableCell><TableCell>{r.teacher_name ?? '-'}</TableCell><TableCell>{toPersianDigits(r.date)}</TableCell><TableCell>{r.homework_done ? 'بله' : 'خیر'}</TableCell><TableCell>{r.class_score ?? '-'}</TableCell><TableCell>{r.notes ?? '-'}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default EvaluationsReports;
