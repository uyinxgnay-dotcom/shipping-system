import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Trash() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { user, logout } = useAuth()

  useEffect(() => {
    fetchTrashOrders()
  }, [])

  const fetchTrashOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/trash', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('获取回收站失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    return !search || 
      order.order_id.toLowerCase().includes(search.toLowerCase()) ||
      order.recipient_name.toLowerCase().includes(search.toLowerCase())
  })

  // 格式化北京时间
  const formatBeijingTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 恢复订单
  const handleRestore = async (id) => {
    if (!confirm('确定要恢复这个订单吗？')) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/trash/${id}?action=restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      alert('✅ 订单已恢复')
      fetchTrashOrders()
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  // 彻底删除
  const handlePermanentDelete = async (id) => {
    if (!confirm('⚠️ 彻底删除后无法恢复！确定要删除吗？')) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/trash/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      alert('✅ 订单已彻底删除')
      fetchTrashOrders()
    } catch (err) {
      alert('❌ ' + err.message)
    }
  }

  // 状态标签样式
  const getStatusStyle = (status) => {
    const styles = {
      quote: 'bg-orange-100 text-orange-800',
      ordered: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      arrived: 'bg-green-100 text-green-800'
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status) => {
    const labels = {
      quote: '💰 报价中',
      ordered: '📋 已下单',
      shipped: '🚚 已发货',
      arrived: '✅ 已到达'
    }
    return labels[status] || status
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* 顶部导航 */}
      <nav className="bg-white/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-white font-bold text-lg">🗑️ 回收站</h1>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/80 hover:text-white text-sm">
              ← 返回订单列表
            </Link>
            <button
              onClick={logout}
              className="text-white/80 hover:text-white text-sm"
            >
              退出
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        {/* 操作栏 */}
        <div className="card mb-4">
          <div className="flex gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="搜索订单号或收件人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mt-3 text-gray-500 text-sm">
            回收站订单保留30天，到期后将自动彻底删除
          </div>
        </div>

        {/* 订单列表 */}
        {loading ? (
          <div className="text-center text-white py-10">加载中...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="card text-center text-gray-500 py-10">
            回收站为空
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                className="card block"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-bold text-lg">{order.order_id || '未命名'}</span>
                      <span className={`status-badge ${getStatusStyle(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="text-gray-600 text-sm">
                      📍 {order.recipient_name} | {order.country} {order.city}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      📦 计费重量: {order.charge_weight?.toFixed(2)}kg
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      👤 {order.owner_name || '未知'} | 📅 删除于: {formatBeijingTime(order.deleted_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(order.id)}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 text-sm"
                    >
                      ↩️ 恢复
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(order.id)}
                      className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 text-sm"
                    >
                      🗑️ 彻底删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}