import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, schema } from '@dxlander/database';
import { eq } from 'drizzle-orm';

const auth = new Hono();

// Login schema
const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

interface DecodedToken {
  userId: string;
  email: string;
  role: string;
}

// Login endpoint
auth.post('/login', zValidator('json', LoginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid('json');

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (!user) {
      return c.json({ success: false, message: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return c.json({ success: false, message: 'Invalid email or password' }, 401);
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET || 'development-secret';
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '7d' } // Token valid for 7 days
    );

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, message: 'An error occurred during login' }, 500);
  }
});

// Logout endpoint (optional - mainly for clearing client-side tokens)
auth.post('/logout', async (c) => {
  // In a JWT-based system, logout is primarily client-side
  // But we can log the event or invalidate refresh tokens if implemented
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Verify token endpoint
auth.get('/verify', async (c) => {
  try {
    // Get token from header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'development-secret';

    // Verify token
    const decoded = jwt.verify(token, secret) as DecodedToken;

    return c.json({
      success: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    return c.json({ success: false, message: 'Invalid or expired token' }, 401);
  }
});

export default auth;
