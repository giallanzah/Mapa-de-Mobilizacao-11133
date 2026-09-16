import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mobilizationRouter from "./mobilization";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mobilizationRouter);

export default router;
