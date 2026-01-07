'use client';

import { LoadingSkeleton } from './ui/loading-skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <LoadingSkeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <LoadingSkeleton className="h-4 w-full max-w-[200px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-2">
        <LoadingSkeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="h-8 w-20" />
          <LoadingSkeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}