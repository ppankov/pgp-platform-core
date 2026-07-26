import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import PluginDefinitionForm from "@/components/plugins/PluginDefinitionForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function PluginCatalogPage() {
  const { user } = useAuth();
  const role = user?.role;
  const canManage = hasCapability(role, "platform.plugins.manage");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listPlugins", {});
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const versionName = (id) => {
    const v = (data?.versions || []).find((x) => x.id === id);
    return v ? v.version : "—";
  };

  const rows = data?.definitions || [];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("plugin.catalog")}
        description={t("plugin.catalog_desc")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/plugins/installed">{t("plugin.installed")}</Link>
            </Button>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />
                {t("plugin.register")}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {data === null ? (
            <p className="text-sm text-muted-foreground">{t("plugin.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("plugin.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("plugin.field.name")}</TableHead>
                  <TableHead>{t("plugin.field.key")}</TableHead>
                  <TableHead>{t("plugin.field.vendor")}</TableHead>
                  <TableHead>{t("plugin.field.category")}</TableHead>
                  <TableHead>{t("plugin.field.currentVersion")}</TableHead>
                  <TableHead>{t("plugin.field.active")}</TableHead>
                  <TableHead className="text-right">{t("plugin.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{d.key}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.vendor || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.category || "—"}</TableCell>
                    <TableCell>
                      {d.currentVersionId ? (
                        <Badge variant="secondary">{versionName(d.currentVersionId)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("plugin.no_current_version")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "default" : "secondary"}>
                        {d.active ? t("plugin.status_available") : t("plugin.status_disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/plugins/${d.id}`} aria-label={t("plugin.view_detail")}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("plugin.new_definition")}</DialogTitle>
          </DialogHeader>
          {open && (
            <PluginDefinitionForm
              onSave={() => { setOpen(false); load(); }}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}