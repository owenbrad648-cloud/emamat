// (کپي کامل فایل - جایگزین فایل قدیمی)
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSortableData, SortConfig } from '@/hooks/use-sortable-data';
import { ExcelImportDialog } from './ExcelImportDialog';

interface ParentProfile {
  id: string;
  full_name: string;
  username: string;
  email?: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  grade: string;
}

interface StudentRecord {
  id: string;
  full_name: string;
  class_id: string | null;
  parent_id: string | null;
  classes: { id: string; name: string } | null;
  profiles: ParentProfile | null;
}

const studentImportFields = {
  required: {
    student_full_name: "نام دانش آموز*",
    class_name: "نام کلاس*",
    parent_username: "نام کاربری ولی*",
    parent_full_name: "نام کامل ولی*",
    parent_email: "ایمیل ولی*",
    parent_password: "رمز عبور ولی*",
  },
  optional: {},
};

// Sortable Header
const SortableHeader = ({ sortKey, children, sortConfig, requestSort }: { sortKey: string, children: React.ReactNode, sortConfig: SortConfig<StudentRecord> | null, requestSort: (key: string) => void }) => {
  const isSorted = sortConfig?.key === sortKey;
  const direction = isSorted ? sortConfig?.direction : null;
  const icon = !isSorted ? <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100" /> :
    direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  return <Button variant="ghost" onClick={() => requestSort(sortKey)} className="group px-1 py-1 h-auto -ml-2">{children}{icon}</Button>
};

const StudentsManagement = () => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);

  // Dialogs state
  const [open, setOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | undefined>();

  const [parentFullName, setParentFullName] = useState('');
  const [parentUsername, setParentUsername] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');

  const { items: sortedStudents, requestSort, sortConfig } = useSortableData<StudentRecord>(students, { key: 'full_name', direction: 'ascending' });

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchStudents(), fetchClasses(), fetchParents()]);
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(id, name), profiles(id, full_name, username)');
    if (error) toast.error('خطا در بارگذاری دانش‌آموزان: ' + error.message);
    else setStudents(data as StudentRecord[] || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name, grade');
    if (error) toast.error('خطا در بارگذاری کلاس‌ها: ' + error.message);
    else setClasses(data || []);
  };

  // fetchParents now also includes email so we can search by email when needed
  const fetchParents = async () => {
    const { data: parentUsers, error: roleError } = await supabase
      .from('user_roles').select('user_id').eq('role', 'parent');
    if (roleError) { toast.error('خطا در یافتن نقش والدین: ' + roleError.message); setParents([]); return; }
    const parentIds = parentUsers?.map(p => p.user_id) || [];
    if (!parentIds.length) { setParents([]); return; }
    const { data: profileData, error: profileError } = await supabase
      .from('profiles').select('id, full_name, username, email').in('id', parentIds);
    if (profileError) toast.error('خطا در بارگذاری والدین: ' + profileError.message);
    else setParents(profileData || []);
  };

  const handleAddOrEditStudent = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!classId) { toast.error("لطفا کلاس دانش‌آموز را انتخاب کنید."); return; }
    if (!studentName) { toast.error("نام دانش‌آموز الزامی است."); return; }
    setIsSubmitting(true);

    try {
      let parentToUseId = parentId;

      // اگر ولی جدید اضافه شده، ابتدا بساز
      if (!parentId && parentFullName && parentUsername && parentEmail && parentPassword) {
        // --- IMPORTANT: send fields in the shape bulk-signup expects ---
        const usersPayload = [{
          email: parentEmail,
          password: parentPassword,
          full_name: parentFullName,
          username: parentUsername
        }];

        const { data: fnResult, error: fnError } = await supabase.functions.invoke('bulk-signup', {
          body: { users: usersPayload, userType: 'parent' }
        });

        if (fnError) throw fnError;
        // function returns { success, errors, results }
        if (!fnResult || fnResult.errors?.length) {
          throw new Error((fnResult && fnResult.errors && fnResult.errors[0]) || 'خطا در ایجاد والد');
        }

        // refresh parents list and find the created parent by username (preferred) or email
        await fetchParents();
        const created = parents.find(p => p.username === parentUsername) || (await findProfileByEmail(parentEmail));
        if (created) parentToUseId = created.id;
        else { 
          // fallback: try to read id from function results if present
          parentToUseId = fnResult.results?.[0]?.id;
        }
      }

      const studentData = { full_name: studentName, class_id: classId, parent_id: parentToUseId || null };

      if (editingStudent) {
        const { error } = await supabase.from('students').update(studentData).eq('id', editingStudent.id);
        if (error) throw error;
        toast.success('دانش‌آموز با موفقیت ویرایش شد');
      } else {
        const { error } = await supabase.from('students').insert(studentData);
        if (error) throw error;
        toast.success('دانش‌آموز با موفقیت اضافه شد');
      }

      setOpen(false);
      resetForm();
      fetchStudents();
    } catch (err: any) {
      console.error("Add/Edit Student error:", err);
      toast.error(err.message || 'خطا در افزودن دانش‌آموز');
    } finally { setIsSubmitting(false); }
  };

  // helper: find profile by email directly
  const findProfileByEmail = async (email: string) => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, username, email').eq('email', email).maybeSingle();
    if (error) {
      console.warn('خطا در جستجوی پروفایل بر اساس ایمیل:', error);
      return null;
    }
    return data as ParentProfile | null;
  };

  const resetForm = () => {
    setEditingStudent(null);
    setStudentName('');
    setClassId(undefined);
    setParentId(undefined);
    setParentFullName('');
    setParentUsername('');
    setParentEmail('');
    setParentPassword('');
  };

  const handleDeleteStudent = async (studentId: string) => {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) toast.error('خطا در حذف دانش‌آموز: ' + error.message);
    else { toast.success('دانش‌آموز حذف شد'); fetchStudents(); }
  };

  const openEditModal = (student: StudentRecord) => {
    setEditingStudent(student);
    setStudentName(student.full_name);
    setClassId(student.class_id || undefined);
    setParentId(student.parent_id || undefined);
    setOpen(true);
  };
  const openAddModal = () => { resetForm(); setOpen(true); };

  // --- Excel Import ---
  const handleStudentImport = async (rows: Record<string, any>[]) => {
    setIsLoadingExcel(true);
    const errors: string[] = [];
    const parentsToCreate: any[] = [];
    const studentsToInsert: any[] = [];

    // fetch current parent map (username -> id)
    const { data: existingParents } = await supabase.from('profiles').select('id, username, email');
    const { data: classData } = await supabase.from('classes').select('id, name');
    const parentMap = new Map(existingParents?.map(p => [p.username, p.id]));
    const classMap = new Map(classData?.map(c => [c.name, c.id]));

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      if (!row.student_full_name || !row.class_name || !row.parent_username || !row.parent_full_name || !row.parent_email || !row.parent_password) {
        errors.push(`ردیف ${rowNum}: فیلدهای الزامی کامل نیست`);
        return;
      }
      const classId = classMap.get(row.class_name);
      if (!classId) { errors.push(`ردیف ${rowNum}: کلاس "${row.class_name}" یافت نشد`); return; }
      let parentId = parentMap.get(row.parent_username);
      if (!parentId) {
        // create parent payload in the top-level shape expected by bulk-signup
        parentsToCreate.push({
          email: row.parent_email,
          password: row.parent_password,
          full_name: row.parent_full_name,
          username: row.parent_username
        });
      }
      studentsToInsert.push({ full_name: row.student_full_name, class_id: classId, parent_username: row.parent_username });
    });

    // create parents (if needed)
    if (parentsToCreate.length) {
      try {
        const { data: parentResult, error: fnError } = await supabase.functions.invoke('bulk-signup', { body: { users: parentsToCreate, userType: 'parent' } });
        if (fnError) throw fnError;
        if (!parentResult || parentResult.errors?.length) {
          throw new Error((parentResult && parentResult.errors && parentResult.errors.join('; ')) || 'خطا در ایجاد والدین');
        }
        // fetch newly created parent profiles by usernames to update parentMap
        const newUsernames = parentsToCreate.map(p => p.username);
        const { data: newProfiles } = await supabase.from('profiles').select('id, username, email').in('username', newUsernames);
        (newProfiles || []).forEach((p: any) => parentMap.set(p.username, p.id));
      } catch (err: any) {
        errors.push('خطا در ایجاد والدین: ' + (err.message || String(err)));
      }
    }

    // insert students
    for (const stu of studentsToInsert) {
      const stuParentId = parentMap.get(stu.parent_username) || null;
      if (!stuParentId) { errors.push(`دانش‌آموز "${stu.full_name}" به دلیل عدم وجود ولی اضافه نشد`); continue; }
      const { error } = await supabase.from('students').insert({ full_name: stu.full_name, class_id: stu.class_id, parent_id: stuParentId });
      if (error) errors.push(`خطا در افزودن دانش‌آموز "${stu.full_name}": ${error.message}`);
    }

    await fetchStudents();
    setIsLoadingExcel(false);
    if (errors.length) toast.error(errors.join("\n"));
    else toast.success("وارد کردن Excel با موفقیت انجام شد");
  };

  const generateStudentTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([Object.values(studentImportFields.required)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "دانش آموزان");
    XLSX.writeFile(wb, "students_template.xlsx");
  };

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sortedStudents.filter(s =>
      (s.full_name.toLowerCase().includes(term) ||
        s.profiles?.full_name?.toLowerCase().includes(term) ||
        s.profiles?.username?.toLowerCase().includes(term)) &&
      (filterClassId === 'all' || s.class_id === filterClassId)
    );
  }, [sortedStudents, searchTerm, filterClassId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>مدیریت دانش‌آموزان</CardTitle>
            <CardDescription>افزودن، ویرایش، حذف و وارد کردن دسته‌جمعی دانش‌آموزان</CardDescription>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            {/* Excel Import */}
            <ExcelImportDialog requiredFields={studentImportFields.required} onImport={handleStudentImport} templateGenerator={generateStudentTemplate} entityName="دانش آموز" />
            {/* Add Student */}
            <Button onClick={openAddModal} className="gap-2"><Plus className="w-4 h-4" />افزودن دانش‌آموز</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div> :
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="full_name" sortConfig={sortConfig} requestSort={requestSort}>نام دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="classes.name" sortConfig={sortConfig} requestSort={requestSort}>کلاس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name" sortConfig={sortConfig} requestSort={requestSort}>ولی</SortableHeader></TableHead>
                <TableHead className="text-right">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ?
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">هیچ دانش‌آموزی یافت نشد</TableCell></TableRow> :
                filteredStudents.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{s.full_name}</TableCell>
                    <TableCell>{s.classes?.name || 'تعیین نشده'}</TableCell>
                    <TableCell>{s.profiles?.full_name || 'تعیین نشده'} ({s.profiles?.username || ''})</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(s)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle>
                              <AlertDialogDescription>این عمل دانش‌آموز را حذف می‌کند.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteStudent(s.id)}>حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        }
      </CardContent>

      {/* Add/Edit Student Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز'}</DialogTitle>
            <DialogDescription>اطلاعات دانش‌آموز را وارد کنید</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddOrEditStudent} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="sFullName">نام دانش‌آموز*</Label>
              <Input id="sFullName" value={studentName} onChange={e => setStudentName(e.target.value)} required dir="rtl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sClass">کلاس*</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="sClass"><SelectValue placeholder="انتخاب کلاس" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.grade}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sParent">ولی</Label>
              <Input placeholder="نام کامل ولی جدید (در صورت اضافه کردن همزمان)" value={parentFullName} onChange={e => setParentFullName(e.target.value)} />
              <Input placeholder="نام کاربری ولی جدید" value={parentUsername} onChange={e => setParentUsername(e.target.value)} />
              <Input placeholder="ایمیل ولی جدید" value={parentEmail} onChange={e => setParentEmail(e.target.value)} />
              <Input placeholder="رمز عبور ولی جدید" value={parentPassword} onChange={e => setParentPassword(e.target.value)} />
              <Select value={parentId} onValueChange={setParentId} className="mt-2">
                <SelectTrigger><SelectValue placeholder="انتخاب ولی موجود" /></SelectTrigger>
                <SelectContent>
                  {parents.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.username})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'در حال ارسال...' : 'ذخیره'}</Button>
              <DialogClose asChild><Button variant="outline">انصراف</Button></DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default StudentsManagement;
