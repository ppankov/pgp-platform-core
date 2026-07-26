import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import WorkflowDefinitionForm from "@/components/workflows/WorkflowDefinitionForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function WorkflowCatalogPage() {
  const { user } = useAuth();
  const canManagePlatform = hasCapability(user?.role, "platform.workflows.manage");
  const canManageOrg = hasCapability(user?.role, "platform.workflows.connect");
  const canManage = canManagePlatform || canManageOrg;
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listWorkflows", {});
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const versionCount = (defId) => (data?.versions || []).filter((v) => v.workflowDefinitionId === defId).length;
  const currentVersion = (def) => (data?.versions || []).find((v) => v.id === def.currentVersionId);
  const rows = data?.definitions || [];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("workflow.catalog")}
        description={t("workflow.catalog_desc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/workflows/instances">{t("workflow.instances")}</Link>
            </Button>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />{t("workflow.new_definition")}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {data === null ? (
            <p className="text-sm text-muted-foreground">{t("workflow.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("workflow.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("workflow.field.name")}</TableHead>
                  <TableHead>{t("workflow.field.key")}</TableHead>
                  <TableHead>{t("workflow.field.scope")}</TableHead>
                  <TableHead>{t("workflow.field.versions")}</TableHead>
                  <TableHead>{t("workflow.field.active")}</TableHead>
                  <TableHead className="text-right">{t("workflow.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const cv = currentVersion(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{d.key}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.scope === "platform" ? "default" : "secondary"}>
                          {t("workflow.scope_" + d.scope)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{versionCount(d.id)}</Badge>
                        {cv && <span className="ml-2 text-xs text-muted-foreground">{cv.version}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.active ? "default" : "secondary"}>
                          {d.active ? t("workflow.status_active") : t("workflow.status_disabled")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/workflows/${d.id}`} aria-label={t("workflow.view_detail")}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("workflow.new_definition")}</DialogTitle></DialogHeader>
          {open && <WorkflowDefinitionForm onSave={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}