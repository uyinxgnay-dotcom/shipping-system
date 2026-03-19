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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
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

    // 已下单状态必须有订单号，报价中可选
    if (data.status === 'ordered' && !data.order_id) {
      return new Response(JSON.stringify({ error: '已下单状态必须填写订单号' }), { status: 400, headers });
    }

    if (!data.recipient_name || !data.country) {
      return new Response(JSON.stringify({ error: '请填写收件人姓名和国家' }), { status: 400, headers });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_id: data.order_id,
        status: data.status || 'quote',
        owner_id: user.id,
        // 货物信息
        boxes: data.boxes || [],
        length: data.length,
        width: data.width,
        height: data.height,
        weight: data.weight,
        quantity: data.quantity,
        charge_weight: data.charge_weight,
        // 收件人信息
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