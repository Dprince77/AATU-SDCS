// Matric number must look like 123/23/1/0076 (3/2/1/4 digits separated by "/")
export const MATRIC_REGEX = /^\d{3}\/\d{2}\/\d{1}\/\d{4}$/;
export const MATRIC_PLACEHOLDER = "";
export const MATRIC_HELP = "Format: XXX/XX/X/XXXX";


export function isValidMatric(value: string): boolean {
  return MATRIC_REGEX.test(value.trim());
}

// Auto-format as the user types: keeps only digits, then inserts "/" at 3, 5, 6.
export function formatMatricInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 10);
  let out = d.slice(0, 3);
  if (d.length > 3) out += "/" + d.slice(3, 5);
  if (d.length > 5) out += "/" + d.slice(5, 6);
  if (d.length > 6) out += "/" + d.slice(6, 10);
  return out;
}
