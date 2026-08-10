"use client";

import { useState, useEffect } from "react";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "./sidebar";
import { BrandLockup } from "./brand";
import { OrbitField } from "@/components/visual/orbit-field";

const KEY = "yaas.sidebar.collapsed";

export function AppShell({
  orgName,
  canApprove,
  pendingCount,
  topbar,
  children,
}: {
  orgName: string;
  canApprove: boolean;
  pendingCount: number;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(KEY) === "1");
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      <div className="aurora-bg aurora-bg--subtle" aria-hidden />

      <div className="relative z-10 flex h-screen overflow-hidden">
        {ready && !collapsed && (
          <Sidebar
            canApprove={canApprove}
            pendingCount={pendingCount}
            onToggle={toggle}
          />
        )}

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="orbit-layer" aria-hidden>
            <OrbitField variant="backdrop" />
          </div>

          <div className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
            {ready && collapsed && (
              <>
                <button
                  type="button"
                  onClick={toggle}
                  title="Expand sidebar"
                  className="icon-btn shrink-0"
                >
                  <PanelLeft size={15} />
                </button>
                <BrandLockup size={30} subtitle={null} className="shrink-0" />
              </>
            )}
            {topbar}
          </div>

          <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto">
            {/* Was max-w-4xl, which left most of a wide screen empty once the
                sidebar collapsed. Pages that want a reading measure set their
                own — settings, assistant and notifications all cap themselves —
                so the wide default only affects the board, tasks and members,
                which all want the room. */}
            <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col px-6 py-7 md:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}