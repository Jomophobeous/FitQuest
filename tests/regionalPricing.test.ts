import { describe, expect, it, vi, beforeEach } from 'vitest';

// Hoisted mocks must be declared with vi.hoisted to avoid TDZ
const { mockPlatform, mockNativeModules } = vi.hoisted(() => {
  const mockPlatform = { OS: 'android' as 'android' | 'ios' };
  const mockNativeModules: Record<string, any> = {
    I18nManager: { localeIdentifier: 'en_US' },
    SettingsManager: { settings: { AppleLocale: 'en_US' } },
  };
  return { mockPlatform, mockNativeModules };
});

vi.mock('react-native', () => ({
  Platform: mockPlatform,
  NativeModules: mockNativeModules,
}));

import { getRegion, getRegionalPricing } from '../src/utils/regionalPricing';

describe('Regional Pricing', () => {
  beforeEach(() => {
    mockPlatform.OS = 'android';
    mockNativeModules.I18nManager = { localeIdentifier: 'en_US' };
    mockNativeModules.SettingsManager = { settings: { AppleLocale: 'en_US' } };
  });

  describe('getRegion', () => {
    it('defaults to north_america for US locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_US' };
      expect(getRegion()).toBe('north_america');
    });

    it('detects South Africa as africa region', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_ZA' };
      expect(getRegion()).toBe('africa');
    });

    it('detects Nigeria as africa', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_NG' };
      expect(getRegion()).toBe('africa');
    });

    it('detects Germany as europe', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'de_DE' };
      expect(getRegion()).toBe('europe');
    });

    it('detects Japan as asia', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'ja_JP' };
      expect(getRegion()).toBe('asia');
    });

    it('detects Brazil as south_america', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'pt_BR' };
      expect(getRegion()).toBe('south_america');
    });

    it('detects Australia as oceania', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_AU' };
      expect(getRegion()).toBe('oceania');
    });

    it('detects UAE as middle_east', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'ar_AE' };
      expect(getRegion()).toBe('middle_east');
    });

    it('detects Canada as north_america', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_CA' };
      expect(getRegion()).toBe('north_america');
    });

    it('handles hyphenated locale format (en-ZA)', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en-ZA' };
      expect(getRegion()).toBe('africa');
    });

    it('falls back to north_america for unknown country', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_XX' };
      expect(getRegion()).toBe('north_america');
    });

    it('falls back to north_america when locale has no country', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en' };
      expect(getRegion()).toBe('north_america');
    });

    it('falls back to north_america when locale is empty', () => {
      mockNativeModules.I18nManager = { localeIdentifier: '' };
      expect(getRegion()).toBe('north_america');
    });

    it('uses iOS AppleLocale on iOS platform', () => {
      mockPlatform.OS = 'ios';
      mockNativeModules.SettingsManager = { settings: { AppleLocale: 'en_GB' } };
      expect(getRegion()).toBe('europe');
    });

    it('uses iOS AppleLanguages fallback when AppleLocale missing', () => {
      mockPlatform.OS = 'ios';
      mockNativeModules.SettingsManager = { settings: { AppleLanguages: ['fr_FR'] } };
      expect(getRegion()).toBe('europe');
    });

    it('handles NativeModules being undefined gracefully', () => {
      mockNativeModules.I18nManager = undefined;
      expect(getRegion()).toBe('north_america');
    });

    // Spot-check many countries across regions
    const regionCountries: Array<[string, string]> = [
      ['KE', 'africa'], ['GH', 'africa'], ['EG', 'africa'], ['BW', 'africa'],
      ['GB', 'europe'], ['FR', 'europe'], ['PL', 'europe'], ['TR', 'europe'],
      ['MX', 'north_america'],
      ['AR', 'south_america'], ['CL', 'south_america'], ['CO', 'south_america'],
      ['IN', 'asia'], ['KR', 'asia'], ['SG', 'asia'], ['TW', 'asia'],
      ['NZ', 'oceania'],
      ['SA', 'middle_east'], ['QA', 'middle_east'], ['IL', 'middle_east'],
    ];

    it.each(regionCountries)('maps country %s to region %s', (country, expectedRegion) => {
      mockNativeModules.I18nManager = { localeIdentifier: `en_${country}` };
      expect(getRegion()).toBe(expectedRegion);
    });
  });

  describe('getRegionalPricing', () => {
    it('returns africa pricing for ZA locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_ZA' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('africa');
      expect(pricing.monthly).toBe('$2.69');
      expect(pricing.annual).toBe('$24.21');
      expect(pricing.monthlyPerMonth).toBe('$2.02');
      expect(pricing.regionLabel).toBe('Africa');
    });

    it('returns europe pricing for GB locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_GB' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('europe');
      expect(pricing.monthly).toBe('€5.99');
      expect(pricing.currencySymbol).toBe('€');
    });

    it('returns north_america pricing for US locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_US' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('north_america');
      expect(pricing.monthly).toBe('$8.99');
    });

    it('returns oceania pricing for AU locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'en_AU' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('oceania');
      expect(pricing.currencySymbol).toBe('A$');
      expect(pricing.monthly).toBe('A$9.49');
    });

    it('returns middle_east pricing for AE locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'ar_AE' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('middle_east');
      expect(pricing.monthly).toBe('$4.99');
    });

    it('returns asia pricing for JP locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'ja_JP' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('asia');
      expect(pricing.monthly).toBe('$3.99');
    });

    it('returns south_america pricing for BR locale', () => {
      mockNativeModules.I18nManager = { localeIdentifier: 'pt_BR' };
      const pricing = getRegionalPricing();
      expect(pricing.region).toBe('south_america');
      expect(pricing.monthly).toBe('$4.49');
    });

    it('all regions have consistent pricing structure', () => {
      const regions = ['africa', 'europe', 'north_america', 'south_america', 'asia', 'oceania', 'middle_east'];
      const countryForRegion: Record<string, string> = {
        africa: 'ZA', europe: 'GB', north_america: 'US',
        south_america: 'BR', asia: 'JP', oceania: 'AU', middle_east: 'AE',
      };

      for (const region of regions) {
        mockNativeModules.I18nManager = { localeIdentifier: `en_${countryForRegion[region]}` };
        const pricing = getRegionalPricing();
        expect(pricing.monthly).toBeTruthy();
        expect(pricing.annual).toBeTruthy();
        expect(pricing.monthlyPerMonth).toBeTruthy();
        expect(pricing.currencySymbol).toBeTruthy();
        expect(pricing.region).toBe(region);
        expect(pricing.regionLabel).toBeTruthy();
      }
    });

    it('annual monthly-equivalent is cheaper than monthly', () => {
      // Africa: monthly $2.69, annualPerMonth $2.02
      mockNativeModules.I18nManager = { localeIdentifier: 'en_ZA' };
      const pricing = getRegionalPricing();
      const monthlyNum = parseFloat(pricing.monthly.replace(/[^0-9.]/g, ''));
      const annualPerMonthNum = parseFloat(pricing.monthlyPerMonth.replace(/[^0-9.]/g, ''));
      expect(annualPerMonthNum).toBeLessThan(monthlyNum);
    });
  });
});
