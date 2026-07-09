import { TabsList } from '@/components/ui/tabs';
import { useDragScroll } from '@/lib/use-drag-scroll';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

/**
 * A TabsList that scrolls horizontally with mouse drag when it overflows its
 * container (e.g. a header with too many tabs to fit on a small screen).
 * The native scrollbar is hidden, so without this a plain mouse would have
 * no way to reach the tabs past the visible edge.
 */
function ScrollableTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  const { ref, bind } = useDragScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="flex-1 min-w-0 overflow-x-auto cursor-grab select-none active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      {...bind}
    >
      <TabsList className={cn('w-max', className)} {...props} />
    </div>
  );
}

export { ScrollableTabsList };
