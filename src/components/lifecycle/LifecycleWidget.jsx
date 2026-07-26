import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Workflow } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export default function LifecycleWidget() {
  const [counts, setCounts] = useState({
    definitions: null,
    states: null,
    transitions: null,
  });

  useEffect(() => {
    Promise.all([
      backend.catalog.list("LifecycleDefinition").then((r) => r.length).catch(() => 0),
      backend.catalog.list("LifecycleState").then((r) => r.length).catch(() => 0),
      backend.catalog.list("LifecycleTransition").then((r) => r.length).catch(() => 0),
    ]).then(([d, s, tr]) =>
      setCounts({ definitions: d, states: s, transitions: tr })
    );
  }, []);

  const items = [
    { label: t("lifecycle.count_definitions"), value: counts.definitions, to: "/lifecycle/definitions" },
    { label: t("lifecycle.count_states"), value: counts.states, to: "/lifecycle/states" },
    { label: t("lifecycle.count_transitions"), value: counts.transitions, to: "/lifecycle/transitions" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <p className="font-heading font-semibold text-foreground">{t("lifecycle.widget_title")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("lifecycle.widget_desc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
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