import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, ArrowRight, FileText, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react'; // Added CheckCircle
import * as XLSX from 'xlsx';
import { Label } from '@/components/ui/label';
import { Input } from "@/components/ui/input";

interface ExcelImportDialogProps {
  requiredFields: Record<string, string>; // { api_key: "Display Name" }
  optionalFields?: Record<string, string>;
  onImport: (data: Record<string, any>[]) => Promise<{ success: boolean; results?: any[]; errors?: string[] }>;
  templateGenerator: () => void;
  entityName: string; // e.g., "معلم", "دانش‌آموز"
}

export const ExcelImportDialog = ({ requiredFields, optionalFields = {}, onImport, templateGenerator, entityName }: ExcelImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Preview, 4: Results
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // { "Header From Excel": "api_key" }
  const [importResults, setImportResults] = useState<{ success: boolean; results?: any[]; errors?: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allFields = { ...requiredFields, ...optionalFields };
  const allFieldKeys = Object.keys(allFields);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary', cellFormula: false, cellHTML: false });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          // Read headers specifically using header: 1
          const headerData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (headerData.length < 1) {
            toast.error("فایل اکسل خالی است.");
            resetState();
            return;
          }

          // Filter out null, undefined, or empty string headers BEFORE using them
          const fileHeaders = headerData[0].map(String).filter(h => h && h.trim() !== '');
          if (fileHeaders.length === 0) {
             toast.error("فایل اکسل سربرگ معتبر ندارد.");
             resetState();
             return;
          }
          setHeaders(fileHeaders); // Set the valid headers

          // Read actual data using the valid headers
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

           if (jsonData.length === 0) {
             toast.error("فایل اکسل داده‌ای ندارد (فقط شامل سربرگ است).");
             // Keep headers for mapping, but clear data
             setData([]);
             setStep(2); // Still allow mapping
             return;
           }


          // Process data, ensuring all values are strings
          const fileData = jsonData.map(row => {
            let rowData: Record<string, any> = {};
             // Iterate over valid headers found previously
            fileHeaders.forEach((header) => {
              // Convert all cell values to string
              rowData[header] = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
            });
            return rowData;
          });

          setData(fileData);
          setStep(2); // Move to column mapping

          // Auto-map columns
          const initialMapping: Record<string, string> = {};
          fileHeaders.forEach(header => {
              const foundKey = allFieldKeys.find(key => allFields[key].toLowerCase() === header.toLowerCase());
              if (foundKey) {
                  initialMapping[header] = foundKey;
              }
          });
          setColumnMapping(initialMapping);

        } catch (error) {
           toast.error("خطا در خواندن فایل اکسل. لطفاً از فرمت صحیح اطمینان حاصل کنید.");
           console.error("Excel read error:", error);
           resetState();
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  // *** FIX: Corrected logic to check requiredFields keys against mapped values ***
  const isMappingComplete = useMemo(() => {
    const mappedApiKeys = Object.values(columnMapping);
    // requiredFields is an object, iterate over its keys
    return Object.keys(requiredFields).every(reqKey => mappedApiKeys.includes(reqKey));
  }, [columnMapping, requiredFields]);


  const handleMappingChange = (excelHeader: string, apiKey: string) => {
    setColumnMapping(prev => ({ ...prev, [excelHeader]: apiKey }));
  };

  const handleProceedToPreview = () => {
    if (!isMappingComplete) {
      toast.error("لطفاً تمام ستون‌های الزامی را نگاشت کنید.");
      return;
    }
    if (data.length === 0) {
        toast.warn("فایل اکسل داده ای برای پیش نمایش یا وارد کردن ندارد.");
        return;
    }
    setStep(3);
  };

  const getMappedData = () => {
    return data.map(row => {
      let mappedRow: Record<string, any> = {};
      for (const excelHeader in columnMapping) {
        const apiKey = columnMapping[excelHeader];
        // Ensure apiKey is valid and exists in allFields before mapping
        if (apiKey && allFieldKeys.includes(apiKey)) {
          mappedRow[apiKey] = row[excelHeader];
        }
      }
      return mappedRow;
    });
  };

  const handleImport = async () => {
    setIsLoading(true);
    setImportResults(null); // Clear previous results
    const mappedData = getMappedData();
    if (mappedData.length === 0) {
        toast.error("هیچ داده معتبری برای وارد کردن وجود ندارد.");
        setIsLoading(false);
        setStep(4); // Show empty results
        setImportResults({ success: true, results: [], errors: ["هیچ داده‌ای برای وارد کردن یافت نشد."] });
        return;
    }
    const result = await onImport(mappedData);
    setImportResults(result);
    setIsLoading(false);
    setStep(4); // Move to results step
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setData([]);
    setColumnMapping({});
    setImportResults(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
  };

  const closeModal = () => {
      setOpen(false);
      // Delay reset to allow dialog close animation
      setTimeout(resetState, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) closeModal(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          وارد کردن از اکسل
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>وارد کردن دسته‌جمعی {entityName}</DialogTitle>
          <DialogDescription>
            {step === 1 && `فایل اکسل حاوی اطلاعات ${entityName}ها را بارگذاری کنید.`}
            {step === 2 && "ستون‌های فایل اکسل را به فیلدهای برنامه نگاشت کنید. (* الزامی)"}
            {step === 3 && `پیش‌نمایش داده‌ها قبل از وارد کردن نهایی. (${data.length} ردیف)`}
            {step === 4 && "نتایج عملیات وارد کردن."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-muted rounded-lg p-10">
              <FileText className="w-12 h-12 text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload"
              />
              <Label htmlFor="excel-upload" className="cursor-pointer">
                  <Button type="button" onClick={() => fileInputRef.current?.click()}>انتخاب فایل اکسل</Button>
              </Label>
              <Button variant="link" size="sm" onClick={templateGenerator}>دانلود فایل راهنما</Button>
              <p className="text-xs text-muted-foreground">فقط فایل‌های .xlsx یا .xls</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="font-semibold">نگاشت ستون‌ها:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allFieldKeys.map(apiKey => (
                  <div key={apiKey} className="flex items-center gap-2">
                    <Label className="w-40 flex-shrink-0">
                      {allFields[apiKey]} {requiredFields[apiKey] ? '*' : ''}
                    </Label>
                    <Select
                      value={Object.keys(columnMapping).find(h => columnMapping[h] === apiKey) || ""}
                      onValueChange={(excelHeader) => {
                          const updatedMapping = { ...columnMapping };
                          // Remove previous mapping using this excelHeader if it exists
                          if (excelHeader && updatedMapping[excelHeader] && updatedMapping[excelHeader] !== apiKey) {
                              toast.warn(`ستون "${excelHeader}" قبلاً به "${allFields[updatedMapping[excelHeader]]}" نگاشت شده بود. نگاشت قبلی حذف شد.`);
                          }
                          // Remove previous mapping for this apiKey if exists from another header
                          Object.keys(updatedMapping).forEach(key => {
                              if (updatedMapping[key] === apiKey) {
                                  delete updatedMapping[key];
                              }
                          });
                          // Add new mapping if an excelHeader is selected
                          if (excelHeader) {
                              updatedMapping[excelHeader] = apiKey;
                          }
                           setColumnMapping(updatedMapping);
                      }}
                    >
                      <SelectTrigger className="flex-grow">
                        <SelectValue placeholder="انتخاب ستون اکسل..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Add disabled option only if the field is optional */}
                         {optionalFields[apiKey] && <SelectItem value="" >-- انتخاب نشده --</SelectItem>}
                        {/* Filter headers to show only those not already mapped to a *different* apiKey */}
                        {headers
                          .filter(header => !columnMapping[header] || columnMapping[header] === apiKey)
                          .map(header => (
                          // Ensure value is not an empty string
                          <SelectItem key={header} value={header || `_invalid_header_${header}`}>
                              {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
               <p className="font-semibold">پیش‌نمایش {Math.min(5, data.length)} ردیف اول:</p>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {/* Display headers based on the actual mapping */}
                            {allFieldKeys
                                .filter(apiKey => Object.values(columnMapping).includes(apiKey))
                                .map(apiKey => <TableHead key={apiKey} className="text-right">{allFields[apiKey]}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {getMappedData().slice(0, 5).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {allFieldKeys
                                    .filter(apiKey => Object.values(columnMapping).includes(apiKey))
                                    .map(apiKey => <TableCell key={apiKey}>{String(row[apiKey] ?? '')}</TableCell>)}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {data.length > 5 && <p className="text-sm text-muted-foreground">... و {data.length - 5} ردیف دیگر</p>}
            </div>
          )}

         {step === 4 && importResults && (
            <div className="space-y-4">
               <p className="font-semibold">نتایج:</p>
               {importResults.success && (!importResults.errors || importResults.errors.length === 0) ? (
                 <div className="flex items-center text-green-600"> <CheckCircle className="ml-2 h-5 w-5" /> تمام {data.length} ردیف با موفقیت وارد شد. </div>
               ) : (
                 <>
                   {importResults.results && importResults.results.length > 0 && (
                     <p className="flex items-center text-green-600"><CheckCircle className="ml-2 h-5 w-5" /> {importResults.results.length} ردیف با موفقیت وارد شد.</p>
                   )}
                   {importResults.errors && importResults.errors.length > 0 && (
                     <div className="space-y-2 pt-2">
                       <p className="flex items-center text-red-600 font-semibold"><AlertCircle className="ml-2 h-5 w-5" /> {importResults.errors.length} ردیف با خطا مواجه شد:</p>
                       <ul className="list-disc pr-5 space-y-1 text-sm text-red-700 max-h-40 overflow-y-auto bg-red-50 p-3 rounded-md border border-red-200">
                         {importResults.errors.map((error, index) => (
                           <li key={index}>{error}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </>
               )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-between items-center pt-4 border-t">
            <div>
                 {(step === 2 || step === 3) && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isLoading}>قبلی</Button>}
                 {step === 4 && <Button variant="outline" onClick={resetState} disabled={isLoading}>وارد کردن فایل جدید</Button>}
            </div>
            <div>
                {step === 1 && <DialogClose asChild><Button variant="ghost">انصراف</Button></DialogClose>}
                {step === 2 && (
                    <>
                        <DialogClose asChild><Button variant="ghost" disabled={isLoading}>انصراف</Button></DialogClose>
                        <Button onClick={handleProceedToPreview} disabled={!isMappingComplete || isLoading}>
                            ادامه <ArrowRight className="mr-2 h-4 w-4"/>
                        </Button>
                    </>
                )}
                {step === 3 && (
                    <>
                        <Button variant="ghost" onClick={() => setStep(2)} disabled={isLoading}>ویرایش نگاشت</Button>
                        <Button onClick={handleImport} disabled={isLoading || data.length === 0}>
                            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                            وارد کردن نهایی ({data.length} ردیف)
                        </Button>
                    </>
                )}
                {step === 4 && <Button onClick={closeModal}>بستن</Button>}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

