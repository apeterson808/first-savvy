import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function BudgetSankeyChart({ budgets, spendingByCategory, totalIncome, incomeByCategory = {} }) {
  const getCategoryColor = (category) => {
    const colors = {
      rent: '#f97316',
      food: '#fb923c',
      transportation: '#60a5fa',
      entertainment: '#f472b6',
      shopping: '#a78bfa',
      utilities: '#fbbf24',
      healthcare: '#f87171',
      education: '#4ade80',
      insurance: '#2dd4bf',
      advertising: '#e879f9',
      office_supplies: '#c084fc',
      services: '#fb7185',
      savings: '#34d399',
      other: '#94a3b8',
    };
    return colors[category] || '#94a3b8';
  };

  const getIncomeColor = (category) => {
    const colors = {
      salary: '#6ee7b7',
      business_income: '#a78bfa',
      investment: '#60a5fa',
      other: '#fbbf24',
    };
    return colors[category] || '#6ee7b7';
  };

  const { leftNodes, rightNodes, totalSpent, savings } = useMemo(() => {
    const categorySpending = Object.entries(spendingByCategory)
      .filter(([_, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const totalSpent = categorySpending.reduce((sum, [_, amt]) => sum + amt, 0);
    const savings = Math.max(0, totalIncome - totalSpent);

    // Left side - income sources from actual transactions
    const incomeEntries = Object.entries(incomeByCategory)
      .filter(([_, amount]) => amount > 0)
      .sort(([, a], [, b]) => b - a);

    const leftNodes = incomeEntries.length > 0 
      ? incomeEntries.map(([category, amount]) => ({
          id: category,
          label: category.replace(/_/g, ' '),
          amount,
          color: getIncomeColor(category)
        }))
      : [{ id: 'income', label: 'Income', amount: totalIncome, color: '#6ee7b7' }];

    // Right side - spending categories + savings
    const rightNodes = categorySpending.map(([category, amount]) => ({
      id: category,
      label: category.replace(/_/g, ' '),
      amount,
      color: getCategoryColor(category)
    }));

    if (savings > 0) {
      rightNodes.push({
        id: 'savings',
        label: 'Savings',
        amount: savings,
        color: '#34d399'
      });
    }

    return { leftNodes, rightNodes, totalSpent, savings };
  }, [spendingByCategory, totalIncome, incomeByCategory]);

  if (totalIncome === 0 && rightNodes.length === 0) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Money Flow</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-center py-12 text-slate-500">
            <p>No income or spending data for this month.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const width = 900;
  const height = 400;
  const padding = { top: 20, bottom: 20, left: 20, right: 20 };
  
  // Column positions
  const col1X = padding.left;
  const col2X = width * 0.35;
  const col3X = width * 0.55;
  const col4X = width - padding.right - 100;
  const nodeWidth = 8;

  // Calculate total for right side
  const totalRight = rightNodes.reduce((sum, n) => sum + n.amount, 0);
  const usableHeight = height - padding.top - padding.bottom;

  // Position right nodes
  let currentY = padding.top;
  const gap = 6;
  const totalGaps = (rightNodes.length - 1) * gap;
  const availableHeight = usableHeight - totalGaps;

  const positionedRightNodes = rightNodes.map((node, i) => {
    const nodeHeight = Math.max(20, (node.amount / totalRight) * availableHeight);
    const positioned = { ...node, y: currentY, height: nodeHeight };
    currentY += nodeHeight + gap;
    return positioned;
  });

  // Center node (total)
  const centerNodeHeight = usableHeight;
  const centerY = padding.top;

  // Position left nodes (income sources)
  let leftCurrentY = padding.top;
  const leftTotalGaps = (leftNodes.length - 1) * gap;
  const leftAvailableHeight = usableHeight - leftTotalGaps;
  const leftTotal = leftNodes.reduce((sum, n) => sum + n.amount, 0);

  const positionedLeftNodes = leftNodes.map((node, i) => {
    const nodeHeight = Math.max(20, (node.amount / leftTotal) * leftAvailableHeight);
    const positioned = { ...node, y: leftCurrentY, height: nodeHeight };
    leftCurrentY += nodeHeight + gap;
    return positioned;
  });

  const formatAmount = (amount) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  // Create curved path between two rectangles
  const createFlowPath = (x1, y1, h1, x2, y2, h2, sourceYOffset = 0, sourceHRatio = 1) => {
    const startY = y1 + sourceYOffset;
    const startH = h1 * sourceHRatio;
    const midX = (x1 + x2) / 2;
    
    return `
      M ${x1} ${startY}
      C ${midX} ${startY}, ${midX} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + h2}
      C ${midX} ${y2 + h2}, ${midX} ${startY + startH}, ${x1} ${startY + startH}
      Z
    `;
  };

  // Calculate flow proportions from center to each right node
  let accumulatedY = 0;
  const flowsToRight = positionedRightNodes.map((node) => {
    const ratio = node.amount / totalRight;
    const sourceY = accumulatedY;
    accumulatedY += ratio * centerNodeHeight;
    return {
      ...node,
      sourceY: centerY + sourceY,
      sourceH: ratio * centerNodeHeight
    };
  });

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Money Flow</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-[300px]">
          <defs>
            {/* Gradients from each income source to center */}
            {positionedLeftNodes.map((node, i) => (
              <linearGradient key={`grad-left-${i}`} id={`grad-left-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={node.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.7" />
              </linearGradient>
            ))}
            
            {/* Gradients from center to each category */}
            {flowsToRight.map((node, i) => (
              <linearGradient key={`grad-${i}`} id={`grad-center-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.6" />
                <stop offset="100%" stopColor={node.color} stopOpacity="0.7" />
              </linearGradient>
            ))}
          </defs>

          {/* Flows from Income Sources to Center */}
          {(() => {
            let accLeftY = 0;
            return positionedLeftNodes.map((node, i) => {
              const ratio = node.amount / leftTotal;
              const targetY = centerY + accLeftY;
              const targetH = ratio * centerNodeHeight;
              accLeftY += targetH;
              return (
                <path
                  key={`flow-left-${i}`}
                  d={createFlowPath(
                    col1X + nodeWidth, node.y, node.height,
                    col2X, targetY, targetH
                  )}
                  fill={`url(#grad-left-${node.id})`}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              );
            });
          })()}

          {/* Income Nodes (left) */}
          {positionedLeftNodes.map((node, i) => (
            <g key={`left-node-${i}`}>
              <rect
                x={col1X}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={4}
              />
              <text
                x={col1X + nodeWidth + 10}
                y={node.y + Math.min(node.height / 2, 12)}
                dominantBaseline="middle"
                className="text-xs fill-slate-700 font-medium capitalize"
              >
                {node.label}
              </text>
              {node.height > 24 && (
                <text
                  x={col1X + nodeWidth + 10}
                  y={node.y + Math.min(node.height / 2, 12) + 14}
                  dominantBaseline="middle"
                  className="text-[10px] fill-slate-500"
                >
                  {formatAmount(node.amount)}
                </text>
              )}
            </g>
          ))}

          {/* Center Node (Total Inflows) */}
          <rect
            x={col2X}
            y={centerY}
            width={nodeWidth}
            height={centerNodeHeight}
            fill="#67e8f9"
            rx={4}
          />
          <text
            x={col2X + nodeWidth + 10}
            y={centerY + centerNodeHeight / 2 - 8}
            className="text-sm fill-slate-800 font-semibold"
          >
            Total
          </text>
          <text
            x={col2X + nodeWidth + 10}
            y={centerY + centerNodeHeight / 2 + 10}
            className="text-xs fill-slate-500"
          >
            {formatAmount(totalRight)}
          </text>

          {/* Flows from Center to Right nodes */}
          {flowsToRight.map((node, i) => (
            <path
              key={`flow-${i}`}
              d={createFlowPath(
                col2X + nodeWidth, node.sourceY, node.sourceH,
                col4X, node.y, node.height
              )}
              fill={`url(#grad-center-${node.id})`}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}

          {/* Right Nodes (Categories) */}
          {positionedRightNodes.map((node, i) => (
            <g key={`node-${i}`}>
              <rect
                x={col4X}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={4}
              />
              <text
                x={col4X + nodeWidth + 8}
                y={node.y + Math.min(node.height / 2, 12)}
                dominantBaseline="middle"
                className="text-xs fill-slate-700 font-medium capitalize"
              >
                {node.label}
              </text>
              {node.height > 24 && (
                <text
                  x={col4X + nodeWidth + 8}
                  y={node.y + Math.min(node.height / 2, 12) + 14}
                  dominantBaseline="middle"
                  className="text-[10px] fill-slate-500"
                >
                  {formatAmount(node.amount)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}