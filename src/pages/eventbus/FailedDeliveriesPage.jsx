import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function FailedDeliveriesPage() {
  const [deliveries, setDeliveries] = useState(null);
  const [err, setErr] = useState("");

  // Phase 9: route through hardened getEventDeliveries (status=failed list
  // mode) instead of direct EventDelivery SDK reads.
  useEffect(() => {
    setErr("");
    callFn("getEventDeliveries", { status: "failed" })
      .then((res) => setDeliveries(res.deliveries || []))
      .catch((e) => {
        setErr(e.response?.data?.error || e.message || String(e));
        setDeliveries([]);
      });
  }, []);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("eventbus.failed_deliveries")}
        description={t("eventbus.deliveries_desc")}
      />

      <Card>
        <CardContent className="pt-6">
          {deliveries === null ? (
            <Skeleton className="h-8 w-full" />
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("eventbus.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("eventbus.field.subscriber")}</TableHead>
                  <TableHead>{t("eventbus.field.eventType")}</TableHead>
                  <TableHead>{t("eventbus.field.attemptCount")}</TableHead>
                  <TableHead>{t("eventbus.field.lastError")}</TableHead>
                  <TableHead>{t("eventbus.field.failedAt")}</TableHead>
                  <TableHead className="text-right">{t("eventbus.view_detail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.subscriber}</TableCell>
                    <TableCell className="font-mono text-xs">{d.eventType}</TableCell>
                    <TableCell>{d.attemptCount ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground break-all max-w-xs">
                      {d.lastError || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.failedAt ? new Date(d.failedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/event-bus/delivery/${d.id}`} aria-label={t("eventbus.view_detail")}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        {t("eventbus.failed_deliveries")} — {t("eventbus.widget_delivery_desc")}
      </p>
    </div>
  );
}