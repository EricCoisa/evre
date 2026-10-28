"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";

interface CopyFieldProps {
  value: string;
  label?: string;
}

export function CopyField({ value, label }: CopyFieldProps) {
  const { t } = useTranslation("common");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-center gap-2">
        <Input readOnly value={value} />
        <Button onClick={handleCopy}>
          <Copy className="size-4 mr-2" />
          {t("copy")}
        </Button>
      </div>
    </div>
  );
}
