import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client'; // بازگشت به مسیر مستعار
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // بازگشت به مسیر مستعار
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // بازگشت به مسیر مستعار
import { Badge } from '@/components/ui/badge'; // بازگشت به مسیر مستعار
import { toast } from 'sonner';
import { Input } from "@/components/ui/input"; // بازگشت به مسیر مستعار
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // بازگشت به مسیر مستعار
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // بازگشت به مسیر مستعار
import { Button } from "@/components/ui/button"; // بازگشت به مسیر مستعار
import { Calendar } from "@/components/ui/calendar"; // بازگشت به مسیر مستعار
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"; // بازگشت به مسیر مستعار
import { Search, Calendar as CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'; // بازگشت به مسیر مستعار
import { Label } from '@/components/ui/label'; // بازگشت به مسیر مستعار
import { Checkbox } from '@/components/ui/checkbox'; // بازگشت به مسیر مستعار
import * as XLSX from 'xlsx';
import { format, parse } from "date-fns-jalali";

// Interface definitions
interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  is_justified: boolean | null;
  lesson_period: number;
  students: { full_name: string } | null;
  class_subjects: {
    classes: { id: string, name: string } | null;
    subjects: { name: string } | null;
    // افزودن معلم برای پاپ‌آپ جزئیات
    teachers: { profiles: { full_name: string } | null } | null;
  } | null;
  profiles: { full_name: string } | null;
}

// اینترفیس جدید برای رکوردهای تجمیعی
interface AggregatedAbsence {
  id: string; // student_id + date
  student_name: string | null;
  class_name: string | null;
  date: string;
  total_absences: number;
  lesson_periods: number[];
  is_justified: boolean; // True if ANY are justified
  details: AttendanceRecord[]; // All original records for this group
}


interface ClassInfo {
    id: string;
    name: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late';
const attendanceStatuses: AttendanceStatus[] = ['present', 'absent', 'late'];
const statusTranslations: Record<AttendanceStatus | string, string> = {
    present: 'حاضر',
    absent: 'غایب',
    late: 'تأخیر'
};

const justificationTranslations: Record<string, string> = {
    justified: 'موجه',
    unjustified: 'غیر موجه',
    na: '-'
};


const AttendanceReports = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [date, setDate] = useState<Date | undefined>(new Date());
  // filterStatus دیگر استفاده نمی‌شود چون فقط غایبین نمایش داده می‌شوند
  // const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterJustification, setFilterJustification] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 100;

  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'date', ascending: false });

  // Edit Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [isUpdating, setIsUpdating] = useState(false);
  const [newJustified, setNewJustified] = useState<boolean>(false);
  
  // Detail Dialog (Popup) state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<AggregatedAbsence | null>(null);


  const fetchRecords = useCallback(async (page: number) => {
    setLoading(true);
    const from = page * recordsPerPage;
    const to = from + recordsPerPage - 1;

    let query = supabase
      .from('attendance')
      .select(
        // کوئری آپدیت شد تا نام معلم را برای پاپ‌آپ جزئیات دریافت کند
        'id, date, status, is_justified, lesson_period, students!inner(full_name), class_subjects!inner(classes!inner(id, name), subjects(name), teachers(profiles(full_name))), profiles(full_name)',
        { count: 'exact' }
      );

    // فیلتر برای نمایش *فقط* غایبین
    query = query.eq('status', 'absent');

    // اعمال سایر فیلترها
    if (searchTerm) {
      query = query.ilike('students.full_name', `%${searchTerm}%`);
    }
    if (filterClassId !== 'all') {
      query = query.eq('class_subjects.classes.id', filterClassId);
    }
    if (date) {
      query = query.eq('date', format(date, 'yyyy-MM-dd'));
    }
    // فیلتر وضعیت حذف شد چون همیشه غایب است
    // if (filterStatus !== 'all') { ... } 
    
    if (filterJustification === 'justified') {
      query = query.eq('is_justified', true);
    } else if (filterJustification === 'unjustified') {
      query = query.or('is_justified.is.null,is_justified.eq.false');
    }

    // اعمال مرتب‌سازی
    const { key, ascending } = sortConfig;
    if (key === 'students.full_name') {
      query = query.order('full_name', { referencedTable: 'students', ascending });
    } else if (key === 'profiles.full_name') {
      query = query.order('full_name', { referencedTable: 'profiles', ascending });
    } else {
      query = query.order(key, { ascending });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast.error('خطا در بارگذاری گزارش‌ها: ' + error.message);
      setRecords([]);
      setTotalRecords(0);
    } else {
      setRecords((data as AttendanceRecord[]) || []);
      setTotalRecords(count || 0);
    }
    setLoading(false);
  // filterStatus از dependency array حذف شد
  }, [searchTerm, filterClassId, date, filterJustification, sortConfig, recordsPerPage]); 

  // fetchClasses effect
  useEffect(() => {
    fetchClasses();
  }, []);

  // Effect برای fetch داده‌ها
  useEffect(() => {
    fetchRecords(currentPage);
  }, [currentPage, fetchRecords]);

  // Effect برای ریست کردن صفحه
  useEffect(() => {
    setCurrentPage(0);
  // filterStatus از dependency array حذف شد
  }, [searchTerm, filterClassId, date, filterJustification, sortConfig]);


  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    setClasses(data || []);
  };

  // تجمیع رکوردها برای نمایش در جدول اصلی
  const aggregatedRecords = useMemo(() => {
    const groups = new Map<string, AggregatedAbsence>();

    records.forEach(record => {
      if (!record.students) return; // نباید اتفاق بیفتد
      
      const key = `${record.students.full_name}_${record.date}`; // تجمیع بر اساس نام دانش‌آموز و تاریخ
      
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          student_name: record.students.full_name,
          class_name: record.class_subjects?.classes?.name || null,
          date: record.date,
          total_absences: 0,
          lesson_periods: [],
          is_justified: false, // اگر حتی یکی موجه باشد true می‌شود
          details: []
        });
      }

      const group = groups.get(key)!;
      group.total_absences += 1;
      group.lesson_periods.push(record.lesson_period);
      if (record.is_justified) {
        group.is_justified = true;
      }
      group.details.push(record);
    });

    // مرتب‌سازی ساعت‌های غیبت
    groups.forEach(group => {
      group.lesson_periods.sort((a, b) => a - b);
    });

    return Array.from(groups.values());
  }, [records]);


  // تابع getStatusBadge (برای پاپ‌آپ ویرایش)
  const getStatusBadge = (status: string) => {
    switch (status as AttendanceStatus) {
      case 'present': return <Badge className="bg-green-500 hover:bg-green-600">{statusTranslations.present}</Badge>;
      case 'absent': return <Badge variant="destructive">{statusTranslations.absent}</Badge>;
      case 'late': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">{statusTranslations.late}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // تابع getJustificationText (برای پاپ‌آپ جزئیات و ویرایش)
  const getJustificationText = (record: AttendanceRecord): string => {
      if (record.status !== 'absent') {
          return justificationTranslations.na;
      }
      if (record.is_justified === true) {
          return justificationTranslations.justified;
      }
      return justificationTranslations.unjustified;
  };
  
  // تابع جدید برای نمایش وضعیت تجمیعی
  const getAggregatedJustificationText = (record: AggregatedAbsence): string => {
      if (record.is_justified) {
          return justificationTranslations.justified;
      }
      return justificationTranslations.unjustified;
  };


   const handleExport = () => {
        // ... (منطق خروجی اکسل، نیازی به تغییر ندارد، از `aggregatedRecords` استفاده می‌کند) ...
        // اصلاح: از `aggregatedRecords` استفاده می‌کنیم
        if (aggregatedRecords.length === 0) {
            toast.info('داده‌ای برای خروجی گرفتن وجود ندارد.');
            return;
        }

        const dataToExport = aggregatedRecords.flatMap(record => 
            record.details.map(detail => ({
                'دانش‌آموز': record.student_name || 'نامشخص',
                'کلاس': record.class_name || 'نامشخص',
                'تاریخ': record.date ? format(parse(record.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : 'نامشخص',
                'ساعت': detail.lesson_period,
                'درس': detail.class_subjects?.subjects?.name || 'نامشخص',
                'معلم': detail.class_subjects?.teachers?.profiles?.full_name || 'نامشخص',
                'وضعیت': statusTranslations[detail.status] || detail.status,
                'توجیه غیبت': getJustificationText(detail),
                'ثبت توسط': detail.profiles?.full_name || 'نامشخص',
            }))
        );

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'گزارش حضور و غیاب');

        let filename = 'گزارش_غیبت‌ها';
        // ... (بقیه منطق نام‌گذاری فایل) ...
        if (filterClassId !== 'all') {
            const className = classes.find(c => c.id === filterClassId)?.name || 'کلاس_نامشخص';
            filename += `_${className.replace(/\s+/g, '_')}`;
        }
        if (date) {
            filename += `_${format(date, 'yyyy-MM-dd')}`;
        }
        if (filterJustification !== 'all') {
            filename += `_${justificationTranslations[filterJustification] || filterJustification}`;
        }
        filename += '.xlsx';

        XLSX.writeFile(wb, filename);
        toast.success('فایل اکسل با موفقیت ایجاد شد.');
    };

  // تابع باز کردن پاپ‌آپ ویرایش (موجود)
  const openEditDialog = (record: AttendanceRecord) => {
      setEditingRecord(record);
      setNewStatus(record.status as AttendanceStatus);
      setNewJustified(record.status === 'absent' ? (record.is_justified ?? false) : false);
      setEditDialogOpen(true);
  };
  
  // تابع باز کردن پاپ‌آپ جزئیات (جدید)
  const openDetailDialog = (record: AggregatedAbsence) => {
    setSelectedDetail(record);
    setDetailDialogOpen(true);
  };


  const handleUpdateAttendance = async () => {
      if (!editingRecord) return;
      setIsUpdating(true);
      
      const updateData: { status: AttendanceStatus; is_justified: boolean | null } = {
          status: newStatus,
          is_justified: newStatus === 'absent' ? newJustified : null
      };

      const { error } = await supabase
          .from('attendance')
          .update(updateData)
          .eq('id', editingRecord.id);

      if (error) {
          toast.error('خطا در ویرایش وضعیت: ' + error.message);
      } else {
          toast.success('وضعیت با موفقیت ویرایش شد.');
          setEditDialogOpen(false);
          // بستن پاپ‌آپ جزئیات اگر باز بود
          setDetailDialogOpen(false); 
          fetchRecords(currentPage); // رفرش کردن داده‌ها
      }
      setIsUpdating(false);
      setEditingRecord(null);
  };

  const requestSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      ascending: prev.key === key ? !prev.ascending : true
    }));
  };

  const SortableHeader = ({ sortKey, children, disabled = false }: { sortKey: string, children: React.ReactNode, disabled?: boolean }) => {
    const icon = !sortConfig || sortConfig.key !== sortKey
        ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
        : sortConfig.ascending
        ? <ArrowUp className="mr-2 h-4 w-4" />
        : <ArrowDown className="mr-2 h-4 w-4" />;
    return <Button variant="ghost" onClick={() => !disabled && requestSort(sortKey)} disabled={disabled}>{children}{!disabled && icon}</Button>
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return (
    <Card>
      <CardHeader>
        <CardTitle>گزارش غیبت‌ها</CardTitle>
        <CardDescription>مشاهده، فیلتر و ویرایش غیبت‌های ثبت شده</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
            {/* Search Input */}
            <div className="relative flex-grow min-w-[180px] sm:min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="جستجوی دانش آموز..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" dir="rtl"/></div>
            {/* Class Filter */}
            <Select value={filterClassId} onValueChange={setFilterClassId}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="فیلتر کلاس" /></SelectTrigger><SelectContent><SelectItem value="all">همه کلاس‌ها</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            {/* Status Filter (حذف شد) */}
            {/* <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger ... </SelectTrigger>...</Select> */}
            
            {/* Justification Filter */}
            <Select value={filterJustification} onValueChange={setFilterJustification}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="فیلتر توجیه" /></SelectTrigger><SelectContent><SelectItem value="all">همه غیبت‌ها</SelectItem><SelectItem value="justified">موجه</SelectItem><SelectItem value="unjustified">غیر موجه</SelectItem></SelectContent></Select>
            {/* Date Filter */}
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full sm:w-auto justify-start text-right font-normal">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>انتخاب تاریخ</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} />
                </PopoverContent>
            </Popover>

            {/* Clear Filters Button */}
             <Button variant="outline" onClick={() => { setSearchTerm(''); setFilterClassId('all'); setDate(undefined); /* setFilterStatus('all'); */ setFilterJustification('all'); }}>پاک کردن</Button>
              {/* Export Button */}
             <Button onClick={handleExport} variant="outline" className="gap-2">
                 <FileDown className="w-4 h-4" />
                 خروجی
             </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="text-center py-8">در حال بارگذاری...</div> : (
          <>
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right"><SortableHeader sortKey="students.full_name">دانش‌آموز</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="class_subjects.classes.name" disabled>کلاس</SortableHeader></TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="date">تاریخ</SortableHeader></TableHead>
                <TableHead className="text-right">ساعت‌های غیبت</TableHead>
                <TableHead className="text-right"><SortableHeader sortKey="is_justified">وضعیت توجیه</SortableHeader></TableHead>
                {/* ستون‌های اضافی حذف شدند */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {aggregatedRecords.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">هیچ غیبتی یافت نشد</TableCell></TableRow> : (
                aggregatedRecords.map((record) => (
                  <TableRow key={record.id} onClick={() => openDetailDialog(record)} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>{record.student_name}</TableCell>
                    <TableCell>{record.class_name}</TableCell>
                    <TableCell>{record.date ? format(parse(record.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : 'نامشخص'}</TableCell>
                    <TableCell>{record.lesson_periods.join(', ')}</TableCell>
                    <TableCell>
                      <Badge variant={record.is_justified ? "default" : "outline"} className={record.is_justified ? "bg-blue-500 hover:bg-blue-600" : ""}>
                        {getAggregatedJustificationText(record)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 p-4" dir="ltr">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 0}
            >
                قبلی
            </Button>
            <span className="text-sm text-muted-foreground">
                صفحه {currentPage + 1} از {totalPages > 0 ? totalPages : 1} (کل غیبت‌ها: {totalRecords} مورد)
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage + 1 >= totalPages}
            >
                بعدی
            </Button>
          </div>
          </>
        )}
      </CardContent>

      {/* Detail Dialog (Popup) */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>جزئیات غیبت‌های {selectedDetail?.student_name}</DialogTitle>
            <DialogDescription>
              تاریخ: {selectedDetail?.date ? format(parse(selectedDetail.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">ساعت</TableHead>
                  <TableHead className="text-right">درس</TableHead>
                  <TableHead className="text-right">معلم</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right w-[50px]">ویرایش</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDetail?.details.map(detailRecord => (
                  <TableRow key={detailRecord.id}>
                    <TableCell>{detailRecord.lesson_period}</TableCell>
                    <TableCell>{detailRecord.class_subjects?.subjects?.name || '-'}</TableCell>
                    <TableCell>{detailRecord.class_subjects?.teachers?.profiles?.full_name || '-'}</TableCell>
                    <TableCell>{getJustificationText(detailRecord)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setDetailDialogOpen(false); // بستن پاپ‌آپ جزئیات
                        openEditDialog(detailRecord); // باز کردن پاپ‌آپ ویرایش
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog (بدون تغییر) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش وضعیت حضور و غیاب</DialogTitle>
            <DialogDescription>
              تغییر وضعیت برای دانش آموز "{editingRecord?.students?.full_name}" در تاریخ {editingRecord?.date ? format(parse(editingRecord.date, 'yyyy-MM-dd', new Date()), 'yyyy/MM/dd') : ''}،
              ساعت {editingRecord?.lesson_period}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
              <div className="space-y-2">
                  <Label htmlFor="edit-status">وضعیت جدید</Label>
                  <Select value={newStatus} onValueChange={(value) => setNewStatus(value as AttendanceStatus)}>
                      <SelectTrigger id="edit-status">
                          <SelectValue placeholder="انتخاب وضعیت..." />
                      </SelectTrigger>
                      <SelectContent>
                          {attendanceStatuses.map(status => (
                              <SelectItem key={status} value={status}>{statusTranslations[status]}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              {newStatus === 'absent' && (
                  <div className="flex items-center space-x-2 space-x-reverse pt-2">
                      <Checkbox
                          id="edit-justified"
                          checked={newJustified}
                          onCheckedChange={(checked) => setNewJustified(Boolean(checked))}
                      />
                      <Label htmlFor="edit-justified" className="cursor-pointer">
                          غیبت موجه است؟
                      </Label>
                  </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>انصراف</Button>
            <Button onClick={handleUpdateAttendance} disabled={isUpdating}>
                {isUpdating ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AttendanceReports;
