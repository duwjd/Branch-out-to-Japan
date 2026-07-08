/**
 * 수집 스크립트용 최소 로거 유틸.
 * console.log 직접 사용 금지(코딩 컨벤션) → 이 유틸로 통일한다.
 * 진단성 출력은 stderr로 보내 데이터(stdout)와 섞이지 않게 한다.
 */

/** @param {string} level @param {string} msg @param {unknown} [extra] */
function emit(level, msg, extra) {
  const ts = new Date().toISOString();
  const tail = extra === undefined ? '' : ` ${JSON.stringify(extra)}`;
  process.stderr.write(`[${ts}] ${level} ${msg}${tail}\n`);
}

export const logger = {
  /** @param {string} msg @param {unknown} [extra] */
  info: (msg, extra) => emit('INFO', msg, extra),
  /** @param {string} msg @param {unknown} [extra] */
  warn: (msg, extra) => emit('WARN', msg, extra),
  /** @param {string} msg @param {unknown} [extra] */
  error: (msg, extra) => emit('ERROR', msg, extra),
};
