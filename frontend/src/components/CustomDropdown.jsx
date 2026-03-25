import React, { useState, useRef, useEffect } from 'react';

const CustomDropdown = ({ label, value, options, onChange, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest hidden lg:block">
            {label}:
          </span>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 bg-surface-container-highest/30 border rounded-xl text-xs font-semibold transition-all duration-300 ${
            isOpen 
              ? 'border-primary/50 bg-primary/10 text-primary shadow-lg shadow-primary/10' 
              : 'border-outline-variant/10 text-on-surface/80 hover:border-primary/30'
          }`}
        >
          {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
          <span>{selectedOption?.label}</span>
          <span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-[#10131a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_32px_-8px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
          <div className="py-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                  value === option.value 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
