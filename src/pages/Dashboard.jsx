import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const { user, logout } = useAuth()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('获取订单失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 获取所有创建人列表（用于筛选）
  const creators = [...new Set(orders.map(o => o.owner_name))].filter(Boolean).sort()

  const filteredOrders = orders.filter(order => {
    const matchStatus = filter === 'all' || order.status === filter
    const matchCreator = creatorFilter === 'all' || order.owner_name === creatorFilter
    const matchSearch = !search || 
      order.order_id.toLowerCase().includes(search.toLowerCase()) ||
      order.recipient_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchCreator && matchSearch
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

  // 状态统计
  const stats = {
    all: orders.length,
    quote: orders.filter(o => o.status === 'quote').length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    arrived: orders.filter(o => o.status === 'arrived').length,
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
          <h1 className="text-white font-bold text-lg">📦 发货管理系统</h1>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-white/80 hover:text-white text-sm">
              👤 {user?.username}
            </Link>
            {user?.role === 'admin' && <span className="text-yellow-300 text-xs">👑</span>}
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
          <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
            {/* 状态筛选 */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  filter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                全部 ({stats.all})
              </button>
              <button
                onClick={() => setFilter('quote')}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  filter === 'quote' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                💰 报价中 ({stats.quote})
              </button>
              <button
                onClick={() => setFilter('ordered')}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  filter === 'ordered' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                📋 已下单 ({stats.ordered})
              </button>
              <button
                onClick={() => setFilter('shipped')}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  filter === 'shipped' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                🚚 已发货 ({stats.shipped})
              </button>
              <button
                onClick={() => setFilter('arrived')}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  filter === 'arrived' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                ✅ 已到达 ({stats.arrived})
              </button>
            </div>
            
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <>
                  <Link to="/users" className="btn-secondary text-sm">
                    👥 用户管理
                  </Link>
                  <Link to="/trash" className="btn-secondary text-sm">
                    🗑️ 回收站
                  </Link>
                </>
              )}
              <Link to="/new" className="btn-primary !w-auto text-sm">
                + 新建订单
              </Link>
            </div>
          </div>
          
          {/* 搜索框和创建人筛选 */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              className="input flex-1"
              placeholder="搜索订单号或收件人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input w-auto"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
            >
              <option value="all">全部创建人</option>
              {creators.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 订单列表 */}
        {loading ? (
          <div className="text-center text-white py-10">加载中...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="card text-center text-gray-500 py-10">
            暂无订单记录
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <Link
                key={order.id}
                to={`/order/${order.id}`}
                className="card block hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-bold text-lg">{order.order_id}</span>
                      <span className={`status-badge ${getStatusStyle(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.tracking_number && (
                        <span className="text-xs text-gray-500">运单: {order.tracking_number}</span>
                      )}
                    </div>
                    <div className="text-gray-600 text-sm">
                      📍 {order.recipient_name} | {order.country} {order.city}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      📦 计费重量: {order.charge_weight?.toFixed(2)}kg
                      {order.quote_price && (
                        <span className="ml-3 text-green-600">💰 ¥{parseFloat(order.quote_price).toFixed(2)}</span>
                      )}
                      {order.carrier && (
                        <span className="ml-2 text-blue-600">🚚 {order.carrier}</span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      👤 {order.owner_name || '未知'} | 📅 {formatBeijingTime(order.created_at)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}