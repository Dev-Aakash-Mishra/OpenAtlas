import { Handle, Position } from '@xyflow/react';

const DOMAIN_ICONS = {
  geopolitics: 'public',
  economics: 'payments',
  military: 'military_tech',
  technology: 'memory',
  environment: 'eco',
  society: 'groups',
  science: 'science',
  culture: 'movie',
  sports: 'sports_cricket',
  health: 'health_and_safety',
  politics: 'account_balance',
  agriculture: 'agriculture',
  development: 'construction',
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
    trust_score,
    bias_warning,
    region,
    state,
  } = data;

  const icon = DOMAIN_ICONS[domain] || 'fiber_manual_record';
  
  // Glow class based on domain
  let glowClass = "node-glow-primary";
  if (domain === 'economics' || domain === 'technology') glowClass = "node-glow-secondary";
  if (domain === 'military' || domain === 'geopolitics') glowClass = "node-glow-tertiary";

  // Simplify metrics for a better Indian user experience
  const trustNormalized = Math.min(Math.max((trust_score ?? 70) / 100, 0), 1);
  const isHighBias = bias_warning === true;
  const trustColor = isHighBias ? '#f97316' : trustNormalized > 0.8 ? '#22c55e' : '#eab308';
  
  // Use more relatable terms
  const trustLabel = isHighBias ? 'Tone Warning' : 'Fact-Checked';
  const trustValue = Math.round(trustNormalized * 100);

  // India indicator: show flag dot if region is India or state is set
  const isIndiaNode = region === 'India' || !!state;

  return (
    <div className={`group cursor-pointer transition-all duration-300 ${isSearchMatch ? 'scale-110 z-50' : 'z-20'} ${isGhost ? 'animate-pulse-subtle' : ''}`}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!opacity-0" 
      />

      <div className="relative flex flex-col items-center">
        {/* Node Circle */}
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-surface ring-2 transition-all duration-300 ${isGhost ? 'node-glow-prediction' : glowClass} ${isPinned ? 'ring-yellow-400/50' : 'ring-white/10'} group-hover:scale-110 group-active:scale-95`}
          style={{ 
            backgroundColor: isGhost ? `${color}33` : color,
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

          {/* Trust Ring - using real node trust_score */}
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
              stroke={trustColor}
              strokeWidth="2"
              strokeDasharray={132}
              strokeDashoffset={132 * (1 - trustNormalized)}
              className="transition-all duration-1000"
            />
          </svg>
          
          {isGhost && (
            <div className="absolute -bottom-1 -right-1 px-1 bg-purple-600 rounded text-[6px] font-black text-white border border-white/20 select-none">
              PRED
            </div>
          )}
        </div>

        {/* Prominent India flag indicator */}
        {isIndiaNode && !isGhost && (
          <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#ff9933] border-2 border-[#0b0e14] flex items-center justify-center shadow-lg z-30" title={state || 'India Event'}>
            <span className="text-[7px] font-black text-white leading-none tracking-tighter">IN</span>
          </div>
        )}

        {/* Label Popover (Simplified for Graph View) */}
        <div className="absolute top-full mt-3 flex flex-col items-center whitespace-nowrap bg-surface-container-highest/90 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 shadow-xl opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-[11px] font-bold text-on-surface max-w-[180px] overflow-hidden text-ellipsis">
            {content?.split('.')[0]}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-primary uppercase font-headline tracking-widest">
              {domain} {isGhost ? '• Prediction' : ''}
            </p>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <p className={`text-[11px] uppercase font-bold ${isHighBias ? 'text-orange-400' : 'text-green-400'}`}>
              {trustLabel} {trustValue}%
            </p>
          </div>
          {state && (
            <p className="text-[11px] text-secondary mt-0.5 font-bold uppercase tracking-widest bg-secondary/10 px-2 rounded-full">
              {data.district ? `${data.district}, ${state}` : state}
            </p>
          )}
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
