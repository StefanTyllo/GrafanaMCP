export function encodeResultWithLimit(payload: unknown, maxBytes: number): string {
  const full = JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(full, "utf8") <= maxBytes) return full;

  const previewBudget = Math.max(128, Math.floor(maxBytes / 2));
  const truncatedPreview = full.slice(0, previewBudget);

  return JSON.stringify(
    {
      truncated: true,
      maxBytes,
      originalBytes: Buffer.byteLength(full, "utf8"),
      preview: truncatedPreview
    },
    null,
    2
  );
}
