export type ClassNameValue = string | false | null | undefined;

export function cn(...inputs: ClassNameValue[]): string {
  return inputs
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}
