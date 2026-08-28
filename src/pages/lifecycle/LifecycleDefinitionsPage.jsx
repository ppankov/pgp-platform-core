import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, ArrowRight } from "lucide-react";
import { backend } from "@/services/backendAdapter";
import { callFn } from "@/lib/function-call";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import LifecycleDefinitionForm from "@/components/lifecycle/LifecycleDefinitionForm";
import { t } from "@/lib/i18n";

export default function LifecycleDefinitionsPage() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const list = await backend.catalog.list("LifecycleDefinition");
    setItems(list);
  };
  useEffect(() => {
    load();
  }, []);

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (item) => { setEditing(item); setOpen(true); };
  const handleSaved = () => { setOpen(false); load(); };
  const handleDelete = async (item) => {
    if (!window.confirm(t("lifecycle.confirm_delete"))) return;
    await callFn("deleteLifecycleDefinition", { id: item.id });
    load();
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title={t("lifecycle.definitions")}
        description={t("lifecycle.subtitle")}
        actions={
          <Button onClick={handleNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            {t("lifecycle.new")}
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {items === null ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("lifecycle.field.name")}</TableHead>
                  <TableHead>{t("lifecycle.field.target_type")}</TableHead>
                  <TableHead>{t("lifecycle.field.active")}</TableHead>
                  <TableHead className="text-right">{t("lifecycle.manage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{it.targetType}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={it.active ? "default" : "secondary"}>
                        {it.active ? t("lifecycle.field.active") : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(it)} aria-label={t("lifecycle.edit")}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/lifecycle/states?lifecycle=${it.id}`} aria-label={t("lifecycle.states")}>
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/lifecycle/viewer?lifecycle=${it.id}`} aria-label={t("lifecycle.open_viewer")}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(it)} aria-label={t("lifecycle.delete")}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("lifecycle.edit") : t("lifecycle.new")} — {t("lifecycle.definitions")}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <LifecycleDefinitionForm
              initial={editing}
              onSave={handleSaved}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}