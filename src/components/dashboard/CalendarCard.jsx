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
  isSameDay, isToday, startOfDay, isBefore
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

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const getDayData = useCallback((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);
    const dayTasks = tasks.filter(t => taskAppearsOnDay(t, day));
    return { dayEvents, dayTasks };
  }, [calendarEvents, tasks]);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <p className="text-sm font-semibold text-slate-700 min-w-[110px] text-center select-none">
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
          className="text-xs p-0 h-auto text-sky-blue"
          onClick={() => navigate(createPageUrl('Calendar'))}
        >
          Open calendar
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">
              {d.slice(0, 2)}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 border-l border-t border-slate-100">
          {allDays.map((day, idx) => {
            const { dayEvents, dayTasks } = getDayData(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const todayDay = isToday(day);
            const visibleEvents = dayEvents.slice(0, 2);
            const visibleTasks = dayTasks.slice(0, Math.max(0, 2 - visibleEvents.length));
            const overflow = (dayEvents.length + dayTasks.length) - visibleEvents.length - visibleTasks.length;

            return (
              <div
                key={day.toISOString()}
                onClick={() => navigate(createPageUrl('Calendar'))}
                className={cn(
                  'min-h-[72px] border-b border-r border-slate-100 p-1 cursor-pointer transition-colors',
                  isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50',
                )}
              >
                <div className="flex items-center justify-end mb-0.5">
                  <span className={cn(
                    'text-[10px] font-semibold w-5 h-5 flex items-center justify-center rounded-full',
                    todayDay
                      ? 'bg-sky-500 text-white'
                      : isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>

                {visibleEvents.map(event => (
                  <div
                    key={event.id}
                    className="text-[9px] font-medium px-1 py-0.5 rounded mb-0.5 truncate leading-tight"
                    style={{
                      backgroundColor: `${event.color || '#10b981'}18`,
                      color: event.color || '#10b981',
                    }}
                  >
                    {event.title}
                  </div>
                ))}

                {visibleTasks.map(task => (
                  <div
                    key={task.id}
                    className="text-[9px] font-medium px-1 py-0.5 rounded mb-0.5 truncate leading-tight border-l-2"
                    style={{
                      backgroundColor: `${childColors[task.assigned_to_child_id] || '#3b82f6'}12`,
                      color: childColors[task.assigned_to_child_id] || '#3b82f6',
                      borderLeftColor: childColors[task.assigned_to_child_id] || '#3b82f6',
                    }}
                  >
                    {task.title}
                  </div>
                ))}

                {overflow > 0 && (
                  <span className="text-[8px] text-slate-400 pl-1">+{overflow}</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
