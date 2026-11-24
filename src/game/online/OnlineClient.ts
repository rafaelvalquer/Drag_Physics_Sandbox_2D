import { Client } from '@colyseus/sdk';
import { createClient } from '@supabase/supabase-js';
import { COMPETITIVE_ROOM, type GarageRequest, type Onboarding } from './contracts';
import type { OnlineGarage } from '../../server/online/garage';
import type { OnlineMatches } from '../../server/online/matches';

export type Garage = NonNullable<Awaited<ReturnType<OnlineGarage['get']>>>;
export type Ranking = Awaited<ReturnType<OnlineMatches['ranking']>>;
export type OnlineRoom = Awaited<ReturnType<Client['joinOrCreate']>>;

export class OnlineApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export interface HistoryRace {
  id: string;
  finished_at: string;
  nickname: string;
  opponent: string | null;
  outcome: 'win' | 'loss' | 'draw' | 'forfeit' | 'cancelled';
  cr_reward: number;
  rp_delta: number;
  pp_reward: number;
  reward_reason: string | null;
}

export class OnlineClient {
  private readonly auth: ReturnType<typeof createClient>;
  private readonly api: URL;
  private readonly network: Client;

  constructor() {
    const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      VITE_ONLINE_API_URL: api, VITE_ONLINE_WS_URL: websocket } = import.meta.env;
    if (!supabaseUrl || !publishableKey || !api || !websocket) throw new Error('O modo online ainda não foi configurado neste ambiente.');
    this.api = new URL(`${api.replace(/\/$/, '')}/v1/`);
    this.auth = createClient(supabaseUrl, publishableKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    });
    this.network = new Client(websocket);
  }

  async restore(): Promise<boolean> {
    const url = new URL(location.href);
    if (url.pathname.replace(/\/$/, '') === '/auth/callback') {
      history.replaceState(null, '', '/');
      const code = url.searchParams.get('code');
      if (!code) throw new Error('O Google não concluiu o acesso. Tente novamente.');
      const flowId = url.searchParams.get('sb_flow_id') ?? undefined;
      const { error } = await this.auth.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (error) throw new Error('Não foi possível concluir o login do Google. Tente novamente.');
    }
    return !!(await this.auth.auth.getSession()).data.session;
  }

  async login(): Promise<void> {
    const { error } = await this.auth.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: `${location.origin}/auth/callback`, scopes: 'openid email profile' },
    });
    if (error) throw new Error('Não foi possível abrir o login do Google.');
  }

  async logout(): Promise<void> {
    const { error } = await this.auth.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Não foi possível encerrar a sessão.');
    this.network.auth.token = '';
  }

  onSession(callback: (token: string | null) => void): () => void {
    const { data } = this.auth.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') callback(session?.access_token ?? null);
    });
    return () => data.subscription.unsubscribe();
  }

  async joinQueue(): Promise<OnlineRoom> {
    this.network.auth.token = await this.token();
    return this.network.joinOrCreate(COMPETITIVE_ROOM);
  }

  async token(): Promise<string> {
    const { data, error } = await this.auth.auth.getSession();
    if (error || !data.session) throw new Error('Sua sessão expirou. Entre com o Google novamente.');
    return data.session.access_token;
  }

  garage(): Promise<Garage | null> { return this.request('garage'); }
  setup(input: Onboarding): Promise<Garage> { return this.request('profile', input); }
  change(input: GarageRequest): Promise<{ carId: string }> { return this.request('garage', input); }
  ranking(offset: number): Promise<Ranking> { return this.request(`ranking?offset=${offset}`); }
  history(offset: number, carId?: string): Promise<HistoryRace[]> {
    const query = new URLSearchParams({ offset: String(offset) });
    if (carId) query.set('carId', carId);
    return this.request(`history?${query}`);
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const token = await this.token();
    const response = await fetch(new URL(path, this.api), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: string } | null;
      throw new OnlineApiError(response.status, detail?.error ?? 'O servidor online está indisponível.');
    }
    return response.json() as Promise<T>;
  }
}

let client: OnlineClient | undefined;
export function onlineClient(): OnlineClient { return client ??= new OnlineClient(); }
