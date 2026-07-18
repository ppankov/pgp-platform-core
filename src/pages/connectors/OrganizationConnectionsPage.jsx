import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import ConnectorConnectionForm from "@/components/connectors/ConnectorConnectionForm";
import { callFn } from "@/lib/function-call";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

const STATUS_VARIANT = { configured: "secondary", active: "default", disabled: "outline", disconnected: "outline", error: "destructive" };

export default function OrganizationConnectionsPage() {
  const { user } = useAuth();
  const canConnect = hasCapability(user?.role, "platform.connectors.connect");
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
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
    callFn("listConnectors", { organizationId: orgId }).then(setData).catch((e) => setErr(e.response?.data?.error || e.message));
  }, [orgId]);

  const defName = (id) => (data?.definitions || []).find((d) => d.id === id)?.name || id;
  const provName = (id) => (data?.providers || []).find((p) => p.id === id)?.name || id;
  const rows = data?.connections || [];

  const reload = () => {
    if (!orgId) return;
    callFn("listConnectors", { organizationId: orgId }).then(setData);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("connector.organization_connections")}
        description={t("connector.organization_connections_desc")}
        actions={
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder={t("connector.field.organizationId")} /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name || o.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canConnect && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)} disabled={!orgId}>
                <Plus className="w-4 h-4" />{t("connector.create_connection")}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {!orgId ? (
            <p className="text-sm text-muted-foreground">{t("connector.field.organizationId")}</p>
          ) : data === null ? (
            <p className="text-sm text-muted-foreground">{t("connector.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("connector.empty_connections")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("connector.field.connectionName")}</TableHead>
                  <TableHead>{t("connector.field.definition")}</TableHead>
                  <TableHead>{t("connector.field.provider")}</TableHead>
                  <TableHead>{t("connector.field.status")}</TableHead>
                  <TableHead>{t("connector.field.enabled")}</TableHead>
                  <TableHead className="text-right">{t("connector.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{defName(c.connectorDefinitionId)}</TableCell>
                    <TableCell>{provName(c.connectorProviderId)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{t(`connector.status_${c.status}`)}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? t("connector.yes") : t("connector.no")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/connectors/connections/${c.id}`} aria-label={t("connector.view_detail")}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("connector.new_connection")}</DialogTitle></DialogHeader>
          {open && <ConnectorConnectionForm onSave={() => { setOpen(false); reload(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}