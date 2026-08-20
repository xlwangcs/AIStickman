/**
 * 自制调参面板：把 tuning 对象的每个数值生成一个滑条，实时读写。
 * M1 手感打磨的主要工具，发布版可整体隐藏。
 */
import { tuning, type Tuning } from '../game/tuning';

export function buildTuningPanel(
  container: HTMLElement,
  onChange?: (key: keyof Tuning, value: number) => void,
): void {
  for (const key of Object.keys(tuning) as (keyof Tuning)[]) {
    const initial = tuning[key];
    if (typeof initial !== 'number') continue;

    const label = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = key;
    const value = document.createElement('span');
    value.textContent = String(initial);

    const input = document.createElement('input');
    input.type = 'range';
    const mag = Math.max(Math.abs(initial), 0.001);
    input.min = String(initial < 0 ? -mag * 3 : 0);
    input.max = String(initial < 0 ? 0 : mag * 3);
    input.step = String(mag / 100);
    input.value = String(initial);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      (tuning as Record<string, number>)[key] = v;
      value.textContent = v.toFixed(2);
      onChange?.(key, v);
    });

    label.append(name, input, value);
    container.appendChild(label);
  }
}
