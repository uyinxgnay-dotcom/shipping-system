import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

// 定时任务：清理过期订单
// 1. 报价中状态超过7天的订单，自动移入回收站
// 2. 回收站超过30天的订单，彻底删除
export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cron-Key',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // 验证 Cron Key（防止未授权调用）
  const cronKey = req.headers.get('X-Cron-Key');
  const expectedKey = process.env.CRON_SECRET_KEY;

  if (!expectedKey || cronKey !== expectedKey) {
    return new Response(JSON.stringify({ error: '未授权访问' }), { status: 401, headers });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let expiredQuotesCount = 0;
  let permanentDeletedCount = 0;
  const errors = [];

  try {
    // 1. 查找报价中状态超过7天的订单（未删除的）
    const { data: expiredQuotes, error: quoteError } = await supabase
      .from('orders')
      .select('id, order_id, recipient_name')
      .eq('status', 'quote')
      .is('deleted_at', null)
      .lt('created_at', sevenDaysAgo);

    if (quoteError) {
      errors.push('查询过期报价失败: ' + quoteError.message);
    } else if (expiredQuotes && expiredQuotes.length > 0) {
      // 批量软删除过期报价订单
      const expiredIds = expiredQuotes.map(o => o.id);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ deleted_at: now.toISOString() })
        .in('id', expiredIds);

      if (updateError) {
        errors.push('软删除过期报价失败: ' + updateError.message);
      } else {
        expiredQuotesCount = expiredQuotes.length;
      }
    }

    // 2. 查找回收站超过30天的订单，彻底删除
    const { data: oldTrash, error: trashError } = await supabase
      .from('orders')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', thirtyDaysAgo);

    if (trashError) {
      errors.push('查询过期回收站订单失败: ' + trashError.message);
    } else if (oldTrash && oldTrash.length > 0) {
      const trashIds = oldTrash.map(o => o.id);
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', trashIds);

      if (deleteError) {
        errors.push('彻底删除过期回收站订单失败: ' + deleteError.message);
      } else {
        permanentDeletedCount = oldTrash.length;
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      expiredQuotesMoved: expiredQuotesCount,
      permanentDeleted: permanentDeletedCount,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Cleanup result:', result);
    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { status: 500, headers });
  }
}