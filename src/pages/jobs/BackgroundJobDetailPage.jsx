import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/lib/i18n";

export default function BackgroundJobDetailPage() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("getBackgroundJob", { backgroundJobId: jobId });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [jobId]);

  const job = data?.job;
  const attempts = data?.attempts || [];
  const events = data?.events || [];

  const canCancel = (j) => {
    if (!j) return false;
    if (user?.role === "super_admin") return true;
    if (j.scope === "platform") return hasCapability(user?.role, "platform.jobs.manage");
    return hasCapability(user?.role, "platform.jobs.connect");
  };
  const cancelJob = async () => {
    try { await callFn("cancelBackgroundJob", { backgroundJobId: jobId }); toast({ title: t("jobs.cancel_job") }); load(); }
    catch (e) { toast({ variant: "destructive", title: e.response?.data?.error || e.message }); }
  };

  const fmt = (v) => v ? new Date(v).toLocaleString() : "—";

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/jobs/queue"><ArrowLeft className="w-4 h-4 mr-1" />{t("jobs.back")}</Link>
        </Button>
        <ModuleHeader
          title={t("jobs.job_detail")}
          description={job ? `${job.handlerKey}` : ""}
          actions={job && canCancel(job) && ["queued", "retry_wait"].includes(job.status) && (
            <Button size="sm" variant="outline" className="gap-2" onClick={cancelJob}><XCircle className="w-4 h-4" />{t("jobs.cancel_job")}</Button>
          )}
        />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {!data && !err && <p className="text-sm text-muted-foreground">{t("jobs.loading")}</p>}
      {job && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("jobs.field.status")}</p><JobStatusBadge status={job.status} /></div>
                <div><p className="text-muted-foreground">{t("jobs.field.scope")}</p><p>{t("jobs.scope_" + job.scope)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.priority")}</p><p>{job.priority ?? 5}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.attemptCount")}</p><p>{job.attemptCount ?? 0} / {job.maxAttempts ?? 1}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.createdAt")}</p><p>{fmt(job.createdAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.availableAt")}</p><p>{fmt(job.availableAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.leaseOwner")}</p><p className="font-mono text-xs">{job.leaseOwner || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.leaseExpiresAt")}</p><p>{fmt(job.leaseExpiresAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.deduplicationKey")}</p><p className="font-mono text-xs">{job.deduplicationKey || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.correlationId")}</p><p className="font-mono text-xs">{job.correlationId || "—"}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.startedAt")}</p><p>{fmt(job.startedAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.completedAt")}</p><p>{fmt(job.completedAt)}</p></div>
                {job.lastError && <div className="col-span-2"><p className="text-muted-foreground">{t("jobs.field.lastError")}</p><p className="text-destructive text-xs">{job.lastError}</p></div>}
              </div>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><p className="font-heading font-semibold">{t("jobs.attempts")}</p></CardHeader>
              <CardContent>
                {attempts.length === 0 ? <p className="text-sm text-muted-foreground">{t("jobs.no_attempts")}</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>{t("jobs.field.attemptNumber")}</TableHead>
                      <TableHead>{t("jobs.field.status")}</TableHead>
                      <TableHead>{t("jobs.field.workerId")}</TableHead>
                      <TableHead>{t("jobs.field.startedAt")}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {attempts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.attemptNumber}</TableCell>
                          <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{a.workerId || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmt(a.startedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><p className="font-heading font-semibold">{t("jobs.timeline")}</p></CardHeader>
              <CardContent>
                {events.length === 0 ? <p className="text-sm text-muted-foreground">{t("jobs.no_events")}</p> : (
                  <ol className="space-y-2">
                    {events.map((e) => (
                      <li key={e.id} className="text-xs border-l-2 border-border pl-3">
                        <span className="font-mono text-foreground">{e.eventType}</span>
                        <span className="text-muted-foreground"> · {fmt(e.createdAt)}</span>
                        {e.attemptNumber ? <span className="text-muted-foreground"> · #{e.attemptNumber}</span> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}