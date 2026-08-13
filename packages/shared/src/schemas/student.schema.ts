import { z } from 'zod';

export const CreateStudentSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG', 'AB_POS', 'AB_NEG', 'UNKNOWN']).default('UNKNOWN'),
  religion: z.string().optional(),
  caste: z.string().optional(),
  nationality: z.string().default('Indian'),
  aadhaarNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  medicalNotes: z.string().optional(),
  previousSchool: z.string().optional(),
  
  // Admission specific details
  admissionNumber: z.string().min(1, 'Admission number is required'),
  rollNumber: z.string().optional(),
  admissionDate: z.string().optional(), // YYYY-MM-DD
  
  // Guardian details (optional for creation)
  guardianFirstName: z.string().optional(),
  guardianLastName: z.string().optional(),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal('')),
  guardianRelationship: z.string().optional(),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export const UpdateStudentSchema = CreateStudentSchema.partial();

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;
