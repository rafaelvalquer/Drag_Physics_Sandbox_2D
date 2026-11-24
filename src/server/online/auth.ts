import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { OnlineError } from './OnlineError';

export interface OnlineIdentity {
  id: string;
  sessionId: string;
  expiresAtMs: number;
  avatarUrl: string | null;
}

export type Authenticate = (token: string | undefined) => Promise<OnlineIdentity>;

export function createAuthenticator(url: string, secretKey: string, issuer = `${url.replace(/\/$/, '')}/auth/v1`): Authenticate {
  const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (token) => {
    if (!token || token.length > 8_192) throw new OnlineError(401, 'Sessão ausente ou inválida.');
    const { data, error } = await supabase.auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims || claims.iss !== issuer || ![claims.aud].flat().includes('authenticated') ||
        claims.role !== 'authenticated' || claims.is_anonymous || claims.app_metadata?.provider !== 'google' ||
        !z.uuid().safeParse(claims.sub).success || !z.uuid().safeParse(claims.session_id).success ||
        !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || (claims.nbf ?? 0) * 1000 > Date.now()) {
      throw new OnlineError(401, 'Sessão Google inválida ou expirada.');
    }
    const picture = z.url({ protocol: /^https$/ }).max(2_048).safeParse(claims.user_metadata?.avatar_url);
    return { id: claims.sub, sessionId: claims.session_id, expiresAtMs: claims.exp * 1000, avatarUrl: picture.success ? picture.data : null };
  };
}
