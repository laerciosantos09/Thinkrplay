import { endSession, route } from '../_lib/http.js';

export default route(['POST'], async (_req, res) => {
  endSession(res);
  return { ok: true };
});
