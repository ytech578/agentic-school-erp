import { z } from 'zod';

export const CreateStaffSchema = z.object({
  // User fields
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER']).default('TEACHER'),

  // Staff specific fields
  employeeId: z.string().min(2, 'Employee ID is required'),
  departmentId: z.string().min(1, 'Department is required'),
  designationId: z.string().min(1, 'Designation is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'VISITING']).default('FULL_TIME'),
  
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.enum([
    'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
    'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN'
  ]).default('UNKNOWN'),
  dateOfBirth: z.string().optional(), 
  joinDate: z.string().min(1, 'Join date is required'),

  address: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  panNumber: z.string().optional(),
});

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = CreateStaffSchema.partial().extend({
  // Override or add specific fields if needed
});

export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;
