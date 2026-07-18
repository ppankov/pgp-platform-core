import React from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { ALL_ROUTES } from "@/lib/navigation";
import { t } from "@/lib/i18n";

// Reusable structural placeholder for all platform modules.
// Clearly labelled — no fake functionality, no buttons that claim to work.
export default function PlaceholderModule() {
  const location = useLocation();
  const route = ALL_ROUTES.find(
    (r) => r.path === location.pathname
  );
  const title = route ? t(route.labelKey) : t("common.placeholder_title");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Construction className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">Structural Placeholder</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("common.placeholder_desc")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-muted text-muted-foreground">
              {location.pathname}
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Phase 1 — Architecture Only
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}