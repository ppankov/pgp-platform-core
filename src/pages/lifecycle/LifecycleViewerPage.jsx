import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { t } from "@/lib/i18n";

export default function LifecycleViewerPage() {
  const [params, setParams] = useSearchParams();
  const lifecycleId = params.get("lifecycle") || "";
  const [definitions, setDefinitions] = useState(null);
  const [states, setStates] = useState([]);
  const [transitions, setTransitions] = useState([]);

  useEffect(() => {
    backend.catalog.list("LifecycleDefinition").then(setDefinitions);
  }, []);

  useEffect(() => {
    if (!lifecycleId) { setStates([]); setTransitions([]); return; }
    Promise.all([
      backend.catalog.filter("LifecycleState", { lifecycleId }).catch(() => []),
      backend.catalog.filter("LifecycleTransition", { lifecycleId }).catch(() => []),
    ]).then(([s, tr]) => {
      setStates(s);
      setTransitions(tr);
    });
  }, [lifecycleId]);

  const sorted = useMemo(
    () => [...states].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [states]
  );
  const stateName = (id) => states.find((s) => s.id === id)?.title || "—";
  const activeDef = definitions?.find((d) => d.id === lifecycleId);

  return (
    <div className="space-y-6">
      <ModuleHeader title={t("lifecycle.viewer")} description={t("lifecycle.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1.5 max-w-sm">
            <label className="text-sm font-medium">{t("lifecycle.select_lifecycle")}</label>
            <Select
              value={lifecycleId}
              onValueChange={(id) => setParams(id ? { lifecycle: id } : {})}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("lifecycle.select_lifecycle")} />
              </SelectTrigger>
              <SelectContent>
                {(definitions || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!lifecycleId ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("lifecycle.viewer_empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-heading font-semibold text-foreground">{activeDef?.name || "—"}</p>
                {activeDef?.targetType && (
                  <Badge variant="outline" className="font-mono">{activeDef.targetType}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {sorted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
                ) : (
                  sorted.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border p-3 min-w-[160px]"
                      style={{ borderColor: s.color || undefined }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.color || "#94a3b8" }}
                        />
                        <span className="font-medium text-foreground">{s.title}</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{s.key}</p>
                      <div className="flex gap-1 mt-2">
                        {s.isInitial && (
                          <Badge variant="outline" className="text-[10px]">{t("lifecycle.initial")}</Badge>
                        )}
                        {s.isFinal && (
                          <Badge variant="secondary" className="text-[10px]">{t("lifecycle.final")}</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="font-heading font-semibold text-foreground">{t("lifecycle.transitions")}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
                ) : (
                  transitions.map((tr) => (
                    <div
                      key={tr.id}
                      className="flex items-center gap-3 text-sm border border-border rounded-md p-2"
                    >
                      <span className="font-medium">{stateName(tr.fromState)}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{stateName(tr.toState)}</span>
                      {tr.requiresApproval && (
                        <Badge variant="default" className="text-[10px]">
                          {t("lifecycle.field.requires_approval")}
                        </Badge>
                      )}
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {(tr.allowedRoles || []).map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">
                            {t(`role.${r}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}