import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

const STATUS_VARIANT = {
  pending: "secondary",
  processing: "default",
  processed: "default",
  failed: "destructive",
};

export default function EventDeliveriesPage() {
  const [params] = useSearchParams();
  const eventId = params.get("event") || "";
  const [deliveries, setDeliveries] = useState(null);
  const [err, setErr] = useState("");

  // Phase 9: route through hardened getEventDeliveries (list mode or
  // event-scoped mode) instead of direct EventDelivery SDK reads.
  useEffect(() => {
    setErr("");
    const payload = eventId ? { eventId } : {};
    callFn("getEventDeliveries", payload)
      .then((res) => {
        setDeliveries(res.deliveries || []);
      })
      .catch((e) => {
        setErr(e.response?.data?.error || e.message || String(e));
        setDeliveries([]);
      });
  }, [eventId]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("eventbus.deliveries")}
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
                  <TableHead>{t("eventbus.field.status")}</TableHead>
                  <TableHead>{t("eventbus.field.attemptCount")}</TableHead>
                  <TableHead>{t("eventbus.field.createdAt")}</TableHead>
                  <TableHead className="text-right">{t("eventbus.view_detail")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.subscriber}</TableCell>
                    <TableCell className="font-mono text-xs">{d.eventType}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status] || "secondary"}>
                        {t(`eventbus.status_${d.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{d.attemptCount ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
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
    </div>
  );
}