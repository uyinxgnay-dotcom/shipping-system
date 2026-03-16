import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import https from 'https';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 钉钉配置
const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
const DINGTALK_SECRET = process.env.DINGTALK_SECRET;

function verifyToken(auth) {
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

// 发送钉钉消息
async function sendDingtalk(message) {
  if (!DINGTALK_WEBHOOK || !DINGTALK_SECRET) return;

  const timestamp = Date.now();
  const stringToSign = timestamp + '\n' + DINGTALK_SECRET;
  const hmac = crypto.createHmac('sha256', DINGTALK_SECRET);
  hmac.update(stringToSign);
  const sign = encodeURIComponent(hmac.digest('base64'));

  const url = `${DINGTALK_WEBHOOK}&timestamp=${timestamp}&sign=${sign}`;

  const postData = JSON.stringify({
    msgtype: 'text',
    text: { content: message }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: '请先登录' });
  }

  // 从路径获取订单ID
  const id = req.url.split('/').filter(Boolean).pop().split('?')[0];

  // GET - 获取订单详情
  if (req.method === 'GET') {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        owner:users!owner_id (id, username)
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    return res.status(200).json({
      order: {
        ...order,
        owner_name: order.owner?.username || '未知'
      }
    });
  }

  // PUT - 更新订单
  if (req.method === 'PUT') {
    // 检查权限
    const { data: order } = await supabase
      .from('orders')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (user.role !== 'admin' && order.owner_id !== user.id) {
      return res.status(403).json({ error: '无权修改此订单' });
    }

    const updates = req.body;
    updates.updated_at = new Date().toISOString();

    // 重新计算计费重量
    if (updates.length && updates.width && updates.height && updates.weight && updates.quantity) {
      const totalVolumeCm = updates.length * updates.width * updates.height * updates.quantity;
      const totalWeight = updates.weight * updates.quantity;
      const volumeWeight = totalVolumeCm / 5000;
      updates.charge_weight = Math.max(totalWeight, volumeWeight);
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: '更新失败' });
    }

    return res.status(200).json({ order: updated });
  }

  // DELETE - 删除订单
  if (req.method === 'DELETE') {
    const { data: order } = await supabase
      .from('orders')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    if (user.role !== 'admin' && order.owner_id !== user.id) {
      return res.status(403).json({ error: '无权删除此订单' });
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: '删除失败' });
    }

    return res.status(200).json({ success: true });
  }

  // POST - 特殊操作 (confirm, transfer)
  if (req.method === 'POST') {
    const action = req.query.action;

    // 确认下单
    if (action === 'confirm') {
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (!order) {
        return res.status(404).json({ error: '订单不存在' });
      }

      if (order.status !== 'quote') {
        return res.status(400).json({ error: '只有报价中的订单可以确认下单' });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ status: 'ordered', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: '更新失败' });
      }

      // 发送钉钉通知
      const message = `📦 订单已确认下单！

订单号: ${order.order_id}
收件人: ${order.recipient_name}
国家: ${order.country}
计费重量: ${order.charge_weight?.toFixed(2)} kg

操作人: ${user.username}`;
      
      try {
        await sendDingtalk(message);
      } catch (e) {
        console.error('钉钉通知失败:', e);
      }

      return res.status(200).json({ order: updated });
    }

    // 转移所有权
    if (action === 'transfer') {
      if (user.role !== 'admin') {
        return res.status(403).json({ error: '只有管理员可以转移订单' });
      }

      const { new_owner_id } = req.body;
      if (!new_owner_id) {
        return res.status(400).json({ error: '请指定新所有者' });
      }

      const { data: updated, error } = await supabase
        .from('orders')
        .update({ owner_id: new_owner_id, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: '转移失败' });
      }

      return res.status(200).json({ order: updated });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}