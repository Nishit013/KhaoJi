
import React, { useState, useMemo } from 'react';
import { useStore } from '../App';
import { Customer, OrderStatus } from '../types';

const CRM: React.FC = () => {
  const { customers, orders, updateCustomer, loyaltySettings } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  // Filter customers based on search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  // Helper to get total due for a customer (NEW)
  const getCustomerDue = (phone: string) => {
    return orders
      .filter(o => o.customerPhone === phone && o.status === OrderStatus.COMPLETED)
      .reduce((acc, o) => acc + (o.total - (o.amountPaid || 0)), 0);
  };

  // Calculate stats for a specific customer
  const getCustomerStats = (phone: string) => {
    const customerOrders = orders.filter(o => o.customerPhone === phone && o.status !== OrderStatus.CANCELLED);
    const totalSpent = customerOrders.reduce((acc, o) => acc + o.total, 0);
    const visitCount = customerOrders.length;
    const avgOrderValue = visitCount > 0 ? totalSpent / visitCount : 0;
    
    // Find preferred items
    const itemMap = new Map<string, number>();
    customerOrders.forEach(o => {
        (o.items || []).forEach(i => {
            itemMap.set(i.name, (itemMap.get(i.name) || 0) + i.qty);
        });
    });
    const topItems = Array.from(itemMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);

    return { customerOrders, totalSpent, visitCount, avgOrderValue, topItems };
  };

  const handleCustomerClick = (customer: Customer) => {
      setSelectedCustomer(customer);
      setIsEditMode(false);
  };

  const handleEditClick = () => {
      if (selectedCustomer) {
          setEditForm(selectedCustomer);
          setIsEditMode(true);
      }
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (editForm.phone && selectedCustomer) {
          updateCustomer({
              ...selectedCustomer,
              ...editForm as Customer
          });
          setSelectedCustomer({ ...selectedCustomer, ...editForm as Customer });
          setIsEditMode(false);
      }
  };

  const activeStats = selectedCustomer ? getCustomerStats(selectedCustomer.phone) : null;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
        {/* Left List Panel */}
        <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Customers</h2>
                <input 
                    type="text" 
                    placeholder="Search name or phone..." 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredCustomers.map(customer => {
                    const dueAmount = getCustomerDue(customer.phone);
                    return (
                    <div 
                        key={customer.phone}
                        onClick={() => handleCustomerClick(customer)}
                        className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedCustomer?.phone === customer.phone ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''}`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-800">{customer.name}</h3>
                                <p className="text-sm text-slate-500">{customer.phone}</p>
                            </div>
                            {dueAmount > 1 && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                                    Due: ₹{Math.round(dueAmount)}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2 mt-2">
                             {customer.notes && (
                                <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">
                                    Note
                                </span>
                            )}
                            {customer.loyaltyPoints > 0 && (
                                <span className="inline-block text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold uppercase">
                                    {customer.loyaltyPoints} Pts
                                </span>
                            )}
                        </div>
                    </div>
                )})}
                {filteredCustomers.length === 0 && (
                    <div className="p-8 text-center text-slate-400">No customers found.</div>
                )}
            </div>
        </div>

        {/* Right Detail Panel */}
        <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
            {selectedCustomer && activeStats ? (
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="bg-white p-6 border-b border-slate-200 shadow-sm flex justify-between items-start">
                        <div>
                             <h1 className="text-3xl font-bold text-slate-800">{selectedCustomer.name}</h1>
                             <div className="flex gap-4 mt-2 text-slate-500">
                                 <span className="flex items-center gap-1">📞 {selectedCustomer.phone}</span>
                                 {selectedCustomer.email && <span className="flex items-center gap-1">✉️ {selectedCustomer.email}</span>}
                             </div>
                             {selectedCustomer.address && (
                                 <p className="text-sm text-slate-500 mt-1">📍 {selectedCustomer.address}</p>
                             )}
                        </div>
                        <button 
                            onClick={handleEditClick}
                            className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                        >
                            Edit Profile
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {isEditMode ? (
                            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-2xl">
                                <h3 className="text-lg font-bold mb-4">Edit Customer Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Name</label>
                                        <input 
                                          type="text" 
                                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800" 
                                          value={editForm.name || ''} 
                                          onChange={e => setEditForm({...editForm, name: e.target.value})} 
                                          required 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                        <input 
                                          type="email" 
                                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800" 
                                          value={editForm.email || ''} 
                                          onChange={e => setEditForm({...editForm, email: e.target.value})} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Phone (Read-only)</label>
                                        <input 
                                          type="text" 
                                          className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 outline-none" 
                                          value={editForm.phone || ''} 
                                          readOnly 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Address</label>
                                        <textarea 
                                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800" 
                                          value={editForm.address || ''} 
                                          onChange={e => setEditForm({...editForm, address: e.target.value})} 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Notes (VIP, Allergies, etc.)</label>
                                        <textarea 
                                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800" 
                                          value={editForm.notes || ''} 
                                          onChange={e => setEditForm({...editForm, notes: e.target.value})} 
                                        />
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-2">
                                    <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 text-slate-500">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Save Changes</button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Total Spent</p>
                                        <p className="text-2xl font-bold text-slate-800">₹{activeStats.totalSpent.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Total Visits</p>
                                        <p className="text-2xl font-bold text-slate-800">{activeStats.visitCount}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Avg Order Value</p>
                                        <p className="text-2xl font-bold text-slate-800">₹{Math.round(activeStats.avgOrderValue)}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Last Visit</p>
                                        <p className="text-lg font-bold text-slate-800 truncate">
                                            {selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Loyalty & Notes Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* Loyalty Card */}
                                    {loyaltySettings.enabled && (
                                        <div className="bg-gradient-to-br from-indigo-900 to-purple-800 p-6 rounded-xl text-white shadow-lg relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full transform translate-x-10 -translate-y-10"></div>
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
                                                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Loyalty Balance</p>
                                                        <h3 className="text-4xl font-bold mt-1">{selectedCustomer.loyaltyPoints || 0} <span className="text-lg opacity-70">Pts</span></h3>
                                                        <p className="text-xs text-indigo-300 mt-1">Value: ₹{(selectedCustomer.loyaltyPoints || 0) * loyaltySettings.redemptionValue}</p>
                                                    </div>
                                                    <div className="bg-white/20 p-2 rounded-lg">
                                                        <span className="text-2xl">👑</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                                    <div>
                                                        <p className="text-[10px] text-indigo-300 uppercase">Total Earned</p>
                                                        <p className="font-bold">{selectedCustomer.totalPointsEarned || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-indigo-300 uppercase">Total Redeemed</p>
                                                        <p className="font-bold">{selectedCustomer.totalPointsRedeemed || 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 h-full">
                                        <h3 className="font-bold text-amber-900 mb-2">📝 Notes & Preferences</h3>
                                        <p className="text-amber-800 whitespace-pre-wrap mb-4">{selectedCustomer.notes || "No notes added."}</p>
                                        
                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            {activeStats.topItems.map(item => (
                                                <span key={item} className="bg-white text-amber-700 px-2 py-1 rounded-md text-xs font-bold shadow-sm border border-amber-100">
                                                    ★ {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs Section for History */}
                                <div className="space-y-6">
                                    {/* Points History */}
                                    {loyaltySettings.enabled && (selectedCustomer.loyaltyHistory || []).length > 0 && (
                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex justify-between">
                                                <span>Points History</span>
                                                <span className="text-xs text-slate-400 font-normal">Last 5 transactions</span>
                                            </div>
                                            <table className="w-full text-left text-sm">
                                                <thead className="text-slate-500 border-b border-slate-100 bg-slate-50/50">
                                                    <tr>
                                                        <th className="p-3 font-medium">Date</th>
                                                        <th className="p-3 font-medium">Description</th>
                                                        <th className="p-3 font-medium text-center">Type</th>
                                                        <th className="p-3 font-medium text-right">Points</th>
                                                        <th className="p-3 font-medium text-right">Expiry</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {[...(selectedCustomer.loyaltyHistory || [])]
                                                        .sort((a, b) => b.date - a.date)
                                                        .slice(0, 5)
                                                        .map(tx => (
                                                        <tr key={tx.id} className="hover:bg-slate-50">
                                                            <td className="p-3 text-slate-600">{new Date(tx.date).toLocaleDateString()}</td>
                                                            <td className="p-3 text-slate-800">{tx.description || '-'}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                                                    tx.type === 'EARNED' ? 'bg-green-100 text-green-700' :
                                                                    tx.type === 'REDEEMED' ? 'bg-blue-100 text-blue-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {tx.type}
                                                                </span>
                                                            </td>
                                                            <td className={`p-3 text-right font-bold ${tx.type === 'EARNED' ? 'text-green-600' : 'text-red-500'}`}>
                                                                {tx.type === 'EARNED' ? '+' : '-'}{tx.points}
                                                            </td>
                                                            <td className="p-3 text-right text-xs text-slate-500">
                                                                {tx.expiryDate ? new Date(tx.expiryDate).toLocaleDateString() : '-'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Order History Table */}
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">Order History</div>
                                        <table className="w-full text-left text-sm">
                                            <thead className="text-slate-500 border-b border-slate-100">
                                                <tr>
                                                    <th className="p-4 font-medium">Date</th>
                                                    <th className="p-4 font-medium">Order ID</th>
                                                    <th className="p-4 font-medium">Items</th>
                                                    <th className="p-4 font-medium text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {activeStats.customerOrders.sort((a,b) => b.timestamp - a.timestamp).map(order => (
                                                    <tr key={order.id} className="hover:bg-slate-50">
                                                        <td className="p-4 text-slate-600">{new Date(order.timestamp).toLocaleDateString()}</td>
                                                        <td className="p-4 font-mono text-slate-500">#{order.id.slice(-6)}</td>
                                                        <td className="p-4 text-slate-800 max-w-xs truncate" title={(order.items || []).map(i => i.name).join(', ')}>
                                                            {(order.items || []).map(i => i.name).join(', ')}
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-slate-800">₹{order.total}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <span className="text-6xl mb-4">👥</span>
                    <p className="text-xl">Select a customer to view details</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default CRM;
