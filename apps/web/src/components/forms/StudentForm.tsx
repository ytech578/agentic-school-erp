import { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/Input";

interface StudentFormProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export function StudentForm({ register, errors }: StudentFormProps) {
  return (
    <>
      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Academic Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="Admission Number"
            {...register("admissionNumber")}
            error={errors.admissionNumber?.message as string}
            required
          />
          <Input
            label="Roll Number"
            {...register("rollNumber")}
            error={errors.rollNumber?.message as string}
          />
          <Input
            label="Admission Date"
            type="date"
            {...register("admissionDate")}
            error={errors.admissionDate?.message as string}
          />
          <Input
            label="Previous School"
            {...register("previousSchool")}
            error={errors.previousSchool?.message as string}
          />
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Personal Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input
            label="First Name"
            {...register("firstName")}
            error={errors.firstName?.message as string}
            required
          />
          <Input
            label="Last Name"
            {...register("lastName")}
            error={errors.lastName?.message as string}
            required
          />
          <Input
            label="Email Address"
            type="email"
            {...register("email")}
            error={errors.email?.message as string}
            required
          />
          <Input
            label="Phone Number"
            {...register("phone")}
            error={errors.phone?.message as string}
          />
          <Input
            label="Date of Birth"
            type="date"
            {...register("dateOfBirth")}
            error={errors.dateOfBirth?.message as string}
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
              <option value="A_POS">A+</option>
              <option value="A_NEG">A-</option>
              <option value="B_POS">B+</option>
              <option value="B_NEG">B-</option>
              <option value="O_POS">O+</option>
              <option value="O_NEG">O-</option>
              <option value="AB_POS">AB+</option>
              <option value="AB_NEG">AB-</option>
            </select>
          </div>
          <Input
            label="Nationality"
            {...register("nationality")}
            error={errors.nationality?.message as string}
          />
          <Input
            label="Religion"
            {...register("religion")}
            error={errors.religion?.message as string}
          />
          <Input
            label="Caste / Category"
            {...register("caste")}
            error={errors.caste?.message as string}
          />
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Contact & Address</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Address</label>
            <textarea
              {...register("address")}
              rows={3}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)", resize: "vertical"
              }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <Input label="City" {...register("city")} error={errors.city?.message as string} />
            <Input label="State" {...register("state")} error={errors.state?.message as string} />
            <Input label="PIN Code" {...register("pinCode")} error={errors.pinCode?.message as string} />
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Primary Guardian Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Input label="First Name" {...register("guardianFirstName")} error={errors.guardianFirstName?.message as string} required />
          <Input label="Last Name" {...register("guardianLastName")} error={errors.guardianLastName?.message as string} />
          <Input label="Relationship" placeholder="e.g. Father, Mother" {...register("guardianRelationship")} error={errors.guardianRelationship?.message as string} required />
          <Input label="Phone Number" {...register("guardianPhone")} error={errors.guardianPhone?.message as string} required />
          <Input label="Email Address" type="email" {...register("guardianEmail")} error={errors.guardianEmail?.message as string} />
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>Medical & Identification</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          <Input label="Aadhaar Number" {...register("aadhaarNumber")} error={errors.aadhaarNumber?.message as string} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Medical Notes / Allergies</label>
            <textarea
              {...register("medicalNotes")}
              rows={2}
              style={{
                width: "100%", padding: "0.625rem 0.875rem", borderRadius: "var(--radius-md)",
                border: "1px solid var(--secondary-400)", backgroundColor: "var(--bg-surface)",
                fontSize: "0.875rem", color: "var(--text-primary)", resize: "vertical"
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
