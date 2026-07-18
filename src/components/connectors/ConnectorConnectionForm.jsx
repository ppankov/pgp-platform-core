import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { callFn } from "@/lib/function-call";
import { base44 } from "@/api/base44Client";
import { t } from "@/lib/i18n";

export default function ConnectorConnectionForm({ onSave, onCancel }) {
  const [catalog, setCatalog] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({
    connectorDefinitionId: "", connectorProviderId: "",
    organizationId: "", name: "", configuration: "{}", credentialRef: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    callFn("listConnectors", {}).then(setCatalog).catch(() => setCatalog({ definitions: [], providers: [] }));
    callFn("getOrganizations", {}).then((r) => setOrgs(r?.organizations || [])).catch(() => setOrgs([]));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const providers = (catalog?.providers || []).filter((p) => p.connectorDefinitionId === form.connectorDefinitionId);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    let configuration;
    try {
      configuration = JSON.parse(form.configuration);
    } catch (pe) {
      setErr("configuration: " + pe.message);
      setBusy(false);
      return;
    }
    try {
      await callFn("createConnectorConnection", { ...form, configuration });
      onSave?.();
    } catch (e2) {
      setErr(e2.response?.data?.error || e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ccdef">{t("connector.field.definition")}</Label>
        <Select value={form.connectorDefinitionId} onValueChange={(v) => { set("connectorDefinitionId", v); set("connectorProviderId", ""); }}>
          <SelectTrigger id="ccdef"><SelectValue placeholder={t("connector.field.definition")} /></SelectTrigger>
          <SelectContent>
            {(catalog?.definitions || []).filter((d) => d.active).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccprov">{t("connector.field.provider")}</Label>
        <Select value={form.connectorProviderId} onValueChange={(v) => set("connectorProviderId", v)} disabled={!form.connectorDefinitionId}>
          <SelectTrigger id="ccprov"><SelectValue placeholder={t("connector.field.provider")} /></SelectTrigger>
          <SelectContent>
            {providers.filter((p) => p.active).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccorg">{t("connector.field.organizationId")}</Label>
        <Select value={form.organizationId} onValueChange={(v) => set("organizationId", v)}>
          <SelectTrigger id="ccorg"><SelectValue placeholder={t("connector.field.organizationId")} /></SelectTrigger>
          <SelectContent>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name || o.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccname">{t("connector.field.connectionName")}</Label>
        <Input id="ccname" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccconfig">{t("connector.field.configuration")}</Label>
        <Textarea id="ccconfig" rows={6} className="font-mono text-xs" value={form.configuration} onChange={(e) => set("configuration", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ccref">{t("connector.field.credentialRef")}</Label>
        <Input id="ccref" value={form.credentialRef} onChange={(e) => set("credentialRef", e.target.value)} placeholder="secret:connector:..." />
      </div>
      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>{t("connector.cancel")}</Button>
        <Button type="submit" disabled={busy}>{busy ? t("connector.save") + "…" : t("connector.save")}</Button>
      </div>
    </form>
  );
}