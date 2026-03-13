import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Activity, 
  FileText, 
  Search, 
  Send, 
  Terminal,
  ShieldAlert,
  ChevronRight,
  Database,
  RefreshCw,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
  summary?: string;
  root_cause?: string;
  recommendation?: string;
}

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  const selectedIncident = incidents.find(i => i.id === selectedId);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    const res = await fetch('/api/incidents');
    const data = await res.json();
    setIncidents(data);
  };

  const handleIngestLogs = async () => {
    const mockLogs = [
      { timestamp: new Date().toISOString(), level: 'ERROR', service: 'user-service', message: 'Connection timeout to database' },
      { timestamp: new Date().toISOString(), level: 'ERROR', service: 'user-service', message: 'Failed to fetch user profile: DB_TIMEOUT' },
      { timestamp: new Date().toISOString(), level: 'WARN', service: 'api-gateway', message: 'Upstream service user-service returned 504' },
      { timestamp: new Date().toISOString(), level: 'INFO', service: 'monitoring', message: 'Spike in 5xx errors detected' },
    ];

    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: mockLogs })
    });
    fetchIncidents();
  };

  const handleAnalyze = async (id: string) => {
    setIsAnalyzing(true);
    try {
      await fetch(`/api/incidents/${id}/analyze`, { method: 'POST' });
      await fetchIncidents();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    await fetch('/api/seed', { method: 'POST' });
    setIsSeeding(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: userMsg, 
        context: selectedIncident,
        history: chatMessages 
      })
    });
    const data = await res.json();
    setChatMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
  };

  return (
    <div className="flex h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-[#0F0F11]">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <ShieldAlert className="text-black w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">OpsMind</h1>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Active Incidents</span>
            <button 
              onClick={handleIngestLogs}
              className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-emerald-400"
              title="Simulate Log Ingestion"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          {incidents.map(incident => (
            <button
              key={incident.id}
              onClick={() => setSelectedId(incident.id)}
              className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                selectedId === incident.id 
                ? 'bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' 
                : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  incident.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                  incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {incident.severity}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h3 className={`font-medium leading-snug mb-1 ${selectedId === incident.id ? 'text-white' : 'text-slate-300'}`}>
                {incident.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{incident.status}</span>
              </div>
            </button>
          ))}
          
          {incidents.length === 0 && (
            <div className="text-center py-12 px-4">
              <Activity className="w-8 h-8 text-slate-700 mx-auto mb-3 opacity-20" />
              <p className="text-sm text-slate-500">No incidents detected yet.</p>
              <button 
                onClick={handleIngestLogs}
                className="mt-4 text-xs text-emerald-400 hover:underline"
              >
                Trigger log simulation
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0A0A0B]">
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-all text-slate-400 disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            {isSeeding ? 'Seeding...' : 'Seed Knowledge Base'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedIncident ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="p-8 border-b border-white/5 bg-gradient-to-b from-[#0F0F11] to-transparent">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                  <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-bold text-white tracking-tight">{selectedIncident.title}</h2>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                        {selectedIncident.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">Incident ID: {selectedIncident.id}</p>
                  </div>
                  <button 
                    onClick={() => handleAnalyze(selectedIncident.id)}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                  >
                    {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {isAnalyzing ? 'Analyzing...' : 'Run AI RCA'}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Severity</span>
                    <span className="text-lg font-semibold text-white capitalize">{selectedIncident.severity}</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Detected At</span>
                    <span className="text-lg font-semibold text-white">{new Date(selectedIncident.created_at).toLocaleString()}</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">MTTR Estimate</span>
                    <span className="text-lg font-semibold text-white">14 mins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Content */}
            <div className="p-8 max-w-4xl mx-auto space-y-12">
              {/* Root Cause Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Search className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Root Cause Analysis</h3>
                </div>
                
                {selectedIncident.root_cause ? (
                  <div className="grid gap-4">
                    {JSON.parse(selectedIncident.root_cause).map((rc: any, idx: number) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx} 
                        className="bg-[#151518] p-6 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-white text-lg">{rc.cause}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-mono">Confidence</span>
                            <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${rc.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-emerald-400">{(rc.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <p className="text-slate-400 leading-relaxed">{rc.explanation}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                    <p className="text-slate-500">Run AI RCA to generate root cause hypotheses.</p>
                  </div>
                )}
              </section>

              {/* Recommendations */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Recommended Actions</h3>
                </div>
                
                {selectedIncident.recommendation ? (
                  <div className="space-y-4">
                    <div className="bg-[#151518] p-6 rounded-2xl border border-white/5">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Immediate Steps</h4>
                      <ul className="space-y-3">
                        {JSON.parse(selectedIncident.recommendation).recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-3 text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-emerald-400">{idx + 1}</span>
                            </div>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500/60 mb-2">Long-term Solution</h4>
                      <p className="text-slate-300 italic">"{JSON.parse(selectedIncident.recommendation).longTerm}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                    <p className="text-slate-500">Recommendations will appear after analysis.</p>
                  </div>
                )}
              </section>

              {/* Summary Report */}
              <section className="pb-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Incident Report</h3>
                </div>
                {selectedIncident.summary ? (
                  <div className="bg-[#151518] p-8 rounded-2xl border border-white/5 prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-slate-300 leading-relaxed font-mono text-sm">
                      {selectedIncident.summary}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-12 text-center">
                    <p className="text-slate-500">Full report will be generated during analysis.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
              <ShieldAlert className="w-12 h-12 text-slate-700" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Select an incident to begin</h2>
            <p className="text-slate-500 max-w-md">
              Choose an active alert from the sidebar to view automated root cause analysis and recommendations.
            </p>
          </div>
        )}

        {/* Chat Assistant Toggle */}
        <button 
          onClick={() => setChatOpen(!chatOpen)}
          className={`absolute bottom-8 right-8 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 z-50 ${
            chatOpen ? 'bg-white text-black rotate-90' : 'bg-emerald-500 text-black hover:scale-110'
          }`}
        >
          {chatOpen ? <ChevronRight className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
        </button>

        {/* Chat Drawer */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 w-96 h-full bg-[#0F0F11] border-l border-white/5 shadow-2xl z-40 flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">OpsMind Assistant</h3>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">AI Agent Online</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-500">Ask me anything about this incident or troubleshooting steps.</p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                      msg.role === 'user' 
                      ? 'bg-emerald-500 text-black font-medium' 
                      : 'bg-white/5 text-slate-300 border border-white/5'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-white/5 bg-[#0A0A0B]">
                <div className="relative">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="absolute right-2 top-2 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-black hover:bg-emerald-400 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
