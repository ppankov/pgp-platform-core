import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import ConnectorDefinitionForm from "@/components/connectors/ConnectorDefinitionForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function ConnectorCatalogPage() {
  const { user } = useAuth();
  const canManage = hasCapability(user?.role, "platform.connectors.manage");
  const canConnect = hasCapability(user?.role, "platform.connectors.connect");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listConnectors", {});
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const providerCount = (defId) => (data?.providers || []).filter((p) => p.connectorDefinitionId === defId).length;
  const rows = data?.definitions || [];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("connector.catalog")}
        description={t("connector.catalog_desc")}
        actions={
          <div className="flex gap-2">
            {canConnect && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/connectors/connections">{t("connector.organization_connections")}</Link>
              </Button>
            )}
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />{t("connector.register_definition")}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {data === null ? (
            <p className="text-sm text-muted-foreground">{t("connector.loading")}</p>
          ) : err ? (
            <p className="text-sm text-destructive">{err}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("connector.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("connector.field.name")}</TableHead>
                  <TableHead>{t("connector.field.key")}</TableHead>
                  <TableHead>{t("connector.field.category")}</TableHead>
                  <TableHead>{t("connector.field.providers")}</TableHead>
                  <TableHead>{t("connector.field.active")}</TableHead>
                  <TableHead className="text-right">{t("connector.view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{d.key}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.category || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{providerCount(d.id)}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "default" : "secondary"}>
                        {d.active ? t("connector.status_available") : t("connector.status_disabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/connectors/${d.id}`} aria-label={t("connector.view_detail")}>
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
          <DialogHeader><DialogTitle>{t("connector.new_definition")}</DialogTitle></DialogHeader>
          {open && <ConnectorDefinitionForm onSave={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}