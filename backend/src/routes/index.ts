import { Router } from 'express';
import systemRoutes from './systemRoutes';
import projectsRoutes from './projectsRoutes';
import logsRoutes from './logsRoutes';
import statsRoutes from './statsRoutes';
import inventoryRoutes from './inventoryRoutes';
import configsRoutes from './configsRoutes';
import massLaunchesRoutes from './massLaunchesRoutes';
import projectDataRoutes from './projectDataRoutes';
import browserRoutes from './browserRoutes';
import mediaRoutes from './mediaRoutes';
import scheduleRoutes from './scheduleRoutes';

const router = Router();

// Mount all route modules
router.use(systemRoutes);
router.use(projectsRoutes);
router.use(logsRoutes);
router.use(statsRoutes);
router.use(inventoryRoutes);
router.use(configsRoutes);
router.use(massLaunchesRoutes);
router.use(projectDataRoutes);
router.use(browserRoutes);
router.use(mediaRoutes);
router.use(scheduleRoutes);

export default router;
