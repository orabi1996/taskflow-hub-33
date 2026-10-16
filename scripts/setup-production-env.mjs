import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const examplePath = path.join(cwd, ".env.example");

function generateSecureSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

console.log("\n========================================================");
console.log(" 🚀 CRM-X Enterprise — Production Environment Setup Tool ");
console.log("========================================================\n");

if (!fs.existsSync(examplePath)) {
  console.error("❌ Error: .env.example not found!");
  process.exit(1);
}

const exampleContent = fs.readFileSync(examplePath, "utf-8");

let targetEnvContent = "";
let isNew = false;

if (fs.existsSync(envPath)) {
  console.log("ℹ️  Existing .env file detected.");
  targetEnvContent = fs.readFileSync(envPath, "utf-8");
} else {
  console.log("⚡ Creating new .env file from .env.example with secure random secrets...");
  targetEnvContent = exampleContent;
  isNew = true;
}

// Ensure high-entropy cryptographic secrets are populated
const cronSecret = generateSecureSecret(32);
const sessionSecret = generateSecureSecret(32);
const bootstrapSecret = generateSecureSecret(32);

if (isNew || targetEnvContent.includes("your-strong-random-cron-secret-min-32-chars")) {
  targetEnvContent = targetEnvContent.replace(
    /CRON_SECRET=".*"/,
    `CRON_SECRET="${cronSecret}"`
  );
}

if (isNew || targetEnvContent.includes("your-strong-random-session-secret-min-32-chars")) {
  targetEnvContent = targetEnvContent.replace(
    /SESSION_SECRET=".*"/,
    `SESSION_SECRET="${sessionSecret}"`
  );
}

if (isNew || targetEnvContent.includes("your-strong-bootstrap-secret-min-32-chars")) {
  targetEnvContent = targetEnvContent.replace(
    /ADMIN_BOOTSTRAP_SECRET=".*"/,
    `ADMIN_BOOTSTRAP_SECRET="${bootstrapSecret}"`
  );
}

fs.writeFileSync(envPath, targetEnvContent, "utf-8");
console.log(`✅ Saved environment file at: ${envPath}`);

// Summary Audit
console.log("\n📋 Environment Checklist:");
const hasSupabaseUrl = !targetEnvContent.includes("your-project-id.supabase.co");
const hasServiceKey = !targetEnvContent.includes("your_service_role_key_here");
const hasCronSecret = !targetEnvContent.includes("your-strong-random-cron-secret-min-32-chars");
const hasSessionSecret = !targetEnvContent.includes("your-strong-random-session-secret-min-32-chars");

console.log(`  [${hasSupabaseUrl ? "✔" : "!"}] VITE_SUPABASE_URL & SUPABASE_URL: ${hasSupabaseUrl ? "Configured" : "Needs real Supabase Project URL"}`);
console.log(`  [${hasServiceKey ? "✔" : "!"}] SUPABASE_SERVICE_ROLE_KEY: ${hasServiceKey ? "Configured" : "Needs real Service Role Key"}`);
console.log(`  [${hasCronSecret ? "✔" : "!"}] CRON_SECRET: ${hasCronSecret ? "Secure secret active" : "Default placeholder"}`);
console.log(`  [${hasSessionSecret ? "✔" : "!"}] SESSION_SECRET: ${hasSessionSecret ? "Secure secret active" : "Default placeholder"}`);

console.log("\n💡 Next step: Replace Supabase placeholders with your live project credentials from:");
console.log("   https://supabase.com/dashboard/project/_/settings/api\n");
