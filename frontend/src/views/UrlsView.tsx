import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUrls } from '@/hooks/useUrls';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  CheckIcon,
  ChartLineUpIcon,
  ArrowClockwiseIcon,
  CaretRightIcon,
  LinkSimpleIcon,
  CalendarBlankIcon,
  ClockCountdownIcon,
} from '@phosphor-icons/react';

type FilterTab = 'all' | 'active' | 'expired';

function isLinkExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export default function UrlsView() {
  const { data: urls, isLoading, isError } = useUrls();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState<FilterTab>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentDomain = window.location.origin;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['urls'] });
    setTimeout(() => setIsRefreshing(false), 500);
    toast.info('URLs refreshed');
  };

  const handleCopyLink = async (slug: string) => {
    const fullUrl = `${currentDomain}/${slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedSlug(slug);
      toast.success(`Copied /${slug} to clipboard!`);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const openShortLink = (slug: string) => {
    window.open(`/${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer');
  };

  // Filtered and sorted URLs
  const filteredUrls = useMemo(() => {
    if (!urls) return [];

    return urls.filter((link) => {
      // Tab filter
      const expired = isLinkExpired(link.expiresAt);
      if (currentTab === 'active' && expired) return false;
      if (currentTab === 'expired' && !expired) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSlug = link.slug.toLowerCase().includes(q);
        const matchOriginal = link.originalUrl.toLowerCase().includes(q);
        return matchSlug || matchOriginal;
      }

      return true;
    });
  }, [urls, searchQuery, currentTab]);

  // Summary statistics
  const stats = useMemo(() => {
    if (!urls) return { total: 0, totalClicks: 0, active: 0, expired: 0 };
    let totalClicks = 0;
    let active = 0;
    let expired = 0;

    for (const link of urls) {
      totalClicks += link.totalClicks || 0;
      if (isLinkExpired(link.expiresAt)) {
        expired++;
      } else {
        active++;
      }
    }

    return { total: urls.length, totalClicks, active, expired };
  }, [urls]);

function formatExpiryDate(expiresAt: string | null): string {
  if (!expiresAt) return 'Permanent';
  return new Date(expiresAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

  return (
    <div className="space-y-6 w-full">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <CaretRightIcon className="size-3" />
        <span className="text-foreground font-semibold">All URLs</span>
      </nav>

      {/* Header and Quick Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">All Shortened URLs</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted border font-semibold">
              {stats.total} total
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Central directory to view, filter, track analytics, and manage all active redirect destinations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="gap-1.5"
          >
            <ArrowClockwiseIcon className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Link
            to="/shorten"
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5 font-medium')}
          >
            <PlusIcon className="size-3.5" weight="bold" />
            <span>Shorten New URL</span>
          </Link>
        </div>
      </header>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border">
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px]">Total Links</CardDescription>
            <CardTitle className="text-2xl font-mono">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border">
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px]">Total Clicks</CardDescription>
            <CardTitle className="text-2xl font-mono text-primary">{stats.totalClicks.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border">
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px]">Active Links</CardDescription>
            <CardTitle className="text-2xl font-mono text-emerald-500">{stats.active}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border">
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px]">Expired Links</CardDescription>
            <CardTitle className="text-2xl font-mono text-muted-foreground">{stats.expired}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Filter Tabs */}
        <div className="flex items-center p-1 rounded-none border bg-muted/30 text-xs w-fit">
          <button
            type="button"
            onClick={() => setCurrentTab('all')}
            className={cn(
              'px-3 py-1 font-medium transition-colors cursor-pointer',
              currentTab === 'all'
                ? 'bg-background shadow-xs font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('active')}
            className={cn(
              'px-3 py-1 font-medium transition-colors cursor-pointer',
              currentTab === 'active'
                ? 'bg-background shadow-xs font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Active ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('expired')}
            className={cn(
              'px-3 py-1 font-medium transition-colors cursor-pointer',
              currentTab === 'expired'
                ? 'bg-background shadow-xs font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Expired ({stats.expired})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by slug or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs font-mono h-8"
          />
        </div>
      </div>

      {/* URLs Table Card */}
      <Card className="border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-xs">
              <ArrowClockwiseIcon className="size-5 animate-spin text-primary" />
              <span>Loading shortened links...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-destructive text-xs">
              <span>Error loading links from API</span>
              <Button size="xs" variant="outline" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          ) : filteredUrls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center p-6">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <LinkSimpleIcon className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {searchQuery ? 'No matching links found' : 'No shortened links yet'}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  {searchQuery
                    ? `No URLs matched "${searchQuery}". Try a different keyword or reset filters.`
                    : 'Get started by creating your first shortened link with custom slugs and expiration dates.'}
                </p>
              </div>
              {searchQuery ? (
                <Button size="xs" variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              ) : (
                <Link to="/shorten" className={buttonVariants({ variant: 'default', size: 'sm' })}>
                  <PlusIcon className="size-3.5 mr-1" />
                  Shorten a URL
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Slug</TableHead>
                    <TableHead>Original Destination</TableHead>
                    <TableHead className="w-[140px]">Expiration</TableHead>
                    <TableHead className="text-right w-[90px]">Clicks</TableHead>
                    <TableHead className="text-right w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUrls.map((link) => {
                    const expired = isLinkExpired(link.expiresAt);
                    const isCopied = copiedSlug === link.slug;

                    return (
                      <TableRow key={link.slug} className={cn(expired && 'opacity-60 bg-muted/20')}>
                        {/* Slug column */}
                        <TableCell className="font-mono text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'size-1.5 rounded-full shrink-0',
                              expired ? 'bg-destructive' : 'bg-emerald-500'
                            )} />
                            <Link
                              to={`/analytics/${link.slug}`}
                              className="text-primary hover:underline truncate"
                              title={`View analytics for /${link.slug}`}
                            >
                              {link.slug}
                            </Link>
                          </div>
                        </TableCell>

                        {/* Destination URL column */}
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground font-mono">
                          <span title={link.originalUrl}>{link.originalUrl}</span>
                        </TableCell>

                        {/* Expiration column */}
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {link.expiresAt ? (
                            <span className="inline-flex items-center gap-1" title={new Date(link.expiresAt).toLocaleString()}>
                              <ClockCountdownIcon className="size-3 text-primary" />
                              <span>{formatExpiryDate(link.expiresAt)}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <CalendarBlankIcon className="size-3" />
                              Permanent
                            </span>
                          )}
                        </TableCell>

                        {/* Clicks count column */}
                        <TableCell className="text-right font-mono font-semibold text-xs">
                          {link.totalClicks || 0}
                        </TableCell>

                        {/* Action buttons */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Copy Short Link */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleCopyLink(link.slug)}
                              title={`Copy /${link.slug}`}
                              aria-label={`Copy /${link.slug}`}
                            >
                              {isCopied ? (
                                <CheckIcon className="size-3 text-emerald-500" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </Button>

                            {/* Open Short Link */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => openShortLink(link.slug)}
                              title={`Open /${link.slug} in new tab`}
                              aria-label={`Open /${link.slug}`}
                            >
                              <ArrowSquareOutIcon className="size-3" />
                            </Button>

                            {/* View Analytics */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => navigate(`/analytics/${link.slug}`)}
                              title="View performance analytics"
                              aria-label={`Analytics for ${link.slug}`}
                            >
                              <ChartLineUpIcon className="size-3 text-primary" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
