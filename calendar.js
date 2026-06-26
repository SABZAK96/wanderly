let myEvents = [];
myEvents.push({
  title: "disney day",
  start: "2026-06-26T09:00:00",
  end: "2026-06-26T17:00:00",
  color: "#534ab7",
  display:"block",
});

//   this code block is obtained from https://fullcalendar.io/docs/initialize-globals for initializing the FullCalendar
document.addEventListener("DOMContentLoaded", function () {
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
