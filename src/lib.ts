export type GreetingInput = {
  name: string;
  now?: Date;
};

export type GreetingResult = {
  message: string;
  isoTime: string;
};

export function buildGreeting(input: GreetingInput): GreetingResult {
  const now = input.now ?? new Date();
  const name = input.name.trim() || "Apps Script";

  return {
    message: `Hello, ${name}! This message was generated from TypeScript.`,
    isoTime: now.toISOString()
  };
}

export function buildSheetRows(names: string[], now = new Date()): string[][] {
  return names.map((name) => {
    const greeting = buildGreeting({ name, now });
    return [name, greeting.message, greeting.isoTime];
  });
}
