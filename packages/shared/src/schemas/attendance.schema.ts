import { z } from 'zod';

export const MarkAttendanceItemSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY']),
  remarks: z.string().optional(),
});

export const MarkAttendanceSchema = z.object({
  sectionId: z.string().min(1, 'Section is required'),
  date: z.string().min(1, 'Date is required'), // Format: YYYY-MM-DD
  records: z.array(MarkAttendanceItemSchema),
});

export type MarkAttendanceItemInput = z.infer<typeof MarkAttendanceItemSchema>;
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;
