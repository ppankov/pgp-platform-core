import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pause, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { useToast } from "@/components/ui/use-toast";
import { t } from "@/lib/i18n";

export default function JobScheduleDetailPage() {
  const { scheduleId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listJobSchedules", {});
      const s = (res.schedules || []).find((x) => x.id === scheduleId);
      setSchedule(s || null);
      const jr = await callFn("listBackgroundJobs", { jobScheduleId: scheduleId, sort: "-createdAt", limit: 50 });
      setJobs(jr.jobs || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [scheduleId]);

  const canManage = (scope) => {
    if (user?.role === "super_admin") return true;
    if (scope === "platform") return hasCapability(user?.role, "platform.jobs.manage");
    return hasCapability(user?.role, "platform.jobs.connect");
  };
  const allowed = schedule && canManage(schedule.scope) && schedule.enabled && !schedule.cancelledAt;

  const act = async (fn, label) => {
    try {
      await callFn(fn, { jobScheduleId: scheduleId });
      toast({ title: label });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    }
  };

  const fmt = (v) => v ? new Date(v).toLocaleString() : "—";

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/jobs/schedules"><ArrowLeft className="w-4 h-4 mr-1" />{t("jobs.back")}</Link>
        </Button>
        <ModuleHeader title={schedule?.name || t("jobs.schedule_detail")} description={schedule?.description || ""} actions={allowed && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => act("pauseJobSchedule", t("jobs.pause_schedule"))}><Pause className="w-4 h-4" />{t("jobs.pause_schedule")}</Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => act("cancelJobSchedule", t("jobs.cancel_schedule"))}><XCircle className="w-4 h-4" />{t("jobs.cancel_schedule")}</Button>
          </div>
        )} />
        {schedule && !schedule.enabled && schedule.pausedAt && !schedule.cancelledAt && canManage(schedule.scope) && (
          <Button size="sm" variant="outline" className="gap-2 mt-2" onClick={() => act("resumeJobSchedule", t("jobs.resume_schedule"))}><Play className="w-4 h-4" />{t("jobs.resume_schedule")}</Button>
        )}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {!schedule && !err && <p className="text-sm text-muted-foreground">{t("jobs.loading")}</p>}
      {schedule && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground">{t("jobs.field.key")}</p><p className="font-mono">{schedule.key}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.scope")}</p><p>{t("jobs.scope_" + schedule.scope)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.scheduleType")}</p><p>{t("jobs.schedule_" + schedule.scheduleType)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.enabled")}</p><Badge variant={schedule.enabled ? "default" : "secondary"}>{String(schedule.enabled)}</Badge></div>
                <div><p className="text-muted-foreground">{t("jobs.field.nextRunAt")}</p><p>{fmt(schedule.nextRunAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.lastEnqueuedAt")}</p><p>{fmt(schedule.lastEnqueuedAt)}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.runCount")}</p><p>{schedule.runCount ?? 0}</p></div>
                <div><p className="text-muted-foreground">{t("jobs.field.priority")}</p><p>{schedule.priority ?? 5}</p></div>
                {schedule.cancelledAt && <div><p className="text-muted-foreground">{t("jobs.field.cancelledAt")}</p><p>{fmt(schedule.cancelledAt)}</p></div>}
                {schedule.pausedAt && <div><p className="text-muted-foreground">{t("jobs.field.pausedAt")}</p><p>{fmt(schedule.pausedAt)}</p></div>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><p className="font-heading font-semibold">{t("jobs.queue")}</p></CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("jobs.field.status")}</TableHead>
                      <TableHead>{t("jobs.field.createdAt")}</TableHead>
                      <TableHead>{t("jobs.field.availableAt")}</TableHead>
                      <TableHead className="text-right">{t("jobs.view")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell><JobStatusBadge status={j.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmt(j.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmt(j.availableAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild><Link to={`/jobs/jobs/${j.id}`}><ArrowLeft className="w-4 h-4 rotate-180" /></Link></Button>
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
    </div>
  );
}