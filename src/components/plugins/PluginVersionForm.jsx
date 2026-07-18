import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const SAMPLE = JSON.stringify(
  {
    pluginKey: "",
    version: "",
    displayName: "",
    description: "",
    capabilities: [],
    requiredPermissions: [],
    providedEvents: [],
    subscribedEvents: [],
    configurationSchema: {},
    dependencies: [],
    minimumCoreVersion: "",
    maximumCoreVersion: "",
  },
  null,
  2
);

export default function PluginVersionForm({ pluginId, pluginKey, onSave, onCancel }) {
  const [version, setVersion] = useState("");
  const [coreCompatibility, setCoreCompatibility] = useState("");
  const [checksum, setChecksum] = useState("");
  const [manifestText, setManifestText] = useState(
    SAMPLE.replace('"pluginKey": ""', `"pluginKey": "${pluginKey || ""}"`)
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch (pe) {
      setErr("manifest: " + pe.message);
      setBusy(false);
      return;
    }
    try {
      await callFn("registerPluginVersion", {
        pluginId,
        version,
        coreCompatibility,
        checksum,
        manifest,
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="vver">{t("plugin.field.version")}</Label>
          <Input id="vver" value={version} onChange={(e) => setVersion(e.target.value)} required placeholder="1.0.0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vcompat">{t("plugin.field.coreCompatibility")}</Label>
          <Input id="vcompat" value={coreCompatibility} onChange={(e) => setCoreCompatibility(e.target.value)} placeholder=">=1.0.0 <2.0.0" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vsum">{t("plugin.field.checksum")}</Label>
        <Input id="vsum" value={checksum} onChange={(e) => setChecksum(e.target.value)} placeholder="sha256:…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vman">{t("plugin.field.manifest")}</Label>
        <Textarea id="vman" rows={14} className="font-mono text-xs" value={manifestText} onChange={(e) => setManifestText(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
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