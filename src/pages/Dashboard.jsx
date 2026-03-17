import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
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

  const filteredOrders = orders.filter(order => {
    const matchStatus = filter === 'all' || order.status === filter
    const matchSearch = !search || 
      order.order_id.toLowerCase().includes(search.toLowerCase()) ||
      order.recipient_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

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
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                全部 ({orders.length})
              </button>
              <button
                onClick={() => setFilter('quote')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === 'quote' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                💰 报价中 ({orders.filter(o => o.status === 'quote').length})
              </button>
              <button
                onClick={() => setFilter('ordered')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === 'ordered' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                ✅ 已下单 ({orders.filter(o => o.status === 'ordered').length})
              </button>
            </div>
            
            <div className="flex gap-2">
              {user?.role === 'admin' && (
                <Link to="/users" className="btn-secondary">
                  👥 用户管理
                </Link>
              )}
              <Link to="/new" className="btn-primary !w-auto">
                + 新建订单
              </Link>
            </div>
          </div>
          
          {/* 搜索框 */}
          <div className="mt-4">
            <input
              type="text"
              className="input"
              placeholder="搜索订单号或收件人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-lg">{order.order_id}</span>
                      <span className={`status-badge ${order.status === 'quote' ? 'status-quote' : 'status-ordered'}`}>
                        {order.status === 'quote' ? '💰 报价中' : '✅ 已下单'}
                      </span>
                      {order.owner_id !== user?.id && user?.role !== 'admin' && (
                        <span className="text-xs text-gray-400">({order.owner_name}创建)</span>
                      )}
                    </div>
                    <div className="text-gray-600 text-sm">
                      📍 {order.recipient_name} | {order.country} {order.city}
                    </div>
                    <div className="text-gray-600 text-sm mt-1">
                      📦 {order.length}×{order.width}×{order.height}cm × {order.quantity}件 | 
                      计费重量: {order.charge_weight?.toFixed(2)}kg
                    </div>
                  </div>
                  <div className="text-right text-gray-400 text-sm">
                    {new Date(order.created_at).toLocaleDateString('zh-CN')}
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