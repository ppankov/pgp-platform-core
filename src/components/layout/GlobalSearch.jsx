import React, { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ALL_ROUTES, isRoleAllowed } from "@/lib/navigation";
import { getEffectivePlatformRole } from "@/lib/access-control";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();
  const role = getEffectivePlatformRole(user);
  const navigate = useNavigate();

  const results = query
    ? ALL_ROUTES.filter(
        (r) =>
          isRoleAllowed(r.roles, role) &&
          t(r.labelKey).toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t("common.search")}
          aria-label="Search navigation"
          className="pl-8 h-9"
        />
      </div>
      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md z-50 py-1 max-h-72 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.key}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent text-foreground flex items-center justify-between"
              onMouseDown={() => {
                navigate(r.path);
                setQuery("");
              }}
            >
              <span>{t(r.labelKey)}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{r.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}