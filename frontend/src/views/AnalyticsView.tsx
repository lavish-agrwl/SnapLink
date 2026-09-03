import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAnalytics } from '@/hooks/useAnalytics';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CaretRightIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  CheckIcon,
  ChartLineUpIcon,
  GlobeHemisphereWestIcon,
  ShareNetworkIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: analytics, isLoading, isError, refetch } = useAnalytics(slug!);
  const [copied, setCopied] = useState(false);

  const currentDomain = window.location.origin;
  const fullShortUrl = `${currentDomain}/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShortUrl);
      setCopied(true);
      toast.success('Short link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const openShortLink = () => {
    window.open(`/${encodeURIComponent(slug || '')}`, '_blank', 'noopener,noreferrer');
  };

  if (!slug) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="text-destructive font-semibold">Slug parameter is required</div>
        <Link to="/urls" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          Back to All URLs
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground text-xs">
        <ArrowClockwiseIcon className="size-6 animate-spin text-primary" />
        <span>Loading analytics telemetry for /{slug}...</span>
      </div>
    );
  }

  if (isError || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center max-w-md mx-auto">
        <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ChartLineUpIcon className="size-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Analytics Not Found</h2>
          <p className="text-xs text-muted-foreground">
            No analytics data could be found for slug <code className="font-mono font-bold">/{slug}</code>. The link may have expired or not exist yet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => refetch()}>
            Retry Fetch
          </Button>
          <Link to="/urls" className={buttonVariants({ variant: 'default', size: 'xs' })}>
            Back to All URLs
          </Link>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: analytics.clicksPerDay.map((d) => d.date),
    datasets: [
      {
        label: 'Clicks',
        data: analytics.clicksPerDay.map((d) => d.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  return (
    <div className="space-y-6 w-full">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <CaretRightIcon className="size-3" />
        <Link to="/urls" className="hover:text-foreground transition-colors">
          All URLs
        </Link>
        <CaretRightIcon className="size-3" />
        <span className="text-foreground font-semibold truncate">Analytics: /{slug}</span>
      </nav>

      {/* Page Header with Action Buttons */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono">
              /{slug}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Asynchronous click analytics streamed through BullMQ worker pipeline and aggregated in MongoDB.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 font-mono text-xs"
          >
            {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openShortLink}
            className="gap-1.5"
            title="Open short link in new tab"
          >
            <ArrowSquareOutIcon className="size-3.5" />
            <span className="hidden sm:inline">Open Link</span>
          </Button>

          <Link
            to="/urls"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs')}
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Total Lifetime Clicks</CardDescription>
              <ChartLineUpIcon className="size-4 text-primary" />
            </div>
            <CardTitle className="text-3xl font-mono text-primary">
              {analytics.totalClicks.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Top Referrer Domain</CardDescription>
              <ShareNetworkIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg font-mono truncate">
              {analytics.topReferrers[0]?.referrer || 'Direct / None'}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Top Country Location</CardDescription>
              <GlobeHemisphereWestIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg font-mono">
              {analytics.topCountries[0]?.country || 'Unknown / None'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Clicks Activity Chart */}
      <Card className="border">
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Click Activity Over Time</CardTitle>
              <CardDescription className="text-xs">Aggregated daily engagement history</CardDescription>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted">Last 30 Days</span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 h-[320px]">
          {analytics.clicksPerDay.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              No click history recorded yet. Share your short link to start tracking!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Referrers */}
        <Card className="border">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShareNetworkIcon className="size-4 text-primary" />
              <span>Top Referrers</span>
            </CardTitle>
            <CardDescription className="text-xs">Traffic origin and referring platforms</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {analytics.topReferrers.length > 0 ? (
              <div className="space-y-2">
                {analytics.topReferrers.map((ref, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs font-mono"
                  >
                    <span className="truncate text-muted-foreground max-w-[240px]">
                      {ref.referrer || 'Direct / Bookmark'}
                    </span>
                    <span className="font-semibold px-2 py-0.5 rounded bg-muted/60">
                      {ref.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No referrer data available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Countries */}
        <Card className="border">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GlobeHemisphereWestIcon className="size-4 text-primary" />
              <span>Top Countries</span>
            </CardTitle>
            <CardDescription className="text-xs">Geographic distribution of visitors</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {analytics.topCountries.length > 0 ? (
              <div className="space-y-2">
                {analytics.topCountries.map((country, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-1.5 border-b last:border-0 text-xs font-mono"
                  >
                    <span className="text-muted-foreground">
                      {country.country || 'Unknown'}
                    </span>
                    <span className="font-semibold px-2 py-0.5 rounded bg-muted/60">
                      {country.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No geolocation data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
