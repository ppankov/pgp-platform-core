import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function DeliveryCountersWidget() {
  const [counts, setCounts] = useState({ pending: null, processed: null, failed: null });

  useEffect(() => {
    Promise.all([
      callFn("getEventDeliveries", { status: "pending" }).then((r) => r?.total ?? (r?.deliveries || []).length).catch(() => 0),
      callFn("getEventDeliveries", { status: "processed" }).then((r) => r?.total ?? (r?.deliveries || []).length).catch(() => 0),
      callFn("getEventDeliveries", { status: "failed" }).then((r) => r?.total ?? (r?.deliveries || []).length).catch(() => 0),
    ]).then(([pending, processed, failed]) => setCounts({ pending, processed, failed }));
  }, []);

  const items = [
    { label: t("eventbus.count_deliveries_pending"), value: counts.pending },
    { label: t("eventbus.count_deliveries_processed"), value: counts.processed },
    { label: t("eventbus.count_deliveries_failed"), value: counts.failed },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">
            {t("eventbus.widget_delivery_title")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{t("eventbus.widget_delivery_desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
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