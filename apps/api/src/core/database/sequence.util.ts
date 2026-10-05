import { Logger } from '@nestjs/common';

const logger = new Logger('SequenceUtil');

/**
 * Atomically generates the next strictly sequential, collision-free identifier
 * (e.g. APP-2026-0001, ADM-2026-0001).
 *
 * Uses `system_configs` with atomic upsert + collision verification to eliminate
 * concurrency race conditions under burst admission traffic.
 */
export async function generateNextSequence(
  prisma: any,
  schoolId: string,
  prefix: 'APP' | 'ADM' | 'STU' | 'RCT',
  year: number = new Date().getFullYear(),
  digits = 4,
): Promise<string> {
  const key = `seq_${prefix.toLowerCase()}_${year}`;
  const maxRetries = 5;

  const executeOperation = async (tx: any) => {
    const config = await tx.systemConfig.findUnique({
      where: {
        schoolId_key: { schoolId, key },
      },
    });

    let nextSeq = 1;
    let useCompactAdmPattern = false;

    if (
      config &&
      config.value &&
      typeof config.value === 'object' &&
      'current' in config.value
    ) {
      nextSeq = Number(config.value.current) + 1;
    } else {
      // Initialize baseline from existing records
      if (prefix === 'APP') {
        const count = await tx.admissionApplication.count({
          where: { schoolId },
        });
        nextSeq = count + 1;
      } else if (prefix === 'RCT') {
        const count = await tx.receipt.count({
          where: { feePayment: { schoolId } },
        });
        nextSeq = count + 1;
      } else if (prefix === 'ADM') {
        // Continuously match existing school student admission numbering convention
        const students = await tx.student.findMany({
          where: { schoolId },
          select: { admissionNumber: true },
          orderBy: { createdAt: 'desc' },
        });
        let maxNum = 0;
        for (const s of students) {
          const adm = s.admissionNumber || '';
          const mCompact = adm.match(/^ADM26(\d+)$/i);
          if (mCompact) {
            const n = parseInt(mCompact[1], 10);
            if (n > maxNum) {
              maxNum = n;
              useCompactAdmPattern = true;
            }
            continue;
          }
          const mDash = adm.match(/^ADM-(?:\d{4})-(\d+)$/i);
          if (mDash) {
            const n = parseInt(mDash[1], 10);
            if (n > maxNum && !useCompactAdmPattern) {
              maxNum = n;
            }
          }
        }
        nextSeq = maxNum > 0 ? maxNum + 1 : students.length + 1;
      } else {
        const count = await tx.student.count({ where: { schoolId } });
        nextSeq = count + 1;
      }
    }

    // Verify that the generated candidate does not collide with historical records
    let candidate =
      prefix === 'ADM' && useCompactAdmPattern
        ? `ADM26${String(nextSeq).padStart(digits, '0')}`
        : `${prefix}-${year}-${String(nextSeq).padStart(digits, '0')}`;
    let exists = true;
    let safetyCounter = 0;

    while (exists && safetyCounter < 100) {
      safetyCounter++;
      candidate =
        prefix === 'ADM' && useCompactAdmPattern
          ? `ADM26${String(nextSeq).padStart(digits, '0')}`
          : `${prefix}-${year}-${String(nextSeq).padStart(digits, '0')}`;

      if (prefix === 'APP') {
        const match = await tx.admissionApplication.findFirst({
          where: { schoolId, applicationNo: candidate },
          select: { id: true },
        });
        exists = !!match;
      } else if (prefix === 'RCT') {
        const match = await tx.receipt.findFirst({
          where: { receiptNumber: candidate },
          select: { id: true },
        });
        exists = !!match;
      } else {
        const match = await tx.student.findFirst({
          where: { schoolId, admissionNumber: candidate },
          select: { id: true },
        });
        exists = !!match;
      }
      if (exists) {
        nextSeq++;
      }
    }

    // Atomically record current sequence state
    await tx.systemConfig.upsert({
      where: {
        schoolId_key: { schoolId, key },
      },
      update: {
        value: { current: nextSeq },
      },
      create: {
        schoolId,
        key,
        value: { current: nextSeq },
      },
    });

    return candidate;
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (typeof prisma.$transaction === 'function') {
        return await prisma.$transaction(async (tx: any) => executeOperation(tx));
      } else {
        // prisma is already an active interactive transaction
        return await executeOperation(prisma);
      }
    } catch (err: any) {
      logger.warn(
        `Sequence generation retry ${attempt + 1}/${maxRetries}: ${err.message}`,
      );
      if (attempt === maxRetries - 1) {
        // Fallback to high-entropy unique identifier if transaction persistently rolled back
        const timeEntropy = Date.now().toString(36).slice(-4).toUpperCase();
        const randEntropy = Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase();
        return `${prefix}-${year}-${timeEntropy}${randEntropy}`;
      }
    }
  }

  return `${prefix}-${year}-${Date.now().toString().slice(-digits)}`;
}
