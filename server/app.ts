import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProduction } from './config/env.js';
import { typingRouter } from './integrations/typing.js';
import { mismaProcedencia } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { requestId } from './middleware/requestId.js';
import { adminRouter } from './routes/admin.routes.js';
import { advisorRouter } from './routes/advisor.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { mountWebView } from './views/web.view.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '..');

export const app = express();

app.disable('x-powered-by');
// Render atiende detrás de un proxy: request.ip debe ser la IP del cliente para el rate limit.
if (isProduction) app.set('trust proxy', 1);
app.use(requestId);
app.use('/api', (_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });

// Integraciones antes del parser JSON y fuera de mismaProcedencia: se autentican con firma HMAC.
app.use('/api/integrations/typing', typingRouter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', mismaProcedencia);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/advisor', advisorRouter);
app.use('/api/admin', adminRouter);
app.use('/api', apiNotFound);

mountWebView(app, path.join(projectRoot, 'dist'));
app.use(errorHandler);
