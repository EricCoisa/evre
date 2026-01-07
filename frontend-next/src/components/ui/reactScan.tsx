"use client";
import { useEffect } from "react";
import { scan } from "react-scan/all-environments";

export function ReactScan({enabled = false}: {enabled?: boolean}) {
  
  useEffect(() => {
    scan({
      enabled: enabled,
      showToolbar: enabled
    });
  }, [enabled]);

  return <></>;
}