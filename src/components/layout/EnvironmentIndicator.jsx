import React from "react";
import { Circle } from "lucide-react";

// Phase 1: reads from a platform setting in future; static for now.
export default function EnvironmentIndicator() {
  const env = "development";
  const colors = {
    development: "bg-amber-500",
    staging: "bg-blue-500",
    production: "bg-green-500",
  };

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted shrink-0">
      <Circle className={`w-2 h-2 fill-current ${colors[env] || "bg-muted-foreground"} text-transparent`} />
      <span className="text-xs font-medium text-muted-foreground capitalize">{env}</span>
    </div>
  );
}