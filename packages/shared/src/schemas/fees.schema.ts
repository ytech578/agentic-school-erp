import { z } from "zod";

export const FeeStructureItemSchema = z.object({
  feeHeadId: z.string().min(1, "Fee Head is required"),
  amount: z.number().positive("Amount must be positive"),
});

export const CreateFeeStructureSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Structure name is required"),
  description: z.string().optional(),
  items: z.array(FeeStructureItemSchema).min(1, "At least one fee head is required"),
});

export type CreateFeeStructureInput = z.infer<typeof CreateFeeStructureSchema>;
export type FeeStructureItemInput = z.infer<typeof FeeStructureItemSchema>;

export const CollectFeeSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic Year is required"),
  amountPaid: z.number().positive("Amount must be greater than 0"),
  paymentMode: z.enum(["CASH", "ONLINE", "CHEQUE", "DD", "CARD"]),
  transactionRef: z.string().optional(),
  remarks: z.string().optional(),
  itemAllocations: z.array(z.object({
    feeHeadId: z.string(),
    amount: z.number(),
  })).optional(), // For MVP, we can auto-allocate if not provided
});

export type CollectFeeInput = z.infer<typeof CollectFeeSchema>;
