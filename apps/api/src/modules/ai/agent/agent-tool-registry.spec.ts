import { TOOL_REGISTRY } from './tool-registry';

describe('ToolRegistry (Security)', () => {
  it('should have all 10 registered tools', () => {
    expect(TOOL_REGISTRY.size).toBe(10);
  });

  it('should require confirmation for mutating HR/Academic tools', () => {
    const leaveTool = TOOL_REGISTRY.get('approve_leave');
    const assignmentTool = TOOL_REGISTRY.get('create_assignment');

    expect(leaveTool?.requiresConfirmation).toBe(true);
    expect(leaveTool?.executionMode).toBe('MUTATING');

    expect(assignmentTool?.requiresConfirmation).toBe(true);
    expect(assignmentTool?.executionMode).toBe('MUTATING');
  });

  it('should enforce proper role authorization per tool', () => {
    const leaveTool = TOOL_REGISTRY.get('approve_leave');
    expect(leaveTool?.allowedRoles).not.toContain('TEACHER');
    expect(leaveTool?.allowedRoles).toContain('PRINCIPAL');

    const assignmentTool = TOOL_REGISTRY.get('create_assignment');
    expect(assignmentTool?.allowedRoles).toContain('TEACHER');
  });

  it('should require confirmation for high risk automation tools', () => {
    const reportCardTool = TOOL_REGISTRY.get('automation_report_card_publish');
    expect(reportCardTool?.riskLevel).toBe('HIGH');
    expect(reportCardTool?.requiresConfirmation).toBe(true);
  });

  it('should not require confirmation for low risk automation tools', () => {
    const digestTool = TOOL_REGISTRY.get('automation_daily_digest');
    expect(digestTool?.riskLevel).toBe('LOW');
    expect(digestTool?.requiresConfirmation).toBe(false);
  });
});
