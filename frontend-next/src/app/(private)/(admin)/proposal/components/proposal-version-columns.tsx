"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataCell, TableHead } from "@/components/table-utils";
import { formatCents, formatDate } from "@/lib/utils";
import {
  publicationStateLabelKey,
  PUBLICATION_STATE_BADGE_VARIANT,
  type PublicationState,
} from "@/lib/actions/proposal/vocabulary";
import type { ProposalVersionDto } from "@/lib/actions/proposal/types";
import type { TFunc } from "@/hooks/use-translation";

interface GetProposalVersionColumnsProps {
  t: TFunc;
  tVocabulary: TFunc;
  onView?: (item: ProposalVersionDto) => void;
}

export function getProposalVersionColumns({
  t,
  tVocabulary,
  onView,
}: GetProposalVersionColumnsProps): ColumnDef<ProposalVersionDto>[] {
  return [
    {
      accessorKey: "version",
      header: () => <TableHead>{t("versionNumber")}</TableHead>,
      cell: ({ row }) => <DataCell>v{row.getValue("version")}</DataCell>,
      meta: { mobileOrder: 1, mobileWidth: "half" },
    },
    {
      accessorKey: "publishedAt",
      header: () => <TableHead>{t("versionPublishedAt")}</TableHead>,
      cell: ({ row }) => {
        const publishedAt = row.getValue("publishedAt") as string | null;
        return <DataCell>{publishedAt ? formatDate(publishedAt) : "-"}</DataCell>;
      },
      meta: { mobileOrder: 2, mobileWidth: "half" },
    },
    {
      accessorKey: "totalCents",
      header: () => <TableHead>{t("value")}</TableHead>,
      cell: ({ row }) => (
        <DataCell>{formatCents(row.getValue("totalCents"), row.original.currency)}</DataCell>
      ),
      meta: { mobileOrder: 3, mobileWidth: "half" },
    },
    {
      accessorKey: "state",
      header: () => <TableHead>{t("status")}</TableHead>,
      cell: ({ row }) => {
        const state = row.getValue("state") as PublicationState;
        return (
          <DataCell>
            <Badge variant={PUBLICATION_STATE_BADGE_VARIANT[state]}>
              {tVocabulary(publicationStateLabelKey(state))}
            </Badge>
          </DataCell>
        );
      },
      meta: { mobileOrder: 4, mobileWidth: "half" },
    },
    {
      id: "actions",
      header: () => <TableHead>{t("actions")}</TableHead>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DataCell>
            {onView && (
              <Button variant="ghost" size="sm" onClick={() => onView(item)}>
                <Eye className="size-4 mr-1.5" />
                {t("viewVersion")}
              </Button>
            )}
          </DataCell>
        );
      },
      meta: { mobileOrder: 5, mobileWidth: "half" },
    },
  ];
}
