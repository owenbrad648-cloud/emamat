import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
// --- MODIFICATION: Added Edit2 icon ---
import { Plus, Trash2, Pencil, Search, BookOpen, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Edit2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';
import { useSortableData } from '@/hooks/use-sortable-data';
import { Badge } from '@/components/ui/badge'; // <-- FIX: Added this import

// Interface Definitions
interface Profile {
  full_name: string;
}

interface Teacher {
  id: string;
  profiles: Profile | null;
}

interface Subject {
  id: string;
  name: string;
}

interface ClassSubject {
  id: string; // Needed for update/delete
  subjects: { name: string } | null;
  teachers: { profiles: { full_name: string } | null } | null;
}

interface Class {
  id: string;
  name: string;
  grade: string;
  class_subjects: ClassSubject[];
}

const ClassesManagement = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs and Forms State
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');

  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [currentClassForSubject, setCurrentClassForSubject] = useState<Class | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // --- MODIFICATION: State for editing teacher of a class_subject ---
  const [editTeacherDialogOpen, setEditTeacherDialogOpen] = useState(false);
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubject | null>(null);
  const [newTeacherId, setNewTeacherId] = useState('');


  const { items: sortedItems, requestSort, sortConfig } = useSortableData(classes, { key: 'name', direction: 'ascending' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([ fetchClasses(), fetchSubjects(), fetchTeachers() ]);
    setLoading(false);
  };

  const fetchClasses = async () => {
    // Ensure the query fetches the ID of class_subjects
    const { data, error } = await supabase
      .from('classes')
      .select(`
        id, name, grade,
        class_subjects (
          id,
          subjects ( name ),
          teachers ( id, profiles ( full_name ) )
        )
      `);
    if (error) {
      toast.error('خطا در بارگذاری کلاس‌ها: ' + error.message);
      setClasses([]); // Set empty array on error
      return [];
    } else {
      setClasses((data as Class[]) || []);
      return (data as Class[]) || [];
    }
  };


  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*');
    setSubjects(data || []);
  };

  const fetchTeachers = async () => {
    // Ensure you fetch teacher ID along with profile name
    const { data, error } = await supabase.from('teachers').select('id, profiles(full_name)');
    if(error){
       toast.error('خطا در بارگذاری معلم‌ها: ' + error.message);
       setTeachers([]);
    } else {
       setTeachers((data as Teacher[]) || []);
    }
  };


  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const classData = { name: className, grade };
    let error;
    if (editingClass) {
      ({ error } = await supabase.from('classes').update(classData).eq('id', editingClass.id));
    } else {
      ({ error } = await supabase.from('classes').insert(classData));
    }

    if (error) toast.error(`خطا در ${editingClass ? 'ویرایش' : 'افزودن'} کلاس: ` + error.message);
    else toast.success(`کلاس با موفقیت ${editingClass ? 'ویرایش شد' : 'اضافه شد'}`);

    setClassDialogOpen(false);
    resetClassForm();
    await fetchClasses();
  };

  const handleDeleteClass = async (classId: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', classId);
    if (error) toast.error('خطا در حذف کلاس: ' + error.message);
    else {
      toast.success('کلاس حذف شد');
      await fetchClasses(); // Use await here
    }
  };

  const handleClassSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClassForSubject || !subjectId.trim() || !teacherId.trim()) {
      toast.error("لطفاً تمام فیلدها را انتخاب کنید.");
      return;
    }
    const { error } = await supabase.from('class_subjects').insert({
      class_id: currentClassForSubject.id,
      subject_id: subjectId,
      teacher_id: teacherId
    });

    if (error) toast.error("خطا در تخصیص درس: " + error.message);
    else toast.success("درس با موفقیت به کلاس تخصیص داده شد.");

    setSubjectDialogOpen(false);
    resetSubjectForm();
    await fetchClasses(); // Refresh class data after adding subject
    // No need to manually update currentClassForSubject, fetchClasses will handle it
  };


  const handleDeleteClassSubject = async (classSubjectId: string) => {
      const { error } = await supabase.from('class_subjects').delete().eq('id', classSubjectId);
      if (error) toast.error("خطا در حذف تخصیص: " + error.message);
      else toast.success("تخصیص درس با موفقیت حذف شد.");
      await fetchClasses(); // Refresh class data
  };

  // --- MODIFICATION: Handler for opening edit teacher dialog ---
  const openEditTeacherDialog = (classSubject: ClassSubject) => {
    setEditingClassSubject(classSubject);
    // Find the current teacher's ID to potentially pre-select or exclude
    // const currentTeacherId = teachers.find(t => t.profiles?.full_name === classSubject.teachers?.profiles?.full_name)?.id;
    setNewTeacherId(''); // Reset selection
    setEditTeacherDialogOpen(true);
  };

  // --- MODIFICATION: Handler for submitting teacher change ---
  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassSubject || !newTeacherId) {
      toast.error('لطفاً معلم جدید را انتخاب کنید.');
      return;
    }
    const { error } = await supabase
      .from('class_subjects')
      .update({ teacher_id: newTeacherId })
      .eq('id', editingClassSubject.id);

    if (error) {
       toast.error('خطا در ویرایش معلم: ' + error.message);
    } else {
       toast.success('معلم با موفقیت ویرایش شد.');
    }

    setEditTeacherDialogOpen(false);
    setEditingClassSubject(null);
    setNewTeacherId('');
    await fetchClasses(); // Refresh the class list to show the change
  };


  const handleClassImport = async (data: any[]) => {
      const { error } = await supabase.from('classes').insert(data);
      if (error) return { success: false, errors: [error.message] };
      await fetchClasses();
      return { success: true };
  };

  const openClassDialog = (cls: Class | null) => {
    setEditingClass(cls);
    setClassName(cls ? cls.name : '');
    setGrade(cls ? cls.grade : '');
    setClassDialogOpen(true);
  };

  const openSubjectDialog = (cls: Class) => {
    // Find the latest version of the class from state
    const latestClass = classes.find((c) => c.id === cls.id) || cls;
    setCurrentClassForSubject(latestClass);
    setSubjectDialogOpen(true);
  };


  const resetClassForm = () => { setEditingClass(null); setClassName(''); setGrade(''); };
  const resetSubjectForm = () => { setSubjectId(''); setTeacherId(''); }; // Removed setCurrentClassForSubject(null)

  const filteredClasses = useMemo(() => {
    if(!sortedItems) return [];
    return sortedItems.filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sortedItems, searchTerm]);

  const SortableHeader = ({ sortKey, children }: { sortKey: string, children: React.ReactNode }) => {
    const icon = !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        : sortConfig.direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>
  };

  return (
    <Card>
      <CardHeader>
        {/* Header content remains the same */}
        <div className="flex items-center justify-between">
          <div><CardTitle>مدیریت کلاس‌ها</CardTitle><CardDescription>افزودن کلاس و تخصیص دروس به آن‌ها</CardDescription></div>
          <div className="flex gap-2">
            <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><UserPlus className="w-4 h-4" />وارد کردن کلاس‌ها</Button>}
                requiredFields={{ name: "نام کلاس", grade: "پایه تحصیلی" }}
                onImport={handleClassImport}
                templateFileName="classes-template.xlsx"
            />
            <Dialog open={classDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetClassForm(); setClassDialogOpen(isOpen); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن کلاس</Button></DialogTrigger>
              <DialogContent dir="rtl"><DialogHeader><DialogTitle>{editingClass ? 'ویرایش کلاس' : 'افزودن کلاس جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleClassSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label>نام کلاس</Label><Input value={className} onChange={(e) => setClassName(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>پایه تحصیلی</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} required /></div>
                  <Button type="submit" className="w-full">{editingClass ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی کلاس..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader><TableRow>
                <TableHead className="text-right w-[150px]"><SortableHeader sortKey="name">نام کلاس</SortableHeader></TableHead>
                <TableHead className="text-right w-[100px]"><SortableHeader sortKey="grade">پایه</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="class_subjects.subjects.name">دروس</SortableHeader></TableHead>
                <TableHead className="text-right">معلم ها</TableHead> {/* Removed sorting for teachers column as it's complex */}
                <TableHead className="text-right w-[200px]">عملیات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">هیچ کلاسی یافت نشد</TableCell></TableRow> : (
                filteredClasses.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.grade}</TableCell>
                    {/* Display Subjects */}
                    <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {cls.class_subjects.map(cs => (
                                cs.subjects?.name ?
                                <Badge key={cs.id} variant="secondary" className="flex items-center gap-1">
                                    {cs.subjects.name}
                                    {/* Delete Subject Assignment Button */}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1 text-destructive hover:bg-destructive/10">
                                                <Trash2 className="w-3 h-3" />
                                             </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent dir="rtl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>حذف تخصیص درس</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    آیا از حذف درس "{cs.subjects.name}" از کلاس "{cls.name}" مطمئن هستید؟
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>انصراف</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteClassSubject(cs.id)}>حذف</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </Badge>
                                : null
                            ))}
                        </div>
                    </TableCell>
                    {/* Display Teachers with Edit Button */}
                    <TableCell>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                        {cls.class_subjects.map(cs => cs.subjects?.name && cs.teachers?.profiles?.full_name ? (
                          <span key={cs.id} className="flex items-center gap-1">
                            <Badge variant="outline">{cs.teachers.profiles.full_name} ({cs.subjects.name})</Badge>
                            {/* --- MODIFICATION: Added Edit Teacher Button --- */}
                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => openEditTeacherDialog(cs)} title={`ویرایش معلم درس ${cs.subjects.name}`}>
                              <Edit2 className="w-3 h-3 text-primary" />
                            </Button>
                          </span>
                        ) : null).filter(Boolean)}
                      </div>
                    </TableCell>
                    {/* Actions Cell remains the same */}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openClassDialog(cls)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => openSubjectDialog(cls)}><BookOpen className="w-4 h-4 ml-1"/>تخصیص درس</Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                                <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل تمام تخصیص‌های درس و معلم به این کلاس را نیز حذف می‌کند.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteClass(cls.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Assign Subject Dialog remains the same */}
      <Dialog open={subjectDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetSubjectForm(); setSubjectDialogOpen(isOpen); }}>
        <DialogContent dir="rtl" aria-describedby="assign-desc">
          <DialogHeader>
            <DialogTitle>تخصیص درس به کلاس {currentClassForSubject?.name}</DialogTitle>
          </DialogHeader>
          <div id="assign-desc" className="sr-only">فرم تخصیص درس و معلم به کلاس انتخاب شده</div>
          <form onSubmit={handleClassSubjectSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>درس</Label>
              <Select value={subjectId || ''} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="انتخاب درس..." /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>معلم</Label>
              <Select value={teacherId || ''} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="انتخاب معلم..." /></SelectTrigger>
                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.profiles?.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">تخصیص</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MODIFICATION: Added Edit Teacher Dialog --- */}
      <Dialog open={editTeacherDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingClassSubject(null); setEditTeacherDialogOpen(isOpen); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش معلم درس "{editingClassSubject?.subjects?.name}"</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditTeacherSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>معلم جدید</Label>
              <Select value={newTeacherId} onValueChange={setNewTeacherId} required>
                <SelectTrigger><SelectValue placeholder="انتخاب معلم جدید..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.profiles?.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">ثبت تغییرات</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ClassesManagement;
