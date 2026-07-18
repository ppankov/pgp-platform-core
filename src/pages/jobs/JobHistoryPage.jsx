import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobStatusBadge from "@/components/jobs/JobStatusBadge";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function JobHistoryPage() {
  const [jobs, setJobs] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listBackgroundJobs", { status: ["succeeded", "cancelled"], sort: "-completedAt", limit: 100 });
      setJobs(res.jobs || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const fmt = (v) => v ? new Date(v).toLocaleString() : "—";

  return (
    <div className="space-y-6">
      <ModuleHeader title={t("jobs.history")} description={t("jobs.history_desc")} />
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
                  <TableHead>{t("jobs.field.scope")}</TableHead>
                  <TableHead>{t("jobs.field.handlerKey")}</TableHead>
                  <TableHead>{t("jobs.field.completedAt")}</TableHead>
                  <TableHead>{t("jobs.field.attemptCount")}</TableHead>
                  <TableHead className="text-right">{t("jobs.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell><JobStatusBadge status={j.status} /></TableCell>
                    <TableCell>{t("jobs.scope_" + j.scope)}</TableCell>
                    <TableCell className="font-mono text-xs">{j.handlerKey}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(j.completedAt || j.cancelledAt)}</TableCell>
                    <TableCell>{j.attemptCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild><Link to={`/jobs/jobs/${j.id}`}><ArrowRight className="w-4 h-4" /></Link></Button>
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