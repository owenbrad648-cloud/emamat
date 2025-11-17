import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export const SortableHeader = ({ sortKey, sortConfig, requestSort, children }: any) => {
  const icon = !sortConfig || sortConfig.key !== sortKey
    ? <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />
    : sortConfig.direction === 'ascending'
    ? <ArrowUp className="mr-2 h-4 w-4" />
    : <ArrowDown className="mr-2 h-4 w-4" />;
  return <Button variant="ghost" onClick={() => requestSort(sortKey)}>{children}{icon}</Button>;
};
