import type { NextFunction, Request, Response } from 'express';
import { databaseModel } from '../models/database.model.js';

export async function getHealth(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await databaseModel.checkConnection();
    response.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error: unknown) {
    next(error);
  }
}
