import React, { useMemo, useCallback } from 'react';
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
  format, startOfWeek, endOfWeek, addDays,
  eachDayOfInterval, isToday, startOfDay, isBefore
} from 'date-fns';
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

  const { thisWeekStart, nextWeekEnd, rangeStart, rangeEnd } = useMemo(() => {
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const nextWeekEnd = endOfWeek(addDays(thisWeekStart, 7), { weekStartsOn: 0 });
    return {
      thisWeekStart,
      nextWeekEnd,
      rangeStart: format(thisWeekStart, 'yyyy-MM-dd'),
      rangeEnd: format(nextWeekEnd, 'yyyy-MM-dd'),
    };
  }, []);

  const allDays = useMemo(() =>
    eachDayOfInterval({ start: thisWeekStart, end: nextWeekEnd }),
    [thisWeekStart, nextWeekEnd]
  );

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
    queryKey: ['calendarEvents', profileId, rangeStart, rangeEnd],
    queryFn: () => calendarEventsAPI.getEventsForRange(profileId, rangeStart, rangeEnd),
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

  const getDayDots = useCallback((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dots = [];
    calendarEvents
      .filter(e => e.event_date === dateStr)
      .slice(0, 3)
      .forEach(e => dots.push(e.color || '#10b981'));
    tasks
      .filter(t => taskAppearsOnDay(t, day))
      .slice(0, Math.max(0, 5 - dots.length))
      .forEach(t => dots.push(childColors[t.assigned_to_child_id] || '#3b82f6'));
    return dots.slice(0, 5);
  }, [calendarEvents, tasks, childColors]);

  const handleDayClick = (day) => {
    navigate(createPageUrl('Calendar'));
  };

  const week1 = allDays.slice(0, 7);
  const week2 = allDays.slice(7, 14);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Calendar</p>
        <Button
          variant="link"
          className="text-[10px] p-0 h-auto text-sky-blue font-medium"
          onClick={() => navigate(createPageUrl('Calendar'))}
        >
          View all
        </Button>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((d, i) => (
            <div key={i} className="text-center text-[9px] font-medium text-slate-400 pb-1">
              {d.slice(0, 2)}
            </div>
          ))}
        </div>

        {[week1, week2].map((week, wi) => (
          <div key={wi} className={cn('grid grid-cols-7 gap-px', wi === 0 && 'mb-1')}>
            {week.map((day) => {
              const dots = getDayDots(day);
              const todayDay = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'relative flex flex-col min-h-[64px] p-1 cursor-pointer border border-slate-100 rounded transition-colors hover:bg-slate-50',
                    todayDay ? 'bg-sky-50 border-sky-200' : 'bg-white'
                  )}
                >
                  <span className={cn(
                    'text-[10px] font-semibold leading-none w-4 h-4 flex items-center justify-center rounded-full',
                    todayDay ? 'bg-sky-500 text-white' : 'text-slate-600'
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dots.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1.5 px-0.5">
                      {dots.map((color, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
