import React from 'react';

const SideNavBar = ({
  sidebarOpen,
  setSidebarOpen,
  activeView,
  setActiveView,
  isSidebarCollapsed,
  isFilterModalOpen,
  setIsFilterModalOpen,
  chatOpen,
  setChatOpen,
  isDeploying,
  handleDeployQuery,
  healthStatus
}) => {
  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* SideNavBar — hidden on mobile by default, toggleable */}
      <aside className={`fixed left-0 top-0 h-full z-[60] bg-[#0b0e14]/95 backdrop-blur-3xl border-r border-white/5 flex flex-col py-8 font-body text-sm font-medium transition-all duration-500 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Logo Section */}
        <div className={`px-6 mb-12 transition-all duration-500 ${isSidebarCollapsed ? 'opacity-0 scale-75 -translate-y-4 pointer-events-none h-0' : 'opacity-100 scale-100 translate-y-0 h-auto'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="material-symbols-outlined text-primary text-xl">dataset</span>
            </div>
            <div>
              <h3 className="text-white font-headline font-bold leading-none text-xl tracking-tighter">OpenAtlas</h3>
              <p className="text-[9px] text-on-surface-variant/50 uppercase tracking-[0.3em] mt-1 font-bold">Global Ontology</p>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-2">
          {[
            { id: 'explorer', icon: 'hub', label: 'Explorer' },
            { id: 'evolution', icon: 'timeline', label: 'Narrative Evolution' },
            { id: 'chat', icon: 'chat_bubble', label: 'Atlas Chat', action: () => setChatOpen(!chatOpen) },
            { id: 'intelligence', icon: 'rss_feed', label: 'Intelligence Feed' },
            { id: 'archive', icon: 'inventory_2', label: 'History' }
          ].map((item) => (
            <button 
              key={item.id}
              className={`flex items-center w-full gap-4 transition-all duration-300 relative group ${
                (item.id === 'chat' && chatOpen) || (item.id === activeView && item.id !== 'chat')
                  ? 'bg-primary/10 text-primary' 
                  : 'text-on-surface-variant/60 hover:bg-white/5 hover:text-white'
              } ${isSidebarCollapsed ? 'px-0 justify-center h-12' : 'px-6 py-3.5'}`}
              onClick={item.action || (() => setActiveView(item.id))}
              title={isSidebarCollapsed ? item.label : ''}
            >
              {(item.id === 'chat' && chatOpen) || (item.id === activeView && item.id !== 'chat') ? (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_8px_rgba(159,167,255,0.4)]" />
              ) : null}
              
              <span className={`material-symbols-outlined text-[22px] transition-transform duration-300 group-hover:scale-110`}>
                {item.icon}
              </span>
              
              {!isSidebarCollapsed && (
                <span className="font-bold tracking-tight animate-in fade-in slide-in-from-left-2 duration-300">
                  {item.label}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {isSidebarCollapsed && (
                <div className="absolute left-16 px-3 py-1.5 bg-[#1a1c23] text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none z-50 whitespace-nowrap border border-white/10 shadow-2xl">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 pb-4 space-y-4">
          <button 
            className={`w-full relative overflow-hidden flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all duration-500 group ${isDeploying ? 'cursor-not-allowed opacity-50' : ''} ${isSidebarCollapsed ? 'h-12 w-12 mx-auto px-0' : 'px-6'}`}
            onClick={handleDeployQuery}
            disabled={isDeploying}
            title={isSidebarCollapsed ? 'Sync Data' : ''}
          >
            <span className={`material-symbols-outlined text-[20px] ${isDeploying ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`}>
              {isDeploying ? 'sync' : 'refresh'}
            </span>
            {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-widest">Refresh Feed</span>}
          </button>

          <div className="pt-6 border-t border-white/5 flex flex-col gap-2">
            <div className={`flex items-center gap-4 px-3 py-2 text-on-surface-variant/40 hover:text-white transition-colors cursor-pointer group ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'Support' : ''}>
              <span className="material-symbols-outlined text-[18px]">help</span>
              {!isSidebarCollapsed && <span className="text-[11px] font-bold uppercase tracking-widest">Support</span>}
            </div>
            
            <div className={`flex items-center gap-4 px-3 py-2 ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? 'System: OK' : ''}>
              <span className={`w-2 h-2 rounded-full ${healthStatus === 'ok' ? 'bg-primary' : 'bg-red-500'} animate-pulse shadow-[0_0_8px_rgba(159,167,255,0.4)]`}></span>
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">
                  Status: <span className="text-primary">{healthStatus.toUpperCase()}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideNavBar;
