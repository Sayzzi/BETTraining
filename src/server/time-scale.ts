/** Shortens every protocol duration for automated tests (TEST_TIME_SCALE=0.02); 1 otherwise. */
export function testTimeScale() {
  const value = Number(process.env.TEST_TIME_SCALE ?? 1);
  return value > 0 && value <= 1 ? value : 1;
}
