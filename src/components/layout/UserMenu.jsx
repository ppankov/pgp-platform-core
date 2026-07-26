import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthContextFacade";
import { t } from "@/lib/i18n";
import { SUPPORTED_LANGUAGES, getLang, setLang } from "@/lib/i18n";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = user?.role || "user";
  const initials = (user?.full_name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="relative shrink-0">
      <button
        className="flex items-center gap-2 hover:bg-accent rounded-md p-1 transition-colors"
        aria-label={`Account menu — ${user?.full_name || user?.email || "User"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 rounded-md border border-border bg-popover shadow-md z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.full_name || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{t(`role.${role}`)}</p>
          </div>

          {/* Language switcher */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Language
            </p>
            <div className="flex flex-wrap gap-1">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    getLang() === lang.code
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                  onClick={() => setLang(lang.code)}
                >
                  {t(lang.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
            onClick={() => { setOpen(false); navigate("/documentation"); }}
          >
            <UserIcon className="w-4 h-4" />
            {t("nav.documentation")}
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            {t("common.logout")}
          </button>
        </div>
      )}
    </div>
  );
}