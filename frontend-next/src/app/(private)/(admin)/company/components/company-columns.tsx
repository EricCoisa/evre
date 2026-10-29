"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Company } from "@/lib/actions/company/types";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Archive } from "lucide-react";
import { DataCell, TableHead } from "@/components/table-utils";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface GetCompanyColumnsProps {
  t: (key: string) => string;
  onEdit?: (item: Company) => void;
  onArchive?: (item: Company) => void;
}

export function getCompanyColumns({ t, onEdit, onArchive }: GetCompanyColumnsProps): ColumnDef<Company>[] {
  return [
    {
      accessorKey: "name",
      header: () => <TableHead>{t("name") || "Nome"}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <Link href={`/company/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue("name") || t("noName")}
          </Link>
        </DataCell>
      ),
      meta: {
        mobileOrder: 1,
        mobileWidth: "half",
      },
    },
    {
      accessorKey: "tradeName",
      header: () => <TableHead>{t("tradeName")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue("tradeName") || "-"}</DataCell>,
      meta: {
        mobileOrder: 2,
        mobileWidth: "half",
      },
    },
    {
      accessorKey: "segment",
      header: () => <TableHead>{t("segment")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue("segment") || "-"}</DataCell>,
      meta: {
        mobileOrder: 3,
        mobileWidth: "full",
      },
    },
    {
      accessorKey: "archivedAt",
      header: () => <TableHead>{t("status") || "Status"}</TableHead>,
      cell: ({ row }) => {
        const archivedAt = row.getValue("archivedAt") as string | null;
        return (
          <DataCell>
            <Badge variant={archivedAt ? "secondary" : "default"}>
              {archivedAt ? t("archived") : t("active")}
            </Badge>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 4,
        mobileWidth: "half",
      },
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
                {isSorted === "asc" ? (
                  <ArrowUp className="ml-2 h-4 w-4" />
                ) : isSorted === "desc" ? (
                  <ArrowDown className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </DataCell>
        );
      },
      cell: ({ row }) => (
        <DataCell>
          {formatDate(row.getValue("createdAt"))}
        </DataCell>
      ),
      enableSorting: true,
      sortingFn: "datetime",
      meta: {
        mobileOrder: 5,
        mobileWidth: "half",
        mobileLabel: t("createdAt"),
      },
    },
    {
      id: "actions",
      header: () => <TableHead>{t("actions") || "Ações"}</TableHead>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  title={t("editTooltip") || "Editar"}
                  className="h-6 p-0 min-h-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onArchive && !item.archivedAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onArchive(item)}
                  title={t("archiveTooltip")}
                  className="h-6 p-0 min-h-0 text-destructive hover:text-destructive"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 6,
        mobileWidth: "half",
      },
    },
  ];
}
