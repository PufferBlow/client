/** The four default icon styles a space gets before it has a picture: initials, peeking fish, bubble, school. */
export type SpaceIconStyle = "initials" | "crop" | "bubble" | "school";
const STYLES: readonly SpaceIconStyle[] = ["initials", "crop", "bubble", "school"];

/** The style an id gets, the same on every client (it comes from the same hash as the colour). */
export function spaceIconStyle(id: string): SpaceIconStyle {
  let h = 11;
  for (const c of id.trim().toLowerCase()) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return STYLES[h % STYLES.length]!;
}

/** Two letters for a name: the first letters of its first two words, or its first two characters. */
export function spaceInitials(name: string): string {
  const words = name.split(/[\s.\-_@]+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [...(words[0] ?? "?")].slice(0, 2);
  return letters.join("").toUpperCase();
}
