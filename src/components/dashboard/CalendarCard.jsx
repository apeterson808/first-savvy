import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/contexts/ProfileContext';
import { calendarEventsAPI } from '@/api/calendarEvents';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/pages/utils';
import { format, startOfDay, addDays, isSameDay, isToday, isTomorrow, parseISO } from 'date-fns';
import * as Icons from 'lucide-react';
import { Calendar } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDotColor(color) {
  return color || '#3b82f6';
}

export default function CalendarCard() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();

  const today = startOfDay(new Date());
  const rangeStart = format(today, 'yyyy-MM-dd');
  const rangeEnd = format(addDays(today, 13), 'yyyy-MM-dd');

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events-dashboard', activeProfile?.id, rangeStart, rangeEnd],
    queryFn: () => calendarEventsAPI.getEventsForRange(activeProfile.id, rangeStart, rangeEnd),
    enabled: !!activeProfile?.id,
    staleTime: 60000,
  });

  // Build a mini 2-week calendar (2 rows × 7 cols)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const eventsForDay = (date) =>
    events.filter(e => isSameDay(parseISO(e.event_date), date));

  // Upcoming events in the next 14 days, max 5
  const upcoming = events.slice(0, 5);

  function dayLabel(date) {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Upcoming Calendar</p>
        <Button
          variant="link"
          className="text-xs p-0 h-auto text-sky-blue"
          onClick={() => navigate(createPageUrl('Calendar'))}
        >
          Open calendar
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Mini 2-week grid */}
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400">{d}</div>
            ))}
          </div>
          {/* Week rows */}
          {[0, 1].map(week => (
            <div key={week} className="grid grid-cols-7 gap-y-1">
              {days.slice(week * 7, week * 7 + 7).map((date, i) => {
                const dayEvents = eventsForDay(date);
                const isT = isToday(date);
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                        ${isT ? 'bg-sky-blue text-white' : 'text-slate-700 hover:bg-slate-100 cursor-default'}`}
                    >
                      {format(date, 'd')}
                    </div>
                    {/* Event dots */}
                    <div className="flex gap-0.5 mt-0.5 h-1.5">
                      {dayEvents.slice(0, 3).map((e, ei) => (
                        <div
                          key={ei}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: getDotColor(e.color) }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Upcoming event list */}
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center">
            <Calendar className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">No upcoming events in the next 2 weeks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(event => {
              const date = parseISO(event.event_date);
              const IconComp = Icons[event.icon] || Icons.Calendar;
              return (
                <div key={event.id} className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${getDotColor(event.color)}18` }}
                  >
                    <IconComp className="w-3.5 h-3.5" style={{ color: getDotColor(event.color) }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{event.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {dayLabel(date)}
                      {event.start_time && ` · ${event.start_time.slice(0, 5)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
