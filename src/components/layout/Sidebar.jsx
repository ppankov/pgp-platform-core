import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS, isRoleAllowed } from "@/lib/navigation";
import { getEffectivePlatformRole } from "@/lib/access-control";
import { t } from "@/lib/i18n";
import { useAuth } from "@/auth/AuthContextFacade";

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const role = getEffectivePlatformRole(user);
  const [expanded, setExpanded] = useState({});

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const itemsByGroup = (groupKey) =>
    NAV_ITEMS.filter((i) => i.group === groupKey && isRoleAllowed(i.roles, role));

  return (
    <aside className="w-64 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">P</span>
          </div>
          <div>
            <p className="font-heading font-bold text-sm text-sidebar-foreground">PGP Core</p>
            <p className="text-[10px] text-muted-foreground">Platform Foundation</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_GROUPS.map((group) => {
          const items = itemsByGroup(group.key);
          if (items.length === 0) return null;
          return (
            <div key={group.key} className="mb-6">
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isVisible = isRoleAllowed(item.roles, role);
                  if (!isVisible) return null;
                  const isOpen = expanded[item.key];

                  if (hasChildren) {
                    const visibleChildren = item.children.filter((c) =>
                      isRoleAllowed(c.roles, role)
                    );
                    if (visibleChildren.length === 0) return null;
                    return (
                      <div key={item.key}>
                        <button
                          onClick={() => toggle(item.key)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 shrink-0" />
                          )}
                          <span>{t(item.labelKey)}</span>
                        </button>
                        {isOpen && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                            {visibleChildren.map((child) => (
                              <NavLink
                                key={child.key}
                                to={child.path}
                                onClick={onNavigate}
                                className={({ isActive }) =>
                                  `block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                    isActive
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                  }`
                                }
                              >
                                {t(child.labelKey)}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      onClick={onNavigate}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        }`
                      }
                    >
                      <span className="w-4 shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer version */}
      <div className="px-6 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground">PGP Core v1.0.0 — Phase 1</p>
      </div>
    </aside>
  );
}