import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import passagesRouter from "./passages";
import adminRouter from "./admin";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(passagesRouter);
router.use(adminRouter);
router.use(leaderboardRouter);

export default router;
