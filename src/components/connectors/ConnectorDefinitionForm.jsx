import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function ConnectorDefinitionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    key: "", name: "", description: "", category: "",
    capabilities: "", active: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const capabilities = form.capabilities.split(",").map((s) => s.trim()).filter(Boolean);
      await callFn("registerConnectorDefinition", { ...form, capabilities });
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
        <Label htmlFor="cdkey">{t("connector.field.key")}</Label>
        <Input id="cdkey" value={form.key} onChange={(e) => set("key", e.target.value)} required placeholder="e.g. repository" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cdname">{t("connector.field.name")}</Label>
        <Input id="cdname" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cddesc">{t("connector.field.description")}</Label>
        <Input id="cddesc" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cdcat">{t("connector.field.category")}</Label>
        <Input id="cdcat" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="repository, files, messages" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cdcap">{t("connector.field.capabilities")}</Label>
        <Input id="cdcap" value={form.capabilities} onChange={(e) => set("capabilities", e.target.value)} placeholder="repository.read, repository.write" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="cdactive">{t("connector.field.active")}</Label>
        <Switch id="cdactive" checked={form.active} onCheckedChange={(v) => set("active", v)} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>{t("connector.cancel")}</Button>
        <Button type="submit" disabled={busy}>{busy ? t("connector.save") + "…" : t("connector.save")}</Button>
      </div>
    </form>
  );
}