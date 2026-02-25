export function generateId(): string {
  // Prefer browser crypto.randomUUID when available
  const globalCrypto: Crypto | undefined =
    typeof crypto !== "undefined"
      ? crypto
      : typeof window !== "undefined"
        ? (window.crypto || (window as any).msCrypto)
        : undefined;

  if (globalCrypto && typeof (globalCrypto as any).randomUUID === "function") {
    return (globalCrypto as any).randomUUID();
  }

  // Fallback using getRandomValues if available
  if (globalCrypto && typeof globalCrypto.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    globalCrypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Last-resort fallback: Math.random + timestamp (not cryptographically strong)
  return (
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).toUpperCase();
}
