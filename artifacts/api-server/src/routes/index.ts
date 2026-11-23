import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicRouter from "./public";
import authRouter from "./auth";
import adminRouter from "./admin";
import { sessionMiddleware } from "../middlewares/admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use("/admin", (_req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  next();
}, sessionMiddleware, authRouter, adminRouter);

export default router;
