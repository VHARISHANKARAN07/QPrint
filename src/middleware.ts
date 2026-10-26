import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'qprint-dev-secret-key-change-in-production-2026'
);

const COOKIE_NAME = 'qprint_session';

// Routes that require authentication and their allowed roles
const protectedRoutes: Record<string, string[]> = {
  '/student/dashboard': ['STUDENT'],
  '/student/orders': ['STUDENT'],
  '/student/profile': ['STUDENT'],
  '/teacher/dashboard': ['TEACHER'],
  '/teacher/orders': ['TEACHER'],
  '/teacher/profile': ['TEACHER'],
  '/shop/dashboard': ['SHOP_HANDLER'],
  '/shop/orders': ['SHOP_HANDLER'],
  '/shop/settings': ['SHOP_HANDLER'],
  '/shop/analytics': ['SHOP_HANDLER'],
  '/shop/pricing': ['SHOP_HANDLER'],
  '/shop/audit': ['SHOP_HANDLER'],
};

// API route protection
const protectedApiRoutes: Record<string, string[]> = {
  '/api/shop/analytics': ['SHOP_HANDLER'],
  '/api/shop/audit': ['SHOP_HANDLER'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if it's a protected page route
  const matchedRoute = Object.keys(protectedRoutes).find((route) =>
    pathname.startsWith(route)
  );

  // Check if it's a protected API route
  const matchedApiRoute = Object.keys(protectedApiRoutes).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute && !matchedApiRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (matchedApiRoute) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    // Redirect to appropriate login page
    if (pathname.startsWith('/shop')) {
      return NextResponse.redirect(new URL('/shop/login', request.url));
    }
    if (pathname.startsWith('/teacher')) {
      return NextResponse.redirect(new URL('/teacher/login', request.url));
    }
    return NextResponse.redirect(new URL('/student/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userRole = payload.role as string;

    const allowedRoles = matchedRoute
      ? protectedRoutes[matchedRoute]
      : matchedApiRoute
        ? protectedApiRoutes[matchedApiRoute]
        : [];

    if (allowedRoles && !allowedRoles.includes(userRole)) {
      if (matchedApiRoute) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      // Redirect to their correct dashboard
      switch (userRole) {
        case 'STUDENT':
          return NextResponse.redirect(new URL('/student/dashboard', request.url));
        case 'TEACHER':
          return NextResponse.redirect(new URL('/teacher/dashboard', request.url));
        case 'SHOP_HANDLER':
          return NextResponse.redirect(new URL('/shop/dashboard', request.url));
        default:
          return NextResponse.redirect(new URL('/', request.url));
      }
    }

    // Add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId as string);
    requestHeaders.set('x-user-role', userRole);
    requestHeaders.set('x-user-name', payload.name as string);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    // Invalid or expired token
    const response = matchedApiRoute
      ? NextResponse.json({ error: 'Invalid session' }, { status: 401 })
      : NextResponse.redirect(new URL('/', request.url));

    // Clear invalid cookie
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    '/student/:path*',
    '/teacher/:path*',
    '/shop/:path*',
    '/api/student/:path*',
    '/api/teacher/:path*',
    '/api/shop/:path*',
  ],
};
