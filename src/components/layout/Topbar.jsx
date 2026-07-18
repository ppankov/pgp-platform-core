import React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import OrgSwitcher from "@/components/layout/OrgSwitcher";
import EnvironmentIndicator from "@/components/layout/EnvironmentIndicator";
import RoleIndicator from "@/components/layout/RoleIndicator";
import GlobalSearch from "@/components/layout/GlobalSearch";
import NotificationArea from "@/components/layout/NotificationArea";
import UserMenu from "@/components/layout/UserMenu";

export default function Topbar({ onMenuClick, menuButtonRef }) {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center gap-3 px-4 lg:px-6 shrink-0">
      {/* Mobile menu button */}
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation menu"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Org switcher */}
      <OrgSwitcher />

      {/* Environment indicator */}
      <EnvironmentIndicator />

      {/* Role indicator */}
      <RoleIndicator />

      {/* Search — grows to fill space */}
      <div className="flex-1 max-w-md ml-auto lg:ml-4">
        <GlobalSearch />
      </div>

      {/* Notifications */}
      <NotificationArea />

      {/* User menu */}
      <UserMenu />
    </header>
  );
}