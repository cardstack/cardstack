// https://stackoverflow.com/questions/948532/how-to-convert-a-date-to-utc
export function convertDateToUTC(date: Date) {
  return new Date(date.toUTCString());
}

export function nowUtc() {
  return convertDateToUTC(new Date());
}
