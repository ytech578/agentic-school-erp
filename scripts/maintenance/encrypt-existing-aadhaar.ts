import { PrismaClient } from '@prisma/client';
import {
  encryptSensitiveField,
  isEncrypted,
} from '../../apps/api/src/core/security/crypto.util';

const prisma = new PrismaClient();

async function backfillAadhaarEncryption() {
  console.log('🔒 Starting Aadhaar PII Encryption Migration...');

  // 1. Students
  const students = await prisma.student.findMany({
    where: { aadhaarNumber: { not: null } },
    select: { id: true, aadhaarNumber: true },
  });

  let studentCount = 0;
  for (const s of students) {
    if (s.aadhaarNumber && !isEncrypted(s.aadhaarNumber)) {
      const encrypted = encryptSensitiveField(s.aadhaarNumber);
      await prisma.student.update({
        where: { id: s.id },
        data: { aadhaarNumber: encrypted },
      });
      studentCount++;
    }
  }
  console.log(`✅ Encrypted ${studentCount} student Aadhaar records.`);

  // 2. Guardians
  const guardians = await prisma.guardian.findMany({
    where: { aadhaarNumber: { not: null } },
    select: { id: true, aadhaarNumber: true },
  });

  let guardianCount = 0;
  for (const g of guardians) {
    if (g.aadhaarNumber && !isEncrypted(g.aadhaarNumber)) {
      const encrypted = encryptSensitiveField(g.aadhaarNumber);
      await prisma.guardian.update({
        where: { id: g.id },
        data: { aadhaarNumber: encrypted },
      });
      guardianCount++;
    }
  }
  console.log(`✅ Encrypted ${guardianCount} guardian Aadhaar records.`);

  // 3. Staff
  const staffMembers = await prisma.staff.findMany({
    where: { aadhaarNumber: { not: null } },
    select: { id: true, aadhaarNumber: true },
  });

  let staffCount = 0;
  for (const st of staffMembers) {
    if (st.aadhaarNumber && !isEncrypted(st.aadhaarNumber)) {
      const encrypted = encryptSensitiveField(st.aadhaarNumber);
      await prisma.staff.update({
        where: { id: st.id },
        data: { aadhaarNumber: encrypted },
      });
      staffCount++;
    }
  }
  console.log(`✅ Encrypted ${staffCount} staff Aadhaar records.`);

  console.log('🎉 Aadhaar PII Encryption Migration finished successfully.');
}

backfillAadhaarEncryption()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
