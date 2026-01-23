// Layer 6: Automation Layer - Google Calendar Types

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  recurrence?: string[];
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface GoogleCalendarApiResponse {
  kind: string;
  etag: string;
  id: string;
  status: string;
  htmlLink: string;
  created: string;
  updated: string;
}

export interface InternalEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTimeIso: string;
  endTimeIso: string;
  durationMinutes: number;
}

export function mapInternalEventToGoogleEvent(event: InternalEvent): GoogleCalendarEvent {
  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startTimeIso,
      timeZone: 'Asia/Jerusalem'
    },
    end: {
      dateTime: event.endTimeIso,
      timeZone: 'Asia/Jerusalem'
    }
  };
}

export function mapGoogleEventToInternal(googleEvent: GoogleCalendarEvent & { id: string }): Partial<InternalEvent> {
  const startDate = new Date(googleEvent.start.dateTime);
  const endDate = new Date(googleEvent.end.dateTime);
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  
  return {
    title: googleEvent.summary,
    description: googleEvent.description,
    location: googleEvent.location,
    startTimeIso: googleEvent.start.dateTime,
    endTimeIso: googleEvent.end.dateTime,
    durationMinutes
  };
}
