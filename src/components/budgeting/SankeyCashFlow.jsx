import React, { useMemo, useState } from 'react';
import {
  Home, House, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
} from 'lucide-react';
import { convertCadence } from '@/utils/cadenceUtils';

const ICON_MAP = {
  Home, House, ShoppingCart, Coffee, Utensils, Car, Plane, Hotel,
  Smartphone, Laptop, Tv, Music, Gamepad, Book, GraduationCap,
  Briefcase, DollarSign, CreditCard, Wallet, PiggyBank, TrendingUp,
  Heart, Activity, Pill, Stethoscope, Dumbbell, Apple,
  Shirt, Watch, Scissors, Paintbrush, Palette,
  Gift, PartyPopper, Beer, Pizza, IceCream, Cake,
  Bus, Train, Bike, Fuel, Wrench, Hammer,
  Lightbulb, Zap, Droplet, Wifi, Phone, Mail,
  ShoppingBag, Package, Tag, Store, Building, Factory,
  Trees, Flower2, Leaf, Umbrella, CloudRain, Sun,
  Moon, Star, Sparkles, Crown, Trophy, Award,
  Film, Camera, Video, Headphones, Mic, Radio,
  Dog, Cat, Fish, Bird, Bone, PawPrint, Circle, Baby
};

export default function SankeyCashFlow({ budgets }) {
  const [hoveredFlow, setHoveredFlow] = useState(null);

  const { incomeNodes, expenseNodes, totalIncome, totalExpense, unallocated } = useMemo(() => {
    const incomeBudgets = budgets.filter(b => b.chartAccount?.class === 'income');
    const expenseBudgets = budgets.filter(b => b.chartAccount?.class === 'expense');

    const incomeNodes = incomeBudgets.map(b => {
      const amount = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
      return {
        id: b.id,
        name: b.chartAccount?.display_name || b.chartAccount?.account_detail || 'Unknown',
        amount,
        color: b.chartAccount?.color || b.color || '#10b981',
        icon: b.chartAccount?.icon
      };
    }).filter(n => n.amount > 0).sort((a, b) => b.amount - a.amount);

    const expenseNodes = expenseBudgets.map(b => {
      const amount = convertCadence(parseFloat(b.allocated_amount || 0), b.cadence || 'monthly', 'monthly');
      return {
        id: b.id,
        name: b.chartAccount?.display_name || b.chartAccount?.account_detail || 'Unknown',
        amount,
        color: b.chartAccount?.color || b.color || '#ef4444',
        icon: b.chartAccount?.icon
      };
    }).filter(n => n.amount > 0).sort((a, b) => b.amount - a.amount);

    const totalIncome = incomeNodes.reduce((sum, n) => sum + n.amount, 0);
    const totalExpense = expenseNodes.reduce((sum, n) => sum + n.amount, 0);
    const unallocated = totalIncome - totalExpense;

    return { incomeNodes, expenseNodes, totalIncome, totalExpense, unallocated };
  }, [budgets]);

  if (incomeNodes.length === 0 && expenseNodes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>No budget data available</p>
      </div>
    );
  }

  const width = 800;
  const height = Math.max(300, Math.max(incomeNodes.length, expenseNodes.length) * 40 + 80);
  const padding = { top: 40, bottom: 40, left: 20, right: 20 };

  const leftX = padding.left + 120;
  const centerX = width / 2;
  const rightX = width - padding.right - 120;
  const nodeWidth = 12;
  const gap = 8;

  const usableHeight = height - padding.top - padding.bottom;

  let leftY = padding.top;
  const leftTotalGaps = Math.max(0, (incomeNodes.length - 1) * gap);
  const leftAvailableHeight = usableHeight - leftTotalGaps;

  const positionedIncomeNodes = incomeNodes.map(node => {
    const nodeHeight = totalIncome > 0
      ? Math.max(20, (node.amount / totalIncome) * leftAvailableHeight)
      : 20;
    const positioned = { ...node, y: leftY, height: nodeHeight };
    leftY += nodeHeight + gap;
    return positioned;
  });

  const centerHeight = usableHeight;
  const centerY = padding.top;

  const allExpenses = totalExpense + (unallocated > 0 ? unallocated : 0);
  let rightY = padding.top;
  const rightTotalGaps = Math.max(0, (expenseNodes.length + (unallocated > 0 ? 1 : 0) - 1) * gap);
  const rightAvailableHeight = usableHeight - rightTotalGaps;

  const positionedExpenseNodes = expenseNodes.map(node => {
    const nodeHeight = allExpenses > 0
      ? Math.max(20, (node.amount / allExpenses) * rightAvailableHeight)
      : 20;
    const positioned = { ...node, y: rightY, height: nodeHeight };
    rightY += nodeHeight + gap;
    return positioned;
  });

  let unallocatedNode = null;
  if (unallocated > 0) {
    const nodeHeight = allExpenses > 0
      ? Math.max(20, (unallocated / allExpenses) * rightAvailableHeight)
      : 20;
    unallocatedNode = {
      id: 'unallocated',
      name: 'Unallocated',
      amount: unallocated,
      color: '#94a3b8',
      icon: null,
      y: rightY,
      height: nodeHeight
    };
  }

  const createFlowPath = (x1, y1, h1, x2, y2, h2) => {
    const midX = (x1 + x2) / 2;
    return `
      M ${x1} ${y1}
      C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + h2}
      C ${midX} ${y2 + h2}, ${midX} ${y1 + h1}, ${x1} ${y1 + h1}
      Z
    `;
  };

  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  let leftAccY = 0;
  const leftFlows = positionedIncomeNodes.map(node => {
    const ratio = node.amount / totalIncome;
    const sourceY = leftAccY;
    const sourceH = ratio * centerHeight;
    leftAccY += sourceH;
    return {
      ...node,
      sourceY: centerY + sourceY,
      sourceH
    };
  });

  let rightAccY = 0;
  const rightFlows = [...positionedExpenseNodes, ...(unallocatedNode ? [unallocatedNode] : [])].map(node => {
    const ratio = node.amount / allExpenses;
    const targetY = rightAccY;
    const targetH = ratio * centerHeight;
    rightAccY += targetH;
    return {
      ...node,
      targetY: centerY + targetY,
      targetH
    };
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minHeight: '300px' }}>
        <defs>
          {leftFlows.map(node => (
            <linearGradient key={`grad-left-${node.id}`} id={`grad-left-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={node.color} stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.5" />
            </linearGradient>
          ))}

          {rightFlows.map(node => (
            <linearGradient key={`grad-right-${node.id}`} id={`grad-right-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.5" />
              <stop offset="100%" stopColor={node.color} stopOpacity="0.6" />
            </linearGradient>
          ))}
        </defs>

        {leftFlows.map(node => {
          const Icon = node.icon && ICON_MAP[node.icon];
          return (
            <g key={`left-flow-${node.id}`}>
              <path
                d={createFlowPath(
                  leftX + nodeWidth, node.y, node.height,
                  centerX, node.sourceY, node.sourceH
                )}
                fill={`url(#grad-left-${node.id})`}
                className="transition-opacity cursor-pointer"
                style={{ opacity: hoveredFlow && hoveredFlow !== node.id ? 0.3 : 0.8 }}
                onMouseEnter={() => setHoveredFlow(node.id)}
                onMouseLeave={() => setHoveredFlow(null)}
              />
            </g>
          );
        })}

        {positionedIncomeNodes.map(node => {
          const Icon = node.icon && ICON_MAP[node.icon];
          return (
            <g key={`left-node-${node.id}`}>
              <rect
                x={leftX}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={6}
              />
              <text
                x={leftX - 8}
                y={node.y + node.height / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-slate-700 font-medium"
              >
                {node.name}
              </text>
              {Icon && node.height >= 24 && (
                <g transform={`translate(${leftX + nodeWidth + 8}, ${node.y + node.height / 2})`}>
                  <circle r="10" fill={node.color} opacity="0.2" />
                  <foreignObject x="-8" y="-8" width="16" height="16">
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="w-3 h-3" style={{ color: node.color }} />
                    </div>
                  </foreignObject>
                </g>
              )}
              {node.height >= 16 && (
                <text
                  x={leftX - 8}
                  y={node.y + node.height / 2 + 14}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[10px] fill-slate-500"
                >
                  {formatAmount(node.amount)}
                </text>
              )}
            </g>
          );
        })}

        <rect
          x={centerX - nodeWidth / 2}
          y={centerY}
          width={nodeWidth}
          height={centerHeight}
          fill="#0ea5e9"
          rx={6}
        />
        <text
          x={centerX}
          y={centerY - 12}
          textAnchor="middle"
          className="text-sm fill-slate-800 font-semibold"
        >
          Budget
        </text>
        <text
          x={centerX}
          y={height - padding.bottom + 20}
          textAnchor="middle"
          className="text-xs fill-slate-600"
        >
          {formatAmount(totalIncome)}
        </text>

        {rightFlows.map(node => {
          const Icon = node.icon && ICON_MAP[node.icon];
          return (
            <g key={`right-flow-${node.id}`}>
              <path
                d={createFlowPath(
                  centerX + nodeWidth / 2, node.targetY, node.targetH,
                  rightX, node.y, node.height
                )}
                fill={`url(#grad-right-${node.id})`}
                className="transition-opacity cursor-pointer"
                style={{ opacity: hoveredFlow && hoveredFlow !== node.id ? 0.3 : 0.8 }}
                onMouseEnter={() => setHoveredFlow(node.id)}
                onMouseLeave={() => setHoveredFlow(null)}
              />
            </g>
          );
        })}

        {[...positionedExpenseNodes, ...(unallocatedNode ? [unallocatedNode] : [])].map(node => {
          const Icon = node.icon && ICON_MAP[node.icon];
          return (
            <g key={`right-node-${node.id}`}>
              <rect
                x={rightX}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={6}
              />
              <text
                x={rightX + nodeWidth + 8}
                y={node.y + node.height / 2}
                textAnchor="start"
                dominantBaseline="middle"
                className="text-xs fill-slate-700 font-medium"
              >
                {node.name}
              </text>
              {Icon && node.height >= 24 && (
                <g transform={`translate(${rightX - 18}, ${node.y + node.height / 2})`}>
                  <circle r="10" fill={node.color} opacity="0.2" />
                  <foreignObject x="-8" y="-8" width="16" height="16">
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="w-3 h-3" style={{ color: node.color }} />
                    </div>
                  </foreignObject>
                </g>
              )}
              {node.height >= 16 && (
                <text
                  x={rightX + nodeWidth + 8}
                  y={node.y + node.height / 2 + 14}
                  textAnchor="start"
                  dominantBaseline="middle"
                  className="text-[10px] fill-slate-500"
                >
                  {formatAmount(node.amount)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
