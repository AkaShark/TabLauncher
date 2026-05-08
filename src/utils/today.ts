/**
 * "今日" 语义工具 (plan §OP-5):
 *   今日 = 截至当天本地时区 23:59:59 到期、且未完成的任务。
 *   未来 (dueDate > today 23:59:59) 与无 dueDate 的任务都不算今日。
 */

/**
 * Return the local end-of-today as epoch ms.
 * Exposed for testability — tests can stub `now`.
 */
export function endOfTodayMs(now: Date = new Date()): number {
  const d = new Date(now.getTime());
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Whether the given dueDate (TickTick ISO string) is due by end-of-today (local).
 * - undefined / null / empty → false (无 dueDate 不算今日)
 * - invalid date → false
 * - 过去 / 当天 → true
 * - 未来 → false
 */
export function isDueByEndOfToday(
  dueDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  const t = Date.parse(dueDate);
  if (Number.isNaN(t)) return false;
  return t <= endOfTodayMs(now);
}
