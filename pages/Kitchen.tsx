
import React from 'react';
import { useStore } from '../App';
import { OrderStatus, CartItem } from '../types';

const Kitchen: React.FC = () => {
  const { orders, updateKotStatus, currentUser, logout } = useStore();

  // Get active orders
  // Logic: Show orders that are OPEN OR (COMPLETED but have unserved items)
  const activeOrders = orders.filter(o => {
      if (o.status === OrderStatus.CANCELLED) return false;
      
      // Always show open orders
      if (o.status === OrderStatus.OPEN) return true;

      // For completed/paid orders, only show if there are items pending (not SERVED)
      if (o.status === OrderStatus.COMPLETED) {
          return (o.items || []).some(item => item.status !== 'SERVED');
      }

      return false;
  }).sort((a, b) => b.timestamp - a.timestamp);

  // Group items by kotId
  const getKotsForOrder = (items: CartItem[]) => {
      const grouped: Record<string, CartItem[]> = {};
      (items || []).forEach(item => {
          // If status is SERVED, we skip it from the main view (Kitchen staff cleared it)
          if (item.status === 'SERVED') return;
          
          const key = item.kotId || 'UNKNOWN';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(item);
      });
      return grouped;
  };

  const handleMarkReady = (orderId: string, kotId: string) => {
      updateKotStatus(orderId, kotId, 'READY');
  };

  const handleMarkServed = (orderId: string, kotId: string) => {
      // Logic to clear from screen (mark as Served)
      updateKotStatus(orderId, kotId, 'SERVED');
  };

  const isChef = currentUser?.role === 'CHEF';

  return (
    <div className={`h-full bg-slate-100 overflow-y-auto ${isChef ? 'p-4' : 'p-8'}`}>
      
      {/* Header - Custom for Chef (Mobile Friendly) vs Standard */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
            <h2 className={`${isChef ? 'text-2xl' : 'text-3xl'} font-bold text-slate-800`}>Kitchen Display</h2>
            <p className="text-slate-500 text-sm">Active Orders: {activeOrders.length}</p>
        </div>
        
        {isChef ? (
             <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm">
                 <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                         {currentUser.name.charAt(0)}
                     </div>
                     <span className="text-sm font-bold text-slate-700">{currentUser.name}</span>
                 </div>
                 <button 
                    onClick={logout}
                    className="ml-4 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold hover:bg-red-200"
                 >
                    Log Out
                 </button>
             </div>
        ) : (
             <div className="flex space-x-2">
                <span className="px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200 font-bold text-slate-700">
                    Pending KOTs
                </span>
             </div>
        )}
      </div>

      {activeOrders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-4">👨‍🍳</p>
          <p className="text-xl font-medium">Kitchen is clear</p>
          <p>No active orders at the moment.</p>
        </div>
      ) : (
        <div className={`grid gap-4 ${isChef ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
          {activeOrders.map(order => {
             const kotGroups = getKotsForOrder(order.items);
             // Sort KOTs by timestamp (newest first usually, but KDS often shows oldest first to prep. Let's do newest top for visibility)
             const sortedKotKeys = Object.keys(kotGroups).sort().reverse(); 

             // If no active KOTs left for this order (all served), skip rendering the column
             if (sortedKotKeys.length === 0) return null;

             return (
                 <div key={order.id} className="space-y-4">
                     {sortedKotKeys.map(kotId => {
                         const items = kotGroups[kotId];
                         const timestamp = items[0].timestamp || Date.now();
                         
                         // Determine overall status of this KOT batch
                         // If all items are 'READY', the card is ready.
                         const isReady = items.every(i => i.status === 'READY');
                         
                         return (
                            <div key={`${order.id}_${kotId}`} className={`rounded-xl shadow-md border overflow-hidden flex flex-col animate-fade-in transition-all ${isReady ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20' : 'bg-white border-slate-200'}`}>
                                {/* Header */}
                                <div className={`p-3 border-b flex justify-between items-start ${isReady ? 'bg-emerald-100 border-emerald-200' : 'bg-amber-50 border-amber-100'}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-slate-800">Table {order.tableId}</h3>
                                            {order.status === OrderStatus.COMPLETED && (
                                                <span className="text-[10px] bg-green-200 text-green-800 px-1.5 rounded font-bold uppercase">PAID</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-mono bg-white px-1.5 rounded border border-slate-200 text-slate-600">#{kotId}</span>
                                            <span className="text-xs text-slate-500">{new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isReady ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                        {isReady ? 'Ready' : 'Preparing'}
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="p-4 space-y-3">
                                    {items.map((item, idx) => (
                                    <div key={`${kotId}_${idx}`} className="flex justify-between items-start text-sm">
                                        <div className="flex items-start space-x-3">
                                            <span className="font-bold w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-700">{item.qty}</span>
                                            <div>
                                                <span className="text-slate-800 font-bold block">{item.name}</span>
                                                {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                                                    <p className="text-xs text-slate-500 mt-1">
                                                    {Object.values(item.selectedVariants).map(v => v.name).join(', ')}
                                                    </p>
                                                )}
                                                {item.notes && <p className="text-xs text-red-500 italic mt-0.5">Note: {item.notes}</p>}
                                            </div>
                                        </div>
                                    </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="p-3 bg-white/50 border-t border-slate-100 flex gap-2">
                                    {isReady ? (
                                        <button 
                                            onClick={() => handleMarkServed(order.id, kotId)}
                                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 touch-manipulation"
                                        >
                                            <span>✓</span> Serve / Clear
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleMarkReady(order.id, kotId)}
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-sm touch-manipulation"
                                        >
                                            Mark Order Ready
                                        </button>
                                    )}
                                </div>
                            </div>
                         )
                     })}
                 </div>
             )
          })}
        </div>
      )}
    </div>
  );
};

export default Kitchen;
