/**
 * 앱 공용 로거 — console.log 직접 사용 금지 규칙(CLAUDE.md)의 대체.
 * scripts/crawl/lib/logger.mjs 패턴을 TS로 이식(타임스탬프 + 레벨 + 구조화 컨텍스트).
 */

type LogContext = Record<string, unknown>;

/** 한 줄 로그를 표준 출력/에러로 기록한다. */
function emit(level: 'INFO' | 'WARN' | 'ERROR', message: string, context?: LogContext): void {
  const line = `[${new Date().toISOString()}] ${level} ${message}${context ? ' ' + JSON.stringify(context) : ''}`;
  if (level === 'ERROR') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  /** 일반 진행 로그 */
  info(message: string, context?: LogContext): void {
    emit('INFO', message, context);
  },
  /** 폴백·재시도 등 주의 로그 */
  warn(message: string, context?: LogContext): void {
    emit('WARN', message, context);
  },
  /** 실패 로그 — 원인과 함께 남긴다 */
  error(message: string, context?: LogContext): void {
    emit('ERROR', message, context);
  },
};
