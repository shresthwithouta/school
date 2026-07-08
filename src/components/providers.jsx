"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster closeButton position="top-right" />
    </ThemeProvider>
  );
}
