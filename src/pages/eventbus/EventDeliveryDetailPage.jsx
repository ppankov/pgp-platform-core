import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

// Phase 9: route through hardened getEventDeliveryDetailSecure instead of
// direct EventDelivery / PlatformEvent / EventSubscription SDK reads.
// Raw PlatformEvent.payload is never received; only a redacted, capped
// payloadPreview (max 4 KB) is rendered.

export default function EventDeliveryDetailPage() {
  const { deliveryId } = useParams();
  const [data, setData] = useState(undefined);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!deliveryId) return;
    setErr("");
    callFn("getEventDeliveryDetailSecure", { deliveryId })
      .then((res) => setData(res))
      .catch((e) => {
        setErr(e.response?.data?.error || e.message || String(e));
        setData(null);
      });
  }, [deliveryId]);

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <ModuleHeader title={t("eventbus.delivery_detail")} description={t("eventbus.deliveries_desc")} />
        {err ? (
          <Card><CardContent className="pt-6"><p className="text-sm text-destructive">{err}</p></CardContent></Card>
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </div>
    );
  }
  if (data === null || !data.delivery) {
    return (
      <div className="space-y-6">
        <ModuleHeader title={t("eventbus.delivery_detail")} description={t("eventbus.deliveries_desc")} />
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{err || t("eventbus.empty")}</p></CardContent></Card>
      </div>
    );
  }

  const { delivery, event, subscription } = data;

  const deliveryRows = [
    "eventId", "subscriptionId", "subscriber", "eventType", "status",
    "attemptCount", "lastError", "createdAt", "startedAt", "processedAt", "failedAt",
  ];
  const eventRows = ["eventType", "sourceType", "sourceId", "actorId", "organizationId", "correlationId", "status"];

  const renderValue = (k, v) => {
    if (v === null || v === undefined || v === "") return "—";
    if (k === "status") return <Badge>{t(`eventbus.status_${v}`)}</Badge>;
    return <span className="break-all">{String(v)}</span>;
  };

  const renderPayloadPreview = (preview) => {
    if (!preview) return <span className="text-muted-foreground">—</span>;
    return <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(preview, null, 2)}</pre>;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("eventbus.delivery_detail")}
        description={t("eventbus.deliveries_desc")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/event-bus/deliveries">
              <ArrowLeft className="w-4 h-4" />
              {t("eventbus.back")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <p className="font-heading font-semibold text-foreground">{t("eventbus.delivery_detail")}</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {deliveryRows.map((k) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t(`eventbus.field.${k}`)}</dt>
                <dd className="font-medium text-foreground">{renderValue(k, delivery[k])}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {event && (
        <Card>
          <CardHeader>
            <p className="font-heading font-semibold text-foreground">{t("eventbus.field.eventId")}</p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {eventRows.map((k) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{t(`eventbus.field.${k}`)}</dt>
                  <dd className="font-medium text-foreground">{renderValue(k, event[k])}</dd>
                </div>
              ))}
              <div className="flex flex-col sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t("eventbus.field.payload")}</dt>
                <dd className="font-medium text-foreground">{renderPayloadPreview(event.payloadPreview?.preview)}</dd>
                {event.payloadPreview?.truncated && (
                  <p className="text-xs text-amber-600 mt-1">
                    [TRUNCATED] payload preview capped at {event.payloadPreview.maxSize} bytes (full size {event.payloadPreview.size} bytes)
                  </p>
                )}
                {!event.payloadPreview?.truncated && event.payloadPreview?.size != null && (
                  <p className="text-xs text-muted-foreground mt-1">[REDACTED] secret-looking keys masked</p>
                )}
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {subscription && (
        <Card>
          <CardHeader>
            <p className="font-heading font-semibold text-foreground">{t("eventbus.field.subscriptionId")}</p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t("eventbus.field.subscriber")}</dt>
                <dd className="font-medium text-foreground font-mono">{subscription.subscriber}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t("eventbus.field.eventType")}</dt>
                <dd className="font-medium text-foreground font-mono">{subscription.eventType}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{t("eventbus.field.status")}</dt>
                <dd className="font-medium text-foreground">
                  <Badge variant={subscription.active ? "default" : "secondary"}>
                    {subscription.active ? t("eventbus.status_processed") : t("eventbus.status_failed")}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}