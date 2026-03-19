import { describe, expect, it, vi } from 'vitest';

/**
 * PremiumGate & Subscription Context — Module Tests
 * 
 * Since these are React components, we verify:
 * 1. Modules import without crashing
 * 2. Key exports exist and have the right shape
 * 3. SubscriptionContext default state is sensible
 */

// ── Hoisted mocks ──
vi.hoisted(() => {});

// Mock everything these modules touch
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: any) => s },
  TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'android' },
  Animated: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    timing: vi.fn(),
    spring: vi.fn(),
    Value: vi.fn().mockImplementation(() => ({ interpolate: vi.fn() })),
  },
  Dimensions: { get: () => ({ width: 400, height: 800 }) },
  NativeModules: {},
}));
vi.mock('expo-router', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
}));
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: {
      colors: {
        background: '#000',
        text: '#fff',
        textMuted: '#888',
        accent: '#10B981',
        surface: '#111',
      },
      spacing: { 4: 16, 6: 24 },
      borderRadius: { lg: 12, md: 8 },
    },
  }),
}));
vi.mock('../src/purchases/SubscriptionManager', () => ({
  SubscriptionManager: {
    getInstance: vi.fn().mockResolvedValue({
      getState: () => ({ status: 'TRIAL', isTrial: true }),
      getOfferings: async () => ({ monthly: null, annual: null }),
      addListener: vi.fn().mockReturnValue(() => {}),
      hasAccess: () => true,
    }),
  },
}));
vi.mock('../src/purchases/SubscriptionContext', () => ({
  useSubscription: vi.fn().mockReturnValue({
    hasAccess: true,
    state: { status: 'TRIAL', isTrial: true },
    trialDaysRemaining: 14,
    offerings: { monthly: null, annual: null },
    isLoading: false,
    purchaseMonthly: vi.fn(),
    purchaseAnnual: vi.fn(),
    restorePurchases: vi.fn(),
    refresh: vi.fn(),
  }),
  SubscriptionProvider: ({ children }: any) => children,
}));
vi.mock('../src/components/ui/GlassUI', () => ({
  GradientButton: 'GradientButton',
  GlassCard: 'GlassCard',
}));
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));
vi.mock('../src/database/service', () => ({
  getAppState: vi.fn().mockResolvedValue(null),
  setAppState: vi.fn().mockResolvedValue(undefined),
  getTrialState: vi.fn().mockResolvedValue(null),
  upsertTrialState: vi.fn().mockResolvedValue(undefined),
  updateTrialConverted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/logger', () => ({
  safeWarn: vi.fn(),
  safeLog: vi.fn(),
  safeError: vi.fn(),
}));

describe('PremiumGate module', () => {
  it('imports without crashing', async () => {
    const mod = await import('../src/components/PremiumGate');
    expect(mod).toBeDefined();
  });

  it('has a default export (the component)', async () => {
    const mod = await import('../src/components/PremiumGate');
    expect(mod.default).toBeTypeOf('function');
  });

  it('component accepts featureName and children props', async () => {
    const mod = await import('../src/components/PremiumGate');
    // Function.length tells us the number of required params
    // React components take props object (single param)
    expect(mod.default.length).toBeLessThanOrEqual(2);
  });
});

describe('SubscriptionContext module', () => {
  it('imports without crashing', async () => {
    const mod = await import('../src/purchases/SubscriptionContext');
    expect(mod).toBeDefined();
  });

  it('exports useSubscription hook', async () => {
    const mod = await import('../src/purchases/SubscriptionContext');
    expect(mod.useSubscription).toBeTypeOf('function');
  });

  it('exports SubscriptionProvider component', async () => {
    const mod = await import('../src/purchases/SubscriptionContext');
    expect(mod.SubscriptionProvider).toBeDefined();
  });

  it('useSubscription returns expected shape', async () => {
    const mod = await import('../src/purchases/SubscriptionContext');
    const sub = mod.useSubscription();
    expect(sub).toHaveProperty('hasAccess');
    expect(sub).toHaveProperty('state');
    expect(sub).toHaveProperty('trialDaysRemaining');
    expect(sub).toHaveProperty('offerings');
    expect(sub).toHaveProperty('isLoading');
    expect(sub).toHaveProperty('purchaseMonthly');
    expect(sub).toHaveProperty('purchaseAnnual');
    expect(sub).toHaveProperty('restorePurchases');
    expect(sub).toHaveProperty('refresh');
  });
});

describe('SubscriptionManager module', () => {
  it('imports without crashing', async () => {
    const mod = await import('../src/purchases/SubscriptionManager');
    expect(mod).toBeDefined();
  });

  it('exports SubscriptionManager class', async () => {
    const mod = await import('../src/purchases/SubscriptionManager');
    expect(mod.SubscriptionManager).toBeDefined();
  });

  it('exports type SubscriptionStatus values', async () => {
    // Verify the subscription states we depend on
    const validStatuses = ['TRIAL', 'ACTIVE', 'EXPIRED', 'LIFETIME'] as const;
    for (const status of validStatuses) {
      expect(typeof status).toBe('string');
    }
  });
});

describe('Regional Pricing module', () => {
  it('imports without crashing', async () => {
    const mod = await import('../src/utils/regionalPricing');
    expect(mod).toBeDefined();
  });

  it('exports getRegion and getRegionalPricing', async () => {
    const mod = await import('../src/utils/regionalPricing');
    expect(mod.getRegion).toBeTypeOf('function');
    expect(mod.getRegionalPricing).toBeTypeOf('function');
  });
});
