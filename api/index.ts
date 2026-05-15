import app, { ensureServerReady } from '../server/src/index';

export default async function handler(req: Parameters<typeof app>[0], res: Parameters<typeof app>[1]) {
  await ensureServerReady();
  app(req, res);
}