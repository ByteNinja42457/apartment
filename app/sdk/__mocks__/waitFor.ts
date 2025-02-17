export async function waitFor(cond: () => boolean, sec: number = 1): Promise<void> {
  for (const i = 0; i < sec * 10; i++) {
    if (cond()) {
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  expect(cond()).toBe(true);
}

