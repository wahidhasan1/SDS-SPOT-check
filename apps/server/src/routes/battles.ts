import type { FastifyInstance } from 'fastify';
import { BATTLE_TYPE_LABELS } from '@app/shared';
import { one, q } from '../db/pool';
import { requireAuth } from '../lib/auth';

export async function battleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/battles/types', async () => Object.entries(BATTLE_TYPE_LABELS).map(([id, label]) => ({ id, label })));

  app.get('/battles/leaderboard', async (req) => {
    // Only anonymous names are shown, and only for users who opted in.
    const top = await q<any>(
      `SELECT u.id, u.anon_name, u.avatar, p.battle_rating, p.battle_games FROM user_profiles p JOIN users u ON u.id=p.user_id
       WHERE p.show_on_leaderboard AND p.battle_games > 0 ORDER BY p.battle_rating DESC, p.battle_games DESC LIMIT 50`,
    );
    const me = await one<any>(
      `SELECT p.battle_rating, p.battle_games, p.show_on_leaderboard,
        (SELECT count(*)::int + 1 FROM user_profiles o WHERE o.show_on_leaderboard AND o.battle_games > 0 AND o.battle_rating > p.battle_rating) AS rank
       FROM user_profiles p WHERE p.user_id=$1`,
      [req.userId],
    );
    return {
      top: top.map((t, i) => ({ rank: i + 1, anonName: t.anon_name, avatar: t.avatar, rating: t.battle_rating, games: t.battle_games, isMe: t.id === req.userId })),
      me: { rating: me.battle_rating, games: me.battle_games, rank: me.battle_games > 0 && me.show_on_leaderboard ? me.rank : null, visible: me.show_on_leaderboard },
    };
  });

  app.get('/battles/history', async (req) =>
    q(
      `SELECT b.id, b.battle_type, b.ranked, b.status, b.created_at, me.score, me.correct_count, me.result, me.rating_before, me.rating_after,
              other.anon_name AS opponent_name, other.score AS opponent_score
       FROM battle_participants me JOIN battle_sessions b ON b.id=me.battle_id
       LEFT JOIN battle_participants other ON other.battle_id=me.battle_id AND other.seat<>me.seat
       WHERE me.user_id=$1 ORDER BY b.created_at DESC LIMIT 50`,
      [req.userId],
    ),
  );
}
