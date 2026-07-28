let myEvents = [];
const tripId = localStorage.getItem("selectedTripId");
// get all the events from the db
async function eventsFromDB(tripId) {
  const calendarError = document.getElementById("calendarError");
  calendarError.classList.add("hidden");
  try {
    const response = await fetch(`/allUserActivities/${tripId}`);
    if (response.ok) {
      const data = await response.json();

      if (data.length === 0) {
        calendarError.className = "text-md text-base-content/60 mt-1 text-center";
        calendarError.textContent = "No activities to show on your Calendar Yet.";
        calendarError.classList.remove("hidden");
        return;
      }

      data.forEach((obj) => {
        // date that comes from the db is a string in ISO format, and Z should be removed
        // the time that comes from the db is in 14:30 format which should be converted to 14:30:00
        // fullCalendar accepts start: "2026-06-26T09:00:00" which is a string
        const EventStart = obj.date.slice(0, 10) + "T" + obj.startTime + ":00";
        const EventEnd = obj.date.slice(0, 10) + "T" + obj.endTime + ":00";
        myEvents.push({
          title: obj.activityName,
          start: EventStart,
          end: EventEnd,
          display: "block",
        });
      });
    } else {
      calendarError.className = "text-sm text-red-500 mt-1 text-center";
      calendarError.textContent = await response.text();
      calendarError.classList.remove("hidden");
    }
  } catch (error) {
    calendarError.className = "text-sm text-red-500 mt-1 text-center";
    calendarError.textContent = "Could not reach the server. Try again.";
    calendarError.classList.remove("hidden");
  }
}

//   this code block is obtained from https://fullcalendar.io/docs/initialize-globals for initializing the FullCalendar
document.addEventListener("DOMContentLoaded", async function () {

  // wait for the array to get populated based on the response from the server then construct the calendar
  if (tripId) await eventsFromDB(tripId);
  var calendarEl = document.getElementById("calendar");
  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    events: myEvents,
    views: {
      dayGridMonth: {
        displayEventTime: false,
        displayEventEnd: false,
      },
      timeGridDay: {
        displayEventTime: true,
        displayEventEnd: true,
        eventTimeFormat: {
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        },
      },
    },
    // dateClick is a built-in FullCalendar callback, fires on any date cell click.
    // info is predefined by FullCalendar: info.dateStr = clicked date as "YYYY-MM-DD",
    // changeView(viewName, date) is a built-in method on every FullCalendar instance.
    dateClick: function (info) {
      calendar.changeView("timeGridDay", info.dateStr);
    },
  });
  calendar.render();
});
