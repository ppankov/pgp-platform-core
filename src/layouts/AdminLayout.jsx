import React, { useState, useRef, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const mainContentRef = useRef(null);
  const prevOpenRef = useRef(false);

  // Escape closes the drawer
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  // Focus management: move focus into drawer on open, restore to menu button on close
  useEffect(() => {
    if (sidebarOpen) {
      // Move focus to first interactive element in the drawer
      const drawer = drawerRef.current;
      if (drawer) {
        const firstFocusable = drawer.querySelector("a, button");
        if (firstFocusable) firstFocusable.focus();
      }
    } else if (prevOpenRef.current) {
      // Drawer was open and is now closed — restore focus to menu button
      menuButtonRef.current?.focus();
    }
    prevOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  // Inert: block keyboard interaction with background content while drawer is open.
  // Ref-based DOM manipulation (not JSX attribute) to guarantee rendering under React 18.
  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    if (sidebarOpen) {
      el.setAttribute("inert", "");
    } else {
      el.removeAttribute("inert");
    }
    return () => {
      el.removeAttribute("inert");
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative z-10"
          >
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        ref={mainContentRef}
        className="flex-1 flex flex-col min-w-0"
      >
        <Topbar
          menuButtonRef={menuButtonRef}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}