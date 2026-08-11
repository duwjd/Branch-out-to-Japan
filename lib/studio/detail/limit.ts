/**
 * 동시 실행 상한 — 신규 의존성 없이 20줄.
 *
 * 왜 Promise.all 전면 병렬이 아닌가: OpenAI images 엔드포인트는 tier별 분당 제한이 있어
 * 무제한 병렬은 429를 부른다. 반대로 순차는 이미지 5장이면 200~450초로 maxDuration=300 을 넘긴다.
 * 그래서 상한 4로 묶는다(SDK 자체 재시도와 조합하면 실사용상 안전).
 */

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export function limit(concurrency: number): Limiter {
  if (concurrency < 1) throw new Error('concurrency는 1 이상이어야 합니다.');
  let active = 0;
  const queue: (() => void)[] = [];

  const release = () => {
    active--;
    queue.shift()?.();
  };

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = async (): Promise<T> => {
      active++;
      try {
        return await fn();
      } finally {
        release();
      }
    };
    if (active < concurrency) return run();
    return new Promise<T>((resolve, reject) => {
      queue.push(() => run().then(resolve, reject));
    });
  };
}
