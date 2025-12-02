
import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useStore } from '../App';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser } = useStore();
  
  // Hide global sidebar for POS, Reports pages, OR if the user is a CHEF
  const hideSidebar = 
    location.pathname === '/pos' || 
    location.pathname === '/reports' || 
    currentUser?.role === 'CHEF';

  return (
    <div className="flex h-screen bg-slate-50">
      {!hideSidebar && <Sidebar />}
      <div className={`flex-1 overflow-auto ${!hideSidebar ? 'ml-64' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
