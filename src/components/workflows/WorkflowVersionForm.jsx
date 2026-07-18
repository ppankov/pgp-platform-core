import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const DEFAULT_GRAPH = JSON.stringify({
  nodes: [
    { key: "start", type: "start", title: "Start", description: "", configuration: {} },
    { key: "review", type: "manual", title: "Review", description: "", configuration: {} },
    { key: "end", type: "end", title: "End", description: "", configuration: {} },
  ],
  edges: [
    { from: "start", to: "review", label: "" },
    { from: "review", to: "end", label: "" },
  ],
}, null, 2);

export default function WorkflowVersionForm({ definitionId, onSave, onCancel }) {
  const { toast } = useToast();
  const [version, setVersion] = useState("1.0.0");
  const [checksum, setChecksum] = useState("");
  const [graphText, setGraphText] = useState(DEFAULT_GRAPH);
  const [parseErr, setParseErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!version.trim()) return;
    let graph;
    try {
      graph = JSON.parse(graphText);
      setParseErr("");
    } catch (e) {
      setParseErr(e.message);
      return;
    }
    setSaving(true);
    try {
      await callFn("registerWorkflowVersion", {
        workflowDefinitionId: definitionId, version: version.trim(),
        checksum: checksum.trim(), graph,
      });
      toast({ title: t("workflow.saved") });
      onSave?.();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("workflow.field.version")}</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
        </div>
        <div className="space-y-2">
          <Label>{t("workflow.field.checksum")}</Label>
          <Input value={checksum} onChange={(e) => setChecksum(e.target.value)} placeholder="optional" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("workflow.field.graph")}</Label>
        <Textarea
          value={graphText}
          onChange={(e) => setGraphText(e.target.value)}
          rows={16}
          className="font-mono text-xs"
          spellCheck={false}
        />
        {parseErr && <p className="text-xs text-destructive">{parseErr}</p>}
        <p className="text-xs text-muted-foreground">{t("workflow.graph_help")}</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>{t("workflow.cancel")}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? t("workflow.saving") : t("workflow.save")}</Button>
      </div>
    </div>
  );
}