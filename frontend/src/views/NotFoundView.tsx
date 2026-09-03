import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { LinkSimpleIcon, HouseIcon, PlusIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export default function NotFoundView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-6">
      <div className="space-y-2">
        <div className="text-7xl font-extrabold tracking-tighter font-mono text-muted-foreground/40">
          404
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Destination Not Found</h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          The page or short link you are attempting to visit does not exist, has expired, or may have been deleted.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}>
          <HouseIcon className="size-3.5" />
          <span>Return Home</span>
        </Link>
        <Link to="/shorten" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
          <PlusIcon className="size-3.5" />
          <span>Create Short Link</span>
        </Link>
        <Link to="/urls" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}>
          <LinkSimpleIcon className="size-3.5" />
          <span>Browse All URLs</span>
        </Link>
      </div>
    </div>
  );
}
