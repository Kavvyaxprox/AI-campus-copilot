import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function line(char = '-') {
  console.log(char.repeat(64));
}

async function main() {
  line('=');
  console.log('AI Campus Copilot | database seed starting');
  line('=');

  // ------------------------------------------------------------------ Departments
  console.log('\n[1/4] Departments');

  const cse = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: { name: 'Computer Science & Engineering' },
    create: { code: 'CSE', name: 'Computer Science & Engineering' },
  });
  console.log(`      + ${cse.code} -> ${cse.name} (${cse.id})`);

  const ece = await prisma.department.upsert({
    where: { code: 'ECE' },
    update: { name: 'Electronics & Communication' },
    create: { code: 'ECE', name: 'Electronics & Communication' },
  });
  console.log(`      + ${ece.code} -> ${ece.name} (${ece.id})`);

  // ------------------------------------------------------------------ Accounts
  console.log('\n[2/4] Roles and sample accounts');

  const accounts: Array<{
    label: string;
    name: string;
    email: string;
    password: string;
    role: string;
    departmentId: string | null;
    semester: number | null;
  }> = [
    {
      label: 'Super Admin',
      name: 'Campus Super Admin',
      email: 'admin@campus.edu',
      password: requiredEnv('SEED_SUPER_ADMIN_PASSWORD'),
      role: 'SUPER_ADMIN',
      departmentId: null,
      semester: null,
    },
    {
      label: 'Department Admin (CSE)',
      name: 'CSE Department Admin',
      email: 'cse_admin@campus.edu',
      password: requiredEnv('SEED_DEPT_ADMIN_PASSWORD'),
      role: 'DEPT_ADMIN',
      departmentId: cse.id,
      semester: null,
    },
    {
      label: 'Student (CSE, Semester 5)',
      name: 'Aarav Sharma',
      email: 'student@campus.edu',
      password: requiredEnv('SEED_STUDENT_PASSWORD'),
      role: 'STUDENT',
      departmentId: cse.id,
      semester: 5,
    },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        role: account.role,
        departmentId: account.departmentId,
        semester: account.semester,
        passwordHash,
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        departmentId: account.departmentId,
        semester: account.semester,
      },
    });
    console.log(`      + [${account.role}] ${user.email} -> ${account.label}`);
  }

  // ------------------------------------------------------------------ Notices
  console.log('\n[3/4] Baseline campus notices');

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const notices: Array<{
    title: string;
    body: string;
    departmentId: string | null;
    semester: number | null;
    expiresAt: Date | null;
  }> = [
    {
      title: 'Mid Semester Examinations 2026 - Timetable Released',
      body: 'The mid semester examination timetable for all semesters has been published. Exams begin 18 Nov 2026. Download your hall ticket from the student portal at least 48 hours before your first paper.',
      departmentId: null,
      semester: null,
      expiresAt: new Date(now + 45 * day),
    },
    {
      title: 'CSE Lab Migration: Block B Closed This Weekend',
      body: 'The Computer Science & Engineering programming labs in Block B will be offline on 10 Nov 2026 for a network migration. Lab submissions due that day are extended to 12 Nov 2026.',
      departmentId: cse.id,
      semester: null,
      expiresAt: new Date(now + 20 * day),
    },
    {
      title: 'Semester 5 Industry Internship Registrations Open',
      body: 'Registration for the Semester 5 industry internship is open until 25 Nov 2026. Students must submit the signed consent form to the CSE department office.',
      departmentId: cse.id,
      semester: 5,
      expiresAt: new Date(now + 30 * day),
    },
    {
      title: 'Library Revised Hours During Exam Season',
      body: 'The central library will stay open until 11 PM from 10 Nov 2026 to 05 Dec 2026 for all registered students.',
      departmentId: null,
      semester: null,
      expiresAt: null,
    },
  ];

  for (const notice of notices) {
    const existing = await prisma.notice.findFirst({
      where: { title: notice.title },
    });
    if (existing) {
      console.log(`      = ${notice.title} (already present)`);
      continue;
    }
    const created = await prisma.notice.create({ data: notice });
    console.log(`      + ${created.title}`);
  }

  // ------------------------------------------------------------------ Summary
  console.log('\n[4/4] Summary');
  const [departments, users, createdNotices] = await Promise.all([
    prisma.department.count(),
    prisma.user.count(),
    prisma.notice.count(),
  ]);
  console.log(`      departments: ${departments}`);
  console.log(`      users:       ${users}`);
  console.log(`      notices:     ${createdNotices}`);
  line('=');
  console.log('Seed complete.');
  line('=');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
