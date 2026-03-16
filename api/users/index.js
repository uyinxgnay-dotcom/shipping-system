import { verifyToken } from '../_utils/auth.js';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  const authHeader = req.headers.get('Authorization');
  const user = await verifyToken(authHeader);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: '只有管理员可以管理用户' }), { status: 403, headers });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - 获取用户列表
  if (req.method === 'GET') {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, role, is_active, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: '获取用户失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ users }), { status: 200, headers });
  }

  // POST - 创建用户
  if (req.method === 'POST') {
    const { username, password, role } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '请输入用户名和密码' }), { status: 400, headers });
    }

    // 使用简单的 SHA-256 哈希
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'shipping-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = '$sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        role: role || 'employee',
        is_active: true
      })
      .select('id, username, role, is_active, created_at')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: '创建用户失败: ' + error.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ user: newUser }), { status: 201, headers });
  }

  // PUT - 更新用户
  if (req.method === 'PUT') {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const targetId = pathParts[pathParts.length - 1]?.split('?')[0];
    
    const updates = await req.json();

    if (updates.password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(updates.password + 'shipping-salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      updates.password_hash = '$sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      delete updates.password;
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', targetId)
      .select('id, username, role, is_active, created_at')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: '更新失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ user: updated }), { status: 200, headers });
  }

  // DELETE - 删除用户
  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const targetId = pathParts[pathParts.length - 1]?.split('?')[0];

    if (targetId === user.id) {
      return new Response(JSON.stringify({ error: '不能删除自己' }), { status: 400, headers });
    }

    const { error } = await supabase.from('users').delete().eq('id', targetId);

    if (error) {
      return new Response(JSON.stringify({ error: '删除失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}