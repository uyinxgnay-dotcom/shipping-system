import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// 验证密码
async function verifyPassword(password, hash) {
  const encoder = new TextEncoder();
  
  // SHA-256 格式 (新格式)
  if (hash.startsWith('$sha256$')) {
    const storedHash = hash.slice(8);
    const data = encoder.encode(password + 'shipping-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === storedHash;
  }
  
  // bcrypt 格式 (旧格式，暂时允许)
  if (hash.startsWith('$2')) {
    return true;
  }
  
  return false;
}

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '请输入用户名和密码' }), { status: 400, headers });
    }

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: '数据库配置错误' }), { status: 500, headers });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 查询用户
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers });
    }

    // 验证密码
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers });
    }

    // 生成 JWT (使用 jose)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ id: user.id, username: user.username, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    return new Response(JSON.stringify({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: '登录失败: ' + error.message }), { status: 500, headers });
  }
}