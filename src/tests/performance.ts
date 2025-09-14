const { PerformanceObserver } = await import("perf_hooks").catch((): { PerformanceObserver: undefined } => ({
  PerformanceObserver: undefined,
}));

export default PerformanceObserver;
