// Feature route modules are registered here so app.ts stays small.
import { addRoutes } from '../app';
import { adminRoutes } from './admin';
import { assessmentRoutes } from './assessment';
import { battleRoutes } from './battles';
import { billingRoutes } from './billing';
import { ieltsRoutes } from './ielts';
import { learningRoutes } from './learning';
import { progressRoutes } from './progress';
import { readingRoutes } from './reading';

addRoutes(assessmentRoutes);
addRoutes(learningRoutes);
addRoutes(ieltsRoutes);
addRoutes(readingRoutes);
addRoutes(progressRoutes);
addRoutes(battleRoutes);
addRoutes(billingRoutes);
addRoutes(adminRoutes);
