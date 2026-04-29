import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/contexts/ProfileContext';
import { calendarEventsAPI } from '@/api/calendarEvents';
import { calendarPreferencesAPI } from '@/api/calendarPreferences';
import { childProfilesAPI } from '@/api/childProfiles';
import { tasksAPI } from '@/api/tasks';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/pages/utils';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth,
  isToday, startOfDay, isBefore
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function taskAppearsOnDay(task, day) {
  if (task.due_date) {
    const s = typeof task.due_date === 'string' ? task.due_date.slice(0, 10) : format(new Date(task.due_date), 'yyyy-MM-dd');
    return s === format(day, 'yyyy-MM-dd');
  }
  const today = startOfDay(new Date());
  const dayStart = startOfDay(day);
  if (isBefore(dayStart, today)) return false;
  const { reset_mode, frequency } = task;
  if (reset_mode === 'instant') return false;
  if (frequency === 'always_available' || reset_mode === 'daily') return true;
  if (reset_mode === 'weekly') {
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    return !isBefore(dayStart, weekStart) && !isBefore(weekEnd, dayStart);
  }
  return false;
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarCard() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id;

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthRange = useMemo(() => ({
    start: format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const { data: preferences } = useQuery({
    queryKey: ['calendarPreferences', profileId],
    queryFn: () => calendarPreferencesAPI.getPreferences(profileId),
    enabled: !!profileId,
    staleTime: 60000,
  });

  const { data: childProfiles = [] } = useQuery({
    queryKey: ['childProfiles', profileId],
    queryFn: () => childProfilesAPI.getChildProfiles(profileId),
    enabled: !!profileId,
    staleTime: 60000,
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendarEvents', profileId, monthRange.start, monthRange.end],
    queryFn: () => calendarEventsAPI.getEventsForRange(profileId, monthRange.start, monthRange.end),
    enabled: !!profileId,
    staleTime: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', profileId],
    queryFn: () => tasksAPI.getTasks(profileId),
    enabled: !!profileId,
    staleTime: 30000,
  });

  const childColors = useMemo(() => {
    const existing = preferences?.child_colors || {};
    if (Object.keys(existing).length > 0) return existing;
    return calendarPreferencesAPI.assignColorsToChildren(childProfiles, {});
  }, [preferences?.child_colors, childProfiles]);

  const allDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const getDayDots = useCallback((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dots = [];

    // Calendar events — use their own color
    calendarEvents
      .filter(e => e.event_date === dateStr)
      .slice(0, 2)
      .forEach(e => dots.push(e.color || '#10b981'));

    // Tasks — use child's assigned color
    tasks
      .filter(t => taskAppearsOnDay(t, day))
      .slice(0, Math.max(0, 4 - dots.length))
      .forEach(t => dots.push(childColors[t.assigned_to_child_id] || '#3b82f6'));

    return dots.slice(0, 4);
  }, [calendarEvents, tasks, childColors]);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <p className="text-xs font-semibold text-slate-700 min-w-[100px] text-center select-none">
            {format(currentMonth, 'MMMM yyyy')}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
        <Button
          variant="link"
          className="text-[10px] p-0 h-auto text-sky-blue"
          onClick={() => navigate(createPageUrl('Calendar'))}
        >
          Open
        </Button>
      </CardHeader>

      <CardContent className="px-2 pb-3 pt-1">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-0.5">
          {DOW.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-medium text-slate-400 py-0.5">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {allDays.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const todayDay = isToday(day);
            const dots = getDayDots(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => navigate(createPageUrl('Calendar'))}
                className={cn(
                  'flex flex-col items-center py-0.5 cursor-pointer rounded transition-colors hover:bg-slate-50',
                  !isCurrentMonth && 'opacity-25'
                )}
              >
                <span className={cn(
                  'text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full leading-none',
                  todayDay ? 'bg-sky-500 text-white font-semibold' : 'text-slate-700'
                )}>
                  {format(day, 'd')}
                </span>
                {dots.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 h-1.5">
                    {dots.map((color, i) => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
                {dots.length === 0 && <div className="h-1.5" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
