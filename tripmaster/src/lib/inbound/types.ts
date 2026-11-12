// What a forwarded email was read as, and what the app did with each part.

export type ItemAction =
  | 'enrich'     // adds to something already in the trip (ticket, address, ref, link)
  | 'create'     // a confirmed booking or scheduled thing that isn't in the trip yet
  | 'change'     // says something saved has moved (time, date, place)
  | 'cancel'     // says something saved is cancelled
  | 'optional'   // could be added (optional session, "if you'd like to join", TBC)
  | 'reference'  // worth keeping with the trip, nothing to schedule (invoice, visa letter, info pack)
  | 'ignore';    // nothing for the trip (newsletter, app promo)

export type ItemKind = 'accommodation' | 'venue' | 'stop' | 'transport' | 'document';
export type EntryKind = Exclude<ItemKind, 'document'>;

/** Everything the email says about one thing — a field is "" when it doesn't say. */
export interface Details {
  name:               string;
  type:               string;
  date:               string;   // YYYY-MM-DD
  time:               string;   // HH:MM
  scheduledStart:     string;   // YYYY-MM-DDTHH:MM:SS, local to where it happens
  duration:           number;   // minutes, 0 when unknown
  address:            string;
  building:           string;
  searchQuery:        string;
  checkIn:            string;
  checkOut:           string;
  checkInTime:        string;
  checkOutTime:       string;
  confirmationNumber: string;
  departureLocation:  string;
  arrivalLocation:    string;
  departureTime:      string;
  arrivalTime:        string;
  flightNumber:       string;
  operator:           string;
  notes:              string;
  coordinates?:       { lat: number; lng: number };
  located?:           boolean;  // the address lookup has run
}

/** One field this email set (or offers to set) on a saved item. `from` undefined = was empty. */
export interface FieldChange {
  field: string;   // path on the saved item, e.g. "address", "details.flightNumber"
  label: string;
  from:  any;
  to:    any;
}

/** The saved booking or stop an item is about — found by id, so moves don't lose it. */
export interface Target {
  kind:    EntryKind;
  itemId?: string;   // a booking's own id
  stopId?: string;   // a stop's _id
  label:   string;
}

export type ItemState = 'applied' | 'pending' | 'dismissed' | 'undone';

export interface InboundItem {
  n:              number;
  action:         ItemAction;
  kind:           ItemKind;
  tripId:         string | null;
  title:          string;
  why:            string;
  documentType:   string;
  details:        Details | null;
  attachments:    number[];                       // indexes into the email's files
  links:          { label: string; url: string }[];
  target:         Target | null;
  created:        boolean;                        // the target was made by this email
  state:          ItemState;
  filled:         FieldChange[];                  // blanks this email filled
  changes:        FieldChange[];                  // differing values, offered — applied ones move to `accepted`
  accepted:       FieldChange[];
  cancelled:      FieldChange[];                  // what "Mark cancelled" set
  fileIds:        string[];                       // trip resources made for this item
  note?:          string;                         // why it's waiting on you
}

export interface StoredFile {
  index:     number;
  name:      string;
  mimeType:  string;
  size:      number;
  gcsPath:   string;
  gcsUrl:    string;
  barcode?:  { format: string; text: string; svg: string; bcbp: any } | null;
}
