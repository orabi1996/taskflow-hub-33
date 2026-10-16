import https from "node:https";
import http from "node:http";

const webhookUrl = process.argv[2] || process.env.TEST_WEBHOOK_URL;

console.log("\n========================================================");
console.log(" 🔔 CRM-X Enterprise — Webhook Notification Ping Tool   ");
console.log("========================================================\n");

if (!webhookUrl) {
  console.log("ℹ️  Usage: node scripts/test-webhook-ping.mjs <WEBHOOK_URL>");
  console.log("   Example: node scripts/test-webhook-ping.mjs https://hooks.slack.com/services/XXX/YYY/ZZZ");
  console.log("   Example: node scripts/test-webhook-ping.mjs https://discord.com/api/webhooks/XXX/YYY\n");
  process.exit(0);
}

const payload = {
  system: "CRM-X Enterprise",
  event: "sla.breach.warning",
  timestamp: new Date().toISOString(),
  title: "⚠️ تنبيه استباقي: اقتراب خرق اتفاقية مستوى الخدمة (SLA Warning)",
  message: "تذكرة دعم فني رقم #TICK-1042 لعميل قطاع ERP اقتربت من موعد انتهاء مهلة الحل (متبقي أقل من ساعتين).",
  details: {
    ticket_id: "TICK-1042",
    client_name: "مجموعة الأفق القابضة (ERP System)",
    priority: "عاجل (Urgent)",
    assigned_engineer: "مهندس الدعم الفني - أحمد سمير",
    sla_time_remaining: "ساعة و 45 دقيقة",
    ticket_url: "https://crm.yourcompany.com/tickets?id=TICK-1042"
  }
};

const data = JSON.stringify(payload);
const urlObj = new URL(webhookUrl);
const isHttps = urlObj.protocol === "https:";
const client = isHttps ? https : http;

const options = {
  hostname: urlObj.hostname,
  port: urlObj.port || (isHttps ? 443 : 80),
  path: urlObj.pathname + urlObj.search,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
    "User-Agent": "CRM-X-Enterprise-Webhook-Tester/1.0"
  }
};

console.log(`📡 Sending test alert payload to:\n   ${webhookUrl}\n`);

const req = client.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`✅ Webhook Ping SUCCESS! (Status: ${res.statusCode})`);
      if (body) console.log(`   Response: ${body}`);
    } else {
      console.warn(`⚠️ Webhook responded with status: ${res.statusCode}`);
      if (body) console.log(`   Response: ${body}`);
    }
    console.log("");
  });
});

req.on("error", (err) => {
  console.error(`❌ Webhook Ping Failed: ${err.message}\n`);
});

req.write(data);
req.end();
