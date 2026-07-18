import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobScheduleForm from "@/components/jobs/JobScheduleForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function JobSchedulesPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user?.role, "platform.jobs.manage") || hasCapability(user?.role, "platform.jobs.connect");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [defs, setDefs] = useState([]);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listJobSchedules", {});
      setData(res.schedules || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  const loadDefs = async () => {
    try { setDefs(await base44.entities.JobDefinition.list()); } catch (e) {}
  };
  useEffect(() => { load(); loadDefs(); }, []);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("jobs.schedules")}
        description={t("jobs.schedules_desc")}
        actions={canManage && defs.length > 0 && (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />{t("jobs.new_schedule")}
          </Button>
        )}
      />
      <Card>
        <CardContent className="pt-6">
          {data === null ? (
            <p className="text-sm text-muted-foreground">{t("jobs.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("jobs.field.name")}</TableHead>
                  <TableHead>{t("jobs.field.scope")}</TableHead>
                  <TableHead>{t("jobs.field.scheduleType")}</TableHead>
                  <TableHead>{t("jobs.field.nextRunAt")}</TableHead>
                  <TableHead>{t("jobs.field.lastEnqueuedAt")}</TableHead>
                  <TableHead>{t("jobs.field.enabled")}</TableHead>
                  <TableHead className="text-right">{t("jobs.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant={s.scope === "platform" ? "default" : "secondary"}>{t("jobs.scope_" + s.scope)}</Badge></TableCell>
                    <TableCell>{t("jobs.schedule_" + s.scheduleType)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.lastEnqueuedAt ? new Date(s.lastEnqueuedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? t("jobs.field.enabled") : "—"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/jobs/schedules/${s.id}`} aria-label={t("jobs.view_detail")}><ArrowRight className="w-4 h-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("jobs.new_schedule")}</DialogTitle></DialogHeader>
          {open && <JobScheduleForm definitions={defs} onSave={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}