import { Handle, Position } from '@xyflow/react';

const DOMAIN_ICONS = {
  geopolitics: 'public',
  economics: 'payments',
  military: 'military_tech',
  technology: 'memory',
  environment: 'eco',
  society: 'groups',
  science: 'science',
  culture: 'theater_comedy',
  sports: 'sports_basketball',
  health: 'health_and_safety',
  politics: 'account_balance',
};

export default function EventNode({ data }) {
  const {
    id,
    content,
    domain,
    color,
    isPinned,
    onTogglePin,
    isGhost,
    isSearchMatch,
  } = data;

  const icon = DOMAIN_ICONS[domain] || 'fiber_manual_record';
  
  // Determine glow class based on domain or primary/secondary/tertiary mapping
  let glowClass = "node-glow-primary";
  if (domain === 'economics' || domain === 'technology') glowClass = "node-glow-secondary";
  if (domain === 'military' || domain === 'geopolitics') glowClass = "node-glow-tertiary";

  // Deterministic trust & bias for visual variety
  const trustScore = 0.7 + (Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 30) / 100;
  const bias = ['neutral', 'slight-west', 'slight-east'][Math.abs(id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 3];

  return (
    <div className={`group cursor-pointer transition-all duration-300 ${isSearchMatch ? 'scale-110 z-50' : 'z-20'}`}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!opacity-0" 
      />

      <div className="relative flex flex-col items-center">
        {/* Node Circle */}
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-surface ring-2 transition-all duration-300 ${glowClass} ${isPinned ? 'ring-yellow-400/50' : 'ring-white/10'} group-hover:scale-110 group-active:scale-95`}
          style={{ 
            backgroundColor: isGhost ? 'transparent' : color,
            borderColor: '#0b0e14',
            borderStyle: isGhost ? 'dashed' : 'solid',
            boxShadow: isGhost ? 'none' : undefined
          }}
        >
          <span 
            className={`material-symbols-outlined text-xl ${isGhost ? '' : 'text-on-primary'}`} 
            style={{ 
              fontVariationSettings: "'FILL' 1",
              color: isGhost ? color : undefined
            }}
          >
            {icon}
          </span>
          
          {isPinned && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-surface">
              <span className="material-symbols-outlined text-[10px] text-black" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
            </div>
          )}

          {/* Trust Ring */}
          <svg className="absolute inset-0 -rotate-90 w-full h-full pointer-events-none">
            <circle
              cx="24" cy="24" r="21"
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            <circle
              cx="24" cy="24" r="21"
              fill="transparent"
              stroke={trustScore > 0.9 ? "#22c55e" : "#eab308"}
              strokeWidth="2"
              strokeDasharray={132}
              strokeDashoffset={132 * (1 - trustScore)}
              className="transition-all duration-1000"
            />
          </svg>
        </div>

        {/* Label Popover (Simplified for Graph View) */}
        <div className="absolute top-full mt-3 flex flex-col items-center whitespace-nowrap bg-surface-container-highest/90 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 shadow-xl opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-[10px] font-bold text-on-surface max-w-[150px] overflow-hidden text-ellipsis">
            {content?.split('.')[0]}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[8px] text-primary uppercase font-headline tracking-widest">
              {domain} {isGhost ? '• Speculative' : ''}
            </p>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <p className={`text-[7px] uppercase font-bold ${bias === 'neutral' ? 'text-green-400' : 'text-orange-400'}`}>
               {bias}
            </p>
          </div>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!opacity-0"
      />
    </div>
  );
}
