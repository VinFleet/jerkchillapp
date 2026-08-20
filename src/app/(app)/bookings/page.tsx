"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Users, Phone, AlertTriangle, X, LayoutGrid, Trash2, Move } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Stepper } from "@/components/ui/Stepper";
import { useSession } from "@/lib/auth/RoleContext";
import { canEditFloorPlan } from "@/lib/auth/permissions";
import { todayIso, addDaysIso } from "@/lib/storage";
import {
  getTables,
  addTable,
  updateTable,
  moveTable,
  removeTable,
  createStarterFloorPlan,
  getBookingsForDate,
  createStaffBooking,
  updateBookingStatus,
  updateBooking,
  subscribeToBookings,
  type NewBookingInput,
} from "@/lib/bookings/repo";
import { TABLE_SHAPES, POS_MIN, POS_MAX, isUnplaced } from "@/lib/bookings/types";
import type { RestaurantTable, Booking, BookingStatus, TableShape } from "@/lib/bookings/types";
import { STATUS_LABEL, STATUS_TONE, STATUS_ORDER, SHAPE_LABEL } from "@/lib/bookings/labels";

type Tab = "floor" | "list";

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayIso();
  return (
    <div className="flex items-center gap-2 px-4 md:px-8 mb-4">
      <button onClick={() => onChange(addDaysIso(date, -1))} className="w-11 h-11 flex items-center justify-center text-brand" aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {date} {isToday && <span className="text-brand">· Today / Hôm nay</span>}
      </span>
      <button onClick={() => onChange(addDaysIso(date, 1))} className="w-11 h-11 flex items-center justify-center text-brand" aria-label="Next day">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function ShapePicker({ value, onChange }: { value: TableShape; onChange: (s: TableShape) => void }) {
  return (
    <div>
      <label className="text-xs text-muted mb-1 block">Shape · Hình dáng</label>
      <div className="flex gap-2">
        {TABLE_SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`flex-1 min-h-12 rounded-xl border-2 text-xs font-semibold flex flex-col items-center justify-center gap-1 ${
              value === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            <span
              className={`block border-2 ${value === s ? "border-white" : "border-muted"} ${
                s === "round" ? "w-4 h-4 rounded-full" : s === "rect" ? "w-6 h-3 rounded-sm" : "w-4 h-4 rounded-sm"
              }`}
            />
            {SHAPE_LABEL[s].en} · {SHAPE_LABEL[s].vi}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddTableForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState(4);
  const [shape, setShape] = useState<TableShape>("square");
  const [saving, setSaving] = useState(false);

  return (
    <Card className="mb-3">
      <p className="font-semibold text-sm mb-3">New table · Bàn mới</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted mb-1 block">Table number · Số bàn</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. 9 · ví dụ 9"
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Seats · Số chỗ</label>
          <Stepper value={seats} onChange={setSeats} min={1} />
        </div>
        <ShapePicker value={shape} onChange={setShape} />
        <p className="text-xs text-muted">
          Added to the floor plan straight away — drag it into place after · Bàn sẽ hiện ngay trên sơ đồ — kéo vào vị trí sau
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="ghost" className="flex-1 min-h-12 text-sm" onClick={onCancel}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-12 text-sm"
          disabled={!number.trim() || seats < 1 || saving}
          onClick={async () => {
            setSaving(true);
            try {
              // pos 0,0 = "not placed yet" — the floor plan auto-arranges it
              // into a free grid slot until someone drags it somewhere real.
              await addTable(number.trim(), seats, 0, 0, shape);
              setNumber("");
              onAdded();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Adding… · Đang thêm…" : "Add · Thêm"}
        </Button>
      </div>
    </Card>
  );
}

function EditTableForm({ table, onSaved, onCancel }: { table: RestaurantTable; onSaved: () => void; onCancel: () => void }) {
  const [number, setNumber] = useState(table.table_number);
  const [seats, setSeats] = useState(table.seats);
  const [shape, setShape] = useState<TableShape>(table.shape);
  const [saving, setSaving] = useState(false);

  return (
    <Card className="mb-3">
      <p className="font-semibold text-sm mb-3">Table {table.table_number} · Bàn {table.table_number}</p>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted mb-1 block">Table number · Số bàn</label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Seats · Số chỗ</label>
          <Stepper value={seats} onChange={setSeats} min={1} />
        </div>
        <ShapePicker value={shape} onChange={setShape} />
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="danger"
          className="min-h-12 text-sm px-4"
          onClick={async () => {
            if (!window.confirm(`Remove table ${table.table_number}? · Xóa bàn ${table.table_number}?`)) return;
            await removeTable(table.id);
            onSaved();
          }}
          aria-label={`Remove table ${table.table_number}`}
        >
          <Trash2 size={16} /> Remove · Xóa
        </Button>
        <Button variant="ghost" className="flex-1 min-h-12 text-sm" onClick={onCancel}>
          Cancel · Hủy
        </Button>
        <Button
          className="flex-1 min-h-12 text-sm"
          disabled={!number.trim() || seats < 1 || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await updateTable(table.id, { table_number: number.trim(), seats, shape });
              onSaved();
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving… · Đang lưu…" : "Save · Lưu"}
        </Button>
      </div>
    </Card>
  );
}

function BookingForm({
  tables,
  initialTableId,
  editing,
  onSaved,
  onCancel,
}: {
  tables: RestaurantTable[];
  initialTableId: string | null;
  editing: Booking | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [tableId, setTableId] = useState(editing?.table_id ?? initialTableId ?? "");
  const [date, setDate] = useState(editing?.booking_date ?? todayIso());
  const [time, setTime] = useState(editing?.booking_time?.slice(0, 5) ?? "19:00");
  const [partySize, setPartySize] = useState(editing?.party_size ?? 2);
  const [name, setName] = useState(editing?.customer_name ?? "");
  const [phone, setPhone] = useState(editing?.customer_phone ?? "");
  const [requests, setRequests] = useState(editing?.special_requests ?? "");
  const [allergies, setAllergies] = useState(editing?.allergies ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const input: NewBookingInput = {
      table_id: tableId || null,
      booking_date: date,
      booking_time: time,
      party_size: partySize,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      special_requests: requests.trim() || undefined,
      allergies: allergies.trim() || undefined,
    };
    try {
      if (editing) await updateBooking(editing.id, input);
      else await createStaffBooking(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong · Đã có lỗi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-surface w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-lg">{editing ? "Edit booking · Sửa đặt bàn" : "New booking · Đặt bàn mới"}</p>
          <button onClick={onCancel} className="p-1 text-muted">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Table · Bàn</label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm bg-surface"
            >
              <option value="">Not assigned yet · Chưa xếp bàn</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table · Bàn {t.table_number} — {t.seats} seats · chỗ
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Date · Ngày</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Time · Giờ</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Party size · Số người</label>
            <Stepper value={partySize} onChange={setPartySize} min={1} />
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer name · Tên khách"
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
                inputMode="tel"
                placeholder="Phone number · Số điện thoại"
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
          />
          <input
            value={requests}
            onChange={(e) => setRequests(e.target.value)}
            placeholder="Special requests · Yêu cầu đặc biệt"
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
          />
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="Allergies · Dị ứng"
            className="w-full min-h-12 rounded-xl border-2 border-border px-3 text-sm"
          />

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Cancel · Hủy
            </Button>
            <Button className="flex-1" disabled={!name.trim() || !phone.trim() || saving} onClick={submit}>
              {saving ? "Saving… · Đang lưu…" : "Save · Lưu"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingRow({ booking, tables, onEdit, onStatus }: { booking: Booking; tables: RestaurantTable[]; onEdit: () => void; onStatus: (s: BookingStatus) => void }) {
  const table = tables.find((t) => t.id === booking.table_id);
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onEdit} className="text-left flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {booking.booking_time.slice(0, 5)} · {booking.customer_name}
          </p>
          <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1">
              <Users size={12} /> {booking.party_size}
            </span>
            <span className="flex items-center gap-1">
              <Phone size={12} /> {booking.customer_phone}
            </span>
            {table && <span>Table {table.table_number}</span>}
          </p>
          {booking.allergies && (
            <p className="text-xs text-danger flex items-center gap-1 mt-1">
              <AlertTriangle size={12} /> {booking.allergies}
            </p>
          )}
          {booking.special_requests && <p className="text-xs text-muted mt-1">{booking.special_requests}</p>}
          {booking.source === "online" && (
            <span className="inline-block mt-1">
              <Badge tone="brand">Online booking · Đặt online</Badge>
            </span>
          )}
        </button>
        <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status].en} · {STATUS_LABEL[booking.status].vi}</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            className={`min-h-11 px-2.5 rounded-xl text-[11px] font-semibold border-2 leading-tight flex flex-col items-center justify-center ${
              booking.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            <span>{STATUS_LABEL[s].en} · {STATUS_LABEL[s].vi}</span>
            <span className="opacity-80 text-[10px]">{STATUS_LABEL[s].vi}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------- Floor plan ----------

const SHAPE_CLASS: Record<TableShape, string> = {
  square: "w-16 h-16 rounded-2xl",
  round: "w-16 h-16 rounded-full",
  rect: "w-24 h-14 rounded-2xl",
};

const clampPos = (n: number) => Math.min(POS_MAX, Math.max(POS_MIN, n));

/** Where a table nobody has placed yet sits, so new/legacy tables never stack on top of each other at (0,0). */
function autoSlot(index: number, total: number): { x: number; y: number } {
  const cols = total <= 4 ? 2 : total <= 9 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(total / cols));
  return { x: (((index % cols) + 0.5) / cols), y: ((Math.floor(index / cols) + 0.5) / rows) };
}

function resolvePositions(tables: RestaurantTable[]): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const unplacedCount = tables.filter(isUnplaced).length;
  let i = 0;
  for (const t of tables) {
    map.set(t.id, isUnplaced(t) ? autoSlot(i++, unplacedCount) : { x: t.pos_x, y: t.pos_y });
  }
  return map;
}

function FloorTable({
  table,
  pos,
  bookingCount,
  selected,
  arranging,
  canvasRef,
  onSelect,
  onEdit,
  onMoved,
}: {
  table: RestaurantTable;
  pos: { x: number; y: number };
  bookingCount: number;
  selected: boolean;
  arranging: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onEdit: () => void;
  onMoved: (id: string, x: number, y: number) => void;
}) {
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    /** Where inside the table it was grabbed, as a canvas fraction — keeps it under the finger instead of snapping its centre to the touch point. */
    grabX: number;
    grabY: number;
    moved: boolean;
    last: { x: number; y: number };
  } | null>(null);
  const shown = live ?? pos;

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>, commit: boolean) => {
    const state = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setLive(null);
    if (!state || state.pointerId !== e.pointerId) return;
    if (state.moved) {
      if (commit) onMoved(table.id, state.last.x, state.last.y);
    } else if (arranging) {
      // A tap (not a drag) while arranging opens the table's own edit form.
      onEdit();
    }
  };

  return (
    <button
      type="button"
      // Pointer events, not mouse events — one code path covers finger on the
      // kitchen tablet and mouse on the owner's laptop.
      onPointerDown={(e) => {
        if (!arranging) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = canvasRef.current?.getBoundingClientRect();
        drag.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          grabX: rect ? (e.clientX - rect.left) / rect.width - pos.x : 0,
          grabY: rect ? (e.clientY - rect.top) / rect.height - pos.y : 0,
          moved: false,
          last: pos,
        };
      }}
      onPointerMove={(e) => {
        const state = drag.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!state || state.pointerId !== e.pointerId || !rect) return;
        // 6px of slop so a slightly-wobbly tap still counts as a tap.
        if (!state.moved && Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 6) return;
        state.moved = true;
        state.last = {
          x: clampPos((e.clientX - rect.left) / rect.width - state.grabX),
          y: clampPos((e.clientY - rect.top) / rect.height - state.grabY),
        };
        setLive(state.last);
      }}
      onPointerUp={(e) => endDrag(e, true)}
      onPointerCancel={(e) => endDrag(e, false)}
      onClick={() => {
        if (arranging) return; // handled on pointer-up, so a drag never counts as a tap
        onSelect();
      }}
      style={{
        left: `${shown.x * 100}%`,
        top: `${shown.y * 100}%`,
        touchAction: arranging ? "none" : undefined,
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center border-2 select-none ${
        SHAPE_CLASS[table.shape]
      } ${selected ? "bg-brand text-white border-brand" : "bg-surface border-border active:bg-brand-light"} ${
        arranging ? "shadow-md cursor-grab" : ""
      } ${live ? "z-10 scale-105 shadow-lg" : ""}`}
      aria-label={`Table ${table.table_number} · Bàn ${table.table_number}, ${table.seats} seats · ${table.seats} chỗ`}
    >
      <span className="text-lg font-bold leading-none">{table.table_number}</span>
      <span className={`text-[10px] font-semibold mt-0.5 flex items-center gap-0.5 ${selected ? "text-white/80" : "text-muted"}`}>
        <Users size={9} /> {table.seats}
      </span>
      {bookingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center border-2 border-surface">
          {bookingCount}
        </span>
      )}
    </button>
  );
}

function FloorPlanCanvas({
  tables,
  positions,
  bookingCountFor,
  selectedTableId,
  arranging,
  onSelect,
  onEdit,
  onMoved,
}: {
  tables: RestaurantTable[];
  positions: Map<string, { x: number; y: number }>;
  bookingCountFor: (tableId: string) => number;
  selectedTableId: string | null;
  arranging: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onMoved: (id: string, x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  return (
    // The padding is the room's walls: positions are fractions of the inner
    // box, so even a table dragged hard against the edge stays fully visible.
    <div
      className={`relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[65vh] rounded-2xl border-2 bg-brand-light overflow-hidden mb-2 p-8 ${
        arranging ? "border-brand" : "border-border"
      }`}
    >
      <div ref={canvasRef} className="relative w-full h-full">
        {tables.map((t) => (
          <FloorTable
            key={t.id}
            table={t}
            pos={positions.get(t.id) ?? { x: 0.5, y: 0.5 }}
            bookingCount={bookingCountFor(t.id)}
            selected={selectedTableId === t.id}
            arranging={arranging}
            canvasRef={canvasRef}
            onSelect={() => onSelect(t.id)}
            onEdit={() => onEdit(t.id)}
            onMoved={onMoved}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyFloorPlan({
  canEdit,
  creating,
  onCreate,
  onAddManually,
}: {
  canEdit: boolean;
  creating: boolean;
  onCreate: () => void;
  onAddManually: () => void;
}) {
  return (
    <Card className="text-center py-8">
      <p className="font-semibold text-sm">No tables set up yet · Chưa có bàn nào</p>
      <p className="text-xs text-muted mt-2 mb-5 max-w-sm mx-auto">
        Until at least one table exists, the online booking page tells every guest we may be full · Khi chưa có bàn nào,
        trang đặt bàn online sẽ báo với khách là có thể đã kín chỗ
      </p>
      {canEdit ? (
        <>
          <Button className="w-full sm:w-auto sm:mx-auto" disabled={creating} onClick={onCreate}>
            <LayoutGrid size={18} />
            {creating ? "Setting up… · Đang tạo…" : "Set up a starter floor plan · Tạo sơ đồ bàn mẫu"}
          </Button>
          <p className="text-[11px] text-muted mt-3">
            8 tables, 26 seats — rename, resize, drag or delete any of them after · 8 bàn, 26 chỗ — có thể đổi tên, đổi
            số chỗ, kéo hoặc xóa sau
          </p>
          <button onClick={onAddManually} className="min-h-11 mt-3 text-xs text-brand font-semibold">
            Or add tables one at a time · Hoặc tự thêm từng bàn
          </button>
        </>
      ) : (
        <p className="text-xs text-muted">Ask a manager to set up the floor plan · Nhờ quản lý tạo sơ đồ bàn</p>
      )}
    </Card>
  );
}

function BookingsContent() {
  const { session } = useSession();
  const [date, setDate] = useState(todayIso());
  const [tab, setTab] = useState<Tab>("floor");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [managingTables, setManagingTables] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [creatingStarter, setCreatingStarter] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([getTables(), getBookingsForDate(date)]);
      setTables(t);
      setBookings(b);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load bookings");
    }
  }, [date]);

  const positions = useMemo(() => resolvePositions(tables), [tables]);

  /** Optimistic so the table stays under the finger, then persisted. */
  const handleMoved = useCallback(
    (id: string, x: number, y: number) => {
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, pos_x: x, pos_y: y } : t)));
      moveTable(id, x, y).catch((e) => {
        console.error("Couldn't save table position:", e);
        setLoadError("Couldn't save the new table position · Không lưu được vị trí bàn mới");
        refresh();
      });
    },
    [refresh]
  );

  /** Writes the auto-arranged grid down as real positions, so legacy tables stop sitting on the (0,0) default. */
  const handleAutoArrange = useCallback(async () => {
    const laid = tables.map((t) => ({ id: t.id, ...(positions.get(t.id) ?? { x: 0.5, y: 0.5 }) }));
    setTables((prev) => prev.map((t) => { const p = positions.get(t.id); return p ? { ...t, pos_x: p.x, pos_y: p.y } : t; }));
    try {
      await Promise.all(laid.map((p) => moveTable(p.id, p.x, p.y)));
    } catch (e) {
      console.error("Couldn't save the arranged layout:", e);
      setLoadError("Couldn't save the layout · Không lưu được sơ đồ");
    }
    refresh();
  }, [tables, positions, refresh]);

  const handleStarterFloorPlan = useCallback(async () => {
    setCreatingStarter(true);
    try {
      await createStarterFloorPlan();
      await refresh();
    } catch (e) {
      console.error("Couldn't create the starter floor plan:", e);
      setLoadError("Couldn't create the starter floor plan · Không tạo được sơ đồ bàn mẫu");
    } finally {
      setCreatingStarter(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      const unsubscribe = subscribeToBookings(date, refresh);
      return unsubscribe;
    } catch {
      return undefined;
    }
  }, [date, refresh]);

  if (!session) return null;
  const canEditTables = canEditFloorPlan(session.role);

  const bookingsForTable = (tableId: string) => bookings.filter((b) => b.table_id === tableId);
  const editingTable = tables.find((t) => t.id === editingTableId) ?? null;
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  return (
    <div className="pb-24">
      <PageHeader title="Bookings · Đặt Bàn" subtitle="Table reservations · Đặt chỗ theo bàn" />
      <DateNav date={date} onChange={setDate} />

      {loadError && (
        <div className="px-4 md:px-8 mb-4">
          <Card className="border-danger/40 bg-danger-tint">
            <p className="text-sm text-danger">{loadError}</p>
          </Card>
        </div>
      )}

      <div className="px-4 md:px-8 flex gap-2 mb-4">
        {([
          ["floor", "Floor Plan · Sơ Đồ Bàn"],
          ["list", "List · Danh Sách"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-h-11 rounded-full font-semibold text-sm border-2 ${
              tab === t ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-8">
        {tab === "floor" && (
          <>
            {canEditTables && tables.length > 0 && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => {
                    setManagingTables((m) => !m);
                    setAddingTable(false);
                    setEditingTableId(null);
                  }}
                  className="min-h-11 px-4 rounded-full border-2 border-border text-xs text-brand font-semibold flex items-center gap-1.5"
                >
                  {managingTables ? (
                    "Done · Xong"
                  ) : (
                    <>
                      <Move size={14} /> Arrange tables · Sắp xếp bàn
                    </>
                  )}
                </button>
              </div>
            )}

            {tables.length === 0 ? (
              addingTable ? (
                <AddTableForm
                  onAdded={() => {
                    setAddingTable(false);
                    setManagingTables(true); // land in arrange mode so the next table is one tap away
                    refresh();
                  }}
                  onCancel={() => setAddingTable(false)}
                />
              ) : (
                <EmptyFloorPlan
                  canEdit={canEditTables}
                  creating={creatingStarter}
                  onCreate={handleStarterFloorPlan}
                  onAddManually={() => setAddingTable(true)}
                />
              )
            ) : (
              <>
                <FloorPlanCanvas
                  tables={tables}
                  positions={positions}
                  bookingCountFor={(id) => bookingsForTable(id).length}
                  selectedTableId={selectedTableId}
                  arranging={managingTables}
                  onSelect={(id) => setSelectedTableId(selectedTableId === id ? null : id)}
                  onEdit={(id) => {
                    setAddingTable(false);
                    setEditingTableId(id);
                  }}
                  onMoved={handleMoved}
                />
                <p className="text-xs text-muted text-center mb-4">
                  {managingTables
                    ? "Drag a table to move it, tap it to edit · Kéo bàn để di chuyển, chạm để sửa"
                    : "Tap a table to see its bookings · Chạm vào bàn để xem đặt bàn"}
                </p>

                {managingTables && (
                  <div className="mb-4">
                    {editingTable ? (
                      <EditTableForm
                        table={editingTable}
                        onSaved={() => {
                          setEditingTableId(null);
                          refresh();
                        }}
                        onCancel={() => setEditingTableId(null)}
                      />
                    ) : addingTable ? (
                      <AddTableForm
                        onAdded={() => {
                          setAddingTable(false);
                          refresh();
                        }}
                        onCancel={() => setAddingTable(false)}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1 min-h-12 text-sm" onClick={() => setAddingTable(true)}>
                          <Plus size={16} /> Add table · Thêm bàn
                        </Button>
                        <Button variant="ghost" className="flex-1 min-h-12 text-sm" onClick={handleAutoArrange}>
                          <LayoutGrid size={16} /> Auto-arrange · Tự sắp xếp
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {selectedTable && (
              <div className="space-y-2 mb-4">
                <p className="font-bold text-sm text-muted uppercase tracking-wide">
                  Table · Bàn {selectedTable.table_number} · {selectedTable.seats} seats · chỗ · {date}
                </p>
                {bookingsForTable(selectedTable.id).map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    tables={tables}
                    onEdit={() => {
                      setEditingBooking(b);
                      setFormOpen(true);
                    }}
                    onStatus={(s) => {
                      updateBookingStatus(b.id, s).then(refresh);
                    }}
                  />
                ))}
                {bookingsForTable(selectedTable.id).length === 0 && (
                  <p className="text-muted text-sm">No bookings for this table yet · Chưa có đặt bàn</p>
                )}
              </div>
            )}
          </>
        )}

        {tab === "list" && (
          <div className="space-y-2">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                tables={tables}
                onEdit={() => {
                  setEditingBooking(b);
                  setFormOpen(true);
                }}
                onStatus={(s) => {
                  updateBookingStatus(b.id, s).then(refresh);
                }}
              />
            ))}
            {bookings.length === 0 && (
              <p className="text-muted text-center py-10 text-sm">No bookings for this day · Chưa có đặt bàn</p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setEditingBooking(null);
          setFormOpen(true);
        }}
        className="fixed bottom-24 md:bottom-8 right-6 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center z-20"
        aria-label="New booking"
      >
        <Plus size={26} />
      </button>

      {formOpen && (
        <BookingForm
          tables={tables}
          initialTableId={selectedTableId}
          editing={editingBooking}
          onSaved={() => {
            setFormOpen(false);
            setEditingBooking(null);
            refresh();
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditingBooking(null);
          }}
        />
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <RoleGate module="bookings">
      <BookingsContent />
    </RoleGate>
  );
}
