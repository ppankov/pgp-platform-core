import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Layers, Boxes, Plug, Shield, FileText } from "lucide-react";
import { useAuth } from "@/auth/AuthContextFacade";
import { t } from "@/lib/i18n";
import { ALL_ROUTES, NAV_GROUPS } from "@/lib/navigation";
import { PLATFORM_ROLES } from "@/lib/permissions";
import { CORE_ENTITIES, LIFECYCLE_ENTITIES } from "@/lib/entity-registry";
import LifecycleWidget from "@/components/lifecycle/LifecycleWidget";
import EventBusWidget from "@/components/eventbus/EventBusWidget";
import DeliveryCountersWidget from "@/components/eventbus/DeliveryCountersWidget";
import PluginEngineWidget from "@/components/plugins/PluginEngineWidget";
import ConnectorEngineWidget from "@/components/connectors/ConnectorEngineWidget";
import WorkflowEngineWidget from "@/components/workflows/WorkflowEngineWidget";
import SchedulerEngineWidget from "@/components/jobs/SchedulerEngineWidget";

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || "user";

  const stats = [
    { icon: Layers, label: "Platform Modules", value: ALL_ROUTES.length, color: "text-blue-600" },
    { icon: Boxes, label: "Nav Groups", value: NAV_GROUPS.length, color: "text-purple-600" },
    { icon: Plug, label: "Core Entities", value: CORE_ENTITIES.length + LIFECYCLE_ENTITIES.length, color: "text-green-600" },
    { icon: Shield, label: "System Roles", value: PLATFORM_ROLES.length, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          {t("common.welcome")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("common.platform_overview")} — Phase 1 Architecture Foundation
        </p>
      </div>

      {/* User context card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="font-medium text-foreground">{user?.full_name || user?.email || "User"}</p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium text-foreground">{t(`role.${role}`)}</p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div>
              <p className="text-xs text-muted-foreground">Environment</p>
              <p className="font-medium text-foreground capitalize">Development</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lifecycle Engine widget */}
      <LifecycleWidget />

      {/* Platform Event Bus widget */}
      <EventBusWidget />

      {/* Event Delivery Runtime counters */}
      <DeliveryCountersWidget />

      {/* Plugin Engine counters */}
      <PluginEngineWidget />

      {/* Connector Engine counters */}
      <ConnectorEngineWidget />

      {/* Workflow Engine counters */}
      <WorkflowEngineWidget />

      {/* Scheduler and Background Job counters */}
      <SchedulerEngineWidget />

      {/* Platform principle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <p className="font-heading font-semibold text-foreground">Platform Implementation Rule</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every new feature is evaluated before implementation in this order:
          </p>
          <ol className="mt-3 space-y-1.5 text-sm text-foreground">
            <li><span className="font-mono text-muted-foreground mr-2">1.</span>Configuration</li>
            <li><span className="font-mono text-muted-foreground mr-2">2.</span>Plugin</li>
            <li><span className="font-mono text-muted-foreground mr-2">3.</span>Connector</li>
            <li><span className="font-mono text-muted-foreground mr-2">4.</span>Installable Application</li>
            <li><span className="font-mono text-muted-foreground mr-2">5.</span>Core modification (last resort)</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground italic">
            The Core must remain as stable and as small as possible throughout the lifetime of the platform.
          </p>
        </CardContent>
      </Card>

      {/* Phase notice */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Phase 1 — Architecture Foundation</p>
              <p className="text-sm text-muted-foreground mt-1">
                Navigation structure, core data model, role & permission model, and safe placeholder
                modules are in place. No business logic or backend functionality is implemented yet.
                All module pages are structural placeholders ready for Phase 2 implementation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}