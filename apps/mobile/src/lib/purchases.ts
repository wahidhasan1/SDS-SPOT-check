import { Platform } from 'react-native';
import { api } from './api';

/**
 * App-store subscriptions via RevenueCat. Purchases are verified server-side through the
 * RevenueCat webhook (and /billing/restore); the app never grants Premium on its own.
 */
const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const purchasesConfigured = Platform.OS !== 'web' && !!KEY;

let configured = false;
async function sdk(userId: string) {
  const Purchases = (await import('react-native-purchases')).default;
  if (!configured) {
    Purchases.configure({ apiKey: KEY!, appUserID: userId });
    configured = true;
  }
  return Purchases;
}

export async function buyPremium(userId: string): Promise<string> {
  if (!purchasesConfigured) throw new Error('In-app purchases are not configured in this build yet.');
  const Purchases = await sdk(userId);
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages[0];
  if (!pkg) throw new Error('No subscription products are available right now.');
  await Purchases.purchasePackage(pkg);
  // Ask the server to verify with RevenueCat; entitlement appears once verified.
  await api.post('/billing/restore').catch(() => undefined);
  return 'Purchase complete. Premium is activated once the store confirms your payment.';
}

export async function restorePurchases(userId: string): Promise<void> {
  if (purchasesConfigured) {
    const Purchases = await sdk(userId);
    await Purchases.restorePurchases();
  }
  await api.post('/billing/restore');
}
