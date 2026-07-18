import React, { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function EventBusWidget() {
  const [counts, setCounts] = useState({ events: null, subscribers: null });

  useEffect(() => {
    Promise.all([
      callFn("listPlatformEvents", { limit: 100 }).then((r) => r?.total ?? (r?.events || []).length).catch(() => 0),
      callFn("listSubscriptions", { active: true })
        .then((r) => (r?.subscriptions || []).length)
        .catch(() => 0),
    ]).then(([events, subscribers]) => setCounts({ events, subscribers }));
  }, []);

  const items = [
    { label: t("eventbus.count_events"), value: counts.events },
    { label: t("eventbus.count_subscribers"), value: counts.subscribers },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">
            {t("eventbus.widget_title")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{t("eventbus.widget_desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold text-foreground">
                {it.value === null ? <Skeleton className="h-6 w-8" /> : it.value}
              </p>
              <p className="text-xs text-muted-foreground">{it.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}