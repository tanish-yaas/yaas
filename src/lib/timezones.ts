export type TimezoneOption = {
  value: string;
  label: string;
  region: string;
};

export const TIMEZONES: TimezoneOption[] = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", region: "India & South Asia" },
  { value: "Asia/Colombo", label: "Sri Lanka (IST)", region: "India & South Asia" },
  { value: "Asia/Karachi", label: "Pakistan (PKT)", region: "India & South Asia" },
  { value: "Asia/Dhaka", label: "Bangladesh (BST)", region: "India & South Asia" },
  { value: "Asia/Kathmandu", label: "Nepal (NPT)", region: "India & South Asia" },

  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)", region: "Middle East & Africa" },
  { value: "Asia/Riyadh", label: "Arabia Standard Time (AST)", region: "Middle East & Africa" },
  { value: "Asia/Jerusalem", label: "Israel (IST)", region: "Middle East & Africa" },
  { value: "Africa/Cairo", label: "Egypt (EET)", region: "Middle East & Africa" },
  { value: "Africa/Lagos", label: "West Africa (WAT)", region: "Middle East & Africa" },
  { value: "Africa/Nairobi", label: "East Africa (EAT)", region: "Middle East & Africa" },
  { value: "Africa/Johannesburg", label: "South Africa (SAST)", region: "Middle East & Africa" },

  { value: "Europe/London", label: "United Kingdom (GMT/BST)", region: "Europe" },
  { value: "Europe/Dublin", label: "Ireland (GMT/IST)", region: "Europe" },
  { value: "Europe/Lisbon", label: "Portugal (WET)", region: "Europe" },
  { value: "Europe/Paris", label: "Central European (CET)", region: "Europe" },
  { value: "Europe/Berlin", label: "Germany (CET)", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Netherlands (CET)", region: "Europe" },
  { value: "Europe/Madrid", label: "Spain (CET)", region: "Europe" },
  { value: "Europe/Rome", label: "Italy (CET)", region: "Europe" },
  { value: "Europe/Warsaw", label: "Poland (CET)", region: "Europe" },
  { value: "Europe/Athens", label: "Greece (EET)", region: "Europe" },
  { value: "Europe/Istanbul", label: "Turkey (TRT)", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow (MSK)", region: "Europe" },

  { value: "America/New_York", label: "US Eastern (ET)", region: "Americas" },
  { value: "America/Chicago", label: "US Central (CT)", region: "Americas" },
  { value: "America/Denver", label: "US Mountain (MT)", region: "Americas" },
  { value: "America/Phoenix", label: "Arizona (MST)", region: "Americas" },
  { value: "America/Los_Angeles", label: "US Pacific (PT)", region: "Americas" },
  { value: "America/Anchorage", label: "Alaska (AKT)", region: "Americas" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)", region: "Americas" },
  { value: "America/Toronto", label: "Canada Eastern (ET)", region: "Americas" },
  { value: "America/Vancouver", label: "Canada Pacific (PT)", region: "Americas" },
  { value: "America/Mexico_City", label: "Mexico (CST)", region: "Americas" },
  { value: "America/Bogota", label: "Colombia (COT)", region: "Americas" },
  { value: "America/Sao_Paulo", label: "Brazil (BRT)", region: "Americas" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (ART)", region: "Americas" },

  { value: "Asia/Singapore", label: "Singapore (SGT)", region: "Asia Pacific" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)", region: "Asia Pacific" },
  { value: "Asia/Shanghai", label: "China (CST)", region: "Asia Pacific" },
  { value: "Asia/Tokyo", label: "Japan (JST)", region: "Asia Pacific" },
  { value: "Asia/Seoul", label: "South Korea (KST)", region: "Asia Pacific" },
  { value: "Asia/Bangkok", label: "Thailand (ICT)", region: "Asia Pacific" },
  { value: "Asia/Jakarta", label: "Indonesia Western (WIB)", region: "Asia Pacific" },
  { value: "Asia/Manila", label: "Philippines (PHT)", region: "Asia Pacific" },
  { value: "Australia/Perth", label: "Australia Western (AWST)", region: "Asia Pacific" },
  { value: "Australia/Adelaide", label: "Australia Central (ACST)", region: "Asia Pacific" },
  { value: "Australia/Sydney", label: "Australia Eastern (AEST)", region: "Asia Pacific" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST)", region: "Asia Pacific" },

  { value: "UTC", label: "Coordinated Universal Time (UTC)", region: "Other" },
];

export const TIMEZONE_REGIONS = [
  "India & South Asia",
  "Asia Pacific",
  "Middle East & Africa",
  "Europe",
  "Americas",
  "Other",
];

/** Live GMT offset, e.g. "GMT+5:30". Recomputed so DST stays correct. */
export function offsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

/** Current wall-clock time there, e.g. "16:48". */
export function currentTime(timeZone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  } catch {
    return "";
  }
}