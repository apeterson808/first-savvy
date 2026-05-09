import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

const EVENT_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Lime' },
  { value: '#64748b', label: 'Slate' },
];

export default function EventDialog({ open, onOpenChange, event, defaultDate, childProfiles = [], onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [assignedChild, setAssignedChild] = useState('none');
  const [color, setColor] = useState('#3b82f6');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setEventDate(event.event_date || '');
      setAllDay(event.all_day !== false);
      setStartTime(event.start_time || '');
      setEndTime(event.end_time || '');
      setAssignedChild(event.assigned_to_child_id || 'none');
      setColor(event.color || '#3b82f6');
    } else {
      setTitle('');
      setDescription('');
      setEventDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : '');
      setAllDay(true);
      setStartTime('');
      setEndTime('');
      setAssignedChild('none');
      setColor('#3b82f6');
    }
  }, [event, defaultDate, open]);

  const handleSave = async () => {
    if (!title.trim() || !eventDate) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate,
        all_day: allDay,
        start_time: !allDay && startTime ? startTime : null,
        end_time: !allDay && endTime ? endTime : null,
        assigned_to_child_id: assignedChild === 'none' ? null : assignedChild,
        color,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Event Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Doctor appointment, Soccer practice..."
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="all-day">All Day</Label>
            <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {childProfiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>For</Label>
              <Select value={assignedChild} onValueChange={setAssignedChild}>
                <SelectTrigger>
                  <SelectValue placeholder="Whole family" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole family</SelectItem>
                  {childProfiles.map(child => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.display_name || child.child_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: c.value, outline: color === c.value ? `3px solid ${c.value}` : 'none', outlineOffset: 2 }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !eventDate || saving}>
            {saving ? 'Saving...' : event ? 'Save Changes' : 'Add Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
