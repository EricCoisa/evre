"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Contact } from "@/lib/actions/company/types";
import { Button } from "@/components/ui/button";
import { Pencil, Archive } from "lucide-react";
import { DataCell, TableHead } from "@/components/table-utils";
import { Badge } from "@/components/ui/badge";

interface GetCompanyContactColumnsProps {
  t: (key: string) => string;
  onEdit?: (item: Contact) => void;
  onArchive?: (item: Contact) => void;
}

export function getCompanyContactColumns({ t, onEdit, onArchive }: GetCompanyContactColumnsProps): ColumnDef<Contact>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.messagingContact.name ?? row.messagingContact.phone,
      header: () => <TableHead>{t("contacts.name")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.messagingContact.name ?? row.original.messagingContact.phone}
            </span>
            {row.original.role && (
              <span className="text-xs text-muted-foreground">{row.original.role}</span>
            )}
          </div>
        </DataCell>
      ),
      meta: { mobileOrder: 1, mobileWidth: "full" },
    },
    {
      accessorKey: "email",
      header: () => <TableHead>{t("contacts.email")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue("email") || "-"}</DataCell>,
      meta: { mobileOrder: 2, mobileWidth: "half" },
    },
    {
      id: "phone",
      accessorFn: (row) => row.messagingContact.phone,
      header: () => <TableHead>{t("contacts.phone")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.original.messagingContact.phone}</DataCell>,
      meta: { mobileOrder: 3, mobileWidth: "half" },
    },
    {
      accessorKey: "isPrimary",
      header: () => <TableHead>{t("contacts.isPrimary")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <div className="flex gap-1 flex-wrap">
            {Boolean(row.getValue("isPrimary")) && <Badge variant="default">{t("contacts.primary")}</Badge>}
            {row.original.isDecisionMaker && <Badge variant="outline">{t("contacts.decisionMaker")}</Badge>}
          </div>
        </DataCell>
      ),
      meta: { mobileOrder: 4, mobileWidth: "full" },
    },
    {
      id: "actions",
      header: () => <TableHead>{t("actions")}</TableHead>,
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
                  title={t("editTooltip")}
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
      meta: { mobileOrder: 5, mobileWidth: "half" },
    },
  ];
}
