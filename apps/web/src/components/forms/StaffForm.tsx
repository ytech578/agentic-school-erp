import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/Input";

interface StaffFormProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  departments: any[];
  designations: any[];
}

export function StaffForm({ register, errors, departments, designations }: StaffFormProps) {
  return (
    <>
      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Professional Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="Employee ID *"
            placeholder="e.g. EMP001"
            {...register("employeeId")}
            error={errors.employeeId?.message as string}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Role *</label>
            <select 
              {...register("role")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="TEACHER">Teacher</option>
              <option value="SCHOOL_ADMIN">Admin</option>
              <option value="PRINCIPAL">Principal</option>
            </select>
            {errors.role?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.role.message as string}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Department *</label>
            <select 
              {...register("departmentId")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.departmentId?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.departmentId.message as string}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Designation *</label>
            <select 
              {...register("designationId")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="">Select Designation</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.designationId?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.designationId.message as string}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Employment Type *</label>
            <select 
              {...register("employmentType")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="VISITING">Visiting</option>
            </select>
            {errors.employmentType?.message && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{errors.employmentType.message as string}</span>}
          </div>

          <Input
            label="Date of Joining *"
            type="date"
            {...register("joinDate")}
            error={errors.joinDate?.message as string}
          />
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Personal Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="First Name *"
            placeholder="John"
            {...register("firstName")}
            error={errors.firstName?.message as string}
          />
          <Input
            label="Last Name *"
            placeholder="Doe"
            {...register("lastName")}
            error={errors.lastName?.message as string}
          />
          <Input
            label="Email Address *"
            type="email"
            placeholder="john.doe@school.edu"
            {...register("email")}
            error={errors.email?.message as string}
          />
          <Input
            label="Phone Number"
            placeholder="+91 9876543210"
            {...register("phone")}
            error={errors.phone?.message as string}
          />
          
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Gender</label>
            <select 
              {...register("gender")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="">Select Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Blood Group</label>
            <select 
              {...register("bloodGroup")}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)"
              }}
            >
              <option value="UNKNOWN">Unknown</option>
              <option value="A_POSITIVE">A+</option>
              <option value="A_NEGATIVE">A-</option>
              <option value="B_POSITIVE">B+</option>
              <option value="B_NEGATIVE">B-</option>
              <option value="O_POSITIVE">O+</option>
              <option value="O_NEGATIVE">O-</option>
              <option value="AB_POSITIVE">AB+</option>
              <option value="AB_NEGATIVE">AB-</option>
            </select>
          </div>

          <Input
            label="Date of Birth"
            type="date"
            {...register("dateOfBirth")}
          />
        </div>
        
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Address</label>
            <textarea 
              {...register("address")}
              placeholder="Full residential address"
              rows={3}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)", resize: "vertical"
              }}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Identification</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="Aadhaar Number"
            placeholder="12 digit number"
            {...register("aadhaarNumber")}
          />
          <Input
            label="PAN Number"
            placeholder="10 alphanumeric characters"
            {...register("panNumber")}
          />
        </div>
      </section>
    </>
  );
}
