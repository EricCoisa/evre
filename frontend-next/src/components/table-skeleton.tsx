'use client';

import { cn } from '@/lib/cn';
import { LoadingSkeleton } from './ui/loading-skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
  className?: string;
}

function TableSkeletonToolbar() {
  return (
    <>
      {/* Mobile toolbar skeleton */}
      <div className="flex sm:hidden flex-row justify-between items-center gap-2 mb-3">
        <LoadingSkeleton className="h-9 w-28 rounded-md" />
        <LoadingSkeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Desktop toolbar skeleton */}
      <div className="hidden sm:flex border-b border-border/30 pb-3 pt-1 flex-wrap gap-2 items-center mb-4 w-full min-w-0">
        <LoadingSkeleton className="h-9 w-48 xl:w-56 rounded-md" />
        <LoadingSkeleton className="h-9 w-32 xl:w-36 rounded-md" />
        <LoadingSkeleton className="h-9 w-32 xl:w-36 rounded-md" />
        <LoadingSkeleton className="h-9 w-28 rounded-md ml-auto" />
      </div>
    </>
  );
}

function TableSkeletonMobileCard() {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs w-full min-w-0 max-w-full overflow-hidden">
      <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-start w-full">
        <div className="col-span-12 flex flex-col gap-1.5">
          <LoadingSkeleton className="h-2.5 w-16" />
          <LoadingSkeleton className="h-4 w-44 max-w-[80%]" />
        </div>
        <div className="col-span-6 flex flex-col gap-1.5">
          <LoadingSkeleton className="h-2.5 w-12" />
          <LoadingSkeleton className="h-3.5 w-24 max-w-[75%]" />
        </div>
        <div className="col-span-6 flex flex-col gap-1.5">
          <LoadingSkeleton className="h-2.5 w-14" />
          <LoadingSkeleton className="h-3.5 w-20 max-w-[75%]" />
        </div>
      </div>

      <div className="border-t border-border/40 pt-2.5 mt-2 flex items-center justify-between min-h-[38px] gap-2">
        <LoadingSkeleton className="h-3 w-16 rounded" />
        <div className="flex items-center gap-1.5 ml-auto">
          <LoadingSkeleton className="size-8 rounded-md" />
          <LoadingSkeleton className="size-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function TableSkeletonMobile({ rows }: { rows: number }) {
  const cardCount = Math.min(Math.max(rows, 1), 5);

  return (
    <div className="space-y-3 block sm:hidden">
      {Array.from({ length: cardCount }).map((_, index) => (
        <TableSkeletonMobileCard key={index} />
      ))}

      {/* Pagination mobile skeleton */}
      <div className="flex px-1 items-center justify-between border-t border-border/30 pt-3 pb-24 sm:pb-2">
        <LoadingSkeleton className="h-4 w-28" />
        <div className="flex items-center gap-2">
          <LoadingSkeleton className="h-10 w-[76px] rounded-md" />
          <LoadingSkeleton className="h-10 w-[76px] rounded-md" />
        </div>
      </div>
    </div>
  );
}

function TableSkeletonDesktop({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="hidden sm:block space-y-4">
      <div className="overflow-hidden rounded-md border border-border/20">
        <Table className="relative">
          <TableHeader className="bg-gradient-to-r from-primary-100 dark:from-primary-900/30 to-primary-50 dark:to-primary-950/20 border-b border-border/30">
            <TableRow className="border-border/20 hover:bg-transparent">
              {Array.from({ length: columns }).map((_, index) => (
                <TableHead
                  key={index}
                  className="p-3 border-r border-border/20 last:border-r-0"
                >
                  <LoadingSkeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/20">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  'border-border/10 hover:bg-transparent',
                  rowIndex % 2 === 1
                    ? 'bg-info-50/30 dark:bg-info-950/5'
                    : 'bg-transparent'
                )}
              >
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className="p-3 border-r border-border/20 last:border-r-0"
                  >
                    <LoadingSkeleton className="h-4 w-full max-w-[180px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination desktop skeleton */}
        <div className="flex px-3 py-2.5 items-center justify-between bg-gradient-to-r from-success-50 dark:from-success-950/20 to-success-100 dark:to-success-900/20 border-t border-border/30 backdrop-blur-sm">
          <LoadingSkeleton className="h-4 w-36" />
          <div className="flex items-center gap-2">
            <LoadingSkeleton className="h-8 w-20 rounded-md" />
            <LoadingSkeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showToolbar = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('space-y-4 w-full min-w-0', className)}>
      {showToolbar && <TableSkeletonToolbar />}
      <TableSkeletonMobile rows={rows} />
      <TableSkeletonDesktop rows={rows} columns={columns} />
    </div>
  );
}