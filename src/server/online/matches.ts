import type postgres from 'postgres';
import type { OnlineRaceSnapshot } from '../../game/online/contracts';
import { ONLINE_SIMULATION_VERSION } from '../../game/online/contracts';
import { eloDelta, ONLINE_REWARD_POLICY, rankCategory } from '../../game/online/economy';
import { ONLINE_CATALOG_VERSION } from '../../game/online/preparation';
import { digest, type OnlineGarage } from './garage';
import { OnlineError } from './OnlineError';

export type RaceBuild = Awaited<ReturnType<OnlineGarage['raceBuild']>>;
type Outcome = keyof typeof ONLINE_REWARD_POLICY.rewards;

export interface OnlineAward {
  outcome: Outcome;
  cr: number;
  rp: number;
  pp: number;
  ppBefore: number;
  ppAfter: number;
  crAfter?: number;
  rpAfter?: number;
  reason: string | null;
}

export class OnlineMatches {
  private readonly sql: postgres.Sql;

  constructor(private readonly garage: OnlineGarage) { this.sql = garage.sql; }

  async recoverInterrupted(): Promise<void> {
    await this.sql.begin(async (tx) => {
      const missing = await tx<{ id: string }[]>`update online_matches set status = 'cancelled', finished_at = now(), cancellation_reason = 'reinicialização'
        where status = 'running' returning id`;
      if (missing.length) await tx`update online_match_players set outcome = 'cancelled' where match_id in ${tx(missing.map(({ id }) => id))}`;
    });
  }

  async start(matchId: string, trackId: string, seed: number, users: [string, string], cars: [string | undefined, string | undefined]): Promise<[RaceBuild, RaceBuild]> {
    if (users[0] === users[1]) throw new OnlineError(409, 'Uma partida exige duas contas distintas.');
    return this.sql.begin(async (tx) => {
      // Same user order as finalization and garage edits. Snapshot reads follow any in-flight mutation.
      await tx`select user_id from online_profiles where user_id in ${tx(users)} order by user_id for update`;
      const builds: [RaceBuild, RaceBuild] = [await this.garage.raceBuild(tx, users[0], cars[0]), await this.garage.raceBuild(tx, users[1], cars[1])];
      await tx`insert into online_matches (id, status, track_id, distance_id, seed, simulation_version, catalog_version, reward_policy_version)
        values (${matchId}, 'running', ${trackId}, 'quarter', ${seed}, ${ONLINE_SIMULATION_VERSION}, ${ONLINE_CATALOG_VERSION}, ${ONLINE_REWARD_POLICY.version})`;
      for (const lane of [0, 1] as const) {
        const build = builds[lane];
        await tx`insert into online_match_players (match_id, user_id, car_id, build_snapshot, build_hash, lane)
          values (${matchId}, ${users[lane]}, ${build.carId}, ${tx.json({ ...build })}, ${digest(build)}, ${lane})`;
      }
      return builds;
    });
  }

  async finish(matchId: string, snapshot: OnlineRaceSnapshot | null, forfeitLane: 0 | 1 | null, cancellationReason?: string): Promise<OnlineAward[]> {
    return this.sql.begin(async (tx) => {
      const [match] = await tx<{ status: string }[]>`select status from online_matches where id = ${matchId} for update`;
      if (!match) return [];
      const players = await tx<{
        user_id: string; car_id: string; lane: 0 | 1; outcome: Outcome | null; cr_reward: number;
        rp_delta: number; pp_reward: number; reward_reason: string | null;
        details: { ppBefore?: number; ppAfter?: number; crAfter?: number; rpAfter?: number } | null;
      }[]>`select user_id, car_id, lane, outcome, cr_reward, rp_delta, pp_reward, reward_reason, details
        from online_match_players where match_id = ${matchId} order by lane`;
      if (match.status !== 'running') return players.map((player) => ({
        outcome: player.outcome ?? 'cancelled', cr: player.cr_reward, rp: player.rp_delta, pp: player.pp_reward,
        ppBefore: player.details?.ppBefore ?? 0, ppAfter: player.details?.ppAfter ?? 0,
        crAfter: player.details?.crAfter, rpAfter: player.details?.rpAfter, reason: player.reward_reason,
      }));
      if (players.length !== 2) throw new Error(`Partida ${matchId} sem duas faixas persistidas.`);
      if (snapshot && snapshot.matchId !== matchId) throw new Error('Resultado de outra partida.');
      const users = players.map((player) => player.user_id);
      await tx`select user_id from online_profiles where user_id in ${tx(users)} order by user_id for update`;
      const ratings = await tx<{ user_id: string; rp: number }[]>`select user_id, rp from online_ratings where user_id in ${tx(users)}`;
      const rating = (lane: number) => ratings.find((entry) => entry.user_id === users[lane])!.rp;
      const cancelled = cancellationReason !== undefined;
      if (!cancelled && forfeitLane === null && snapshot?.phase !== 'finished') throw new Error('Resultado incompleto.');
      const winner = cancelled ? null : forfeitLane === null ? (snapshot?.winner ?? null) : 1 - forfeitLane;
      const participated = (lane: number) => {
        const result = snapshot?.lanes[lane]?.result;
        return !!result && (result.rt !== null || result.dnfReason === 'engine-blown');
      };
      const noParticipation = !participated(0) && !participated(1);
      const rated = !cancelled && (!noParticipation || forfeitLane !== null);
      const change = rated ? eloDelta(rating(0), rating(1), winner === null ? 0.5 : winner === 0 ? 1 : 0) : 0;

      const repeated = await tx<{ winner_user_id: string | null }[]>`select m.winner_user_id
        from online_matches m join online_match_players a on a.match_id = m.id and a.user_id = ${users[0]!}
        join online_match_players b on b.match_id = m.id and b.user_id = ${users[1]!}
        where m.status = 'completed' and m.finished_at > now() - interval '1 hour' order by m.finished_at desc limit 12`;
      if (repeated.length >= 8) {
        const winners = [winner === null ? null : users[winner]!, ...repeated.map((item) => item.winner_user_id)];
        const exchanges = winners.slice(1).filter((current, i) => !!current && !!winners[i] && current !== winners[i]).length;
        console.info('online-repeat-pair', { matchId, races: winners.length, consecutiveWinnerChanges: exchanges });
      }
      const holds = await tx<{ user_id: string; reward_percent: number; reason: string }[]>`
        select user_id, reward_percent, reason from online_reward_holds where user_id in ${tx(users)} and expires_at > now()`;

      const awards: OnlineAward[] = [];
      for (const player of players) {
        const { lane, car_id: carId, user_id: userId } = player;
        const outcome: Outcome = cancelled ? 'cancelled' : forfeitLane === lane ? 'forfeit' : winner === null ? 'draw' : winner === lane ? 'win' : 'loss';
        const rp = lane === 0 ? change : -change;
        const hold = holds.find((item) => item.user_id === userId);
        const suppressed = !participated(lane) && outcome !== 'forfeit';
        const reason = cancelled ? cancellationReason : suppressed ? 'sem participação efetiva' : hold?.reason ?? null;
        const percent = cancelled || suppressed ? 0 : hold?.reward_percent ?? 100;
        const reward = ONLINE_REWARD_POLICY.rewards[outcome];
        const cr = Math.floor(reward.cr * percent / 100);
        const pp = Math.floor(reward.pp * percent / 100);
        const win = Number(rated && outcome === 'win');
        const loss = Number(rated && (outcome === 'loss' || outcome === 'forfeit'));
        const draw = Number(rated && outcome === 'draw');
        const [wallet] = await tx<{ cr_balance: number }[]>`update online_wallets set cr_balance = cr_balance + ${cr}, version = version + 1, updated_at = now()
          where user_id = ${userId} returning cr_balance`;
        const [stats] = await tx<{ rp: number }[]>`update online_ratings set rp = rp + ${rp}, highest_rp = greatest(highest_rp, rp + ${rp}),
          wins = wins + ${win}, losses = losses + ${loss}, draws = draws + ${draw},
          win_streak = case when ${!rated} then win_streak when ${win} = 1 then win_streak + 1 else 0 end, updated_at = now()
          where user_id = ${userId} returning rp`;
        const [progress] = await tx<{ pp_balance: number }[]>`update online_car_progression set pp_balance = pp_balance + ${pp}, pp_earned_total = pp_earned_total + ${pp},
          wins = wins + ${win}, losses = losses + ${loss}, draws = draws + ${draw}, updated_at = now() where car_id = ${carId} returning pp_balance`;
        const ppAfter = progress!.pp_balance;
        const ppBefore = ppAfter - pp;
        const result = snapshot?.lanes[lane].result;
        await tx`update online_match_players set outcome = ${outcome}, cr_reward = ${cr}, pp_reward = ${pp}, rp_delta = ${rp}, reward_reason = ${reason ?? null},
          reaction_time = ${result?.rt ?? null}, elapsed_time = ${result?.et ?? null}, total_time = ${result?.total ?? null}, trap_speed = ${result?.trapMs ?? null},
          details = ${tx.json({ ...result, ppBefore, ppAfter, crAfter: wallet!.cr_balance, rpAfter: stats!.rp })} where match_id = ${matchId} and lane = ${lane}`;
        if (!cancelled) {
          await tx`insert into online_currency_ledger (user_id, car_id, currency, amount, balance_after, reason, reference_id, idempotency_key)
            values (${userId}, ${carId}, 'CR', ${cr}, ${wallet!.cr_balance}, ${outcome}, ${matchId}, ${matchId}),
                   (${userId}, null, 'RP', ${rp}, ${stats!.rp}, ${outcome}, ${matchId}, ${matchId}),
                   (${userId}, ${carId}, 'PP', ${pp}, ${ppAfter}, ${outcome}, ${matchId}, ${matchId})`;
        }
        awards.push({ outcome, cr, rp, pp, ppBefore, ppAfter, crAfter: wallet!.cr_balance, rpAfter: stats!.rp, reason: reason ?? null });
      }
      await tx`update online_matches set status = ${cancelled ? 'cancelled' : 'completed'}, finished_at = now(),
        winner_user_id = ${winner === null ? null : users[winner]!}, cancellation_reason = ${cancellationReason ?? null} where id = ${matchId}`;
      return awards;
    });
  }

  async ranking(userId: string, offset: number) {
    const rows = await this.sql<{ nickname: string; rp: number; highest_rp: number; wins: number; losses: number;
      draws: number; total_races: number; win_streak: number; position: number; mine: boolean }[]>`
      with listing as (select p.nickname, r.rp, r.highest_rp, r.wins, r.losses, r.draws, r.total_races,
        r.win_streak, row_number() over (order by r.rp desc, r.wins desc, r.user_id)::int as position,
        r.user_id = ${userId} as mine from online_ratings r join online_profiles p using (user_id))
      select * from listing where (position > ${offset} and position <= ${offset + 25}) or mine order by position`;
    return { entries: rows.filter((row) => row.position > offset && row.position <= offset + 25).map((row) => ({ ...row, category: rankCategory(row.rp) })),
      ownPosition: rows.find((row) => row.mine)?.position ?? null };
  }

  async history(userId: string, offset: number, carId: string | undefined) {
    return this.sql`select m.id, m.finished_at, m.track_id, m.distance_id, p.car_id, p.outcome, p.details,
      p.cr_reward, p.rp_delta, p.pp_reward, p.reward_reason, p.build_snapshot->>'name' as nickname,
      rival.build_snapshot->>'name' as opponent from online_match_players p join online_matches m on m.id = p.match_id
      left join online_match_players rival on rival.match_id = m.id and rival.lane <> p.lane
      where p.user_id = ${userId} and m.status <> 'running' and (${carId ?? null}::uuid is null or p.car_id = ${carId ?? null}::uuid)
      order by m.finished_at desc, m.id limit 25 offset ${offset}`;
  }
}
