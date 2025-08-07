import type { GymSession } from '@/types';

export function generateICSFile(session: GymSession, partnerName: string = 'Partner'): string {
  const formatDate = (date: Date, hour: number): string => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDateTime = formatDate(session.date, session.startTime);
  const endDateTime = formatDate(session.date, session.endTime);
  
  const uid = `${session.id}@gymbuddy.app`;
  const title = `💪 Gym Session with ${partnerName}`;
  const description = `GymBuddy workout session\\n\\nTime: ${formatSessionTime(session.startTime)} - ${formatSessionTime(session.endTime)}\\n\\nDon't forget to bring:\\n- Water bottle\\n- Gym clothes\\n- Good energy!`;
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GymBuddy//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${startDateTime}`,
    `DTEND:${endDateTime}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'LOCATION:Gym',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Gym session in 30 minutes!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsContent;
}

export function downloadICSFile(session: GymSession, partnerName: string = 'Partner'): void {
  const icsContent = generateICSFile(session, partnerName);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `gym-session-${session.date.toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSessionTime(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}