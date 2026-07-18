import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/lib/i18n";

const STATUS_VARIANT = {
  pending: "secondary", running: "default", waiting: "default",
  completed: "default", failed: "destructive", cancelled: "secondary",
  skipped: "secondary",
};

export default function WorkflowInstanceDetailPage() {
  const { instanceId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const canProgress = hasCapability(user?.role, "platform.workflows.connect");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [output, setOutput] = useState("");
  const [nextNodeKey, setNextNodeKey] = useState("");
  const [branchOptions, setBranchOptions] = useState([]);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("getWorkflowInstance", { workflowInstanceId: instanceId });
      setData(res);
      // compute branch options for current waiting manual node
      const inst = res.instance;
      const graph = res.version?.graph || {};
      const out = (graph.edges || []).filter((e) => e.from === inst?.currentNodeKey);
      setBranchOptions(out);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [instanceId]);

  const complete = async () => {
    let parsedOutput = {};
    if (output.trim()) {
      try { parsedOutput = JSON.parse(output); }
      catch (e) { toast({ variant: "destructive", title: e.message }); return; }
    }
    try {
      const payload = { workflowInstanceId: instanceId, output: parsedOutput };
      if (branchOptions.length > 1) {
        if (!nextNodeKey) { toast({ variant: "destructive", title: t("workflow.next_required") }); return; }
        payload.nextNodeKey = nextNodeKey;
      }
      const res = await callFn("completeWorkflowStep", payload);
      toast({ title: t("workflow.progressed"), description: `${t("workflow.status")}: ${res.instance.status}` });
      setOutput(""); setNextNodeKey("");
      load();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const fail = async () => {
    try {
      await callFn("failWorkflowStep", { workflowInstanceId: instanceId, error: "Manually failed" });
      toast({ title: t("workflow.failed") });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const cancel = async () => {
    try {
      await callFn("cancelWorkflowInstance", { workflowInstanceId: instanceId });
      toast({ title: t("workflow.cancelled") });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const inst = data?.instance;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/workflows/instances"><ArrowLeft className="w-4 h-4 mr-1" />{t("workflow.back")}</Link>
        </Button>
        <ModuleHeader title={t("workflow.instance_detail")} description={data?.definition?.name || ""} />
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {!data && !err && <p className="text-sm text-muted-foreground">{t("workflow.loading")}</p>}

      {data && inst && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("workflow.field.status")}</p>
                  <Badge variant={STATUS_VARIANT[inst.status] || "secondary"}>{t("workflow.status_" + inst.status)}</Badge>
                </div>
                <div><p className="text-muted-foreground">{t("workflow.field.currentNodeKey")}</p><p className="font-mono">{inst.currentNodeKey || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.correlationId")}</p><p className="font-mono text-xs truncate">{inst.correlationId || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.organizationId")}</p><p>{inst.organizationId}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.resourceType")}</p><p>{inst.resourceType || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.resourceId")}</p><p className="font-mono text-xs">{inst.resourceId || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.startedAt")}</p><p className="text-xs">{inst.startedAt ? new Date(inst.startedAt).toLocaleString() : "—"}</p></div>
                <div><p className="text-muted-foreground">{t("workflow.field.version")}</p><p className="font-mono">{data.version?.version || "—"}</p></div>
              </div>
              {inst.lastError && <p className="text-sm text-destructive mt-3">{inst.lastError}</p>}
            </CardContent>
          </Card>

          {canProgress && inst.status === "waiting" && (
            <Card>
              <CardHeader><p className="font-heading font-semibold">{t("workflow.progress_step")}</p></CardHeader>
              <CardContent className="space-y-4">
                {branchOptions.length > 1 && (
                  <div className="space-y-2">
                    <Label>{t("workflow.next_node")}</Label>
                    <Select value={nextNodeKey} onValueChange={setNextNodeKey}>
                      <SelectTrigger><SelectValue placeholder={t("workflow.next_required")} /></SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((e) => (
                          <SelectItem key={e.to} value={e.to}>{e.to}{e.label ? ` (${e.label})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("workflow.field.output")}</Label>
                  <Textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={4} className="font-mono text-xs" placeholder="{}" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-2" onClick={complete}><CheckCircle2 className="w-4 h-4" />{t("workflow.complete_step")}</Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={fail}><XCircle className="w-4 h-4" />{t("workflow.fail_step")}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {canProgress && (inst.status === "running" || inst.status === "waiting" || inst.status === "pending") && (
            <Button size="sm" variant="outline" className="gap-2" onClick={cancel}><Ban className="w-4 h-4" />{t("workflow.cancel_instance")}</Button>
          )}

          <Card>
            <CardHeader><p className="font-heading font-semibold">{t("workflow.steps")}</p></CardHeader>
            <CardContent>
              {(data.stepRuns || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("workflow.no_steps")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("workflow.field.nodeKey")}</TableHead>
                      <TableHead>{t("workflow.field.nodeType")}</TableHead>
                      <TableHead>{t("workflow.field.status")}</TableHead>
                      <TableHead>{t("workflow.field.startedAt")}</TableHead>
                      <TableHead>{t("workflow.field.completedAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.stepRuns || []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.nodeKey}</TableCell>
                        <TableCell>{s.nodeType}</TableCell>
                        <TableCell><Badge variant={STATUS_VARIANT[s.status] || "secondary"}>{t("workflow.status_" + s.status)}</Badge></TableCell>
                        <TableCell className="text-xs">{s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-xs">{s.completedAt ? new Date(s.completedAt).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><p className="font-heading font-semibold">{t("workflow.timeline")}</p></CardHeader>
            <CardContent>
              {(data.events || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("workflow.no_events")}</p>
              ) : (
                <ol className="space-y-2">
                  {(data.events || []).map((e) => (
                    <li key={e.id} className="flex items-start gap-3 text-sm">
                      <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="font-mono text-xs">{e.eventType}{e.nodeKey ? ` · ${e.nodeKey}` : ""}</p>
                        <p className="text-xs text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}