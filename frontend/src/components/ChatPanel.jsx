import { useState, useRef, useEffect } from 'react';

const API_BASE = '';

const SUGGESTED_PROMPTS = [
  'What is happening in India today?',
  'Explain the India-China border situation',
  'Latest cricket news',
  'How is the rupee performing?',
  'Top stories from Maharashtra',
  'What is BRICS discussing?',
];

export default function ChatPanel({ onNodeSelect, onClose, fontSize }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Namaste! 🙏 Hello! Ask me anything about Indian news, regional trends, or global affairs. I can find relevant nodes and answer with citations.',
    },
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const newCited = data.cited_nodes || [];
      
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          citedNodes: newCited,
        },
      ]);
      
      if (newCited.length > 0) {
        setTimeout(() => onNodeSelect(newCited[0]), 300);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { 
          role: 'assistant', 
          text: `I'm having trouble connecting to the Atlas Brain. ${err.message || 'Please check if the backend is running and try again.'}`, 
          isError: true 
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderText = (text, citedNodes = []) => {
    const parts = text.split(/(\[[a-f0-9]{8}\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[([a-f0-9]{8})\]$/);
      if (match) {
        const shortId = match[1];
        const fullId = citedNodes.find((id) => id.startsWith(shortId));
        return (
          <button
            key={i}
            className="text-primary hover:underline font-headline font-bold"
            onClick={() => fullId && onNodeSelect(fullId)}
            title={fullId || shortId}
          >
            [{shortId}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="absolute top-6 right-4 sm:right-6 bottom-6 w-[calc(100%-2rem)] sm:w-96 flex flex-col bg-surface-container-low/95 backdrop-blur-3xl border border-outline-variant/20 z-[60] animate-in slide-in-from-right-8 duration-500 shadow-3xl rounded-[2rem] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-surface-container/30">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          <span className="text-sm font-headline font-bold uppercase tracking-widest text-on-surface">Atlas Feeds Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="p-1.5 hover:bg-surface-variant rounded transition-all text-on-surface-variant hover:text-primary"
            onClick={() => setMessages([{role: 'assistant', text: "Hi! Ask me anything about the knowledge graph. I'll find relevant nodes and answer with citations."}])}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
          <button 
            className="p-1.5 hover:bg-error/10 rounded transition-all text-on-surface-variant hover:text-error"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-outline-variant/30 scrollbar-track-transparent">
        {messages.length <= 1 && (
          <div className="pb-2">
            <p className="text-[11px] uppercase tracking-widest text-on-surface-variant mb-2 px-1">Try asking:</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  className="text-left text-[11px] px-3 py-2 bg-surface-container-highest/50 hover:bg-primary/10 border border-outline-variant/10 hover:border-primary/30 rounded-xl transition-all text-on-surface-variant hover:text-primary font-medium"
                  onClick={() => { setInput(prompt); }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-primary text-on-primary rounded-tr-none shadow-lg shadow-primary/10' 
                  : 'bg-surface-container-highest text-on-surface border border-outline-variant/10 rounded-tl-none'
              } ${msg.isError ? 'border-error/30 text-error' : ''}`}
            >
              {msg.role === 'assistant' ? renderText(msg.text, msg.citedNodes) : msg.text}
            </div>
            {msg.citedNodes?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 px-1">
                <span className="text-[11px] uppercase tracking-tighter text-on-surface-variant mr-1 self-center">Citations:</span>
                {msg.citedNodes.map((id) => (
                  <button
                    key={id}
                    className="text-[11px] font-headline font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-all"
                    onClick={() => onNodeSelect(id)}
                  >
                    {id.slice(0, 8)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-container-highest p-3 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-outline-variant/10 bg-surface-container-low/50">
        <div className="relative group">
          <textarea
            className="w-full bg-surface-container-highest/50 border border-outline-variant/20 rounded-xl py-3 pl-4 pr-12 text-xs focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none resize-none min-h-[44px] max-h-32 transition-all placeholder:text-on-surface-variant/40"
            placeholder="Ask about Indian news, trends, or specific events..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
          />
          <button
            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all ${
              input.trim() && !loading ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-100' : 'bg-surface-variant text-on-surface-variant scale-90 opacity-50 cursor-not-allowed'
            }`}
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
