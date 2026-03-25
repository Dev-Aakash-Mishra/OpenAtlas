import React from 'react';

const TopNavBar = ({
  isSidebarCollapsed,
  toggleSidebarCollapse,
  sidebarOpen,
  setSidebarOpen,
  region,
  setRegion,
  stateFilter,
  setStateFilter,
  dismissRegionTooltip,
  showRegionTooltip,
  activeView,
  setActiveView,
  setCenter,
  searchQuery,
  setSearchQuery,
  stats,
  viewLayout,
  handleSetViewLayout,
  viewOptionsOpen,
  setViewOptionsOpen,
  showFilters,
  setShowFilters
}) => {
  return (
    <nav className="w-full h-14 md:h-16 bg-[#0b0e14]/80 backdrop-blur-xl border-b border-[#45484f]/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex justify-between items-center px-3 md:px-6 z-40">
      <div className="flex items-center gap-3 md:gap-4">
        {/* Sidebar Toggle (Desktop & Mobile) */}
        <button 
          className="p-2 text-on-surface-variant hover:text-primary transition-all rounded-lg hover:bg-white/5 active:scale-95" 
          onClick={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(!sidebarOpen);
            } else {
              toggleSidebarCollapse();
            }
          }}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>
            {isSidebarCollapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
        <div className="hidden md:flex items-center gap-6 font-headline tracking-tight text-xs font-bold uppercase ml-2">
            <div className="relative">
              <button 
                className={`transition-colors cursor-pointer ${region === 'global' ? 'text-primary border-b-2 border-primary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                onClick={() => { setRegion('global'); setStateFilter('all'); dismissRegionTooltip(); }}
              >
                Global
              </button>
            </div>
                <div className="relative">
                  <button 
                    className={`transition-colors cursor-pointer ${region === 'India' ? 'text-secondary border-b-2 border-secondary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                    onClick={() => { setRegion('India'); dismissRegionTooltip(); }}
                  >
                    🇮🇳 India
                  </button>
                  {/* First-time onboarding tooltip */}
                  {showRegionTooltip && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-52 bg-secondary/95 backdrop-blur-sm text-on-secondary p-3 rounded-xl shadow-2xl border border-secondary/40 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="text-[10px] font-bold mb-1">🇮🇳 India Mode Available!</div>
                      <p className="text-[9px] font-bold leading-relaxed opacity-90">Explore regional highlights, state-level narratives, and local news across India.</p>
                      <button className="mt-2 text-[9px] font-bold underline opacity-70 hover:opacity-100" onClick={dismissRegionTooltip}>Got it</button>
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-secondary rotate-45 rounded-sm"></div>
                    </div>
                  )}
                </div>
            <div className="w-px h-4 bg-outline-variant/30 ml-2"></div>
            <button 
              className={`transition-colors cursor-pointer ${activeView === 'explorer' ? 'text-primary border-b-2 border-primary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
              onClick={() => { setActiveView('explorer'); setCenter(0, 0, { zoom: 0.8, duration: 1000 }); }}
            >
              Nodes
            </button>
          </div>
        </div>

      <div className="flex-1 max-w-xl px-2 md:px-12">
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input 
            className="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-on-surface-variant/50 text-on-surface"
            placeholder="Search topics, places, or news..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* State filter dropdown moved to FilterBar */}

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/10 text-[10px] font-headline tracking-wider uppercase">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>Nodes: {stats.totalNodes}</span>
          <span className="w-px h-3 bg-outline-variant/30"></span>
          <span className="text-on-surface-variant">Edges: {stats.totalEdges}</span>
          <span className="w-px h-3 bg-outline-variant/30"></span>
          <span className="text-on-surface-variant">Domains: {stats.domains}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View Layout toggle — always present */}
          <button 
            className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${viewLayout === 'list' ? 'text-primary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
            onClick={() => handleSetViewLayout(viewLayout === 'graph' ? 'list' : 'graph')}
            title={viewLayout === 'graph' ? 'Switch to List View (InShorts Style)' : 'Switch to Graph View'}
          >
            <span className="material-symbols-outlined">{viewLayout === 'graph' ? 'view_agenda' : 'hub'}</span>
          </button>
          <button 
            className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${showFilters ? 'text-secondary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? "Hide Strategic Filters" : "Show Strategic Filters"}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: showFilters ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>filter_list</span>
          </button>
          <button 
            className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${viewOptionsOpen ? 'text-primary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
            onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;
