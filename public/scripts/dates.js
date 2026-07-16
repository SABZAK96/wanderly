// this function gets the start date and end date and provide formatted data that will be used to show dates of
// the trips in the side bar
function formatTripDates(startStr, endStr) {
  // for turning a plain string such as "2022-08-11" to a date we should append T00:00:00 to it
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  // arrow function to get only month and day
  // date.toLocaleDateString(locale, formatoptions)
  const monthDay = (date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // arrow function to get month, day, and the year
  const fullDate = (date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // showing the compact version of the date such as jul 17 - 20 or jul 17 - sep 20
  // getDate gives the day of the month (getDay would give the day of the week instead)
  // this info is used in "your trips section"
  const compact =
    start.getMonth() === end.getMonth()
      ? `${monthDay(start)} - ${end.getDate()}`
      : `${monthDay(start)} - ${monthDay(end)}`;

  // showing the full version of date such as jul 20 - jul 23 , 2025 for trip details
  const full = `${monthDay(start)} - ${fullDate(end)}`;

  //computing the nights for trip details
  // subtracting 2 date objects gives us the total value in milliseconds that we should divide by the
  // total number of milliseconds in a day (1000 ms/sec × 60 sec/min × 60 min/hr × 24 hr/day)
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return { compact, full, nights };
}
