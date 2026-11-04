"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Artifact } from "@/lib/actions/artifact/types";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, Archive, ExternalLink, Trash2 } from "lucide-react";
import { DataCell, TableHead } from "@/components/table-utils";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { TFunc } from "@/hooks/use-translation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface GetArtifactColumnsProps {
  t: TFunc;
  onArchive?: (item: Artifact) => void;
  onDelete?: (item: Artifact) => void;
}

export function getArtifactColumns({ t, onArchive, onDelete }: GetArtifactColumnsProps): ColumnDef<Artifact>[] {
  return [
    {
      accessorKey: "name",
      header: () => <TableHead>{t("name")}</TableHead>,
      cell: ({ row }) => {
        const item = row.original as Artifact & { name?: string | null };
        return <DataCell className="font-medium">{item.name || item.fileName}</DataCell>;
      },
      meta: {
        mobileOrder: 1,
        mobileWidth: "full",
      },
    },
    {
      accessorKey: "kind",
      header: () => <TableHead>{t("kind")}</TableHead>,
      cell: ({ row }) => {
        const kind = row.getValue("kind") as Artifact["kind"];
        return (
          <DataCell>
            <Badge variant="outline">
              {kind === "FOLDER" ? t("kindFolder") : t("kindFile")}
            </Badge>
          </DataCell>
        );
      },
      meta: {
        mobileOrder: 2,
        mobileWidth: "half",
      },
    },
    {
      accessorKey: "sizeBytes",
      header: () => <TableHead>{t("size")}</TableHead>,
      cell: ({ row }) => <DataCell>{formatFileSize(row.getValue("sizeBytes") as number)}</DataCell>,
      meta: {
        mobileOrder: 3,
        mobileWidth: "half",
      },
    },
    {
      accessorKey: "published",
      header: () => <TableHead>{t("published")}</TableHead>,
      cell: ({ row }) => {
        const published = row.getValue("published") as boolean;
        return (
          <DataCell>
            <Badge variant={published ? "default" : "secondary"}>
              {published ? t("publishedYes") : t("publishedNo")}
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
      cell: ({ row }) => <DataCell>{formatDate(row.getValue("createdAt"))}</DataCell>,
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
      header: () => <TableHead>{t("actions")}</TableHead>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <DataCell>
            <div className="flex gap-2 items-center">
              <Button
                variant="ghost"
                size="sm"
                asChild
                title={t("viewTooltip")}
                className="h-6 p-0 min-h-0"
              >
                <a
                  href={`${API_BASE_URL}/artifacts/${item.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
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
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item)}
                  title={t("deleteTooltip")}
                  className="h-6 p-0 min-h-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
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
