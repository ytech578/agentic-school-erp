const fs = require('fs');
const path = require('path');

const srcFile = 'd:/AI School ERP V1.0/apps/web/src/app/(dashboard)/students/new/page.tsx';
const destDir = 'd:/AI School ERP V1.0/apps/web/src/app/(dashboard)/students/[id]/edit';
const destFile = path.join(destDir, 'page.tsx');

let content = fs.readFileSync(srcFile, 'utf8');

content = content.replace(
  'import { useState } from "react";',
  'import { useState, useEffect, use } from "react";'
);

content = content.replace(
  'export default function NewStudentPage() {',
  'export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {\n  const { id } = use(params);\n  const [isLoading, setIsLoading] = useState(true);'
);

content = content.replace('NewStudentPage', 'EditStudentPage');
content = content.replace('Admit New Student', 'Edit Student Profile');
content = content.replace('Fill in the details to register a new student to the school', 'Update student details');
content = content.replace('CreateStudentSchema', 'UpdateStudentSchema');
content = content.replace('import { CreateStudentSchema', 'import { UpdateStudentSchema');
content = content.replace('apiClient.post("/students", data)', 'apiClient.put(`/students/${id}`, data)');
content = content.replace('router.push("/students")', 'router.push(`/students/${id}`)');
content = content.replace('Failed to admit student', 'Failed to update student');
content = content.replace(
  'onSubmit = async (data: any) => {',
  `onSubmit = async (data: any) => {
    if (data.email === "") delete data.email;
    if (data.phone === "") delete data.phone;
`
);

const fetchEffect = `  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const res = await apiClient.get(\`/students/\${id}\`);
        const s = res.data.data;
        if (s) {
          reset({
            firstName: s.user?.firstName || "",
            lastName: s.user?.lastName || "",
            email: s.user?.email || "",
            phone: s.user?.phone || "",
            admissionNumber: s.admissionNumber || "",
            rollNumber: s.rollNumber || "",
            gender: s.gender || "OTHER",
            bloodGroup: s.bloodGroup || "UNKNOWN",
            nationality: s.nationality || "Indian",
            admissionDate: s.admissionDate ? s.admissionDate.split('T')[0] : "",
            dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : "",
            religion: s.religion || "",
            caste: s.caste || "",
            aadhaarNumber: s.aadhaarNumber || "",
            address: s.address || "",
            city: s.city || "",
            state: s.state || "",
            pinCode: s.pinCode || "",
            medicalNotes: s.medicalNotes || "",
            previousSchool: s.previousSchool || "",
            guardianFirstName: s.guardians?.[0]?.firstName || "",
            guardianLastName: s.guardians?.[0]?.lastName || "",
            guardianRelationship: s.guardians?.[0]?.relationship || "",
            guardianPhone: s.guardians?.[0]?.phone || "",
            guardianEmail: s.guardians?.[0]?.email || "",
          });
        }
      } catch (err) {
        setError("Failed to load student details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudent();
  }, [id, reset]);

  if (isLoading) return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;

  return (`;

content = content.replace('  return (', fetchEffect);

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(destFile, content);
console.log("Successfully created edit page");
