import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const STATUS_VARIANT = {
  pending: "secondary", running: "default", waiting: "default",
  completed: "default", failed: "destructive", cancelled: "secondary",
};

export default function WorkflowInstancesPage() {
  const [instances, setInstances] = useState(null);
  const [defs, setDefs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [err, setErr] = useState("");

  // Phase 9 / Wave III: route through listWorkflows (membership-scoped instance
  // view) instead of direct cross-tenant WorkflowInstance.list(). Non-super_admin
  // callers only see instances for organizations where they are active members.
  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listWorkflows", {});
      setDefs(res.definitions || []);
      setInstances(res.instances || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || String(e));
      setDefs([]);
      setInstances([]);
    }
  };
  useEffect(() => { load(); }, []);

  const defName = (id) => {
    const d = defs.find((x) => x.id === id);
    return d ? d.name : id;
  };

  const rows = (instances || []).filter((i) => statusFilter === "all" || i.status === statusFilter);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("workflow.instances")}
        description={t("workflow.instances_desc")}
        actions={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("workflow.all_statuses")}</SelectItem>
              <SelectItem value="running">{t("workflow.status_running")}</SelectItem>
              <SelectItem value="waiting">{t("workflow.status_waiting")}</SelectItem>
              <SelectItem value="completed">{t("workflow.status_completed")}</SelectItem>
              <SelectItem value="failed">{t("workflow.status_failed")}</SelectItem>
              <SelectItem value="cancelled">{t("workflow.status_cancelled")}</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {instances === null ? (
            <p className="text-sm text-muted-foreground">{t("workflow.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("workflow.no_instances")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("workflow.field.workflow")}</TableHead>
                  <TableHead>{t("workflow.field.status")}</TableHead>
                  <TableHead>{t("workflow.field.currentNodeKey")}</TableHead>
                  <TableHead>{t("workflow.field.organizationId")}</TableHead>
                  <TableHead>{t("workflow.field.startedAt")}</TableHead>
                  <TableHead className="text-right">{t("workflow.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{defName(i.workflowDefinitionId)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[i.status] || "secondary"}>{t("workflow.status_" + i.status)}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{i.currentNodeKey || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.organizationId}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{i.startedAt ? new Date(i.startedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/workflows/instances/${i.id}`} aria-label={t("workflow.view_detail")}>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}