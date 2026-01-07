'use client';

import { useEffect, useState } from "react";
import { TourAlertDialog, TourProvider, TourStep, useTour } from "../tour";
import { getSystemConfiguration } from "@/lib/actions/systemConfiguration/api";
import { useUserConfiguration, useSetUserConfiguration } from "@/lib/actions/userConfiguration/queries";
import { UserConfiguration } from "@/lib/actions/userConfiguration/types";


function TourContent({ children, userTourConfig, handleFinish }: { children: React.ReactNode, userTourConfig: UserConfiguration<boolean> | null | undefined, handleFinish: () => void }) {
  const { setSteps } = useTour();
  const [openTour, setOpenTour] = useState(false);
  const [tour, setTour] = useState<TourStep[]>([]);

  // Carrega configuração do tour do sistema
  useEffect(() => {
    // Só mostra o tour se o usuário ainda não completou

    const loadTourConfig = async () => {
      try {
        const r = (await getSystemConfiguration<string>("SYSTEMTOUR")).data;
        if (r && r.value != null && r.value !== "") {
          const parsedTour = JSON.parse(r.value) as TourStep[];
          setTour(parsedTour);
        }
      } catch (error) {
        console.error("Error loading tour configuration:", error);
      }
    };
    if (userTourConfig?.value == false) {
      loadTourConfig();
    }
  }, [userTourConfig]);

  // Configura os steps quando o tour estiver carregado
  useEffect(() => {
    const stepsToUse = tour.length > 0 ? tour : null;
    if (!stepsToUse) return;
    setSteps(stepsToUse);

    const timer = setTimeout(() => {
      setOpenTour(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [tour, setSteps]);

  // Ao fechar o tour, chama handleFinish
  const handleSetOpenTour = (open: boolean) => {
    setOpenTour(open);
    if (!open) handleFinish();
  };

  return (
    <>
      {children}
      <TourAlertDialog
        isOpen={openTour}
        setIsOpen={handleSetOpenTour}
      />
    </>
  );
}

export function ReactTour({ children }: { children: React.ReactNode }) {
  const { data: userTourConfig } = useUserConfiguration<boolean>("USERTOUR");
  const updateUserConfig = useSetUserConfiguration();
  const handleFinish = async () => {

    if (!userTourConfig) return;
    try {
      await updateUserConfig.mutateAsync({
        userConfiguration: {
          ...userTourConfig,
          value: true
        }
      });
    } catch (error) {
      console.error("Error saving tour completion:", error);
    }
  };
  return (
    <TourProvider onComplete={handleFinish}>
      <TourContent userTourConfig={userTourConfig} handleFinish={handleFinish}>{children}</TourContent>
    </TourProvider>
  );
}
