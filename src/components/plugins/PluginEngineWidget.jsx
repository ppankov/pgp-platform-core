import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Puzzle } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function PluginEngineWidget() {
  const [counts, setCounts] = useState({
    definitions: null,
    released: null,
    installed: null,
    enabled: null,
  });

  useEffect(() => {
    Promise.all([
      backend.catalog.list("PluginDefinition").then((r) => r.length).catch(() => 0),
      callFn("listPlugins", {})
        .then((r) => (r?.versions || []).filter((v) => v.releaseStatus === "released").length)
        .catch(() => 0),
      callFn("getOrganizations", {})
        .then((r) => (r?.organizations || [])[0]?.id)
        .then((orgId) => (orgId ? callFn("listPlugins", { organizationId: orgId }) : { installations: [] }))
        .then((r) => ((r?.installations || []).filter((i) => !i.uninstalledAt)).length)
        .catch(() => 0),
      callFn("getOrganizations", {})
        .then((r) => (r?.organizations || [])[0]?.id)
        .then((orgId) => (orgId ? callFn("listPlugins", { organizationId: orgId }) : { installations: [] }))
        .then((r) => ((r?.installations || []).filter((i) => i.enabled && !i.uninstalledAt)).length)
        .catch(() => 0),
    ]).then(([definitions, released, installed, enabled]) =>
      setCounts({ definitions, released, installed, enabled })
    );
  }, []);

  const items = [
    { label: t("plugin.count_definitions"), value: counts.definitions, to: "/plugins" },
    { label: t("plugin.count_released"), value: counts.released, to: "/plugins" },
    { label: t("plugin.count_installed"), value: counts.installed, to: "/plugins/installed" },
    { label: t("plugin.count_enabled"), value: counts.enabled, to: "/plugins/installed" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">{t("plugin.widget_title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("plugin.widget_desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((it) => (
            <Link
              key={it.label}
              to={it.to}
              className="rounded-lg border border-border p-3 hover:bg-accent transition-colors"
            >
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