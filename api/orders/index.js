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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - 获取订单列表
  if (req.method === 'GET') {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, owner:users!owner_id(id, username)')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: '获取订单失败' }), { status: 500, headers });
    }

    const formattedOrders = orders.map(o => ({
      ...o,
      owner_name: o.owner?.username || '未知'
    }));

    return new Response(JSON.stringify({ orders: formattedOrders }), { status: 200, headers });
  }

  // POST - 创建订单
  if (req.method === 'POST') {
    const data = await req.json();

    if (!data.order_id || !data.recipient_name || !data.country) {
      return new Response(JSON.stringify({ error: '请填写必填项' }), { status: 400, headers });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_id: data.order_id,
        status: data.status || 'quote',
        owner_id: user.id,
        length: data.length,
        width: data.width,
        height: data.height,
        weight: data.weight,
        quantity: data.quantity,
        charge_weight: data.charge_weight,
        recipient_name: data.recipient_name,
        country: data.country,
        province: data.province,
        city: data.city,
        zipcode: data.zipcode,
        address: data.address,
        phone: data.phone,
        notes: data.notes
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: '创建订单失败: ' + error.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ order }), { status: 201, headers });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}