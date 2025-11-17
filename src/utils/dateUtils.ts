// src/utils/dateUtils.ts
import { format as formatJalali, parseISO } from "date-fns-jalali";

/**
 * 🔢 تبدیل اعداد انگلیسی به فارسی
 * @example toPersianDigits("2025/10/30") ➜ "۲۰۲۵/۱۰/۳۰"
 */
export const toPersianDigits = (num: string): string =>
  num.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/**
 * 📅 تبدیل و فرمت تاریخ میلادی (ISO) به تاریخ شمسی با اعداد فارسی
 * @param dateString - رشته تاریخ (ISO یا هر مقدار معتبر Date)
 * @param formatString - فرمت خروجی (پیش‌فرض: yyyy/MM/dd)
 * @returns تاریخ شمسی با اعداد فارسی یا '-' در صورت خطا
 * @example safeFormatDate("2025-10-30", "dd MMM yyyy") ➜ "۰۸ آبان ۱۴۰۴"
 */
export const safeFormatDate = (
  dateString: string | null | undefined,
  formatString: string = "yyyy/MM/dd"
): string => {
  if (!dateString) return "-";
  try {
    const dateObj = parseISO(dateString);
    const formatted = formatJalali(dateObj, formatString);
    return toPersianDigits(formatted);
  } catch (e) {
    console.error("❌ Error parsing date:", dateString, e);
    return "تاریخ نامعتبر";
  }
};
