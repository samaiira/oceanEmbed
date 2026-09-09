import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/auth/session", (req, res) => {
  const { userId, sessionId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({
      authenticated: false,
      userId: null,
      sessionId: null,
    });
  }

  return res.json({
    authenticated: true,
    userId,
    sessionId: sessionId ?? null,
  });
});

export default router;