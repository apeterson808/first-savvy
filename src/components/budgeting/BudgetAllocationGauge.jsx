import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { firstsavvy } from '@/api/firstsavvyClient';

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

// Confetti particle component
const ConfettiParticle = ({ delay, color }) => {
  const angle = Math.random() * Math.PI * 2;
  const distance = 60 + Math.random() * 80;
  const endX = Math.cos(angle) * distance;
  const endY = Math.sin(angle) * distance;
  
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ 
        backgroundColor: color,
        left: '50%',
        top: '50%',
        marginLeft: -4,
        marginTop: -4
      }}
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{ 
        x: endX, 
        y: endY, 
        scale: 0,
        opacity: 0,
        rotate: Math.random() * 720 - 360
      }}
      transition={{ 
        duration: 1.2, 
        delay: delay,
        ease: "easeOut"
      }}
    />
  );
};

const CONFETTI_COLORS = ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#9370DB', '#FF69B4'];

export default function BudgetAllocationGauge({ budgets, groups, totalIncome }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);
  const prevPercentRef = useRef(0);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => firstsavvy.entities.Category.list('name')
  });

  const getCategory = (id) => categories.find(c => c.id === id);

  const getBudgetColor = (budget) => {
    if (budget.color) return budget.color;
    const category = getCategory(budget.category_id);
    if (category?.color) return category.color;
    return '#64748b';
  };

  // Get expense budgets only
  const expenseGroups = groups.filter(g => g.type === 'expense');
  const expenseGroupIds = new Set(expenseGroups.map(g => g.id));
  const expenseBudgets = budgets.filter(b => expenseGroupIds.has(b.group_id));

  // Calculate total allocated
  const totalAllocated = expenseBudgets.reduce((sum, b) => sum + (b.limit_amount || 0), 0);
  const remaining = Math.max(0, totalIncome - totalAllocated);
  const isOverBudget = totalAllocated > totalIncome;

  // Build chart data for semi-circle gauge
  const chartData = expenseBudgets.map((budget) => ({
    name: budget.name,
    value: budget.limit_amount || 0,
    color: getBudgetColor(budget)
  }));

  // Add remaining slice (unallocated) in light gray if there's unallocated income
  if (remaining > 0) {
    chartData.push({
      name: 'Unallocated',
      value: remaining,
      color: '#e2e8f0', // Light gray for unallocated
      isUnallocated: true
    });
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const percentAllocated = totalIncome > 0 ? Math.round((totalAllocated / totalIncome) * 100) : 0;

  // Trigger celebration when hitting 100%
  useEffect(() => {
    if (percentAllocated >= 100 && prevPercentRef.current < 100 && !hasShownCelebration) {
      setShowCelebration(true);
      setHasShownCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    }
    if (percentAllocated < 100) {
      setHasShownCelebration(false);
    }
    prevPercentRef.current = percentAllocated;
  }, [percentAllocated, hasShownCelebration]);

  // Get active item info
  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;
  
  const isFullyAllocated = percentAllocated >= 100;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Income Allocation</p>
      </CardHeader>
      <CardContent className="pt-0">
        {totalIncome === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            Add income budget items first
          </div>
        ) : chartData.length === 0 || (chartData.length === 1 && chartData[0].isUnallocated) ? (
          <div className="flex flex-col items-center justify-center h-48">
            <div className="relative w-48 h-24 overflow-hidden">
              <svg viewBox="0 0 100 50" className="w-full h-full">
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                <span className="text-lg font-bold text-slate-800">0%</span>
                <span className="text-[10px] text-slate-500">Allocated</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-4">{formatCurrency(totalIncome)} to budget</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="h-[130px] relative" onMouseLeave={() => setActiveIndex(null)}>
              {/* Gold background glow - appears at 100% */}
              <AnimatePresence>
                {isFullyAllocated && (
                  <motion.div
                    className="absolute inset-0 flex items-end justify-center pointer-events-none"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <motion.div
                      className="rounded-t-full"
                      style={{
                        width: 180,
                        height: 90,
                        background: 'rgba(255, 193, 7, 0.3)',
                      }}
                      animate={showCelebration ? {
                        scale: [1, 1.08, 1],
                        opacity: [0.3, 0.6, 0.4],
                      } : { scale: 1, opacity: 0.4 }}
                      transition={showCelebration ? {
                        duration: 0.6,
                        repeat: 3,
                        ease: "easeInOut"
                      } : { duration: 0.3 }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="100%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={1}
                    cornerRadius={4}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                        style={{ cursor: entry.isUnallocated ? 'default' : 'pointer', transition: 'opacity 0.2s' }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center content */}
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center pointer-events-none">
                {/* Confetti */}
                <AnimatePresence>
                  {showCelebration && (
                    <>
                      {[...Array(30)].map((_, i) => (
                        <ConfettiParticle 
                          key={i} 
                          delay={i * 0.02} 
                          color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                        />
                      ))}
                    </>
                  )}
                </AnimatePresence>

                <div className="text-center relative z-10">
                  {activeItem ? (
                    <>
                      <p className="text-lg font-semibold text-slate-900">{formatCurrency(activeItem.value)}</p>
                      <p className="text-xs font-medium capitalize truncate max-w-[100px]" style={{ color: activeItem.isUnallocated ? '#64748b' : activeItem.color }}>
                        {activeItem.isUnallocated ? 'Unallocated Income' : activeItem.name}
                      </p>
                      <p className="text-[10px] text-slate-500">{totalIncome > 0 ? ((activeItem.value / totalIncome) * 100).toFixed(1) : 0}%</p>
                    </>
                  ) : isFullyAllocated ? (
                    <motion.div
                      initial={showCelebration ? { scale: 0.5, opacity: 0 } : false}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="flex flex-col items-center"
                    >
                      <span className="text-[10px] text-amber-600 font-medium">{percentAllocated}%</span>
                      <span className="text-base font-bold text-slate-900">{formatCurrency(totalAllocated)}</span>
                      <span className="text-xs text-slate-400">/ {formatCurrency(totalIncome)}</span>
                    </motion.div>
                    ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400">{percentAllocated}%</span>
                      <span className="text-base font-bold text-slate-900">{formatCurrency(totalAllocated)}</span>
                      <span className="text-xs text-slate-400">/ {formatCurrency(totalIncome)}</span>
                    </div>
                    )}
                </div>
              </div>
            </div>

            {/* Remaining to allocate */}
            <div className="w-full mt-4 text-center">
              {isOverBudget ? (
                <p className="text-xs text-red-600 font-medium">
                  {formatCurrency(totalAllocated - totalIncome)} over budget
                </p>
              ) : remaining > 0 ? (
                <p className="text-xs text-slate-500">
                  {formatCurrency(remaining)} left to allocate
                </p>
              ) : (
                <p className="text-xs text-green-600 font-medium">
                  Fully allocated
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}