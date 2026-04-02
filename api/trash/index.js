import { jwtVerify } from 'jose';
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

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // 只有管理员可以访问回收站
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: '只有管理员可以访问回收站' }), { status: 403, headers });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - 获取回收站订单列表（已软删除的订单）
  if (req.method === 'GET') {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, owner:users!owner_id(id, username)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: '获取回收站失败' }), { status: 500, headers });
    }

    const formattedOrders = orders.map(o => ({
      ...o,
      owner_name: o.owner?.username || '未知'
    }));

    return new Response(JSON.stringify({ orders: formattedOrders }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}