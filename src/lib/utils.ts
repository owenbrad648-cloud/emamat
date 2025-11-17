import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
// src/lib/utils/date.ts
import { format, parseISO } from "date-fns-jalali";

export const toPersianDigits = (num: string) => 
  num.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export const formatJalaliDate = (dateString: string, pattern = "yyyy/MM/dd") => {
  if (!dateString) return '-';
  try {
    const parsed = parseISO(dateString);
    return toPersianDigits(format(parsed, pattern)); // تاریخ شمسی با اعداد فارسی
  } catch (e) {
    console.error("Invalid date:", dateString);
    return 'تاریخ نامعتبر';
  }
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
