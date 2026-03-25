import React from 'react';
import CustomDropdown from './CustomDropdown';

const FilterBar = ({ 
  region, 
  stateFilter, 
  setStateFilter, 
  filterDomain, 
  setFilterDomain, 
  domains, 
  timeWindow, 
  setTimeWindow,
  nodeLimit,
  setNodeLimit,
  showPinnedOnly,
  setShowPinnedOnly,
  showFilters,
  setShowFilters
}) => {
  const domainOptions = [
    { value: 'all', label: 'All Sectors' },
    ...domains.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))
  ];

  const timeOptions = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '3d', label: 'Last 3 Days' },
    { value: '7d', label: 'Last Week' },
    { value: 'all', label: 'Historical Atlas' }
  ];

  const densityOptions = [
    { value: 50, label: 'Low Density (50)' },
    { value: 100, label: 'Standard (100)' },
    { value: 200, label: 'High (200)' },
    { value: 500, label: 'Extreme (500)' }
  ];

  const stateOptions = [
    { value: 'all', label: 'All India' },
    { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
    { value: 'Bihar', label: 'Bihar' },
    { value: 'Chhattisgarh', label: 'Chhattisgarh' },
    { value: 'Delhi', label: 'Delhi' },
    { value: 'Goa', label: 'Goa' },
    { value: 'Gujarat', label: 'Gujarat' },
    { value: 'Haryana', label: 'Haryana' },
    { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
    { value: 'Jammu and Kashmir', label: 'Jammu & Kashmir' },
    { value: 'Jharkhand', label: 'Jharkhand' },
    { value: 'Karnataka', label: 'Karnataka' },
    { value: 'Kerala', label: 'Kerala' },
    { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
    { value: 'Maharashtra', label: 'Maharashtra' },
    { value: 'Odisha', label: 'Odisha' },
    { value: 'Punjab', label: 'Punjab' },
    { value: 'Rajasthan', label: 'Rajasthan' },
    { value: 'Tamil Nadu', label: 'Tamil Nadu' },
    { value: 'Telangana', label: 'Telangana' },
    { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
    { value: 'Uttarakhand', label: 'Uttarakhand' },
    { value: 'West Bengal', label: 'West Bengal' }
  ];

  return (
    <div className={`w-full group/bar relative z-30 border-b border-white/5 bg-[#0b0e14]/40 backdrop-blur-xl transition-all duration-500 ease-in-out ${showFilters ? 'h-16 opacity-100' : 'h-1 opacity-60'}`}>
      {/* Expanded Content */}
      <div className={`w-full h-full px-6 flex items-center gap-6 transition-all duration-500 ${showFilters ? 'translate-y-0 opacity-100 overflow-visible' : '-translate-y-4 opacity-0 pointer-events-none overflow-hidden'}`}>
        <CustomDropdown 
          label="Sector"
          value={filterDomain}
          options={domainOptions}
          onChange={setFilterDomain}
          icon="category"
        />

        <div className="w-px h-4 bg-white/10 hidden md:block"></div>

        <CustomDropdown 
          label="Timeframe"
          value={timeWindow}
          options={timeOptions}
          onChange={setTimeWindow}
          icon="schedule"
        />

        <div className="w-px h-4 bg-white/10 hidden md:block"></div>

        {region === 'India' && (
          <>
            <CustomDropdown 
              label="State"
              value={stateFilter}
              options={stateOptions}
              onChange={setStateFilter}
              icon="location_on"
            />
            <div className="w-px h-4 bg-white/10 hidden md:block"></div>
          </>
        )}

        <CustomDropdown 
          label="Density"
          value={nodeLimit}
          options={densityOptions}
          onChange={(val) => setNodeLimit(Number(val))}
          icon="density_medium"
        />

        <div className="w-px h-4 bg-white/10 hidden md:block"></div>

        <button 
          onClick={() => setShowPinnedOnly(!showPinnedOnly)}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border font-bold text-[11px] uppercase tracking-widest transition-all duration-300 ${
            showPinnedOnly 
              ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20 scale-105' 
              : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-primary/30'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">{showPinnedOnly ? 'keep' : 'keep_off'}</span>
          <span>Pinned</span>
        </button>
      </div>

    </div>
  );
};

export default FilterBar;
