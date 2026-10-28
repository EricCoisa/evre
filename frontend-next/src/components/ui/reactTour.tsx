'use client';

import type React from "react";
import { TourProvider } from "../tour";

/** Wraps the private layout with TourProvider so any page can register named tours. */
export function ReactTour({ children }: { children: React.ReactNode }) {
  return <TourProvider>{children}</TourProvider>;
}
