
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../App';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { OrderStatus } from '../types';

type ReportCategory = 'SALES' | 'ORDERS' | 'INVENTORY' | 'STAFF' | 'FINANCE' | 'TAX';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Define types for external libraries loaded via CDN
declare global {
  interface Window {
    jspdf: any;
    XLSX: any;
  }
}

const Reports: React.FC = () => {
  const { orders, products, expenses, auditLogs, shifts, staffList } = useStore();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('SALES');
  const [dateRange, setDateRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');

  // State for Tax Analysis
  const [selectedTaxMonth, setSelectedTaxMonth] = useState(new Date().toISOString().slice(0, 7)); // Default YYYY-MM

  // --- Helpers for Filtering ---
  const getFilteredOrders = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter(o => {
      if (o.status === OrderStatus.CANCELLED) return false;
      if (dateRange === 'TODAY') return o.timestamp >= today;
      if (dateRange === 'WEEK') return o.timestamp >= weekAgo;
      if (dateRange === 'MONTH') return o.timestamp >= monthAgo;
      return true;
    });
  };

  const filteredOrders = useMemo(() => getFilteredOrders(), [orders, dateRange]);

  // --- Tax Analysis Logic ---
  const taxReportData = useMemo(() => {
    const [year, month] = selectedTaxMonth.split('-').map(Number);
    return orders.filter(o => {
        if(o.status === OrderStatus.CANCELLED) return false;
        const d = new Date(o.timestamp);
        return d.getFullYear() === year && d.getMonth() === (month - 1);
    }).sort((a,b) => a.timestamp - b.timestamp);
  }, [orders, selectedTaxMonth]);

  const taxSummary = useMemo(() => {
    return taxReportData.reduce((acc, curr) => ({
        taxable: acc.taxable + curr.subtotal,
        tax: acc.tax + curr.tax,
        total: acc.total + curr.total,
        orders: acc.orders + 1
    }), { taxable: 0, tax: 0, total: 0, orders: 0 });
  }, [taxReportData]);

  // --- Export Functions ---
  const exportTaxExcel = () => {
    if (!window.XLSX) {
        alert("Excel export library loading...");
        return;
    }
    
    // Prepare Data
    const data = taxReportData.map(order => ({
        "Date": new Date(order.timestamp).toLocaleDateString(),
        "Order ID": order.id,
        "Customer Name": order.customerName || 'Guest',
        "Customer Phone": order.customerPhone || '-',
        "Subtotal (Taxable)": order.subtotal,
        "Tax Amount (5%)": order.tax,
        "Discount": order.discount,
        "Grand Total": order.total
    }));

    // Add Summary Row
    data.push({
        "Date": "TOTAL",
        "Order ID": "",
        "Customer Name": "",
        "Customer Phone": "",
        "Subtotal (Taxable)": taxSummary.taxable,
        "Tax Amount (5%)": taxSummary.tax,
        "Discount": "",
        "Grand Total": taxSummary.total
    } as any);

    const worksheet = window.XLSX.utils.json_to_sheet(data);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Tax Report");
    
    // Auto column width (basic approximation)
    const wscols = [
        {wch: 12}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 10}, {wch: 15}
    ];
    worksheet['!cols'] = wscols;

    window.XLSX.writeFile(workbook, `Tax_Report_${selectedTaxMonth}.xlsx`);
  };

  const exportTaxPDF = () => {
    if (!window.jspdf) {
        alert("PDF export library loading...");
        return;
    }

    const doc = new window.jspdf.jsPDF();
    const title = `Monthly Tax Analysis - ${selectedTaxMonth}`;
    
    doc.setFontSize(18);
    doc.text("NexPOS Tax Report", 14, 20);
    
    doc.setFontSize(12);
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);

    // Summary Section
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 45, 180, 25, 'F');
    doc.setFontSize(10);
    doc.text(`Total Orders: ${taxSummary.orders}`, 20, 55);
    doc.text(`Total Taxable Value: ${taxSummary.taxable.toFixed(2)}`, 80, 55);
    doc.text(`Total Tax Collected: ${taxSummary.tax.toFixed(2)}`, 140, 55);
    doc.text(`Net Revenue: ${taxSummary.total.toFixed(2)}`, 20, 65);

    // Table
    const tableColumn = ["Date", "Order ID", "Taxable Amt", "Tax (5%)", "Total"];
    const tableRows = taxReportData.map(order => [
        new Date(order.timestamp).toLocaleDateString(),
        order.id.slice(-6),
        order.subtotal.toFixed(2),
        order.tax.toFixed(2),
        order.total.toFixed(2)
    ]);

    // Add Total Row
    tableRows.push([
        "", "TOTAL", 
        taxSummary.taxable.toFixed(2), 
        taxSummary.tax.toFixed(2), 
        taxSummary.total.toFixed(2)
    ]);

    doc.autoTable({
        startY: 80,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo color
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    doc.save(`Tax_Report_${selectedTaxMonth}.pdf`);
  };

  // --- Helper to Resolve Staff Name (Current vs Historical) ---
  const getStaffName = (id: string, snapshotName: string) => {
     const currentStaff = staffList.find(s => s.id === id);
     return currentStaff ? currentStaff.name : snapshotName;
  };

  // --- Sales Reports Calculations ---
  const salesStats = useMemo(() => {
    let totalSales = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const paymentBreakdown: Record<string, number> = { CASH: 0, CARD: 0, UPI: 0, DUE: 0 };
    const categorySales: Record<string, number> = {};
    const itemSales: Record<string, { qty: number, amount: number }> = {};
    const hourlySales: Record<number, number> = {};
    const tableSales: Record<string, number> = {};
    const discountedOrdersList: typeof orders = [];

    filteredOrders.forEach(order => {
      totalSales += order.total;
      totalDiscount += order.discount;
      totalTax += order.tax;

      // Payments
      let orderPaid = 0;
      (order.payments || []).forEach(p => {
        paymentBreakdown[p.method] = (paymentBreakdown[p.method] || 0) + p.amount;
        orderPaid += p.amount;
      });
      if (order.total > orderPaid) {
        paymentBreakdown['DUE'] = (paymentBreakdown['DUE'] || 0) + (order.total - orderPaid);
      }

      // Items & Categories
      (order.items || []).forEach(item => {
        categorySales[item.category] = (categorySales[item.category] || 0) + (item.price * item.qty);
        
        if (!itemSales[item.name]) itemSales[item.name] = { qty: 0, amount: 0 };
        itemSales[item.name].qty += item.qty;
        itemSales[item.name].amount += (item.price * item.qty);
      });

      // Hourly
      const hour = new Date(order.timestamp).getHours();
      hourlySales[hour] = (hourlySales[hour] || 0) + order.total;

      // Table Wise Sales
      const tId = order.tableId || 'Other';
      tableSales[tId] = (tableSales[tId] || 0) + order.total;

      // Discount Tracking
      if (order.discount > 0) {
          discountedOrdersList.push(order);
      }
    });

    return { 
        totalSales, totalDiscount, totalTax, paymentBreakdown, categorySales, itemSales, hourlySales,
        tableSales, discountedOrdersList
    };
  }, [filteredOrders]);

  // --- Order Reports Calculations ---
  const orderStats = useMemo(() => {
    let dineIn = 0;
    let delivery = 0;
    let takeaway = 0;
    let totalKots = 0;
    let cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED).length;

    filteredOrders.forEach(o => {
       // Logic to differentiate Types
       const isDelivery = o.deliveryAddress || (o.tableId && o.tableId.toLowerCase().includes('delivery'));
       const isTakeaway = o.tableId && o.tableId.toLowerCase().includes('takeaway');

       if (isDelivery) delivery++;
       else if (isTakeaway) takeaway++;
       else dineIn++;

       // KOT count
       const kots = new Set((o.items || []).map(i => i.kotId).filter(Boolean));
       totalKots += kots.size;
    });

    return { dineIn, delivery, takeaway, totalKots, cancelledOrders };
  }, [filteredOrders, orders]);

  // --- Inventory Stats ---
  const inventoryStats = useMemo(() => {
      let totalValue = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;

      products.forEach(p => {
          totalValue += (p.price * p.stock); // Using retail price as proxy for value if cost not available
          if (p.stock === 0) outOfStockItems++;
          else if (p.stock < 10) lowStockItems++;
      });

      return { totalValue, lowStockItems, outOfStockItems };
  }, [products]);

  // --- Finance Stats ---
  const financeStats = useMemo(() => {
      const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
      const netProfit = salesStats.totalSales - salesStats.totalTax - totalExpenses; // Basic Profit
      
      return { totalExpenses, netProfit };
  }, [salesStats, expenses]);

  // --- Chart Data Helpers ---
  const categoryChartData = Object.entries(salesStats.categorySales).map(([name, value]) => ({ name, value }));
  const paymentChartData = Object.entries(salesStats.paymentBreakdown).map(([name, value]) => ({ name, value }));
  
  // Refactored to sort entries first using array access instead of destructuring
  const hourlyChartData = Object.entries(salesStats.hourlySales)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([hour, sales]) => ({ 
          hour: `${hour}:00`, 
          sales: Number(sales) 
      }));

  const tableChartData = Object.entries(salesStats.tableSales)
    .map(([name, sales]) => ({ name, sales: Number(sales) }))
    .sort((a, b) => b.sales - a.sales);

  // Sort items by amount
  const topItemsData = Object.entries(salesStats.itemSales)
    .map(([name, data]: [string, { qty: number, amount: number }]) => ({ name, qty: data.qty, amount: data.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // --- New Expense Form State ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Utilities' });
  const { addExpense } = useStore();

  const handleAddExpense = (e: React.FormEvent) => {
      e.preventDefault();
      if(expenseForm.description && expenseForm.amount) {
          addExpense({
              description: expenseForm.description,
              amount: parseFloat(expenseForm.amount),
              category: expenseForm.category,
              recordedBy: 'Admin'
          });
          setIsExpenseModalOpen(false);
          setExpenseForm({ description: '', amount: '', category: 'Utilities' });
      }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
          >
             ← Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Reports</h2>
          <p className="text-slate-500 text-sm">Analytics & Insights</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'SALES', label: 'Sales Reports' },
            { id: 'ORDERS', label: 'Order Reports' },
            { id: 'INVENTORY', label: 'Inventory' },
            { id: 'STAFF', label: 'Staff & Audit' },
            { id: 'FINANCE', label: 'Finance' },
            { id: 'TAX', label: 'Tax Analysis' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id as ReportCategory)}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all font-medium text-left ${
                activeCategory === item.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        
        {/* Date Filter (Only for Non-Tax Reports) */}
        {activeCategory !== 'TAX' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Time Period</p>
            <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="TODAY">Today</option>
                <option value="WEEK">This Week</option>
                <option value="MONTH">This Month</option>
                <option value="ALL">All Time</option>
            </select>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {/* SALES REPORTS */}
        {activeCategory === 'SALES' && (
          <div className="space-y-6 animate-fade-in">
             <h2 className="text-2xl font-bold text-slate-800 mb-4">Sales Performance</h2>
             
             {/* Key Metrics */}
             <div className="grid grid-cols-4 gap-6">
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-xs text-slate-500 font-bold uppercase">Total Revenue</p>
                     <p className="text-2xl font-bold text-indigo-600">₹{salesStats.totalSales.toLocaleString()}</p>
                 </div>
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-xs text-slate-500 font-bold uppercase">Total Tax Collected</p>
                     <p className="text-2xl font-bold text-slate-800">₹{salesStats.totalTax.toLocaleString()}</p>
                 </div>
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-xs text-slate-500 font-bold uppercase">Discounts Given</p>
                     <p className="text-2xl font-bold text-red-500">₹{salesStats.totalDiscount.toLocaleString()}</p>
                 </div>
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-xs text-slate-500 font-bold uppercase">Cash Sales</p>
                     <p className="text-2xl font-bold text-emerald-600">₹{(salesStats.paymentBreakdown.CASH || 0).toLocaleString()}</p>
                 </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
                 {/* Hourly Trend */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                     <h3 className="font-bold text-slate-700 mb-4">Hourly Sales Trend</h3>
                     <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={hourlyChartData}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false} />
                             <XAxis dataKey="hour" fontSize={12} />
                             <YAxis fontSize={12} />
                             <Tooltip />
                             <Area type="monotone" dataKey="sales" stroke="#4f46e5" fill="#e0e7ff" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </div>

                 {/* Payment Methods */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                     <h3 className="font-bold text-slate-700 mb-4">Payment Methods</h3>
                     <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                             <Pie data={paymentChartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                                {paymentChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                             </Pie>
                             <Tooltip />
                         </PieChart>
                     </ResponsiveContainer>
                 </div>
             </div>

             {/* Table Wise Sales & Top Items */}
             <div className="grid grid-cols-2 gap-6">
                 {/* Table Wise Sales */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                    <h3 className="font-bold text-slate-700 mb-4">Table-wise Performance</h3>
                    {tableChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tableChartData} margin={{bottom: 20}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} interval={0} angle={-30} textAnchor="end" />
                                <YAxis fontSize={12} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">No data available</div>
                    )}
                 </div>

                 {/* Top Selling Items */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-80">
                     <h3 className="font-bold text-slate-700 mb-4">Top Selling Items</h3>
                     <div className="overflow-y-auto flex-1">
                        <table className="w-full text-sm">
                            <thead className="text-slate-500 border-b sticky top-0 bg-white">
                                <tr>
                                    <th className="text-left py-2">Item</th>
                                    <th className="text-right py-2">Qty</th>
                                    <th className="text-right py-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItemsData.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                                        <td className="py-2">{item.name}</td>
                                        <td className="py-2 text-right">{item.qty}</td>
                                        <td className="py-2 text-right font-bold">₹{item.amount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                 </div>
             </div>

             {/* Discount Report */}
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700">Discount Report Details</h3>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                        {salesStats.discountedOrdersList.length} Orders with Discounts
                    </span>
                </div>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    {salesStats.discountedOrdersList.length === 0 ? (
                         <div className="text-center py-6 text-slate-400 italic">No discounts given in this period.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Order ID</th>
                                    <th className="px-4 py-2">Table</th>
                                    <th className="px-4 py-2">Customer</th>
                                    <th className="px-4 py-2 text-right">Bill Amount</th>
                                    <th className="px-4 py-2 text-right">Discount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {salesStats.discountedOrdersList.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 text-slate-500">{new Date(order.timestamp).toLocaleString()}</td>
                                        <td className="px-4 py-2 font-mono">#{order.id.slice(-6)}</td>
                                        <td className="px-4 py-2">{order.tableId || '-'}</td>
                                        <td className="px-4 py-2 text-slate-600">{order.customerName || 'Guest'}</td>
                                        <td className="px-4 py-2 text-right">₹{(order.total + order.discount).toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right font-bold text-red-600">-₹{order.discount.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
             </div>
          </div>
        )}

        {/* ORDER REPORTS */}
        {activeCategory === 'ORDERS' && (
             <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Order Analytics</h2>
                
                <div className="grid grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Orders</p>
                        <p className="text-2xl font-bold text-slate-800">{filteredOrders.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Cancelled</p>
                        <p className="text-2xl font-bold text-red-600">{orderStats.cancelledOrders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">KOTs Generated</p>
                        <p className="text-2xl font-bold text-amber-600">{orderStats.totalKots}</p>
                    </div>
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Avg Order Value</p>
                        <p className="text-2xl font-bold text-indigo-600">₹{Math.round(filteredOrders.length ? salesStats.totalSales / filteredOrders.length : 0)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col items-center justify-center">
                         <h3 className="font-bold text-slate-700 mb-4 self-start">Order Type Distribution</h3>
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={[
                                        { name: 'Dine-In', value: orderStats.dineIn },
                                        { name: 'Delivery', value: orderStats.delivery },
                                        { name: 'Takeaway', value: orderStats.takeaway }
                                    ]} 
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={90} fill="#8884d8" dataKey="value" label
                                >
                                    <Cell fill="#4f46e5" />
                                    <Cell fill="#10b981" />
                                    <Cell fill="#f59e0b" />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 text-sm mt-4">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-600 rounded-full"></div> Dine-In ({orderStats.dineIn})</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Delivery ({orderStats.delivery})</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 rounded-full"></div> Takeaway ({orderStats.takeaway})</span>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <h3 className="font-bold text-slate-700 mb-4">Recent KOT Activity</h3>
                        <div className="overflow-y-auto max-h-60">
                           <table className="w-full text-sm">
                               <thead className="bg-slate-50 text-slate-500">
                                   <tr>
                                       <th className="py-2 text-left">Time</th>
                                       <th className="py-2 text-left">Table</th>
                                       <th className="py-2 text-right">Items</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {filteredOrders.slice(0,10).map(o => {
                                       const kotCount = new Set((o.items || []).map(i => i.kotId)).size;
                                       return (
                                       <tr key={o.id} className="border-b border-slate-50">
                                           <td className="py-2">{new Date(o.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                           <td className="py-2 font-bold">{o.tableId}</td>
                                           <td className="py-2 text-right">{(o.items || []).length}</td>
                                       </tr>
                                   )})}
                               </tbody>
                           </table>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* INVENTORY REPORTS */}
        {activeCategory === 'INVENTORY' && (
             <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Inventory Valuation & Health</h2>

                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Inventory Value</p>
                        <p className="text-3xl font-bold text-emerald-600">₹{inventoryStats.totalValue.toLocaleString()}</p>
                        <p className="text-xs text-slate-400 mt-1">*Based on Retail Price</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Low Stock Items</p>
                        <p className="text-3xl font-bold text-amber-500">{inventoryStats.lowStockItems}</p>
                        <p className="text-xs text-slate-400 mt-1">Less than 10 units</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Out of Stock</p>
                        <p className="text-3xl font-bold text-red-500">{inventoryStats.outOfStockItems}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-4">Product Availability Status</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Product Name</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Stock Level</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {products.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{p.category}</td>
                                        <td className="px-4 py-3">₹{p.price}</td>
                                        <td className="px-4 py-3">
                                            {p.stock === 0 ? (
                                                <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs">Out of Stock</span>
                                            ) : p.stock < 10 ? (
                                                <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded text-xs">Low Stock</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-xs">Available</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                                                <div 
                                                    className={`h-2 rounded-full ${p.stock < 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                    style={{width: `${Math.min(p.stock, 100)}%`}}
                                                ></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
        )}

        {/* STAFF / AUDIT REPORTS */}
        {activeCategory === 'STAFF' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Staff & Shift Reports</h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {/* Shift History Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">Shift History</div>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-slate-500 bg-white border-b border-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Shift ID</th>
                                        <th className="px-6 py-3">Staff</th>
                                        <th className="px-6 py-3">Time Range</th>
                                        <th className="px-6 py-3 text-right">Cash Collected</th>
                                        <th className="px-6 py-3 text-right">Expected Cash</th>
                                        <th className="px-6 py-3 text-right">Actual Count</th>
                                        <th className="px-6 py-3 text-right">Variance</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {shifts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No shifts recorded yet.</td>
                                        </tr>
                                    ) : (
                                        shifts.sort((a,b) => b.startTime - a.startTime).map(shift => (
                                            <tr key={shift.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-mono text-slate-600">{shift.id}</td>
                                                <td className="px-6 py-3 font-medium">
                                                    {getStaffName(shift.staffId, shift.staffName)}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">
                                                    {new Date(shift.startTime).toLocaleString()} - 
                                                    {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : 'Active'}
                                                </td>
                                                <td className="px-6 py-3 text-right font-medium">₹{shift.cashSales}</td>
                                                <td className="px-6 py-3 text-right text-slate-500">₹{shift.expectedCash}</td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-700">{shift.actualCash !== undefined ? `₹${shift.actualCash}` : '-'}</td>
                                                <td className={`px-6 py-3 text-right font-bold ${
                                                    (shift.variance || 0) < 0 ? 'text-red-600' : (shift.variance || 0) > 0 ? 'text-green-600' : 'text-slate-400'
                                                }`}>
                                                    {shift.variance !== undefined ? `₹${shift.variance}` : '-'}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                        shift.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {shift.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">System Audit Trail</div>
                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-slate-500 bg-white border-b border-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Time</th>
                                        <th className="px-6 py-3">User</th>
                                        <th className="px-6 py-3">Action</th>
                                        <th className="px-6 py-3">Details</th>
                                        <th className="px-6 py-3">Severity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                            <td className="px-6 py-3 font-medium">{log.user}</td>
                                            <td className="px-6 py-3 font-mono text-xs text-indigo-600">{log.action}</td>
                                            <td className="px-6 py-3 text-slate-600">{log.details}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    log.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                    log.severity === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-blue-50 text-blue-700'
                                                }`}>
                                                    {log.severity}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* FINANCE REPORTS */}
        {activeCategory === 'FINANCE' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Financial Overview</h2>
                    <button 
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow-sm font-medium"
                    >
                        + Record Expense
                    </button>
                </div>

                {/* P&L Summary */}
                <div className="grid grid-cols-3 gap-6">
                     <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 shadow-sm">
                         <p className="text-xs text-emerald-700 font-bold uppercase">Net Revenue (Excl Tax)</p>
                         <p className="text-3xl font-bold text-emerald-900">₹{(salesStats.totalSales - salesStats.totalTax).toLocaleString()}</p>
                     </div>
                     <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
                         <p className="text-xs text-red-700 font-bold uppercase">Total Expenses</p>
                         <p className="text-3xl font-bold text-red-900">₹{financeStats.totalExpenses.toLocaleString()}</p>
                     </div>
                     <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 shadow-sm">
                         <p className="text-xs text-indigo-700 font-bold uppercase">Net Profit</p>
                         <p className="text-3xl font-bold text-indigo-900">₹{financeStats.netProfit.toLocaleString()}</p>
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    {/* Tax Report */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4">Tax / GST Report</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                <span className="text-slate-600">Total Taxable Sales</span>
                                <span className="font-bold">₹{(salesStats.totalSales - salesStats.totalTax).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                                <span className="text-slate-600">Total Tax Collected (5%)</span>
                                <span className="font-bold text-red-600">₹{salesStats.totalTax.toLocaleString()}</span>
                            </div>
                            <div className="mt-4 bg-slate-50 p-4 rounded-lg">
                                <p className="text-xs text-slate-500 mb-1">Tax Liability</p>
                                <p className="text-xl font-bold text-slate-800">₹{salesStats.totalTax.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Expenses List */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <h3 className="font-bold text-slate-700 mb-4">Expense Ledger</h3>
                        <div className="overflow-y-auto flex-1 max-h-60">
                             {expenses.length === 0 ? (
                                 <p className="text-slate-400 italic text-center py-8">No expenses recorded.</p>
                             ) : (
                                 <table className="w-full text-sm text-left">
                                     <thead className="text-slate-500 border-b">
                                         <tr>
                                             <th className="py-2">Date</th>
                                             <th className="py-2">Description</th>
                                             <th className="py-2">Category</th>
                                             <th className="py-2 text-right">Amount</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {expenses.map(exp => (
                                             <tr key={exp.id} className="border-b border-slate-50 last:border-0">
                                                 <td className="py-2 text-slate-500">{new Date(exp.timestamp).toLocaleDateString()}</td>
                                                 <td className="py-2 font-medium">{exp.description}</td>
                                                 <td className="py-2 text-xs uppercase text-slate-400">{exp.category}</td>
                                                 <td className="py-2 text-right font-bold text-red-600">₹{exp.amount}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             )}
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* NEW: TAX ANALYSIS REPORTS */}
        {activeCategory === 'TAX' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Monthly Tax Analysis</h2>
                        <p className="text-slate-500 text-sm">GST Calculation & Filing Report</p>
                    </div>
                    
                    <div className="flex gap-3 items-center">
                         <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                             <span className="text-xs font-bold text-slate-500 uppercase">Select Month</span>
                             <input 
                                type="month" 
                                value={selectedTaxMonth}
                                onChange={(e) => setSelectedTaxMonth(e.target.value)}
                                className="outline-none text-sm font-bold text-slate-700 bg-transparent"
                             />
                         </div>
                         <button 
                             onClick={exportTaxPDF}
                             className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700 transition-all shadow-sm"
                         >
                             <span>📄</span> Export PDF
                         </button>
                         <button 
                             onClick={exportTaxExcel}
                             className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm"
                         >
                             <span>📊</span> Export Excel
                         </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Report Month</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{selectedTaxMonth}</p>
                    </div>
                     <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Taxable Value</p>
                        <p className="text-2xl font-bold text-indigo-600 mt-1">₹{taxSummary.taxable.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Tax Collected</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">₹{taxSummary.tax.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Orders</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{taxSummary.orders}</p>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">Detailed Tax Breakdown</h3>
                        <span className="text-xs text-slate-500">Showing {taxReportData.length} records</span>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {taxReportData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-4xl mb-2">🧾</span>
                                <p>No records found for {selectedTaxMonth}</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-slate-500 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Order ID</th>
                                        <th className="px-6 py-3">Customer</th>
                                        <th className="px-6 py-3 text-right">Taxable Amt</th>
                                        <th className="px-6 py-3 text-right">Tax (5%)</th>
                                        <th className="px-6 py-3 text-right">Total Bill</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {taxReportData.map(order => (
                                        <tr key={order.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-3 text-slate-500">{new Date(order.timestamp).toLocaleDateString()}</td>
                                            <td className="px-6 py-3 font-mono text-slate-600">#{order.id.slice(-6)}</td>
                                            <td className="px-6 py-3 text-slate-800">{order.customerName || 'Guest'}</td>
                                            <td className="px-6 py-3 text-right font-medium text-slate-700">₹{order.subtotal.toFixed(2)}</td>
                                            <td className="px-6 py-3 text-right font-bold text-red-600">₹{order.tax.toFixed(2)}</td>
                                            <td className="px-6 py-3 text-right font-bold text-emerald-700">₹{order.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200 sticky bottom-0 font-bold text-slate-800">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-3 text-right uppercase text-xs tracking-wider">Monthly Totals</td>
                                        <td className="px-6 py-3 text-right">₹{taxSummary.taxable.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-right text-red-700">₹{taxSummary.tax.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-right text-emerald-800">₹{taxSummary.total.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
             </div>
        )}

      </div>

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Record New Expense</h3>
                <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                        <input 
                            type="text" 
                            required
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                            placeholder="e.g. Electricity Bill"
                            value={expenseForm.description}
                            onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                        <select 
                             className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 bg-white"
                             value={expenseForm.category}
                             onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                        >
                            <option>Utilities</option>
                            <option>Rent</option>
                            <option>Inventory Purchase</option>
                            <option>Salaries</option>
                            <option>Maintenance</option>
                            <option>Marketing</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Amount (₹)</label>
                        <input 
                            type="number" 
                            required
                            min="0"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                            placeholder="0.00"
                            value={expenseForm.amount}
                            onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setIsExpenseModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium shadow-sm"
                        >
                            Save Expense
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
