import React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

// Phase 1: static — notification backend is Phase 2.
export default function NotificationArea() {
  return (
    <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
      <Bell className="w-5 h-5" />
      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
    </Button>
  );
}