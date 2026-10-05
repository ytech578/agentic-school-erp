import { Test, TestingModule } from "@nestjs/testing";
import { MessagesService } from "./messages.service";
import { PrismaService } from "../../core/database/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  message: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  user: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
};

describe("MessagesService", () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe("getInbox", () => {
    it("should return inbox messages for a user", async () => {
      mockPrisma.message.findMany.mockResolvedValue([
        { id: "msg-1", subject: "Test", body: "Hello", createdAt: new Date(), replies: [] },
      ]);
      const result = await service.getInbox("user-1", "school-1");
      expect(Array.isArray(result)).toBe(true);
    });

    it("should throw ForbiddenException for empty schoolId", async () => {
      await expect(service.getInbox("user-1", "")).rejects.toThrow();
    });
  });

  describe("getSent", () => {
    it("should deduplicate bulk broadcast messages correctly", async () => {
      const now = new Date("2024-01-01T10:30:00Z");
      mockPrisma.message.findMany.mockResolvedValue([
        { id: "m1", subject: "Exam Notice", body: "Exam tomorrow", createdAt: now, replies: [] },
        { id: "m2", subject: "Exam Notice", body: "Exam tomorrow", createdAt: now, replies: [] },
        { id: "m3", subject: "Exam Notice", body: "Exam tomorrow", createdAt: now, replies: [] },
      ]);
      const result = await service.getSent("user-1", "school-1");
      // All 3 same hour+subject+body => deduplicated to 1 with recipientCount=3
      expect(result).toHaveLength(1);
      expect((result[0] as any).recipientCount).toBe(3);
    });

    it("should not deduplicate messages with different subjects", async () => {
      const now = new Date("2024-01-01T10:30:00Z");
      mockPrisma.message.findMany.mockResolvedValue([
        { id: "m1", subject: "Math Exam", body: "Tomorrow", createdAt: now, replies: [] },
        { id: "m2", subject: "Science Exam", body: "Tomorrow", createdAt: now, replies: [] },
      ]);
      const result = await service.getSent("user-1", "school-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("sendMessage", () => {
    it("should throw NotFoundException if recipient does not exist in school", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.sendMessage({
          schoolId: "school-1",
          senderId: "sender-1",
          recipientId: "nonexistent",
          body: "Hello",
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should create and return the message when recipient exists", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: "recipient-1" });
      mockPrisma.message.create.mockResolvedValue({ id: "msg-new", body: "Hello" });
      const result = await service.sendMessage({
        schoolId: "school-1",
        senderId: "sender-1",
        recipientId: "recipient-1",
        body: "Hello",
      });
      expect(result).toHaveProperty("id", "msg-new");
    });
  });

  describe("markAsRead", () => {
    it("should mark a message as read when it belongs to the user", async () => {
      mockPrisma.message.findFirst.mockResolvedValue({ id: "msg-1", recipientId: "user-1" });
      mockPrisma.message.update.mockResolvedValue({ id: "msg-1", isRead: true });
      const result = await service.markAsRead("msg-1", "user-1");
      expect(result).toBeDefined();
    });

    it("should throw NotFoundException for message not belonging to user", async () => {
      mockPrisma.message.findFirst.mockResolvedValue(null);
      await expect(service.markAsRead("msg-1", "wrong-user")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getUnreadCount", () => {
    it("should return count of unread messages for a user", async () => {
      mockPrisma.message.count.mockResolvedValue(5);
      const result = await service.getUnreadCount("user-1");
      // Service returns {count: number}
      const count = typeof result === "number" ? result : (result as any).count;
      expect(count).toBe(5);
    });
  });
});
