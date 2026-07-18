import React from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { t } from "@/lib/i18n";

export default function RoleIndicator() {
  const { user } = useAuth();
  const role = user?.role || "user";

  return (
    <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted shrink-0">
      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{t(`role.${role}`)}</span>
    </div>
  );
}