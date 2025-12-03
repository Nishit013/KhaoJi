
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../App';
import { Product, PaymentMethod, VariantOption, OrderStatus, Payment, Order } from '../types';

const POS: React.FC = () => {
  const { products, categories, addToCart, cart, removeFromCart, updateCartItemQty, clearCart, sendToKitchen, settleOrder, settleCustomerDue, tables, orders, customers, loyaltySettings } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedTable, setSelectedTable] = useState<string>(
    (location.state as any)?.tableId || tables[0]?.id || ''
  );
  
  useEffect(() => {
    if (!selectedTable && tables.length > 0) {
      setSelectedTable(tables[0].id);
    }
  }, [tables, selectedTable]);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('FLAT');
  const [discountInput, setDiscountInput] = useState('');
  
  const [showKotModal, setShowKotModal] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  
  const [activePaymentMode, setActivePaymentMode] = useState<PaymentMethod | 'DUE'>(PaymentMethod.CASH);
  const [tenderAmount, setTenderAmount] = useState('');
  const [partialPayments, setPartialPayments] = useState<Payment[]>([]);

  const [redeemPoints, setRedeemPoints] = useState(false);

  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, VariantOption>>({});

  useEffect(() => {
    clearCart();
  }, [selectedTable]);

  const isDelivery = useMemo(() => {
     const table = tables.find(t => t.id === selectedTable);
     return table?.name.toLowerCase().includes('delivery');
  }, [selectedTable, tables]);

  const activeOrder = orders.find(o => o.tableId === selectedTable && o.status === OrderStatus.OPEN);

  useEffect(() => {
      if (activeOrder) {
          setCustomerName(activeOrder.customerName || '');
          setCustomerPhone(activeOrder.customerPhone || '+91');
          setDeliveryAddress(activeOrder.deliveryAddress || '');
      } else {
          if (cart.length === 0 && !showKotModal && !showCheckoutModal) {
              setCustomerName('');
              setCustomerPhone('+91');
              setDeliveryAddress('');
          }
      }
  }, [activeOrder, selectedTable]);

  const currentCustomer = useMemo(() => {
      return customers.find(c => c.phone === customerPhone);
  }, [customerPhone, customers]);

  useEffect(() => {
      if (customerPhone.length >= 3 && currentCustomer) {
          setCustomerName(currentCustomer.name);
          setCustomerEmail(currentCustomer.email || '');
          if (!deliveryAddress) setDeliveryAddress(currentCustomer.address || '');
      } else if (customerPhone.length < 3) {
           setRedeemPoints(false);
      }
  }, [customerPhone, currentCustomer]);

  const customerHistoryOrders = useMemo(() => {
    if (!customerPhone || customerPhone.length < 3) return [];
    return orders.filter(o => o.customerPhone === customerPhone && o.status === OrderStatus.COMPLETED)
                 .sort((a, b) => b.timestamp - a.timestamp);
  }, [customerPhone, orders]);

  const customerTotalDue = useMemo(() => {
    return customerHistoryOrders.reduce((acc, order) => {
        return acc + (order.total - order.amountPaid);
    }, 0);
  }, [customerHistoryOrders]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cartTax = Math.round(cartSubtotal * 0.05); 
  const cartTotal = cartSubtotal + cartTax;

  const runningSubtotal = activeOrder ? activeOrder.subtotal : 0;
  const runningTax = activeOrder ? activeOrder.tax : 0;
  const runningTotal = activeOrder ? activeOrder.total : 0;

  const finalSubtotal = runningSubtotal + cartSubtotal;
  const finalTax = runningTax + cartTax;
  const finalTotal = finalSubtotal + finalTax;

  const canRedeemLoyalty = useMemo(() => {
      if (!loyaltySettings.enabled || !currentCustomer || !redeemPoints) return false;
      if (finalTotal < loyaltySettings.minOrderValueToRedeem) return false;
      if ((currentCustomer.loyaltyPoints || 0) < loyaltySettings.minPointsToRedeem) return false;
      return true;
  }, [loyaltySettings, currentCustomer, redeemPoints, finalTotal]);

  const maxRedeemablePoints = useMemo(() => {
       if (!canRedeemLoyalty || !currentCustomer) return 0;
       const billValueInPoints = Math.ceil(finalTotal / loyaltySettings.redemptionValue);
       return Math.min(currentCustomer.loyaltyPoints, billValueInPoints);
  }, [canRedeemLoyalty, currentCustomer, finalTotal, loyaltySettings]);
  
  const loyaltyDiscountValue = useMemo(() => {
      return maxRedeemablePoints * loyaltySettings.redemptionValue;
  }, [maxRedeemablePoints, loyaltySettings]);

  const calculatedManualDiscount = useMemo(() => {
    const val = parseFloat(discountInput) || 0;
    if (val <= 0) return 0;
    if (discountType === 'FLAT') {
        return Math.min(val, finalTotal); 
    } else {
        const percent = Math.min(val, 100);
        return Math.round((finalTotal * percent) / 100);
    }
  }, [discountType, discountInput, finalTotal]);

  const totalDiscount = Math.min(finalTotal, calculatedManualDiscount + loyaltyDiscountValue);

  const totalPayable = Math.max(0, finalTotal - totalDiscount);
  const currentPaid = partialPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingDue = Math.max(0, totalPayable - currentPaid);

  useEffect(() => {
    if (showCheckoutModal && activePaymentMode !== 'DUE') {
        setTenderAmount(remainingDue.toString());
    } else if (activePaymentMode === 'DUE') {
        setTenderAmount('0');
    }
  }, [remainingDue, activePaymentMode, showCheckoutModal]);

  const handleProductClick = (product: Product) => {
    if (product.stock <= 0) return; 

    if (product.variants && product.variants.length > 0) {
      const initialSelections: Record<string, VariantOption> = {};
      product.variants.forEach(group => {
        if (group.options.length > 0) {
          initialSelections[group.id] = group.options[0];
        }
      });
      setSelectedVariants(initialSelections);
      setVariantModalProduct(product);
    } else {
      addToCart(product);
    }
  };

  const handleAddVariantItem = () => {
    if (variantModalProduct) {
      addToCart(variantModalProduct, selectedVariants);
      setVariantModalProduct(null);
      setSelectedVariants({});
    }
  };

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    setShowKotModal(true);
  };

  const handleConfirmKot = async () => {
      const kotId = await sendToKitchen(selectedTable, customerName, customerPhone);
      
      if (customerPhone && kotId) {
          const tableInfo = tables.find(t => t.id === selectedTable)?.name || selectedTable;
          const itemsList = cart.map(i => `${i.qty} x ${i.name}`).join('%0a');
          
          const message = `*Order Placed!* 🍽️%0a%0aHello ${customerName || 'Customer'},%0aYour order at *NexPOS* has been received.%0a%0a*KOT Number:* ${kotId}%0a*Table:* ${tableInfo}%0a%0a*Items:*%0a${itemsList}%0a%0aThank you!`;
          
          window.open(`https://wa.me/${customerPhone}?text=${message}`, '_blank');
      }

      setShowKotModal(false);
      alert(`KOT ${kotId} generated for Table ${selectedTable}`);
  };

  const handleOpenCheckout = () => {
    if(cart.length > 0) {
        alert("Please send current items to kitchen before settling, or remove them.");
        return;
    }
    if(!activeOrder) return;
    
    setDiscountType('FLAT');
    setDiscountInput('');
    setPartialPayments([]);
    setRedeemPoints(false);
    setActivePaymentMode(PaymentMethod.CASH);
    setShowCheckoutModal(true);
  };

  // --- WhatsApp Bill Generator ---
  const sendBillWhatsapp = (
      order: Order, 
      subtotal: number, 
      tax: number, 
      discount: number, 
      total: number, 
      statusText: string
  ) => {
      if (!customerPhone) return;

      const dateStr = new Date().toLocaleString();
      const tableInfo = tables.find(t => t.id === selectedTable)?.name || selectedTable;
      
      // Header
      let text = `🧾 *Bill Receipt - NexPOS*\n\n`;
      text += `📅 *Date:* ${dateStr}\n`;
      text += `🔢 *Order No:* #${order.id.slice(-6)}\n`;
      text += `🍽️ *Table:* ${tableInfo}\n`;
      if (customerName) text += `👤 *Customer:* ${customerName}\n`;
      
      // Items
      text += `--------------------------------\n`;
      text += `*ORDER DETAILS*\n`;
      
      (order.items || []).forEach((item, index) => {
          const itemTotal = item.price * item.qty;
          let itemLine = `${index + 1}. ${item.name} (x${item.qty}) = ₹${itemTotal}`;
          // Add variants if any
          if(item.selectedVariants && Object.keys(item.selectedVariants).length > 0) {
              const vText = Object.values(item.selectedVariants).map(v => v.name).join(', ');
              itemLine += `\n   _Options: ${vText}_`;
          }
          text += `${itemLine}\n`;
      });
      
      // Totals
      text += `--------------------------------\n`;
      text += `Subtotal: ₹${subtotal}\n`;
      text += `Tax (5%): ₹${tax}\n`;
      if (discount > 0) text += `Discount: -₹${discount}\n`;
      text += `*GRAND TOTAL: ₹${total}*\n`;
      text += `--------------------------------\n`;
      text += `Status: ${statusText}\n`;
      text += `\nThank you for visiting! 🙏`;

      // Encode and Open
      const encodedText = encodeURIComponent(text);
      window.open(`https://wa.me/${customerPhone}?text=${encodedText}`, '_blank');
  };

  const processPayment = () => {
    if (isDelivery && !deliveryAddress.trim()) {
        alert("Delivery Address is required for delivery orders.");
        return;
    }

    if (!activeOrder) return;

    // Capture current snapshot of values for bill generation
    const currentOrderSnapshot = { ...activeOrder };
    const billSubtotal = finalSubtotal;
    const billTax = finalTax;
    const billDiscount = totalDiscount;
    const billTotal = totalPayable;

    const notesArr = [];
    if (calculatedManualDiscount > 0) notesArr.push(`Manual (${discountType})`);
    if (loyaltyDiscountValue > 0) notesArr.push(`Loyalty (${maxRedeemablePoints} pts)`);
    const discountNote = notesArr.join(' + ');

    // 1. Handle DUE Mode
    if (activePaymentMode === 'DUE') {
        if (remainingDue > 0 && !customerPhone) {
            alert("Customer Phone Number is required to record due/credit.");
            return;
        }
        settleOrder(selectedTable, partialPayments, totalDiscount, discountNote, customerName, customerPhone, deliveryAddress, customerEmail, maxRedeemablePoints);
        
        if (customerPhone) {
            sendBillWhatsapp(currentOrderSnapshot, billSubtotal, billTax, billDiscount, billTotal, `⚠️ Payment Due (₹${remainingDue})`);
        }

        setShowCheckoutModal(false);
        alert(`Bill closed. ₹${remainingDue} marked as due.`);
        return;
    }

    const amount = parseFloat(tenderAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    if (amount >= remainingDue) {
        // Full Settlement
        const finalPaymentAmount = remainingDue;
        const change = amount - remainingDue;
        
        const finalPayment: Payment = {
            method: activePaymentMode,
            amount: finalPaymentAmount,
            timestamp: Date.now()
        };
        
        const allPayments = [...partialPayments, finalPayment];
        
        settleOrder(selectedTable, allPayments, totalDiscount, discountNote, customerName, customerPhone, deliveryAddress, customerEmail, maxRedeemablePoints);
        
        if (customerPhone) {
            sendBillWhatsapp(currentOrderSnapshot, billSubtotal, billTax, billDiscount, billTotal, `✅ Paid via ${activePaymentMode}`);
        }

        setShowCheckoutModal(false);
        
        if (change > 0) {
            alert(`Bill Settled! Change to return: ₹${change}`);
        } else {
            alert(`Bill Settled!`);
        }
    } else {
        // Partial Payment
        const newPayment: Payment = {
            method: activePaymentMode,
            amount: amount,
            timestamp: Date.now()
        };
        setPartialPayments([...partialPayments, newPayment]);
    }
  };

  const handleRemovePartialPayment = (index: number) => {
      const updated = [...partialPayments];
      updated.splice(index, 1);
      setPartialPayments(updated);
  };

  const handleSettleCustomerDue = (amount: number, method: PaymentMethod) => {
    if (amount <= 0) return;
    const payment: Payment = { method, amount, timestamp: Date.now() };
    settleCustomerDue(customerPhone, payment);
    alert(`Received ₹${amount} via ${method}. Customer due updated.`);
  };

  const getVariantTotalPrice = () => {
    if (!variantModalProduct) return 0;
    let price = variantModalProduct.price;
    Object.values(selectedVariants).forEach((v: VariantOption) => price += v.priceModifier);
    return price;
  };

  if (tables.length === 0) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-100 flex-col space-y-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                  <div className="text-5xl mb-4">🍽️</div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">No Tables Configured</h2>
                  <p className="text-slate-500 mb-6">You need to set up tables or service areas before you can start billing.</p>
                  <button 
                    onClick={() => navigate('/tables')}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30"
                  >
                      Go to Tables Management
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen overflow-hidden pt-4 bg-slate-100">
      {/* Left Side: Menu & Products */}
      <div className="flex-1 flex flex-col p-4 pr-2 overflow-hidden">
        {/* Header / Search */}
        <div className="mb-4 flex gap-4">
          <button 
            onClick={() => navigate('/tables')}
            className="px-3 py-3 bg-white text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
            title="Back to Tables"
          >
            ← Back
          </button>
          <input
            type="text"
            placeholder="Search items by name or code..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none w-32"
          >
            {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Categories */}
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
              selectedCategory === 'ALL' 
              ? 'bg-slate-800 text-white shadow-md' 
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20 content-start">
          {filteredProducts.map((product) => {
             const isAvailable = product.stock > 0;
             return (
            <div
              key={product.id}
              onClick={() => handleProductClick(product)}
              className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 transition-all flex flex-col justify-between group h-36 relative overflow-hidden ${isAvailable ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 active:scale-95' : 'cursor-not-allowed opacity-60 grayscale-[0.8]'}`}
            >
              {!isAvailable && (
                  <div className="absolute inset-0 bg-white/40 z-10 flex items-center justify-center">
                      <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transform -rotate-6 tracking-wide">UNAVAILABLE</span>
                  </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-1">
                   <div className={`w-3 h-3 rounded-full mt-1 ${product.isVeg ? 'bg-green-500' : 'bg-red-500'}`} title={product.isVeg ? 'Vegetarian' : 'Non-Vegetarian'} />
                   
                   {product.variants && product.variants.length > 0 && (
                     <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                       Custom
                     </span>
                   )}
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1 leading-snug line-clamp-2">{product.name}</h3>
              </div>
              
              <div className="mt-2 flex justify-between items-end">
                <span className="font-bold text-base text-indigo-700">₹{product.price}</span>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Right Side: Cart & Bill */}
      <div className="w-96 bg-white shadow-xl flex flex-col border-l border-slate-200 h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-slate-800">Billing</h2>
            <p className="text-xs text-slate-500">
                {activeOrder ? `Order #${activeOrder.id.slice(-6)} (Open)` : 'New Order'}
            </p>
          </div>
          <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">
            {tables.find(t => t.id === selectedTable)?.name || selectedTable}
          </div>
        </div>

        {/* Order Items Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {activeOrder && (activeOrder.items || []).length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sent to Kitchen</h3>
                <div className="space-y-3 opacity-80">
                    {(activeOrder.items || []).map((item, idx) => (
                        <div key={`run_${idx}`} className="flex justify-between items-start text-sm">
                            <div className="flex-1">
                                <span className="font-medium text-slate-800">{item.name}</span>
                                <div className="text-xs text-slate-500">
                                    {item.qty} x ₹{item.price} 
                                    {item.selectedVariants && ` (+${Object.values(item.selectedVariants).map((v: VariantOption) => v.name).join(', ')})`}
                                </div>
                            </div>
                            <span className="font-semibold text-slate-700">₹{item.price * item.qty}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 pt-2 border-t border-dashed border-slate-200 flex justify-between text-sm font-semibold text-slate-600">
                    <span>Running Total</span>
                    <span>₹{activeOrder.total}</span>
                </div>
              </div>
          )}

          <div className="relative">
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1 z-10">
                Current Selection {cart.length > 0 && '(Not Sent)'}
            </h3>
            {cart.length === 0 ? (
                <div className={`text-center py-6 text-slate-400 border-2 border-dashed rounded-lg ${!activeOrder ? 'block' : 'hidden'}`}>
                <span className="text-2xl block mb-2">🛒</span>
                <p className="text-sm">Select items to add</p>
                </div>
            ) : (
                <div className="space-y-4">
                {cart.map((item, idx) => (
                    <div key={`cart_${idx}`} className="flex justify-between items-start group bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <div className="flex-1">
                            <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                            {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                {Object.values(item.selectedVariants).map((v: VariantOption) => v.name).join(', ')}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">₹{item.price} x {item.qty}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => updateCartItemQty(item.id, item.qty - 1, item.selectedVariants)}
                                className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50"
                            >-</button>
                            <span className="text-sm font-semibold w-4 text-center">{item.qty}</span>
                            <button 
                                onClick={() => updateCartItemQty(item.id, item.qty + 1, item.selectedVariants)}
                                className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100"
                            >+</button>
                            <button 
                                onClick={() => removeFromCart(item.id, item.selectedVariants)}
                                className="text-slate-300 hover:text-red-500 ml-1"
                            >&times;</button>
                        </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          
          <div className="flex justify-between items-end mb-4">
              <div className="text-sm text-slate-500">
                  <p>Subtotal: ₹{finalSubtotal}</p>
                  <p>Tax (5%): ₹{finalTax}</p>
              </div>
              <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase font-bold">Total Payable</p>
                  <p className="text-2xl font-bold text-slate-800">₹{finalTotal}</p>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <button
                disabled={cart.length === 0}
                onClick={handleSendToKitchen}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center"
             >
                <span>Send to Kitchen</span>
                {cart.length > 0 && <span className="text-[10px] font-normal opacity-90">({cart.length} new items)</span>}
             </button>

             <button
                disabled={!activeOrder && cart.length === 0}
                onClick={handleOpenCheckout}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex flex-col items-center justify-center"
             >
                <span>Settle Bill</span>
                <span className="text-[10px] font-normal opacity-90">Print & Close</span>
             </button>
          </div>
        </div>
      </div>

      {/* KOT Customer Details Modal */}
      {showKotModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
                  <div className="text-center mb-6">
                      <span className="text-3xl">👨‍🍳</span>
                      <h3 className="text-lg font-bold text-slate-800 mt-2">Kitchen Order Details</h3>
                      <p className="text-sm text-slate-500">Enter customer details for notification</p>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                          <input 
                              type="tel" 
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Customer Phone"
                              value={customerPhone}
                              onChange={e => setCustomerPhone(e.target.value)}
                              autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Name</label>
                          <input 
                              type="text" 
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Name (Optional)"
                              value={customerName}
                              onChange={e => setCustomerName(e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button 
                          onClick={() => setShowKotModal(false)}
                          className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleConfirmKot}
                          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2"
                      >
                          <span>Confirm & Send</span>
                      </button>
                  </div>
                  {customerPhone && (
                       <p className="text-xs text-center text-green-600 mt-3 flex items-center justify-center gap-1">
                           <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                           WhatsApp link will be generated
                       </p>
                  )}
              </div>
          </div>
      )}

       {/* Variant Selection Modal */}
       {variantModalProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Customize {variantModalProduct.name}</h3>
              <p className="text-sm text-slate-500">Select options</p>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {(variantModalProduct.variants || []).map(group => (
                <div key={group.id} className="mb-6 last:mb-0">
                  <h4 className="font-semibold text-slate-700 mb-3 uppercase text-xs tracking-wider">{group.name}</h4>
                  <div className="space-y-2">
                    {group.options.map(option => (
                      <label key={option.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name={group.id}
                            checked={selectedVariants[group.id]?.id === option.id}
                            onChange={() => setSelectedVariants(prev => ({...prev, [group.id]: option}))}
                            className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-slate-700">{option.name}</span>
                        </div>
                        {option.priceModifier !== 0 && (
                          <span className="text-xs font-semibold text-slate-500">
                            {option.priceModifier > 0 ? '+' : ''}₹{option.priceModifier}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex space-x-3">
              <button 
                onClick={() => setVariantModalProduct(null)}
                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddVariantItem}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-colors"
              >
                Add • ₹{getVariantTotalPrice()}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Checkout Modal */}
       {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-scale-up">
            <div className="p-6 overflow-y-auto">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Final Settlement</h3>
                <p className="text-slate-500 text-sm">Table: <span className="font-bold">{selectedTable}</span></p>
              </div>

              {/* Customer Details */}
              <div className="mb-5 bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Customer (CRM)</h4>
                <div className="space-y-3">
                  <div className="relative">
                     <input
                      type="tel"
                      placeholder="Phone Number (Auto-fill)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm font-medium"
                     />
                     {customerHistoryOrders.length > 0 && (
                       <button 
                        onClick={() => setShowCustomerHistory(true)}
                        className="absolute right-2 top-1.5 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200"
                       >
                         History
                       </button>
                     )}
                  </div>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email Address (Optional)"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm"
                  />
                  {isDelivery && (
                      <textarea
                        placeholder="Delivery Address (Required)"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 text-sm min-h-[60px]"
                      />
                  )}
                </div>
                {customerTotalDue > 0 && (
                    <div className="absolute -top-3 -right-2 bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                        Total Due: ₹{customerTotalDue}
                    </div>
                )}
              </div>

              {/* Bill Summary */}
              <div className="mb-4">
                  <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Subtotal</span>
                          <span className="font-medium">₹{finalTotal}</span>
                      </div>
                      
                      {/* Loyalty Redemption Option */}
                      {loyaltySettings.enabled && currentCustomer && (
                          <div className={`p-2 rounded border ${redeemPoints ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                             <label className="flex items-center justify-between cursor-pointer">
                                 <div className="flex items-center gap-2">
                                     <input 
                                        type="checkbox" 
                                        checked={redeemPoints}
                                        onChange={e => setRedeemPoints(e.target.checked)}
                                        disabled={finalTotal < loyaltySettings.minOrderValueToRedeem || (currentCustomer.loyaltyPoints || 0) < loyaltySettings.minPointsToRedeem}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                     />
                                     <div>
                                         <p className="text-xs font-bold text-indigo-900">Redeem Loyalty Points</p>
                                         <p className="text-[10px] text-slate-500">Available: {currentCustomer.loyaltyPoints || 0} pts</p>
                                     </div>
                                 </div>
                                 {redeemPoints && <span className="text-xs font-bold text-indigo-700">-₹{loyaltyDiscountValue}</span>}
                             </label>
                             
                             {!redeemPoints && (
                                <div className="ml-6 mt-1">
                                    {finalTotal < loyaltySettings.minOrderValueToRedeem && (
                                        <p className="text-[10px] text-slate-400 italic">Min bill ₹{loyaltySettings.minOrderValueToRedeem} required</p>
                                    )}
                                    {(currentCustomer.loyaltyPoints || 0) < loyaltySettings.minPointsToRedeem && (
                                        <p className="text-[10px] text-slate-400 italic">Min {loyaltySettings.minPointsToRedeem} pts required</p>
                                    )}
                                </div>
                             )}
                          </div>
                      )}

                      <div className="flex justify-between text-sm items-center">
                          <div className="flex items-center gap-2">
                             <span className="text-slate-600">Discount</span>
                             <div className="flex bg-slate-100 rounded p-0.5 border border-slate-200">
                                 <button onClick={() => setDiscountType('FLAT')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${discountType === 'FLAT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>₹</button>
                                 <button onClick={() => setDiscountType('PERCENT')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${discountType === 'PERCENT' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>%</button>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {discountType === 'PERCENT' && calculatedManualDiscount > 0 && <span className="text-xs text-slate-400 font-medium">(-₹{calculatedManualDiscount})</span>}
                            <input 
                                type="number" 
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                placeholder="0"
                                className="w-20 px-2 py-1 text-right border border-slate-300 rounded text-sm outline-none focus:border-indigo-500 bg-white text-slate-800 placeholder:text-slate-300"
                            />
                          </div>
                      </div>

                      <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 text-slate-800">
                          <span>Payable Amount</span>
                          <span>₹{totalPayable}</span>
                      </div>
                  </div>

                  {/* Partial Payments List */}
                  {partialPayments.length > 0 && (
                      <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Payments Added</p>
                          <div className="space-y-2">
                              {partialPayments.map((p, i) => (
                                  <div key={i} className="flex justify-between text-sm text-slate-700 items-center">
                                      <span>{p.method}</span>
                                      <div className="flex items-center gap-2">
                                          <span className="font-bold">₹{p.amount}</span>
                                          <button onClick={() => handleRemovePartialPayment(i)} className="text-red-400 hover:text-red-600 leading-none">&times;</button>
                                      </div>
                                  </div>
                              ))}
                              <div className="border-t border-emerald-200 pt-1 mt-1 flex justify-between text-sm font-bold text-emerald-800">
                                  <span>Total Paid</span>
                                  <span>₹{currentPaid}</span>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Payment Mode Selector */}
                  <label className="block text-sm font-bold text-slate-700 mb-2">Payment Method</label>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.UPI, 'DUE'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setActivePaymentMode(mode)}
                            className={`py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                                activePaymentMode === mode 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                  </div>

                  {/* Input & Action */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                        <input
                            type="number"
                            placeholder="Amount"
                            className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg text-slate-800 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            value={tenderAmount}
                            onChange={(e) => setTenderAmount(e.target.value)}
                            disabled={activePaymentMode === 'DUE'}
                        />
                    </div>
                    <button 
                        onClick={processPayment}
                        disabled={activePaymentMode !== 'DUE' && (!tenderAmount || parseFloat(tenderAmount) <= 0)}
                        className={`flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 text-sm ${
                            activePaymentMode === 'DUE' 
                            ? 'bg-amber-600 hover:bg-amber-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                         {activePaymentMode === 'DUE' 
                            ? (remainingDue > 0 ? `Credit Remaining` : 'Close Bill')
                            : (parseFloat(tenderAmount) >= remainingDue ? 'Settle & Close' : 'Add Payment')
                         }
                    </button>
                  </div>
                  
                  {remainingDue > 0 && activePaymentMode !== 'DUE' && (
                      <p className="text-xs text-slate-500 mt-2 text-center">
                          Remaining Balance: <span className="font-bold text-slate-800">₹{remainingDue}</span>
                      </p>
                  )}
              </div>

              <div className="mt-6">
                <button 
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-3 text-slate-500 font-medium hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer History / Settle Dues Modal */}
      {showCustomerHistory && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800">Customer Account</h3>
                <p className="text-xs text-slate-500">{customerName} - {customerPhone}</p>
              </div>
              <button onClick={() => setShowCustomerHistory(false)} className="text-2xl text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm flex justify-between items-center">
                    <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Outstanding</p>
                        <p className="text-2xl font-bold text-red-600">₹{customerTotalDue}</p>
                    </div>
                    {customerTotalDue > 0 && (
                        <div className="text-right">
                             <p className="text-[10px] text-slate-400 mb-1">Pay Due Amount</p>
                             <div className="flex gap-1">
                                 <button onClick={() => handleSettleCustomerDue(customerTotalDue, PaymentMethod.CASH)} className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded hover:bg-green-200">Cash</button>
                                 <button onClick={() => handleSettleCustomerDue(customerTotalDue, PaymentMethod.UPI)} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded hover:bg-blue-200">UPI</button>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 bg-slate-50/50 flex-1">
              {customerHistoryOrders.map(order => {
                const orderPaid = order.amountPaid || 0;
                const orderDue = order.total - orderPaid;
                const isUnpaid = orderDue > 0.01;

                return (
                <div key={order.id} className={`bg-white p-3 rounded-lg border shadow-sm ${isUnpaid ? 'border-red-200' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-700 text-sm">#{order.id.slice(-6)}</span>
                    <span className="text-xs text-slate-500">{new Date(order.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-slate-600 mb-2 border-b border-slate-100 pb-2">
                    {(order.items || []).map(i => `${i.qty} x ${i.name}`).join(', ')}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs">
                        <span className="text-slate-500 block">Bill: ₹{order.total}</span>
                        {(order.payments || []).length > 0 && (
                            <span className="text-slate-400 block text-[10px]">
                                Paid: {(order.payments || []).map(p => `${p.method.charAt(0)}:₹${p.amount}`).join(', ')}
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        {isUnpaid ? (
                            <span className="text-sm font-bold text-red-600 block">Due: ₹{orderDue}</span>
                        ) : (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">PAID</span>
                        )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
