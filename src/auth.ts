import { IncomingMessage } from "node:http";

export function isAuthorizedBearer(req: IncomingMessage, expectedToken: string): boolean {
  const value = req.headers.authorization;
  if (!value) return false;

  const [scheme, token] = value.split(/\s+/, 2);
  return scheme.toLowerCase() === "bearer" && token === expectedToken;
}
