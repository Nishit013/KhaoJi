
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '../App';

const Sidebar: React.FC = () => {
  const { currentUser, setShowEndShiftModal } = useStore();

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'POS / Billing', path: '/pos' },
    { name: 'Tables', path: '/tables' },
    { name: 'Kitchen (KOT)', path: '/kitchen' },
    { name: 'Inventory', path: '/inventory' },
    { name: 'CRM', path: '/crm' },
    { name: 'Reports', path: '/reports' },
    // Only show Settings for ADMIN
    ...(currentUser?.role === 'ADMIN' ? [{ name: 'Settings', path: '/settings' }] : []),
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          KhaoJi
        </h1>
        <p className="text-xs text-slate-400 mt-1">Enterprise Edition</p>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center space-x-3 px-4 py-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold shadow-md">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser?.name}</p>
            <p className="text-xs text-slate-400">{currentUser?.role}</p>
          </div>
        </div>
        <button 
            onClick={() => setShowEndShiftModal(true)}
            className="w-full bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
        >
            <span>🛑</span> End Shift
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
