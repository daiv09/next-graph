'use client';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Treemap, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useAnalyticsContext, AnalyticsFilterType } from '../context/AnalyticsContext';
import type { ApiMeta } from '../types';

interface AnalyticsPanelProps {
  analytics: NonNullable<ApiMeta['analytics']>;
  onClose: () => void;
}

const TYPOLOGY_COLORS: Record<string, string> = {
  'Implementation': '#3b82f6',
  'Tests': '#22c55e',
  'Configuration': '#f59e0b',
  'Documentation': '#a855f7',
  'Infrastructure': '#ec4899',
};

export function AnalyticsPanel({ analytics, onClose }: AnalyticsPanelProps) {
  const { activeFilter, setActiveFilter } = useAnalyticsContext();

  const handleFilterClick = (type: AnalyticsFilterType, value: string) => {
    if (activeFilter?.type === type && activeFilter.value === value) {
      setActiveFilter(null); // toggle off
    } else {
      setActiveFilter({ type, value });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="absolute top-20 right-4 z-40 w-96 max-h-[80vh] overflow-y-auto rounded-2xl bg-[#080810]/70 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 custom-scrollbar"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white/90">Repository Analytics</h2>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white/90 transition-colors bg-white/5 rounded-full p-1"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* Chart A: Typology Donut */}
        <section>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Codebase Composition</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.typology}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(entry) => handleFilterClick('typology', entry.name)}
                  cursor="pointer"
                >
                  {analytics.typology.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={TYPOLOGY_COLORS[entry.name] || '#8884d8'}
                      opacity={activeFilter?.value === entry.name ? 1 : (activeFilter ? 0.3 : 0.8)}
                      stroke="rgba(255,255,255,0.1)"
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart B: Scatter Plot (Outliers) */}
        <section>
          <h3 className="text-sm font-semibold text-white/70 mb-2">Structural Outliers (Depth vs Size)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <XAxis dataKey="depth" type="number" name="Depth" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis dataKey="size" type="number" name="Size" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <ZAxis range={[20, 200]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                  labelFormatter={() => ''}
                  formatter={(value: number, name: string, props: any) => [name === 'size' ? `${(value/1024).toFixed(1)} KB` : value, name]}
                />
                <Scatter
                  name="Files"
                  data={analytics.scatter}
                  fill="#0ea5e9"
                  onClick={(entry) => handleFilterClick('scatter', entry.path)}
                  cursor="pointer"
                >
                  {analytics.scatter.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      opacity={activeFilter?.value === entry.path ? 1 : (activeFilter ? 0.1 : 0.5)}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart D: Size Distribution */}
        <section>
          <h3 className="text-sm font-semibold text-white/70 mb-2">File Size Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sizeDistribution} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar
                  dataKey="value"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  onClick={(entry) => handleFilterClick('sizeBucket', entry.name)}
                  cursor="pointer"
                >
                  {analytics.sizeDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      opacity={activeFilter?.value === entry.name ? 1 : (activeFilter ? 0.3 : 0.8)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Chart E: Radar Chart */}
        {analytics.radar.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/70 mb-2">Sub-system Health (Top 5 Roots)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="60%" data={analytics.radar}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar
                    name="Avg Depth"
                    dataKey="avgDepth"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    onClick={(e) => handleFilterClick('radar', e.name)}
                    cursor="pointer"
                  />
                  <Radar
                    name="Avg Size (Bytes)"
                    dataKey="avgSize"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.3}
                    onClick={(e) => handleFilterClick('radar', e.name)}
                    cursor="pointer"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Chart C: Treemap */}
        {analytics.treemap.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-white/70 mb-2">Folder Density (By File Count)</h3>
            <div className="h-48 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={analytics.treemap}
                  dataKey="fileCount"
                  stroke="#fff"
                  fill="#6366f1"
                  onClick={(entry) => handleFilterClick('treemap', entry.name)}
                  style={{ cursor: 'pointer' }}
                >
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                    formatter={(value: number, name: string, props: any) => [value, 'Files']}
                  />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>

      {activeFilter && (
        <div className="sticky bottom-0 mt-4 p-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-center shadow-xl">
          <p className="text-xs text-white/80 font-medium">
            Filtering by <span className="text-white font-bold">{activeFilter.type}</span>: <span className="text-sky-300">{activeFilter.value}</span>
          </p>
          <button
            onClick={() => setActiveFilter(null)}
            className="mt-2 text-[10px] uppercase tracking-wider bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-md transition-colors"
          >
            Clear Filter
          </button>
        </div>
      )}
    </motion.div>
  );
}
