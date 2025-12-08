import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import logger from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate X-Instance-ID header
 *
 * Purpose:
 * - Ensures instance ID is present for sync operations
 * - Validates UUID format
 * - Attaches instanceId to request for downstream use
 *
 * This runs AFTER auth middleware, so req.user is available
 */
export async function instanceValidationMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Skip validation for public endpoints (no auth required)
  const publicPaths = [
    '/api/v1/health',
    '/api/v1/auth/validate',
  ];

  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip if user is not authenticated (auth middleware already handled this)
  if (!req.user) {
    return next();
  }

  // Only require instance ID for sync-related endpoints
  const requiresInstanceId = [
    '/api/v1/sync',
    '/api/v1/sessions',
    '/api/v1/events',
  ];

  const needsInstanceId = requiresInstanceId.some(path =>
    req.path.startsWith(path)
  );

  if (!needsInstanceId) {
    // Not a sync endpoint, skip validation
    return next();
  }

  // Get instance ID from header
  const instanceId = req.headers['x-instance-id'] as string | undefined;

  // Check if instance ID is provided
  if (!instanceId) {
    logger.warn('[INSTANCE:VALIDATION] Missing X-Instance-ID header', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });

    return res.status(400).json({
      success: false,
      error: 'X-Instance-ID header is required for sync operations',
      hint: 'Please provide a valid UUID in the X-Instance-ID header',
    });
  }

  // Validate UUID format
  if (!UUID_REGEX.test(instanceId)) {
    logger.warn('[INSTANCE:VALIDATION] Invalid X-Instance-ID format', {
      instanceId: instanceId.substring(0, 8) + '...',
      userId: req.user.id,
      path: req.path,
    });

    return res.status(400).json({
      success: false,
      error: 'Invalid X-Instance-ID format',
      hint: 'X-Instance-ID must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)',
    });
  }

  // Store validated instance ID in request for downstream handlers
  req.instanceId = instanceId;

  logger.debug('[INSTANCE:VALIDATION] Instance ID validated successfully', {
    instanceId: instanceId.substring(0, 8) + '...',
    userId: req.user.id,
    path: req.path,
  });

  next();
}
