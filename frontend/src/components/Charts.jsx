import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line, Scatter } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);
ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";

const BRAND = '#4f46e5';
const PALETTE = ['#4f46e5', '#0ea5a4', '#f59e0b', '#e5484d', '#8b5cf6', '#64748b'];
const grid = { color: '#eef0f4' };
const wholeNumbers = { ticks: { precision: 0 }, grid, beginAtZero: true };

const options = (extra = {}) => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, ...extra });

export function Panel({ title, children, empty }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {empty ? <p className="text-muted small mb-0">No data yet</p> : <div className="chart-box">{children}</div>}
    </div>
  );
}

export function LineChart({ labels, values, label }) {
  const data = { labels, datasets: [{ label, data: values, borderColor: BRAND, backgroundColor: 'rgba(79,70,229,.1)', fill: true, tension: 0.35 }] };
  return <Line data={data} options={options({ scales: { y: wholeNumbers, x: { grid: { display: false } } } })} />;
}

export function BarChart({ labels, values, label, horizontal, fractional }) {
  const data = { labels, datasets: [{ label, data: values, backgroundColor: BRAND, borderRadius: 6, maxBarThickness: 34 }] };
  const valueAxis = fractional ? { grid, beginAtZero: true } : wholeNumbers;
  const scales = horizontal
    ? { x: valueAxis, y: { grid: { display: false } } }
    : { y: valueAxis, x: { grid: { display: false } } };
  return <Bar data={data} options={options({ indexAxis: horizontal ? 'y' : 'x', scales })} />;
}

export function GroupedBarChart({ labels, series }) {
  const data = { labels, datasets: series.map((s, i) => ({ ...s, backgroundColor: PALETTE[i], borderRadius: 5 })) };
  return <Bar data={data} options={options({ plugins: { legend: { display: true, position: 'bottom' } }, scales: { y: { grid, beginAtZero: true }, x: { grid: { display: false } } } })} />;
}

export function DoughnutChart({ labels, values }) {
  const data = { labels, datasets: [{ data: values, backgroundColor: PALETTE, borderWidth: 2 }] };
  return <Doughnut data={data} options={options({ cutout: '62%', plugins: { legend: { display: true, position: 'right' } } })} />;
}

export function ActualPredictedChart({ points }) {
  const max = Math.max(...points.map((p) => Math.max(p.actual, p.predicted)), 10);
  const data = {
    datasets: [
      { label: 'Test loans', data: points.map((p) => ({ x: p.actual, y: p.predicted })), backgroundColor: 'rgba(79,70,229,.55)', pointRadius: 4 },
      { label: 'Perfect prediction', type: 'line', data: [{ x: 0, y: 0 }, { x: max, y: max }], borderColor: '#e5484d', borderDash: [6, 5], pointRadius: 0 },
    ],
  };
  const axis = (text) => ({ title: { display: true, text }, grid, beginAtZero: true });
  return <Scatter data={data} options={options({ plugins: { legend: { display: true, position: 'bottom' } }, scales: { x: axis('Actual fine (₹)'), y: axis('Predicted fine (₹)') } })} />;
}
