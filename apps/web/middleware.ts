import { NextResponse, type NextRequest } from 'next/server';

/**
 * DXLander Middleware
 * Handles setup detection, authentication, and routing logic
 * Following Next.js 13+ best practices
 */

interface SetupStatus {
  setupComplete: boolean;
  hasAdminUser: boolean;
  databaseConnected: boolean;
}

// Routes that require authentication (after setup)
const PROTECTED_ROUTES = [
  '/dashboard',
  '/projects',
  '/settings',
  '/deployments',
  '/api/projects',
  '/api/deployments',
];

function getAuthToken(request: NextRequest): string | null {
  // Check for token in cookie
  const tokenFromCookie = request.cookies.get('dxlander-token')?.value;
  if (tokenFromCookie) return tokenFromCookie;

  // Check for token in Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

async function checkSetupStatus(): Promise<SetupStatus> {
  try {
    // Call the API to check setup status
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/setup/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Setup status check failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      setupComplete: data.setupComplete || false,
      hasAdminUser: data.hasAdminUser || false,
      databaseConnected: data.databaseConnected || false,
    };
  } catch (error) {
    console.error('Setup status check failed:', error);
    return {
      setupComplete: false,
      hasAdminUser: false,
      databaseConnected: false,
    };
  }
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes we don't want to protect
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/fonts/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    // Check setup status
    const setupStatus = await checkSetupStatus();

    // Handle root path routing logic
    if (pathname === '/') {
      if (!setupStatus.setupComplete) {
        // Setup incomplete, redirect to setup
        return NextResponse.redirect(new URL('/setup', request.url));
      } else {
        // Setup complete, check authentication
        const token = getAuthToken(request);
        if (token) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        } else {
          return NextResponse.redirect(new URL('/login', request.url));
        }
      }
    }

    // If accessing protected routes without setup completion
    if (isProtectedRoute(pathname) && !setupStatus.setupComplete) {
      console.log(`Protected route ${pathname} accessed without setup completion`);
      return NextResponse.redirect(new URL('/setup', request.url));
    }

    // If setup is complete, check authentication on protected routes
    if (setupStatus.setupComplete && isProtectedRoute(pathname)) {
      const token = getAuthToken(request);

      if (!token) {
        console.log(`Protected route ${pathname} accessed without authentication`);
        // Store the intended destination to redirect after login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // TODO: Optionally verify token with backend API
      // For now, presence of token is enough
    }

    // If accessing setup when already complete, redirect to login
    if (pathname === '/setup' && setupStatus.setupComplete) {
      console.log('Setup already complete, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Add setup status headers for client-side access
    const response = NextResponse.next();
    response.headers.set('x-dxlander-setup-complete', setupStatus.setupComplete.toString());
    response.headers.set('x-dxlander-has-admin', setupStatus.hasAdminUser.toString());

    return response;
  } catch (error) {
    console.error('Middleware error:', error);

    // On error, redirect to setup for safety
    if (pathname !== '/setup') {
      return NextResponse.redirect(new URL('/setup', request.url));
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/setup (setup API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - fonts (font files)
     */
    '/((?!api/setup|_next/static|_next/image|favicon.ico|fonts).*)',
  ],
};
