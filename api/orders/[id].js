import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
const DINGTALK_SECRET = process.env.DINGTALK_SECRET;

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

// 发送钉钉消息
async function sendDingtalk(message) {
  if (!DINGTALK_WEBHOOK || !DINGTALK_SECRET) return;

  const timestamp = Date.now();
  const stringToSign = timestamp + '\n' + DINGTALK_SECRET;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(DINGTALK_SECRET);
  const msgData = encoder.encode(stringToSign);
  
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const sign = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const url = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'text',
      text: { content: message }
    })
  });
}

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
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

  // 从 URL 获取订单 ID
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1]?.split('?')[0];
  const action = url.searchParams.get('action');

  // GET - 获取订单详情
  if (req.method === 'GET') {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, owner:users!owner_id(id, username)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
    }

    return new Response(JSON.stringify({
      order: { ...order, owner_name: order.owner?.username || '未知' }
    }), { status: 200, headers });
  }

  // PUT - 更新订单
  if (req.method === 'PUT') {
    const { data: orderCheck, error: checkError } = await supabase
      .from('orders')
      .select('owner_id, quote_locked')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
      }
      console.error('查询订单失败:', checkError);
      return new Response(JSON.stringify({ error: '查询订单失败: ' + checkError.message }), { status: 500, headers });
    }

    if (user.role !== 'admin' && orderCheck.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: '无权修改此订单' }), { status: 403, headers });
    }

    const updates = await req.json();
    updates.updated_at = new Date().toISOString();
    
    // 不允许更新的字段（主键、系统字段、关联查询字段）
    const forbiddenFields = ['id', 'created_at', 'owner_id', 'owner', 'owner_name'];
    forbiddenFields.forEach(field => delete updates[field]);

    // 报价相关字段的权限控制
    const quoteFields = ['quote_price', 'carrier'];
    const hasQuoteFields = quoteFields.some(field => updates[field] !== undefined);

    if (hasQuoteFields) {
      // 只有管理员可以修改报价字段
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以设置报价信息' }), { status: 403, headers });
      }

      // 如果报价已锁定，禁止修改
      if (orderCheck.quote_locked) {
        return new Response(JSON.stringify({ error: '报价已锁定，无法修改' }), { status: 403, headers });
      }
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return new Response(JSON.stringify({ 
        error: '更新失败: ' + (error.message || '未知错误'),
        details: error.details || null,
        hint: error.hint || null
      }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
  }

  // DELETE - 删除订单
  if (req.method === 'DELETE') {
    const { data: orderCheck, error: checkError } = await supabase
      .from('orders')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
    }

    if (user.role !== 'admin' && orderCheck.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: '无权删除此订单' }), { status: 403, headers });
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);

    if (error) {
      return new Response(JSON.stringify({ error: '删除失败' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  // POST - 特殊操作
  if (req.method === 'POST') {
    // 确认下单
    if (action === 'confirm') {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
      }

      if (order.status !== 'quote') {
        return new Response(JSON.stringify({ error: '只有报价中的订单可以确认下单' }), { status: 400, headers });
      }

      // 报价转已下单必须有订单号
      if (!order.order_id) {
        return new Response(JSON.stringify({ error: '请先填写订单号再确认下单' }), { status: 400, headers });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ status: 'ordered', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: '更新失败' }), { status: 500, headers });
      }

      const message = `📦 订单已确认下单！\n\n订单号: ${order.order_id}\n收件人: ${order.recipient_name}\n国家: ${order.country}\n计费重量: ${order.charge_weight?.toFixed(2)} kg\n\n操作人: ${user.username}`;
      
      try {
        await sendDingtalk(message);
      } catch (e) {
        console.error('钉钉通知失败:', e);
      }

      return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
    }

    // 发货（仅管理员）
    if (action === 'ship') {
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以发货' }), { status: 403, headers });
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
      }

      if (order.status !== 'ordered') {
        return new Response(JSON.stringify({ error: '只有已下单的订单可以发货' }), { status: 400, headers });
      }

      const body = await req.json();
      const { tracking_number, tracking_image } = body;

      if (!tracking_number || !tracking_image) {
        return new Response(JSON.stringify({ error: '请填写运单号并上传运单图片' }), { status: 400, headers });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ 
          status: 'shipped', 
          tracking_number, 
          tracking_image,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: '发货失败' }), { status: 500, headers });
      }

      const message = `🚚 订单已发货！\n\n订单号: ${order.order_id}\n运单号: ${tracking_number}\n收件人: ${order.recipient_name}\n国家: ${order.country}\n\n操作人: ${user.username}`;
      
      try {
        await sendDingtalk(message);
      } catch (e) {
        console.error('钉钉通知失败:', e);
      }

      return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
    }

    // 确认到达（仅管理员）
    if (action === 'arrive') {
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以确认到达' }), { status: 403, headers });
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
      }

      if (order.status !== 'shipped') {
        return new Response(JSON.stringify({ error: '只有已发货的订单可以确认到达' }), { status: 400, headers });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ 
          status: 'arrived', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: '更新失败' }), { status: 500, headers });
      }

      const message = `✅ 订单已到达！\n\n订单号: ${order.order_id}\n运单号: ${order.tracking_number}\n收件人: ${order.recipient_name}\n国家: ${order.country}\n\n操作人: ${user.username}`;
      
      try {
        await sendDingtalk(message);
      } catch (e) {
        console.error('钉钉通知失败:', e);
      }

      return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
    }

    // 锁定报价（仅管理员）
    if (action === 'lockQuote') {
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以锁定报价' }), { status: 403, headers });
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ 
          quote_locked: true, 
          quote_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: '锁定失败' }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
    }

    // 解锁报价（仅管理员）
    if (action === 'unlockQuote') {
      if (user.role !== 'admin') {
        return new Response(JSON.stringify({ error: '只有管理员可以解锁报价' }), { status: 403, headers });
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          return new Response(JSON.stringify({ error: '订单不存在' }), { status: 404, headers });
        }
        return new Response(JSON.stringify({ error: '查询订单失败' }), { status: 500, headers });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ 
          quote_locked: false, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: '解锁失败' }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ order: updated }), { status: 200, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
}