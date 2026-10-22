import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/http';

// SQLite via Prisma has no native enums; roles are plain strings validated here.
export type Role = 'SUPER_ADMIN' | 'DEPT_ADMIN' | 'FACULTY' | 'STUDENT';

export interface AuthClaims {
  id: string;
  email: string;
  role: Role;
  departmentId: string | null;
  semester: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthClaims;
    }
  }
}

const ROLES: Role[] = ['SUPER_ADMIN', 'DEPT_ADMIN', 'FACULTY', 'STUDENT'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value);
}

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function toClaims(user: {
  id: string;
  email: string;
  role: string;
  departmentId: string | null;
  semester: number | null;
}): AuthClaims {
  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    departmentId: user.departmentId,
    semester: user.semester,
  };
}

/** Verifies `Authorization: Bearer <jwt>` and attaches the decoded claims. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(unauthorized('Missing bearer token'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthClaims;
    if (!decoded || !decoded.id || !isRole(decoded.role)) {
      next(unauthorized('Token payload is not valid'));
      return;
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      departmentId: decoded.departmentId ?? null,
      semester: decoded.semester ?? null,
    };
    next();
  } catch {
    next(unauthorized('Invalid or expired session token'));
  }
};

/** Authorization factory: rejects every request whose role is not listed. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        forbidden(
          `Role ${req.user.role} is not allowed to access this endpoint. Required: ${roles.join(', ')}.`,
        ),
      );
      return;
    }
    next();
  };
}

export function requireClaims(req: { user?: AuthClaims }): AuthClaims {
  if (!req.user) throw unauthorized();
  return req.user;
}
