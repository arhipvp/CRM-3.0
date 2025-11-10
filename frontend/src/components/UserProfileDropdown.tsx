// Fix: Implemented the UserProfileDropdown component.
import React, { useState, useRef, useEffect } from 'react';

export const UserProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-100"
      >
        <img
          className="h-10 w-10 rounded-full object-cover"
          src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
          alt="User avatar"
        />
        <div className="text-left">
          <p className="font-semibold text-sm text-slate-800">Мария Иванова</p>
          <p className="text-xs text-slate-500">Старший менеджер</p>
        </div>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-10">
          <div className="py-1">
            <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Профиль</a>
            <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Настройки</a>
            <div className="border-t border-slate-200 my-1"></div>
            <a href="#" className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Выйти</a>
          </div>
        </div>
      )}
    </div>
  );
};
