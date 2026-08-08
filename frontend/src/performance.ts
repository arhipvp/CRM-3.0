type MetricName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';

interface PerformanceMetric {
  name: MetricName;
  value: number;
  path: string;
}

const endpoint = import.meta.env.VITE_PERFORMANCE_ENDPOINT as string | undefined;
const debug = import.meta.env.DEV && import.meta.env.VITE_PERFORMANCE_DEBUG === 'true';

const reportMetric = (name: MetricName, value: number) => {
  const metric: PerformanceMetric = {
    name,
    value: Number(value.toFixed(2)),
    path: window.location.pathname,
  };
  if (debug) {
    console.info('[performance]', metric);
  }
  window.dispatchEvent(new CustomEvent('crm:performance-metric', { detail: metric }));
  if (endpoint && navigator.sendBeacon) {
    navigator.sendBeacon(
      endpoint,
      new Blob([JSON.stringify(metric)], { type: 'application/json' }),
    );
  }
};

const observe = (type: string, callback: PerformanceObserverCallback) => {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) {
    return;
  }
  const observer = new PerformanceObserver(callback);
  observer.observe({ type, buffered: true });
};

export const observeWebVitals = () => {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation) {
    reportMetric('TTFB', navigation.responseStart);
  }

  observe('paint', (list) => {
    const fcp = list.getEntries().find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) {
      reportMetric('FCP', fcp.startTime);
    }
  });

  observe('largest-contentful-paint', (list) => {
    const last = list.getEntries().at(-1);
    if (last) {
      reportMetric('LCP', last.startTime);
    }
  });

  let cls = 0;
  observe('layout-shift', (list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!shift.hadRecentInput) {
        cls += shift.value ?? 0;
      }
    }
    reportMetric('CLS', cls);
  });

  let inp = 0;
  observe('event', (list) => {
    for (const entry of list.getEntries()) {
      inp = Math.max(inp, entry.duration);
    }
    if (inp > 0) {
      reportMetric('INP', inp);
    }
  });
};
