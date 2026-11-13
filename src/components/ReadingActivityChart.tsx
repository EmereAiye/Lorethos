import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DayGoalHistory, ReaderTheme } from '../types';
import { BarChart3 } from 'lucide-react';

interface ReadingActivityChartProps {
  history: DayGoalHistory[];
  dailyTarget: number;
  theme: ReaderTheme;
  onConfigureGoal?: () => void;
}

interface HoveredBarState {
  day: DayGoalHistory;
  isToday: boolean;
  xPos: number;
  yPos: number;
}

export const ReadingActivityChart: React.FC<ReadingActivityChartProps> = ({
  history,
  dailyTarget,
  theme,
  onConfigureGoal
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState<number>(680);
  const [hovered, setHovered] = useState<HoveredBarState | null>(null);

  const twoWeeksData = history.slice(-14);
  const totalChapters = twoWeeksData.reduce((sum, d) => sum + d.chaptersRead, 0);
  const daysMet = twoWeeksData.filter(d => d.chaptersRead >= dailyTarget).length;
  const avgPerDay = twoWeeksData.length > 0 ? (totalChapters / twoWeeksData.length).toFixed(1) : '0.0';

  // Observe container resize so the D3 chart stays responsive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const nextWidth = el.clientWidth;
      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render D3 bar chart
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || twoWeeksData.length === 0) return;

    const height = 240;
    const margin = { top: 26, right: 16, bottom: 38, left: 32 };
    const innerWidth = Math.max(200, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const palette = {
      day: {
        axisText: 'rgba(45, 20, 44, 0.65)',
        grid: 'rgba(45, 20, 44, 0.08)',
        barBelow: 'rgba(45, 20, 44, 0.28)',
        barEmpty: 'rgba(45, 20, 44, 0.08)',
        barMet: '#C85A32',
        barHover: '#b04d28',
        valueText: '#2D142C'
      },
      sepia: {
        axisText: 'rgba(44, 30, 24, 0.68)',
        grid: 'rgba(44, 30, 24, 0.10)',
        barBelow: 'rgba(44, 30, 24, 0.30)',
        barEmpty: 'rgba(44, 30, 24, 0.10)',
        barMet: '#C85A32',
        barHover: '#B84E27',
        valueText: '#2C1E18'
      },
      night: {
        axisText: 'rgba(249, 246, 240, 0.65)',
        grid: 'rgba(255, 255, 255, 0.09)',
        barBelow: 'rgba(249, 246, 240, 0.28)',
        barEmpty: 'rgba(255, 255, 255, 0.08)',
        barMet: '#C85A32',
        barHover: '#E06C42',
        valueText: '#F9F6F0'
      }
    }[theme];

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(twoWeeksData.map(d => d.dateStr))
      .range([0, innerWidth])
      .padding(0.32);

    const dataMax = d3.max(twoWeeksData, d => d.chaptersRead) ?? 0;
    const yMax = Math.max(dailyTarget + 1, dataMax + 1, 4);

    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([innerHeight, 0]);

    const integerTicks = d3.range(0, yMax + 1, yMax > 7 ? 2 : 1);

    // Horizontal gridlines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(integerTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', palette.grid)
      .attr('stroke-dasharray', d => (d === 0 ? 'none' : '3 3'));

    // Y-axis
    const yAxis = d3
      .axisLeft(y)
      .tickValues(integerTicks)
      .tickFormat(d => `${d}`)
      .tickSize(0)
      .tickPadding(8);

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', palette.axisText)
      .style('font-size', '10px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

    // X-axis
    const xAxis = d3
      .axisBottom(x)
      .tickSize(0)
      .tickPadding(10);

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', palette.grid);
    xAxisGroup
      .selectAll('text')
      .attr('fill', (_, i) =>
        i === twoWeeksData.length - 1 ? '#C85A32' : palette.axisText
      )
      .style('font-weight', (_, i) =>
        i === twoWeeksData.length - 1 ? '700' : '500'
      )
      .style('font-size', width < 520 ? '9px' : '10px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .text((d, i) => {
        if (width < 460 && i % 2 !== 0 && i !== twoWeeksData.length - 1) {
          return '';
        }
        return i === twoWeeksData.length - 1 ? 'Today' : String(d);
      });

    // Helper for top-rounded bar path
    const topRoundedRectPath = (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      r: number
    ) => {
      const radius = Math.min(r, bw / 2, bh);
      if (bh <= 0) return '';
      return [
        `M${bx},${by + bh}`,
        `L${bx},${by + radius}`,
        `Q${bx},${by} ${bx + radius},${by}`,
        `L${bx + bw - radius},${by}`,
        `Q${bx + bw},${by} ${bx + bw},${by + radius}`,
        `L${bx + bw},${by + bh}`,
        'Z'
      ].join(' ');
    };

    const bw = x.bandwidth();

    // Bars
    const barsGroup = g.append('g').attr('class', 'bars');

    barsGroup
      .selectAll('path.bar')
      .data(twoWeeksData)
      .join('path')
      .attr('class', 'bar')
      .attr('d', d => {
        const bx = x(d.dateStr) ?? 0;
        if (d.chaptersRead === 0) {
          return topRoundedRectPath(bx, innerHeight - 3, bw, 3, 2);
        }
        const by = y(d.chaptersRead);
        const bh = Math.max(4, innerHeight - by);
        return topRoundedRectPath(bx, by, bw, bh, 5);
      })
      .attr('fill', d => {
        if (d.chaptersRead === 0) return palette.barEmpty;
        return d.chaptersRead >= dailyTarget ? palette.barMet : palette.barBelow;
      })
      .attr('stroke', (_, i) =>
        i === twoWeeksData.length - 1 ? '#C85A32' : 'none'
      )
      .attr('stroke-width', (_, i) =>
        i === twoWeeksData.length - 1 ? 1.5 : 0
      )
      .style('transition', 'opacity 150ms ease, fill 150ms ease');

    // Value labels above non-zero bars
    g.append('g')
      .attr('class', 'bar-labels')
      .selectAll('text')
      .data(twoWeeksData.filter(d => d.chaptersRead > 0))
      .join('text')
      .attr('x', d => (x(d.dateStr) ?? 0) + bw / 2)
      .attr('y', d => y(d.chaptersRead) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', d =>
        d.chaptersRead >= dailyTarget ? '#C85A32' : palette.valueText
      )
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .style('pointer-events', 'none')
      .text(d => d.chaptersRead);

    // Daily goal threshold line
    if (dailyTarget > 0 && dailyTarget <= yMax) {
      const targetY = y(dailyTarget);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', targetY)
        .attr('y2', targetY)
        .attr('stroke', '#C85A32')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5 4')
        .attr('opacity', 0.75)
        .style('pointer-events', 'none');

      g.append('text')
        .attr('x', innerWidth)
        .attr('y', targetY - 6)
        .attr('text-anchor', 'end')
        .attr('fill', '#C85A32')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
        .style('pointer-events', 'none')
        .text(`Goal: ${dailyTarget} ch/day`);
    }

    // Transparent full-height hover targets for crisp interaction on every column
    g.append('g')
      .attr('class', 'hover-targets')
      .selectAll('rect')
      .data(twoWeeksData)
      .join('rect')
      .attr('x', d => x(d.dateStr) ?? 0)
      .attr('y', 0)
      .attr('width', bw)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function (_, d) {
        const idx = twoWeeksData.indexOf(d);
        const bx = (x(d.dateStr) ?? 0) + margin.left + bw / 2;
        const by = Math.max(12, y(d.chaptersRead) + margin.top - 10);

        barsGroup
          .selectAll('path.bar')
          .attr('opacity', barDatum => (barDatum === d ? 1 : 0.55));

        setHovered({
          day: d,
          isToday: idx === twoWeeksData.length - 1,
          xPos: bx,
          yPos: by
        });
      })
      .on('mouseleave', function () {
        barsGroup.selectAll('path.bar').attr('opacity', 1);
        setHovered(null);
      });
  }, [twoWeeksData, width, dailyTarget, theme]);

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-[#1E111E] sepia:bg-[#EDE3D5] border border-[#2D142C]/10 dark:border-white/10 sepia:border-[#2C1E18]/15 space-y-5 shadow-xs">
      {/* Header & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C85A32]" />
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#C85A32]">
              Last 14 Days &middot; Daily Velocity
            </span>
          </div>
          <h4 className="font-display text-xl font-bold mt-0.5">
            Two-Week Reading Activity
          </h4>
          <p className="text-xs text-[#2D142C]/60 dark:text-white/60 sepia:text-[#2C1E18]/70 font-sans-ui">
            Chapters completed each day compared against your daily reading milestone.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-sans-ui">
          <div className="px-3 py-1.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10">
            <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60 block">14-Day Total</span>
            <span className="font-mono font-bold text-[#C85A32] tabular-nums">{totalChapters} ch</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10">
            <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60 block">Daily Avg</span>
            <span className="font-mono font-bold tabular-nums">{avgPerDay} ch/day</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] sepia:bg-[#F4ECE1] border border-[#2D142C]/10 dark:border-white/10">
            <span className="text-[10px] text-[#2D142C]/60 dark:text-white/60 block">Goal Met</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {daysMet}/14 days
            </span>
          </div>
        </div>
      </div>

      {/* Responsive D3 Chart Canvas */}
      <div ref={containerRef} className="relative w-full select-none">
        <svg ref={svgRef} className="w-full h-[240px] overflow-visible" />

        {/* Interactive Hover Tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg bg-[#2D142C] text-[#F9F6F0] dark:bg-[#F9F6F0] dark:text-[#160C16] shadow-lg text-xs font-sans-ui whitespace-nowrap border border-[#C85A32]/40"
            style={{
              left: `${Math.min(Math.max(hovered.xPos, 70), Math.max(70, width - 70))}px`,
              top: `${hovered.yPos}px`
            }}
          >
            <div className="font-mono text-[10px] opacity-75">
              {hovered.day.dayName}, {hovered.day.dateStr}
              {hovered.isToday ? ' (Today)' : ''}
            </div>
            <div className="font-bold text-sm tabular-nums">
              {hovered.day.chaptersRead} {hovered.day.chaptersRead === 1 ? 'chapter' : 'chapters'} read
            </div>
            <div className={`text-[10px] font-semibold mt-0.5 ${
              hovered.day.chaptersRead >= dailyTarget
                ? 'text-emerald-400 dark:text-emerald-700'
                : 'text-[#C85A32]'
            }`}>
              {hovered.day.chaptersRead >= dailyTarget
                ? '✓ Daily Target Met'
                : `${dailyTarget - hovered.day.chaptersRead} away from goal`}
            </div>
          </div>
        )}
      </div>

      {/* Legend & Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#2D142C]/10 dark:border-white/10 text-[11px] font-sans-ui text-[#2D142C]/65 dark:text-white/65">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#C85A32] inline-block" />
            <span>Target Met (&ge;{dailyTarget} ch)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#2D142C]/30 dark:bg-[#F9F6F0]/30 inline-block" />
            <span>In Progress</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[#C85A32] inline-block" />
            <span>Daily Goal Line</span>
          </span>
        </div>

        {onConfigureGoal && (
          <button
            onClick={onConfigureGoal}
            className="text-[#C85A32] font-semibold hover:underline cursor-pointer"
          >
            Adjust Reading Goal &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
