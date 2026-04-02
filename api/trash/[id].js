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
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
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

  // 只有管理员可以操作回收站
  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: '只有管理员可以操作回收站' }), { status: 403, headers });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 从 URL 获取订单 ID
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1]?.split('?')[0];
  const action = url.searchParams.get('action');

  // POST - 恢复订单
  if (req.method === 'POST' && action === 'restore') {
    const { data: orderCheck, error: checkError } = await supabase
      .from('orders')
      .select('id, deleted_at')
      .eq('id', id)
      .single();

    if (checkError || !orderCheck) {
      return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
    }

    if (!orderCheck.deleted_at) {
      return new Response(JSON.stringify({ error: '该订单不在回收站中' }), { status: 400, headers });
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: '恢复失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ order: updated, message: '订单已恢复' }), { status: 200, headers });
  }

  // DELETE - 彻底删除订单
  if (req.method === 'DELETE') {
    const { data: orderCheck, error: checkError } = await supabase
      .from('orders')
      .select('id, deleted_at')
      .eq('id', id)
      .single();

    if (checkError || !orderCheck) {
      return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
    }

    if (!orderCheck.deleted_at) {
      return new Response(JSON.stringify({ error: '该订单不在回收站中，请先移入回收站' }), { status: 400, headers });
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: '彻底删除失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, message: '订单已彻底删除' }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}