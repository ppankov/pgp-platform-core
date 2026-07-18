import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function PluginDefinitionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    key: "",
    name: "",
    description: "",
    vendor: "",
    category: "",
    active: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await callFn("registerPluginDefinition", form);
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
        <Label htmlFor="pkey">{t("plugin.field.key")}</Label>
        <Input id="pkey" value={form.key} onChange={(e) => set("key", e.target.value)} required placeholder="e.g. com.example.myplugin" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pname">{t("plugin.field.name")}</Label>
        <Input id="pname" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pdesc">{t("plugin.field.description")}</Label>
        <Input id="pdesc" value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pvendor">{t("plugin.field.vendor")}</Label>
          <Input id="pvendor" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pcat">{t("plugin.field.category")}</Label>
          <Input id="pcat" value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label htmlFor="pactive">{t("plugin.field.active")}</Label>
        <Switch id="pactive" checked={form.active} onCheckedChange={(v) => set("active", v)} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("plugin.cancel")}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? t("plugin.save") + "…" : t("plugin.save")}
        </Button>
      </div>
    </form>
  );
}