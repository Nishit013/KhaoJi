
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../App';
import { OrderStatus, Table, VariantOption, Reservation, ReservationStatus } from '../types';

const Tables: React.FC = () => {
  const { tables, orders, reservations, addTable, removeTable, addReservation, updateReservationStatus, cancelOrder } = useStore();
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
  
  // Right Panel Tab State
  const [detailsTab, setDetailsTab] = useState<'ORDERS' | 'RESERVATIONS'>('ORDERS');
  
  // New: State for Expanded History Item
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Reservation Modal State
  const [showResModal, setShowResModal] = useState(false);
  const [resForm, setResForm] = useState({
      customerName: '',
      customerPhone: '+91',
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      guests: 2,
      notes: ''
  });
  const [resTableId, setResTableId] = useState<string>('');

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

  // Check for upcoming reservations within next 2 hours
  const getUpcomingReservation = (tableId: string) => {
      const now = Date.now();
      const twoHoursLater = now + (2 * 60 * 60 * 1000);
      return reservations.find(r => 
          r.tableId === tableId && 
          r.status === ReservationStatus.CONFIRMED && 
          r.reservationTime > now && 
          r.reservationTime < twoHoursLater
      );
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

  const handleDeleteTable = (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      console.log('Delete requested for:', id, name);
      
      if (window.confirm(`Are you sure you want to delete ${name}?`)) {
          removeTable(id);
      }
  };

  const handleCancelOrder = (orderId: string) => {
    const reason = prompt("Enter cancellation reason (Optional):");
    if (reason !== null) {
      if (window.confirm("Are you sure you want to CANCEL this order? This action cannot be undone.")) {
        cancelOrder(orderId, reason || "No reason provided");
      }
    }
  };

  // Open Reservation Modal
  const openReservationModal = (e: React.MouseEvent, tableId: string) => {
      e.stopPropagation();
      setResTableId(tableId);
      setShowResModal(true);
  };

  const handleReservationSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const dateTimeString = `${resForm.date}T${resForm.time}`;
      const timestamp = new Date(dateTimeString).getTime();

      if (timestamp < Date.now()) {
          alert("Reservation time must be in the future.");
          return;
      }

      addReservation({
          tableId: resTableId,
          customerName: resForm.customerName,
          customerPhone: resForm.customerPhone,
          reservationTime: timestamp,
          guests: resForm.guests,
          notes: resForm.notes,
          status: ReservationStatus.CONFIRMED
      });

      // WhatsApp Notification
      if (resForm.customerPhone && resForm.customerPhone.length > 4) {
          const dateStr = new Date(timestamp).toLocaleDateString();
          const timeStr = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const tableInfo = tables.find(t => t.id === resTableId);
          const tableName = tableInfo ? tableInfo.name : resTableId;
          
          const message = `*Reservation Confirmed!* ✅%0a%0aHello ${resForm.customerName},%0aYour reservation at *KhaoJi* is confirmed.%0a%0a📅 *Date:* ${dateStr}%0a⏰ *Time:* ${timeStr}%0a👥 *Guests:* ${resForm.guests}%0a🍽️ *Table:* ${tableName}%0a%0aThank you!`;
          
          window.open(`https://wa.me/${resForm.customerPhone}?text=${message}`, '_blank');
      }

      setShowResModal(false);
      setResForm({
        customerName: '',
        customerPhone: '+91',
        date: new Date().toISOString().split('T')[0],
        time: '19:00',
        guests: 2,
        notes: ''
      });
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

  // Get Reservations for Selected Table
  const getTableReservations = (tableId: string) => {
      return reservations
        .filter(r => r.tableId === tableId)
        .sort((a, b) => b.reservationTime - a.reservationTime); // Newest first
  };

  const selectedTableHistory = selectedTable ? getTableHistory(selectedTable) : [];
  const selectedTableReservations = selectedTable ? getTableReservations(selectedTable) : [];

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
                const upcomingRes = getUpcomingReservation(table.id);

                return (
                <div 
                    key={table.id}
                    onClick={() => setSelectedTable(table.id)}
                    className={`
                    relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md flex flex-col justify-between min-h-[160px] group
                    ${selectedTable === table.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-white bg-white'}
                    ${status === 'OCCUPIED' ? 'bg-red-50 border-red-100' : 'bg-white'}
                    `}
                >
                    {/* Delete Button (Fixed Position) */}
                    {status === 'AVAILABLE' && (
                        <button 
                            onClick={(e) => handleDeleteTable(e, table.id, table.name)}
                            className="absolute top-2 right-2 p-2 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all z-20 shadow-sm border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100"
                            title="Delete Table"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}

                    {/* Reserve Button (Only if not occupied) */}
                    {status === 'AVAILABLE' && !upcomingRes && (
                        <button 
                            onClick={(e) => openReservationModal(e, table.id)}
                            className="absolute top-2 right-10 p-2 bg-white text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-all z-20 shadow-sm border border-transparent hover:border-purple-100 opacity-0 group-hover:opacity-100"
                            title="Book Table"
                        >
                            <span className="text-lg">📅</span>
                        </button>
                    )}

                    <div>
                        <div className="flex justify-between items-start mb-2 pr-8">
                            <span className="font-bold text-xl text-slate-800 break-words leading-tight">{table.name}</span>
                            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${status === 'OCCUPIED' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{table.floor}</span>
                        
                        <div className="text-sm mt-3">
                        {status === 'OCCUPIED' ? (
                            <div className="text-red-600 font-medium">
                            <p>Occupied</p>
                            <p className="text-xs opacity-75 mt-1">Order #{activeOrder?.id.slice(-4)}</p>
                            <div className="mt-2 flex items-center text-xs bg-red-100 text-red-700 px-2 py-1 rounded w-fit">
                                <span className="mr-1">⏱</span>
                                {activeOrder && getOccupiedDuration(activeOrder.timestamp)}
                            </div>
                            </div>
                        ) : upcomingRes ? (
                            <div className="text-purple-600 font-medium animate-pulse">
                                <p>Reserved</p>
                                <p className="text-xs text-purple-500 mt-1">@ {new Date(upcomingRes.reservationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                <p className="text-xs text-purple-500">{upcomingRes.customerName}</p>
                            </div>
                        ) : (
                            <div className="text-emerald-600 font-medium">Available</div>
                        )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                        <button
                            onClick={(e) => handleGoToOrder(e, table.id)}
                            className={`w-full text-sm font-bold px-4 py-2 rounded-lg transition-colors ${
                                status === 'OCCUPIED' 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                        >
                            {status === 'OCCUPIED' ? 'View Order' : 'Take Order'}
                        </button>
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
            </div>
            <button 
              onClick={() => setSelectedTable(null)} 
              className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* TABS for Right Panel */}
          <div className="flex border-b border-slate-200">
              <button 
                onClick={() => setDetailsTab('ORDERS')}
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 ${detailsTab === 'ORDERS' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
              >
                  Order History
              </button>
              <button 
                onClick={() => setDetailsTab('RESERVATIONS')}
                className={`flex-1 py-3 text-sm font-bold text-center border-b-2 ${detailsTab === 'RESERVATIONS' ? 'border-purple-600 text-purple-700 bg-purple-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
              >
                  Reservations
              </button>
          </div>

          {detailsTab === 'ORDERS' ? (
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
                    No order history found.
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
                                <span className="text-xs text-slate-500">{new Date(order.timestamp).toLocaleTimeString()}</span>
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
                            <div className="border-t border-indigo-100 bg-white p-4 text-sm animate-fade-in rounded-b-lg shadow-inner">
                                
                                {/* 1. Header Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-4 text-xs text-slate-500 border-b border-slate-100 pb-3">
                                     <div>
                                        <p>Created: <span className="font-bold text-slate-700">{new Date(order.timestamp).toLocaleString()}</span></p>
                                        <p>Staff: <span className="font-bold text-slate-700">{order.staffName || 'Unknown'}</span></p>
                                     </div>
                                     <div className="text-right">
                                        <p>Duration: <span className="font-bold text-slate-700">{occupiedDuration}</span></p>
                                        <p>Customer: <span className="font-bold text-slate-700">{order.customerName || 'Guest'}</span></p>
                                     </div>
                                </div>

                                {/* 2. Item List */}
                                <div className="mb-4">
                                    <table className="w-full text-xs text-left">
                                        <thead className="text-slate-400 font-bold uppercase border-b border-slate-100">
                                            <tr>
                                                <th className="py-2">Item</th>
                                                <th className="py-2 text-right">Qty</th>
                                                <th className="py-2 text-right">Price</th>
                                                <th className="py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-slate-700">
                                            {(order.items || []).map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-2">
                                                        <div className="font-medium">{item.name}</div>
                                                        {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                                                            <div className="text-[10px] text-slate-400">
                                                                {Object.values(item.selectedVariants).map((v: any) => v.name).join(', ')}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 text-right">{item.qty}</td>
                                                    <td className="py-2 text-right">₹{item.price}</td>
                                                    <td className="py-2 text-right font-bold">₹{item.price * item.qty}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* 3. Bill Summary */}
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 text-sm">
                                     <div className="flex justify-between text-slate-600">
                                         <span>Subtotal</span>
                                         <span>₹{order.subtotal}</span>
                                     </div>
                                     <div className="flex justify-between text-slate-600">
                                         <span>Tax (5%)</span>
                                         <span>₹{order.tax}</span>
                                     </div>
                                     {order.discount > 0 && (
                                         <div className="flex justify-between text-red-500">
                                             <span>Discount {order.discountNote ? `(${order.discountNote})` : ''}</span>
                                             <span>-₹{order.discount}</span>
                                         </div>
                                     )}
                                     <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                                         <span>Grand Total</span>
                                         <span className="text-lg">₹{order.total}</span>
                                     </div>
                                </div>

                                {/* 4. Payment History */}
                                {(order.payments || []).length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-2">Payment History</p>
                                        <div className="space-y-1">
                                            {order.payments.map((p, i) => (
                                                <div key={i} className="flex justify-between text-xs text-slate-600">
                                                    <span>{new Date(p.timestamp).toLocaleTimeString()} - {p.method}</span>
                                                    <span className="font-bold text-emerald-600">₹{p.amount}</span>
                                                </div>
                                            ))}
                                        </div>
                                         {dueAmount > 0.5 && (
                                             <div className="flex justify-between text-xs font-bold text-red-600 mt-2 pt-2 border-t border-dashed border-slate-200">
                                                 <span>Pending Due</span>
                                                 <span>₹{dueAmount}</span>
                                             </div>
                                         )}
                                    </div>
                                )}

                                {/* 5. Cancel Action for Active Orders */}
                                {order.status === OrderStatus.OPEN && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <button 
                                            onClick={() => handleCancelOrder(order.id)}
                                            className="w-full text-center text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors"
                                        >
                                            Cancel This Order
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    )})
                )}
                </div>
              </div>
          ) : (
             // RESERVATIONS PANEL
             <div className="p-6 flex-1 overflow-y-auto">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-slate-700">Reservation History</h3>
                     <button 
                       onClick={(e) => openReservationModal(e, selectedTable!)}
                       className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold shadow hover:bg-purple-700"
                     >
                         + New Booking
                     </button>
                 </div>

                 <div className="space-y-4">
                     {selectedTableReservations.length === 0 ? (
                         <div className="text-center py-10 text-slate-400">
                             No reservations found for this table.
                         </div>
                     ) : (
                         selectedTableReservations.map(res => {
                             const isUpcoming = res.reservationTime > Date.now();
                             const isConfirmed = res.status === ReservationStatus.CONFIRMED;

                             return (
                                 <div key={res.id} className={`p-4 rounded-xl border relative ${isConfirmed ? 'bg-white border-purple-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                                     {isConfirmed && isUpcoming && (
                                         <span className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">UPCOMING</span>
                                     )}
                                     
                                     <div className="flex justify-between items-start mb-2">
                                         <div>
                                             <h4 className="font-bold text-slate-800">{res.customerName}</h4>
                                             <p className="text-sm text-slate-500">{res.customerPhone}</p>
                                         </div>
                                         <div className="text-right">
                                             <p className="font-mono font-bold text-slate-800">{new Date(res.reservationTime).toLocaleDateString()}</p>
                                             <p className="text-sm text-slate-500">{new Date(res.reservationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                         </div>
                                     </div>

                                     <div className="flex gap-4 text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded">
                                         <span className="font-semibold">👥 {res.guests} Guests</span>
                                         {res.notes && <span className="italic">"{res.notes}"</span>}
                                     </div>

                                     {isConfirmed && (
                                         <div className="flex gap-2 border-t border-dashed border-slate-200 pt-2">
                                             <button 
                                                 onClick={() => updateReservationStatus(res.id, ReservationStatus.COMPLETED)}
                                                 className="flex-1 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded hover:bg-green-100"
                                             >
                                                 ✓ Arrived
                                             </button>
                                             <button 
                                                  onClick={() => updateReservationStatus(res.id, ReservationStatus.CANCELLED)}
                                                  className="flex-1 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded hover:bg-red-100"
                                             >
                                                 × Cancel
                                             </button>
                                             <button 
                                                  onClick={() => updateReservationStatus(res.id, ReservationStatus.NO_SHOW)}
                                                  className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded hover:bg-slate-200"
                                             >
                                                 No Show
                                             </button>
                                         </div>
                                     )}
                                     
                                     {!isConfirmed && (
                                          <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                                              {res.status}
                                          </div>
                                     )}
                                 </div>
                             );
                         })
                     )}
                 </div>
             </div>
          )}
        </div>
      )}

      {/* Reservation Modal */}
      {showResModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-scale-up">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800">New Reservation</h3>
                      <button onClick={() => setShowResModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                  </div>

                  <form onSubmit={handleReservationSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                              <input 
                                  type="date" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  value={resForm.date}
                                  onChange={e => setResForm({...resForm, date: e.target.value})}
                                  required
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time</label>
                              <input 
                                  type="time" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  value={resForm.time}
                                  onChange={e => setResForm({...resForm, time: e.target.value})}
                                  required
                              />
                           </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Guest Name</label>
                              <input 
                                  type="text" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  placeholder="John Doe"
                                  value={resForm.customerName}
                                  onChange={e => setResForm({...resForm, customerName: e.target.value})}
                                  required
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                              <input 
                                  type="tel" 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  placeholder="+91..."
                                  value={resForm.customerPhone}
                                  onChange={e => setResForm({...resForm, customerPhone: e.target.value})}
                                  required
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Guests</label>
                              <input 
                                  type="number" 
                                  min="1"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  value={resForm.guests}
                                  onChange={e => setResForm({...resForm, guests: parseInt(e.target.value)})}
                                  required
                              />
                           </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (Optional)</label>
                              <textarea 
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                  placeholder="Anniversary, High Chair, etc."
                                  value={resForm.notes}
                                  onChange={e => setResForm({...resForm, notes: e.target.value})}
                                  rows={2}
                              />
                           </div>
                      </div>

                      <div className="pt-2 flex gap-3">
                          <button 
                             type="button" 
                             onClick={() => setShowResModal(false)}
                             className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl"
                          >
                              Cancel
                          </button>
                          <button 
                             type="submit" 
                             className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md"
                          >
                              Confirm Booking
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Tables;
