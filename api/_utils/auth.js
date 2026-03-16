import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

export async function verifyToken(auth) {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload;
  } catch {
    return null;
  }
}