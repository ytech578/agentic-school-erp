import { formatFileSize } from "./FileAttachmentChips";

describe("FileAttachmentChips helpers", () => {
  it("formats byte sizes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(5242880)).toBe("5.0 MB");
  });
});
