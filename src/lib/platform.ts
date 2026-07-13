export type Platform = "windows" | "mac";

/**
 * Labels only, never handling: chord *acceptance* still takes Cmd and Ctrl interchangeably
 * (DECISIONS.md:96), so this is never read to decide whether a keypress fires a command — only to
 * decide which word to print for it. Reads `navigator` once; injectable so tests never touch it.
 */
export function getPlatform(
  nav: Pick<Navigator, "platform"> & { userAgentData?: { platform?: string } } = typeof navigator ===
  "undefined"
    ? { platform: "" }
    : navigator,
): Platform {
  const raw = nav.userAgentData?.platform ?? nav.platform ?? "";

  return raw.toLowerCase().includes("mac") ? "mac" : "windows";
}
