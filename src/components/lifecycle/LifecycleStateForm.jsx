import React, { useState } from "react";
import { callFn } from "@/lib/function-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

export default function LifecycleStateForm({ lifecycleId, initial, onSave, onCancel }) {
  const [key, setKey] = useState(initial?.key || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || "");
  const [icon, setIcon] = useState(initial?.icon || "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isInitial, setIsInitial] = useState(initial?.isInitial ?? false);
  const [isFinal, setIsFinal] = useState(initial?.isFinal ?? false);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      lifecycleId,
      key,
      title,
      description,
      color,
      icon,
      order: Number(order),
      isInitial,
      isFinal,
    };
    await callFn("saveLifecycleState", { id: initial?.id, ...payload });
    setSaving(false);
    onSave();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ls-key">{t("lifecycle.field.key")}</Label>
          <Input id="ls-key" value={key} onChange={(e) => setKey(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ls-title">{t("lifecycle.field.title")}</Label>
          <Input id="ls-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ls-desc">{t("lifecycle.field.description")}</Label>
        <Textarea id="ls-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ls-color">{t("lifecycle.field.color")}</Label>
          <Input id="ls-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ls-icon">{t("lifecycle.field.icon")}</Label>
          <Input id="ls-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Circle" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ls-order">{t("lifecycle.field.order")}</Label>
          <Input id="ls-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="ls-initial">{t("lifecycle.field.is_initial")}</Label>
        <Switch id="ls-initial" checked={isInitial} onCheckedChange={setIsInitial} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="ls-final">{t("lifecycle.field.is_final")}</Label>
        <Switch id="ls-final" checked={isFinal} onCheckedChange={setIsFinal} />
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