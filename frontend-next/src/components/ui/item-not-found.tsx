"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface ItemNotFoundProps {
  itemName: string;
  returnPage: string;
  returnLabel?: string;
}

export function ItemNotFound({ itemName, returnPage, returnLabel = "Voltar" }: ItemNotFoundProps) {
  const router = useRouter();

  const handleReturn = () => {
    router.push(returnPage);
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-muted-foreground">
            Item Não Encontrado
          </CardTitle>
          <CardDescription className="text-lg">
            O {itemName} solicitado não foi encontrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={handleReturn} variant="default">
            {returnLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}