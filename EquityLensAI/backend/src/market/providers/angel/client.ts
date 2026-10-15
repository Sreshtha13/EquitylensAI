import * as OTPAuth from 'otpauth';
import { parseEnv } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import { AppError } from '../../../utils/appError.js';

export type AngelSession = {
  jwtToken: string;
  refreshToken: string;
  feedToken?: string | undefined;
  expiresAt: number;
};

export type AngelQuoteItem = {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  lastTradeQty?: number;
  exchFeedTime?: string;
  exchTradeTime?: string;
  netChange: number;
  percentChange: number;
  avgPrice?: number;
  tradeVolume?: number;
  opnInterest?: number;
  lowerCircuit?: number;
  upperCircuit?: number;
  totBuyQuan?: number;
  totSellQuan?: number;
  '52WeekLow'?: number;
  '52WeekHigh'?: number;
};

export class AngelClient {
  private session: AngelSession | null = null;
  private loginPromise: Promise<AngelSession> | null = null;

  isConfigured(): boolean {
    const env = parseEnv();
    return Boolean(
      env.ANGEL_API_KEY &&
      env.ANGEL_CLIENT_ID &&
      env.ANGEL_PASSWORD &&
      env.ANGEL_TOTP_SECRET
    );
  }

  private async getActiveSession(): Promise<AngelSession> {
    const now = Date.now();
    // Re-use session if it has at least 5 minutes before expiry
    if (this.session && this.session.expiresAt > now + 5 * 60 * 1000) {
      return this.session;
    }

    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = this.login();
    try {
      const session = await this.loginPromise;
      this.session = session;
      return session;
    } finally {
      this.loginPromise = null;
    }
  }

  private async login(): Promise<AngelSession> {
    const env = parseEnv();
    if (!this.isConfigured()) {
      throw new AppError(
        'ANGEL_AUTH_CONFIG_MISSING',
        'Angel One credentials are not configured in environment',
        503
      );
    }

    const secret = env.ANGEL_TOTP_SECRET!.trim();
    const totp = new OTPAuth.TOTP({
      issuer: 'AngelOne',
      label: 'EquityLensAI',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const totpToken = totp.generate();

    const response = await fetch(
      'https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': 'fe80::1',
          'X-PrivateKey': env.ANGEL_API_KEY!,
        },
        body: JSON.stringify({
          clientcode: env.ANGEL_CLIENT_ID!,
          password: env.ANGEL_PASSWORD!,
          totp: totpToken,
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const json = (await response.json()) as {
      status: boolean;
      message?: string;
      errorcode?: string;
      data?: {
        jwtToken: string;
        refreshToken: string;
        feedToken?: string;
      };
    };

    if (!json.status || !json.data?.jwtToken) {
      logger.error({ response: json }, 'Angel One login failed');
      throw new AppError(
        'ANGEL_AUTH_FAILED',
        `Angel One login failed: ${json.message || json.errorcode || 'Unknown error'}`,
        502
      );
    }

    // Angel JWT tokens typically last ~18 hours
    const expiresAt = Date.now() + 16 * 60 * 60 * 1000;

    return {
      jwtToken: json.data.jwtToken,
      refreshToken: json.data.refreshToken,
      feedToken: json.data.feedToken,
      expiresAt,
    };
  }

  async getQuotes(exchange: string, tokens: string[]): Promise<AngelQuoteItem[]> {
    const env = parseEnv();
    const session = await this.getActiveSession();

    const response = await fetch(
      'https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': 'fe80::1',
          'X-PrivateKey': env.ANGEL_API_KEY!,
          Authorization: `Bearer ${session.jwtToken}`,
        },
        body: JSON.stringify({
          mode: 'FULL',
          exchangeTokens: {
            [exchange]: tokens,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const json = (await response.json()) as {
      status: boolean;
      message?: string;
      errorcode?: string;
      data?: {
        fetched?: AngelQuoteItem[];
        unfetched?: unknown[];
      };
    };

    if (!json.status || !json.data?.fetched) {
      throw new AppError(
        'ANGEL_QUOTE_ERROR',
        `Angel One quote request failed: ${json.message || json.errorcode || 'Unknown error'}`,
        502
      );
    }

    return json.data.fetched;
  }

  async getCandles(params: {
    exchange: string;
    token: string;
    interval: string;
    fromDate: string;
    toDate: string;
  }): Promise<[string, number, number, number, number, number][]> {
    const env = parseEnv();
    const session = await this.getActiveSession();

    const response = await fetch(
      'https://apiconnect.angelbroking.com/rest/secure/angelbroking/historical/v1/getCandleData',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': 'fe80::1',
          'X-PrivateKey': env.ANGEL_API_KEY!,
          Authorization: `Bearer ${session.jwtToken}`,
        },
        body: JSON.stringify({
          exchange: params.exchange,
          symboltoken: params.token,
          interval: params.interval,
          fromdate: params.fromDate,
          todate: params.toDate,
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const json = (await response.json()) as {
      status: boolean;
      message?: string;
      errorcode?: string;
      data?: [string, number, number, number, number, number][];
    };

    if (!json.status || !json.data) {
      throw new AppError(
        'ANGEL_HISTORICAL_ERROR',
        `Angel One historical data failed: ${json.message || json.errorcode || 'Unknown error'}`,
        502
      );
    }

    return json.data;
  }
}

export const angelClient = new AngelClient();
