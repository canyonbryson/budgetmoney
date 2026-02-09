import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose';

type PlaidEnv = 'sandbox' | 'development' | 'production';

function getPlaidBaseUrl() {
  const env = (process.env.PLAID_ENV ?? 'sandbox') as PlaidEnv;
  if (env === 'sandbox') return 'https://sandbox.plaid.com';
  if (env === 'development') return 'https://development.plaid.com';
  return 'https://production.plaid.com';
}

async function getWebhookVerificationKey(keyId: string) {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error('Missing Plaid credentials');
  }
  const response = await fetch(`${getPlaidBaseUrl()}/webhook_verification_key/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, key_id: keyId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Plaid webhook key error ${response.status}: ${text}`);
  }
  const json = await response.json();
  return json.key;
}

async function sha256Base64(payload: string) {
  const bytes = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(hashBuffer);
  let binary = '';
  for (const byte of hashBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function verifyPlaidWebhook(token: string, rawBody: string) {
  const header = decodeProtectedHeader(token);
  if (!header.kid) throw new Error('Missing kid');
  const jwk = await getWebhookVerificationKey(header.kid);
  const key = await importJWK(jwk, 'ES256');
  const { payload } = await jwtVerify(token, key);
  const expectedHash = payload.request_body_sha256 as string | undefined;
  if (!expectedHash) throw new Error('Missing request_body_sha256');
  const actualHash = await sha256Base64(rawBody);
  if (expectedHash !== actualHash) {
    throw new Error('Webhook body hash mismatch');
  }
}

const http = httpRouter();

http.route({
  path: '/webhooks/plaid',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const verification = request.headers.get('plaid-verification');
    if (!verification) {
      return new Response('Missing verification header', { status: 400 });
    }
    try {
      await verifyPlaidWebhook(verification, rawBody);
    } catch (err) {
      return new Response('Invalid webhook signature', { status: 400 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const webhookType = body.webhook_type as string | undefined;
    const webhookCode = body.webhook_code as string | undefined;
    const itemId = body.item_id as string | undefined;

    if (webhookType === 'TRANSACTIONS' && webhookCode === 'SYNC_UPDATES_AVAILABLE' && itemId) {
      const item = await ctx.runQuery(internal.plaid.getItemByPlaidIdInternal, { plaidItemId: itemId });
      if (item) {
        await ctx.runAction(internal.plaid.syncTransactionsInternal, {
          ownerType: item.ownerType,
          ownerId: item.ownerId,
          plaidItemId: item.plaidItemId,
        });
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;

