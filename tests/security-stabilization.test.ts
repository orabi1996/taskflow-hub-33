import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  safeCompareSecret,
  extractProvidedSecret,
  validateWebhookOrCronSecret,
  signPayload,
  verifyAndUnsealPayload,
} from "../src/lib/server-security";
import { secondsForDuration } from "../src/lib/auth-session.server";

describe("Security & Stabilization: Server Security Suite", () => {
  describe("Constant-Time Secret Comparison", () => {
    it("matches identical secrets", () => {
      expect(safeCompareSecret("my-secret-key-12345", "my-secret-key-12345")).toBe(true);
    });

    it("rejects mismatched secrets", () => {
      expect(safeCompareSecret("my-secret-key-12345", "wrong-secret-key-000")).toBe(false);
    });

    it("rejects null or empty secrets", () => {
      expect(safeCompareSecret(null, "secret")).toBe(false);
      expect(safeCompareSecret("secret", null)).toBe(false);
      expect(safeCompareSecret("", "")).toBe(false);
      expect(safeCompareSecret(undefined, "secret")).toBe(false);
    });

    it("rejects secrets with different lengths safely", () => {
      expect(safeCompareSecret("short", "much-longer-secret-token")).toBe(false);
    });
  });

  describe("Secret Token Extraction", () => {
    it("extracts token from Authorization: Bearer header", () => {
      const req = new Request("https://example.com/api/test", {
        headers: { Authorization: "Bearer test-bearer-secret" },
      });
      expect(extractProvidedSecret(req)).toBe("test-bearer-secret");
    });

    it("extracts token from x-cron-secret header", () => {
      const req = new Request("https://example.com/api/test", {
        headers: { "x-cron-secret": "test-cron-header-secret" },
      });
      expect(extractProvidedSecret(req)).toBe("test-cron-header-secret");
    });

    it("extracts token from x-bootstrap-secret header", () => {
      const req = new Request("https://example.com/api/test", {
        headers: { "x-bootstrap-secret": "test-bootstrap-secret" },
      });
      expect(extractProvidedSecret(req)).toBe("test-bootstrap-secret");
    });

    it("returns null when no secret is present", () => {
      const req = new Request("https://example.com/api/test");
      expect(extractProvidedSecret(req)).toBeNull();
    });
  });

  describe("Webhook & Cron Secret Validation", () => {
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      process.env.CRON_SECRET = "production-cron-secret-32-chars-long";
    });

    afterEach(() => {
      if (originalCronSecret !== undefined) {
        process.env.CRON_SECRET = originalCronSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    });

    it("authorizes request with matching Bearer token", () => {
      const req = new Request("https://example.com/api/public/hooks/automation-tick", {
        headers: { Authorization: "Bearer production-cron-secret-32-chars-long" },
      });
      expect(validateWebhookOrCronSecret(req, ["CRON_SECRET"])).toBe(true);
    });

    it("authorizes request with matching x-cron-secret header", () => {
      const req = new Request("https://example.com/api/public/hooks/automation-tick", {
        headers: { "x-cron-secret": "production-cron-secret-32-chars-long" },
      });
      expect(validateWebhookOrCronSecret(req, ["CRON_SECRET"])).toBe(true);
    });

    it("rejects request with invalid secret", () => {
      const req = new Request("https://example.com/api/public/hooks/automation-tick", {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      expect(validateWebhookOrCronSecret(req, ["CRON_SECRET"])).toBe(false);
    });

    it("rejects request when secret is missing", () => {
      const req = new Request("https://example.com/api/public/hooks/automation-tick");
      expect(validateWebhookOrCronSecret(req, ["CRON_SECRET"])).toBe(false);
    });
  });

  describe("HMAC Session Sealing & Verification", () => {
    const samplePayload = JSON.stringify({
      access_token: "test-access-token-jwt-sample",
      refresh_token: "test-refresh-token-sample",
      duration: "7d",
      email: "user@example.com",
    });

    it("seals and unseals payload accurately", () => {
      const sealed = signPayload(samplePayload, "unit-test-secret");
      expect(sealed).toContain(".");

      const unsealed = verifyAndUnsealPayload(sealed, "unit-test-secret");
      expect(unsealed).toBe(samplePayload);
      expect(JSON.parse(unsealed!)).toEqual(JSON.parse(samplePayload));
    });

    it("rejects tampered payload", () => {
      const sealed = signPayload(samplePayload, "unit-test-secret");
      const [b64, sig] = sealed.split(".");
      // Tamper with payload
      const tamperedB64 = Buffer.from(
        JSON.stringify({ ...JSON.parse(samplePayload), email: "attacker@example.com" }),
      ).toString("base64url");
      const tampered = `${tamperedB64}.${sig}`;

      expect(verifyAndUnsealPayload(tampered, "unit-test-secret")).toBeNull();
    });

    it("rejects invalid signature with different secret", () => {
      const sealed = signPayload(samplePayload, "secret-one");
      expect(verifyAndUnsealPayload(sealed, "different-secret-two")).toBeNull();
    });
  });

  describe("Session Duration Mapping", () => {
    it("maps duration correctly to seconds", () => {
      expect(secondsForDuration("session")).toBeUndefined();
      expect(secondsForDuration("1d")).toBe(86400);
      expect(secondsForDuration("7d")).toBe(604800);
      expect(secondsForDuration("30d")).toBe(2592000);
      expect(secondsForDuration("90d")).toBe(7776000);
    });
  });
});
