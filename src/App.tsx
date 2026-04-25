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
  AlertCircle
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

  const [activeInput, setActiveInput] = useState<ItemKey | 'none'>('none');

  const handleInputChange = (key: ItemKey, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setQuantities(prev => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setQuantities({
      aluminum: '',
      paper: '',
      plastic: '',
      ephedrine: '',
    });
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
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-sans flex flex-col selection:bg-emerald-500/30">
      {/* Header Navigation */}
      <nav className="border-b border-slate-800 bg-[#161b22] px-8 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
            <FlaskConical className="h-5 w-5 text-black" />
          </div>
          <span className="font-bold tracking-tight text-xl text-white">FARM<span className="text-emerald-400 font-black italic">PRO</span> <span className="text-slate-500 text-xs font-normal ml-2 uppercase tracking-widest hidden sm:inline">Calculadora de Produção</span></span>
        </div>
        <button 
          onClick={clearAll}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-emerald-400 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Resetar Campos</span>
        </button>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Recipe Info */}
        <aside className="w-full md:w-80 bg-[#161b22] border-b md:border-b-0 md:border-r border-slate-800 p-8 flex flex-col shrink-0 overflow-y-auto">
          <h2 className="text-xs font-bold text-slate-500 uppercase mb-6 tracking-widest flex items-center gap-2">
            <Calculator className="w-3 h-3 text-emerald-400" />
            Receita Base (100un)
          </h2>
          <div className="space-y-4 mb-8">
            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
              const Icon = ITEM_ICONS[key];
              return (
                <div key={key} className="flex items-center justify-between p-4 bg-[#0f1115] border border-slate-700/50 rounded-xl transition-all hover:border-slate-500 group">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{ITEM_NAMES[key]}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-black text-sm tracking-widest">{REQUIREMENTS[key]}x</span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-auto p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-[11px] leading-relaxed relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Info className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-emerald-400 font-bold mb-2 uppercase tracking-widest">Dica do Produtor:</p>
            <span className="text-slate-400 italic">A produção ocorre apenas em lotes fechados de 100 unidades. Materiais excedentes que não completam um lote permanecem seguros no seu armazenamento.</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-[#0f1115] relative">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              
              {/* Inputs */}
              <section className="space-y-8">
                <div>
                  <h1 className="text-3xl font-black text-white italic tracking-tight mb-2 uppercase">Laboratório de Produção</h1>
                  <p className="text-slate-500 text-sm font-medium">Informe a quantidade exata de insumo para verificação imediata de rendimento.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
                    const isMissing = calculation && calculation.missing[key] > 0;
                    const hasValue = quantities[key] !== '';
                    const isLimiting = calculation?.limitingFactors.includes(key);

                    return (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.1em] flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            {ITEM_NAMES[key]}
                            {isMissing && <span className="text-[9px] text-emerald-400 font-black ml-1">FALTANDO</span>}
                          </span>
                          {isLimiting && calculation && calculation.batches > 0 && (
                              <span className="text-red-400 animate-pulse flex items-center gap-1 font-black italic">
                                  <AlertCircle className="w-3 h-3" />
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
                              placeholder={calculation && calculation.needed[key] > 0 ? `Necessário: ${calculation.needed[key]}` : "0"}
                              className={`w-full bg-[#161b22] border p-6 rounded-2xl text-2xl font-mono text-white outline-none transition-all placeholder:text-slate-700 ${
                                  activeInput === key 
                                  ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                  : isMissing
                                  ? 'border-emerald-500/30'
                                  : 'border-slate-700/50 focus:border-emerald-500'
                              }`}
                          />
                          {calculation && calculation.needed[key] > 0 && !hasValue && (
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleInputChange(key, calculation.needed[key].toString());
                                  }}
                                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20 rounded text-[9px] font-black text-emerald-400 uppercase tracking-tighter transition-colors pointer-events-auto"
                                >
                                  Auto-Fill
                                </button>
                             </div>
                          )}
                          {hasValue && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 capitalize text-[10px] font-bold text-slate-400 pointer-events-none">
                                possuído
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
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px]"></div>

                      <div className="w-full flex justify-between items-center mb-4 relative z-10">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span> 
                           Status: Calculado
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400/50">HASH: {Math.random().toString(16).slice(2, 8).toUpperCase()}</div>
                      </div>

                      <div className="relative z-10 py-10">
                        <h3 className="text-slate-400 uppercase text-[10px] font-black tracking-[0.4em] mb-4">Produção Final Estimada</h3>
                        <div className="text-9xl font-black text-white font-mono tracking-tighter leading-none mb-2 tabular-nums">
                            {calculation.totalProduced.toLocaleString()}
                        </div>
                        <div className="text-emerald-400 font-black text-2xl uppercase tracking-[0.2em] italic">UNIDADES PURAS</div>
                        <div className="mt-4 inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 font-bold text-xs uppercase tracking-widest">
                            <Package className="w-4 h-4 mr-2" />
                            {calculation.batches} Lotes de 100
                        </div>
                      </div>
                      
                      <div className="w-full pt-10 border-t border-slate-800/50 relative z-10 text-left">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-5 tracking-[0.3em] flex items-center justify-between">
                            Análise de Insumos e Excedentes
                            <span className="font-mono text-slate-600">v1.2</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                            {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                        <span>{ITEM_NAMES[key]}</span>
                                        <span className="text-emerald-400 italic">Usado: {calculation.needed[key]}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className={`text-xs font-mono font-bold ${calculation.surplus[key] > 0 ? 'text-orange-400' : 'text-slate-700'}`}>
                                            Sobra: +{calculation.surplus[key]}
                                        </span>
                                        {calculation.missing[key] > 0 && (
                                            <span className="text-[9px] font-black text-red-500 uppercase italic">Falta: {calculation.missing[key]}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-5 pt-4 border-t border-slate-800/30">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs text-slate-400 font-semibold">Meta para +100 unidades:</span>
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-400/5 px-3 py-1.5 rounded-lg border border-emerald-400/10">
                                +{calculation.nextBatchMissing[calculation.mainBottleneck]} {ITEM_NAMES[calculation.mainBottleneck]}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                             <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (parseInt(quantities[calculation.mainBottleneck]) % REQUIREMENTS[calculation.mainBottleneck]) / REQUIREMENTS[calculation.mainBottleneck] * 100)}%` }}
                                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_15px_#10b981]"
                                ></motion.div>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                Principal impedimento detectado: <span className="text-red-400 font-black uppercase tracking-widest">{ITEM_NAMES[calculation.mainBottleneck]}</span>
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
      <footer className="bg-[#0f1115] border-t border-slate-800 px-8 py-4 flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span> 
                FARM PRO LABORATÓRIO
            </span>
        </div>
        <div className="flex gap-6 opacity-50">
          <span>SISTEMA DE GESTÃO DE INSUMOS</span>
        </div>
      </footer>
    </div>
  );
}

