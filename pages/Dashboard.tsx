
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useStore } from '../App';
import { DashboardStats } from '../types';

const Dashboard: React.FC = () => {
  const { orders } = useStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('TODAY');

  useEffect(() => {
    // 1. Filter Orders based on selected period
    const now = new Date();
    let filteredOrders = orders.filter(o => o.status !== 'CANCELLED');
    
    // Set time boundaries
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    if (filterPeriod === 'TODAY') {
      filteredOrders = filteredOrders.filter(o => o.timestamp >= startOfDay);
    } else if (filterPeriod === 'WEEK') {
      filteredOrders = filteredOrders.filter(o => o.timestamp >= startOfWeek);
    } else if (filterPeriod === 'MONTH') {
      filteredOrders = filteredOrders.filter(o => o.timestamp >= startOfMonth);
    }

    // 2. Calculate Stats
    const totalRev = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
    const avgOrder = filteredOrders.length > 0 ? totalRev / filteredOrders.length : 0;
    
    // Top Selling Items (from filtered data)
    const itemMap = new Map<string, number>();
    filteredOrders.forEach(o => {
      (o.items || []).forEach(i => {
        itemMap.set(i.name, (itemMap.get(i.name) || 0) + i.qty);
      });
    });
    
    const topSelling = Array.from(itemMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      totalRevenue: totalRev,
      totalOrders: filteredOrders.length,
      avgOrderValue: avgOrder,
      topSellingItems: topSelling
    });

    // 3. Prepare Chart Data (Sales Trend)
    if (filterPeriod === 'TODAY') {
      // Group by Hour
      const hoursMap = new Map<number, number>();
      
      // Initialize with 0 for a standard business day range (e.g., 9 AM - 10 PM) 
      // or just dynamic. Let's do dynamic but ensure at least some range if empty.
      // If empty, show empty chart.
      
      filteredOrders.forEach(o => {
        const h = new Date(o.timestamp).getHours();
        hoursMap.set(h, (hoursMap.get(h) || 0) + o.total);
      });

      // Construct array
      const data = [];
      const keys = Array.from(hoursMap.keys()).sort((a, b) => a - b);
      
      // Default range 9 AM to 9 PM if sparse data, otherwise dynamic min/max
      let startH = 9;
      let endH = 21;
      
      if (keys.length > 0) {
        startH = Math.min(startH, keys[0]);
        endH = Math.max(endH, keys[keys.length - 1]);
      }

      for (let h = startH; h <= endH; h++) {
        const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}${h >= 12 ? 'pm' : 'am'}`;
        data.push({
          name: label,
          sales: hoursMap.get(h) || 0
        });
      }
      setSalesData(data);

    } else {
      // Group by Date
      const datesMap = new Map<string, number>(); // Key: 'YYYY-MM-DD'
      
      filteredOrders.forEach(o => {
        // Use ISO string YYYY-MM-DD as key for sorting
        const dateKey = new Date(o.timestamp).toISOString().split('T')[0];
        datesMap.set(dateKey, (datesMap.get(dateKey) || 0) + o.total);
      });

      const sortedKeys = Array.from(datesMap.keys()).sort();
      
      const data = sortedKeys.map(k => {
          const d = new Date(k);
          return {
              name: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
              sales: datesMap.get(k) || 0
          };
      });
      setSalesData(data);
    }

  }, [orders, filterPeriod]);

  if (!stats) return <div className="p-8 text-slate-500">Processing analytics...</div>;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Business Dashboard</h2>
          <div className="text-sm text-slate-500 mt-1">Real-time overview & performance analytics</div>
        </div>
        
        {/* Filter Controls */}
        <div className="bg-white p-1 rounded-lg border border-slate-200 flex shadow-sm">
          {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setFilterPeriod(period)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                filterPeriod === period
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {period === 'TODAY' ? 'Today' : period === 'WEEK' ? 'This Week' : period === 'MONTH' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <p className="text-slate-500 text-sm font-medium">Revenue ({filterPeriod.toLowerCase()})</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">₹{stats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <p className="text-slate-500 text-sm font-medium">Total Orders</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{stats.totalOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <p className="text-slate-500 text-sm font-medium">Avg. Order Value</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">₹{Math.round(stats.avgOrderValue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-hover hover:shadow-md">
          <p className="text-slate-500 text-sm font-medium">Top Item</p>
          <p className="text-xl font-bold text-amber-500 mt-3 truncate">
            {stats.topSellingItems[0]?.name || "N/A"}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Sales Trend</h3>
          <div className="flex-1 w-full min-h-0">
            {salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" fontSize={12} tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tick={{fill: '#64748b'}} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: number) => [`₹${value}`, 'Sales']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic">
                No sales data for this period
              </div>
            )}
          </div>
        </div>

        {/* Top Items Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Top Selling Items</h3>
          <div className="flex-1 w-full min-h-0">
             {stats.topSellingItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topSellingItems} layout="vertical" margin={{left: 40}}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} fontSize={12} tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-400 italic">
                No items sold yet
              </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
