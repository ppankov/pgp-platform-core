import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const AUTH_MODES = ["oauth2", "api_key", "basic", "service_account", "none"];

export default function ConnectorProviderForm({ connectorDefinitionId, onSave, onCancel }) {
  const [form, setForm] = useState({
    key: "", name: "", description: "", authModes: ["oauth2"],
    configurationSchema: "{}", credentialRequirements: "", active: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleMode = (m) => setForm((f) => ({
    ...f,
    authModes: f.authModes.includes(m) ? f.authModes.filter((x) => x !== m) : [...f.authModes, m],
  }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    let configurationSchema;
    try {
      configurationSchema = JSON.parse(form.configurationSchema);
    } catch (pe) {
      setErr("configurationSchema: " + pe.message);
      setBusy(false);
      return;
    }
    try {
      const credentialRequirements = form.credentialRequirements.split(",").map((s) => s.trim()).filter(Boolean);
      await callFn("registerConnectorProvider", {
        connectorDefinitionId, key: form.key, name: form.name, description: form.description,
        authModes: form.authModes, configurationSchema, credentialRequirements, active: form.active,
      });
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
        <Label htmlFor="cpkey">{t("connector.field.key")}</Label>
        <Input id="cpkey" value={form.key} onChange={(e) => set("key", e.target.value)} required placeholder="e.g. google" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpname">{t("connector.field.name")}</Label>
        <Input id="cpname" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpdesc">{t("connector.field.description")}</Label>
        <Input id="cpdesc" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t("connector.field.authModes")}</Label>
        <div className="flex flex-wrap gap-3">
          {AUTH_MODES.map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.authModes.includes(m)} onChange={() => toggleMode(m)} />
              <span className="font-mono text-xs">{m}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpschema">{t("connector.field.configurationSchema")}</Label>
        <Textarea id="cpschema" rows={6} className="font-mono text-xs" value={form.configurationSchema} onChange={(e) => set("configurationSchema", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cpcred">{t("connector.field.credentialRequirements")}</Label>
        <Input id="cpcred" value={form.credentialRequirements} onChange={(e) => set("credentialRequirements", e.target.value)} placeholder="oauth2_access_token" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="cpactive">{t("connector.field.active")}</Label>
        <Switch id="cpactive" checked={form.active} onCheckedChange={(v) => set("active", v)} />
      </div>
      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>{t("connector.cancel")}</Button>
        <Button type="submit" disabled={busy}>{busy ? t("connector.save") + "…" : t("connector.save")}</Button>
      </div>
    </form>
  );
}