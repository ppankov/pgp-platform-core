import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plug } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { callFn } from "@/lib/function-call";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function ConnectorEngineWidget() {
  const [counts, setCounts] = useState({
    definitions: null, providers: null, connections: null, active: null,
  });

  useEffect(() => {
    Promise.all([
      backend.catalog.list("ConnectorDefinition").then((r) => r.length).catch(() => 0),
      backend.catalog.filter("ConnectorProvider", { active: true }).then((r) => r.length).catch(() => 0),
      callFn("getOrganizations", {})
        .then((r) => (r?.organizations || [])[0]?.id)
        .then((orgId) => (orgId ? callFn("listConnectors", { organizationId: orgId }) : { connections: [] }))
        .then((r) => ((r?.connections || []).filter((c) => c.status !== "disconnected")).length)
        .catch(() => 0),
      callFn("getOrganizations", {})
        .then((r) => (r?.organizations || [])[0]?.id)
        .then((orgId) => (orgId ? callFn("listConnectors", { organizationId: orgId, status: "active" }) : { connections: [] }))
        .then((r) => (r?.connections || []).length)
        .catch(() => 0),
    ]).then(([definitions, providers, connections, active]) =>
      setCounts({ definitions, providers, connections, active })
    );
  }, []);

  const items = [
    { label: t("connector.count_definitions"), value: counts.definitions, to: "/connectors" },
    { label: t("connector.count_active_providers"), value: counts.providers, to: "/connectors" },
    { label: t("connector.count_connections"), value: counts.connections, to: "/connectors/connections" },
    { label: t("connector.count_active_connections"), value: counts.active, to: "/connectors/connections" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">{t("connector.widget_title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("connector.widget_desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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