import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useShorten } from '@/hooks/useShorten';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import CalendarWidget from '@/components/CalendarWidget';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ShortUrl } from '@/types/api';
import {
  LinkSimpleIcon,
  CopyIcon,
  CheckIcon,
  ArrowSquareOutIcon,
  ChartLineUpIcon,
  SparkleIcon,
  PlusIcon,
  CaretRightIcon,
  ClipboardTextIcon,
} from '@phosphor-icons/react';

export default function ShortenView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { mutate: shorten, isPending } = useShorten();

  const [url, setUrl] = useState(() => searchParams.get('url') || '');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdResult, setCreatedResult] = useState<ShortUrl | null>(null);
  const [copied, setCopied] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        toast.info('Pasted URL from clipboard');
      }
    } catch {
      toast.error('Clipboard access not permitted');
    }
  };

  const handleCopy = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Short link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error('Destination URL is required');
      return;
    }

    shorten(
      {
        url: url.trim(),
        customSlug: customSlug.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      },
      {
        onSuccess: (data) => {
          toast.success('URL shortened successfully!');
          setCreatedResult(data);
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to shorten URL');
        },
      }
    );
  };

  const handleResetForm = () => {
    setUrl('');
    setCustomSlug('');
    setExpiresAt('');
    setCreatedResult(null);
  };

  // Determine display domain for prefix
  const currentDomain = window.location.origin;

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <Link to="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <CaretRightIcon className="size-3" />
        <span className="text-foreground font-semibold">Shorten URL</span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Shorten URL</h1>
        <p className="text-xs text-muted-foreground">
          Create compact, high-performance links with custom slugs, instant Redis caching, and calendar-based expiration.
        </p>
      </header>

      {/* Creation Result Card (When URL is created) */}
      {createdResult && (
        <Card className="border-2 border-primary/50 bg-primary/5 shadow-md animate-in fade-in slide-in-from-top-3">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded bg-emerald-500 text-white flex items-center justify-center">
                  <CheckIcon className="size-4" weight="bold" />
                </div>
                <CardTitle className="text-sm font-semibold">Your Link is Ready!</CardTitle>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-muted border">
                Slug: {createdResult.slug}
              </span>
            </div>
            <CardDescription className="text-xs">
              This link is live, cached in Redis, and actively recording telemetry.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-4 text-xs">
            {/* Short Link Display & Copy Button */}
            <div className="flex items-center gap-2 p-2 rounded-none border bg-background">
              <div className="flex-1 font-mono font-semibold text-primary truncate text-sm px-1">
                {createdResult.shortUrl || `${currentDomain}/${createdResult.slug}`}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  handleCopy(createdResult.shortUrl || `${currentDomain}/${createdResult.slug}`)
                }
                className="gap-1 font-medium shrink-0"
              >
                {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>

            {/* Destination URL Info */}
            <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/40 p-2.5 border">
              <div>
                <span className="font-semibold text-foreground">Destination:</span>{' '}
                <span className="break-all font-mono">{createdResult.originalUrl}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Expiration:</span>{' '}
                <span>
                  {createdResult.expiresAt
                    ? new Date(createdResult.expiresAt).toLocaleString()
                    : 'Permanent (No expiration set)'}
                </span>
              </div>
            </div>

            {/* Next Action Links */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={createdResult.shortUrl || `/${createdResult.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'gap-1')}
              >
                <ArrowSquareOutIcon className="size-3.5" />
                <span>Test Redirect</span>
              </a>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => navigate(`/analytics/${createdResult.slug}`)}
                className="gap-1"
              >
                <ChartLineUpIcon className="size-3.5" />
                <span>View Analytics</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleResetForm}
                className="gap-1 ml-auto"
              >
                <PlusIcon className="size-3.5" />
                <span>Shorten Another</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Shorten Form */}
      <Card className="border overflow-visible">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base font-semibold">Link Configuration</CardTitle>
          <CardDescription className="text-xs">
            Provide the target destination web address and configure optional expiration schedules.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Field 1: Destination URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="url" className="text-xs font-semibold flex items-center gap-1.5">
                  <LinkSimpleIcon className="size-3.5 text-primary" weight="bold" />
                  <span>Destination URL</span>
                  <span className="text-destructive font-mono">*</span>
                </Label>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardTextIcon className="size-3" />
                  <span>Paste from clipboard</span>
                </button>
              </div>

              <Input
                id="url"
                type="url"
                placeholder="https://example.com/long-page-path-with-parameters"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Must include protocol (<code className="font-mono">http://</code> or{' '}
                <code className="font-mono">https://</code>). This is the original address visitors will be redirected to.
              </p>
            </div>

            {/* Field 2: Custom Slug (Optional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="slug" className="text-xs font-semibold flex items-center gap-1.5">
                  <SparkleIcon className="size-3.5 text-primary" weight="bold" />
                  <span>Custom Slug Alias</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                    Optional
                  </span>
                </Label>
              </div>

              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 h-8 border border-r-0 bg-muted text-muted-foreground text-[11px] font-mono select-none">
                  {currentDomain.replace(/^https?:\/\//, '')}/
                </span>
                <Input
                  id="slug"
                  placeholder="custom-alias"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="text-xs font-mono rounded-l-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                3–30 characters using alphanumeric letters, numbers, or hyphens. If omitted, a collision-resistant Base62 slug is automatically generated.
              </p>
            </div>

            {/* Field 3: TTL Calendar Widget (Optional) */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <span>Expiration Schedule (TTL)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                    Optional
                  </span>
                </Label>
              </div>

              <CalendarWidget value={expiresAt} onChange={setExpiresAt} />

              <p className="text-[11px] text-muted-foreground">
                Links automatically deactivate at the scheduled time. When expired, the Redis cache key is invalidated and MongoDB TTL background indexes purge the record.
              </p>
            </div>

            {/* Form Submission Controls */}
            <div className="pt-4 border-t flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetForm}
                disabled={isPending || (!url && !customSlug && !expiresAt)}
              >
                Clear
              </Button>

              <div className="flex items-center gap-3">
                <Link
                  to="/urls"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  View All Links
                </Link>
                <Button type="submit" size="default" disabled={isPending || !url.trim()} className="font-semibold">
                  {isPending ? 'Shortening...' : 'Generate Short Link'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
