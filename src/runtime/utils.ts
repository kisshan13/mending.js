import { createHash } from "node:crypto"

export function generateId() {
    const input = `${new Date().toISOString()}:${Math.floor(Math.random() * 1000) + 1}`;

    return createHash("sha256").update(input).digest("hex").slice(20);
}