import { jwtVerify, SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

async function verifyToken(auth) {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload;
  } catch {
    return null;
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'shipping-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '$sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const encoder = new TextEncoder();
  
  if (hash.startsWith('$sha256$')) {
    const storedHash = hash.slice(8);
    const data = encoder.encode(password + 'shipping-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHash === storedHash;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers });
    }

    const user = await verifyToken(authHeader);

    const body = await req.json();
    const { currentPassword, newPassword, userId, resetPassword } = body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 管理员重置密码
    if (resetPassword && userId) {
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以重置密码' }), { status: 403, headers });
      }

      const newHash = await hashPassword('123456');
      const { error } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', userId);

      if (error) {
        return new Response(JSON.stringify({ error: '重置失败' }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ success: true, message: '密码已重置为 123456' }), { status: 200, headers });
    }

    // 用户修改自己的密码
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: '请填写完整信息' }), { status: 400, headers });
    }

    // 获取用户当前密码
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (fetchError || !userData) {
      return new Response(JSON.stringify({ error: '用户不存在' }), { status: 404, headers });
    }

    // 验证当前密码
    const valid = await verifyPassword(currentPassword, userData.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: '当前密码错误' }), { status: 401, headers });
    }

    // 更新密码
    const newHash = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: '修改失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, message: '密码修改成功' }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: '操作失败: ' + error.message }), { status: 500, headers });
  }
}