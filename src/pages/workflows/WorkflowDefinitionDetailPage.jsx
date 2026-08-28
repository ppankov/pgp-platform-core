import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Rocket, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import WorkflowVersionForm from "@/components/workflows/WorkflowVersionForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/lib/i18n";

export default function WorkflowDefinitionDetailPage() {
  const { definitionId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const canManagePlatform = hasCapability(user?.role, "platform.workflows.manage");
  const canManageOrg = hasCapability(user?.role, "platform.workflows.connect");
  const canManage = canManagePlatform || canManageOrg;
  const canStart = hasCapability(user?.role, "platform.workflows.connect");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listWorkflows", {});
      const def = (res.definitions || []).find((d) => d.id === definitionId);
      const versions = (res.versions || []).filter((v) => v.workflowDefinitionId === definitionId);
      setData({ def, versions });
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [definitionId]);

  const release = async (versionId) => {
    try {
      await callFn("releaseWorkflowVersion", { workflowVersionId: versionId });
      toast({ title: t("workflow.released") });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const startInstance = async () => {
    const def = data?.def;
    if (!def) return;
    const organizationId = def.scope === "platform" ? (org.trim() || "default-org") : def.organizationId;
    try {
      const res = await callFn("startWorkflow", { workflowDefinitionId: def.id, organizationId });
      toast({ title: t("workflow.started"), description: `${t("workflow.status")}: ${res.instance.status}` });
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const def = data?.def;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/workflows"><ArrowLeft className="w-4 h-4 mr-1" />{t("workflow.back")}</Link>
        </Button>
        <ModuleHeader
          title={def?.name || t("workflow.definition_detail")}
          description={def?.description || ""}
          actions={canStart && def?.currentVersionId ? (
            <div className="flex gap-2 items-center">
              {def.scope === "platform" && (
                <input
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder={t("workflow.field.organizationId")}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                />
              )}
              <Button size="sm" className="gap-2" onClick={startInstance}>
                <Rocket className="w-4 h-4" />{t("workflow.start_instance")}
              </Button>
            </div>
          ) : null}
        />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {!def && !err && <p className="text-sm text-muted-foreground">{t("workflow.loading")}</p>}

      {def && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("workflow.field.key")}</p><p className="font-mono">{def.key}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.scope")}</p><p>{t("workflow.scope_" + def.scope)}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.organizationId")}</p><p>{def.organizationId || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.active")}</p>
                  <Badge variant={def.active ? "default" : "secondary"}>{def.active ? t("workflow.status_active") : t("workflow.status_disabled")}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <p className="font-heading font-semibold">{t("workflow.versions")}</p>
                {canManage && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
                    <Plus className="w-4 h-4" />{t("workflow.new_version")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("workflow.no_versions")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("workflow.field.version")}</TableHead>
                      <TableHead>{t("workflow.field.releaseStatus")}</TableHead>
                      <TableHead>{t("workflow.field.releasedAt")}</TableHead>
                      <TableHead className="text-right">{t("workflow.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono">{v.version}</TableCell>
                        <TableCell><Badge variant={v.releaseStatus === "released" ? "default" : "secondary"}>{t("workflow.release_" + v.releaseStatus)}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-xs">{v.releasedAt ? new Date(v.releasedAt).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          {v.releaseStatus === "draft" && canManage && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => release(v.id)}>
                              <CheckCircle2 className="w-4 h-4" />{t("workflow.release")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("workflow.new_version")}</DialogTitle></DialogHeader>
          {open && def && <WorkflowVersionForm definitionId={def.id} onSave={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}