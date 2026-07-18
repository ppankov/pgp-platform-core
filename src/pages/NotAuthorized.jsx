import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { t } from "@/lib/i18n";

export default function NotAuthorized() {
  const { user } = useAuth();
  const role = user?.role || "unknown";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          {t("common.access_restricted")}
        </h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <ShieldX className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t("common.access_restricted")}
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t("common.access_restricted_desc")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-muted text-muted-foreground">
                  role: {role}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Phase 1 — Frontend Authorization UX
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}