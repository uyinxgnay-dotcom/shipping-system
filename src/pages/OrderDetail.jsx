import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState(false)
  const [formData, setFormData] = useState({})

  const canEdit = user?.role === 'admin' || order?.owner_id === user?.id

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setOrder(data.order)
      setFormData(data.order)
    } catch (err) {
      console.error('获取订单失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setOrder(data.order)
      setEditing(false)
      alert('✅ 更新成功')
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这个订单吗？此操作不可恢复。')) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error('删除失败')
      
      alert('✅ 订单已删除')
      navigate('/')
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  // 确认下单并通知
  const handleConfirmOrder = async () => {
    if (!confirm('确认将此报价转为已下单？将发送钉钉通知。')) return
    
    setSending(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/orders/${id}?action=confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setOrder(prev => ({ ...prev, status: 'ordered' }))
      alert('✅ 已转为下单状态，钉钉通知已发送！')
    } catch (err) {
      alert('❌ ' + err.message)
    } finally {
      setSending(false)
    }
  }

  // 计算箱子汇总
  const calcSummary = (boxes) => {
    if (!boxes || boxes.length === 0) return { totalVolume: 0, totalWeight: 0, totalQuantity: 0 }
    
    let totalVolume = 0
    let totalWeight = 0
    let totalQuantity = 0
    
    boxes.forEach(box => {
      const l = parseFloat(box.length) || 0
      const w = parseFloat(box.width) || 0
      const h = parseFloat(box.height) || 0
      const wt = parseFloat(box.weight) || 0
      const q = parseInt(box.quantity) || 1
      
      totalVolume += l * w * h * q
      totalWeight += wt * q
      totalQuantity += q
    })
    
    return { totalVolume, totalWeight, totalQuantity }
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-lg">加载中...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="card text-center">订单不存在</div>
      </div>
    )
  }

  const boxes = order.boxes || []
  const summary = calcSummary(boxes)
  const volumeWeight = summary.totalVolume / 5000
  const chargeWeight = Math.max(summary.totalWeight, volumeWeight)

  return (
    <div className="min-h-screen gradient-bg pb-8">
      {/* 顶部导航 */}
      <nav className="bg-white/10 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-white font-bold text-lg">📦 订单详情</h1>
          <button
            onClick={() => navigate('/')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 返回列表
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 状态栏 */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold text-xl">{order.order_id}</span>
              <span className={`status-badge ${order.status === 'quote' ? 'status-quote' : 'status-ordered'}`}>
                {order.status === 'quote' ? '💰 报价中' : '✅ 已下单'}
              </span>
            </div>
            
            {order.status === 'quote' && canEdit && (
              <button
                onClick={handleConfirmOrder}
                disabled={sending}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {sending ? '处理中...' : '确认下单'}
              </button>
            )}
          </div>
          
          <div className="mt-3 text-sm text-gray-500">
            创建者: {order.owner_name || '未知'} | 
            创建时间: {new Date(order.created_at).toLocaleString('zh-CN')}
          </div>
        </div>

        {/* 货物信息 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📦 货物信息</h2>
          
          {boxes.length > 0 ? (
            <div className="space-y-4">
              {/* 箱子列表 */}
              {boxes.map((box, index) => (
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="font-medium text-gray-700 mb-2">箱子 {index + 1}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>尺寸: {box.length} × {box.width} × {box.height} cm</div>
                    <div>单件重量: {box.weight} kg</div>
                    <div>件数: {box.quantity} 件</div>
                    <div>小计重量: {(box.weight * box.quantity).toFixed(2)} kg</div>
                  </div>
                </div>
              ))}
              
              {/* 汇总 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-medium text-purple-800 mb-3">📊 汇总</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">总件数:</span>
                    <span className="font-medium">{summary.totalQuantity} 件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">总体积:</span>
                    <span className="font-medium">{(summary.totalVolume / 1000000).toFixed(4)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">总重量:</span>
                    <span className="font-medium">{summary.totalWeight.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">体积重:</span>
                    <span className="font-medium">{volumeWeight.toFixed(2)} kg</span>
                  </div>
                  <div className="col-span-2 flex justify-between pt-2 border-t border-purple-200 font-bold">
                    <span className="text-purple-700">计费重量:</span>
                    <span className="text-purple-700 text-lg">{chargeWeight.toFixed(2)} kg</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // 兼容旧数据
            <div className="space-y-2 text-gray-700">
              <div>单件尺寸: {order.length} × {order.width} × {order.height} cm</div>
              <div>件数: {order.quantity} 件</div>
              <div>单件重量: {order.weight} kg</div>
              <div className="pt-2 border-t mt-2">
                <div>总体积: {(order.length * order.width * order.height * order.quantity / 1000000).toFixed(4)} m³</div>
                <div>总重量: {(order.weight * order.quantity).toFixed(2)} kg</div>
                <div>体积重: {(order.length * order.width * order.height * order.quantity / 5000).toFixed(2)} kg</div>
                <div className="font-bold text-purple-700">计费重量: {order.charge_weight?.toFixed(2)} kg</div>
              </div>
            </div>
          )}
        </div>

        {/* 收件人信息 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📍 收件人信息</h2>
          
          {editing ? (
            <div className="space-y-3">
              <input name="recipient_name" className="input" value={formData.recipient_name || ''} onChange={handleChange} placeholder="收件人姓名" />
              <div className="grid grid-cols-2 gap-3">
                <input name="country" className="input" value={formData.country || ''} onChange={handleChange} placeholder="国家" />
                <input name="province" className="input" value={formData.province || ''} onChange={handleChange} placeholder="省/州" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="city" className="input" value={formData.city || ''} onChange={handleChange} placeholder="城市" />
                <input name="zipcode" className="input" value={formData.zipcode || ''} onChange={handleChange} placeholder="邮编" />
              </div>
              <input name="address" className="input" value={formData.address || ''} onChange={handleChange} placeholder="具体地址" />
              <input name="phone" className="input" value={formData.phone || ''} onChange={handleChange} placeholder="联系方式" />
            </div>
          ) : (
            <div className="space-y-1 text-gray-700">
              <div className="font-medium">{order.recipient_name}</div>
              <div>{order.country} {order.province} {order.city}</div>
              <div>{order.address}</div>
              <div>邮编: {order.zipcode || '-'}</div>
              <div>电话: {order.phone || '-'}</div>
            </div>
          )}
        </div>

        {/* 备注 */}
        <div className="card">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">📝 备注</h2>
          {editing ? (
            <input name="notes" className="input" value={formData.notes || ''} onChange={handleChange} placeholder="备注" />
          ) : (
            <div className="text-gray-700">{order.notes || '无'}</div>
          )}
        </div>

        {/* 操作按钮 */}
        {canEdit && (
          <div className="card">
            <div className="flex gap-3">
              {editing ? (
                <>
                  <button onClick={handleUpdate} className="btn-primary flex-1">保存修改</button>
                  <button onClick={() => setEditing(false)} className="btn-secondary flex-1">取消</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="btn-secondary flex-1">编辑</button>
                  <button onClick={handleDelete} className="bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 flex-1">删除</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}