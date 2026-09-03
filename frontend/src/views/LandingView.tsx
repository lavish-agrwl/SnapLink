import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHealth } from '@/hooks/useHealth';
import { useUrls } from '@/hooks/useUrls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  LightningIcon,
  QueueIcon,
  ClockCountdownIcon,
  ChartLineUpIcon,
  ShieldCheckIcon,
  SparkleIcon,
  ArrowRightIcon,
  GithubLogoIcon,
  LinkSimpleIcon,
  HardDrivesIcon,
  DatabaseIcon,
  PulseIcon,
} from '@phosphor-icons/react';

export default function LandingView() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: urls } = useUrls();
  const [quickUrl, setQuickUrl] = useState('');
  const navigate = useNavigate();

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      navigate(`/shorten?url=${encodeURIComponent(quickUrl.trim())}`);
    } else {
      navigate('/shorten');
    }
  };

  const totalLinks = urls?.length ?? 0;
  const totalClicksAcrossLinks = urls?.reduce((acc, u) => acc + (u.totalClicks || 0), 0) ?? 0;

  const features = [
    {
      icon: LightningIcon,
      title: 'Redis-First In-Memory Cache',
      description:
        'Redirection paths query Redis in-memory cache first with sub-millisecond latencies, falling back to MongoDB only on cache misses.',
    },
    {
      icon: QueueIcon,
      title: 'Asynchronous BullMQ Pipeline',
      description:
        'Click events never block user redirects. Telemetry is enqueued non-blocking and batch-flushed to MongoDB in high-throughput bursts.',
    },
    {
      icon: ClockCountdownIcon,
      title: 'Configurable TTL & Soft-Expiry',
      description:
        'Specify expiration lifetimes with ease using the built-in calendar widget. Native MongoDB TTL indexes guarantee automatic cleanup.',
    },
    {
      icon: ChartLineUpIcon,
      title: 'Deep Behavioral Analytics',
      description:
        'Track link performance with 30-day click activity charts, top referrer breakdown, and country-level geolocation tracking.',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Sliding-Window Rate Limiting',
      description:
        'Distributed Redis token-bucket rate limits protect shortening, redirection, and analytics endpoints against abuse.',
    },
    {
      icon: SparkleIcon,
      title: 'Custom Slugs & Base62 Generation',
      description:
        'Create recognizable custom aliases or let our collision-resistant Base62 algorithm generate clean, compact short identifiers.',
    },
  ];

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border text-xs font-medium text-muted-foreground">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Distributed Architecture • High-Throughput Ingestion</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-balance">
          High-Performance Short Links for Modern Systems
        </h1>

        <p className="text-base md:text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
          SnapLink combines sub-millisecond Redis caching, background BullMQ telemetry,
          granular analytics, and calendar-scheduled TTL auto-expiration.
        </p>

        {/* Quick Shorten Input Bar */}
        <div className="max-w-xl mx-auto pt-2">
          <form
            onSubmit={handleQuickSubmit}
            className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-none border bg-card shadow-sm"
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
            <Button type="submit" size="default" className="w-full sm:w-auto shrink-0 font-medium">
              <span>Shorten Link</span>
              <ArrowRightIcon className="size-3.5 ml-1" />
            </Button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/shorten"
            className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'gap-2')}
          >
            <LinkSimpleIcon className="size-4" weight="bold" />
            <span>Open Shorten Studio</span>
          </Link>
          <Link
            to="/urls"
            className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'gap-2')}
          >
            <span>Browse All Links</span>
          </Link>
          <a
            href="https://github.com/lavish-agrwl/SnapLink"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'ghost', size: 'default' }), 'gap-2')}
          >
            <GithubLogoIcon className="size-4" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </section>

      {/* Live System Diagnostics & Real-time Metrics */}
      <section className="max-w-5xl mx-auto">
        <Card className="border bg-card/60 backdrop-blur">
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PulseIcon className="size-4 text-primary" weight="bold" />
                  <span>Real-Time Engine Diagnostics</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Live status of background queues, caching layers, and database clusters
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'size-2.5 rounded-full',
                    healthLoading
                      ? 'bg-amber-400 animate-pulse'
                      : health?.status === 'ok'
                      ? 'bg-emerald-500'
                      : 'bg-destructive'
                  )}
                />
                <span className="font-mono text-muted-foreground">
                  Status: {healthLoading ? 'checking...' : health?.status === 'ok' ? 'HEALTHY' : 'DEGRADED'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1 p-3 rounded-none bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrivesIcon className="size-3.5" />
                <span>Redis 7 Cache</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {healthLoading ? '...' : health?.redis === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
              <p className="text-[10px] text-muted-foreground">Sub-millisecond read layer</p>
            </div>

            <div className="space-y-1 p-3 rounded-none bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DatabaseIcon className="size-3.5" />
                <span>MongoDB Atlas</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {healthLoading ? '...' : health?.mongodb === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
              <p className="text-[10px] text-muted-foreground">TTL indexes & batch storage</p>
            </div>

            <div className="space-y-1 p-3 rounded-none bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <QueueIcon className="size-3.5" />
                <span>Queue Depth</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {health?.queueDepth ?? 0} jobs
              </div>
              <p className="text-[10px] text-muted-foreground">Active BullMQ worker stream</p>
            </div>

            <div className="space-y-1 p-3 rounded-none bg-muted/40 border">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ChartLineUpIcon className="size-3.5" />
                <span>Total Recorded Clicks</span>
              </div>
              <div className="text-sm font-semibold font-mono">
                {totalClicksAcrossLinks.toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground">Across {totalLinks} created links</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Feature Grid */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Engineered for Reliability and Scale</h2>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            From high-throughput click pipelines to granular rate limiters, every layer is
            optimized to operate seamlessly under load.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="border hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="size-9 rounded-none bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture Flow Diagram */}
      <section className="max-w-5xl mx-auto">
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">How SnapLink Works</CardTitle>
            <CardDescription className="text-xs">
              End-to-end request lifecycle from initial browser redirect to asynchronous click ingestion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 border rounded-none bg-muted/20 space-y-1.5">
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">01</span>
                <h4 className="font-semibold">Incoming Request</h4>
                <p className="text-[11px] text-muted-foreground">
                  User visits short URL `/:slug`. Request hits the Express API cluster.
                </p>
              </div>

              <div className="p-3 border rounded-none bg-muted/20 space-y-1.5">
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">02</span>
                <h4 className="font-semibold">Redis Cache Check</h4>
                <p className="text-[11px] text-muted-foreground">
                  Redis validates active slug and soft-expiry. Falls back to MongoDB on cache miss.
                </p>
              </div>

              <div className="p-3 border rounded-none bg-muted/20 space-y-1.5">
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">03</span>
                <h4 className="font-semibold">Instant HTTP 301</h4>
                <p className="text-[11px] text-muted-foreground">
                  Client immediately receives 301 redirect. User experience is never delayed.
                </p>
              </div>

              <div className="p-3 border rounded-none bg-muted/20 space-y-1.5">
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">04</span>
                <h4 className="font-semibold">Async BullMQ Flush</h4>
                <p className="text-[11px] text-muted-foreground">
                  Telemetry job is enqueued in background. Worker flushes batch analytics to Mongo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-5xl mx-auto">
        <div className="p-8 border rounded-none bg-primary text-primary-foreground flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">Ready to shorten and track your links?</h3>
            <p className="text-xs text-primary-foreground/80 max-w-md">
              Create short links with custom aliases, calendar expiration dates, and instant analytics.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/shorten"
              className={cn(
                buttonVariants({ variant: 'secondary', size: 'default' }),
                'font-semibold'
              )}
            >
              Get Started Now
            </Link>
            <Link
              to="/urls"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'default' }),
                'bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10'
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
