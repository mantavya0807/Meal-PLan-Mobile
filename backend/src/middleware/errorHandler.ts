import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
	console.error('Global Error Handler:', err);
	res.status(err.status || 500).json({
		success: false,
		message: err.message || 'Internal Server Error',
		error: err,
		timestamp: new Date().toISOString(),
	});
}
