import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useHealth } from "@/hooks/useHealth";
import { useUrls } from "@/hooks/useUrls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LightningIcon,
  ChartLineUpIcon,
  SparkleIcon,
  ArrowRightIcon,
  GithubLogoIcon,
  LinkSimpleIcon,
  HardDrivesIcon,
  DatabaseIcon,
  PulseIcon,
} from "@phosphor-icons/react";

export default function LandingView() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: urls } = useUrls();
  const [quickUrl, setQuickUrl] = useState("");
  const navigate = useNavigate();

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      navigate(`/shorten?url=${encodeURIComponent(quickUrl.trim())}`);
    } else {
      navigate("/shorten");
    }
  };

  const totalLinks = urls?.length ?? 0;
  const totalClicksAcrossLinks =
    urls?.reduce((acc, u) => acc + (u.totalClicks || 0), 0) ?? 0;

  const features = [
    {
      icon: LightningIcon,
      title: "Instant redirects",
      description:
        "Links resolve from a fast in-memory cache, so visitors reach their destination without delay.",
    },
    {
      icon: SparkleIcon,
      title: "Custom slugs & scheduling",
      description:
        "Create memorable aliases or let SnapLink generate one, and set an expiry date when a link should retire.",
    },
    {
      icon: ChartLineUpIcon,
      title: "Insightful analytics",
      description:
        "See click trends over time, top referrers, and where your audience comes from — per link.",
    },
  ];

  return (
    <div className="space-y-14 py-4">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Fast · Simple · Insightful</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-balance">
          Short links, <span className="text-primary">minus the hassle</span>
        </h1>

        <p className="text-base md:text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
          Paste a long URL, get a short link, and see how it performs — all in
          seconds.
        </p>

        {/* Quick Shorten Input Bar */}
        <div className="max-w-xl mx-auto pt-2">
          <form
            onSubmit={handleQuickSubmit}
            className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl border bg-card/80 backdrop-blur shadow-sm"
          >
            <div className="relative flex-1 w-full">
              <LinkSimpleIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="Enter destination URL (e.g., https://example.com/very-long-path)"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                className="pl-9 border-0 shadow-none focus-visible:ring-0 text-xs w-full"
              />
            </div>
            <Button
              type="submit"
              size="default"
              className="w-full sm:w-auto shrink-0 font-medium"
            >
              <span>Shorten Link</span>
              <ArrowRightIcon className="size-3.5 ml-1" />
            </Button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/shorten"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "gap-2",
            )}
          >
            <LinkSimpleIcon className="size-4" weight="bold" />
            <span>Open Shorten Studio</span>
          </Link>
          <Link
            to="/urls"
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "gap-2",
            )}
          >
            <span>Browse All Links</span>
          </Link>
          <a
            href="https://github.com/lavish-agrwl/SnapLink"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "ghost", size: "default" }),
              "gap-2",
            )}
          >
            <GithubLogoIcon className="size-4" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </section>

      {/* Live System Diagnostics & Real-time Metrics */}
      <section className="max-w-5xl mx-auto">
        <Card className="border bg-card/70 backdrop-blur rounded-2xl">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PulseIcon className="size-4 text-primary" weight="bold" />
                  <span>Live overview</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  System status and your link activity at a glance
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    healthLoading
                      ? "bg-amber-400 animate-pulse"
                      : health?.status === "ok"
                        ? "bg-emerald-500"
                        : "bg-destructive",
                  )}
                />
                <span className="font-mono text-muted-foreground">
                  Status:{" "}
                  {healthLoading
                    ? "checking..."
                    : health?.status === "ok"
                      ? "HEALTHY"
                      : "DEGRADED"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrivesIcon className="size-3.5" />
                <span>Cache</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {healthLoading
                  ? "..."
                  : health?.redis === "connected"
                    ? "CONNECTED"
                    : "DISCONNECTED"}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Fast redirect layer
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DatabaseIcon className="size-3.5" />
                <span>Database</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {healthLoading
                  ? "..."
                  : health?.mongodb === "connected"
                    ? "CONNECTED"
                    : "DISCONNECTED"}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Links & analytics storage
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <PulseIcon className="size-3.5" />
                <span>Links created</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {totalLinks.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Queue: {health?.queueDepth ?? 0} jobs
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ChartLineUpIcon className="size-3.5" />
                <span>Total clicks</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {totalClicksAcrossLinks.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Across {totalLinks} links
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Feature Grid */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Everything you need, nothing you don't
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Create short links in seconds and understand how they perform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card
                key={idx}
                className="rounded-2xl border bg-card/70 backdrop-blur hover:shadow-md hover:border-primary/40 transition-all"
              >
                <CardHeader className="pb-2">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-5xl mx-auto">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-lg">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">
              Ready to shorten your first link?
            </h3>
            <p className="text-sm text-primary-foreground/80 max-w-md">
              Custom aliases, expiry dates, and per-link analytics included.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/shorten"
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "font-semibold",
              )}
            >
              Get Started Now
            </Link>
            <Link
              to="/urls"
              className={cn(
                buttonVariants({ variant: "outline", size: "default" }),
                "bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10",
              )}
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
