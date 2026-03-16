import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import xlsx from 'xlsx';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 邮件配置
const transporter = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || 'yangy48uni@163.com',
    pass: process.env.SMTP_PASS
  }
});

// 验证 JWT
function verifyToken(auth) {
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 发送邮件
async function sendEmail(data, ownerName) {
  const totalVolumeCm = data.length * data.width * data.height * data.quantity;
  const totalVolumeM = totalVolumeCm / 1000000;
  const totalWeight = data.weight * data.quantity;
  const volumeWeight = totalVolumeCm / 5000;
  const chargeWeight = Math.max(totalWeight, volumeWeight);
  
  const statusText = data.status === 'quote' ? '💰 报价中' : '✅ 已下单';

  const wb = xlsx.utils.book_new();
  const mainData = [
    ['发货信息登记表'],
    [''],
    ['订单信息'],
    ['订单号', data.order_id],
    ['订单状态', statusText],
    ['创建人', ownerName],
    ['登记时间', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })],
    [''],
    ['货物信息'],
    ['单件尺寸(长×宽×高)', `${data.length} × ${data.width} × ${data.height} cm`],
    ['件数', data.quantity],
    ['单件重量', `${data.weight} kg`],
    [''],
    ['自动计算结果'],
    ['总体积', `${totalVolumeM.toFixed(4)} m³`],
    ['总重量', `${totalWeight.toFixed(2)} kg`],
    ['体积重(÷5000)', `${volumeWeight.toFixed(2)} kg`],
    ['计费重量', `${chargeWeight.toFixed(2)} kg`],
    [''],
    ['收件人信息'],
    ['收件人姓名', data.recipient_name],
    ['国家', data.country],
    ['省/州', data.province || ''],
    ['市', data.city || ''],
    ['邮编', data.zipcode || ''],
    ['具体地址', data.address || ''],
    ['联系方式', data.phone || ''],
    [''],
    ['备注', data.notes || '无']
  ];
  
  const ws = xlsx.utils.aoa_to_sheet(mainData);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
  xlsx.utils.book_append_sheet(wb, ws, '发货信息');
  
  const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  const emailSubject = data.status === 'quote' 
    ? `💰 报价请求 - 订单号: ${data.order_id}`
    : `📦 新发货登记 - 订单号: ${data.order_id}`;

  await transporter.sendMail({
    from: `"发货登记系统" <${process.env.SMTP_USER || 'yangy48uni@163.com'}>`,
    to: process.env.NOTIFY_EMAIL || '652565190@qq.com',
    subject: emailSubject,
    text: `
收到新的登记信息【${statusText}】

订单号: ${data.order_id}
创建人: ${ownerName}
登记时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

货物信息:
- 尺寸: ${data.length} × ${data.width} × ${data.height} cm
- 件数: ${data.quantity}
- 单件重量: ${data.weight} kg

计算结果:
- 总体积: ${totalVolumeM.toFixed(4)} m³
- 总重量: ${totalWeight.toFixed(2)} kg
- 体积重: ${volumeWeight.toFixed(2)} kg
- 计费重量: ${chargeWeight.toFixed(2)} kg

收件人: ${data.recipient_name}
国家: ${data.country}
省/州: ${data.province || ''}
市: ${data.city || ''}
地址: ${data.address || ''}
邮编: ${data.zipcode || ''}
电话: ${data.phone || ''}

备注: ${data.notes || '无'}

详细信息请查看附件 Excel 文件。
    `,
    attachments: [{
      filename: `发货登记_${data.order_id}_${new Date().toISOString().slice(0,10)}.xlsx`,
      content: excelBuffer
    }]
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = verifyToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: '请先登录' });
  }

  // GET - 获取订单列表
  if (req.method === 'GET') {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        owner:users!owner_id (id, username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: '获取订单失败' });
    }

    const formattedOrders = orders.map(o => ({
      ...o,
      owner_name: o.owner?.username || '未知'
    }));

    return res.status(200).json({ orders: formattedOrders });
  }

  // POST - 创建订单
  if (req.method === 'POST') {
    const data = req.body;

    // 验证必填项
    if (!data.order_id || !data.recipient_name || !data.country) {
      return res.status(400).json({ error: '请填写必填项' });
    }

    // 插入订单
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
      return res.status(500).json({ error: '创建订单失败: ' + error.message });
    }

    // 发送邮件
    try {
      await sendEmail(data, user.username);
    } catch (e) {
      console.error('发送邮件失败:', e);
    }

    return res.status(201).json({ order });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}