import React, { useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Phase 1: static placeholder — org switching backend is Phase 2.
export default function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("Default Organization");

  return (
    <div className="relative shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 font-normal"
        aria-label="Switch organization"
        onClick={() => setOpen((o) => !o)}
      >
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="hidden sm:inline max-w-[140px] truncate">{selected}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </Button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-md border border-border bg-popover shadow-md z-50 py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-foreground"
            onClick={() => { setSelected("Default Organization"); setOpen(false); }}
          >
            Default Organization
          </button>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border mt-1">
            Phase 1 — single org context
          </div>
        </div>
      )}
    </div>
  );
}