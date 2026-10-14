import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiNotFound, errorHandler } from './middleware/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { mismaProcedencia } from './middleware/auth.middleware.js';
import { mountWebView } from './views/web.view.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '..');

export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', mismaProcedencia);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', apiNotFound);

mountWebView(app, path.join(projectRoot, 'dist'));
app.use(errorHandler);
