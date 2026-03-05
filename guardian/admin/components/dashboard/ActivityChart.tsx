'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface ActivityChartProps {
  data?: { date: string; created: number; completed: number }[]
}

const defaultData = [
  { date: '01.06', created: 12, completed: 10 },
  { date: '02.06', created: 19, completed: 15 },
  { date: '03.06', created: 15, completed: 18 },
  { date: '04.06', created: 22, completed: 14 },
  { date: '05.06', created: 18, completed: 20 },
  { date: '06.06', created: 25, completed: 22 },
  { date: '07.06', created: 30, completed: 28 },
]

export function ActivityChart({ data = defaultData }: ActivityChartProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold">Order activity</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="created"
              stroke="#0055FF"
              name="Created"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#00C48C"
              name="Completed"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
