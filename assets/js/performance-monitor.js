/**
 * Performance Monitor for yunoxia.one
 * Monitors and reports Web Vitals and performance metrics
 *
 * Usage: Include this script with defer attribute after app.js
 * <script src="assets/js/performance-monitor.js" defer></script>
 *
 * Note: This is optional and should only be used during development
 * or when you want to monitor performance metrics
 */

// =============================================================================
// Configuration
// =============================================================================

const PERF_CONFIG = {
  // Enable console logging
  enableLogging: true,

  // Enable performance marks
  enableMarks: true,

  // Report to analytics (set to false for privacy)
  reportToAnalytics: false,

  // Thresholds for performance metrics (in milliseconds)
  thresholds: {
    FCP: 1800,  // First Contentful Paint
    LCP: 2500,  // Largest Contentful Paint
    FID: 100,   // First Input Delay
    CLS: 0.1,   // Cumulative Layout Shift
    TTFB: 600,  // Time to First Byte
  },
};

// =============================================================================
// Web Vitals Measurement
// =============================================================================

const WebVitals = {
  /**
   * Measure First Contentful Paint (FCP)
   */
  measureFCP() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.report('FCP', entry.startTime);
          observer.disconnect();
        }
      }
    });

    try {
      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      console.warn('[Performance] FCP measurement not supported');
    }
  },

  /**
   * Measure Largest Contentful Paint (LCP)
   */
  measureLCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.report('LCP', lastEntry.startTime);
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('[Performance] LCP measurement not supported');
    }
  },

  /**
   * Measure First Input Delay (FID)
   */
  measureFID() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.report('FID', entry.processingStart - entry.startTime);
        observer.disconnect();
      }
    });

    try {
      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('[Performance] FID measurement not supported');
    }
  },

  /**
   * Measure Cumulative Layout Shift (CLS)
   */
  measureCLS() {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });

    try {
      observer.observe({ type: 'layout-shift', buffered: true });

      // Report CLS after page is fully loaded
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.report('CLS', clsValue);
          observer.disconnect();
        }, 0);
      });
    } catch (e) {
      console.warn('[Performance] CLS measurement not supported');
    }
  },

  /**
   * Measure Time to First Byte (TTFB)
   */
  measureTTFB() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      const ttfb = navigation.responseStart - navigation.requestStart;
      this.report('TTFB', ttfb);
    }
  },

  /**
   * Report metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  report(name, value) {
    const threshold = PERF_CONFIG.thresholds[name];
    const status = threshold && value > threshold ? '⚠️' : '✅';

    if (PERF_CONFIG.enableLogging) {
      console.log(
        `[Performance] ${status} ${name}: ${value.toFixed(2)}${name === 'CLS' ? '' : 'ms'}`,
        threshold ? `(threshold: ${threshold}${name === 'CLS' ? '' : 'ms'})` : ''
      );
    }

    // Report to analytics if enabled
    if (PERF_CONFIG.reportToAnalytics) {
      this.sendToAnalytics(name, value);
    }

    // Dispatch custom event for other scripts to listen
    window.dispatchEvent(new CustomEvent('web-vital', {
      detail: { name, value, threshold, status: status === '✅' ? 'good' : 'needs-improvement' }
    }));
  },

  /**
   * Send metrics to analytics
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  sendToAnalytics(name, value) {
    // Example: Send to Google Analytics
    // if (typeof gtag !== 'undefined') {
    //   gtag('event', name, {
    //     event_category: 'Web Vitals',
    //     value: Math.round(value),
    //     non_interaction: true,
    //   });
    // }

    // Example: Send to custom analytics endpoint
    // fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ metric: name, value }),
    // });
  },

  /**
   * Initialize all measurements
   */
  init() {
    this.measureFCP();
    this.measureLCP();
    this.measureFID();
    this.measureCLS();
    this.measureTTFB();
  },
};

// =============================================================================
// Resource Timing Analysis
// =============================================================================

const ResourceTiming = {
  /**
   * Analyze resource loading performance
   */
  analyze() {
    const resources = performance.getEntriesByType('resource');

    const stats = {
      total: resources.length,
      byType: {},
      slowest: [],
    };

    // Group by type and find slowest resources
    resources.forEach((resource) => {
      const type = resource.initiatorType;
      const duration = resource.duration;

      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, totalDuration: 0 };
      }

      stats.byType[type].count++;
      stats.byType[type].totalDuration += duration;

      stats.slowest.push({
        name: resource.name,
        type: type,
        duration: duration,
      });
    });

    // Sort by duration
    stats.slowest.sort((a, b) => b.duration - a.duration);
    stats.slowest = stats.slowest.slice(0, 10); // Top 10

    return stats;
  },

  /**
   * Report resource timing
   */
  report() {
    const stats = this.analyze();

    if (PERF_CONFIG.enableLogging) {
      console.group('[Performance] Resource Timing');
      console.log(`Total resources: ${stats.total}`);
      console.table(stats.byType);
      console.log('Slowest resources:');
      console.table(stats.slowest);
      console.groupEnd();
    }
  },
};

// =============================================================================
// Navigation Timing
// =============================================================================

const NavigationTiming = {
  /**
   * Report navigation timing
   */
  report() {
    const navigation = performance.getEntriesByType('navigation')[0];

    if (!navigation) {
      console.warn('[Performance] Navigation timing not available');
      return;
    }

    const timing = {
      'DNS Lookup': navigation.domainLookupEnd - navigation.domainLookupStart,
      'TCP Connection': navigation.connectEnd - navigation.connectStart,
      'TLS Negotiation': navigation.secureConnectionStart > 0
        ? navigation.connectEnd - navigation.secureConnectionStart
        : 0,
      'Request Time': navigation.responseStart - navigation.requestStart,
      'Response Time': navigation.responseEnd - navigation.responseStart,
      'DOM Processing': navigation.domComplete - navigation.domInteractive,
      'Load Complete': navigation.loadEventEnd - navigation.loadEventStart,
      'Total Time': navigation.loadEventEnd - navigation.fetchStart,
    };

    if (PERF_CONFIG.enableLogging) {
      console.group('[Performance] Navigation Timing');
      console.table(timing);
      console.groupEnd();
    }
  },
};

// =============================================================================
// Memory Usage (if available)
// =============================================================================

const MemoryMonitor = {
  /**
   * Report memory usage
   */
  report() {
    if (!performance.memory) {
      console.warn('[Performance] Memory API not available');
      return;
    }

    const memory = {
      'Used JS Heap': `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      'Total JS Heap': `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      'Heap Limit': `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      'Usage': `${((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)}%`,
    };

    if (PERF_CONFIG.enableLogging) {
      console.group('[Performance] Memory Usage');
      console.table(memory);
      console.groupEnd();
    }
  },
};

// =============================================================================
// Performance Summary
// =============================================================================

const PerformanceSummary = {
  /**
   * Generate and display performance summary
   */
  display() {
    if (!PERF_CONFIG.enableLogging) return;

    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1');
    console.log('%c📊 Performance Report - yunoxia.one', 'color: #6366f1; font-size: 16px; font-weight: bold');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1');

    NavigationTiming.report();
    ResourceTiming.report();
    MemoryMonitor.report();

    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1');
    console.log('%cTip: Open DevTools → Lighthouse to run a full audit', 'color: #888');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #6366f1');
  },
};

// =============================================================================
// Initialization
// =============================================================================

// Wait for page load to complete
window.addEventListener('load', () => {
  // Small delay to ensure all metrics are captured
  setTimeout(() => {
    WebVitals.init();
    PerformanceSummary.display();
  }, 100);
});

// Export for console access
window.PerformanceMonitor = {
  WebVitals,
  ResourceTiming,
  NavigationTiming,
  MemoryMonitor,
  config: PERF_CONFIG,
};
