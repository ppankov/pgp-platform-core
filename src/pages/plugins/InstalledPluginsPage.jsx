import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function InstalledPluginsPage() {
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    callFn("getOrganizations", {})
      .then((r) => {
        const list = r?.organizations || [];
        setOrgs(list);
        if (list.length) setOrgId(list[0].id);
      })
      .catch(() => setOrgs([]));
  }, []);

  useEffect(() => {
    if (!orgId) { setData(null); return; }
    setErr("");
    callFn("listPlugins", { organizationId: orgId })
      .then((res) => setData(res))
      .catch((e) => setErr(e.response?.data?.error || e.message));
  }, [orgId]);

  const defName = (id) => (data?.definitions || []).find((d) => d.id === id)?.name || id;
  const verLabel = (id) => {
    const v = (data?.versions || []).find((x) => x.id === id);
    return v ? v.version : "—";
  };

  const rows = data?.installations || [];

  const statusOf = (i) => {
    if (i.uninstalledAt) return "uninstalled";
    if (i.enabled) return "enabled";
    return "disabled";
  };
  const VARIANT = { enabled: "default", disabled: "secondary", uninstalled: "outline" };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("plugin.installed")}
        description={t("plugin.installed_desc")}
        actions={
          <div className="w-64">
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder={t("plugin.field.organizationId")} /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name || o.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {!orgId ? (
            <p className="text-sm text-muted-foreground">{t("plugin.field.organizationId")}</p>
          ) : data === null ? (
            <p className="text-sm text-muted-foreground">{t("plugin.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("plugin.empty_installed")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("plugin.field.pluginId")}</TableHead>
                  <TableHead>{t("plugin.field.version")}</TableHead>
                  <TableHead>{t("plugin.field.installedAt")}</TableHead>
                  <TableHead>{t("plugin.field.enabled")}</TableHead>
                  <TableHead className="text-right">{t("plugin.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{defName(i.pluginId)}</TableCell>
                    <TableCell><Badge variant="secondary">{verLabel(i.pluginVersionId)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{i.installedAt ? new Date(i.installedAt).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={VARIANT[statusOf(i)]}>{t(`plugin.status_${statusOf(i)}`)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/plugins/installed/${i.id}`} aria-label={t("plugin.view_detail")}>
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