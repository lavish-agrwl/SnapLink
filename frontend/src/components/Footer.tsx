import { Link } from 'react-router-dom';
import { GithubLogoIcon, LinkSimpleIcon } from '@phosphor-icons/react';

export default function Footer() {
  return (
    <footer className="border-t mt-auto py-8 text-xs text-muted-foreground bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <LinkSimpleIcon className="size-4" weight="bold" />
            <span>SnapLink</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border font-mono">v1.0.0</span>
          </div>
          <p className="text-center md:text-left text-muted-foreground text-[11px]">
            Distributed, high-throughput URL shortener with Redis caching and asynchronous telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <Link to="/shorten" className="hover:text-foreground transition-colors">
            Shorten URL
          </Link>
          <Link to="/urls" className="hover:text-foreground transition-colors">
            All URLs
          </Link>
          <a
            href="https://github.com/lavish-agrwl/SnapLink"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <GithubLogoIcon className="size-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-6 pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div>
          Powered by Redis 7 • MongoDB Atlas • BullMQ • Express • React 19
        </div>
        <div>
          © {new Date().getFullYear()} SnapLink. Built for speed and scale.
        </div>
      </div>
    </footer>
  );
}
