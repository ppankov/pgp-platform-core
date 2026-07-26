import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, AlertTriangle, Play, Timer } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/lib/i18n";

export default function JobQueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";
  const canEnqueue = hasCapability(user?.role, "platform.jobs.connect") || hasCapability(user?.role, "platform.jobs.manage");
  const canCancel = canEnqueue;
  const [jobs, setJobs] = useState(null);
  const [err, setErr] = useState("");
  const [defs, setDefs] = useState([]);
  const [open, setOpen] = useState(false);
  const [tickBusy, setTickBusy] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listBackgroundJobs", { status: ["queued", "retry_wait"], sort: "availableAt" });
      setJobs(res.jobs || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  const loadDefs = async () => { try { setDefs(await backend.catalog.list("JobDefinition")); } catch (e) {} };
  useEffect(() => { load(); loadDefs(); }, []);

  const runTick = async () => {
    setTickBusy(true);
    try { const r = await callFn("runSchedulerTick", {}); toast({ title: t("jobs.run_tick"), description: `evaluated=${r.evaluated} enqueued=${r.enqueued} skipped=${r.skipped} disabled=${r.disabled}` }); load(); }
    catch (e) { toast({ variant: "destructive", title: e.response?.data?.error || e.message }); }
    finally { setTickBusy(false); }
  };
  const runWorker = async () => {
    setTickBusy(true);
    try { const r = await callFn("processBackgroundJobs", { batchSize: 10 }); toast({ title: t("jobs.run_worker"), description: `processed=${r.processed} succeeded=${r.succeeded} failed=${r.failed} retried=${r.retried} deadLettered=${r.deadLettered}` }); load(); }
    catch (e) { toast({ variant: "destructive", title: e.response?.data?.error || e.message }); }
    finally { setTickBusy(false); }
  };
  const cancelJob = async (id, scope) => {
    try { await callFn("cancelBackgroundJob", { backgroundJobId: id }); toast({ title: t("jobs.cancel_job") }); load(); }
    catch (e) { toast({ variant: "destructive", title: e.response?.data?.error || e.message }); }
  };
  const canCancelJob = (job) => {
    if (user?.role === "super_admin") return true;
    if (job.scope === "platform") return hasCapability(user?.role, "platform.jobs.manage");
    return hasCapability(user?.role, "platform.jobs.connect");
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("jobs.queue")}
        description={t("jobs.queue_desc")}
        actions={
          <div className="flex gap-2">
            {isSuperAdmin && (
              <>
                <Button size="sm" variant="outline" className="gap-2" onClick={runTick} disabled={tickBusy}><Timer className="w-4 h-4" />{t("jobs.run_tick")}</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={runWorker} disabled={tickBusy}><Play className="w-4 h-4" />{t("jobs.run_worker")}</Button>
              </>
            )}
            {canEnqueue && defs.length > 0 && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />{t("jobs.enqueue_job")}</Button>
            )}
          </div>
        }
      />
      <Card>
        <CardContent className="pt-4">
          <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" />{t("jobs.external_trigger_required")}</Badge>
          <p className="text-xs text-muted-foreground mt-2">{t("jobs.scheduler_mode")}: {t("jobs.external_trigger_required")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {jobs === null ? (
            <p className="text-sm text-muted-foreground">{t("jobs.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("jobs.field.status")}</TableHead>
                  <TableHead>{t("jobs.field.priority")}</TableHead>
                  <TableHead>{t("jobs.field.scope")}</TableHead>
                  <TableHead>{t("jobs.field.availableAt")}</TableHead>
                  <TableHead>{t("jobs.field.attemptCount")}</TableHead>
                  <TableHead className="text-right">{t("jobs.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell><JobStatusBadge status={j.status} /></TableCell>
                    <TableCell>{j.priority ?? 5}</TableCell>
                    <TableCell><Badge variant={j.scope === "platform" ? "default" : "secondary"}>{t("jobs.scope_" + j.scope)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.availableAt ? new Date(j.availableAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>{j.attemptCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canCancelJob(j) && <Button size="sm" variant="ghost" onClick={() => cancelJob(j.id, j.scope)}>{t("jobs.cancel_job")}</Button>}
                        <Button variant="ghost" size="icon" asChild><Link to={`/jobs/jobs/${j.id}`}><ArrowRight className="w-4 h-4" /></Link></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("jobs.enqueue_job")}</DialogTitle></DialogHeader>
          {open && <EnqueueForm defs={defs} onDone={() => { setOpen(false); load(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnqueueForm({ defs, onDone }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [jobDefinitionId, setJobDefinitionId] = useState(defs[0]?.id || "");
  const [scope, setScope] = useState("organization");
  const [organizationId, setOrganizationId] = useState("");
  const [priority, setPriority] = useState("5");
  const [deduplicationKey, setDeduplicationKey] = useState("");
  const [payload, setPayload] = useState("{}");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!jobDefinitionId) return;
    if (scope === "organization" && !organizationId.trim()) { toast({ variant: "destructive", title: t("jobs.field.organizationId") }); return; }
    let pl; try { pl = JSON.parse(payload); } catch (e) { toast({ variant: "destructive", title: "payload: " + e.message }); return; }
    setSaving(true);
    try {
      await callFn("enqueueBackgroundJob", {
        jobDefinitionId, scope,
        organizationId: scope === "organization" ? organizationId.trim() : null,
        priority: Number(priority) || 5,
        deduplicationKey: deduplicationKey.trim() || null,
        payload: pl,
      });
      toast({ title: t("jobs.saved") });
      onDone?.();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("jobs.field.jobDefinitionId")}</Label>
        <Select value={jobDefinitionId} onValueChange={setJobDefinitionId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{defs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} ({d.key})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.scope")}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">{t("jobs.scope_organization")}</SelectItem>
              <SelectItem value="platform">{t("jobs.scope_platform")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.priority")}</Label>
          <Input type="number" min={0} max={10} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>
      {scope === "organization" && (
        <div className="space-y-2">
          <Label>{t("jobs.field.organizationId")}</Label>
          <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("jobs.field.deduplicationKey")}</Label>
        <Input value={deduplicationKey} onChange={(e) => setDeduplicationKey(e.target.value)} placeholder={t("jobs.empty")} />
      </div>
      <div className="space-y-2">
        <Label>{t("jobs.field.payload")}</Label>
        <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={4} className="font-mono text-xs" spellCheck={false} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone}>{t("jobs.cancel")}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? t("jobs.saving") : t("jobs.save")}</Button>
      </div>
    </div>
  );
}