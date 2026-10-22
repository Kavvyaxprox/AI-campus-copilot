import bcrypt from 'bcrypt';
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, unauthorized } from '../lib/http';
import { authenticate, signToken, toClaims } from '../middleware/auth';

export interface PublicProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  semester: number | null;
  homePath: string;
}

interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  semester: number | null;
  departmentId: string | null;
  department: { code: string; name: string } | null;
}

export function homePathForRole(role: string): string {
  if (role === 'STUDENT') return '/student';
  return '/admin';
}

export function toPublicProfile(user: DbUser): PublicProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentCode: user.department?.code ?? null,
    departmentName: user.department?.name ?? null,
    semester: user.semester,
    homePath: homePathForRole(user.role),
  };
}

export const authRouter = Router();

// Compared against when the account does not exist so the endpoint cannot be
// used to enumerate which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('campus-copilot-placeholder', 10);

authRouter.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      throw badRequest('Email and password are required.');
    }

    const user = (await prisma.user.findUnique({
      where: { email },
      include: { department: true },
    })) as DbUser | null;

    // Constant-ish response so the endpoint cannot be used to enumerate accounts.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!user || !valid) {
      throw unauthorized('Invalid email or password.');
    }

    const claims = toClaims(user);
    const token = signToken(claims);

    res.json({
      token,
      claims,
      user: toPublicProfile(user),
      // Explicit routing contract consumed by the client.
      redirectTo: homePathForRole(user.role),
    });
  }),
);

authRouter.get(
  '/api/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const claims = req.user!;
    const user = (await prisma.user.findUnique({
      where: { id: claims.id },
      include: { department: true },
    })) as DbUser | null;

    if (!user) throw unauthorized('Account no longer exists.');

    res.json({ user: toPublicProfile(user) });
  }),
);
