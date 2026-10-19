/**
 * ZarinPal payment gateway (v4 REST) + deposit ledger integration.
 * Docs: https://docs.zarinpal.com
 *
 * The user supplies their own merchant ID in Settings (toggle-able gateway).
 * Flow: request() -> open StartPay URL in browser -> user pays -> verify()
 * (The app stores the pending authority and verifies on "check payment".)
 */
import { httpJson } from '../http';

export interface ZarinRequestResult {
  ok: boolean;
  authority?: string;
  startUrl?: string;
  message?: string;
}

const PROD = 'https://payment.zarinpal.com';
const SANDBOX = 'https://sandbox.zarinpal.com';

export function zarinBase(sandbox: boolean): string {
  return sandbox ? SANDBOX : PROD;
}

export async function zarinRequest(params: {
  merchantId: string;
  amountToman: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  sandbox?: boolean;
}): Promise<ZarinRequestResult> {
  const base = zarinBase(!!params.sandbox);
  try {
    const data = await httpJson<{
      data?: { code?: number; authority?: string; message?: string };
      errors?: unknown;
    }>(`${base}/pg/v4/payment/request.json`, {
      method: 'POST',
      body: {
        merchant_id: params.merchantId,
        amount: params.amountToman * 10, // API expects Rial
        description: params.description,
        callback_url: params.callbackUrl,
        metadata: params.mobile ? { mobile: params.mobile } : undefined,
      },
      timeoutMs: 15000,
    });
    const d = data?.data;
    if (d?.code === 100 && d.authority) {
      return { ok: true, authority: d.authority, startUrl: `${base}/pg/StartPay/${d.authority}` };
    }
    return { ok: false, message: d?.message || 'request failed' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network error' };
  }
}

export async function zarinVerify(params: {
  merchantId: string;
  amountToman: number;
  authority: string;
  sandbox?: boolean;
}): Promise<{ ok: boolean; refId?: string; message?: string }> {
  const base = zarinBase(!!params.sandbox);
  try {
    const data = await httpJson<{ data?: { code?: number; ref_id?: number; message?: string } }>(
      `${base}/pg/v4/payment/verify.json`,
      {
        method: 'POST',
        body: { merchant_id: params.merchantId, amount: params.amountToman * 10, authority: params.authority },
        timeoutMs: 15000,
      }
    );
    const code = data?.data?.code;
    if (code === 100 || code === 101) {
      return { ok: true, refId: String(data?.data?.ref_id ?? '') };
    }
    return { ok: false, message: data?.data?.message || `code ${code}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network error' };
  }
}
