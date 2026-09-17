import { ROLES_KEY } from '../../core/decorators/roles.decorator';
import { AIController } from './ai.controller';
import { HRController } from '../hr/hr.controller';
import { MessagesController } from '../messages/messages.controller';

describe('RBAC Metadata and Guard Annotations (Action 1 & Action 10)', () => {
  describe('AIController RBAC', () => {
    it('restricts confirmAction to administrative and staff roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.confirmAction);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER']));
      expect(roles).not.toContain('STUDENT');
      expect(roles).not.toContain('PARENT');
    });

    it('delegates fine-grained action authorization to AgentControlPlaneService', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.confirmAction);
      expect(roles.length).toBe(4); // Expanded to allow any staff, specific tool policies apply in service layer
    });

    it('restricts runMonitoring to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.runMonitoring);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
      expect(roles).not.toContain('TEACHER');
    });

    it('restricts previewAutomation to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.previewAutomation);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
    });

    it('restricts executeAutomation to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.executeAutomation);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
    });

    it('allows TEACHER on copilot endpoints', () => {
      const lessonRoles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.generateLessonPlan);
      expect(lessonRoles).toContain('TEACHER');

      const remarkRoles = Reflect.getMetadata(ROLES_KEY, AIController.prototype.generateRemark);
      expect(remarkRoles).toContain('TEACHER');
    });
  });

  describe('HRController RBAC', () => {
    it('restricts reviewLeave to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, HRController.prototype.reviewLeave);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
      expect(roles).not.toContain('TEACHER');
    });

    it('restricts markStaffAttendance to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, HRController.prototype.markStaffAttendance);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
      expect(roles).not.toContain('TEACHER');
    });

    it('allows staff/teachers on applyLeave', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, HRController.prototype.applyLeave);
      expect(roles).toContain('TEACHER');
    });
  });

  describe('MessagesController RBAC', () => {
    it('restricts broadcast messaging to administrative roles', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, MessagesController.prototype.broadcast);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL']));
      expect(roles).not.toContain('STUDENT');
      expect(roles).not.toContain('TEACHER');
    });
  });
});
