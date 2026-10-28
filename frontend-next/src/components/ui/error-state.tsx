"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  onRetry?: () => void;
  message?: string;
  /** Uma linha, sem card nem altura mínima — para erro dentro de uma linha de config. */
  compact?: boolean;
}

export function ErrorState({ onRetry, message, compact }: ErrorStateProps) {
  const { t } = useTranslation("common");

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{message ?? t("error_loading")}</span>
        {onRetry && (
          <Button onClick={onRetry} variant="ghost" size="sm">
            {t("tryAgain")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-muted-foreground">
            {t("error_loading")}
          </CardTitle>
          {message && (
            <CardDescription className="text-sm">{message}</CardDescription>
          )}
        </CardHeader>
        {onRetry && (
          <CardContent className="flex justify-center">
            <Button onClick={onRetry} variant="default">
              {t("tryAgain")}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
