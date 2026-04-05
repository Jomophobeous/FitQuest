/**
 * Server-side Subscription Endpoint Tests
 * 
 * Tests the hardened /subscriptions/verify and /subscriptions/status endpoints.
 * Verifies:
 * - Invalid receipt → 402
 * - Expired subscription → 402
 * - Valid subscription → 200
 * - Tamper detection → 402
 * - No data leakage on error
 */

const request = require('supertest');
const express = require('express');
const supabase = require('../server/utils/supabaseClient');
const subscriptionRouter = require('../server/routes/subscription');
const { requireAuth } = require('../server/middleware/requireAuth');

// Mock Supabase
jest.mock('../server/utils/supabaseClient');

// Mock RevenueCat client
jest.mock('../server/utils/revenueCatClient', () => ({
  verifyReceipt: jest.fn(),
  postReceipt: jest.fn(),
  clearCache: jest.fn(),
}));

const { postReceipt, verifyReceipt } = require('../server/utils/revenueCatClient');

describe('Subscription Endpoints (Phase 4)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Add a mock auth middleware that just sets req.user
    app.use((req, res, next) => {
      req.user = { sub: 'test-user-001', id: 'test-user-001', email: 'test@example.com' };
      req.device = { device_id: 'test-device-001' };
      next();
    });

    app.use(subscriptionRouter);

    jest.clearAllMocks();
  });

  describe('POST /subscriptions/verify', () => {
    it('FAIL: invalid receipt token → 402 Payment Required', async () => {
      postReceipt.mockResolvedValue({
        valid: false,
        entitlements: [],
        expiry: null,
        source: 'receipt_rejected',
      });

      const res = await request(app)
        .post('/subscriptions/verify')
        .send({
          user_id: 'test-user-001',
          receipt_token: 'invalid_token_xyz',
          product_id: 'fitquest_monthly',
        });

      expect(res.status).toBe(402);
      expect(res.body.data).toBeNull();
      // No details leaked
      expect(res.body.message).not.toContain('receipt');
      expect(res.body.message).not.toContain('invalid');
    });

    it('PASS: valid receipt → 200 with entitlements', async () => {
      postReceipt.mockResolvedValue({
        valid: true,
        entitlements: ['full_access'],
        expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'revenuecat',
      });

      supabase.from('subscriptions').upsert = jest.fn().mockResolvedValue({ error: null });

      const res = await request(app)
        .post('/subscriptions/verify')
        .send({
          user_id: 'test-user-001',
          receipt_token: 'valid_receipt_token',
          product_id: 'fitquest_annual',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.entitlements).toContain('full_access');
      expect(res.body.data.expiry).toBeTruthy();
    });

    it('FAIL: tamper detection (wrong user_id) → 402', async () => {
      const res = await request(app)
        .post('/subscriptions/verify')
        .send({
          user_id: 'different-user-id',
          receipt_token: 'some_token',
          product_id: 'fitquest_monthly',
        });

      // User tampering attempt detected → 402
      expect(res.status).toBe(402);
      expect(res.body.data).toBeNull();
    });

    it('FAIL: missing receipt_token → 402', async () => {
      const res = await request(app)
        .post('/subscriptions/verify')
        .send({
          user_id: 'test-user-001',
          // No receipt_token
          product_id: 'fitquest_monthly',
        });

      expect(res.status).toBe(402);
    });

    it('FAIL: RevenueCat API down → graceful 402', async () => {
      postReceipt.mockResolvedValue({
        valid: false,
        entitlements: [],
        expiry: null,
        source: 'network_error',
      });

      const res = await request(app)
        .post('/subscriptions/verify')
        .send({
          user_id: 'test-user-001',
          receipt_token: 'some_token',
          product_id: 'fitquest_monthly',
        });

      expect(res.status).toBe(402);
    });
  });

  describe('POST /subscriptions/status', () => {
    it('PASS: active subscription → 200 with has_access=true', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: {
                    status: 'active',
                    expires_at: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const res = await request(app).post('/subscriptions/status').send({
        user_id: 'test-user-001',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.has_access).toBe(true);
      expect(res.body.data.status).toBe('active');
    });

    it('FAIL: expired subscription → 200 with has_access=false', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: {
                    status: 'active',
                    expires_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const res = await request(app).post('/subscriptions/status').send({
        user_id: 'test-user-001',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.has_access).toBe(false);
      expect(res.body.data.status).toBe('expired');
    });

    it('FAIL: no subscription record → has_access=false', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      supabase.from('trial_state').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const res = await request(app).post('/subscriptions/status').send({
        user_id: 'test-user-001',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.has_access).toBe(false);
    });
  });

  describe('Middleware: requireSubscription', () => {
    let appWithMiddleware;

    beforeEach(() => {
      appWithMiddleware = express();
      appWithMiddleware.use(express.json());
      appWithMiddleware.use((req, res, next) => {
        req.user = { sub: 'test-user-001', id: 'test-user-001' };
        req.device = { device_id: 'test-device-001' };
        next();
      });

      // Apply subscription middleware to test route
      const { requireSubscription } = require('../server/middleware/requireSubscription');
      appWithMiddleware.post('/protected', requireSubscription(), (req, res) => {
        res.json({ message: 'access granted' });
      });
    });

    it('PASS: active subscription grants access', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: {
                    status: 'active',
                    expires_at: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const res = await request(appWithMiddleware).post('/protected').send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('access granted');
    });

    it('FAIL: expired subscription denied', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: {
                    status: 'active',
                    expires_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });

      const res = await request(appWithMiddleware).post('/protected').send({});

      expect(res.status).toBe(402);
      expect(res.body.data).toBeNull();
    });

    it('FAIL: no subscription record denied', async () => {
      supabase.from('subscriptions').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      supabase.from('trial_state').select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      });

      const res = await request(appWithMiddleware).post('/protected').send({});

      expect(res.status).toBe(402);
    });
  });
});
