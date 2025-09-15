import { Request, Response, NextFunction } from 'express';

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({
      success: false,
      message: 'Invalid or missing API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
}
