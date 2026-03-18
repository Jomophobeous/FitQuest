/**
 * Regional Pricing Utility
 * 
 * Provides locale-based pricing fallbacks when RevenueCat offerings
 * are not yet loaded or unavailable. Actual store prices from RevenueCat
 * always take precedence.
 */

import { Platform, NativeModules } from 'react-native';

export type PricingRegion = 'africa' | 'europe' | 'north_america' | 'south_america' | 'asia' | 'oceania' | 'middle_east';

interface RegionalPrice {
  monthly: string;
  annual: string;
  monthlyPerMonth: string;
  currencySymbol: string;
  region: PricingRegion;
  regionLabel: string;
}

const PRICING_TABLE: Record<PricingRegion, RegionalPrice> = {
  africa: {
    monthly: '$2.69',
    annual: '$24.21',
    monthlyPerMonth: '$2.02',
    currencySymbol: '$',
    region: 'africa',
    regionLabel: 'Africa',
  },
  europe: {
    monthly: '€5.99',
    annual: '€53.99',
    monthlyPerMonth: '€4.50',
    currencySymbol: '€',
    region: 'europe',
    regionLabel: 'Europe',
  },
  north_america: {
    monthly: '$8.99',
    annual: '$80.91',
    monthlyPerMonth: '$6.74',
    currencySymbol: '$',
    region: 'north_america',
    regionLabel: 'North America',
  },
  south_america: {
    monthly: '$4.49',
    annual: '$40.41',
    monthlyPerMonth: '$3.37',
    currencySymbol: '$',
    region: 'south_america',
    regionLabel: 'South America',
  },
  asia: {
    monthly: '$3.99',
    annual: '$35.91',
    monthlyPerMonth: '$2.99',
    currencySymbol: '$',
    region: 'asia',
    regionLabel: 'Asia',
  },
  oceania: {
    monthly: 'A$9.49',
    annual: 'A$85.41',
    monthlyPerMonth: 'A$7.12',
    currencySymbol: 'A$',
    region: 'oceania',
    regionLabel: 'Oceania',
  },
  middle_east: {
    monthly: '$4.99',
    annual: '$44.91',
    monthlyPerMonth: '$3.74',
    currencySymbol: '$',
    region: 'middle_east',
    regionLabel: 'Middle East',
  },
};

// Map country codes to regions
const COUNTRY_TO_REGION: Record<string, PricingRegion> = {
  // Africa
  ZA: 'africa', NG: 'africa', KE: 'africa', GH: 'africa', TZ: 'africa',
  UG: 'africa', ET: 'africa', EG: 'africa', MA: 'africa', DZ: 'africa',
  TN: 'africa', SN: 'africa', CM: 'africa', CI: 'africa', BW: 'africa',
  MZ: 'africa', ZW: 'africa', NA: 'africa', RW: 'africa', MW: 'africa',
  // Europe
  GB: 'europe', DE: 'europe', FR: 'europe', ES: 'europe', IT: 'europe',
  NL: 'europe', BE: 'europe', PT: 'europe', SE: 'europe', NO: 'europe',
  DK: 'europe', FI: 'europe', AT: 'europe', CH: 'europe', IE: 'europe',
  PL: 'europe', CZ: 'europe', RO: 'europe', HU: 'europe', GR: 'europe',
  HR: 'europe', BG: 'europe', SK: 'europe', LT: 'europe', LV: 'europe',
  EE: 'europe', SI: 'europe', LU: 'europe', MT: 'europe', CY: 'europe',
  UA: 'europe', RU: 'europe', TR: 'europe',
  // North America
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  // South America
  BR: 'south_america', AR: 'south_america', CL: 'south_america',
  CO: 'south_america', PE: 'south_america', VE: 'south_america',
  EC: 'south_america', UY: 'south_america', PY: 'south_america',
  BO: 'south_america',
  // Asia
  CN: 'asia', JP: 'asia', KR: 'asia', IN: 'asia', ID: 'asia',
  TH: 'asia', VN: 'asia', PH: 'asia', MY: 'asia', SG: 'asia',
  PK: 'asia', BD: 'asia', LK: 'asia', MM: 'asia', KH: 'asia',
  NP: 'asia', TW: 'asia', HK: 'asia',
  // Oceania
  AU: 'oceania', NZ: 'oceania',
  // Middle East
  AE: 'middle_east', SA: 'middle_east', QA: 'middle_east',
  KW: 'middle_east', BH: 'middle_east', OM: 'middle_east',
  JO: 'middle_east', LB: 'middle_east', IQ: 'middle_east',
  IL: 'middle_east', IR: 'middle_east',
};

/**
 * Detect the user's country code from device locale.
 */
function getDeviceCountryCode(): string {
  try {
    let locale = '';
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        '';
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    }
    // Locale format: en_US, en-ZA, pt-BR, etc.
    const parts = locale.replace('-', '_').split('_');
    if (parts.length >= 2) {
      return parts[parts.length - 1]!.toUpperCase();
    }
    return 'US';
  } catch {
    return 'US';
  }
}

/**
 * Get the pricing region for the current device.
 */
export function getRegion(): PricingRegion {
  const country = getDeviceCountryCode();
  return COUNTRY_TO_REGION[country] || 'north_america';
}

/**
 * Get regional pricing fallbacks for display.
 * Note: Actual RevenueCat prices always take precedence.
 */
export function getRegionalPricing(): RegionalPrice {
  const region = getRegion();
  return PRICING_TABLE[region];
}
