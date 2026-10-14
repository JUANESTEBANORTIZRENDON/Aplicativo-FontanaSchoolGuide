import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';

export function mountWebView(app: Express, distPath: string): void {
  app.use(express.static(distPath, { index: 'index.html' }));

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' || !request.accepts('html')) {
      next();
      return;
    }

    response.sendFile(path.join(distPath, 'index.html'));
  });
}
