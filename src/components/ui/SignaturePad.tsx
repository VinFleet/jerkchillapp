"use client";

import { useRef, useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import type { Bi as BiValue } from "@/lib/types";
import { Bi } from "@/components/Bi";

/** Draw-to-sign pad (mouse or touch) — used to confirm a check was actually done by a specific person, not just logged by their session. Value is a transparent-background PNG data URL, or "" when blank. */
export function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: BiValue;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasStroke.current) {
      setEmpty(false);
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setEmpty(true);
    onChange("");
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <Bi value={label} mode="inline" className="text-xs font-semibold text-muted" />
        {!empty && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-danger font-semibold">
            <RotateCcw size={12} /> Clear · Xóa
          </button>
        )}
      </div>
      <div className="relative rounded-xl border-2 border-border bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-28 touch-none"
        />
        {empty && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-muted pointer-events-none">
            Sign here · Ký tên tại đây
          </span>
        )}
      </div>
    </div>
  );
}
