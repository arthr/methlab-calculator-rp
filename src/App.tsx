/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  FlaskConical, 
  Package, 
  FileText, 
  Box, 
  Droplet, 
  Calculator, 
  Info,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Constantes de Produção (para 100 unidades)
const BATCH_SIZE = 100;
const REQUIREMENTS = {
  aluminum: 20,
  paper: 50,
  plastic: 20,
  ephedrine: 40,
};

const ITEM_NAMES = {
  aluminum: 'Pó de Alumínio',
  paper: 'Folha de Papel',
  plastic: 'Embalagem Plástica',
  ephedrine: 'Efedrina',
};

const ITEM_ICONS = {
  aluminum: FlaskConical,
  paper: FileText,
  plastic: Box,
  ephedrine: Droplet,
};

type ItemKey = keyof typeof REQUIREMENTS;

export default function App() {
  const [quantities, setQuantities] = useState<Record<ItemKey, string>>({
    aluminum: '',
    paper: '',
    plastic: '',
    ephedrine: '',
  });
  const [manuallyEdited, setManuallyEdited] = useState<Set<ItemKey>>(new Set());
  const [lastEditedKey, setLastEditedKey] = useState<ItemKey | null>(null);

  const [activeInput, setActiveInput] = useState<ItemKey | 'none'>('none');

  const applyBatchesPreset = (num: number) => {
    const nextQuantities = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce((acc, k) => {
      acc[k] = (num * REQUIREMENTS[k]).toString();
      return acc;
    }, {} as Record<ItemKey, string>);
    
    setQuantities(nextQuantities);
    setManuallyEdited(new Set()); 
  };

  const adjustBatches = (delta: number) => {
    const currentBatches = calculation?.batches || 0;
    const next = Math.max(0, currentBatches + delta);
    applyBatchesPreset(next);
  };

  const handleInputChange = (key: ItemKey, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    
    setQuantities(prev => {
      const nextManuallyEdited = new Set(manuallyEdited);
      if (value === '') {
        nextManuallyEdited.delete(key);
      } else {
        nextManuallyEdited.add(key);
      }
      
      const nextQuantities = { ...prev, [key]: value };
      
      // Determine target batches from all manual inputs
      const manualKeys = (Object.keys(REQUIREMENTS) as ItemKey[]).filter(k => 
        nextManuallyEdited.has(k) && nextQuantities[k] !== '' && parseInt(nextQuantities[k]) >= 0
      );
      
      let targetBatches = 0;
      if (manualKeys.length > 0) {
        // If multiple manual inputs, target is driven by the bottleneck to show surplus
        // If only one, target is driven by that one to show requirements
        if (manualKeys.length === 1) {
          const k = manualKeys[0];
          targetBatches = Math.floor(parseInt(nextQuantities[k]) / REQUIREMENTS[k]);
        } else {
          targetBatches = manualKeys.reduce((min, k) => {
            const b = Math.floor(parseInt(nextQuantities[k]) / REQUIREMENTS[k]);
            return b < min ? b : min;
          }, Infinity);
        }
      }

      // Update non-manual ones to match target batches
      (Object.keys(REQUIREMENTS) as ItemKey[]).forEach(k => {
        if (!nextManuallyEdited.has(k)) {
          nextQuantities[k] = (manualKeys.length > 0 && targetBatches >= 0) 
            ? (targetBatches * REQUIREMENTS[k]).toString() 
            : '';
        }
      });
      
      setManuallyEdited(nextManuallyEdited);
      return nextQuantities;
    });
  };

  const clearAll = () => {
    setQuantities({
      aluminum: '',
      paper: '',
      plastic: '',
      ephedrine: '',
    });
    setManuallyEdited(new Set());
    setLastEditedKey(null);
    setActiveInput('none');
  };

  const calculation = useMemo(() => {
    const activeKeys = (Object.keys(quantities) as ItemKey[]).filter(k => quantities[k] !== '' && parseInt(quantities[k]) > 0);
    
    if (activeKeys.length === 0) return null;

    // Determine the baseline:
    // If multiple fields are filled, the bottleneck (lowest batches) defines the production.
    // If only one is filled, we use that one as the TARGET to show requirements.
    let batches = 0;
    let isTargetMode = activeKeys.length === 1;

    if (isTargetMode) {
      const key = activeKeys[0];
      batches = Math.floor(parseInt(quantities[key]) / REQUIREMENTS[key]);
    } else {
      batches = Infinity;
      activeKeys.forEach(key => {
        const val = parseInt(quantities[key]);
        const possibleBatches = Math.floor(val / REQUIREMENTS[key]);
        if (possibleBatches < batches) {
          batches = possibleBatches;
        }
      });
    }

    if (batches === Infinity) batches = 0;

    const totalProduced = batches * BATCH_SIZE;
    
    const needed = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce((acc, key) => {
      acc[key] = batches * REQUIREMENTS[key];
      return acc;
    }, {} as Record<ItemKey, number>);

    const surplus = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce((acc, key) => {
      const current = parseInt(quantities[key]) || 0;
      acc[key] = Math.max(0, current - needed[key]);
      return acc;
    }, {} as Record<ItemKey, number>);

    const missing = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce((acc, key) => {
      const current = parseInt(quantities[key]) || 0;
      acc[key] = Math.max(0, needed[key] - current);
      return acc;
    }, {} as Record<ItemKey, number>);

    const limitingFactors = (Object.keys(REQUIREMENTS) as ItemKey[]).filter(key => {
        const val = parseInt(quantities[key]) || 0;
        return Math.floor(val / REQUIREMENTS[key]) === batches;
    });

    const nextBatchMissing = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce((acc, key) => {
        const current = parseInt(quantities[key]) || 0;
        const target = (batches + 1) * REQUIREMENTS[key];
        acc[key] = Math.max(0, target - current);
        return acc;
    }, {} as Record<ItemKey, number>);

    const mainBottleneck = limitingFactors[0];

    return {
      batches,
      totalProduced,
      needed,
      surplus,
      missing,
      limitingFactors,
      nextBatchMissing,
      mainBottleneck,
      isTargetMode
    };
  }, [quantities]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-sans flex flex-col selection:bg-brand-purple/30 bg-camo">
      {/* Header Navigation */}
      <nav className="border-b border-slate-800/60 bg-[#161b22]/90 backdrop-blur-xl px-8 py-4 flex justify-between items-center shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-900/40 border border-white/10 group active:scale-95 transition-transform">
            <Crown className="h-7 w-7 text-brand-gold gold-glow group-hover:rotate-12 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-3xl italic leading-none text-metallic">D'LA NORTE</span>
            <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] ml-0.5 mt-1">SISTEMA OPERACIONAL</span>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-8">
            <div className="flex flex-col items-end">
               <span className="text-white/30 font-script text-base italic -mb-1">Dos escombros construímos história</span>
               <span className="text-[8px] font-black text-brand-purple/40 uppercase tracking-[0.5em]">Laboratório de Processamento</span>
            </div>
        </div>

        <button 
          onClick={clearAll}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-brand-purple/10 border border-slate-800 hover:border-brand-purple/30 rounded-xl transition-all text-slate-400 hover:text-brand-purple active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Limpar</span>
        </button>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Recipe Info */}
        <aside className="w-full md:w-80 glass-card p-8 flex flex-col shrink-0 overflow-y-auto">
          <h2 className="text-[10px] font-black text-slate-500 uppercase mb-8 tracking-[0.3em] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-purple shadow-[0_0_8px_#7c3aed]"></div>
            Insumos por Lote (100u)
          </h2>
          <div className="space-y-3 mb-8">
            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
              const Icon = ITEM_ICONS[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 bg-[#0f1115]/50 border border-slate-800/40 rounded-2xl group hover:border-brand-purple/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-600 group-hover:text-brand-purple transition-colors" />
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors uppercase tracking-tight">{ITEM_NAMES[key]}</span>
                  </div>
                  <span className="font-mono text-brand-purple/60 font-black text-xs tracking-widest group-hover:text-brand-purple">{REQUIREMENTS[key]}u</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-auto p-6 bg-brand-purple/5 border border-brand-purple/20 rounded-3xl relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 group-hover:-rotate-12 transition-all duration-500">
                <Crown className="w-24 h-24 text-brand-gold" />
            </div>
            <p className="text-brand-purple font-black mb-3 uppercase tracking-widest text-[9px] flex items-center gap-2">
               <Info className="w-3 h-3" />
               Aviso do Comando
            </p>
            <span className="text-slate-400 italic text-[11px] leading-relaxed font-medium block">
              Processamento em lotes de 100. Resíduos devem ser mantidos em estoque.
            </span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-10 overflow-y-auto relative">
          <div className="max-w-5xl mx-auto h-full">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr,400px] gap-10">
              
              {/* Inputs */}
              <section className="space-y-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-slate-800/60 pb-8">
                  <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase text-metallic">Operação</h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Gerenciamento de recursos</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-[#161b22] px-2 py-1.5 rounded-xl border border-slate-800">
                      <button 
                        onClick={() => adjustBatches(-1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-purple/10 text-brand-purple/60 hover:text-brand-purple transition-all active:scale-90"
                      >
                        -
                      </button>
                      <div className="px-4 text-center min-w-[70px]">
                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">Ciclos</p>
                        <p className="text-sm font-mono font-black text-brand-purple">{calculation?.batches || 0}</p>
                      </div>
                      <button 
                        onClick={() => adjustBatches(1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-brand-purple/10 text-brand-purple/60 hover:text-brand-purple transition-all active:scale-90"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                       {[1, 5, 10].map(n => (
                         <button
                           key={n}
                           onClick={() => applyBatchesPreset(n)}
                           className="px-4 py-3 bg-[#161b22] border border-slate-800 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:border-brand-purple hover:text-brand-purple transition-all active:scale-95"
                         >
                           {n}F
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-6">
                  {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
                    const isMissing = calculation && calculation.missing[key] > 0;
                    const hasValue = quantities[key] !== '';
                    const isLimiting = calculation?.limitingFactors.includes(key);

                    return (
                      <div key={key} className="group">
                        <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] flex justify-between items-center px-1 mb-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1 h-1 rounded-full ${hasValue ? 'bg-brand-purple shadow-[0_0_5px_#7c3aed]' : 'bg-slate-800'}`}></span>
                            {ITEM_NAMES[key]}
                          </span>
                          {isLimiting && calculation && calculation.batches > 0 && (
                              <span className="text-brand-gold flex items-center gap-1 font-black italic scale-90">
                                  <Crown className="w-3 h-3 gold-glow" />
                                  GARGALO
                              </span>
                          )}
                        </label>
                        <div className="relative">
                          <input 
                              type="text" 
                              inputMode="numeric"
                              value={quantities[key]}
                              onFocus={() => setActiveInput(key)}
                              onBlur={() => setActiveInput('none')}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              placeholder="0"
                              className={`w-full bg-[#161b22]/60 backdrop-blur-sm border p-7 rounded-3xl text-3xl font-mono text-white outline-none transition-all placeholder:text-slate-800/50 ${
                                  activeInput === key 
                                  ? 'border-brand-purple ring-8 ring-brand-purple/5 shadow-2xl scale-[1.02]' 
                                  : isMissing
                                  ? 'border-brand-purple/20'
                                  : 'border-slate-800 focus:border-brand-purple/50'
                              }`}
                          />
                          {hasValue && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-30 capitalize text-[8px] font-black text-slate-500 pointer-events-none tracking-[0.2em] flex flex-col items-end">
                                <span>UNIDADES</span>
                                <span className="text-[7px] text-brand-purple mt-0.5">{manuallyEdited.has(key) ? 'COORDENADO' : 'AUTO-CALC'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 p-5 bg-white/[0.02] border border-dashed border-slate-800 rounded-3xl opacity-50">
                    <Info className="w-5 h-5 text-slate-600 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
                        Sistema recalcula automaticamente baseado no insumo limitante ou no preset selecionado.
                    </p>
                </div>
              </section>

              {/* Results */}
              <section className="h-full">
                <AnimatePresence mode="wait">
                  {calculation ? (
                    <motion.div 
                        key="results"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex-1 glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-between text-center relative overflow-hidden group"
                    >
                      {/* Brand Pattern overlay */}
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#7c3aed_2px,transparent_2px)] [background-size:24px_24px]"></div>

                      <div className="w-full flex justify-between items-center mb-6 relative z-10">
                        <div className="flex items-center gap-2 text-[9px] uppercase font-black text-slate-500 tracking-[0.3em]">
                           <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_12px_#7c3aed]"></span> 
                           Processamento Ativo
                        </div>
                        <div className="px-3 py-1 bg-brand-purple/10 border border-brand-purple/20 rounded-full text-[9px] font-mono text-brand-purple font-black">
                           ID-EXEC: {Math.random().toString(16).slice(2, 8).toUpperCase()}
                        </div>
                      </div>

                      <div className="relative z-10 py-4 w-full group/main">
                        <h3 className="text-slate-600 uppercase text-[9px] font-black tracking-[0.6em] mb-4 group-hover/main:text-brand-purple/60 transition-colors">Produção Teórica</h3>
                        <div className="text-9xl font-black text-white font-mono tracking-tighter leading-none mb-3 tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.05)] text-metallic">
                            {calculation.totalProduced.toLocaleString()}
                        </div>
                        <div className="text-brand-purple font-black text-xs uppercase tracking-[0.4em] italic mb-10 flex items-center justify-center gap-3 opacity-80">
                            <Box className="w-4 h-4" />
                            Unidades Purificadas
                        </div>
                        
                        {/* Tax Breakdown Disclaimer */}
                        <div className="bg-[#0f1115]/90 backdrop-blur-xl border border-slate-700/40 rounded-[2rem] p-8 text-left mb-8 space-y-6 relative shadow-inner group/card hover:border-brand-purple/40 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-brand-gold gold-glow">
                                    <Crown className="w-6 h-6" />
                                    <span className="text-[12px] font-black uppercase tracking-[0.3em]">Cota D'LA Norte</span>
                                </div>
                                <span className="bg-brand-purple/20 text-brand-purple px-3 py-1 rounded-full text-[9px] font-black tracking-widest">50% TAX</span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center opacity-30 group-hover/card:opacity-50 transition-opacity">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bruto</span>
                                    <span className="text-sm font-mono font-bold text-white">{calculation.totalProduced}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 border-b border-white/5 pb-5 italic">
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Taxa Operacional</span>
                                    <span className="text-sm font-mono font-bold">-{calculation.totalProduced * 0.5}</span>
                                </div>
                                <div className="pt-2 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-black uppercase tracking-widest text-brand-purple leading-tight">Crédito Membro</span>
                                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tight">Saldo Líquido</span>
                                    </div>
                                    <span className="text-5xl font-black text-white font-mono tracking-tighter text-metallic drop-shadow-2xl">
                                        {(calculation.totalProduced * 0.5).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="inline-flex items-center px-6 py-3 bg-brand-purple/5 border border-brand-purple/20 rounded-2xl text-brand-purple/60 font-black text-[10px] uppercase tracking-[0.3em] backdrop-blur-sm group-hover:bg-brand-purple/10 transition-all">
                            <Package className="w-4 h-4 mr-3 opacity-50" />
                            {calculation.batches} Lotes de {BATCH_SIZE}u
                        </div>
                      </div>
                      
                      <div className="w-full pt-12 border-t border-slate-800/60 relative z-10 text-left overflow-hidden">
                        <div className="absolute top-0 right-0 py-10 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Crown className="w-20 h-20 text-brand-silver rotate-12" />
                        </div>

                        <h4 className="text-[9px] font-black text-slate-600 uppercase mb-6 tracking-[0.5em] flex items-center justify-between">
                            Metricas Operacionais
                            <span className="font-mono text-brand-purple/30">V.3.1.2</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">
                            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => (
                                <div key={key} className="space-y-2 group/metric">
                                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500 group-hover/metric:text-white transition-colors">
                                        <span>{ITEM_NAMES[key]}</span>
                                        <span className="text-brand-purple font-mono font-bold">U: {calculation.needed[key]}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline gap-2">
                                        <span className={`text-[11px] font-mono font-bold ${calculation.surplus[key] > 0 ? 'text-brand-gold' : 'text-slate-800'}`}>
                                            +{calculation.surplus[key]} <span className="text-[9px] opacity-40">EXC</span>
                                        </span>
                                        {calculation.missing[key] > 0 && (
                                            <span className="text-[9px] font-black text-white bg-brand-purple px-2 py-0.5 rounded-lg italic tracking-tighter">-{calculation.missing[key]}</span>
                                        )}
                                    </div>
                                    <div className="w-full bg-slate-900/50 h-0.5 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all duration-700 ${calculation.limitingFactors.includes(key) ? 'bg-brand-purple shadow-[0_0_5px_#7c3aed]' : 'bg-slate-800'}`}
                                          style={{ width: `${Math.min(100, (parseInt(quantities[key]) || 0) / calculation.needed[key] * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6 pt-8 border-t border-slate-800/40">
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] block">Próxima Meta (+100u)</span>
                                <p className="text-[10px] text-slate-400 leading-tight font-bold uppercase italic">
                                  Requer: <span className="text-brand-gold">{ITEM_NAMES[calculation.mainBottleneck]}</span>
                                </p>
                            </div>
                            <div className="px-5 py-3 bg-brand-gold/5 rounded-2xl border border-brand-gold/20 flex flex-col items-center group/next hover:bg-brand-gold/10 transition-colors">
                                <span className="text-xs font-mono font-black text-brand-gold gold-glow">+{calculation.nextBatchMissing[calculation.mainBottleneck]}u</span>
                                <span className="text-[7px] text-brand-gold/50 font-black uppercase tracking-tighter">Faltante</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 glass-card rounded-[2.5rem] border-2 border-dashed border-slate-800/40 p-12 flex flex-col items-center justify-center text-center group"
                    >
                        <div className="w-24 h-24 bg-slate-800/20 rounded-[2rem] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700 border border-white/[0.02]">
                            <Package className="w-10 h-10 text-slate-700 opacity-40 group-hover:text-brand-purple transition-colors" />
                        </div>
                        <h4 className="text-white text-lg font-black mb-3 uppercase tracking-[0.4em] italic text-metallic opacity-80">Standby</h4>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest max-w-[240px] leading-relaxed mx-auto opacity-60 group-hover:opacity-100 transition-opacity">
                            Aguardando inteligência de insumos para viabilizar processamento.
                        </p>
                        
                        <div className="mt-10 flex gap-2">
                           {[1, 2, 3].map(i => (
                             <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-800 group-hover:bg-brand-purple/20 transition-colors" style={{ transitionDelay: `${i*100}ms` }}></div>
                           ))}
                        </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Footer Bar */}
      <footer className="bg-[#0f1115] border-t border-slate-800 px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] shrink-0">
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-purple shadow-[0_0_5px_#7c3aed]"></span> 
                © D'LA NORTE 2026
            </span>
            <span className="hidden sm:inline border-l border-slate-800 pl-4 italic opacity-50 font-script normal-case tracking-normal lowercase text-[11px] text-slate-500 pt-1">
              Dos escombros construímos história
            </span>
        </div>
        <div className="flex gap-6 opacity-30 select-none">
          <span>SISTEMA DE GESTÃO DE LABORATÓRIO CRÍTICOS</span>
        </div>
      </footer>
    </div>
  );
}

