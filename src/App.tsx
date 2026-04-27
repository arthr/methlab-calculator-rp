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
      <nav className="border-b border-slate-800 bg-[#161b22]/80 backdrop-blur-md px-8 py-4 flex justify-between items-center shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-purple rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-white/10">
            <Crown className="h-6 w-6 text-brand-gold drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-2xl text-white italic leading-none">D'LA <span className="text-brand-purple font-black">NORTE</span></span>
            <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.3em] ml-0.5">Laboratório de Processamento</span>
          </div>
        </div>
        <div className="hidden lg:block">
            <span className="text-white/40 font-script text-sm italic">Dos escombros construímos história</span>
        </div>
        <button 
          onClick={clearAll}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-brand-purple flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Resetar</span>
        </button>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Recipe Info */}
        <aside className="w-full md:w-80 bg-[#161b22]/50 backdrop-blur-sm border-b md:border-b-0 md:border-r border-slate-800/50 p-8 flex flex-col shrink-0 overflow-y-auto">
          <h2 className="text-xs font-black text-slate-500 uppercase mb-6 tracking-[0.2em] flex items-center gap-2">
            <Calculator className="w-3 h-3 text-brand-purple" />
            Protocolo de Insumos
          </h2>
          <div className="space-y-4 mb-8">
            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
              const Icon = ITEM_ICONS[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 bg-[#0f1115] border border-slate-700/30 rounded-2xl transition-all hover:border-brand-purple/50 group">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-500 group-hover:text-brand-purple transition-colors" />
                    <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{ITEM_NAMES[key]}</span>
                  </div>
                  <span className="font-mono text-brand-purple font-black text-sm tracking-widest">{REQUIREMENTS[key]}u</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-auto p-5 bg-purple-600/5 border border-brand-purple/20 rounded-3xl text-[11px] leading-relaxed relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown className="w-8 h-8 text-brand-gold" />
            </div>
            <p className="text-brand-purple font-black mb-2 uppercase tracking-widest text-[9px]">Aviso do Comando:</p>
            <span className="text-slate-400 italic font-medium">A produção ocorre estritamente em lotes de 100 unidades. Qualquer resíduo deve ser mantido em estoque para o próximo ciclo.</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-[#0f1115] relative">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              
              {/* Inputs */}
              <section className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tight mb-2 uppercase">Laboratório de Produção</h1>
                    <p className="text-slate-500 text-sm font-medium">Informe a coleta ou use os atalhos de carregamento.</p>
                  </div>
                  
                  {/* Farm Presets */}
                  <div className="flex items-center gap-2 bg-[#161b22] p-1.5 rounded-xl border border-slate-800 shadow-inner">
                    <button 
                      onClick={() => adjustBatches(-1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold transition-all active:scale-95"
                    >
                      -
                    </button>
                    <div className="px-3 text-center min-w-[60px]">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Ciclos</p>
                      <p className="text-sm font-mono font-black text-brand-purple drop-shadow-[0_0_8px_rgba(124,58,237,0.3)]">{calculation?.batches || 0}</p>
                    </div>
                    <button 
                      onClick={() => adjustBatches(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {[1, 5, 10, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => applyBatchesPreset(n)}
                      className="px-4 py-2 bg-[#161b22] border border-slate-700/50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-brand-purple hover:text-brand-purple transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Crown className="w-3 h-3" />
                      {n} {n === 1 ? 'Farm' : 'Farms'}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
                    const isMissing = calculation && calculation.missing[key] > 0;
                    const hasValue = quantities[key] !== '';
                    const isLimiting = calculation?.limitingFactors.includes(key);

                    return (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] flex justify-between items-center px-1">
                          <span className="flex items-center gap-1">
                            {ITEM_NAMES[key]}
                            {isMissing && <span className="text-[9px] text-brand-purple font-black ml-1 bg-brand-purple/10 px-1 rounded">REQUERIDO</span>}
                          </span>
                          {isLimiting && calculation && calculation.batches > 0 && (
                              <span className="text-brand-gold animate-pulse flex items-center gap-1 font-black italic">
                                  <Crown className="w-3 h-3" />
                                  LIMITANTE
                              </span>
                          )}
                        </label>
                        <div className={`relative transition-all duration-300 ${activeInput === key ? 'scale-[1.02]' : ''}`}>
                          <input 
                              type="text" 
                              inputMode="numeric"
                              value={quantities[key]}
                              onFocus={() => setActiveInput(key)}
                              onBlur={() => setActiveInput('none')}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              placeholder="0"
                              className={`w-full bg-[#161b22]/80 backdrop-blur-sm border p-6 rounded-2xl text-2xl font-mono text-white outline-none transition-all placeholder:text-slate-800 ${
                                  activeInput === key 
                                  ? 'border-brand-purple ring-4 ring-brand-purple/10 shadow-[0_0_15px_rgba(124,58,237,0.1)]' 
                                  : isMissing
                                  ? 'border-brand-purple/30'
                                  : 'border-slate-800 focus:border-brand-purple'
                              }`}
                          />
                          {hasValue && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 capitalize text-[9px] font-black text-slate-500 pointer-events-none tracking-widest">
                                {manuallyEdited.has(key) ? 'COORDENADO' : 'AUTO-AJUSTE'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-[#161b22]/50 border border-slate-800 rounded-3xl p-6 text-center italic text-slate-500 text-xs">
                    Certifique-se de que os materiais estão divididos corretamente antes de processar no laboratório.
                </div>
              </section>

              {/* Results */}
              <section className="flex flex-col h-full min-h-[500px]">
                <AnimatePresence mode="wait">
                  {calculation ? (
                    <motion.div 
                        key="results"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 bg-[#161b22] rounded-3xl border border-slate-800 p-10 flex flex-col items-center justify-between text-center relative overflow-hidden group"
                    >
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(#7c3aed_1px,transparent_1px)] [background-size:32px_32px]"></div>

                      <div className="w-full flex justify-between items-center mb-4 relative z-10">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 tracking-widest">
                           <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_10px_#7c3aed]"></span> 
                           Status: Processado
                        </div>
                        <div className="text-[10px] font-mono text-brand-purple/60 font-black">LOG: {Math.random().toString(16).slice(2, 8).toUpperCase()}</div>
                      </div>

                      <div className="relative z-10 py-6 w-full">
                        <h3 className="text-slate-500 uppercase text-[10px] font-black tracking-[0.5em] mb-4">Resultado Operacional</h3>
                        <div className="text-8xl font-black text-white font-mono tracking-tighter leading-none mb-2 tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            {calculation.totalProduced.toLocaleString()}
                        </div>
                        <div className="text-brand-purple font-black text-base uppercase tracking-[0.3em] italic mb-8 flex items-center justify-center gap-2">
                            <Box className="w-5 h-5" />
                            Unidades Puras
                        </div>
                        
                        {/* Tax Breakdown Disclaimer */}
                        <div className="bg-[#0f1115]/80 backdrop-blur-sm border border-slate-800 rounded-3xl p-6 text-left mb-6 space-y-4 relative shadow-2xl">
                            <div className="flex items-center gap-2 text-brand-gold mb-3">
                                <Crown className="w-5 h-5 drop-shadow-[0_0_5px_#f59e0b]" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Cota da Organização (50%)</span>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between items-center opacity-40">
                                    <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">Total Produzido</span>
                                    <span className="text-xs font-mono font-bold text-white">{calculation.totalProduced}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 border-b border-slate-800/50 pb-3 italic">
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Taxa Operacional</span>
                                    <span className="text-xs font-mono font-bold">-{calculation.totalProduced * 0.5}</span>
                                </div>
                                <div className="pt-2 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-brand-purple">Saldo do Membro</span>
                                        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">Líquido a receber</span>
                                    </div>
                                    <span className="text-4xl font-black text-white font-mono drop-shadow-[0_0_15px_rgba(124,58,237,0.4)] tracking-tighter">
                                        {(calculation.totalProduced * 0.5).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 inline-flex items-center px-5 py-2.5 bg-brand-purple/10 border border-brand-purple/30 rounded-2xl text-brand-purple font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-purple-500/5">
                            <Package className="w-4 h-4 mr-2" />
                            {calculation.batches} Ciclos de Extração
                        </div>
                      </div>
                      
                      <div className="w-full pt-10 border-t border-slate-800/50 relative z-10 text-left">
                        <h4 className="text-[10px] font-black text-slate-600 uppercase mb-5 tracking-[0.3em] flex items-center justify-between">
                            Metricas de Eficiência
                            <span className="font-mono text-brand-purple/40">D'LA NORTE v3.0</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 mb-8">
                            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => (
                                <div key={key} className="space-y-1.5 group">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors">
                                        <span>{ITEM_NAMES[key]}</span>
                                        <span className="text-brand-purple/80 italic">U: {calculation.needed[key]}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className={`text-xs font-mono font-bold ${calculation.surplus[key] > 0 ? 'text-brand-gold' : 'text-slate-800'}`}>
                                            +{calculation.surplus[key]} EXC
                                        </span>
                                        {calculation.missing[key] > 0 && (
                                            <span className="text-[9px] font-black text-brand-purple uppercase bg-brand-purple/10 px-1.5 py-0.5 rounded italic">-{calculation.missing[key]}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-5 pt-6 border-t border-slate-800/50">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Próxima Meta (100u):</span>
                            <span className="text-xs font-mono font-black text-brand-gold bg-brand-gold/5 px-3 py-1.5 rounded-xl border border-brand-gold/20">
                                +{calculation.nextBatchMissing[calculation.mainBottleneck]} {ITEM_NAMES[calculation.mainBottleneck]}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                             <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (parseInt(quantities[calculation.mainBottleneck]) % REQUIREMENTS[calculation.mainBottleneck]) / REQUIREMENTS[calculation.mainBottleneck] * 100)}%` }}
                                    className="bg-brand-purple h-full rounded-full shadow-[0_0_15px_rgba(124,58,237,0.8)]"
                                ></motion.div>
                              </div>
                              <p className="text-[10px] text-slate-600 leading-relaxed font-bold uppercase tracking-tight">
                                GARGALO ATUAL: <span className="text-brand-purple">{ITEM_NAMES[calculation.mainBottleneck]}</span>
                              </p>
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
                        className="flex-1 bg-[#161b22]/30 rounded-3xl border-2 border-dashed border-slate-800 p-10 flex flex-col items-center justify-center text-center group"
                    >
                        <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Box className="w-10 h-10 text-slate-700" />
                        </div>
                        <h4 className="text-white font-bold mb-2 uppercase tracking-widest">Aguardando Insumos</h4>
                        <p className="text-slate-500 text-xs max-w-[200px] leading-relaxed mx-auto">
                            O sistema está em standby. Insira os dados de coleta para processar a viabilidade da remessa.
                        </p>
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

