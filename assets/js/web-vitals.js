/**
 * Web Vitals Monitoring
 * Real-time performance metrics tracking
 *
 * Metrics tracked:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 * - INP (Interaction to Next Paint)
 */

// =============================================================================
// Web Vitals Module / パフォーマンス計測
// =============================================================================

const WebVitalsMonitor = {
  /**
   * Store collected metrics
   */
  metrics: {},

  /**
   * Log metric to console
   * @param {Object} metric - Web Vitals metric object
   */
  logMetric(metric) {
    const { name, value, rating, delta } = metric;

    // Store metric
    this.metrics[name] = {
      value,
      rating,
      delta,
      timestamp: Date.now(),
    };

    // Color-code based on rating
    const colors = {
      good: 'color: #0cce6b; font-weight: bold',
      'needs-improvement': 'color: #ffa400; font-weight: bold',
      poor: 'color: #ff4e42; font-weight: bold',
    };

    const style = colors[rating] || '';

    console.log(
      `%c[Web Vitals] ${name}`,
      style,
      `\nValue: ${Math.round(value * 100) / 100}ms`,
      `\nRating: ${rating}`,
      `\nDelta: ${Math.round(delta * 100) / 100}ms`
    );
  },

  /**
   * Send metrics to analytics (optional)
   * @param {Object} metric - Web Vitals metric object
   */
  sendToAnalytics(metric) {
    // Example: Send to Google Analytics
    // if (typeof gtag !== 'undefined') {
    //   gtag('event', metric.name, {
    //     event_category: 'Web Vitals',
    //     value: Math.round(metric.value),
    //     event_label: metric.id,
    //     non_interaction: true,
    //   });
    // }

    // Example: Send to custom endpoint
    // fetch('/api/metrics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     name: metric.name,
    //     value: metric.value,
    //     rating: metric.rating,
    //     page: location.pathname,
    //     timestamp: Date.now(),
    //   }),
    // });
  },

  /**
   * Handle metric callback
   * @param {Object} metric - Web Vitals metric object
   */
  onMetric(metric) {
    this.logMetric(metric);
    // Uncomment to send to analytics
    // this.sendToAnalytics(metric);
  },

  /**
   * Initialize Web Vitals monitoring
   */
  init() {
    // Check if web-vitals library is loaded
    if (typeof webVitals === 'undefined') {
      console.warn('[Web Vitals] Library not loaded. Include web-vitals from CDN.');
      return;
    }

    try {
      // Track Core Web Vitals
      webVitals.onLCP(this.onMetric.bind(this));
      webVitals.onFID(this.onMetric.bind(this));
      webVitals.onCLS(this.onMetric.bind(this));

      // Track additional metrics
      webVitals.onFCP(this.onMetric.bind(this));
      webVitals.onTTFB(this.onMetric.bind(this));

      // INP (replaces FID in modern browsers)
      if (webVitals.onINP) {
        webVitals.onINP(this.onMetric.bind(this));
      }

      console.log('[Web Vitals] Monitoring initialized');
    } catch (error) {
      console.warn('[Web Vitals] Failed to initialize:', error);
    }
  },

  /**
   * Get summary of all collected metrics
   * @returns {Object} Metrics summary
   */
  getSummary() {
    return {
      metrics: this.metrics,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
    };
  },

  /**
   * Export metrics as JSON
   * @returns {string} JSON string of metrics
   */
  exportJSON() {
    return JSON.stringify(this.getSummary(), null, 2);
  },

  /**
   * Display metrics in console table
   */
  displayTable() {
    const tableData = Object.entries(this.metrics).map(([name, data]) => ({
      Metric: name,
      Value: `${Math.round(data.value * 100) / 100}ms`,
      Rating: data.rating,
      Delta: `${Math.round(data.delta * 100) / 100}ms`,
    }));

    console.table(tableData);
  },
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    WebVitalsMonitor.init();
  });
} else {
  WebVitalsMonitor.init();
}

// Make available globally for debugging
window.WebVitalsMonitor = WebVitalsMonitor;
