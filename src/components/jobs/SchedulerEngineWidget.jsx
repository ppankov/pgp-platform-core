import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Timer, AlertTriangle } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

// PGP Core Phase 8: native scheduled automations are available on Base44 but were not
// wired/verified in-session. The scheduler therefore requires an explicit external trigger
// (or manual Super Admin invocation of the tick functions). Do not claim "Native Active".
const NATIVE_ACTIVE = false;

export default function SchedulerEngineWidget() {
  const [counts, setCounts] = useState({
    definitions: null, enabledSchedules: null, queued: null, running: null, deadLetter: null,
  });

  useEffect(() => {
    Promise.all([
      backend.catalog.list("JobDefinition").then((r) => r.length).catch(() => 0),
      callFn("listJobSchedules", { enabled: true }).then((r) => (r?.schedules || []).length).catch(() => 0),
      callFn("listBackgroundJobs", { status: ["queued", "retry_wait"] }).then((r) => (r?.jobs || []).length).catch(() => 0),
      callFn("listBackgroundJobs", { status: ["leased", "running"] }).then((r) => (r?.jobs || []).length).catch(() => 0),
      callFn("listBackgroundJobs", { status: "dead_letter" }).then((r) => (r?.jobs || []).length).catch(() => 0),
    ]).then(([definitions, enabledSchedules, queued, running, deadLetter]) =>
      setCounts({ definitions, enabledSchedules, queued, running, deadLetter })
    );
  }, []);

  const items = [
    { label: t("jobs.count_definitions"), value: counts.definitions, to: "/jobs/definitions" },
    { label: t("jobs.count_enabled_schedules"), value: counts.enabledSchedules, to: "/jobs/schedules" },
    { label: t("jobs.count_queued"), value: counts.queued, to: "/jobs/queue" },
    { label: t("jobs.count_running"), value: counts.running, to: "/jobs/queue" },
    { label: t("jobs.count_dead_letter"), value: counts.deadLetter, to: "/jobs/dead-letter" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">{t("jobs.widget_title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("jobs.widget_desc")}</p>
        <div className="mt-1">
          {NATIVE_ACTIVE ? (
            <Badge variant="default">{t("jobs.native_active")}</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t("jobs.external_trigger_required")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <Link key={it.label} to={it.to} className="rounded-lg border border-border p-3 hover:bg-accent transition-colors">
              <p className="text-2xl font-bold text-foreground">
                {it.value === null ? <Skeleton className="h-6 w-8" /> : it.value}
              </p>
              <p className="text-xs text-muted-foreground">{it.label}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}