import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import JobDefinitionForm from "@/components/jobs/JobDefinitionForm";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function JobDefinitionsPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user?.role, "platform.jobs.manage");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const r = await base44.entities.JobDefinition.list();
      setRows(r);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("jobs.definitions")}
        description={t("jobs.definitions_desc")}
        actions={canManage && (
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />{t("jobs.new_definition")}
          </Button>
        )}
      />
      <Card>
        <CardContent className="pt-6">
          {rows === null ? (
            <p className="text-sm text-muted-foreground">{t("jobs.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("jobs.field.name")}</TableHead>
                  <TableHead>{t("jobs.field.key")}</TableHead>
                  <TableHead>{t("jobs.field.handlerKey")}</TableHead>
                  <TableHead>{t("jobs.field.active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{d.key}</span></TableCell>
                    <TableCell><span className="font-mono text-xs">{d.handlerKey}</span></TableCell>
                    <TableCell><Badge variant={d.active ? "default" : "secondary"}>{d.active ? t("jobs.field.active") : "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("jobs.new_definition")}</DialogTitle></DialogHeader>
          {open && <JobDefinitionForm onSave={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}