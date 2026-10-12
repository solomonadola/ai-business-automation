import { describe, it, expect } from "vitest";
import { validateAndNormalizeLead } from "../../src/domain/leads/validation.js";

describe("Lead Validation & Normalization", () => {
  const validLead = {
    name: "  Jordan Lee  ",
    email: "  JORDAN@EXAMPLE.COM  ",
    company: "  Example Co  ",
    website: "https://example.com",
    message: "  We need help automating our sales process.  ",
  };

  it("accepts and normalizes valid lead input", () => {
    const result = validateAndNormalizeLead(validLead);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe("Jordan Lee");
    expect(result.data.email).toBe("jordan@example.com");
    expect(result.data.company).toBe("Example Co");
    expect(result.data.website).toBe("https://example.com");
    expect(result.data.message).toBe(
      "We need help automating our sales process.",
    );
  });

  it("converts empty optional fields to undefined", () => {
    const result = validateAndNormalizeLead({
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "   ",
      website: "",
      message: "Need help.",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.company).toBeUndefined();
    expect(result.data.website).toBeUndefined();
  });

  it("fails when required fields are missing", () => {
    const result = validateAndNormalizeLead({});

    expect(result.success).toBe(false);
    if (result.success) return;

    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("email");
    expect(fields).toContain("message");
  });

  it("rejects invalid email formats", () => {
    const invalidEmails = [
      "invalid-email",
      "jordan@",
      "@example.com",
      "jordan..lee@example..com",
    ];

    for (const email of invalidEmails) {
      const result = validateAndNormalizeLead({
        name: "Jordan Lee",
        email,
        message: "Valid message.",
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      const emailError = result.errors.find((e) => e.field === "email");
      expect(emailError).toBeDefined();
      expect(emailError?.message).toBe("Invalid email address format");
    }
  });

  it("enforces maximum character length limits", () => {
    const oversizedName = "A".repeat(101);
    const oversizedMessage = "M".repeat(2001);
    const oversizedCompany = "C".repeat(101);

    const result = validateAndNormalizeLead({
      name: oversizedName,
      email: "jordan@example.com",
      company: oversizedCompany,
      message: oversizedMessage,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("name");
    expect(fields).toContain("company");
    expect(fields).toContain("message");
  });

  it("rejects non-HTTP/HTTPS website URLs", () => {
    const invalidWebsites = [
      "ftp://files.example.com",
      "javascript:alert(1)",
      "not-a-url",
    ];

    for (const website of invalidWebsites) {
      const result = validateAndNormalizeLead({
        name: "Jordan Lee",
        email: "jordan@example.com",
        website,
        message: "Valid message.",
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      const websiteError = result.errors.find((e) => e.field === "website");
      expect(websiteError).toBeDefined();
    }
  });
});
