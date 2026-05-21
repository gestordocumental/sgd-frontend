import { useEffect, useRef } from 'react'

interface RefreshCountdownProps {
  /** How long (ms) before the bar empties — should match refetchInterval or staleTime */
  duration: number
  /** True while the query is fetching (shows pulse instead of countdown) */
  isFetching: boolean
  /**
   * Timestamp (ms) from React Query's `dataUpdatedAt`.
   * Changes exactly once per successful fetch — no React-18 batching risk.
   * The bar restarts whenever this value changes.
   */
  updatedAt: number
}

/**
 * A 2 px bar that drains from full to empty over `duration` ms.
 *
 * Restarts every time `updatedAt` changes (i.e. every time React Query
 * writes fresh data), whether the refetch was triggered automatically,
 * by a manual click, or by a mutation invalidating the cache.
 *
 * While `isFetching` is true it shows a pulsing fill instead of the countdown.
 */
export function RefreshCountdown({ duration, isFetching, updatedAt }: RefreshCountdownProps) {
  return (
    <div className="w-6 h-[2px] rounded-full overflow-hidden bg-border">
      {isFetching ? (
        <div className="h-full w-full bg-primary/50 animate-pulse" />
      ) : (
        <CountdownBar key={updatedAt} duration={duration} />
      )}
    </div>
  )
}

/** Inner bar — remounting (via key change) restarts the CSS transition cleanly */
function CountdownBar({ duration }: { duration: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 1. Snap to full width with no transition
    el.style.transition = 'none'
    el.style.transform = 'scaleX(1)'
    // 2. Force a reflow so the browser registers the starting state
    void el.offsetWidth
    // 3. Now animate to empty over `duration` ms
    el.style.transition = `transform ${duration}ms linear`
    el.style.transform = 'scaleX(0)'
  }, [duration])

  return <div ref={ref} className="h-full bg-primary/60 origin-left" />
}
