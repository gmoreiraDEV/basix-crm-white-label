import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export type JWTPayload = { sub: string; email: string; role?: string; tenantId?: string | null };

export function signToken(payload: JWTPayload, expiresIn = "7d") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
