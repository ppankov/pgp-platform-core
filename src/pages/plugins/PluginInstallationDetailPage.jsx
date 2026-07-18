import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function PluginInstallationDetailPage() {
  const { installationId } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const canInstall = hasCapability(role, "platform.plugins.install");

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("getPluginInstallation", { installationId });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [installationId]);

  const act = async (fn, label) => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await callFn(fn, { installationId });
      setMsg(`${label}: ${res.status}`);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (data === null && !err) {
    return <p className="text-sm text-muted-foreground">{t("plugin.loading")}</p>;
  }
  if (err && !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/plugins/installed"><ArrowLeft className="w-4 h-4 mr-2" />{t("plugin.back")}</Link></Button>
        <p className="text-sm text-destructive">{err}</p>
      </div>
    );
  }

  const { definition, version, installation } = data;
  const status = installation.uninstalledAt ? "uninstalled" : installation.enabled ? "enabled" : "disabled";
  const VARIANT = { enabled: "default", disabled: "secondary", uninstalled: "outline" };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={definition?.name || t("plugin.installation_detail")}
        description={t("plugin.installation_detail")}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plugins/installed"><ArrowLeft className="w-4 h-4 mr-2" />{t("plugin.back")}</Link>
          </Button>
        }
      />

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{t("plugin.installation")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.pluginId")}</p><p>{definition?.name || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.version")}</p><p className="font-mono text-xs">{version?.version || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.organizationId")}</p><p className="font-mono text-xs">{installation.organizationId}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.enabled")}</p>
            <Badge variant={VARIANT[status]}>{t(`plugin.status_${status}`)}</Badge>
          </div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.installedAt")}</p><p>{installation.installedAt ? new Date(installation.installedAt).toLocaleString() : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.disabledAt")}</p><p>{installation.disabledAt ? new Date(installation.disabledAt).toLocaleString() : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.uninstalledAt")}</p><p>{installation.uninstalledAt ? new Date(installation.uninstalledAt).toLocaleString() : "—"}</p></div>
        </CardContent>
      </Card>

      {canInstall && (
        <Card>
          <CardHeader><CardTitle>{t("plugin.manage") || t("plugin.view")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="default" className="gap-2" disabled={busy || status === "enabled" || status === "uninstalled"} onClick={() => act("enablePlugin", t("plugin.enable"))}>
              <Power className="w-4 h-4" />{t("plugin.enable")}
            </Button>
            <Button variant="outline" className="gap-2" disabled={busy || status === "disabled" || status === "uninstalled"} onClick={() => act("disablePlugin", t("plugin.disable"))}>
              <PowerOff className="w-4 h-4" />{t("plugin.disable")}
            </Button>
            <Button variant="destructive" className="gap-2" disabled={busy || status === "uninstalled"} onClick={() => {
              if (window.confirm(t("plugin.confirm_uninstall"))) act("uninstallPlugin", t("plugin.uninstall"));
            }}>
              <Trash2 className="w-4 h-4" />{t("plugin.uninstall")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}