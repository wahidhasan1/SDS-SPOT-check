"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Signs in to the preconfigured demo account and opens the dashboard. */
export function DemoStartButton({
  children = "Explore the demo account",
  variant = "outline",
  size = "md",
  className,
}: {
  children?: React.ReactNode;
  variant?: "outline" | "ghost" | "secondary" | "primary" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <Button
        variant={variant}
        size={size}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            await api("/api/demo/start", { body: {} });
            router.push("/dashboard");
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
            setLoading(false);
          }
        }}
      >
        {children}
      </Button>
      {error && (
        <span role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </span>
      )}
    </span>
  );
}
