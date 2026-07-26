import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import PluginVersionForm from "@/components/plugins/PluginVersionForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

const STATUS_VARIANT = { draft: "secondary", released: "default", deprecated: "outline" };

export default function PluginDetailPage() {
  const { pluginId } = useParams();
  const { user } = useAuth();
  const role = user?.role;
  const canManage = hasCapability(role, "platform.plugins.manage");
  const canRelease = hasCapability(role, "platform.plugins.release");
  const canInstall = hasCapability(role, "platform.plugins.install");

  const [definition, setDefinition] = useState(null);
  const [versions, setVersions] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [installVer, setInstallVer] = useState("");
  const [installOrg, setInstallOrg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listPlugins", {});
      const def = (res.definitions || []).find((d) => d.id === pluginId);
      setDefinition(def || null);
      setVersions((res.versions || []).filter((v) => v.pluginId === pluginId));
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [pluginId]);

  useEffect(() => {
    if (canInstall) {
      callFn("getOrganizations", {})
        .then((r) => setOrgs(r?.organizations || []))
        .catch(() => setOrgs([]));
    }
  }, [canInstall]);

  const released = versions.filter((v) => v.releaseStatus === "released");
  const drafts = versions.filter((v) => v.releaseStatus === "draft");

  const doRelease = async (vid) => {
    setErr(""); setMsg("");
    try {
      await callFn("releasePluginVersion", { versionId: vid });
      setMsg(t("plugin.released"));
      load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };

  const doInstall = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await callFn("installPlugin", {
        pluginId,
        pluginVersionId: installVer,
        organizationId: installOrg,
      });
      const inst = res.installation || res;
      setMsg(t("plugin.status_installed") + ": " + (inst.id || ""));
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (definition === null && !err) {
    return <p className="text-sm text-muted-foreground">{t("plugin.loading")}</p>;
  }
  if (!definition && err) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/plugins"><ArrowLeft className="w-4 h-4 mr-2" />{t("plugin.back")}</Link></Button>
        <p className="text-sm text-destructive">{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={definition.name}
        description={definition.description || t("plugin.detail")}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/plugins"><ArrowLeft className="w-4 h-4 mr-2" />{t("plugin.back")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("plugin.detail")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.key")}</p><p className="font-mono text-xs">{definition.key}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.vendor")}</p><p>{definition.vendor || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.category")}</p><p>{definition.category || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("plugin.field.active")}</p>
            <Badge variant={definition.active ? "default" : "secondary"}>{definition.active ? t("plugin.status_available") : t("plugin.status_disabled")}</Badge>
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("plugin.versions")}</CardTitle>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />{t("plugin.register_version")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("plugin.no_versions")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("plugin.field.version")}</TableHead>
                  <TableHead>{t("plugin.field.releaseStatus")}</TableHead>
                  <TableHead>{t("plugin.field.coreCompatibility")}</TableHead>
                  <TableHead>{t("plugin.field.releasedAt")}</TableHead>
                  {(canRelease || canInstall) && <TableHead className="text-right">{t("plugin.manage") || t("plugin.view")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.version}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[v.releaseStatus]}>{t(`plugin.${v.releaseStatus}`)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.coreCompatibility || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.releasedAt ? new Date(v.releasedAt).toLocaleString() : "—"}</TableCell>
                    {(canRelease || canInstall) && (
                      <TableCell className="text-right">
                        {v.releaseStatus === "draft" && canRelease && (
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => doRelease(v.id)}>
                            <Rocket className="w-3.5 h-3.5" />{t("plugin.release")}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canInstall && (
        <Card>
          <CardHeader><CardTitle>{t("plugin.install")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {released.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("plugin.install_prompt")}</p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("plugin.field.version")}</label>
                  <Select value={installVer} onValueChange={setInstallVer}>
                    <SelectTrigger className="w-40"><SelectValue placeholder={t("plugin.field.version")} /></SelectTrigger>
                    <SelectContent>
                      {released.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("plugin.field.organizationId")}</label>
                  <Select value={installOrg} onValueChange={setInstallOrg}>
                    <SelectTrigger className="w-56"><SelectValue placeholder={t("plugin.field.organizationId")} /></SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name || o.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={doInstall} disabled={!installVer || !installOrg || busy}>
                  {busy ? t("plugin.install") + "…" : t("plugin.install")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("plugin.new_version")}</DialogTitle></DialogHeader>
          {open && (
            <PluginVersionForm
              pluginId={pluginId}
              pluginKey={definition.key}
              onSave={() => { setOpen(false); load(); }}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}