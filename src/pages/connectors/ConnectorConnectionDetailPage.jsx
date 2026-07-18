import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Power, PowerOff, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ModuleHeader from "@/components/shared/ModuleHeader";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

const STATUS_VARIANT = { configured: "secondary", active: "default", disabled: "outline", disconnected: "outline", error: "destructive" };

export default function ConnectorConnectionDetailPage() {
  const { connectionId } = useParams();
  const { user } = useAuth();
  const canConnect = hasCapability(user?.role, "platform.connectors.connect");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("getConnectorConnection", { connectionId });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [connectionId]);

  const act = async (fn, label) => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const res = await callFn(fn, { connectionId });
      setMsg(`${label}: ${res.status}`);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (data === null && !err) {
    return <p className="text-sm text-muted-foreground">{t("connector.loading")}</p>;
  }
  if (err && !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/connectors/connections"><ArrowLeft className="w-4 h-4 mr-2" />{t("connector.back")}</Link></Button>
        <p className="text-sm text-destructive">{err}</p>
      </div>
    );
  }

  const { definition, provider, connection } = data;
  const status = connection.status;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={connection?.name || t("connector.connection_detail")}
        description={t("connector.connection_detail")}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/connectors/connections"><ArrowLeft className="w-4 h-4 mr-2" />{t("connector.back")}</Link>
          </Button>
        }
      />

      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{t("connector.connection")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{t("connector.field.connectionName")}</p><p className="font-medium">{connection.name}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.definition")}</p><p>{definition?.name || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.provider")}</p><p>{provider?.name || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.organizationId")}</p><p className="font-mono text-xs">{connection.organizationId}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.status")}</p>
            <Badge variant={STATUS_VARIANT[status]}>{t(`connector.status_${status}`)}</Badge>
          </div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.enabled")}</p>
            <Badge variant={connection.enabled ? "default" : "secondary"}>{connection.enabled ? t("connector.yes") : t("connector.no")}</Badge>
          </div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.credentialRef")}</p>
            {connection.hasCredential ? (
              <Badge variant="secondary">{t("connector.credential_stored")}</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">{t("connector.no_credential")}</span>
            )}
          </div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.enabledAt")}</p><p>{connection.enabledAt ? new Date(connection.enabledAt).toLocaleString() : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.disabledAt")}</p><p>{connection.disabledAt ? new Date(connection.disabledAt).toLocaleString() : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.disconnectedAt")}</p><p>{connection.disconnectedAt ? new Date(connection.disconnectedAt).toLocaleString() : "—"}</p></div>
        </CardContent>
      </Card>

      {canConnect && (
        <Card>
          <CardHeader><CardTitle>{t("connector.manage")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("connector.administrative_note")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" className="gap-2" disabled={busy || status === "active" || status === "disconnected"} onClick={() => act("activateConnectorConnection", t("connector.activate"))}>
                <Power className="w-4 h-4" />{t("connector.activate")}
              </Button>
              <Button variant="outline" className="gap-2" disabled={busy || status === "disabled" || status === "disconnected"} onClick={() => act("disableConnectorConnection", t("connector.disable"))}>
                <PowerOff className="w-4 h-4" />{t("connector.disable")}
              </Button>
              <Button variant="destructive" className="gap-2" disabled={busy || status === "disconnected"} onClick={() => { if (window.confirm(t("connector.confirm_disconnect"))) act("disconnectConnectorConnection", t("connector.disconnect")); }}>
                <PlugZap className="w-4 h-4" />{t("connector.disconnect")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}