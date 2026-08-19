"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Users, Phone, AlertTriangle, X } from "lucide-react";
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
  removeTable,
  getBookingsForDate,
  createStaffBooking,
  updateBookingStatus,
  updateBooking,
  subscribeToBookings,
  type NewBookingInput,
} from "@/lib/bookings/repo";
import type { RestaurantTable, Booking, BookingStatus } from "@/lib/bookings/types";
import { STATUS_LABEL, STATUS_TONE, STATUS_ORDER } from "@/lib/bookings/labels";

type Tab = "floor" | "list";

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const isToday = date === todayIso();
  return (
    <div className="flex items-center gap-2 px-4 md:px-8 mb-4">
      <button onClick={() => onChange(addDaysIso(date, -1))} className="p-2 text-brand" aria-label="Previous day">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {date} {isToday && <span className="text-brand">· Today / Hôm nay</span>}
      </span>
      <button onClick={() => onChange(addDaysIso(date, 1))} className="p-2 text-brand" aria-label="Next day">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function AddTableForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [number, setNumber] = useState("");
  const [seats, setSeats] = useState("4");

  return (
    <Card className="mb-3">
      <p className="font-semibold text-sm mb-2">New table · Bàn mới</p>
      <div className="flex gap-2 mb-3">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Table number · Số bàn"
          className="flex-1 min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
        <input
          type="number"
          inputMode="numeric"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          placeholder="Seats"
          className="w-24 min-h-12 rounded-xl border-2 border-border px-3 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!number.trim() || !seats.trim()}
          onClick={async () => {
            await addTable(number.trim(), Number(seats), 0, 0, "square");
            onAdded();
          }}
        >
          Add · Thêm
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
                  Table {t.table_number} · {t.seats} seats
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
              {saving ? "Saving…" : "Save · Lưu"}
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
        <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status].en}</Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            className={`min-h-8 px-2 rounded-full text-[11px] font-semibold border-2 ${
              booking.status === s ? "bg-brand text-white border-brand" : "border-border text-muted"
            }`}
          >
            {STATUS_LABEL[s].en}
          </button>
        ))}
      </div>
    </Card>
  );
}

function TableCard({ table, bookingCount, selected, onSelect }: { table: RestaurantTable; bookingCount: number; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border-2 p-4 text-left transition-colors ${
        selected ? "border-brand bg-brand-light" : "border-border bg-surface active:bg-brand-light"
      }`}
    >
      <p className="text-2xl font-bold">{table.table_number}</p>
      <p className="text-xs text-muted flex items-center gap-1 mt-1">
        <Users size={12} /> {table.seats} seats
      </p>
      {bookingCount > 0 && (
        <span className="inline-block mt-2">
          <Badge tone="brand">
            {bookingCount} booking{bookingCount > 1 ? "s" : ""}
          </Badge>
        </span>
      )}
    </button>
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
            {canEditTables && (
              <div className="flex justify-end mb-3">
                <button onClick={() => setManagingTables((m) => !m)} className="text-xs text-brand font-semibold">
                  {managingTables ? "Done · Xong" : "Manage tables · Quản lý bàn"}
                </button>
              </div>
            )}
            {managingTables && <AddTableForm onAdded={refresh} onCancel={() => setManagingTables(false)} />}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {tables.map((t) => (
                <div key={t.id} className="relative">
                  <TableCard
                    table={t}
                    bookingCount={bookingsForTable(t.id).length}
                    selected={selectedTableId === t.id}
                    onSelect={() => setSelectedTableId(selectedTableId === t.id ? null : t.id)}
                  />
                  {managingTables && (
                    <button
                      onClick={async () => {
                        await removeTable(t.id);
                        refresh();
                      }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-danger text-white text-xs flex items-center justify-center"
                      aria-label="Remove table"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {tables.length === 0 && !managingTables && (
              <p className="text-muted text-center py-10 text-sm">No tables set up yet · Chưa có bàn nào</p>
            )}

            {selectedTableId && (
              <div className="space-y-2 mb-4">
                <p className="font-bold text-sm text-muted uppercase tracking-wide">
                  Table {tables.find((t) => t.id === selectedTableId)?.table_number} · {date}
                </p>
                {bookingsForTable(selectedTableId).map((b) => (
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
                {bookingsForTable(selectedTableId).length === 0 && (
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
