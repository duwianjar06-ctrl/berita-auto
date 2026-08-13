import {NextResponse} from 'next/server';
export function middleware(request){if(request.nextUrl.pathname==='/' ){return NextResponse.rewrite(new URL('/home',request.url));}return NextResponse.next();}
export const config={matcher:['/']};
