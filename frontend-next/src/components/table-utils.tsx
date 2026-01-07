import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Fragment } from "react/jsx-runtime";
import React, { ReactNode, useState } from "react";

export function TableHead({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-head"
      className={cn(
        "table-cell align-middle font-medium text-left isolate",
        "text-foreground md:h-10 h-0 md:px-1 px-0 md:py-1 py-0 whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

export interface DataCellProps extends React.ComponentProps<"div"> {
  children: ReactNode | string;
  maxWidth?: number | string;
  className?: string;
  pointer?: boolean;
  }


export function DataCell({ className, children, maxWidth, pointer, ...props }: DataCellProps) {
  return (
        <div
          className={cn(
            "table-cell align-middle isolate",
            "px-1 md:py-1 py-0 overflow-hidden whitespace-nowrap text-ellipsis",
             pointer ? "cursor-pointer" : "cursor-default",
            className
          )}
          style={{
            maxWidth: maxWidth || 'auto',
          }}
          {...props}
        >
          {children || "-"}
        </div>
  )
}

export function DataCellModal({
  children,
  title,
  cellChildren,
  maxWidth,
}: {
  children?: ReactNode;
  title: ReactNode | string;
  cellChildren: ReactNode;
  maxWidth?: number | string;
}) {
  const [isCellOpen, setIsCellOpen] = useState(false);
  return (
    <Fragment>
      <DataCell
        maxWidth={maxWidth}
        onClick={() =>setIsCellOpen(true)}
        pointer>
        {cellChildren ?? title}
        </DataCell>
      <Dialog modal open={isCellOpen} onOpenChange={setIsCellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div
            className="bg-muted rounded p-2"
            >
            {children}
            </div>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}