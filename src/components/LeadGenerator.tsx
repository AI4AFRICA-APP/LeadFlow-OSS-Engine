import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Target, Send, Loader2, Link as LinkIcon, CheckCircle2, AlertCircle, ChevronRight, Activity, X, Globe, User, TrendingUp, Cpu, Save, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, SearchParams } from '../types';
import { discoverLeads, enrichLead } from '../services/geminiService';
import { AFRICAN_LOCATIONS, INDUSTRIES, AFRICAN_DIRECTORY } from '../constants';
import { BRANDING } from '../branding';

export default function LeadGenerator() {
  const [params, setParams] = useState<SearchParams>({ location: '', niche: '' });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [automationMode, setAutomationMode] = useState<'manual' | 'automatic'>('manual');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isStoppingAutomation, setIsStoppingAutomation] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [automationStatus, setAutomationStatus] = useState('Idle');
  const [activeAutoLeadName, setActiveAutoLeadName] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const leadsRef = useRef<Lead[]>([]);
  const previousLeadCountRef = useRef(0);
  const discoveredAtRef = useRef<Map<string, number>>(new Map());
  const NEW_LEAD_REVIEW_MS = 7000;
  const automationModeRef = useRef<'manual' | 'automatic'>('manual');
  const loadingRef = useRef(false);
  const autoSendRunningRef = useRef(false);
  const inFlightLeadIdsRef = useRef<Set<string>>(new Set());

  // Load leads on mount
  useEffect(() => {
    const loadLeads = async () => {
      try {
        const response = await fetch('/api/leads/load');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const loadedLeads = data.map((l: Lead) => ({ 
            ...l, 
            status: l.status === 'new' ? 'ready' : l.status 
          }));
          // Loaded leads are historical; do not delay them with "new lead review" timing.
          loadedLeads.forEach((lead) => discoveredAtRef.current.set(lead.id, 0));
          setLeads(loadedLeads);
        }
      } catch (error) {
        console.error("Failed to load leads:", error);
      } finally {
        initialLoadDone.current = true;
      }
    };
    loadLeads();
  }, []);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    automationModeRef.current = automationMode;
  }, [automationMode]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (automationMode === 'manual') {
      setAutomationStatus('Idle');
      setActiveAutoLeadName(null);
      previousLeadCountRef.current = leads.length;
      return;
    }

    const prevCount = previousLeadCountRef.current;
    if (leads.length > prevCount) {
      const added = leads.length - prevCount;
      setAutomationStatus(`New leads found: +${added}`);
    } else if (loading) {
      setAutomationStatus('Hunting new leads...');
    } else if (activeAutoLeadName) {
      setAutomationStatus(`Sending email to ${activeAutoLeadName}...`);
    } else if (leads.some((l) => l.status === 'new' && l.email)) {
      const now = Date.now();
      const hasFreshNewLeads = leads.some((l) => {
        if (l.status !== 'new' || !l.email) return false;
        const discoveredAt = discoveredAtRef.current.get(l.id) ?? 0;
        return now - discoveredAt < NEW_LEAD_REVIEW_MS;
      });
      setAutomationStatus(hasFreshNewLeads ? 'Reviewing fresh leads...' : 'Queue ready for outreach');
    } else {
      setAutomationStatus('Waiting for next leads...');
    }

    previousLeadCountRef.current = leads.length;
  }, [automationMode, loading, leads, activeAutoLeadName]);

  // Keep side-panel draft in sync when lead data changes after sending/enrichment.
  useEffect(() => {
    if (!selectedLead) return;
    const latestSelected = leads.find((l) => l.id === selectedLead.id);
    if (latestSelected && latestSelected !== selectedLead) {
      setSelectedLead(latestSelected);
    }
  }, [leads, selectedLead]);

  const handleSendEmail = async (lead: Lead) => {
    console.log("Attempting to send email for lead:", lead.businessName, "to:", lead.email);
    if (!lead.email) {
      alert("No email address found for this lead. Please add it manually below or try 'Deep Enrich' button.");
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          subject: `Quick question about ${lead.businessName}'s setup`,
          html: lead.personalizedDraft,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'contacted' as Lead['status'] } : l));
        alert(`Email successfully dispatched to ${lead.email}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Email send failed:", error);
      alert(`Dispatch Failed: ${error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleEnrich = async (lead: Lead) => {
    setEnriching(true);
    try {
      const enrichment = await enrichLead(lead);
      if (enrichment.email || enrichment.phoneNumber) {
        const newLeads = leads.map(l => l.id === lead.id ? {
          ...l, 
          email: enrichment.email || l.email, 
          phoneNumber: enrichment.phoneNumber || l.phoneNumber
        } : l);
        setLeads(newLeads);
        if (selectedLead?.id === lead.id) {
          setSelectedLead({
            ...selectedLead, 
            email: enrichment.email || selectedLead.email, 
            phoneNumber: enrichment.phoneNumber || selectedLead.phoneNumber
          });
        }
      } else {
        alert("Deep search completed, but no additional contact info was found.");
      }
    } catch (error) {
      console.error("Enrichment failed:", error);
    } finally {
      setEnriching(false);
    }
  };

  // Auto-save leads when they change
  useEffect(() => {
    if (!initialLoadDone.current || leads.length === 0) return;

    const saveTimeout = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/leads/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leads),
        });
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setSaving(false);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [leads]);

  // Automatic Outreach Engine (The User's Best Friend)
  useEffect(() => {
    if (automationMode === 'manual' || loading || leads.length === 0 || autoSendRunningRef.current) return;

    const autoSend = async () => {
      autoSendRunningRef.current = true;
      try {
        while (automationModeRef.current === 'automatic' && !loadingRef.current) {
          // Pick the next lead that is new, has email, and is not already being processed.
          const now = Date.now();
          const nextLead = leadsRef.current.find((l) => {
            if (l.status !== 'new' || !l.email || inFlightLeadIdsRef.current.has(l.id)) return false;
            const discoveredAt = discoveredAtRef.current.get(l.id) ?? 0;
            return now - discoveredAt >= NEW_LEAD_REVIEW_MS;
          });
          if (!nextLead) {
            const hasQueuedNewLeads = leadsRef.current.some(
              (l) => l.status === 'new' && !!l.email && !inFlightLeadIdsRef.current.has(l.id)
            );
            if (!hasQueuedNewLeads) break;

            // Keep loop alive while fresh leads are in review window.
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          // Show currently processed lead in the right draft panel during auto mode.
          setSelectedLead(nextLead);
          setActiveAutoLeadName(nextLead.businessName);
          setAutomationStatus(`Sending email to ${nextLead.businessName}...`);

          inFlightLeadIdsRef.current.add(nextLead.id);
          try {
            const response = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: nextLead.email,
                subject: `Quick question about ${nextLead.businessName}'s setup`,
                html: nextLead.personalizedDraft.replace(/\n/g, '<br/>'),
              }),
            });

            const result = await response.json();
            if (result.success) {
              setLeads(prev => prev.map(l => l.id === nextLead.id ? { ...l, status: 'contacted' as Lead['status'] } : l));
              setAutomationStatus(`Email sent to ${nextLead.businessName}`);
            }
          } catch (error) {
            console.error(`[Automation] Failed to send to ${nextLead.businessName}:`, error);
            setAutomationStatus(`Send failed: ${nextLead.businessName}`);
          } finally {
            inFlightLeadIdsRef.current.delete(nextLead.id);
            setActiveAutoLeadName(null);
          }

          // Safety delay to prevent spamming
          await new Promise(resolve => setTimeout(resolve, 3500));
        }
      } finally {
        autoSendRunningRef.current = false;
      }
    };

    autoSend();
  }, [leads, automationMode, loading]);

  // Autonomous Targeting Logic (Pick new targets if idle in Auto-Mode)
  useEffect(() => {
    if (automationMode === 'manual' || loading) return;
    
    // If no new leads to send, and we are idle, find something to do
    const pendingLeads = leads.filter(l => l.status === 'new');
    if (pendingLeads.length === 0) {
      console.log("[Automation] Pipeline empty. Selecting next target region...");
      
      let nextLocation: string;
      
      if (selectedCountry && AFRICAN_DIRECTORY[selectedCountry]) {
        // If user locked a country, rotate through its cities
        const cities = AFRICAN_DIRECTORY[selectedCountry];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        nextLocation = `${randomCity}, ${selectedCountry}`;
      } else {
        // Full continental rotation
        nextLocation = AFRICAN_LOCATIONS[Math.floor(Math.random() * AFRICAN_LOCATIONS.length)];
      }
      
      const randomIndustry = INDUSTRIES[Math.floor(Math.random() * INDUSTRIES.length)];
      
      setParams({ location: nextLocation, niche: randomIndustry });
      
      // Small delay for stability before firing the search
      const autoSearchTimer = setTimeout(() => {
        if (automationMode === 'automatic' && !loading) {
          handleSearch();
        }
      }, 3000);

      return () => clearTimeout(autoSearchTimer);
    }
  }, [leads, automationMode, loading, selectedCountry]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!params.location || !params.niche) return;
    
    setLoading(true);
    const results = await discoverLeads(params.location, params.niche);
    setLeads(prev => {
      // Archive current 'new' leads into the pipeline before adding truly new ones
      const pipeline = prev.map(l => l.status === 'new' ? { ...l, status: 'ready' } as Lead : l);
      
      const newlyFound = results
        .map(r => ({ ...r, status: 'new' }) as Lead)
        .filter(nr => !pipeline.some(er => er.businessName.toLowerCase() === nr.businessName.toLowerCase()));

      const discoveredAt = Date.now();
      newlyFound.forEach((lead) => discoveredAtRef.current.set(lead.id, discoveredAt));
        
      return [...pipeline, ...newlyFound];
    });
    setLoading(false);
  };

  const openLeadDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setShowModal(true);
  };

  const stopAutomation = () => {
    setIsStoppingAutomation(true);
    setAutomationMode('manual');
    setAutomationStatus('Idle');
    setActiveAutoLeadName(null);
    // Fast visual feedback for operator action.
    setTimeout(() => setIsStoppingAutomation(false), 400);
  };

  const normalizeStatus = (status: Lead['status'] | string) => String(status || '').trim().toLowerCase();
  const businessKey = (name?: string) => String(name || '').trim().toLowerCase();

  // Always prioritize new leads first, then newer discovery timestamps.
  const sortedLeads = [...leads].sort((a, b) => {
    const aIsNew = normalizeStatus(a.status) === 'new' ? 1 : 0;
    const bIsNew = normalizeStatus(b.status) === 'new' ? 1 : 0;
    if (aIsNew !== bIsNew) return bIsNew - aIsNew;

    const aDiscovered = discoveredAtRef.current.get(a.id) ?? 0;
    const bDiscovered = discoveredAtRef.current.get(b.id) ?? 0;
    return bDiscovered - aDiscovered;
  });

  // If a business already has any non-new record, it should not appear in NEW LEADS.
  const businessesWithOlderRecords = new Set(
    sortedLeads
      .filter((l) => normalizeStatus(l.status) !== 'new')
      .map((l) => businessKey(l.businessName))
  );

  // New Leads section: only truly new leads, newest first.
  const newLeads = sortedLeads
    .filter((l) => {
      const isNew = normalizeStatus(l.status) === 'new';
      const hasOlderForBusiness = businessesWithOlderRecords.has(businessKey(l.businessName));
      return isNew && !hasOlderForBusiness;
    })
    .sort((a, b) => {
      const aDiscovered = discoveredAtRef.current.get(a.id) ?? 0;
      const bDiscovered = discoveredAtRef.current.get(b.id) ?? 0;
      return bDiscovered - aDiscovered;
    });
  // Contacted / Older section: everything that is not new.
  const contactedOrOlderLeads = sortedLeads.filter((l) => normalizeStatus(l.status) !== 'new');

  const LeadCard = ({ lead, idx, section = 'older' }: any) => {
    const normalizedStatus = normalizeStatus(lead.status);

    // Hard safety guard: never render non-new items inside the NEW LEAD section.
    if (section === 'new' && normalizedStatus !== 'new') return null;

    return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => openLeadDetails(lead)}
      className={`group p-5 flex items-center justify-between transition-all cursor-pointer border ${
        selectedLead?.id === lead.id 
          ? 'bg-white/[0.12] border-[#FF6B35]/30' 
          : 'bg-white/5 border-transparent hover:bg-white/[0.08]'
      }`}
    >
      <div className="flex flex-col gap-1">
        <p className={`font-serif italic text-lg ${selectedLead?.id === lead.id ? 'text-[#FF6B35]' : 'text-white'}`}>
          {lead.businessName}
          {normalizedStatus === 'new' && (
            <span className="ml-3 text-[8px] bg-[#FF6B35] text-black px-1.5 py-0.5 rounded-full not-italic font-bold uppercase relative -top-0.5">New</span>
          )}
          {section !== 'new' && normalizedStatus === 'contacted' && (
            <span className="ml-3 text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded-full not-italic font-bold uppercase relative -top-0.5">Contacted</span>
          )}
        </p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
          {lead.suggestedService} @ {lead.industry}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono text-[#FF6B35] font-bold">{lead.score}% Fit</p>
        <p className="text-[10px] uppercase tracking-tighter text-slate-600">{lead.location}</p>
      </div>
    </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-200 font-sans selection:bg-[#FF6B35] selection:text-black overflow-hidden relative">
      {/* Intelligence Modal */}
      <AnimatePresence>
        {showModal && selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#070707]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded-lg flex items-center justify-center text-[#FF6B35]">
                    <Target size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif italic text-white leading-none mb-1">{selectedLead.businessName}</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">{selectedLead.industry} • {selectedLead.location}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                {/* Executive Summary */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-4">
                    <h3 className="text-xs uppercase tracking-[0.3em] text-[#FF6B35] font-bold">Deep Intel Overview</h3>
                    <p className="text-slate-300 leading-relaxed font-serif text-lg italic">
                      "{selectedLead.intelligenceReport?.companyOverview || 'Generating overview...'}"
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-6 rounded-lg space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] uppercase text-slate-500 tracking-widest">Target Fit Score</span>
                      <span className="text-3xl font-bold text-[#FF6B35]">{selectedLead.score}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF6B35]" style={{ width: `${selectedLead.score}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">This lead matches high-conversion markers for {selectedLead.suggestedService} deployment.</p>
                  </div>
                </section>

                <div className="h-[1px] bg-white/5 w-full"></div>

                {/* Automation & Tech Stack */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm">
                  <div className="space-y-6">
                    <h3 className="flex items-center gap-2 text-white font-bold">
                      <AlertCircle size={16} className="text-[#FF6B35]" />
                      IDENTIFIED FRICTION POINTS
                    </h3>
                    <ul className="space-y-4">
                      {selectedLead.automationGaps.map((gap, i) => (
                        <li key={i} className="flex gap-3 text-slate-400 leading-relaxed">
                          <span className="text-[#FF6B35] font-mono mt-0.5">0{i+1}.</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-6">
                    <h3 className="flex items-center gap-2 text-white font-bold">
                      <Cpu size={16} className="text-[#FF6B35]" />
                      TECHNOLOGY ECOSYSTEM
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.intelligenceReport?.techStackIdentified?.map((tech, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-slate-300 uppercase tracking-widest">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Additional Intelligence */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-white/5 pt-12">
                   <div className="space-y-6">
                      <h3 className="flex items-center gap-2 text-white font-bold">
                        <TrendingUp size={16} className="text-[#FF6B35]" />
                        ESTIMATED ROI ANALYSIS
                      </h3>
                      <p className="text-slate-400 italic font-serif leading-relaxed">
                        {selectedLead.intelligenceReport?.potentialROI || 'Calculating impact...'}
                      </p>
                   </div>
                   <div className="space-y-6">
                      <h3 className="flex items-center gap-2 text-white font-bold">
                        <Globe size={16} className="text-[#FF6B35]" />
                        RECENT GROWTH SIGNALS
                      </h3>
                      <p className="text-slate-400 italic font-serif leading-relaxed">
                        {selectedLead.intelligenceReport?.recentNews || "No major recent public changes identified."}
                      </p>
                   </div>
                </section>

                {selectedLead.intelligenceReport?.founderContext && (
                  <section className="border-t border-white/5 pt-12">
                      <h3 className="flex items-center gap-2 text-white font-bold mb-6">
                        <User size={16} className="text-[#FF6B35]" />
                        KEY DECISION MAKERS
                      </h3>
                      <div className="bg-white/5 p-6 border border-white/5 rounded-lg flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-[#FF6B35]">
                          <User size={20} />
                        </div>
                        <p className="text-slate-300 font-serif italic text-lg leading-none">{selectedLead.intelligenceReport.founderContext}</p>
                      </div>
                  </section>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-8 border-t border-white/10 bg-[#070707] flex gap-4">
                <button 
                   disabled={sendingEmail}
                   onClick={() => {
                     if (selectedLead?.phoneNumber) {
                       window.open(`https://wa.me/${selectedLead.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(selectedLead.personalizedDraft)}`, '_blank');
                     } else if (selectedLead?.email) {
                       handleSendEmail(selectedLead);
                     } else {
                       navigator.clipboard.writeText(selectedLead?.personalizedDraft || '');
                       alert('No contact info found. Draft copied to clipboard.');
                     }
                   }}
                   className="flex-1 bg-[#FF6B35] text-black font-bold py-4 text-xs uppercase tracking-widest hover:bg-[#ff8a5e] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingEmail ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  {sendingEmail ? 'Dispatching...' : 'Send Intelligence Outreach'}
                </button>
                {selectedLead.website && (
                  <a 
                    href={selectedLead.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-8 border border-white/20 text-white text-[10px] py-4 uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    <Globe size={16} />
                    Open Website
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Navigation */}
      <header className="min-h-20 border-b border-white/10 px-4 md:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-3 bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {!BRANDING.logoUrl || logoLoadFailed ? (
            <div className="w-9 h-9 md:w-10 md:h-10 bg-[#FF6B35] rounded-full flex items-center justify-center font-bold text-black text-lg md:text-xl shadow-lg shadow-orange-500/10 shrink-0">
              {BRANDING.appName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <img
              src={BRANDING.logoUrl}
              alt={`${BRANDING.appName} logo`}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-lg shadow-orange-500/10 bg-white shrink-0"
              onError={() => setLogoLoadFailed(true)}
            />
          )}
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-serif italic tracking-wide text-white truncate">{BRANDING.appName}</h1>
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.16em] md:tracking-[0.2em] text-[#FF6B35] font-semibold truncate">{BRANDING.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] md:text-[11px] uppercase tracking-widest">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 self-center">
            <button
              onClick={() => setAutomationMode('manual')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-2 ${
                automationMode === 'manual' 
                  ? 'bg-slate-800 text-[#FF6B35] font-bold border border-white/10' 
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setAutomationMode('automatic')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-2 ${
                automationMode === 'automatic' 
                  ? 'bg-[#FF6B35] text-black font-bold shadow-lg shadow-orange-500/20' 
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {automationMode === 'automatic' && <Activity size={12} className="animate-pulse" />}
              Automatic
            </button>
            {automationMode === 'automatic' && (
              <button
                onClick={stopAutomation}
                disabled={isStoppingAutomation}
                className="px-4 py-1.5 rounded-full transition-all flex items-center gap-2 bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-60"
              >
                <X size={12} />
                {isStoppingAutomation ? 'Stopping...' : 'Stop Auto'}
              </button>
            )}
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-1 hidden xl:block"></div>
          <span className="text-slate-400 hover:text-white cursor-pointer transition-colors hidden xl:inline">Lead Pipeline</span>
          <span className="text-slate-400 hover:text-white cursor-pointer transition-colors hidden xl:inline">Logs</span>
        </div>
          <div className="ml-auto flex items-center gap-2 md:gap-4 flex-wrap justify-end">
            <div className="flex gap-2 items-center px-3 md:px-4 py-2 bg-white/5 border border-white/10 rounded text-[9px] md:text-[10px] uppercase tracking-widest">
              {saving ? (
                <>
                  <RefreshCw size={12} className="animate-spin text-[#FF6B35]" />
                  <span className="text-slate-400">Syncing to disk...</span>
                </>
              ) : (
                <>
                  <Save size={12} className="text-emerald-500" />
                  <span className="text-slate-400 font-mono tracking-tighter">Persistence Active ({leads.length})</span>
                </>
              )}
            </div>
            <div className="h-8 w-[1px] bg-white/10 mx-1 hidden lg:block"></div>
            <div className="text-right hidden lg:block">
              <p className="text-xs font-semibold text-white">Dev Team Alpha</p>
              <p className="text-[10px] text-slate-500">SLA Active: {loading ? 'Processing...' : '99.9%'}</p>
            </div>
            {automationMode === 'automatic' && (
              <>
                <div className="h-8 w-[1px] bg-white/10 mx-1 hidden md:block"></div>
                <div className="text-right max-w-[220px] md:max-w-[320px]">
                  <p className="text-[10px] uppercase tracking-widest text-[#FF6B35] font-semibold">Automation Context</p>
                  <p className="text-xs md:text-sm font-semibold text-[#FFB08A] truncate bg-[#FF6B35]/10 border border-[#FF6B35]/30 rounded px-2 md:px-3 py-1.5">
                    {automationStatus}
                  </p>
                </div>
              </>
            )}
          </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
        {/* Left Controls: Search & Parameters */}
        <section className="col-span-4 lg:col-span-3 border-r border-white/10 p-8 flex flex-col gap-6 bg-[#050505] overflow-y-auto custom-scrollbar h-full min-h-0">
          <div className="space-y-6">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-6 font-bold">Targeting Parameters</h2>
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] uppercase text-slate-400 tracking-wider">Target Country (All Africa)</label>
                <div className="relative group">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#FF6B35] transition-colors" size={14} />
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[#FF6B35] outline-none text-slate-200 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#050505]">Autonomous Continent-wide</option>
                    {Object.keys(AFRICAN_DIRECTORY).sort().map(country => (
                      <option key={country} value={country} className="bg-[#050505]">{country}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase text-slate-400 tracking-wider">Specific Hub / City</label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#FF6B35] transition-colors" size={14} />
                  <input
                    type="text"
                    list="locations-list"
                    value={params.location}
                    onChange={(e) => setParams({ ...params, location: e.target.value })}
                    placeholder={selectedCountry ? `Search cities in ${selectedCountry}` : "e.g. Lagos, Nigeria"}
                    className="w-full bg-white/5 border border-white/10 rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[#FF6B35] outline-none text-slate-200 transition-all placeholder:text-slate-700"
                  />
                  <datalist id="locations-list">
                    {(selectedCountry 
                      ? AFRICAN_DIRECTORY[selectedCountry].map(city => `${city}, ${selectedCountry}`)
                      : AFRICAN_LOCATIONS
                    ).map(loc => <option key={loc} value={loc} />)}
                  </datalist>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] uppercase text-slate-400 tracking-wider">Industry / Niche</label>
                <div className="relative group">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[#FF6B35] transition-colors" size={14} />
                  <input
                    type="text"
                    list="industries-list"
                    value={params.niche}
                    onChange={(e) => setParams({ ...params, niche: e.target.value })}
                    placeholder="Fintech, Logistics, Agrotech"
                    className="w-full bg-white/5 border border-white/10 rounded-sm py-3 pl-10 pr-4 text-sm focus:border-[#FF6B35] outline-none text-slate-200 transition-all placeholder:text-slate-700"
                  />
                  <datalist id="industries-list">
                    {INDUSTRIES.map(ind => <option key={ind} value={ind} />)}
                  </datalist>
                </div>
              </div>

              <button
                disabled={loading}
                className="w-full bg-[#FF6B35] text-black font-bold py-4 text-xs uppercase tracking-widest hover:bg-[#ff8a5e] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.99]"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                {loading ? 'Executing search...' : (automationMode === 'automatic' ? 'Deploy & Auto-Outreach' : 'Initialize Deep Search')}
              </button>
            </form>
          </div>

          <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-lg shrink-0">
            <h3 className="text-sm font-serif italic mb-4 text-white">System Summary</h3>
            <ul className="text-[11px] space-y-4">
              <li className="flex justify-between items-center text-slate-400">
                <span>Active Agents</span> 
                <span className="text-[#FF6B35] font-mono">4 (Gemini-3)</span>
              </li>
              <li className="flex justify-between items-center text-slate-400">
                <span>Daily Lead Quota</span> 
                <span className="text-slate-200">250 / 1000</span>
              </li>
              <li className="flex justify-between items-center text-slate-400">
                <span>WhatsApp Sync</span> 
                <span className="text-emerald-500 italic uppercase text-[10px] font-bold">Online</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Center Content: Lead Grid */}
        <section className="col-span-8 lg:col-span-5 p-8 flex flex-col bg-[#050505] overflow-y-auto custom-scrollbar h-full min-h-0">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">Prospect Pipeline</h2>
            <span className="text-[10px] text-slate-600 font-mono italic">
              {loading ? 'Hunting...' : `Showing ${leads.length} entities discovered`}
            </span>
          </div>

          {!leads.length && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
              <Activity size={48} className="text-slate-800 mb-6" />
              <p className="text-sm font-serif italic text-slate-500">Wait for targeting initialization...</p>
            </div>
          )}
          
          <div className="space-y-12">
            <AnimatePresence>
              {/* New Leads Section */}
              {newLeads.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-l-2 border-[#FF6B35] pl-3 py-1">
                    <h3 className="text-[10px] uppercase tracking-[0.4em] text-white font-bold">New Leads</h3>
                    <div className="h-[1px] flex-1 bg-white/5"></div>
                    <span className="text-[10px] font-mono text-[#FF6B35]">{newLeads.length}</span>
                  </div>
                  <div className="space-y-1">
                    {newLeads.map((lead, idx) => (
                      <LeadCard key={`new-${lead.id}`} lead={lead} idx={idx} section="new" />
                    ))}
                  </div>
                </div>
              )}

              {/* Contacted / Older Section */}
              {contactedOrOlderLeads.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-l-2 border-slate-700 pl-3 py-1">
                    <h3 className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">Contacted / Older Leads</h3>
                    <div className="h-[1px] flex-1 bg-white/5"></div>
                  </div>
                  <div className="space-y-1 opacity-60 hover:opacity-100 transition-opacity">
                    {contactedOrOlderLeads.slice().reverse().map((lead, idx) => (
                      <LeadCard key={`older-${lead.id}`} lead={lead} idx={idx} section="older" />
                    ))}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Panel: Outreach Preview */}
        <section className="col-span-4 bg-[#0A0A0A] border-l border-white/10 flex flex-col hidden lg:flex h-full min-h-0">
          <div className="p-8 border-b border-white/10 flex-1 overflow-y-auto custom-scrollbar">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-6 font-bold">Intelligence Draft</h2>
            
            {selectedLead ? (
              <div className="bg-black p-6 rounded border border-white/5 min-h-[450px] shadow-inner space-y-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Subject Anchor</p>
                  <p className="text-xs font-mono text-[#FF6B35]">Efficiency Audit for {selectedLead.businessName}</p>
                </div>
                
                <div className="h-[1px] bg-white/5 w-full"></div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-600 mb-1">
                    <span>Contact Intelligence</span>
                    {selectedLead.email ? (
                      <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10} /> Validated</span>
                    ) : (
                      <span className="text-amber-500/50 flex items-center gap-1"><AlertCircle size={10} /> Add Email Below</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="email"
                      value={selectedLead.email || ''}
                      onChange={(e) => {
                        const newLeads = leads.map(l => l.id === selectedLead.id ? {...l, email: e.target.value} : l);
                        setLeads(newLeads);
                        setSelectedLead({...selectedLead, email: e.target.value});
                      }}
                      placeholder="Enter target email (e.g. info@company.com)"
                      className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FF6B35] transition-all"
                    />
                    <button
                      onClick={() => handleEnrich(selectedLead)}
                      disabled={enriching}
                      title="Deep AI Search for Email/WhatsApp"
                      className="p-2 bg-[#FF6B35]/10 border border-[#FF6B35]/30 text-[#FF6B35] hover:bg-[#FF6B35]/20 rounded transition-all disabled:opacity-30"
                    >
                      {enriching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>
                </div>

                <div className="h-[1px] bg-white/5 w-full"></div>

                <div className="text-sm leading-relaxed text-slate-300 font-serif italic whitespace-pre-wrap">
                  {selectedLead.personalizedDraft}
                </div>

                <div className="h-[1px] bg-white/5 w-full mt-auto"></div>
                
                <div className="pt-4 flex flex-col gap-3">
                    <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Automation Gaps Found:</div>
                    <div className="flex flex-wrap gap-2">
                        {selectedLead.automationGaps.map((gap, i) => (
                            <span key={i} className="px-2 py-1 bg-white/5 border border-white/5 text-[9px] text-[#FF6B35]">
                                {gap}
                            </span>
                        ))}
                    </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10">
                <Send size={40} className="mb-4" />
                <p className="text-xs uppercase tracking-widest">Select an entity to preview outreach intelligence</p>
              </div>
            )}
          </div>
          
          <div className="p-8 flex flex-col gap-3 shrink-0">
            <button 
              disabled={!selectedLead}
              onClick={() => {
                if (selectedLead?.phoneNumber) {
                  window.open(`https://wa.me/${selectedLead.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(selectedLead.personalizedDraft)}`, '_blank');
                } else {
                  navigator.clipboard.writeText(selectedLead?.personalizedDraft || '');
                  alert('WhatsApp number not found. Draft copied to clipboard for manual sending.');
                }
              }}
              className="w-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] py-4 uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              <Send size={14} />
              Launch WhatsApp (Direct)
            </button>
            <button 
              disabled={!selectedLead || sendingEmail}
              onClick={() => selectedLead && handleSendEmail(selectedLead)}
              className="w-full border border-white/20 text-white text-[10px] py-4 uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
            >
              {sendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              {sendingEmail ? 'Dispatching...' : 'Deploy Email (SMTP)'}
            </button>
            <p className="text-[9px] text-center text-slate-600 mt-4 uppercase tracking-[0.2em] italic font-serif leading-loose">
              Pitched: Voice AI • WhatsApp API • Custom RAG<br/>
              Redirect: <span className="text-[#FF6B35]">{BRANDING.websiteUrl}</span>
            </p>
          </div>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="h-12 border-t border-white/10 px-10 flex items-center justify-between text-[10px] uppercase tracking-widest bg-black shrink-0 relative z-10">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_bg-emerald-500]"></div>
            <span className="text-[#FF6B35] font-bold">Status: Operational</span>
          </div>
          <span className="text-slate-600 italic border-l border-white/10 pl-6">
            Engine: Gemini-3 Deep Search // {new Date().toLocaleTimeString()}
          </span>
        </div>
        <div className="text-slate-600 flex items-center gap-2">
          <span>{BRANDING.footerText}</span>
          <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
          <span>{BRANDING.versionLabel}</span>
        </div>
      </footer>
    </div>
  );
}
