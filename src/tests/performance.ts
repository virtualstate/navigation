const { PerformanceObserver } = await import("perf_hooks").catch(() => ({
  PerformanceObserver: undefined,
}));

export default PerformanceObserver;
