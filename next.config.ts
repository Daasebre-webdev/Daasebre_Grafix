const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googletagmanager.com *.google-analytics.com;
      style-src 'self' 'unsafe-inline' *.googleapis.com;
      img-src 'self' *.google-analytics.com *.googletagmanager.com data:;
      font-src 'self' *.gstatic.com;
      connect-src 'self' *.google-analytics.com *.analytics.google.com;
      frame-src 'self' *.youtube.com;
    `.replace(/\s+/g, ' ').trim()
  }
] satisfies {
  key: string;
  value: string;
}[];