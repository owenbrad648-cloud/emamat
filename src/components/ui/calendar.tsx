import * as React from "react";
import DatePicker, { DayValue } from "@hassanmojab/react-modern-calendar-datepicker";
import "@hassanmojab/react-modern-calendar-datepicker/lib/DatePicker.css";

// Keep the existing export name `Calendar` so other components don't need to change.
export type CalendarProps = {
  mode?: "single" | "range";
  selected?: Date | undefined;
  onSelect?: (date?: Date) => void;
  // allow passing className for wrapper styling
  className?: string;
};

function dateToDayValue(d: Date): DayValue {
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() } as DayValue;
}

function dayValueToDate(v: DayValue | null | undefined): Date | undefined {
  if (!v || typeof v === "boolean") return undefined;
  // DayValue is an object like { day, month, year }
  // Some typings allow arrays for range mode; we only handle single mode here.
  const maybe = v as { day?: number; month?: number; year?: number };
  if (maybe.day == null || maybe.month == null || maybe.year == null) return undefined;
  return new Date(maybe.year, maybe.month - 1, maybe.day);
}

function Calendar({ mode = "single", selected, onSelect, className }: CalendarProps) {
  const selectedValue = selected ? dateToDayValue(selected) : null;

  return (
    <div className={className}>
      <DatePicker
        value={selectedValue}
        onChange={(v) => {
          const converted = dayValueToDate(v as DayValue | null | undefined);
          onSelect?.(converted);
        }}
        // keep the calendar in single or range mode based on prop
        inputPlaceholder=""
        shouldHighlightWeekends
        calendarPopperPosition="bottom"
        // the library accepts `calendar` prop `calendarClassName` etc.; keep defaults
        // We intentionally don't render the input — consumers use a Popover trigger button.
        renderInput={() => null}
      />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

