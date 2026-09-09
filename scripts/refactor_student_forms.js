const fs = require('fs');

function refactor(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('import { Input } from "@/components/ui/Input";', 'import { StudentForm } from "@/components/forms/StudentForm";');
  
  const startIdx = content.indexOf('          {/* Academic Details Section */}');
  const endIdx = content.lastIndexOf('</section>') + 10;
  
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx);
    content = before + '          <StudentForm register={register} errors={errors} />\n' + after;
    fs.writeFileSync(file, content);
  }
}

refactor('d:/AI School ERP V1.0/apps/web/src/app/(dashboard)/students/new/page.tsx');
refactor('d:/AI School ERP V1.0/apps/web/src/app/(dashboard)/students/[id]/edit/page.tsx');
console.log('Refactored student forms');
