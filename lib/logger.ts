/**
 * 프로젝트 공용 로거.
 * CLAUDE.md 규칙에 따라 `console.log` 를 직접 쓰지 않고 이 로거를 사용한다.
 * 콘솔 호출을 한 곳으로 모아 두어 추후 외부 로깅 서비스로 교체하기 쉽게 한다.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 구조화된 로그 한 줄을 출력한다.
 * @param level 로그 레벨
 * @param message 사람이 읽는 메시지
 * @param meta 부가 컨텍스트(선택)
 */
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry);

  // 콘솔 사용은 이 파일에서만 허용되는 단일 지점이다.
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
