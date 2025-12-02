
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../App';
import { OrderStatus, Table, VariantOption } from '../types';

const Tables: React.FC = () => {
  const { tables, orders, addTable, removeTable } = useStore();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  // New Table State
  const [isAdding, setIsAdding] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableFloor, setNewTableFloor] = useState('Ground Floor');
  const [customFloor, setCustomFloor] = useState('');
  
  const [historyFilter, setHistoryFilter] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeFloorTab, setActiveFloorTab] = useState<string>('ALL');
  
  // New: State for Expanded History Item
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Update time every minute to refresh duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Determine if a table is currently occupied
  const getTableStatus = (tableId: string) => {
    const activeOrder = orders.find(
      o => o.tableId === tableId && 
      o.status !== OrderStatus.COMPLETED && 
      o.status !== OrderStatus.CANCELLED
    );
    return activeOrder ? 'OCCUPIED' : 'AVAILABLE';
  };

  const getActiveOrder = (tableId: string) => {
    return orders.find(
        o => o.tableId === tableId && 
        o.status !== OrderStatus.COMPLETED && 
        o.status !== OrderStatus.CANCELLED
    );
  };

  const getOccupiedDuration = (startTime: number, endTime: number = currentTime) => {
    const diff = Math.max(0, endTime - startTime);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Handle Add Table
  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTableName.trim()) {
      const floor = newTableFloor === 'CUSTOM' ? customFloor.trim() : newTableFloor;
      if (!floor) {
          alert("Please select or enter a floor name");
          return;
      }
      addTable(newTableName.trim(), floor);
      setNewTableName('');
      setCustomFloor('');
      setIsAdding(false);
    }
  };

  const handleGoToOrder = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation(); // Prevent opening history panel
    navigate('/pos', { state: { tableId } });
  };

  // Get History for Selected Table
  const getTableHistory = (tableId: string) => {
    return orders
      .filter(o => o.tableId === tableId)
      .filter(o => 
        o.id.toLowerCase().includes(historyFilter.toLowerCase()) ||
        new Date(o.timestamp).toLocaleDateString().includes(historyFilter) ||
        (o.customerName && o.customerName.toLowerCase().includes(historyFilter.toLowerCase())) ||
        (o.customerPhone && o.customerPhone.includes(historyFilter))
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  };

  const selectedTableHistory = selectedTable ? getTableHistory(selectedTable) : [];
  const totalRevenue = selectedTableHistory
    .filter(o => o.status !== OrderStatus.CANCELLED)
    .reduce((acc, curr) => acc + curr.total, 0);

  // Derive unique floors from existing tables
  const floors = useMemo(() => {
      const f = Array.from(new Set(tables.map(t => t.floor)));
      return ['ALL', ...f.sort()];
  }, [tables]);

  const filteredTables = useMemo(() => {
      if (activeFloorTab === 'ALL') return tables;
      return tables.filter(t => t.floor === activeFloorTab);
  }, [tables, activeFloorTab]);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Left Panel: Table Grid */}
      <div className={`${selectedTable ? 'w-1/2' : 'w-full'} flex flex-col p-6 transition-all duration-300 ease-in-out overflow-y-auto`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Tables</h2>
            <p className="text-slate-500 mt-1">Manage dining areas by floor</p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
          >
            <span>+ Add Table</span>
          </button>
        </div>

        {/* Floor Tabs */}
        {floors.length > 1 && (
            <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {floors.map(floor => (
                    <button
                        key={floor}
                        onClick={() => setActiveFloorTab(floor)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                            activeFloorTab === floor 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {floor}
                    </button>
                ))}
            </div>
        )}

        {isAdding && (
          <form onSubmit={handleAddTable} className="mb-6 bg-white p-5 rounded-xl shadow-md border border-indigo-100 animate-fade-in">
            <h3 className="font-bold text-slate-800 mb-4">Add New Table</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Table Name</label>
                    <input 
                    type="text" 
                    placeholder="e.g. T-12" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    autoFocus
                    required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Floor / Area</label>
                    <select
                        value={newTableFloor}
                        onChange={(e) => setNewTableFloor(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    >
                        <option value="Ground Floor">Ground Floor</option>
                        <option value="First Floor">First Floor</option>
                        <option value="Rooftop">Rooftop</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="CUSTOM">Custom...</option>
                    </select>
                </div>
                {newTableFloor === 'CUSTOM' && (
                     <div className="md:col-span-2">
                        <input 
                            type="text" 
                            placeholder="Enter custom floor name..." 
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                            value={customFloor}
                            onChange={(e) => setCustomFloor(e.target.value)}
                            required
                        />
                     </div>
                )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700">Save Table</button>
            </div>
          </form>
        )}
        
        {/* Table Grid */}
        {filteredTables.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-4xl mb-4">🍽️</p>
                <h3 className="text-xl font-bold text-slate-700">No tables configured</h3>
                <p className="text-slate-500 mb-6">Add your first table to get started</p>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-100"
                >
                  Create Table
                </button>
             </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredTables.map(table => {
                const status = getTableStatus(table.id);
                const activeOrder = getActiveOrder(table.id);
                return (
                <div 
                    key={table.id}
                    onClick={() => setSelectedTable(table.id)}
                    className={`
                    relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md flex flex-col justify-between min-h-[160px]
                    ${selectedTable === table.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-white bg-white'}
                    ${status === 'OCCUPIED' ? 'bg-red-50 border-red-100' : 'bg-white'}
                    `}
                >
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-xl text-slate-800">{table.name}</span>
                            <span className={`w-3 h-3 rounded-full ${status === 'OCCUPIED' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{table.floor}</span>
                        
                        <div className="text-sm mt-3">
                        {status === 'OCCUPIED' ? (
                            <div className="text-red-600 font-medium">
                            <p>Occupied</p>
                            <p className="text-xs opacity-75 mt-1">Order #{activeOrder?.id.slice(-4)}</p>
                            <p className="text-xs opacity-75">₹{activeOrder?.total}</p>
                            <div className="mt-2 flex items-center text-xs bg-red-100 text-red-700 px-2 py-1 rounded w-fit">
                                <span className="mr-1">⏱</span>
                                {activeOrder && getOccupiedDuration(activeOrder.timestamp)}
                            </div>
                            </div>
                        ) : (
                            <div className="text-emerald-600 font-medium">Available</div>
                        )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                        <button
                            onClick={(e) => handleGoToOrder(e, table.id)}
                            className={`text-sm font-bold px-4 py-1.5 rounded-lg transition-colors w-full ${
                                status === 'OCCUPIED' 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                        >
                            {status === 'OCCUPIED' ? 'View Order' : 'Take Order'}
                        </button>
                        
                        {/* Delete Button (Only if available) */}
                        {status === 'AVAILABLE' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${table.name}?`)) removeTable(table.id); }}
                            className="ml-2 text-slate-300 hover:text-red-500 p-1"
                            title="Delete Table"
                        >
                            ×
                        </button>
                        )}
                    </div>
                </div>
                );
            })}
            </div>
        )}
      </div>

      {/* Right Panel: History & Details */}
      {selectedTable && (
        <div className="w-1/2 bg-white border-l border-slate-200 shadow-xl flex flex-col h-full animate-slide-in-right">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                 {tables.find(t => t.id === selectedTable)?.name || selectedTable}
                <span className={`text-xs px-2 py-1 rounded-full ${getTableStatus(selectedTable) === 'OCCUPIED' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {getTableStatus(selectedTable)}
                </span>
              </h2>
              <p className="text-slate-500 text-sm mt-1">Order History & Analytics</p>
            </div>
            <button 
              onClick={() => setSelectedTable(null)} 
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {/* Stats Card */}
            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                 <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Total Revenue</p>
                 <p className="text-2xl font-bold text-indigo-900 mt-1">₹{totalRevenue.toLocaleString()}</p>
               </div>
               <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                 <p className="text-xs text-slate-500 font-bold uppercase">Total Orders</p>
                 <p className="text-2xl font-bold text-slate-700 mt-1">{selectedTableHistory.length}</p>
               </div>
            </div>

            {/* Filter */}
            <div className="mb-4">
              <input 
                type="text" 
                placeholder="Search by Date, Order ID or Customer..."
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              />
            </div>

            {/* List */}
            <div className="space-y-3">
              {selectedTableHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  No order history found for this table.
                </div>
              ) : (
                selectedTableHistory.map(order => {
                  const isFullyPaid = order.isFullyPaid !== false; // Default to true if undefined (legacy)
                  const dueAmount = order.total - (order.amountPaid || order.total);
                  const isExpanded = expandedOrderId === order.id;
                  
                  // Calculate occupied duration based on last payment time or order close
                  let completedAt = order.timestamp;
                  if (order.payments && order.payments.length > 0) {
                      const lastPayment = order.payments[order.payments.length - 1];
                      completedAt = lastPayment.timestamp;
                  }
                  const occupiedDuration = order.status === OrderStatus.COMPLETED 
                        ? getOccupiedDuration(order.timestamp, completedAt) 
                        : (order.status === OrderStatus.CANCELLED ? 'Cancelled' : 'Active');

                  return (
                  <div key={order.id} className={`border rounded-lg transition-all ${isExpanded ? 'border-indigo-200 shadow-md' : 'border-slate-100 hover:bg-slate-50'}`}>
                    
                    {/* Summary Header (Always Visible) */}
                    <div 
                        className="p-4 cursor-pointer"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                        <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 block">#{order.id.slice(-6)}</span>
                                {isExpanded && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Expanded View</span>}
                            </div>
                            <span className="text-xs text-slate-500">{new Date(order.timestamp).toLocaleString()}</span>
                            {/* Customer Info Display */}
                            {(order.customerName || order.customerPhone) && (
                                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                                    <span>👤 {order.customerName || 'Guest'}</span>
                                    {order.customerPhone && <span className="text-indigo-400">| {order.customerPhone}</span>}
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="font-bold text-slate-900 block">₹{order.total}</span>
                            {order.status === OrderStatus.CANCELLED ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-100 text-red-700">CANCELLED</span>
                            ) : !isFullyPaid ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-700">DUE: ₹{dueAmount}</span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-green-100 text-green-700">PAID</span>
                            )}
                        </div>
                        </div>
                        
                        {!isExpanded && (
                            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 mt-2 truncate">
                                {(order.items || []).map(i => `${i.qty} x ${i.name}`).join(', ')}
                            </div>
                        )}
                        
                        <div className="flex justify-center mt-1">
                             <div className={`text-slate-300 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</div>
                        </div>
                    </div>

                    {/* Detailed Dropdown View */}
                    {isExpanded && (
                        <div className="border-t border-indigo-100 bg-indigo-50/30 p-4 text-sm animate-fade-in rounded-b-lg">
                            
                            {/* Analytics Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                                <div className="bg-white p-2 rounded border border-slate-100">
                                    <p className="text-slate-400 font-bold uppercase mb-1">Time Analysis</p>
                                    <div className="space-y-1">
                                        <p className="flex justify-between"><span>Created:</span> <span className="font-mono text-slate-700">{new Date(order.timestamp).toLocaleTimeString()}</span></p>
                                        <p className="flex justify-between"><span>Occupied:</span> <span className="font-mono text-slate-700">{occupiedDuration}</span></p>
                                        {order.status === OrderStatus.COMPLETED && (
                                            <p className="flex justify-between"><span>Closed At:</span> <span className="font-mono text-slate-700">{new Date(completedAt).toLocaleTimeString()}</span></p>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-100">
                                     <p className="text-slate-400 font-bold uppercase mb-1">Service Info</p>
                                     <div className="space-y-1">
                                        <p>Staff: <span className="font-bold text-slate-700">{order.staffName || 'Unknown'}</span></p>
                                        <p>Table: <span className="font-bold text-slate-700">{order.tableId}</span></p>
                                        <p>Shift ID: <span className="font-mono text-slate-500">{order.shiftId || '-'}</span></p>
                                     </div>
                                </div>
                            </div>

                            {/* Detailed Items List */}
                            <div className="mb-4 bg-white rounded border border-slate-100 overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                        <tr>
                                            <th className="p-2">Item</th>
                                            <th className="p-2 text-right">Price</th>
                                            <th className="p-2 text-right">Qty</th>
                                            <th className="p-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(order.items || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-2">
                                                    <span className="font-medium text-slate-700">{item.name}</span>
                                                    {item.selectedVariants && (
                                                        <div className="text-[10px] text-slate-400">
                                                            {Object.values(item.selectedVariants).map((v: VariantOption) => v.name).join(', ')}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right">₹{item.price}</td>
                                                <td className="p-2 text-right">{item.qty}</td>
                                                <td className="p-2 text-right font-medium">₹{item.price * item.qty}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Financial Breakdown */}
                            <div className="bg-white p-3 rounded border border-slate-200 space-y-2 mb-4">
                                <div className="flex justify-between text-slate-600">
                                    <span>Subtotal</span>
                                    <span>₹{order.subtotal}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Tax (5%)</span>
                                    <span>₹{order.tax}</span>
                                </div>
                                
                                {/* Discount Section */}
                                <div className="flex justify-between text-red-600 items-start border-t border-dashed border-slate-100 pt-2 mt-1">
                                    <div className="flex flex-col">
                                        <span className="font-medium">Discount Applied</span>
                                        {order.discountNote ? (
                                             <span className="text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-100 mt-1 w-fit">{order.discountNote}</span>
                                        ) : order.discount > 0 ? (
                                             <span className="text-[10px] text-red-400 mt-0.5">General Discount</span>
                                        ) : null}
                                    </div>
                                    <span className="font-bold">-₹{order.discount}</span>
                                </div>

                                <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2 mt-1">
                                    <span>Grand Total</span>
                                    <span>₹{order.total}</span>
                                </div>
                            </div>

                            {/* Payment History */}
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold mb-2">Payment History</p>
                                {(order.payments || []).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No payments recorded.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {(order.payments || []).map((p, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold bg-slate-100 px-1.5 rounded">{p.method}</span>
                                                    <span className="text-slate-400">{new Date(p.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <span className="font-bold text-slate-700">₹{p.amount}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold text-xs text-slate-700">
                                            <span>Total Paid</span>
                                            <span>₹{order.amountPaid || 0}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                  </div>
                )})
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tables;
