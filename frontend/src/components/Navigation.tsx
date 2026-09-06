import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useHealth } from "@/hooks/useHealth";
import { cn } from "@/lib/utils";

import { buttonVariants } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LinkSimpleIcon,
  PlusIcon,
  ListIcon,
  XIcon,
  PulseIcon,
  DatabaseIcon,
  HardDrivesIcon,
} from "@phosphor-icons/react";

export default function Navigation() {
  const { data: health, isLoading } = useHealth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [healthDetailsOpen, setHealthDetailsOpen] = useState(false);

  const getStatusColor = () => {
    if (isLoading) return "bg-amber-400";
    if (health?.status === "ok") return "bg-emerald-500";
    return "bg-destructive";
  };

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Shorten URL", path: "/shorten" },
    { label: "All URLs", path: "/urls" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90 transition-opacity"
          >
            <div className="size-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-sm">
              <LinkSimpleIcon className="size-4.5" weight="bold" />
            </div>
            <span className="text-lg">SnapLink</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                  isActive(link.path)
                    ? "bg-primary/10 text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Health Status Indicator */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setHealthDetailsOpen((prev) => !prev)}
              aria-label="Toggle system health details"
              className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border text-xs font-medium transition-colors cursor-pointer"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  getStatusColor(),
                )}
              />
              <span className="hidden sm:inline text-muted-foreground text-[11px]">
                {isLoading
                  ? "Checking..."
                  : health?.status === "ok"
                    ? "Healthy"
                    : "Degraded"}
              </span>
            </button>

            {/* Health Status Popup / Tooltip */}
            {healthDetailsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 p-3 bg-popover text-popover-foreground border shadow-lg rounded-2xl z-50 text-xs space-y-2 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setHealthDetailsOpen(false)}
              >
                <div className="font-semibold pb-1 border-b flex items-center justify-between">
                  <span>System Diagnostics</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                      health?.status === "ok"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {health?.status || "Unknown"}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HardDrivesIcon className="size-3.5" /> Redis:
                    </span>
                    <span
                      className={
                        health?.redis === "connected"
                          ? "text-emerald-500 font-medium"
                          : "text-destructive font-medium"
                      }
                    >
                      {health?.redis || "disconnected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DatabaseIcon className="size-3.5" /> MongoDB:
                    </span>
                    <span
                      className={
                        health?.mongodb === "connected"
                          ? "text-emerald-500 font-medium"
                          : "text-destructive font-medium"
                      }
                    >
                      {health?.mongodb || "disconnected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <PulseIcon className="size-3.5" /> Queue Depth:
                    </span>
                    <span className="font-mono text-foreground font-medium">
                      {health?.queueDepth ?? 0} jobs
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Shorten CTA */}
          <Link
            to="/shorten"
            className={cn(
              buttonVariants({ variant: "default", size: "xs" }),
              "hidden sm:inline-flex items-center gap-1.5 rounded-full",
            )}
          >
            <PlusIcon className="size-3.5" weight="bold" />
            <span>Shorten</span>
          </Link>

          <ThemeToggle />

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground"
          >
            {mobileMenuOpen ? (
              <XIcon className="size-5" />
            ) : (
              <ListIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background px-4 py-3 space-y-2 animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "block px-3 py-2 text-sm font-medium rounded-xl transition-colors",
                isActive(link.path)
                  ? "bg-primary/10 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t flex flex-col gap-2">
            <Link
              to="/shorten"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "w-full justify-center",
              )}
            >
              <PlusIcon className="size-4 mr-1" weight="bold" />
              Shorten New URL
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
