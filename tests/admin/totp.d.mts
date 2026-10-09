export function base32Encode(buffer: Uint8Array): string;
export function base32Decode(text: string): Buffer;
export function newTotpSecret(): string;
export function totp(secret: string, now?: number, step?: number): string;
export function verifyTotp(secret: string, code: string, now?: number): boolean;
