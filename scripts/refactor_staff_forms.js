const fs = require('fs');

function refactor(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('import { Input } from "@/components/ui/Input";', 'import { StaffForm } from "@/components/forms/StaffForm";');
  
  const startIdx = content.indexOf('<section>');
  const endIdx = content.lastIndexOf('</section>') + 10;
  
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx);
    content = before + '<StaffForm register={register} errors={errors} departments={departments} designations={designations} />' + after;
    fs.writeFileSync(file, content);
  }
}

refactor('d:/AI School ERP V1.0/apps/web/src/app/(dashboard)/staff/new/page.tsx');
refactor('d:/AI School ERP V1.0/apps/web/src/app/(dashboard)/staff/[id]/edit/page.tsx');
console.log('Refactored staff forms');
