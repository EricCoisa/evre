"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { Project } from "@/lib/actions/project/types";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Archive } from "lucide-react";
import { DataCell, TableHead } from "@/components/table-utils";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Props {
  t: (key: string) => string;
  onEdit?: (item: Project) => void;
  onArchive?: (item: Project) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "outline",
  ARCHIVED: "secondary",
};

export function getProjectColumns({ t, onEdit, onArchive }: Props): ColumnDef<Project>[] {
  return [
    {
      accessorKey: "name",
      header: () => <TableHead>{t("name")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <Link href={`/project/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue("name")}
          </Link>
        </DataCell>
      ),
      meta: { mobileOrder: 1, mobileWidth: "half" },
    },
    {
      accessorKey: "status",
      header: () => <TableHead>{t("status")}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <DataCell>
            <Badge variant={STATUS_VARIANT[status] ?? "default"}>
              {t(status.toLowerCase())}
            </Badge>
          </DataCell>
        );
      },
      meta: { mobileOrder: 2, mobileWidth: "half" },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        const isSorted = column.getIsSorted && column.getIsSorted();
        return (
          <DataCell>
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="p-0 hover:bg-transparent justify-center font-medium"
              >
                {t("createdAt")}
                {isSorted === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> :
                 isSorted === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> :
                 <ArrowUpDown className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </DataCell>
        );
      },
      cell: ({ row }) => <DataCell>{formatDate(row.getValue("createdAt"))}</DataCell>,
      enableSorting: true,
      sortingFn: "datetime",
      meta: { mobileOrder: 3, mobileWidth: "half", mobileLabel: t("createdAt") },
    },
    {
      id: "actions",
      header: () => <TableHead />,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(item)} className="h-6 p-0 min-h-0">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onArchive && item.status !== 'ARCHIVED' && (
                <Button
                  variant="ghost" size="sm" onClick={() => onArchive(item)}
                  className="h-6 p-0 min-h-0 text-destructive hover:text-destructive"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DataCell>
        );
      },
      meta: { mobileOrder: 4, mobileWidth: "half" },
    },
  ];
}
