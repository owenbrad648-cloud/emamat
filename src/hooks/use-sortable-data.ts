import { useState, useMemo } from 'react';

// Helper function to safely get nested property value
const getNestedValue = (obj: any, path: string): any => {
  if (!path) return undefined;
  // Handle potential arrays in the path (e.g., class_subjects[0].subjects.name)
  // For simplicity in this hook, we'll sort based on the first item if it's an array.
  const keys = path.replace(/\[\d+\]/g, '').split('.').filter(Boolean); // Basic handling for first item
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
     // If the current level is an array, try accessing the property on the first element
    if (Array.isArray(current)) {
        current = current.length > 0 ? current[0]?.[key] : undefined;
    } else {
        current = current[key];
    }
  }
  // If the final value is an object (e.g., from class_subjects), try getting a 'name' property
  if (typeof current === 'object' && current !== null && 'name' in current) {
      return current.name;
  }
  if (typeof current === 'object' && current !== null && 'full_name' in current) {
      return current.full_name;
  }
  return current;
};


interface SortConfig<T> {
  key: keyof T | string; // Allow string for nested keys
  direction: 'ascending' | 'descending';
}

export const useSortableData = <T>(items: T[] | null | undefined, config: SortConfig<T> | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(config);

  const sortedItems = useMemo(() => {
    if (!items) return null;
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Use the helper function to get potentially nested values
        const aValue = getNestedValue(a, sortConfig.key as string);
        const bValue = getNestedValue(b, sortConfig.key as string);

        // Handle null/undefined values by pushing them to the end
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Use localeCompare for string comparison (handles Persian characters)
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue, 'fa'); // Use Persian locale
           return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }

        // Standard comparison for numbers, dates, etc.
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

