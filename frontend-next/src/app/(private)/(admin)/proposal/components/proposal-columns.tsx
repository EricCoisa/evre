"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Proposal } from "@/lib/actions/proposal/types";
import { Button } from "@/components/ui/button";
import { Copy, Archive } from "lucide-react";
import { DataCell, TableHead } from "@/components/table-utils";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { formatCents, formatDate } from "@/lib/utils";
import { proposalStatusLabelKey } from "@/lib/actions/proposal/vocabulary";
import type { TFunc } from "@/hooks/use-translation";
import type { VariantProps } from "class-variance-authority";

const STATUS_BADGE_VARIANT: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
  DRAFT: "secondary",
  SENT: "outline",
  ACCEPTED: "default",
  LOST: "destructive",
};

interface GetProposalColumnsProps {
  t: TFunc;
  tVocabulary: TFunc;
  onDuplicate?: (item: Proposal) => void;
  onArchive?: (item: Proposal) => void;
}

export function getProposalColumns({
  t,
  tVocabulary,
  onDuplicate,
  onArchive,
}: GetProposalColumnsProps): ColumnDef<Proposal>[] {
  return [
    {
      accessorKey: "name",
      header: () => <TableHead>{t("name")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          <Link href={`/proposal/${row.original.id}`} className="font-medium hover:underline">
            {row.getValue("name") || t("noName")}
          </Link>
        </DataCell>
      ),
      meta: { mobileOrder: 1, mobileWidth: "half" },
    },
    {
      accessorKey: "companyName",
      header: () => <TableHead>{t("company")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue("companyName") || "-"}</DataCell>,
      meta: { mobileOrder: 2, mobileWidth: "half" },
    },
    {
      accessorKey: "status",
      header: () => <TableHead>{t("status")}</TableHead>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <DataCell>
            <Badge variant={STATUS_BADGE_VARIANT[status] ?? "outline"}>
              {tVocabulary(proposalStatusLabelKey(status))}
            </Badge>
          </DataCell>
        );
      },
      meta: { mobileOrder: 3, mobileWidth: "half" },
    },
    {
      accessorKey: "totalCents",
      header: () => <TableHead>{t("value")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>
          {formatCents(row.getValue("totalCents"), row.original.currency)}
        </DataCell>
      ),
      meta: { mobileOrder: 4, mobileWidth: "half" },
    },
    {
      accessorKey: "validUntil",
      header: () => <TableHead>{t("validUntil")}</TableHead>,
      cell: ({ row }) => {
        const validUntil = row.getValue("validUntil") as string | null;
        return <DataCell>{validUntil ? formatDate(validUntil) : "-"}</DataCell>;
      },
      meta: { mobileOrder: 5, mobileWidth: "half" },
    },
    {
      accessorKey: "daysWithoutMovement",
      header: () => <TableHead>{t("daysWithoutMovement")}</TableHead>,
      cell: ({ row }) => <DataCell>{row.getValue("daysWithoutMovement") ?? "-"}</DataCell>,
      meta: { mobileOrder: 6, mobileWidth: "half" },
    },
    {
      id: "actions",
      header: () => <TableHead>{t("actions")}</TableHead>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              {onDuplicate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicate(item)}
                  title={t("duplicateTooltip")}
                  className="h-6 p-0 min-h-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {onArchive && (
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
      meta: { mobileOrder: 7, mobileWidth: "half" },
    },
  ];
}
