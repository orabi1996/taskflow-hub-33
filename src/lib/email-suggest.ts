// Lightweight email typo detector — suggests fixes for common domain typos.
const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com",
  "aol.com", "protonmail.com", "proton.me",
  "classera.com",
];

const COMMON_TLDS = ["com", "net", "org", "edu", "co", "io", "sa", "ae"];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function closest(input: string, list: string[], threshold: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of list) {
    const d = levenshtein(input.toLowerCase(), candidate);
    if (d < bestDist && d <= threshold && d > 0) {
      bestDist = d; best = candidate;
    }
  }
  return best;
}

export function suggestEmail(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain.includes(".")) return null;

  // Try whole-domain suggestion first
  const wholeFix = closest(domain, COMMON_DOMAINS, 2);
  if (wholeFix) return `${local}@${wholeFix}`;

  // Else try fixing the TLD only
  const lastDot = domain.lastIndexOf(".");
  const tld = domain.slice(lastDot + 1);
  const tldFix = closest(tld, COMMON_TLDS, 1);
  if (tldFix) return `${local}@${domain.slice(0, lastDot + 1)}${tldFix}`;

  return null;
}
