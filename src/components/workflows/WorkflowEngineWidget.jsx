import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Workflow } from "lucide-react";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function WorkflowEngineWidget() {
  const [counts, setCounts] = useState({
    definitions: null, releasedVersions: null, running: null, waiting: null, failed: null,
  });

  useEffect(() => {
    Promise.all([
      callFn("listWorkflows", {}).then((r) => (r?.definitions || []).length).catch(() => 0),
      callFn("listWorkflows", {}).then((r) => (r?.versions || []).filter((v) => v.releaseStatus === "released").length).catch(() => 0),
      callFn("listWorkflows", {}).then((r) => (r?.instances || []).filter((i) => i.status === "running").length).catch(() => 0),
      callFn("listWorkflowStepRuns", { status: "waiting" }).then((r) => r?.total ?? (r?.stepRuns || []).length).catch(() => 0),
      callFn("listWorkflows", {}).then((r) => (r?.instances || []).filter((i) => i.status === "failed").length).catch(() => 0),
    ]).then(([definitions, releasedVersions, running, waiting, failed]) =>
      setCounts({ definitions, releasedVersions, running, waiting, failed })
    );
  }, []);

  const items = [
    { label: t("workflow.count_definitions"), value: counts.definitions, to: "/workflows" },
    { label: t("workflow.count_released_versions"), value: counts.releasedVersions, to: "/workflows" },
    { label: t("workflow.count_running"), value: counts.running, to: "/workflows/instances" },
    { label: t("workflow.count_waiting_steps"), value: counts.waiting, to: "/workflows/instances" },
    { label: t("workflow.count_failed"), value: counts.failed, to: "/workflows/instances" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">{t("workflow.widget_title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("workflow.widget_desc")}</p>
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