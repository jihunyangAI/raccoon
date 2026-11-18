export interface ScoreEntry { name: string; score: number; stage: string; date: string }

export const MAX_SCORES = 10;
export const NAME_LENGTH = 3;
export const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** 이 점수가 들어갈 자리. 같은 점수는 먼저 낸 기록이 위. 순위 밖이면 -1 */
export function rankFor(list: ScoreEntry[], score: number): number {
  if (score <= 0) return -1;
  const i = list.findIndex((e) => e.score < score);
  const at = i < 0 ? list.length : i;
  return at < MAX_SCORES ? at : -1;
}

export function insertScore(list: ScoreEntry[], entry: ScoreEntry) {
  const rank = rankFor(list, entry.score);
  if (rank < 0) return { list, rank };
  return { list: [...list.slice(0, rank), entry, ...list.slice(rank)].slice(0, MAX_SCORES), rank };
}
