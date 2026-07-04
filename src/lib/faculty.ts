export const FACULTIES = [
  "Natural and Applied Sciences",
  "Engineering",
  "Environmental Sciences",
] as const;

export type Faculty = (typeof FACULTIES)[number];

export const isFaculty = (v: string | null | undefined): v is Faculty =>
  !!v && (FACULTIES as readonly string[]).includes(v);