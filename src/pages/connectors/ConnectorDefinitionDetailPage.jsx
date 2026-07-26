import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import ConnectorProviderForm from "@/components/connectors/ConnectorProviderForm";
import { callFn } from "@/lib/function-call";
import { useAuth } from "@/auth/AuthContextFacade";
import { hasCapability } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function ConnectorDefinitionDetailPage() {
  const { definitionId } = useParams();
  const { user } = useAuth();
  const canManage = hasCapability(user?.role, "platform.connectors.manage");
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await callFn("listConnectors", { definitionId });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    }
  };
  useEffect(() => { load(); }, [definitionId]);

  const definition = (data?.definitions || []).find((d) => d.id === definitionId) || null;
  const providers = (data?.providers || []).filter((p) => p.connectorDefinitionId === definitionId);

  if (data === null && !err) {
    return <p className="text-sm text-muted-foreground">{t("connector.loading")}</p>;
  }
  if (!definition && err) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/connectors"><ArrowLeft className="w-4 h-4 mr-2" />{t("connector.back")}</Link></Button>
        <p className="text-sm text-destructive">{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={definition?.name || t("connector.definition_detail")}
        description={definition?.description || ""}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/connectors"><ArrowLeft className="w-4 h-4 mr-2" />{t("connector.back")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("connector.definition_detail")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">{t("connector.field.key")}</p><p className="font-mono text-xs">{definition?.key}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.category")}</p><p>{definition?.category || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">{t("connector.field.active")}</p>
            <Badge variant={definition?.active ? "default" : "secondary"}>{definition?.active ? t("connector.status_available") : t("connector.status_disabled")}</Badge>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-muted-foreground">{t("connector.field.capabilities")}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(definition?.capabilities || []).map((c) => (
                <span key={c} className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{c}</span>
              ))}
              {!(definition?.capabilities || []).length && <span className="text-xs text-muted-foreground">—</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("connector.providers")}</CardTitle>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />{t("connector.register_provider")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("connector.no_providers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("connector.field.name")}</TableHead>
                  <TableHead>{t("connector.field.key")}</TableHead>
                  <TableHead>{t("connector.field.authModes")}</TableHead>
                  <TableHead>{t("connector.field.active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded">{p.key}</span></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(p.authModes || []).map((m) => (
                          <Badge key={m} variant="secondary">{m}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? t("connector.status_available") : t("connector.status_disabled")}</Badge>
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
          <DialogHeader><DialogTitle>{t("connector.new_provider")}</DialogTitle></DialogHeader>
          {open && (
            <ConnectorProviderForm
              connectorDefinitionId={definitionId}
              onSave={() => { setOpen(false); load(); }}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}