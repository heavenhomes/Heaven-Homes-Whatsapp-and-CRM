"use client";
import { Menu, X } from 'lucide-react';

export default function Navbar({ toggleSidebar, isSidebarOpen }) {
  return (
    <header className="bg-white border-b border-gray-50 shadow-sm h-16 flex items-center px-4 md:px-6 flex-shrink-0">
      {/* Left side - Menu icon and Heaven Homes text */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
          aria-label="Toggle Sidebar"
        >
          {isSidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
        
        <span className="text-base font-semibold text-gray-800">
          Heaven Homes · Real Estate CRM
        </span>
      </div>

     
    </header>
  );
}