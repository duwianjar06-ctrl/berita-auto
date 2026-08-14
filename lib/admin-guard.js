import {auth} from '../auth.js';

const allowedEmails=()=>String(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);

export async function requireAdmin(){
  const session=await auth();
  const email=session?.user?.email?.trim().toLowerCase();
  if(!email)return null;
  if(!allowedEmails().includes(email))return {forbidden:true,email};
  return {session,email};
}
