"use client";

import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ApprovalCardProps {
  scope: string;
  onApprove: (decision: 'once' | 'conversation' | 'deny') => void;
}

const ApprovalCard = ({ scope, onApprove }: ApprovalCardProps) => {
  const { t } = useTranslation('agent');

  return (
    <Card className="border-amber-500/50 bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t('approvalRequired')}</CardTitle>
          <Badge variant="secondary">{scope}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4">{t('approvalDescription')}</p>
        <Separator className="my-3" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onApprove('once')}>
            {t('approveOnce')}
          </Button>
          <Button variant="default" size="sm" onClick={() => onApprove('conversation')}>
            {t('approveConversation')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onApprove('deny')}>
            {t('deny')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApprovalCard;