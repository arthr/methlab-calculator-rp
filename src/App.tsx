/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
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
  Crown,
  Scale,
  TrendingUp,
  ShieldCheck,
  Zap,
  Settings2,
  X,
  Plus,
  Trash2,
  Calendar,
  Users,
  History,
  Clock,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Constantes de Produção (para 100 unidades)
const BATCH_SIZE = 100;
const REQUIREMENTS = {
  aluminum: 20,
  paper: 50,
  plastic: 20,
  ephedrine: 40,
};

const ITEM_NAMES = {
  aluminum: "Pó de Alumínio",
  paper: "Folha de Papel",
  plastic: "Embalagem Plástica",
  ephedrine: "Efedrina",
  product: "Metanfetamina",
};

const DEFAULT_WEIGHTS = {
  aluminum: 0.15,
  paper: 0.3,
  plastic: 0.15,
  ephedrine: 0.15,
  product: 0.15,
};

const ITEM_ICONS = {
  aluminum: FlaskConical,
  paper: FileText,
  plastic: Box,
  ephedrine: Droplet,
};

type ItemKey = keyof typeof REQUIREMENTS;

interface Order {
  id: string;
  orgName: string;
  buyerName: string;
  quantity: number;
  totalValue: number;
  totalWeight: number;
  recipients: string[];
  requestDate: string;
  deliveryDate: string;
  createdAt: string;
  status: "Pendente" | "Entregue" | "Cancelado";
  notes: { id: string; text: string; date: string }[];
  reminderMinutes: number | null;
  reminderTriggered?: boolean;
}

export default function App() {
  const [quantities, setQuantities] = useState<Record<ItemKey, string>>({
    aluminum: "",
    paper: "",
    plastic: "",
    ephedrine: "",
  });
  const [manuallyEdited, setManuallyEdited] = useState<Set<ItemKey>>(new Set());
  const [lastEditedKey, setLastEditedKey] = useState<ItemKey | null>(null);

  const [activeInput, setActiveInput] = useState<ItemKey | "none">("none");
  const [weights, setWeights] =
    useState<Record<ItemKey | "product", number>>(DEFAULT_WEIGHTS);

  // Sales Calculator State
  const [showSales, setShowSales] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOrderAgenda, setShowOrderAgenda] = useState(false);
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem("dla_norte_orders");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.map((o: any) => ({ ...o, notes: o.notes || [] }));
  });
  const [saleUnits, setSaleUnits] = useState<string>("");
  const [salePrice, setSalePrice] = useState(150);
  const [isVapo, setIsVapo] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; message: string; orderId: string }[]
  >([]);

  // Check for upcoming reminders
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      let updated = false;
      const nextOrders = orders.map((order) => {
        if (
          order.status === "Pendente" &&
          order.deliveryDate &&
          order.reminderMinutes &&
          !order.reminderTriggered
        ) {
          const deliveryTime = new Date(order.deliveryDate).getTime();
          const reminderTime = deliveryTime - order.reminderMinutes * 60 * 1000;

          if (now >= reminderTime && now < deliveryTime) {
            setNotifications((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(7),
                message: `Lembrete: Entrega de "${order.orgName}" em ${order.reminderMinutes} minutos!`,
                orderId: order.id,
              },
            ]);
            updated = true;
            return { ...order, reminderTriggered: true };
          }
        }
        return order;
      });

      if (updated) {
        setOrders(nextOrders);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(timer);
  }, [orders]);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Sales Config
  const [salesConfig, setSalesConfig] = useState({
    orgMin: 130,
    orgMax: 150,
    vapoMin: 150,
    vapoMax: 200,
    vapoLimit: 500,
  });

  const totalPrice = (parseInt(saleUnits) || 0) * salePrice;
  const totalWeight = (parseInt(saleUnits) || 0) * weights.product;
  const isVapoOverLimit =
    isVapo && (parseInt(saleUnits) || 0) > salesConfig.vapoLimit;

  useEffect(() => {
    localStorage.setItem("dla_norte_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    // Sync price when switching types
    if (isVapo) {
      if (salePrice < salesConfig.vapoMin) setSalePrice(salesConfig.vapoMin);
    } else {
      if (salePrice > salesConfig.orgMax) setSalePrice(salesConfig.orgMax);
    }
  }, [isVapo]);

  const adjustPrice = (delta: number) => {
    const min = isVapo ? salesConfig.vapoMin : salesConfig.orgMin;
    const max = isVapo ? salesConfig.vapoMax : salesConfig.orgMax;
    setSalePrice((prev) => Math.min(max, Math.max(min, prev + delta)));
  };

  const applyBatchesPreset = (num: number) => {
    const nextQuantities = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, k) => {
        acc[k] = (num * REQUIREMENTS[k]).toString();
        return acc;
      },
      {} as Record<ItemKey, string>,
    );

    setQuantities(nextQuantities);
    setManuallyEdited(new Set());
  };

  const adjustBatches = (delta: number) => {
    const currentBatches = calculation?.batches || 0;
    const next = Math.max(0, currentBatches + delta);
    applyBatchesPreset(next);
  };

  const handleInputChange = (key: ItemKey, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return;

    setQuantities((prev) => {
      const nextManuallyEdited = new Set(manuallyEdited);
      if (value === "") {
        nextManuallyEdited.delete(key);
      } else {
        nextManuallyEdited.add(key);
      }

      const nextQuantities = { ...prev, [key]: value };

      // Determine target batches from all manual inputs
      const manualKeys = (Object.keys(REQUIREMENTS) as ItemKey[]).filter(
        (k) =>
          nextManuallyEdited.has(k) &&
          nextQuantities[k] !== "" &&
          parseInt(nextQuantities[k]) >= 0,
      );

      let targetBatches = 0;
      if (manualKeys.length > 0) {
        // If multiple manual inputs, target is driven by the bottleneck to show surplus
        // If only one, target is driven by that one to show requirements
        if (manualKeys.length === 1) {
          const k = manualKeys[0];
          targetBatches = Math.floor(
            parseInt(nextQuantities[k]) / REQUIREMENTS[k],
          );
        } else {
          targetBatches = manualKeys.reduce((min, k) => {
            const b = Math.floor(parseInt(nextQuantities[k]) / REQUIREMENTS[k]);
            return b < min ? b : min;
          }, Infinity);
        }
      }

      // Update non-manual ones to match target batches
      (Object.keys(REQUIREMENTS) as ItemKey[]).forEach((k) => {
        if (!nextManuallyEdited.has(k)) {
          nextQuantities[k] =
            manualKeys.length > 0 && targetBatches >= 0
              ? (targetBatches * REQUIREMENTS[k]).toString()
              : "";
        }
      });

      setManuallyEdited(nextManuallyEdited);
      return nextQuantities;
    });
  };

  const clearAll = () => {
    setQuantities({
      aluminum: "",
      paper: "",
      plastic: "",
      ephedrine: "",
    });
    setManuallyEdited(new Set());
    setLastEditedKey(null);
    setActiveInput("none");
  };

  const calculation = useMemo(() => {
    const activeKeys = (Object.keys(quantities) as ItemKey[]).filter(
      (k) => quantities[k] !== "" && parseInt(quantities[k]) > 0,
    );

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
      activeKeys.forEach((key) => {
        const val = parseInt(quantities[key]);
        const possibleBatches = Math.floor(val / REQUIREMENTS[key]);
        if (possibleBatches < batches) {
          batches = possibleBatches;
        }
      });
    }

    if (batches === Infinity) batches = 0;

    const totalProduced = batches * BATCH_SIZE;

    const needed = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, key) => {
        acc[key] = batches * REQUIREMENTS[key];
        return acc;
      },
      {} as Record<ItemKey, number>,
    );

    const surplus = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, key) => {
        const current = parseInt(quantities[key]) || 0;
        acc[key] = Math.max(0, current - needed[key]);
        return acc;
      },
      {} as Record<ItemKey, number>,
    );

    const missing = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, key) => {
        const current = parseInt(quantities[key]) || 0;
        acc[key] = Math.max(0, needed[key] - current);
        return acc;
      },
      {} as Record<ItemKey, number>,
    );

    const limitingFactors = (Object.keys(REQUIREMENTS) as ItemKey[]).filter(
      (key) => {
        const val = parseInt(quantities[key]) || 0;
        return Math.floor(val / REQUIREMENTS[key]) === batches;
      },
    );

    const nextBatchMissing = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, key) => {
        const current = parseInt(quantities[key]) || 0;
        const target = (batches + 1) * REQUIREMENTS[key];
        acc[key] = Math.max(0, target - current);
        return acc;
      },
      {} as Record<ItemKey, number>,
    );

    const mainBottleneck = limitingFactors[0];

    const totalInputWeight = (Object.keys(REQUIREMENTS) as ItemKey[]).reduce(
      (acc, key) => {
        return acc + (parseInt(quantities[key]) || 0) * weights[key];
      },
      0,
    );

    const totalOutputWeight = totalProduced * weights.product;
    const memberOutputWeight = totalOutputWeight * 0.5;

    return {
      batches,
      totalProduced,
      needed,
      surplus,
      missing,
      limitingFactors,
      nextBatchMissing,
      mainBottleneck,
      isTargetMode,
      totalInputWeight,
      totalOutputWeight,
      memberOutputWeight,
    };
  }, [quantities, weights]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200 font-sans flex flex-col selection:bg-brand-purple/30 bg-camo">
      {/* Header Navigation */}
      <nav className="border-b border-slate-800/60 bg-[#161b22]/90 backdrop-blur-xl px-4 py-2 flex justify-between items-center shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-linear-to-br from-brand-purple to-brand-purple-dark rounded-lg flex items-center justify-center shadow-2xl shadow-purple-900/40 border border-white/10 group active:scale-95 transition-transform shrink-0">
            <Crown className="h-5 w-5 text-brand-gold gold-glow group-hover:rotate-12 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-xl italic leading-none text-metallic pr-2">
              D'LA NORTE
            </span>
            <span className="text-slate-500 text-[7px] font-black uppercase tracking-[0.4em] ml-0.5 mt-0.5">
              SISTEMA OPERACIONAL
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-white/30 font-script text-xs italic -mb-1">
              Dos escombros construímos história
            </span>
            <span className="text-[6px] font-black text-brand-purple/40 uppercase tracking-[0.5em]">
              Laboratório de Processamento
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfigModal(true)}
            className="lg:hidden p-2 bg-brand-purple/10 border border-brand-purple/20 rounded-lg text-brand-purple active:scale-95 transition-all"
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-brand-purple/10 border border-slate-800 hover:border-brand-purple/30 rounded-lg transition-all text-slate-400 hover:text-brand-purple active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
              Limpar
            </span>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar: Recipe Info - Hidden on Mobile */}
        <aside className="hidden lg:flex w-full md:w-64 glass-card p-4 flex-col shrink-0 overflow-y-auto border-r border-slate-800/20">
          {/* Mode Navigation */}
          <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800 mb-4">
            <button
              onClick={() => setShowSales(false)}
              className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${!showSales ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
            >
              <FlaskConical className="w-3 h-3" />
              Membros
            </button>
            <button
              onClick={() => setShowSales(true)}
              className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${showSales ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
            >
              <ShieldCheck className="w-3 h-3" />
              Gerência
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!showSales ? (
              <motion.div
                key="prod-sidebar"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-brand-purple shadow-[0_0_8px_#7c3aed]"></div>
                    Calculadora de Produção
                  </h2>
                  <div className="space-y-1.5">
                    {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
                      const Icon = ITEM_ICONS[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 bg-[#0f1115]/50 border border-slate-800/40 rounded-xl group hover:border-brand-purple/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-purple transition-colors" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors uppercase tracking-tight">
                              {ITEM_NAMES[key]}
                            </span>
                          </div>
                          <span className="font-mono text-brand-purple/60 font-black text-[10px] tracking-widest group-hover:text-brand-purple">
                            {REQUIREMENTS[key]}u
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/40">
                  <h3 className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-[0.3em] flex items-center gap-2">
                    <Scale className="w-2.5 h-2.5 text-brand-purple" />
                    Peso (kg)
                  </h3>
                  <div className="space-y-3">
                    {(Object.keys(weights) as (ItemKey | "product")[]).map(
                      (key) => (
                        <div key={key} className="flex flex-col gap-1">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tight">
                              {ITEM_NAMES[key]}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-brand-purple/80">
                              {weights[key].toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.01"
                            max="1.0"
                            step="0.01"
                            value={weights[key]}
                            onChange={(e) =>
                              setWeights((prev) => ({
                                ...prev,
                                [key]: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-brand-purple h-0.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sales-sidebar"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="pt-2">
                  <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800 mb-6">
                    <button
                      onClick={() => setShowOrderAgenda(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!showOrderAgenda ? "bg-brand-purple text-white" : "text-slate-500 hover:text-slate-400"}`}
                    >
                      Calculadora
                    </button>
                    <button
                      onClick={() => setShowOrderAgenda(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${showOrderAgenda ? "bg-brand-purple text-white" : "text-slate-500 hover:text-slate-400"}`}
                    >
                      Agenda
                    </button>
                  </div>

                  <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
                    <Settings2 className="w-3 h-3 text-brand-purple" />
                    Ajustes de Mercado
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center group">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                          Preço Org (Min/Max)
                        </span>
                        <div className="flex gap-1 text-[10px] font-mono font-bold text-slate-400">
                          <span>{salesConfig.orgMin}</span>/
                          <span>{salesConfig.orgMax}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={salesConfig.orgMin}
                          onChange={(e) =>
                            setSalesConfig((p) => ({
                              ...p,
                              orgMin: parseInt(e.target.value),
                            }))
                          }
                          className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-white outline-none focus:border-brand-purple/50 w-full"
                        />
                        <input
                          type="number"
                          value={salesConfig.orgMax}
                          onChange={(e) =>
                            setSalesConfig((p) => ({
                              ...p,
                              orgMax: parseInt(e.target.value),
                            }))
                          }
                          className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-white outline-none focus:border-brand-purple/50 w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center group">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                          Preço VAPO (Min/Max)
                        </span>
                        <div className="flex gap-1 text-[10px] font-mono font-bold text-slate-400">
                          <span>{salesConfig.vapoMin}</span>/
                          <span>{salesConfig.vapoMax}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={salesConfig.vapoMin}
                          onChange={(e) =>
                            setSalesConfig((p) => ({
                              ...p,
                              vapoMin: parseInt(e.target.value),
                            }))
                          }
                          className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-white outline-none focus:border-brand-purple/50 w-full"
                        />
                        <input
                          type="number"
                          value={salesConfig.vapoMax}
                          onChange={(e) =>
                            setSalesConfig((p) => ({
                              ...p,
                              vapoMax: parseInt(e.target.value),
                            }))
                          }
                          className="bg-slate-900 border border-slate-800 rounded p-1 text-[10px] text-white outline-none focus:border-brand-purple/50 w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                          Limite Unidades VAPO
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {salesConfig.vapoLimit}u
                        </span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="2000"
                        step="50"
                        value={salesConfig.vapoLimit}
                        onChange={(e) =>
                          setSalesConfig((prev) => ({
                            ...prev,
                            vapoLimit: parseInt(e.target.value),
                          }))
                        }
                        className="w-full accent-brand-purple h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-brand-purple/5 border border-brand-purple/10 rounded-2xl">
                  <p className="text-[9px] font-black text-brand-purple uppercase tracking-widest mb-2">
                    Relatório de Gestão
                  </p>
                  <p className="text-[10px] text-slate-500 italic">
                    Preços são ajustados dinamicamente com base nas diretrizes
                    do comando.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 p-3 bg-brand-purple/5 border border-brand-purple/20 rounded-2xl relative overflow-hidden group">
            <div className="absolute -top-3 -right-3 opacity-5 group-hover:opacity-10 group-hover:-rotate-12 transition-all duration-500">
              <Crown className="w-16 h-16 text-brand-gold" />
            </div>
            <p className="text-brand-purple font-black mb-2 uppercase tracking-widest text-[8px] flex items-center gap-1.5">
              <Info className="w-2.5 h-2.5" />
              Aviso do Comando
            </p>
            <span className="text-slate-400 italic text-[10px] leading-tight font-medium block">
              Lotes de 100u. Descarte excessos.
            </span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 lg:p-4 overflow-y-auto relative">
          <div className="max-w-5xl mx-auto h-full space-y-3">
            <AnimatePresence mode="wait">
              {showSales ? (
                showOrderAgenda ? (
                  <OrderAgendaView
                    orders={orders}
                    setOrders={setOrders}
                    salesConfig={salesConfig}
                    weights={weights}
                  />
                ) : (
                  <motion.div
                    key="sales"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 xl:grid-cols-[1fr,400px] gap-6"
                  >
                    {/* Sales Inputs */}
                    <section className="space-y-6">
                      <div className="space-y-1 border-b border-slate-800/60 pb-4">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase text-metallic pr-2">
                          Calculadora da Gerência
                        </h2>
                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                          Faturamento Membro
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {/* Sale Type Toggle */}
                        <div className="space-y-1">
                          <label className="text-[8px] uppercase font-black text-slate-500 tracking-[0.2em] px-1">
                            Modalidade de Venda
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setIsVapo(false)}
                              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 ${!isVapo ? "bg-brand-purple/10 border-brand-purple shadow-2xl" : "bg-[#161b22]/40 border-slate-800 opacity-50"}`}
                            >
                              <TrendingUp
                                className={`w-4 h-4 ${!isVapo ? "text-brand-purple" : "text-slate-600"}`}
                              />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                Organização
                              </span>
                            </button>
                            <button
                              onClick={() => setIsVapo(true)}
                              className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 ${isVapo ? "bg-brand-purple/10 border-brand-purple shadow-2xl" : "bg-[#161b22]/40 border-slate-800 opacity-50"}`}
                            >
                              <Zap
                                className={`w-4 h-4 ${isVapo ? "text-brand-purple" : "text-slate-600"}`}
                              />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                VAPO
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Units Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] px-1 flex justify-between">
                            Quantidade de Venda
                            {isVapoOverLimit && (
                              <span className="text-brand-gold animate-pulse italic text-[8px]">
                                LIMITE VAPO EXCEDIDO!
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={saleUnits}
                            onChange={(e) =>
                              setSaleUnits(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="0"
                            className={`w-full bg-[#161b22]/60 backdrop-blur-sm border p-4 rounded-3xl text-2xl font-mono text-white outline-none transition-all placeholder:text-slate-800/50 ${isVapoOverLimit ? "border-brand-gold ring-8 ring-brand-gold/5" : "border-slate-800 focus:border-brand-purple"}`}
                          />
                        </div>

                        {/* Price Control */}
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] px-1">
                            Ajuste de Preço
                          </label>
                          <div className="bg-[#161b22]/40 p-2 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <button
                              onClick={() => adjustPrice(-5)}
                              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                            >
                              -5
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-mono font-black text-white px-6">
                                ${salePrice}
                              </span>
                              <p className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">
                                por unidade
                              </p>
                            </div>
                            <button
                              onClick={() => adjustPrice(5)}
                              className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Results Display */}
                    <section>
                      <div className="glass-card rounded-[2.5rem] p-6 flex flex-col items-center justify-between text-center relative overflow-hidden group min-h-[400px]">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#7c3aed_2px,transparent_2px)] bg-size-[24px_24px]"></div>

                        <div className="w-full flex justify-between items-center mb-4 relative z-10">
                          <div className="flex items-center gap-2 text-[9px] uppercase font-black text-slate-500 tracking-[0.3em]">
                            <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse"></span>
                            Financeiro
                          </div>
                          <div className="px-3 py-1 bg-brand-purple/10 border border-brand-purple/20 rounded-full text-[9px] font-mono text-brand-purple font-black">
                            TYPE: {isVapo ? "VAPO" : "ORG"}
                          </div>
                        </div>

                        <div className="relative z-10 py-6 w-full group/main">
                          <h3 className="text-slate-600 uppercase text-[9px] font-black tracking-[0.6em] mb-4">
                            Total do Carregamento
                          </h3>
                          <div className="text-6xl font-black text-white font-mono tracking-tighter leading-none mb-3 tabular-nums text-metallic">
                            ${totalPrice.toLocaleString()}
                          </div>
                          <div className="text-brand-purple font-black text-[10px] uppercase tracking-[0.4em] italic mb-8 flex items-center justify-center gap-3 pr-2">
                            Pagamento Imediato
                          </div>

                          <div className="bg-[#0f1115]/90 backdrop-blur-xl border border-slate-700/40 rounded-4xl p-6 text-left space-y-4 shadow-inner">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center opacity-30">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  Peso Estimado
                                </span>
                                <span className="text-sm font-mono font-bold text-brand-silver">
                                  {(parseInt(saleUnits) || 0) * weights.product}
                                  kg
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-slate-500 border-b border-white/5 pb-3 italic pr-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest">
                                  Preço Un.
                                </span>
                                <span className="text-sm font-mono font-bold text-brand-purple">
                                  ${salePrice}
                                </span>
                              </div>
                              <div className="pt-1 flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black uppercase tracking-widest text-brand-gold leading-tight">
                                    Valor Final
                                  </span>
                                  <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tight">
                                    Cobrança única
                                  </span>
                                </div>
                                <span className="text-4xl font-black text-white font-mono tracking-tighter text-metallic drop-shadow-2xl">
                                  ${totalPrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto flex items-center gap-3 text-[9px] font-black text-slate-600 uppercase tracking-widest opacity-40">
                          <ShieldCheck className="w-4 h-4" />
                          Controle Gerencial D'LA NORTE
                        </div>
                      </div>
                    </section>
                  </motion.div>
                )
              ) : (
                <motion.div
                  key="production"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 xl:grid-cols-[1fr,380px] gap-6"
                >
                  {/* Inputs */}
                  <section className="space-y-6">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                      <div className="space-y-0.5">
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase text-metallic pr-2">
                          Calculadora de Produção
                        </h1>
                        <div className="flex items-center gap-2">
                          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                            Membros
                          </p>
                          {calculation && (
                            <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-brand-purple/5 border border-brand-purple/10 rounded-lg">
                              <Scale className="w-2 h-2 text-brand-purple/50" />
                              <span className="text-[8px] font-mono font-bold text-brand-purple/80 uppercase">
                                {calculation.totalInputWeight.toFixed(1)}kg
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-[#161b22] px-1.5 py-0.5 rounded-lg border border-slate-800">
                          <button
                            onClick={() => adjustBatches(-1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-purple/10 text-brand-purple/60 hover:text-brand-purple transition-all active:scale-90"
                          >
                            -
                          </button>
                          <div className="px-2 text-center min-w-[50px]">
                            <p className="text-[6px] font-black text-slate-600 uppercase tracking-tighter leading-none mb-0.5">
                              Ciclos
                            </p>
                            <p className="text-xs font-mono font-black text-brand-purple leading-none">
                              {calculation?.batches || 0}
                            </p>
                          </div>
                          <button
                            onClick={() => adjustBatches(1)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-brand-purple/10 text-brand-purple/60 hover:text-brand-purple transition-all active:scale-90"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {[1, 5, 10].map((n) => (
                            <button
                              key={n}
                              onClick={() => applyBatchesPreset(n)}
                              className="px-2 py-1.5 bg-[#161b22] border border-slate-800 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest hover:border-brand-purple hover:text-brand-purple transition-all active:scale-95"
                            >
                              {n}F
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-3">
                      {(Object.keys(REQUIREMENTS) as ItemKey[]).map((key) => {
                        const isMissing =
                          calculation && calculation.missing[key] > 0;
                        const hasValue = quantities[key] !== "";
                        const isLimiting =
                          calculation?.limitingFactors.includes(key);

                        return (
                          <div key={key} className="group">
                            <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] flex justify-between items-center px-1 mb-1.5">
                              <span className="flex items-center gap-1">
                                <span
                                  className={`w-1 h-1 rounded-full ${hasValue ? "bg-brand-purple shadow-[0_0_5px_#7c3aed]" : "bg-slate-800"}`}
                                ></span>
                                {ITEM_NAMES[key]}
                              </span>
                              {isLimiting &&
                                calculation &&
                                calculation.batches > 0 && (
                                  <span className="text-brand-gold flex items-center gap-1 font-black italic scale-[0.75]">
                                    <Crown className="w-2.5 h-2.5 gold-glow" />
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
                                onBlur={() => setActiveInput("none")}
                                onChange={(e) =>
                                  handleInputChange(key, e.target.value)
                                }
                                placeholder="0"
                                className={`w-full bg-[#161b22]/60 backdrop-blur-sm border px-4 py-3.5 rounded-2xl text-2xl font-mono text-white outline-none transition-all placeholder:text-slate-800/50 ${
                                  activeInput === key
                                    ? "border-brand-purple ring-4 ring-brand-purple/5 shadow-2xl scale-[1.01]"
                                    : isMissing
                                      ? "border-brand-purple/20"
                                      : "border-slate-800 focus:border-brand-purple/50"
                                }`}
                              />
                              {hasValue && (
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-30 capitalize text-[8px] font-black text-slate-500 pointer-events-none tracking-[0.2em] flex flex-col items-end">
                                  <span>UNIDADES</span>
                                  <span className="text-[7px] text-brand-purple mt-0.5">
                                    {manuallyEdited.has(key)
                                      ? "COORDENADO"
                                      : "AUTO-CALC"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 p-5 bg-white/2 border border-dashed border-slate-800 rounded-3xl opacity-50">
                      <Info className="w-5 h-5 text-slate-600 shrink-0" />
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">
                        Sistema recalcula automaticamente baseado no insumo
                        limitante ou no preset selecionado.
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
                          className="flex-1 glass-card rounded-[2.5rem] p-6 flex flex-col items-center justify-between text-center relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#7c3aed_2px,transparent_2px)] bg-size-[24px_24px]"></div>

                          <div className="w-full flex justify-between items-center mb-4 relative z-10">
                            <div className="flex items-center gap-2 text-[9px] uppercase font-black text-slate-500 tracking-[0.3em]">
                              <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_12px_#7c3aed]"></span>
                              Processamento Ativo
                            </div>
                            <div className="px-3 py-1 bg-brand-purple/10 border border-brand-purple/20 rounded-full text-[9px] font-mono text-brand-purple font-black">
                              ID-EXEC:{" "}
                              {Math.random()
                                .toString(16)
                                .slice(2, 8)
                                .toUpperCase()}
                            </div>
                          </div>

                          <div className="relative z-10 py-2 w-full group/main">
                            <h3 className="text-slate-600 uppercase text-[9px] font-black tracking-[0.6em] mb-2 group-hover/main:text-brand-purple/60 transition-colors">
                              Produção Teórica
                            </h3>
                            <div className="text-6xl font-black text-white font-mono tracking-tighter leading-none mb-2 tabular-nums drop-shadow-[0_0_30px_rgba(255,255,255,0.05)] text-metallic">
                              {calculation.totalProduced.toLocaleString()}
                            </div>
                            <div className="text-brand-purple font-black text-[10px] uppercase tracking-[0.4em] italic mb-6 flex items-center justify-center gap-3 opacity-80 pr-2">
                              <Box className="w-4 h-4" />
                              Unidades Purificadas
                            </div>

                            <div className="bg-[#0f1115]/90 backdrop-blur-xl border border-slate-700/40 rounded-4xl p-6 text-left mb-4 space-y-4 relative shadow-inner group/card hover:border-brand-purple/40 transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-brand-gold gold-glow">
                                  <Crown className="w-5 h-5" />
                                  <span className="text-[11px] font-black uppercase tracking-[0.3em]">
                                    Cota D'LA Norte
                                  </span>
                                </div>
                                <span className="bg-brand-purple/20 text-brand-purple px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest">
                                  50% TAX
                                </span>
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center opacity-30 group-hover/card:opacity-50 transition-opacity">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Bruto
                                  </span>
                                  <span className="text-sm font-mono font-bold text-white">
                                    {calculation.totalProduced}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-500 border-b border-white/5 pb-3 italic pr-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest">
                                    Taxa Operacional
                                  </span>
                                  <span className="text-sm font-mono font-bold">
                                    -{calculation.totalProduced * 0.5}
                                  </span>
                                </div>
                                <div className="pt-1 flex justify-between items-center">
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-brand-purple leading-tight">
                                      Crédito Membro
                                    </span>
                                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tight">
                                      Saldo Líquido
                                    </span>
                                  </div>
                                  <span className="text-4xl font-black text-white font-mono tracking-tighter text-metallic drop-shadow-2xl">
                                    {(
                                      calculation.totalProduced * 0.5
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="inline-flex items-center px-4 py-2 bg-brand-purple/5 border border-brand-purple/20 rounded-2xl text-brand-purple/60 font-black text-[9px] uppercase tracking-[0.3em] backdrop-blur-sm group-hover:bg-brand-purple/10 transition-all">
                              <Package className="w-3.5 h-3.5 mr-2 opacity-50" />
                              {calculation.batches} Lotes de {BATCH_SIZE}u
                            </div>
                          </div>

                          <div className="w-full pt-6 border-t border-slate-800/60 relative z-10 text-left overflow-hidden">
                            <div className="absolute top-0 right-0 py-6 opacity-5 group-hover:opacity-10 transition-opacity">
                              <Crown className="w-16 h-16 text-brand-silver rotate-12" />
                            </div>

                            <h4 className="text-[9px] font-black text-slate-600 uppercase mb-4 tracking-[0.5em] flex items-center justify-between">
                              Metricas Operacionais
                              <span className="font-mono text-brand-purple/30 text-[8px]">
                                V.3.1.2
                              </span>
                            </h4>

                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
                              {(Object.keys(REQUIREMENTS) as ItemKey[]).map(
                                (key) => (
                                  <div
                                    key={key}
                                    className="space-y-2 group/metric"
                                  >
                                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500 group-hover/metric:text-white transition-colors">
                                      <span>{ITEM_NAMES[key]}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-600 font-mono">
                                          {(
                                            (parseInt(quantities[key]) || 0) *
                                            weights[key]
                                          ).toFixed(1)}
                                          kg
                                        </span>
                                        <span className="text-brand-purple font-mono font-bold">
                                          U: {calculation.needed[key]}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-baseline gap-2">
                                      <span
                                        className={`text-[11px] font-mono font-bold ${calculation.surplus[key] > 0 ? "text-brand-gold" : "text-slate-800"}`}
                                      >
                                        +{calculation.surplus[key]}{" "}
                                        <span className="text-[9px] opacity-40">
                                          EXC
                                        </span>
                                      </span>
                                      {calculation.missing[key] > 0 && (
                                        <span className="text-[9px] font-black text-white bg-brand-purple px-2 py-0.5 rounded-lg italic tracking-tighter">
                                          -{calculation.missing[key]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="w-full bg-slate-900/50 h-0.5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-700 ${calculation.limitingFactors.includes(key) ? "bg-brand-purple shadow-[0_0_5px_#7c3aed]" : "bg-slate-800"}`}
                                        style={{
                                          width: `${Math.min(100, ((parseInt(quantities[key]) || 0) / calculation.needed[key]) * 100)}%`,
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>

                            <div className="space-y-4 pt-5 border-t border-slate-800/40">
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] block">
                                    Próxima Meta (+100u)
                                  </span>
                                  <p className="text-[10px] text-slate-400 leading-tight font-bold uppercase italic pr-2">
                                    Requer:{" "}
                                    <span className="text-brand-gold">
                                      {ITEM_NAMES[calculation.mainBottleneck]}
                                    </span>
                                  </p>
                                </div>
                                <div className="px-5 py-3 bg-brand-gold/5 rounded-2xl border border-brand-gold/20 flex flex-col items-center group/next hover:bg-brand-gold/10 transition-colors">
                                  <span className="text-xs font-mono font-black text-brand-gold gold-glow">
                                    +
                                    {
                                      calculation.nextBatchMissing[
                                        calculation.mainBottleneck
                                      ]
                                    }
                                    u
                                  </span>
                                  <span className="text-[7px] text-brand-gold/50 font-black uppercase tracking-tighter">
                                    Faltante
                                  </span>
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
                          className="flex-1 glass-card rounded-[2.5rem] border-2 border-dashed border-slate-800/40 p-10 flex flex-col items-center justify-center text-center group"
                        >
                          <div className="w-20 h-20 bg-slate-800/20 rounded-[2.5rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-700 border border-white/2">
                            <Package className="w-10 h-10 text-slate-700 opacity-40 group-hover:text-brand-purple transition-colors" />
                          </div>
                          <h4 className="text-white text-lg font-black mb-3 uppercase tracking-[0.4em] italic text-metallic opacity-80 pr-2">
                            Standby
                          </h4>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest max-w-[240px] leading-relaxed mx-auto opacity-60 group-hover:opacity-100 transition-opacity">
                            Aguardando inteligência de insumos para viabilizar
                            processamento.
                          </p>

                          <div className="mt-10 flex gap-2">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-slate-800 group-hover:bg-brand-purple/20 transition-colors"
                                style={{ transitionDelay: `${i * 100}ms` }}
                              ></div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0f1115] border-t sm:border border-slate-800 rounded-t-4xl sm:rounded-4xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center border border-brand-purple/20">
                    <Settings2 className="w-5 h-5 text-brand-purple" />
                  </div>
                  <h2 className="text-xl font-black text-white italic tracking-tight uppercase pr-2">
                    Configurações
                  </h2>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content Clone */}
              <div className="space-y-6">
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setShowSales(false)}
                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${!showSales ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    Membros
                  </button>
                  <button
                    onClick={() => setShowSales(true)}
                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${showSales ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Gerência
                  </button>
                </div>

                {showSales && (
                  <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setShowOrderAgenda(false)}
                      className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${!showOrderAgenda ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
                    >
                      Calculadora
                    </button>
                    <button
                      onClick={() => setShowOrderAgenda(true)}
                      className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${showOrderAgenda ? "bg-brand-purple text-white shadow-lg" : "text-slate-500 hover:text-slate-400"}`}
                    >
                      Agenda
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {!showSales ? (
                    <motion.div
                      key="prod-modal"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div className="space-y-3">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                          Insumos por Lote (100u)
                        </h2>
                        <div className="grid grid-cols-1 gap-2">
                          {(Object.keys(REQUIREMENTS) as ItemKey[]).map(
                            (key) => {
                              const Icon = ITEM_ICONS[key];
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800/40 rounded-xl"
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon className="w-4 h-4 text-slate-600" />
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                                      {ITEM_NAMES[key]}
                                    </span>
                                  </div>
                                  <span className="font-mono text-brand-purple font-black text-xs">
                                    {REQUIREMENTS[key]}u
                                  </span>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>

                      <div className="pt-5 border-t border-slate-800/40">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
                          <Scale className="w-3 h-3 text-brand-purple" />
                          Calibração de Peso
                        </h3>
                        <div className="space-y-4">
                          {(
                            Object.keys(weights) as (ItemKey | "product")[]
                          ).map((key) => (
                            <div key={key} className="flex flex-col gap-2">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
                                  {ITEM_NAMES[key]}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-brand-purple">
                                  {weights[key].toFixed(2)}kg
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.01"
                                max="1.0"
                                step="0.01"
                                value={weights[key]}
                                onChange={(e) =>
                                  setWeights((prev) => ({
                                    ...prev,
                                    [key]: parseFloat(e.target.value),
                                  }))
                                }
                                className="w-full accent-brand-purple h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sales-modal"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="pt-2">
                        <h3 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-[0.3em] flex items-center gap-2">
                          <Settings2 className="w-3 h-3 text-brand-purple" />
                          Ajustes de Mercado
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter block">
                              Preço Org (Min/Max)
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={salesConfig.orgMin}
                                onChange={(e) =>
                                  setSalesConfig((p) => ({
                                    ...p,
                                    orgMin: parseInt(e.target.value),
                                  }))
                                }
                                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white outline-none focus:border-brand-purple"
                              />
                              <input
                                type="number"
                                value={salesConfig.orgMax}
                                onChange={(e) =>
                                  setSalesConfig((p) => ({
                                    ...p,
                                    orgMax: parseInt(e.target.value),
                                  }))
                                }
                                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white outline-none focus:border-brand-purple"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter block">
                              Preço VAPO (Min/Max)
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={salesConfig.vapoMin}
                                onChange={(e) =>
                                  setSalesConfig((p) => ({
                                    ...p,
                                    vapoMin: parseInt(e.target.value),
                                  }))
                                }
                                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white outline-none focus:border-brand-purple"
                              />
                              <input
                                type="number"
                                value={salesConfig.vapoMax}
                                onChange={(e) =>
                                  setSalesConfig((p) => ({
                                    ...p,
                                    vapoMax: parseInt(e.target.value),
                                  }))
                                }
                                className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm text-white outline-none focus:border-brand-purple"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                Limite Unidades VAPO
                              </span>
                              <span className="text-sm font-mono font-bold text-brand-purple">
                                {salesConfig.vapoLimit}u
                              </span>
                            </div>
                            <input
                              type="range"
                              min="100"
                              max="2000"
                              step="50"
                              value={salesConfig.vapoLimit}
                              onChange={(e) =>
                                setSalesConfig((prev) => ({
                                  ...prev,
                                  vapoLimit: parseInt(e.target.value),
                                }))
                              }
                              className="w-full accent-brand-purple h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => setShowConfigModal(false)}
                  className="w-full py-4 bg-brand-purple rounded-xl text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-900/20 active:scale-95 transition-all mt-4"
                >
                  Confirmar Ajustes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Bar */}
      <footer className="bg-[#0f1115] border-t border-slate-800 px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-purple shadow-[0_0_5px_#7c3aed]"></span>
            © D'LA NORTE 2026
          </span>
          <span className="hidden sm:inline border-l border-slate-800 pl-4 italic opacity-50 font-script tracking-normal lowercase text-[11px] text-slate-500 pt-1">
            Dos escombros construímos história
          </span>
        </div>
        <div className="flex gap-6 opacity-30 select-none">
          <span>SISTEMA DE GESTÃO DE LABORATÓRIO CRÍTICOS</span>
        </div>
      </footer>

      {/* Internal Notifications */}
      <div className="fixed bottom-24 right-6 z-200 space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="pointer-events-auto bg-[#0f1115] border border-brand-gold/50 rounded-2xl p-4 shadow-2xl flex items-start gap-4 max-w-sm relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-brand-gold"></div>
              <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center border border-brand-gold/20 shrink-0">
                <AlertCircle className="w-5 h-5 text-brand-gold animate-pulse" />
              </div>
              <div className="flex-1 pr-6">
                <p className="text-[10px] font-black text-brand-gold uppercase tracking-widest mb-1">
                  Alerta de Entrega
                </p>
                <p className="text-sm text-white font-medium leading-snug">
                  {notif.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notif.id)}
                className="absolute top-3 right-3 p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface OrderAgendaViewProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  salesConfig: {
    orgMin: number;
    orgMax: number;
    vapoMin: number;
    vapoMax: number;
    vapoLimit: number;
  };
  weights: Record<string, number>;
}

const getBrazilISO = () => {
  const date = new Date();
  const offset = -3; // UTC-3 (Brasília)
  const brazilDate = new Date(
    date.getTime() + offset * 3600000 + date.getTimezoneOffset() * 60000,
  );
  return brazilDate.toISOString();
};

const formatBR = (dateStr: string | undefined) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function OrderAgendaView({
  orders,
  setOrders,
  salesConfig,
  weights,
}: OrderAgendaViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [showDeliveryWarning, setShowDeliveryWarning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeNotesOrder, setActiveNotesOrder] = useState<Order | null>(null);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const getInitialOrderState = (): Partial<Order> => {
    // Para datetime-local no formato YYYY-MM-DDTHH:mm no timezone de Brasília
    const now = new Date();
    const brNow = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    );
    const pad = (n: number) => n.toString().padStart(2, "0");
    const localStr = `${brNow.getFullYear()}-${pad(brNow.getMonth() + 1)}-${pad(brNow.getDate())}T${pad(brNow.getHours())}:${pad(brNow.getMinutes())}`;

    return {
      orgName: "",
      buyerName: "",
      quantity: 0,
      recipients: [],
      requestDate: localStr,
      deliveryDate: "",
      status: "Pendente",
      notes: [],
      reminderMinutes: null,
    };
  };

  const [newOrder, setNewOrder] = useState<Partial<Order>>(
    getInitialOrderState(),
  );
  const [recipientInput, setRecipientInput] = useState("");

  const orderValue = useMemo(() => {
    const qty = newOrder.quantity || 0;
    return qty * salesConfig.orgMax;
  }, [newOrder.quantity, salesConfig.orgMax]);

  const orderWeight = useMemo(() => {
    return (newOrder.quantity || 0) * weights.product;
  }, [newOrder.quantity, weights.product]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!newOrder.orgName?.trim()) newErrors.orgName = "Obrigatório";
    if (!newOrder.buyerName?.trim()) newErrors.buyerName = "Obrigatório";
    if (!newOrder.quantity || newOrder.quantity <= 0) {
      newErrors.quantity = "Mínimo 100";
    } else if (newOrder.quantity % 100 !== 0) {
      newErrors.quantity = "Deve ser múltiplo de 100";
    }
    if (!newOrder.recipients || newOrder.recipients.length === 0) {
      newErrors.recipients = "Mínimo 1 destinatário";
    }
    if (!newOrder.requestDate) newErrors.requestDate = "Obrigatório";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddOrder = () => {
    if (!validate()) return;

    if (!newOrder.deliveryDate && !showDeliveryWarning) {
      setShowDeliveryWarning(true);
      return;
    }

    const toISO = (localDT: string) => {
      if (!localDT) return "";
      if (localDT.includes("Z") || /[-+]\d{2}:\d{2}$/.test(localDT))
        return localDT;
      return new Date(localDT + ":00-03:00").toISOString();
    };

    const requestDateISO = toISO(newOrder.requestDate!);
    const deliveryDateISO = newOrder.deliveryDate
      ? toISO(newOrder.deliveryDate)
      : "";

    if (editingOrderId) {
      const updatedOrders = orders.map((o) => {
        if (o.id === editingOrderId) {
          return {
            ...o,
            orgName: newOrder.orgName!,
            buyerName: newOrder.buyerName!,
            quantity: newOrder.quantity!,
            totalValue: orderValue,
            totalWeight: orderWeight,
            recipients: newOrder.recipients || [],
            requestDate: requestDateISO,
            deliveryDate: deliveryDateISO,
            reminderMinutes: newOrder.reminderMinutes || null,
          };
        }
        return o;
      });
      setOrders(updatedOrders);
    } else {
      const order: Order = {
        id: Math.random().toString(36).substring(2, 9).toUpperCase(),
        orgName: newOrder.orgName!,
        buyerName: newOrder.buyerName!,
        quantity: newOrder.quantity!,
        totalValue: orderValue,
        totalWeight: orderWeight,
        recipients: newOrder.recipients || [],
        requestDate: requestDateISO,
        deliveryDate: deliveryDateISO,
        reminderMinutes: newOrder.reminderMinutes || null,
        createdAt: new Date().toISOString(),
        status: "Pendente",
        notes: [],
      };
      setOrders([order, ...orders]);
    }

    closeModal();
  };

  const handleEditClick = (order: Order) => {
    // Converter de ISO/UTC para o formato datetime-local do input (considerando BR time)
    const toLocaleDT = (iso: string) => {
      if (!iso) return "";
      const d = new Date(iso);
      const brD = new Date(
        d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
      );
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${brD.getFullYear()}-${pad(brD.getMonth() + 1)}-${pad(brD.getDate())}T${pad(brD.getHours())}:${pad(brD.getMinutes())}`;
    };

    setNewOrder({
      ...order,
      requestDate: toLocaleDT(order.requestDate),
      deliveryDate: order.deliveryDate ? toLocaleDT(order.deliveryDate) : "",
    });
    setEditingOrderId(order.id);
    setShowAddForm(true);
  };

  const closeModal = () => {
    setShowAddForm(false);
    setEditingOrderId(null);
    setShowDeliveryWarning(false);
    setErrors({});
    setNewOrder(getInitialOrderState());
  };

  const deleteOrder = (id: string) => {
    setOrderToDeleteId(id);
  };

  const confirmDelete = () => {
    if (orderToDeleteId) {
      setOrders(orders.filter((o) => o.id !== orderToDeleteId));
      setOrderToDeleteId(null);
    }
  };

  const updateStatus = (id: string, status: Order["status"]) => {
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const addNote = (orderId: string) => {
    if (!noteText.trim()) return;
    const note = {
      id: Math.random().toString(36).substring(2, 9),
      text: noteText.trim(),
      date: new Date().toISOString(),
    };
    setOrders(
      orders.map((o) =>
        o.id === orderId ? { ...o, notes: [note, ...o.notes] } : o,
      ),
    );
    setNoteText("");
  };

  const deleteNote = (orderId: string, noteId: string) => {
    setOrders(
      orders.map((o) =>
        o.id === orderId
          ? { ...o, notes: o.notes.filter((n) => n.id !== noteId) }
          : o,
      ),
    );
  };

  const addRecipient = () => {
    if (
      recipientInput.trim() &&
      !newOrder.recipients?.includes(recipientInput.trim())
    ) {
      setNewOrder((prev) => ({
        ...prev,
        recipients: [...(prev.recipients || []), recipientInput.trim()],
      }));
      setRecipientInput("");
    }
  };

  const removeRecipient = (tag: string) => {
    setNewOrder((prev) => ({
      ...prev,
      recipients: prev.recipients?.filter((r) => r !== tag),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center border-b border-slate-800/60 pb-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase text-metallic pr-2">
            Agenda de Pedidos
          </h2>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
            Gestão de Demandas Externas
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {orders.length === 0 ? (
          <div className="lg:col-span-2 py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/40 rounded-[2.5rem] text-slate-600">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-[0.2em]">
              Nenhum pedido registrado
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="glass-card rounded-3xl p-5 border border-slate-800/40 hover:border-brand-purple/30 transition-all group relative overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-black text-brand-purple/60 uppercase tracking-[0.3em]">
                      #{order.id}
                    </span>
                    <div
                      className={`px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-widest ${
                        order.status === "Entregue"
                          ? "bg-green-500/10 text-green-500 border border-green-500/20"
                          : order.status === "Cancelado"
                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                            : "bg-brand-gold/10 text-brand-gold border border-brand-gold/20 shadow-[0_0_8px_rgba(234,179,8,0.1)]"
                      }`}
                    >
                      {order.status}
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-white italic tracking-tight uppercase leading-none truncate max-w-[180px]">
                    {order.orgName}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[180px]">
                    {order.buyerName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-mono font-black text-brand-purple leading-none drop-shadow-2xl text-metallic">
                    ${order.totalValue.toLocaleString()}
                  </div>
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                    Total Líquido
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-white/2 rounded-2xl border border-white/5 group-hover:border-brand-purple/10 transition-colors">
                  <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Volume
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-xl font-mono font-black text-white leading-none">
                      {order.quantity}
                    </span>
                    <span className="text-[8px] font-black text-slate-600 uppercase pb-0.5">
                      UNS
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-white/2 rounded-2xl border border-white/5 group-hover:border-brand-purple/10 transition-colors">
                  <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Logística
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-xl font-mono font-black text-brand-silver leading-none">
                      {order.totalWeight.toFixed(1)}
                    </span>
                    <span className="text-[8px] font-black text-slate-600 uppercase pb-0.5">
                      KGS
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4 bg-black/20 p-3 rounded-2xl border border-white/2">
                <div className="flex items-center gap-3 text-[8px] text-slate-400 uppercase font-bold tracking-widest">
                  <Calendar className="w-2.5 h-2.5 text-brand-purple/60" />
                  <span>
                    Solicitado:{" "}
                    <span className="text-slate-200">
                      {formatBR(order.requestDate)}
                    </span>
                  </span>
                </div>
                {order.deliveryDate ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 text-[8px] text-slate-400 uppercase font-bold tracking-widest">
                      <Clock className="w-2.5 h-2.5 text-brand-gold/60" />
                      <span>
                        Entrega:{" "}
                        <span className="text-brand-gold">
                          {formatBR(order.deliveryDate)}
                        </span>
                      </span>
                    </div>
                    {order.reminderMinutes && order.status === "Pendente" && (
                      <div className="flex items-center gap-3 text-[7px] text-brand-purple uppercase font-black tracking-widest pl-5">
                        <AlertCircle className="w-2 h-2" />
                        <span>Lembrete: {order.reminderMinutes}m antes</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-[8px] text-slate-600 uppercase font-bold tracking-widest italic">
                    <Clock className="w-2.5 h-2.5 opacity-20" />
                    <span>Entrega não definida</span>
                  </div>
                )}
              </div>

              {order.recipients.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {order.recipients.map((rec, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-brand-purple/5 border border-brand-purple/10 rounded-full text-[6px] font-black text-brand-purple/60 uppercase tracking-widest"
                    >
                      {rec}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-slate-800/40 flex items-center justify-between">
                <div className="flex gap-1">
                  <div className="relative group/tooltip">
                    <button
                      onClick={() => handleEditClick(order)}
                      className="p-2 bg-slate-800/40 text-slate-600 hover:text-white hover:bg-brand-purple/40 rounded-lg transition-all"
                      title="Editar Pedido"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Editar
                    </span>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={() => updateStatus(order.id, "Pendente")}
                      className={`p-2 rounded-lg transition-all ${order.status === "Pendente" ? "bg-brand-gold text-[#0f1115]" : "bg-slate-800/40 text-slate-600 hover:text-slate-400"}`}
                      title="Marcar como Pendente"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Pendente
                    </span>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={() => updateStatus(order.id, "Entregue")}
                      className={`p-2 rounded-lg transition-all ${order.status === "Entregue" ? "bg-green-500 text-white" : "bg-slate-800/40 text-slate-600 hover:text-slate-400"}`}
                      title="Marcar como Entregue"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Entregue
                    </span>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={() => updateStatus(order.id, "Cancelado")}
                      className={`p-2 rounded-lg transition-all ${order.status === "Cancelado" ? "bg-red-500 text-white" : "bg-slate-800/40 text-slate-600 hover:text-slate-400"}`}
                      title="Marcar como Cancelado"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Cancelar
                    </span>
                  </div>

                  <div className="relative group/tooltip ml-2">
                    <button
                      onClick={() => setActiveNotesOrder(order)}
                      className={`p-2 rounded-lg transition-all relative ${order.notes.length > 0 ? "bg-brand-purple/20 text-brand-purple border border-brand-purple/20" : "bg-slate-800/40 text-slate-600 hover:text-slate-400"}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {order.notes.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-purple text-white text-[7px] font-black rounded-full flex items-center justify-center border border-[#0f1115] shadow-lg">
                          {order.notes.length}
                        </span>
                      )}
                    </button>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                      Anexar Observação
                    </span>
                  </div>
                </div>

                <div className="relative group/tooltip">
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="p-2 text-slate-700 hover:text-white hover:bg-red-500 transition-all rounded-lg"
                    title="Excluir Pedido"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 border border-slate-800 text-[6px] text-white font-black uppercase tracking-widest rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50">
                    Excluir
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {orderToDeleteId && (
          <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDeleteId(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[#0f1115] border border-red-500/20 rounded-[2.5rem] p-8 shadow-2xl text-center overflow-hidden transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 opacity-30"></div>

              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>

              <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2 italic">
                Confirmar Exclusão?
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed mb-8">
                Esta ação é irreversível. O pedido será removido permanentemente
                de todos os registros da agenda.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setOrderToDeleteId(null)}
                  className="flex-1 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/20 hover:bg-red-600 active:scale-95 transition-all text-metallic"
                >
                  Excluir Agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeNotesOrder && (
          <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveNotesOrder(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0f1115] border border-slate-800 rounded-4xl p-6 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-brand-purple to-transparent opacity-50"></div>

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center border border-brand-purple/20">
                    <MessageSquare className="w-5 h-5 text-brand-purple" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white italic tracking-tight uppercase">
                      Observações
                    </h2>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[200px]">
                      {activeNotesOrder.orgName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveNotesOrder(null)}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && addNote(activeNotesOrder.id)
                  }
                  placeholder="Escrever observação..."
                  className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all"
                />
                <button
                  onClick={() => addNote(activeNotesOrder.id)}
                  className="px-6 bg-brand-purple text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-purple-dark active:scale-95 transition-all"
                >
                  Adicionar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {(orders.find((o) => o.id === activeNotesOrder.id)?.notes || [])
                  .length === 0 ? (
                  <div className="py-10 text-center text-slate-600 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto opacity-10" />
                    <p className="text-[8px] font-black uppercase tracking-widest">
                      Nenhuma anotação vinculada
                    </p>
                  </div>
                ) : (
                  (
                    orders.find((o) => o.id === activeNotesOrder.id)?.notes ||
                    []
                  ).map((note) => (
                    <div
                      key={note.id}
                      className="p-4 bg-white/2 border border-white/5 rounded-2xl relative group/note"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                          {formatBR(note.date)}
                        </span>
                        <button
                          onClick={() =>
                            deleteNote(activeNotesOrder.id, note.id)
                          }
                          className="opacity-0 group-hover/note:opacity-100 p-1 text-slate-600 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {note.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xl bg-[#0f1115] border border-slate-800 rounded-4xl p-6 shadow-2xl overflow-hidden focus-within:border-brand-purple/50 transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-brand-purple to-transparent opacity-50"></div>

              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center border border-brand-purple/20">
                    {editingOrderId ? (
                      <Settings2 className="w-5 h-5 text-brand-purple" />
                    ) : (
                      <Plus className="w-5 h-5 text-brand-purple" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white italic tracking-tight uppercase">
                      {editingOrderId ? "Editar Pedido" : "Novo Pedido"}
                    </h2>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Gerenciamento de Agenda
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex justify-between">
                      Organização/Facção
                      {errors.orgName && (
                        <span className="text-red-500 animate-pulse">
                          {errors.orgName}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={newOrder.orgName}
                      onChange={(e) =>
                        setNewOrder((p) => ({ ...p, orgName: e.target.value }))
                      }
                      placeholder="Ex: Família Soprano"
                      className={`w-full bg-slate-900/50 border rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all ${errors.orgName ? "border-red-500/50" : "border-slate-800"}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex justify-between">
                      Nome do Comprador
                      {errors.buyerName && (
                        <span className="text-red-500 animate-pulse">
                          {errors.buyerName}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={newOrder.buyerName}
                      onChange={(e) =>
                        setNewOrder((p) => ({
                          ...p,
                          buyerName: e.target.value,
                        }))
                      }
                      placeholder="Ex: Tony Montana"
                      className={`w-full bg-slate-900/50 border rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all ${errors.buyerName ? "border-red-500/50" : "border-slate-800"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex justify-between">
                      Quantidade Solicitada
                      {errors.quantity && (
                        <span className="text-red-500 animate-pulse">
                          {errors.quantity}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="100"
                      value={newOrder.quantity || ""}
                      onChange={(e) =>
                        setNewOrder((p) => ({
                          ...p,
                          quantity: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="Ex: 500"
                      className={`w-full bg-slate-900/50 border rounded-2xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-brand-purple transition-all ${errors.quantity ? "border-red-500/50" : "border-slate-800"}`}
                    />
                    <p className="text-[7px] text-slate-600 uppercase font-bold tracking-widest pl-1 mt-1">
                      Sempre múltiplos de 100
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                        Subtotal (Auto)
                      </label>
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-mono text-brand-purple font-black">
                        ${orderValue.toLocaleString()}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                        Peso (Auto)
                      </label>
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-mono text-brand-silver font-black">
                        {orderWeight.toFixed(1)}kg
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex justify-between">
                    Destinatários autorizados
                    {errors.recipients && (
                      <span className="text-red-500 animate-pulse">
                        {errors.recipients}
                      </span>
                    )}
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                        placeholder="Adicionar nome..."
                        className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all"
                      />
                      <button
                        onClick={addRecipient}
                        className="p-3 bg-brand-purple/10 border border-brand-purple/20 rounded-2xl text-brand-purple hover:bg-brand-purple hover:text-white transition-all"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(newOrder.recipients || []).map((r) => (
                        <span
                          key={r}
                          className="flex items-center gap-2 px-3 py-1 bg-brand-purple/10 border border-brand-purple/20 rounded-full text-[8px] font-black text-brand-purple uppercase tracking-widest"
                        >
                          {r}
                          <button onClick={() => removeRecipient(r)}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex justify-between">
                      Data de Solicitação
                      {errors.requestDate && (
                        <span className="text-red-500 animate-pulse">
                          {errors.requestDate}
                        </span>
                      )}
                    </label>
                    <input
                      type="datetime-local"
                      value={newOrder.requestDate}
                      onChange={(e) =>
                        setNewOrder((p) => ({
                          ...p,
                          requestDate: e.target.value,
                        }))
                      }
                      className={`w-full bg-slate-900/50 border rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all ${errors.requestDate ? "border-red-500/50" : "border-slate-800"}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                      Data de Entrega (Opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newOrder.deliveryDate}
                      onChange={(e) => {
                        setNewOrder((p) => ({
                          ...p,
                          deliveryDate: e.target.value,
                        }));
                        setShowDeliveryWarning(false);
                      }}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-brand-purple transition-all"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {newOrder.deliveryDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">
                        Lembrete de Entrega
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[null, 10, 15, 20, 30].map((mins) => (
                          <button
                            key={mins || "none"}
                            onClick={() =>
                              setNewOrder((p) => ({
                                ...p,
                                reminderMinutes: mins,
                              }))
                            }
                            className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                              newOrder.reminderMinutes === mins
                                ? "bg-brand-purple/20 border-brand-purple text-brand-purple"
                                : "bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {mins ? `${mins} Mins Antes` : "Sem Lembrete"}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showDeliveryWarning && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-brand-gold/10 border border-brand-gold/20 rounded-2xl overflow-hidden"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                        <p className="text-[9px] text-brand-gold/80 font-bold uppercase leading-relaxed">
                          A data de entrega não foi definida. Confirmar registro
                          sem prazo de finalização?
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleAddOrder}
                  className="w-full py-4 mt-2 bg-brand-purple text-white rounded-3xl text-sm font-black uppercase tracking-[0.3em] shadow-xl shadow-purple-900/20 active:scale-[0.98] transition-all hover:bg-brand-purple-dark"
                >
                  {showDeliveryWarning
                    ? "Sim, Confirmar Registro"
                    : editingOrderId
                      ? "Salvar Alterações"
                      : "Registrar Pedido na Agenda"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
