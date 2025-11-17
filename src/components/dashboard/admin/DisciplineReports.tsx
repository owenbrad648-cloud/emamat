import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
// --- MODIFICATION: Import Pencil icon, Dialog components, Label, Textarea ---
import { Search, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
// --- END MODIFICATION ---
import * as XLSX from 'xlsx';
import { format, parse } from "date-fns-jalali"; // <-- Import parse
import { useSortableData } from '@/hooks/use-sortable-data';

// Interface definitions
interface DisciplineRecord {
  id: string; // Ensure ID is selected
  description: string;
  severity: string;
  created_at: string;
  students: { full_name: string } | null;
  classes: { id: string, name: string } | null;
  profiles: { full_name: string } | null;
}

interface ClassInfo {
    id: string;
    name: string;
}

// --- MODIFICATION: Type and translations for Severity ---
type SeverityLevel = 'low' | 'medium' | 'high';
const severityLevels: SeverityLevel[] = ['low', 'medium', 'high'];
const severityTranslations: Record<SeverityLevel, string> = {
    low: 'کم',
    medium: 'متوسط',
    high: 'شدید'
};
// --- END MODIFICATION ---
const safeFormatDate = (dateString?: string, pattern = 'yyyy/MM/dd') => {
  if (!dateString) return 'نامشخص'; // اگر تاریخ نامشخص باشد، "نامشخص" نشان بده
  const parsed = new Date(dateString); // تلاش برای تبدیل به تاریخ
  if (isNaN(parsed.getTime())) return 'نامشخص'; // اگر تاریخ نامعتبر بود، "نامشخص" بازگشت بده
  try {
    return format(parsed, pattern); // تاریخ معتبر را فرمت کن
  } catch {
    return 'نامشخص'; // اگر خطای دیگری رخ داد، "نامشخص" بازگشت بده
  }
};

const DisciplineReports = () => {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [date, setDate] = useState<Date | undefined>();

  // --- MODIFICATION: Add state for edit dialog ---
  const [editDisciplineDialogOpen, setEditDisciplineDialogOpen] = useState(false);
  const [editingDisciplineRecord, setEditingDisciplineRecord] = useState<DisciplineRecord | null>(null);
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('low');
  const [isUpdatingDiscipline, setIsUpdatingDiscipline] = useState(false);
  // --- END MODIFICATION ---

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(records, { key: 'created_at', direction: 'descending' });

  useEffect(() => {
    fetchClasses();
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    // Ensure 'id' is selected
    const { data, error } = await supabase
      .from('discipline_records')
      .select('id, description, severity, created_at, students(full_name), classes(id, name), profiles(full_name)');

    if (error) toast.error('خطا در بارگذاری گزارش‌ها: ' + error.message);
    else setRecords((data as DisciplineRecord[]) || []);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  const filteredRecords = useMemo(() => {
    if (!sortedItems) return [];
    return sortedItems.filter(record => {
      const searchTermLower = searchTerm.toLowerCase();
      // Ensure properties exist before accessing them and calling toLowerCase
      const nameMatch = record.students?.full_name?.toLowerCase().includes(searchTermLower) ?? false;
      const classMatch = filterClassId === 'all' || record.classes?.id === filterClassId;
      // Compare the date part only
      const recordDateStr = record.created_at ? safeFormatDate(record.created_at, 'yyyy-MM-dd') : null;

      const filterDateStr = date ? format(date, 'yyyy-MM-dd') : null;
      const dateMatch = !date || (recordDateStr && filterDateStr && recordDateStr === filterDateStr);

      return nameMatch && classMatch && dateMatch;
    });
  }, [sortedItems, searchTerm, filterClassId, date]);


  const getSeverityBadge = (severity: string) => {
    // --- MODIFICATION: Use severityTranslations ---
    switch (severity as SeverityLevel) {
      case 'low': return <Badge className="bg-green-500 hover:bg-green-600">{severityTranslations.low}</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{severityTranslations.medium}</Badge>;
      case 'high': return <Badge variant="destructive">{severityTranslations.high}</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
    // --- END MODIFICATION ---
  };

  // --- MODIFICATION: Function to handle Excel export (translate severity) ---
   const handleExport = () => {
        if (filteredRecords.length === 0) {
            toast.info('داده‌ای برای خروجی گرفتن وجود ندارد.');
            return;
        }

        const dataToExport = filteredRecords.map(record => ({
            'دانش‌آموز': record.students?.full_name || 'نامشخص',
            'کلاس': record.classes?.name || 'نامشخص',
            'شرح': record.description,
            'شدت': severityTranslations[record.severity as SeverityLevel] || record.severity, // Translate severity
'تاریخ ثبت': record.created_at ? safeFormatDate(record.created_at, 'yyyy/MM/dd HH:mm') : 'نامشخص',

            'ثبت توسط': record.profiles?.full_name || 'نامشخص',
        }));
        // ... rest of the export function remains the same ...
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'گزارش انضباطی');

        let filename = 'گزارش_انضباطی';
        if (filterClassId !== 'all') {
            const className = classes.find(c => c.id === filterClassId)?.name || 'کلاس_نامشخص';
            filename += `_${className.replace(/\s+/g, '_')}`;
        }
        if (date) {
            filename += `_${format(date, 'yyyy-MM-dd')}`;
        }
        filename += '.xlsx';

        XLSX.writeFile(wb, filename);
        toast.success('فایل اکسل با موفقیت ایجاد شد.');
    };
  // --- END MODIFICATION ---

  // --- MODIFICATION: Function to open the edit discipline dialog ---
  const openEditDisciplineDialog = (record: DisciplineRecord) => {
      setEditingDisciplineRecord(record);
      setNewDescription(record.description);
      setNewSeverity(record.severity as SeverityLevel);
      setEditDisciplineDialogOpen(true);
  };
  // --- END MODIFICATION ---

  // --- MODIFICATION: Function to handle the discipline update ---
  const handleUpdateDiscipline = async () => {
      if (!editingDisciplineRecord) return;
      setIsUpdatingDiscipline(true);

      const { error } = await supabase
          .from('discipline_records')
          .update({
              description: newDescription,
              severity: newSeverity
          })
          .eq('id', editingDisciplineRecord.id);

      if (error) {
          toast.error('خطا در ویرایش مورد انضباطی: ' + error.message);
      } else {
          toast.success('مورد انضباطی با موفقیت ویرایش شد.');
          setEditDisciplineDialogOpen(false); // Close dialog
          fetchRecords(); // Refresh data
      }
      setIsUpdatingDiscipline(false);
      setEditingDisciplineRecord(null); // Reset editing state
  };
  // --- END MODIFICATION ---


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
        <CardTitle>گزارش موارد انضباطی</CardTitle>
        {/* --- MODIFICATION: Updated description --- */}
        <CardDescription>مشاهده، فیلتر، ویرایش و خروجی تمام موارد انضباطی ثبت شده</CardDescription>
        {/* --- END MODIFICATION --- */}
        <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="relative flex-grow min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی نام دانش آموز..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger><SelectContent><SelectItem value="all">همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
             <Popover>
                <PopoverTrigger asChild><Button variant={"outline"} className="w-full sm:w-[240px] justify-start text-right font-normal"><CalendarIcon className="ml-2 h-4 w-4" />{date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent>
            </Popover>
             <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterClassId('all'); setDate(undefined); }}>پاک کردن فیلترها</Button>
              {/* Export Button remains */}
             <Button onClick={handleExport} variant="outline" className="gap-2">
                 <FileDown className="w-4 h-4" />
                 خروجی اکسل
             </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="students.full_name">دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="classes.name">کلاس</SortableHeader></TableHead>
                <TableHead className="text-right w-[40%]"><SortableHeader sortKey="description">شرح</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="severity">شدت</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="created_at">تاریخ</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="profiles.full_name">ثبت توسط</SortableHeader></TableHead>
                {/* --- MODIFICATION: Added Edit Header --- */}
                <TableHead className="text-right w-[50px]">ویرایش</TableHead>
                {/* --- END MODIFICATION --- */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">هیچ سابقه‌ای یافت نشد</TableCell></TableRow> : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.students?.full_name || 'نامشخص'}</TableCell>
                    <TableCell>{record.classes?.name || 'نامشخص'}</TableCell>
                    <TableCell>{record.description}</TableCell>
                    <TableCell>{getSeverityBadge(record.severity)}</TableCell>
                    <TableCell>{safeFormatDate(record.created_at, 'yyyy/MM/dd HH:mm')}</TableCell>

                    <TableCell>{record.profiles?.full_name || 'نامشخص'}</TableCell>
                    {/* --- MODIFICATION: Added Edit Button Cell --- */}
                    <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDisciplineDialog(record)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">ویرایش</span>
                        </Button>
                    </TableCell>
                    {/* --- END MODIFICATION --- */}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* --- MODIFICATION: Edit Discipline Dialog --- */}
      <Dialog open={editDisciplineDialogOpen} onOpenChange={setEditDisciplineDialogOpen}>
          <DialogContent dir="rtl">
              <DialogHeader>
                  <DialogTitle>ویرایش مورد انضباطی</DialogTitle>
                  <DialogDescription>
                      ویرایش مورد ثبت شده برای دانش آموز "{editingDisciplineRecord?.students?.full_name}"
                      در کلاس "{editingDisciplineRecord?.classes?.name}"
({editingDisciplineRecord?.created_at ? safeFormatDate(editingDisciplineRecord.created_at, 'yyyy/MM/dd') : ''})

                  </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="edit-discipline-desc">شرح جدید</Label>
                      <Textarea
                          id="edit-discipline-desc"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          required
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="edit-discipline-severity">شدت جدید</Label>
                      <Select value={newSeverity} onValueChange={(value) => setNewSeverity(value as SeverityLevel)}>
                          <SelectTrigger id="edit-discipline-severity">
                              <SelectValue placeholder="انتخاب شدت..." />
                          </SelectTrigger>
                          <SelectContent>
                              {severityLevels.map(level => (
                                  <SelectItem key={level} value={level}>{severityTranslations[level]}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDisciplineDialogOpen(false)}>انصراف</Button>
                  <Button onClick={handleUpdateDiscipline} disabled={isUpdatingDiscipline}>
                      {isUpdatingDiscipline ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      {/* --- END MODIFICATION --- */}
    </Card>
  );
};

export default DisciplineReports;

