import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExcelImportDialog } from './ExcelImportDialog';
import { useSortableData } from '@/hooks/use-sortable-data';

interface Subject {
  id: string;
  name: string;
}

const SubjectsManagement = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(subjects, { key: 'name', direction: 'ascending' });

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('subjects').select('*');
    if (error) {
      toast.error('خطا در بارگذاری درس‌ها');
    } else {
      setSubjects(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubject) {
      const { error } = await supabase.from('subjects').update({ name: subjectName }).eq('id', editingSubject.id);
      if (error) toast.error('خطا در ویرایش درس');
      else toast.success('درس با موفقیت ویرایش شد');
    } else {
      const { error } = await supabase.from('subjects').insert({ name: subjectName });
      if (error) toast.error('خطا در افزودن درس');
      else toast.success('درس با موفقیت اضافه شد');
    }
    setOpen(false);
    resetForm();
    await fetchSubjects();
  };
  
  const handleDelete = async (subjectId: string) => {
    const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
    if (error) toast.error('خطا در حذف درس: ' + error.message);
    else {
        toast.success('درس حذف شد.');
        await fetchSubjects();
    }
  };
  
  const handleImport = async (data: any[]) => {
      const subjectsToInsert = data.map(row => ({ name: row.subject_name }));
      const { error } = await supabase.from('subjects').insert(subjectsToInsert);
      if (error) {
          return { success: false, errors: [error.message] };
      }
      await fetchSubjects();
      return { success: true };
  };

  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectName(subject.name);
    setOpen(true);
  };

  const resetForm = () => {
    setEditingSubject(null);
    setSubjectName('');
  };

  const filteredSubjects = useMemo(() => {
    if (!sortedItems) return [];
    return sortedItems.filter(sub => sub.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sortedItems, searchTerm]);

  const SortableHeader = ({ sortKey, children }: { sortKey: string, children: React.ReactNode }) => {
    const icon = !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : sortConfig.direction === 'ascending'
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>مدیریت درس‌ها</CardTitle>
            <CardDescription>افزودن، ویرایش و حذف درس‌ها</CardDescription>
          </div>
          <div className="flex gap-2">
            <ExcelImportDialog
                triggerButton={<Button variant="outline" className="gap-2"><UserPlus className="w-4 h-4" />وارد کردن از فایل</Button>}
                requiredFields={{ subject_name: "نام درس" }}
                onImport={handleImport}
                templateFileName="subjects-template.xlsx"
            />
            <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />افزودن درس</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>{editingSubject ? 'ویرایش درس' : 'افزودن درس جدید'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2"><Label htmlFor="subjectName">نام درس</Label><Input id="subjectName" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required /></div>
                  <Button type="submit" className="w-full">{editingSubject ? 'ویرایش' : 'افزودن'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام درس..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="name">نام درس</SortableHeader></TableHead>
                <TableHead className="text-right w-[120px]">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubjects.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">هیچ درسی یافت نشد</TableCell></TableRow> : (
                filteredSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>{subject.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(subject)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle>آیا مطمئن هستید؟</AlertDialogTitle><AlertDialogDescription>این عمل قابل بازگشت نیست و این درس به طور کامل حذف خواهد شد.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(subject.id)}>حذف</AlertDialogAction></AlertDialogFooter>
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
    </Card>
  );
};

export default SubjectsManagement;

