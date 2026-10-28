'use client';

import { Container } from "@/components/container";
import { useTranslation } from '@/hooks/use-translation';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportMyData, deleteMyAccount } from "@/lib/actions/user/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { logout } from "@/lib/actions/auth/auth-action";
import { ConfigList, ConfigRow } from "@/components/config-row";
import { Download, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AccountTab() {
  const { t } = useTranslation('profile');
  const [deletePassword, setDeletePassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await exportMyData();
      if (!res.success || !res.data) {
        toast.error(t('common:errorMessage'));
        return;
      }
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export_success'));
    } catch {
      toast.error(t('common:errorMessage'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const res = await deleteMyAccount(deletePassword);
      if (!res.success) {
        toast.error(t('common:errorMessage'));
        setIsDeleting(false);
        return;
      }
      await logout();
    } catch {
      toast.error(t('common:errorMessage'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Container variant="form" padding>
        <div className="space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-base font-semibold">{t('privacy_data_title')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('privacy_data_desc')}</p>
          </div>
          <ConfigList>
            <ConfigRow
              title={t('export_my_data')}
              description={t('export_my_data_desc')}
            >
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={isExporting}
                className="gap-2"
              >
                {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {t('export_my_data')}
              </Button>
            </ConfigRow>
          </ConfigList>
        </div>
      </Container>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
        <div className="flex items-start gap-3 pb-4 border-b border-destructive/20">
          <div className="p-2 rounded-full bg-destructive/10 text-destructive shrink-0 mt-0.5">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-destructive">{t('danger_zone_title')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('danger_zone_desc')}</p>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('delete_my_account')}</p>
            <p className="text-xs text-muted-foreground max-w-xl">{t('delete_my_account_desc')}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2 shrink-0">
                <Trash2 className="size-4" />
                {t('delete_my_account')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('delete_account_confirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('delete_account_warning')}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <label className="text-sm font-medium">{t('delete_account_password_label')}</label>
                <Input
                  type="password"
                  className="mt-1"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="******"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletePassword('')}>
                  {t('common:cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || isDeleting}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {isDeleting ? t('loading') : t('delete_my_account')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
