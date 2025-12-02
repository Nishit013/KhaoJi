
import React, { useState, useEffect } from 'react';
import { useStore } from '../App';
import { LoyaltySettings, Staff } from '../types';

const Settings: React.FC = () => {
  const { loyaltySettings, updateLoyaltySettings, staffList, addStaff, removeStaff, currentUser } = useStore();
  
  // Loyalty form state
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltySettings>(loyaltySettings);
  const [isSaved, setIsSaved] = useState(false);

  // Staff form state
  const [staffForm, setStaffForm] = useState({ id: '', name: '', pin: '', role: 'CASHIER' as const });
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [adminAuthPin, setAdminAuthPin] = useState('');

  useEffect(() => {
    setLoyaltyForm(loyaltySettings);
  }, [loyaltySettings]);

  const handleLoyaltySave = (e: React.FormEvent) => {
    e.preventDefault();
    updateLoyaltySettings({
        ...loyaltyForm,
        earningRate: Number(loyaltyForm.earningRate),
        redemptionValue: Number(loyaltyForm.redemptionValue),
        minPointsToRedeem: Number(loyaltyForm.minPointsToRedeem),
        minOrderValueToRedeem: Number(loyaltyForm.minOrderValueToRedeem),
        expiryMonths: Number(loyaltyForm.expiryMonths)
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const initiateAddStaff = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic validation
      if (!staffForm.id || !staffForm.name || !staffForm.pin) {
          alert("Please fill all staff fields");
          return;
      }
      if (staffList.some(s => s.id === staffForm.id)) {
          alert("Staff ID already exists");
          return;
      }
      // Open PIN prompt
      setAdminAuthPin('');
      setShowPinPrompt(true);
  };

  const confirmAddStaff = () => {
      if (adminAuthPin !== currentUser?.pin) {
          alert("Incorrect Admin PIN. Staff creation failed.");
          return;
      }
      
      const newStaff: Staff = {
          id: staffForm.id,
          name: staffForm.name,
          pin: staffForm.pin,
          role: staffForm.role as any
      };
      
      addStaff(newStaff);
      setShowPinPrompt(false);
      setStaffForm({ id: '', name: '', pin: '', role: 'CASHIER' }); // Reset form
      alert("Staff created successfully!");
  };

  return (
    <div className="p-8 h-full bg-slate-100 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl font-bold text-slate-800">Settings & Configuration</h2>
        
        {/* --- STAFF MANAGEMENT SECTION --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">Staff Management</h3>
                <p className="text-sm text-slate-500">Create login credentials for cashiers, chefs, and managers</p>
             </div>
             
             <div className="p-6">
                 {/* Create Staff Form */}
                 <div className="mb-8 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                     <h4 className="font-bold text-indigo-900 mb-4 text-sm uppercase tracking-wide">Create New Staff</h4>
                     <form onSubmit={initiateAddStaff} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Staff ID</label>
                             <input 
                                type="text" 
                                placeholder="e.g. ST001"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                value={staffForm.id}
                                onChange={e => setStaffForm({...staffForm, id: e.target.value})}
                                required
                             />
                         </div>
                         <div className="md:col-span-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                             <input 
                                type="text" 
                                placeholder="Employee Name"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                value={staffForm.name}
                                onChange={e => setStaffForm({...staffForm, name: e.target.value})}
                                required
                             />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login PIN</label>
                             <input 
                                type="text" 
                                placeholder="4-6 Digits"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                value={staffForm.pin}
                                onChange={e => setStaffForm({...staffForm, pin: e.target.value})}
                                required
                                maxLength={6}
                             />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                             <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white"
                                value={staffForm.role}
                                onChange={e => setStaffForm({...staffForm, role: e.target.value as any})}
                             >
                                 <option value="CASHIER">Cashier</option>
                                 <option value="CHEF">Chef</option>
                                 <option value="MANAGER">Manager</option>
                                 <option value="ADMIN">Admin</option>
                             </select>
                         </div>
                         <div className="md:col-span-5 flex justify-end mt-2">
                             <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                                 + Create Staff
                             </button>
                         </div>
                     </form>
                 </div>

                 {/* Existing Staff List */}
                 <div>
                     <h4 className="font-bold text-slate-700 mb-3 text-sm">Existing Users</h4>
                     <div className="overflow-hidden border border-slate-200 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2">ID</th>
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Role</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {staffList.map(staff => (
                                    <tr key={staff.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-mono text-slate-600">{staff.id}</td>
                                        <td className="px-4 py-2 font-medium text-slate-800">{staff.name} {staff.id === currentUser?.id && '(You)'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                staff.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                staff.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                                                staff.role === 'CHEF' ? 'bg-orange-100 text-orange-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                                {staff.role}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {staff.id !== 'admin123' && staff.id !== currentUser?.id && (
                                                <button 
                                                    onClick={() => { if(confirm('Delete this user?')) removeStaff(staff.id); }}
                                                    className="text-red-500 hover:text-red-700 text-xs font-bold hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                 </div>
             </div>
        </div>

        {/* --- LOYALTY SETTINGS SECTION --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <div>
                <h3 className="text-xl font-bold text-slate-800">Loyalty Program Rules</h3>
                <p className="text-sm text-slate-500">Configure how customers earn and redeem points</p>
             </div>
             <div className="flex items-center gap-3">
                 <span className="text-sm font-bold text-slate-700">{loyaltyForm.enabled ? 'Enabled' : 'Disabled'}</span>
                 <button 
                   type="button"
                   onClick={() => setLoyaltyForm(prev => ({...prev, enabled: !prev.enabled}))}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${loyaltyForm.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                 >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loyaltyForm.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
             </div>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleLoyaltySave} className="space-y-6">
                
                {/* Earning Rules */}
                <h4 className="font-bold text-slate-600 border-b pb-2">Earning Rules</h4>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Earning Rate (Spend)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                min="1"
                                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                value={loyaltyForm.earningRate}
                                onChange={e => setLoyaltyForm({...loyaltyForm, earningRate: Number(e.target.value)})}
                                disabled={!loyaltyForm.enabled}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Spend ₹{loyaltyForm.earningRate} to earn 1 Point</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Expiry Period</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                min="1"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                value={loyaltyForm.expiryMonths}
                                onChange={e => setLoyaltyForm({...loyaltyForm, expiryMonths: Number(e.target.value)})}
                                disabled={!loyaltyForm.enabled}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">Months</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Points expire after {loyaltyForm.expiryMonths} months from earning</p>
                    </div>
                </div>

                {/* Redemption Rules */}
                <h4 className="font-bold text-slate-600 border-b pb-2 pt-4">Redemption Rules</h4>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Redemption Value (Per Point)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                            <input 
                                type="number" 
                                min="0.1"
                                step="0.1"
                                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                value={loyaltyForm.redemptionValue}
                                onChange={e => setLoyaltyForm({...loyaltyForm, redemptionValue: Number(e.target.value)})}
                                disabled={!loyaltyForm.enabled}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">1 Point = ₹{loyaltyForm.redemptionValue}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Min Points to Redeem</label>
                        <input 
                            type="number" 
                            min="0"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                            value={loyaltyForm.minPointsToRedeem}
                            onChange={e => setLoyaltyForm({...loyaltyForm, minPointsToRedeem: Number(e.target.value)})}
                            disabled={!loyaltyForm.enabled}
                        />
                        <p className="text-xs text-slate-500 mt-1">Customer needs {loyaltyForm.minPointsToRedeem} pts to start redeeming</p>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Min Bill Amount to Redeem</label>
                        <div className="relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                             <input 
                                type="number" 
                                min="0"
                                className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                                value={loyaltyForm.minOrderValueToRedeem || 0}
                                onChange={e => setLoyaltyForm({...loyaltyForm, minOrderValueToRedeem: Number(e.target.value)})}
                                disabled={!loyaltyForm.enabled}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Customer can only redeem points if total bill is above ₹{loyaltyForm.minOrderValueToRedeem || 0}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaved ? 'Settings Saved!' : 'Save Configuration'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      </div>

      {/* ADMIN AUTH PIN MODAL */}
      {showPinPrompt && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                  <div className="mb-4">
                      <span className="text-4xl">🔒</span>
                      <h3 className="text-lg font-bold text-slate-800 mt-2">Admin Authorization</h3>
                      <p className="text-sm text-slate-500">Please enter your Admin PIN to create new staff.</p>
                  </div>
                  <input 
                      type="password" 
                      className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
                      placeholder="••••"
                      autoFocus
                      value={adminAuthPin}
                      onChange={e => setAdminAuthPin(e.target.value)}
                  />
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setShowPinPrompt(false)}
                        className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={confirmAddStaff}
                        className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                      >
                          Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
