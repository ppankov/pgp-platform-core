import React, { useState } from "react";
import { callFn } from "@/lib/function-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

export default function LifecycleDefinitionForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [targetType, setTargetType] = useState(initial?.targetType || "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { name, description, targetType, active };
    await callFn("saveLifecycleDefinition", { id: initial?.id, name, description, targetType, active });
    setSaving(false);
    onSave();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="lc-name">{t("lifecycle.field.name")}</Label>
        <Input id="lc-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lc-target">{t("lifecycle.field.target_type")}</Label>
        <Input
          id="lc-target"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          required
          placeholder={t("lifecycle.target_type_hint")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lc-desc">{t("lifecycle.field.description")}</Label>
        <Textarea id="lc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="lc-active">{t("lifecycle.field.active")}</Label>
        <Switch id="lc-active" checked={active} onCheckedChange={setActive} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("lifecycle.cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {t("lifecycle.save")}
        </Button>
      </div>
    </form>
  );
}